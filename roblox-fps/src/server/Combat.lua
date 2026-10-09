--!nonstrict
-- Damage pipeline: player hits, enemy projectiles, explosions, drums, grenades, pickups, power-ups and killstreaks.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Debris = game:GetService("Debris")
local Shared = ReplicatedStorage:WaitForChild("FoundryShared")
local Config = require(Shared:WaitForChild("Config"))
local Stats = require(Shared:WaitForChild("Stats"))
local Remotes = require(Shared:WaitForChild("Remotes"))
local Enemies = require(script.Parent:WaitForChild("Enemies"))

local Combat = {}
-- set by init: pr(plr), alive(plr), targets(), map(), wave(), scale(), markRun(plr), onDamaged(plr, amount), running()
local ctx: any
local rng = Random.new()
local function rand(a, b) return a + rng:NextNumber() * (b - a) end
local V = Vector3.new
local S = Config.METER

function Combat.init(context) ctx = context end
local function fx(kind, ...) Remotes.FX:FireAllClients(kind, ...) end
Combat.fx = fx

---------------------------------------------------------------- hit reports (batched per frame)
local reports: { [Player]: any } = {}
local function report(plr: Player)
	local r = reports[plr]
	if not r then
		r = { killed = false, head = false, weak = false, block = false, numbers = {} }
		reports[plr] = r
	end
	return r
end
function Combat.flush()
	for plr, r in pairs(reports) do
		if plr.Parent then Remotes.Hit:FireClient(plr, r) end
	end
	table.clear(reports)
end

-- apply damage from a player to an enemy; zone is the part zone that was hit
function Combat.hitEnemy(plr: Player?, e, zone: string, amount: number, info)
	if e.hp <= 0 or amount <= 0 then return false end
	info.owner = plr
	info.part = zone
	local kind = "normal"
	if zone == "shield" then
		-- the Bulwark shield soaks frontal fire
		if plr then
			local r = report(plr)
			r.block = true
			table.insert(r.numbers, { info.pos or e:center(), "BLOCKED", "block" })
		end
		return false
	end
	local pr = plr and ctx.pr(plr)
	if pr and (info.source == "bullet" or info.source == "plasma") then
		local mods = Stats.buffMods(pr.buffs, pr.powerups)
		if zone == "head" then
			amount *= (info.headMult or 2) + mods.head
			kind = "head"
		else
			amount *= Stats.partMult(zone, 2)
			if zone == "weak" then kind = "weak" end
		end
	elseif zone == "weak" then
		amount *= 1.5
	end
	local killed, dealt = e:damage(amount, info)
	if pr and plr then
		local r = report(plr)
		r.killed = r.killed or killed
		r.head = r.head or kind == "head"
		r.weak = r.weak or kind == "weak"
		if dealt > 0 then
			table.insert(r.numbers, { info.pos or e:center(), math.floor(dealt + 0.5), killed and (kind == "normal" and "kill" or kind) or kind })
			local mods = Stats.buffMods(pr.buffs, pr.powerups)
			if mods.leech > 0 then ctx.heal(plr, dealt * mods.leech) end
			-- Vampire's Fang: lifesteal on every hit
			if info.weapon == "fang" and (info.source == "bullet" or info.source == "plasma") then ctx.heal(plr, dealt * Config.Halloween.Lifesteal) end
		end
	end
	return killed
end

---------------------------------------------------------------- player damage
function Combat.damagePlayer(plr: Player, amount: number, from: Vector3?, kind: string?)
	if not ctx.running() then return end
	local c, h = ctx.alive(plr)
	local pr = ctx.pr(plr)
	if not c or not pr or not pr.deployed or amount <= 0 then return end
	local mods = Stats.buffMods(pr.buffs, pr.powerups)
	amount *= mods.armorMul
	local armor = plr:GetAttribute("Armor") or 0
	local absorbed = math.min(armor, amount * 0.6)
	plr:SetAttribute("Armor", armor - absorbed)
	h:TakeDamage(amount - absorbed)
	ctx.onDamaged(plr, amount)
	Remotes.Damage:FireClient(plr, amount, from, kind)
end

---------------------------------------------------------------- explosions and drums
local explosion
local function damageDrum(drum: BasePart, amount: number, owner: Player?)
	if not drum.Parent or drum:GetAttribute("Boom") then return end
	local hp = (drum:GetAttribute("HP") or Config.Barrel.HP) - amount
	drum:SetAttribute("HP", hp)
	if hp < 20 and not drum:FindFirstChildOfClass("Fire") then
		local f = Instance.new("Fire")
		f.Size, f.Heat = 3, 12
		f.Parent = drum
	end
	if hp <= 0 then
		drum:SetAttribute("Boom", true)
		task.delay(rand(0.05, 0.3), function()
			if not drum.Parent then return end
			local p = drum.Position
			drum:Destroy()
			explosion(p + V(0, 1, 0), Config.Barrel.Radius, Config.Barrel.Damage, owner, { source = "explosion", weapon = "drum", selfDamage = 0.6 })
		end)
	end
end
Combat.damageDrum = damageDrum

-- opts: source, weapon, selfDamage (owner), enemyDamage (enemy-owned blasts), playerDamage, stun
function explosion(pos: Vector3, radius: number, damage: number, owner: Player?, opts)
	opts = opts or {}
	fx(opts.stun and "stunBoom" or "boom", pos, radius)
	local pr = owner and ctx.pr(owner)
	local blast = pr and Stats.buffMods(pr.buffs, pr.powerups).blast or 1
	local enemyMul = owner and blast or (opts.enemyDamage or 0)
	if enemyMul > 0 or opts.stun then
		for _, e in ipairs(table.clone(Enemies.list())) do
			if e.hp > 0 then
				local c = e:center()
				local d = (c - pos).Magnitude
				local reach = radius + (e.boss and 10 or 0)
				if d < reach then
					local f = 1 - d / reach
					local dir = (c - pos)
					dir = dir.Magnitude > 0.01 and dir.Unit or Vector3.yAxis
					if not e.boss and e.hum then e.root.AssemblyLinearVelocity += dir * 60 * f + V(0, 25 * f, 0) end
					if opts.stun then e:stun(3 * (0.5 + 0.5 * f)) end
					local amount = damage * (0.3 + 0.7 * f) * enemyMul
					if amount > 0 then
						Combat.hitEnemy(owner, e, "body", amount, { dir = dir, weapon = opts.weapon or "explosion", source = opts.source or "explosion", pos = c })
					end
				end
			end
		end
	end
	if not opts.stun then
		for _, drum in ipairs(ctx.map().drumFolder:GetChildren()) do
			if drum:IsA("BasePart") and (drum.Position - pos).Magnitude < radius * 0.9 then damageDrum(drum, 999, owner) end
		end
	end
	local playerMul = opts.playerDamage or 0.55
	for _, t in ipairs(ctx.targets()) do
		local mul = playerMul
		if owner then mul = (t.player == owner) and playerMul * (opts.selfDamage or 0.5) or 0 end
		if opts.stun then mul = 0 end
		if mul > 0 then
			local d = (t.root.Position - pos).Magnitude
			if d < radius * 1.1 then
				local f = 1 - d / (radius * 1.1)
				Combat.damagePlayer(t.player, damage * mul * f, pos, "explosion")
			end
		end
	end
end
Combat.explosion = explosion

---------------------------------------------------------------- enemy projectiles: bolts, orbs and mortar arcs
local shots = {}
local shotId = 0
local shotParams = RaycastParams.new()
shotParams.FilterType = Enum.RaycastFilterType.Exclude

function Combat.bolt(origin: Vector3, dir: Vector3, speed: number, damage: number, style: string?)
	shotId += 1
	table.insert(shots, { id = shotId, kind = "bolt", pos = origin, vel = dir * speed, damage = damage, t = 0 })
	fx("bolt", shotId, origin, dir * speed, style or "bolt")
end

function Combat.orb(origin: Vector3, dir: Vector3, speed: number, damage: number, radius: number, color: Color3?)
	shotId += 1
	table.insert(shots, { id = shotId, kind = "orb", pos = origin, vel = dir * speed, damage = damage, radius = radius, t = 0 })
	fx("orb", shotId, origin, dir * speed, color)
end

-- mortar shell flying from origin to target over time; the client draws a warning ring at the target
function Combat.arc(origin: Vector3, target: Vector3, time: number, damage: number, radius: number)
	local down = workspace:Raycast(target + V(0, 30, 0), V(0, -80, 0), shotParams)
	local ground = down and down.Position or target
	shotId += 1
	table.insert(shots, { id = shotId, kind = "arc", from = origin, to = ground, time = time, damage = damage, radius = radius, t = 0 })
	fx("arc", shotId, origin, ground, time, radius)
end

-- player plasma: a fast glowing projectile with a small splash
function Combat.plasma(plr: Player, origin: Vector3, dir: Vector3, w)
	shotId += 1
	local pr = ctx.pr(plr)
	local dmg = w.dmg * Stats.buffMods(pr.buffs, pr.powerups).damage
	table.insert(shots, { id = shotId, kind = "plasma", owner = plr, pos = origin, vel = dir * w.projSpeed, damage = dmg, splash = w.splash, head = w.head, weapon = w.id, t = 0 })
	fx("plasma", shotId, origin, dir * w.projSpeed, plr)
end

-- volatile modifier: a wrecked bot blows up after a short warning
function Combat.delayedBlast(pos: Vector3, damage: number)
	fx("warnRing", pos, 18, 1.1)
	task.delay(1.1, function()
		if ctx.running() then explosion(pos, 18, damage, nil, { source = "enemy", enemyDamage = 0, playerDamage = 1 }) end
	end)
end

local function filterList()
	local ignore = { workspace.Projectiles, workspace.Debris, workspace.Pickups }
	return ignore
end

local function updateShots(dt)
	local base = filterList()
	for i = #shots, 1, -1 do
		local b = shots[i]
		b.t += dt
		if b.kind == "arc" then
			if b.t >= b.time then
				table.remove(shots, i)
				fx("arcEnd", b.id)
				explosion(b.to + V(0, 1, 0), b.radius, b.damage, nil, { source = "enemy", playerDamage = 1 })
			end
		else
			local ignore = table.clone(base)
			if b.kind == "plasma" then
				table.insert(ignore, b.owner.Character)
			else
				table.insert(ignore, workspace.Enemies)
			end
			shotParams.FilterDescendantsInstances = ignore
			local step = b.vel * dt
			local res = workspace:Raycast(b.pos, step, shotParams)
			if res then
				table.remove(shots, i)
				local inst = res.Instance
				if b.kind == "bolt" then
					local plr = Players:GetPlayerFromCharacter(inst:FindFirstAncestorWhichIsA("Model"))
					if plr then Combat.damagePlayer(plr, b.damage, b.pos, "bolt") end
					if inst.Name == "FuelDrum" then damageDrum(inst :: BasePart, b.damage, nil) end
					fx("boltEnd", b.id, res.Position, res.Normal, plr ~= nil)
				elseif b.kind == "orb" then
					fx("boltEnd", b.id, res.Position, res.Normal, false)
					explosion(res.Position + res.Normal, b.radius, b.damage, nil, { source = "enemy", playerDamage = 1 })
				elseif b.kind == "plasma" then
					fx("boltEnd", b.id, res.Position, res.Normal, false)
					local e, zone = Enemies.fromPart(inst)
					if e then
						Combat.hitEnemy(b.owner, e, zone, b.damage, { dir = b.vel.Unit, weapon = b.weapon, source = "plasma", headMult = b.head, pos = res.Position })
					elseif inst.Name == "FuelDrum" then
						damageDrum(inst :: BasePart, b.damage, b.owner)
					end
					explosion(res.Position + res.Normal * 0.5, b.splash, b.damage * 0.45, b.owner, { source = "explosion", weapon = b.weapon, selfDamage = 0.15 })
				end
			elseif b.t > (b.kind == "plasma" and 2.5 or 4) then
				table.remove(shots, i)
				fx("boltEnd", b.id, nil)
			else
				b.pos += step
			end
		end
	end
end

---------------------------------------------------------------- grenades
function Combat.throw(plr: Player, kind: string, origin: Vector3, dir: Vector3)
	local c = plr.Character
	local root = c and c:FindFirstChild("HumanoidRootPart") :: BasePart?
	local g = Instance.new("Part")
	g.Name = kind == "stun" and "Stun" or "Frag"
	g.Shape = Enum.PartType.Ball
	g.Size = V(0.8, 0.8, 0.8)
	g.Material = Enum.Material.Metal
	g.Color = kind == "stun" and Color3.fromRGB(70, 110, 150) or Color3.fromRGB(63, 74, 48)
	g.CustomPhysicalProperties = PhysicalProperties.new(2, 0.6, 0.35, 1, 1)
	g.CFrame = CFrame.new(origin + dir * 2.5)
	g.CanQuery = false
	local blink = Instance.new("PointLight")
	blink.Color = kind == "stun" and Config.Colors.Block or Color3.fromRGB(255, 40, 30)
	blink.Range, blink.Brightness = 7, 2
	blink.Parent = g
	g.Parent = workspace.Projectiles
	g:SetNetworkOwner(nil)
	g.AssemblyLinearVelocity = dir * Config.Grenade.Speed + V(0, 14, 0) + (root and root.AssemblyLinearVelocity * 0.5 or Vector3.zero)
	g.AssemblyAngularVelocity = V(rand(-10, 10), rand(-10, 10), rand(-10, 10))
	local fuse = kind == "stun" and Config.Grenade.StunFuse or Config.Grenade.Fuse
	task.delay(fuse, function()
		if not g.Parent then return end
		local p = g.Position
		g:Destroy()
		if kind == "stun" then
			-- stuns everything in range and chips it for a hit marker
			explosion(p, Config.Grenade.StunRadius, 15, plr, { source = "explosion", weapon = "stun", stun = true })
		else
			explosion(p, Config.Grenade.Radius, Config.Grenade.Damage, plr, { source = "explosion", weapon = "frag", selfDamage = 0.5 })
		end
	end)
end

---------------------------------------------------------------- pickups and power-ups
local PICKUP = {
	health = { color = Config.Colors.Heal, label = "+40 health" },
	ammo = { color = Config.Colors.Accent, label = "Ammo resupply" },
	armor = { color = Config.Colors.Armor, label = "+25 armor" },
	pu_damage = { color = Color3.fromRGB(255, 74, 61), label = "Double damage · 10s", power = "damage" },
	pu_speed = { color = Color3.fromRGB(180, 140, 255), label = "Overdrive · 10s", power = "speed" },
	pu_ammo = { color = Color3.fromRGB(255, 210, 74), label = "Bottomless mag · 10s", power = "ammo" },
}
Combat.PICKUP = PICKUP

function Combat.spawnPickup(kind: string, pos: Vector3)
	local def = PICKUP[kind]
	local m = Instance.new("Model")
	m.Name = kind
	local function part(size, color, mat, cf, shape)
		local p = Instance.new("Part")
		p.Anchored, p.CanCollide, p.CanQuery = true, false, false
		if shape then p.Shape = shape end
		p.Size, p.Color, p.Material, p.CFrame = size, color, mat, cf
		p.CastShadow = false
		p.Parent = m
		return p
	end
	local down = workspace:Raycast(pos + V(0, 4, 0), V(0, -40, 0), shotParams)
	local y = down and down.Position.Y or pos.Y
	local base = CFrame.new(pos.X, y + 2.2, pos.Z)
	local core
	if def.power then
		core = part(V(1.8, 1.8, 1.8), def.color, Enum.Material.Neon, base, Enum.PartType.Ball)
		core.Transparency = 0.15
		part(V(2.6, 2.6, 2.6), def.color, Enum.Material.ForceField, base, Enum.PartType.Ball)
	else
		core = part(V(1.8, 1.2, 1.3), Color3.fromRGB(24, 28, 32), Enum.Material.Metal, base)
		if kind == "health" then
			part(V(0.95, 0.3, 1.35), def.color, Enum.Material.Neon, base)
			part(V(0.3, 0.95, 1.35), def.color, Enum.Material.Neon, base)
		elseif kind == "ammo" then
			part(V(1.85, 0.2, 1.35), def.color, Enum.Material.Neon, base)
			for i = -1, 1 do part(V(0.22, 0.5, 0.22), Color3.fromRGB(200, 160, 64), Enum.Material.Metal, base * CFrame.new(i * 0.42, 0.8, 0)) end
		else
			part(V(1.05, 1.05, 1.35), def.color, Enum.Material.Neon, base)
		end
	end
	local light = Instance.new("PointLight")
	light.Color, light.Range, light.Brightness = def.color, 10, 1.5
	light.Parent = core
	local hit = part(V(6, 7, 6), Color3.new(), Enum.Material.SmoothPlastic, base)
	hit.Transparency = 1
	hit.Name = "Hitbox"
	hit.CanTouch = true
	m.PrimaryPart = core
	m:SetAttribute("Label", def.label)
	m.Parent = workspace.Pickups
	local taken = false
	hit.Touched:Connect(function(other)
		if taken then return end
		local plr = Players:GetPlayerFromCharacter(other.Parent)
		local pr = plr and ctx.pr(plr)
		local c, h = nil, nil
		if plr then c, h = ctx.alive(plr) end
		if not plr or not pr or not pr.deployed or not c then return end
		if def.power then
			pr.powerups[def.power] = 10
		elseif kind == "health" then
			if h.Health >= h.MaxHealth then return end
			h.Health = math.min(h.MaxHealth, h.Health + 40)
		elseif kind == "armor" then
			local a = plr:GetAttribute("Armor") or 0
			if a >= Config.Player.MaxArmor then return end
			plr:SetAttribute("Armor", math.min(Config.Player.MaxArmor, a + 25))
		else
			ctx.refillAmmo(plr, 0.35)
			if rng:NextNumber() < 0.35 then pr.frags = math.min(Config.Player.MaxFrags, pr.frags + 1) end
		end
		taken = true
		ctx.markRun(plr)
		Remotes.FX:FireClient(plr, "pickup", def.label, def.color, def.power ~= nil)
		m:Destroy()
	end)
	Debris:AddItem(m, 25)
end

---------------------------------------------------------------- killstreaks
local strikeParams = RaycastParams.new()
strikeParams.FilterType = Enum.RaycastFilterType.Exclude

function Combat.airstrike(plr: Player, target: Vector3)
	local c = plr.Character
	local root = c and c:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not root then return end
	local along = V(target.X - root.Position.X, 0, target.Z - root.Position.Z)
	along = along.Magnitude > 1 and along.Unit or Vector3.xAxis
	local side = V(-along.Z, 0, along.X)
	fx("strikeMark", target, along)
	Remotes.Banner:FireAllClients("Airstrike inbound", plr.DisplayName .. " called it in", "strike", false)
	for i = -3, 3 do
		task.delay(1.6 + (i + 3) * 0.14, function()
			if not ctx.running() then return end
			local p = target + along * i * 9 + side * rand(-4, 4)
			strikeParams.FilterDescendantsInstances = { workspace.Enemies, workspace.Projectiles, workspace.Debris, workspace.Pickups }
			local down = workspace:Raycast(p + V(0, 60, 0), V(0, -120, 0), strikeParams)
			local hitPos = down and down.Position or p
			explosion(hitPos + V(0, 1, 0), 22, 210, plr, { source = "airstrike", weapon = "airstrike", selfDamage = 0.25 })
		end)
	end
end

local turrets = {}
function Combat.turret(plr: Player, pos: Vector3)
	local m = Instance.new("Model")
	m.Name = "AutoTurret"
	local function part(name, size, color, mat, cf, shape)
		local p = Instance.new("Part")
		p.Name = name
		p.Anchored, p.CanCollide, p.CanQuery = true, name == "Base", false
		if shape then p.Shape = shape end
		p.Size, p.Color, p.Material, p.CFrame = size, color, mat, cf
		p.Parent = m
		return p
	end
	local base = CFrame.new(pos)
	part("Base", V(3.6, 1.2, 3.6), Color3.fromRGB(43, 48, 54), Enum.Material.DiamondPlate, base * CFrame.new(0, 0.6, 0))
	part("Post", V(0.8, 2.6, 0.8), Color3.fromRGB(30, 34, 38), Enum.Material.Metal, base * CFrame.new(0, 2.3, 0))
	local head = part("Head", V(2.2, 1.4, 3.2), Color3.fromRGB(70, 78, 88), Enum.Material.Metal, base * CFrame.new(0, 4, 0))
	local barrel = part("Barrel", V(0.5, 0.5, 2.4), Color3.fromRGB(24, 28, 32), Enum.Material.Metal, head.CFrame * CFrame.new(0, 0, -2.6))
	local eye = part("Eye", V(0.6, 0.6, 0.1), Config.Colors.Heal, Enum.Material.Neon, head.CFrame * CFrame.new(0, 0.3, -1.62))
	local light = Instance.new("PointLight")
	light.Color, light.Range, light.Brightness = Config.Colors.Heal, 10, 1.5
	light.Parent = eye
	m.PrimaryPart = head
	m.Parent = workspace.Projectiles
	local t = { model = m, head = head, barrel = barrel, eye = eye, owner = plr, life = 25, fireT = 0, aimCF = head.CFrame, pos = head.Position }
	table.insert(turrets, t)
	fx("warp", pos, "turret")
end

local turretParams = RaycastParams.new()
turretParams.FilterType = Enum.RaycastFilterType.Exclude
local function updateTurrets(dt)
	for i = #turrets, 1, -1 do
		local t = turrets[i]
		t.life -= dt
		if t.life <= 0 or not t.owner.Parent or not ctx.running() then
			fx("boom", t.pos, 6)
			t.model:Destroy()
			table.remove(turrets, i)
		else
			t.fireT -= dt
			local best, bd = nil, 165
			turretParams.FilterDescendantsInstances = { t.model, workspace.Projectiles, workspace.Debris, workspace.Pickups }
			for _, e in ipairs(Enemies.list()) do
				if e.hp > 0 then
					local d = (e:center() - t.pos).Magnitude
					if d < bd then
						local res = workspace:Raycast(t.pos, e:center() - t.pos, turretParams)
						local hitE = res and Enemies.fromPart(res.Instance)
						if hitE == e then best, bd = e, d end
					end
				end
			end
			if best then
				local aim = CFrame.lookAt(t.pos, best:center())
				t.head.CFrame = aim
				t.barrel.CFrame = aim * CFrame.new(0, 0, -2.6)
				t.eye.CFrame = aim * CFrame.new(0, 0.3, -1.62)
				if t.fireT <= 0 then
					t.fireT = 0.13
					local origin = (aim * CFrame.new(0, 0, -3.9)).Position
					local dir = (best:center() - origin).Unit
					local res = workspace:Raycast(origin, dir * 200, turretParams)
					local e, zone = nil, nil
					if res then e, zone = Enemies.fromPart(res.Instance) end
					fx("turretShot", origin, res and res.Position or origin + dir * 200)
					if e then Combat.hitEnemy(t.owner, e, zone == "shield" and "body" or zone, 13, { dir = dir, weapon = "turret", source = "turret", pos = res.Position }) end
				end
			end
		end
	end
end

function Combat.update(dt)
	updateShots(dt)
	updateTurrets(dt)
end

function Combat.clear()
	table.clear(shots)
	for _, t in ipairs(turrets) do t.model:Destroy() end
	table.clear(turrets)
	table.clear(reports)
end

-- event weapon perks: Fever stacks for Reaper's Eye, Thirst for Vampire's Fang below half health
function Combat.weaponMul(plr: Player, id: string): number
	local pr = ctx.pr(plr)
	if id == "reaper" then
		return 1 + Config.Halloween.Fever.per * ((pr and pr.fever) or 0)
	elseif id == "fang" then
		local _, h = ctx.alive(plr)
		if h and h.Health < h.MaxHealth / 2 then return Config.Halloween.Thirst end
	end
	return 1
end

-- raycast params for player hitscan; characters, effects and pickups are ignored
local fireParams = RaycastParams.new()
fireParams.FilterType = Enum.RaycastFilterType.Exclude
function Combat.hitscan(plr: Player, origin: Vector3, dirs, w)
	local ignore = { workspace.Projectiles, workspace.Pickups, workspace.Debris }
	for _, p in ipairs(Players:GetPlayers()) do if p.Character then table.insert(ignore, p.Character) end end
	fireParams.FilterDescendantsInstances = ignore
	local perEnemy, ends = {}, {}
	for i = 1, math.min(#dirs, w.pellets) do
		local dir = dirs[i]
		if typeof(dir) == "Vector3" and dir.Magnitude > 0.01 then
			dir = dir.Unit
			local res = workspace:Raycast(origin, dir * w.range, fireParams)
			table.insert(ends, res and res.Position or origin + dir * w.range)
			if res then
				local e, zone = Enemies.fromPart(res.Instance)
				if e then
					local dmg = w.dmg
					if w.falloff then dmg *= math.clamp(1 - ((res.Distance - w.falloff[1]) / w.falloff[2]), 0.3, 1) end
					local rec = perEnemy[e]
					if not rec then
						rec = { zones = {}, dir = dir, pos = res.Position }
						perEnemy[e] = rec
					end
					rec.zones[zone] = (rec.zones[zone] or 0) + dmg
				elseif res.Instance.Name == "FuelDrum" then
					damageDrum(res.Instance :: BasePart, w.dmg, plr)
				end
			end
		end
	end
	local pr = ctx.pr(plr)
	local damageMul = Stats.buffMods(pr.buffs, pr.powerups).damage * Combat.weaponMul(plr, w.id)
	local any = false
	for e, rec in pairs(perEnemy) do
		any = true
		-- apply the strongest zone first so a head pellet decides the kill credit
		for _, z in ipairs({ "head", "weak", "body", "limb", "shield" }) do
			local d = rec.zones[z]
			if d and e.hp > 0 then
				Combat.hitEnemy(plr, e, z, d * damageMul, { dir = rec.dir, weapon = w.id, source = "bullet", headMult = w.head, pos = rec.pos })
			end
		end
	end
	return any, ends
end

return Combat
