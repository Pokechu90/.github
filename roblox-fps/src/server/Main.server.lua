-- Foundry Breach server: players, weapons, waves, projectiles, explosions, pickups.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Debris = game:GetService("Debris")

local Shared = ReplicatedStorage:WaitForChild("FoundryShared")
local Config = require(Shared:WaitForChild("Config"))
local Remotes = require(Shared:WaitForChild("Remotes"))
local MapBuilder = require(script.Parent:WaitForChild("MapBuilder"))
local Enemies = require(script.Parent:WaitForChild("Enemies"))

local S = Config.METER
local W = Config.Weapons
local rng = Random.new()
local function rand(a, b) return a + rng:NextNumber() * (b - a) end

Players.RespawnTime = Config.Player.RespawnTime
local map = MapBuilder.build()
local drumTemplates = {}
for _, d in ipairs(map.barrels) do table.insert(drumTemplates, d:Clone()) end

local State = ReplicatedStorage:FindFirstChild("FoundryState") or Instance.new("Folder")
State.Name = "FoundryState"
State.Parent = ReplicatedStorage
local function setState(k, v) if State:GetAttribute(k) ~= v then State:SetAttribute(k, v) end end
setState("Wave", 0); setState("Hostiles", 0); setState("Active", false); setState("Intermission", 0); setState("Running", false)

local run = { running = false, wave = 0, queue = {}, spawnT = 0, active = false, inter = 0, start = 0, overT = 0 }
local pdata = {}

---------------------------------------------------------------- helpers
local function fx(kind, ...) Remotes.FX:FireAllClients(kind, ...) end

local function syncAmmo(plr)
	local d = pdata[plr]
	if d then Remotes.Ammo:FireClient(plr, d.mags, d.reserves, d.grenades, plr:GetAttribute("Armor")) end
end

local function refill(d)
	for i, w in ipairs(W) do d.mags[i] = w.mag; d.reserves[i] = w.reserve; d.lastShot[i] = 0 end
	d.grenades = Config.Player.StartGrenades
end

local function aliveChar(plr)
	local c = plr.Character
	local h = c and c:FindFirstChildOfClass("Humanoid")
	local r = c and c:FindFirstChild("HumanoidRootPart")
	local head = c and c:FindFirstChild("Head")
	if h and r and head and h.Health > 0 then return c, h, r, head end
end

local function targets()
	local t = {}
	for plr, d in pairs(pdata) do
		if d.deployed then
			local c, h, r, head = aliveChar(plr)
			if c then table.insert(t, { player = plr, char = c, hum = h, root = r, head = head }) end
		end
	end
	return t
end

local function damagePlayer(plr, amount, from, explosive)
	local c, h = aliveChar(plr)
	if not c or not run.running then return end
	local armor = plr:GetAttribute("Armor") or 0
	local absorbed = math.min(armor, amount * 0.6)
	plr:SetAttribute("Armor", armor - absorbed)
	h:TakeDamage(amount - absorbed)
	Remotes.Damage:FireClient(plr, amount, from, explosive == true)
end

---------------------------------------------------------------- pickups
local PICKUP = {
	health = { color = Config.Colors.Heal, label = "+40 Integrity" },
	ammo = { color = Config.Colors.Accent, label = "Ammo resupply" },
	armor = { color = Config.Colors.Armor, label = "+25 Armor" },
}
local function spawnPickup(kind, pos)
	local def = PICKUP[kind]
	local m = Instance.new("Model")
	m.Name = kind
	local function part(size, color, mat, cf)
		local p = Instance.new("Part")
		p.Anchored, p.CanCollide, p.CanQuery = true, false, false
		p.Size, p.Color, p.Material, p.CFrame = size, color, mat, cf
		p.CastShadow = false
		p.Parent = m
		return p
	end
	local base = CFrame.new(pos.X, math.max(pos.Y, 0) + 2.2, pos.Z)
	local core = part(Vector3.new(1.8, 1.2, 1.3), Color3.fromRGB(24, 28, 32), Enum.Material.Metal, base)
	if kind == "health" then
		part(Vector3.new(0.95, 0.3, 1.35), def.color, Enum.Material.Neon, base)
		part(Vector3.new(0.3, 0.95, 1.35), def.color, Enum.Material.Neon, base)
	elseif kind == "ammo" then
		part(Vector3.new(1.85, 0.2, 1.35), def.color, Enum.Material.Neon, base)
		for i = -1, 1 do part(Vector3.new(0.22, 0.5, 0.22), Color3.fromRGB(200, 160, 64), Enum.Material.Metal, base * CFrame.new(i * 0.42, 0.8, 0)) end
	else
		part(Vector3.new(1.05, 1.05, 1.35), def.color, Enum.Material.Neon, base)
	end
	local light = Instance.new("PointLight")
	light.Color, light.Range, light.Brightness = def.color, 10, 1.5
	light.Parent = core
	local hit = part(Vector3.new(6, 7, 6), Color3.new(), Enum.Material.SmoothPlastic, base)
	hit.Transparency = 1
	hit.Name = "Hitbox"
	m.PrimaryPart = core
	m:SetAttribute("Label", def.label)
	m.Parent = workspace.Pickups
	local taken = false
	hit.Touched:Connect(function(other)
		if taken then return end
		local plr = Players:GetPlayerFromCharacter(other.Parent)
		local d = plr and pdata[plr]
		local c, h = plr and aliveChar(plr)
		if not d or not c then return end
		if kind == "health" then
			if h.Health >= h.MaxHealth then return end
			h.Health = math.min(h.MaxHealth, h.Health + 40)
		elseif kind == "armor" then
			local a = plr:GetAttribute("Armor") or 0
			if a >= Config.Player.MaxArmor then return end
			plr:SetAttribute("Armor", math.min(Config.Player.MaxArmor, a + 25))
		else
			for i, w in ipairs(W) do d.reserves[i] = math.min(math.floor(w.reserve * 1.5), d.reserves[i] + math.ceil(w.mag * (i == 1 and 1.5 or 1))) end
			if rng:NextNumber() < 0.35 then d.grenades = math.min(Config.Player.MaxGrenades, d.grenades + 1) end
		end
		taken = true
		syncAmmo(plr)
		Remotes.FX:FireClient(plr, "pickup", def.label, def.color)
		m:Destroy()
	end)
	Debris:AddItem(m, 25)
end

---------------------------------------------------------------- explosions and drums
local explosion
local function damageDrum(drum, amount)
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
			explosion(p + Vector3.new(0, 1, 0), Config.Barrel.Radius, Config.Barrel.Damage, nil)
		end)
	end
end

function explosion(pos, radius, damage, owner)
	fx("boom", pos, radius)
	for _, e in ipairs(table.clone(Enemies.list())) do
		local d = (e.root.Position - pos).Magnitude
		if d < radius then
			local f = 1 - d / radius
			local dir = (e.root.Position - pos)
			dir = dir.Magnitude > 0.01 and dir.Unit or Vector3.yAxis
			e.root.AssemblyLinearVelocity += dir * 60 * f + Vector3.new(0, 25 * f, 0)
			local killed = e:damage(damage * (0.3 + 0.7 * f), dir, owner, 0, false)
			if owner then Remotes.Hit:FireClient(owner, killed, false) end
		end
	end
	for _, drum in ipairs(map.drumFolder:GetChildren()) do
		if (drum.Position - pos).Magnitude < radius * 0.9 then damageDrum(drum, 999) end
	end
	for plr in pairs(pdata) do
		local c, _, r = aliveChar(plr)
		if c then
			local d = (r.Position - pos).Magnitude
			if d < radius * 1.1 then
				local f = 1 - d / (radius * 1.1)
				damagePlayer(plr, damage * 0.55 * f, pos, true)
			end
		end
	end
end

---------------------------------------------------------------- enemy bolts
local bolts = {}
local boltId = 0
local boltParams = RaycastParams.new()
boltParams.FilterType = Enum.RaycastFilterType.Exclude
local function spawnBolt(origin, dir, speed, damage, heavy)
	boltId += 1
	table.insert(bolts, { id = boltId, pos = origin, vel = dir * speed, damage = damage, t = 0 })
	fx("bolt", boltId, origin, dir * speed, heavy)
end
local function updateBolts(dt)
	boltParams.FilterDescendantsInstances = { workspace.Enemies, workspace.Projectiles, workspace.Debris, workspace.Pickups }
	for i = #bolts, 1, -1 do
		local b = bolts[i]
		b.t += dt
		local step = b.vel * dt
		local res = workspace:Raycast(b.pos, step, boltParams)
		if res then
			local plr = Players:GetPlayerFromCharacter(res.Instance:FindFirstAncestorWhichIsA("Model"))
			if plr then damagePlayer(plr, b.damage, b.pos, false) end
			if res.Instance.Name == "FuelDrum" then damageDrum(res.Instance, b.damage) end
			fx("boltEnd", b.id, res.Position, res.Normal, plr ~= nil)
			table.remove(bolts, i)
		elseif b.t > 3 then
			fx("boltEnd", b.id, nil)
			table.remove(bolts, i)
		else
			b.pos += step
		end
	end
end

---------------------------------------------------------------- kills
local function onKill(enemy, killer, weaponIndex, headshot, pos)
	local d = killer and pdata[killer]
	if d then
		d.kills += 1
		if headshot then d.heads += 1 end
		local now = os.clock()
		d.streak = (now - d.lastKill < 2.8) and d.streak + 1 or 1
		d.lastKill = now
		local mult = 1 + math.min(d.streak - 1, 4) * 0.25
		local pts = math.floor((enemy.k.score + (headshot and 50 or 0)) * mult)
		d.score += pts
		local ls = killer:FindFirstChild("leaderstats")
		if ls then ls.Score.Value = d.score; ls.Kills.Value = d.kills end
		local wname = weaponIndex and W[weaponIndex] and W[weaponIndex].short or "FRAG"
		Remotes.Feed:FireAllClients(killer.DisplayName, wname, string.format("%s-%02d", enemy.k.name, enemy.id % 100), headshot, killer == nil and 0 or d.streak, killer)
	else
		Remotes.Feed:FireAllClients("Yard 9", "DRUM", string.format("%s-%02d", enemy.k.name, enemy.id % 100), false, 0, nil)
	end
	local r = rng:NextNumber()
	if enemy.kind == "heavy" or r < 0.22 then spawnPickup("health", pos)
	elseif r < 0.5 then spawnPickup("ammo", pos)
	elseif r < 0.56 then spawnPickup("armor", pos) end
end

Enemies.init({
	targets = targets, spawnBolt = spawnBolt, damagePlayer = damagePlayer, fx = fx,
	explosion = explosion, onKill = onKill, wave = function() return math.max(1, run.wave) end,
})

---------------------------------------------------------------- waves
local function startWave()
	run.wave += 1
	local n = run.wave
	local count = math.min(34, 4 + n * 2)
	local heavies = n >= 3 and math.floor((n - 1) / 2) or 0
	local rushers = n >= 2 and math.floor((count - heavies) * 0.3 + 0.5) or 0
	local q = {}
	for _ = 1, heavies do table.insert(q, "heavy") end
	for _ = 1, rushers do table.insert(q, "rusher") end
	while #q < count do table.insert(q, "grunt") end
	for i = #q, 2, -1 do local j = rng:NextInteger(1, i); q[i], q[j] = q[j], q[i] end
	-- more bots when more players join
	local extra = math.max(0, #targets() - 1) * math.floor(count * 0.4)
	for _ = 1, extra do table.insert(q, "grunt") end
	run.queue, run.active, run.spawnT = q, true, 1.2
	setState("Wave", n); setState("Active", true)
	Remotes.Banner:FireAllClients("Wave " .. n, #q .. " hostiles inbound", "siren")
end

local function clearWorld()
	Enemies.clear()
	table.clear(bolts)
	workspace.Pickups:ClearAllChildren()
	workspace.Projectiles:ClearAllChildren()
	workspace.Debris:ClearAllChildren()
	map.drumFolder:ClearAllChildren()
	for _, t in ipairs(drumTemplates) do t:Clone().Parent = map.drumFolder end
end

local function startRun()
	clearWorld()
	run.running, run.wave, run.queue, run.active, run.inter, run.start, run.overT = true, 0, {}, false, 4, os.clock(), 0
	setState("Running", true); setState("Wave", 0)
	Remotes.Banner:FireAllClients("Hold the yard", "First wave in 4 seconds")
end

local function endRun()
	run.running = false
	setState("Running", false); setState("Active", false); setState("Hostiles", 0)
	local duration = os.clock() - run.start
	for plr, d in pairs(pdata) do
		if d.deployed then
			Remotes.GameOver:FireClient(plr, { score = d.score, wave = run.wave, kills = d.kills, heads = d.heads, acc = d.shots > 0 and math.floor(d.hits / d.shots * 100 + 0.5) or 0, time = duration })
			d.deployed = false
		end
	end
	task.delay(4, function()
		clearWorld()
		for plr in pairs(pdata) do if plr.Parent then plr:LoadCharacter() end end
	end)
end

local function updateWaves(dt)
	if not run.running then return end
	if run.active then
		run.spawnT -= dt
		if #run.queue > 0 and run.spawnT <= 0 and Enemies.count() < 6 + run.wave + #targets() * 2 then
			local pts = {}
			for _, p in ipairs(map.spawnPoints) do
				local near = false
				for _, t in ipairs(targets()) do if (t.root.Position - p).Magnitude < 105 then near = true end end
				if not near then table.insert(pts, p) end
			end
			if #pts == 0 then pts = map.spawnPoints end
			local p = pts[rng:NextInteger(1, #pts)] + Vector3.new(rand(-8, 8), 0, rand(-8, 8))
			Enemies.spawn(table.remove(run.queue, 1), p)
			run.spawnT = rand(0.5, 1.4)
		end
		if #run.queue == 0 and Enemies.count() == 0 then
			run.active, run.inter = false, 9
			local bonus = 250 * run.wave
			for plr, d in pairs(pdata) do
				if d.deployed then
					d.score += bonus
					local ls = plr:FindFirstChild("leaderstats")
					if ls then ls.Score.Value = d.score end
					d.grenades = math.min(Config.Player.MaxGrenades, d.grenades + 1)
					plr:SetAttribute("Armor", math.min(Config.Player.MaxArmor, (plr:GetAttribute("Armor") or 0) + 25))
					for i, w in ipairs(W) do d.reserves[i] = math.min(math.floor(w.reserve * 1.5), d.reserves[i] + math.ceil(w.reserve * 0.3)) end
					syncAmmo(plr)
				end
			end
			setState("Active", false)
			Remotes.Banner:FireAllClients("Wave cleared", "+" .. bonus .. " · resupply delivered", "clear")
		end
	else
		run.inter -= dt
		setState("Intermission", math.max(0, math.ceil(run.inter)))
		if run.inter <= 0 then startWave() end
	end
	setState("Hostiles", Enemies.count() + #run.queue)
	-- overrun when every deployed player is down at once
	local deployed, alive = 0, 0
	for plr, d in pairs(pdata) do
		if d.deployed then
			deployed += 1
			if aliveChar(plr) then alive += 1 end
		end
	end
	if deployed == 0 then endRun()
	elseif alive == 0 then
		run.overT += dt
		if run.overT > 1.5 then endRun() end
	else
		run.overT = 0
	end
end

---------------------------------------------------------------- players
local function onPlayer(plr)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	local sc = Instance.new("IntValue"); sc.Name = "Score"; sc.Parent = ls
	local k = Instance.new("IntValue"); k.Name = "Kills"; k.Parent = ls
	ls.Parent = plr
	local d = { mags = {}, reserves = {}, lastShot = {}, grenades = 0, deployed = false, score = 0, kills = 0, heads = 0, shots = 0, hits = 0, streak = 0, lastKill = 0, lastThrow = 0 }
	refill(d)
	pdata[plr] = d
	plr:SetAttribute("Armor", Config.Player.StartArmor)
	plr.CharacterAdded:Connect(function()
		refill(d)
		d.reloadToken = nil
		plr:SetAttribute("Armor", Config.Player.StartArmor)
		task.wait(0.5)
		syncAmmo(plr)
	end)
end
Players.PlayerAdded:Connect(onPlayer)
for _, p in ipairs(Players:GetPlayers()) do onPlayer(p) end
Players.PlayerRemoving:Connect(function(p) pdata[p] = nil end)

Remotes.Deploy.OnServerEvent:Connect(function(plr)
	local d = pdata[plr]
	if not d or d.deployed then return end
	if not run.running then
		for _, o in pairs(pdata) do o.score, o.kills, o.heads, o.shots, o.hits, o.streak = 0, 0, 0, 0, 0, 0 end
		for _, p in ipairs(Players:GetPlayers()) do
			local ls = p:FindFirstChild("leaderstats")
			if ls then ls.Score.Value = 0; ls.Kills.Value = 0 end
		end
		startRun()
	end
	d.deployed = true
	refill(d)
	syncAmmo(plr)
end)

local fireParams = RaycastParams.new()
fireParams.FilterType = Enum.RaycastFilterType.Exclude
Remotes.Fire.OnServerEvent:Connect(function(plr, wi, origin, dirs)
	local d = pdata[plr]
	if not d or not d.deployed or typeof(wi) ~= "number" or typeof(origin) ~= "Vector3" or typeof(dirs) ~= "table" then return end
	local w = W[wi]
	local c, _, _, head = aliveChar(plr)
	if not w or not c or (origin - head.Position).Magnitude > 12 then return end
	local now = os.clock()
	if now - (d.lastShot[wi] or 0) < 60 / w.rpm * 0.75 then return end
	if d.reloadToken and not w.shellReload then return end
	if d.mags[wi] <= 0 then syncAmmo(plr) return end
	d.reloadToken = nil
	d.lastShot[wi] = now
	d.mags[wi] -= 1
	d.shots += 1
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
				local e = Enemies.fromPart(res.Instance)
				if e then
					local dmg = w.damage
					if w.falloff then dmg *= math.clamp(1 - ((res.Distance - w.falloff[1]) / w.falloff[2]), 0.25, 1) end
					local isHead = res.Instance.Name == "Head" or res.Instance.Name == "Antenna"
					if isHead then dmg *= w.head elseif res.Instance.Name == "Leg" or res.Instance.Name == "Arm" then dmg *= 0.8 end
					local rec = perEnemy[e] or { dmg = 0, head = false, dir = dir }
					rec.dmg += dmg
					rec.head = rec.head or isHead
					perEnemy[e] = rec
				elseif res.Instance.Name == "FuelDrum" then
					damageDrum(res.Instance, w.damage)
				end
			end
		end
	end
	local any, killed, head = false, false, false
	for e, rec in pairs(perEnemy) do
		any = true
		head = head or rec.head
		if e:damage(rec.dmg, rec.dir, plr, wi, rec.head) then killed = true end
	end
	if any then d.hits += 1; Remotes.Hit:FireClient(plr, killed, head) end
	fx("shot", plr, wi, origin, ends)
end)

Remotes.Reload.OnServerEvent:Connect(function(plr, wi)
	local d = pdata[plr]
	local w = typeof(wi) == "number" and W[wi]
	if not d or not w or d.reloadToken or d.mags[wi] >= w.mag or d.reserves[wi] <= 0 then return end
	local token = {}
	d.reloadToken = token
	task.spawn(function()
		if w.shellReload then
			while d.reloadToken == token and d.mags[wi] < w.mag and d.reserves[wi] > 0 do
				task.wait(w.reload * 0.95)
				if d.reloadToken ~= token then break end
				d.mags[wi] += 1
				d.reserves[wi] -= 1
			end
		else
			task.wait(w.reload * 0.95)
			if d.reloadToken == token then
				local n = math.min(w.mag - d.mags[wi], d.reserves[wi])
				d.mags[wi] += n
				d.reserves[wi] -= n
			end
		end
		if d.reloadToken == token then d.reloadToken = nil end
		syncAmmo(plr)
	end)
end)

Remotes.Equip.OnServerEvent:Connect(function(plr)
	local d = pdata[plr]
	if d then d.reloadToken = nil end
end)

Remotes.Throw.OnServerEvent:Connect(function(plr, origin, dir)
	local d = pdata[plr]
	local c, _, _, head = aliveChar(plr)
	if not d or not c or typeof(origin) ~= "Vector3" or typeof(dir) ~= "Vector3" or d.grenades <= 0 then return end
	if os.clock() - d.lastThrow < 0.8 or (origin - head.Position).Magnitude > 12 then return end
	d.lastThrow = os.clock()
	d.grenades -= 1
	syncAmmo(plr)
	dir = dir.Unit
	local g = Instance.new("Part")
	g.Name = "Frag"
	g.Shape = Enum.PartType.Ball
	g.Size = Vector3.new(0.7, 0.7, 0.7)
	g.Material = Enum.Material.Metal
	g.Color = Color3.fromRGB(63, 74, 48)
	g.CustomPhysicalProperties = PhysicalProperties.new(2, 0.6, 0.35, 1, 1)
	g.CFrame = CFrame.new(origin + dir * 2.5)
	local blink = Instance.new("PointLight")
	blink.Color, blink.Range, blink.Brightness = Color3.fromRGB(255, 40, 30), 6, 2
	blink.Parent = g
	g.Parent = workspace.Projectiles
	g:SetNetworkOwner(nil)
	g.AssemblyLinearVelocity = dir * Config.Grenade.Speed + Vector3.new(0, 14, 0) + c.HumanoidRootPart.AssemblyLinearVelocity * 0.5
	g.AssemblyAngularVelocity = Vector3.new(rand(-10, 10), rand(-10, 10), rand(-10, 10))
	task.delay(Config.Grenade.Fuse, function()
		if g.Parent then
			local p = g.Position
			g:Destroy()
			explosion(p, Config.Grenade.Radius, Config.Grenade.Damage, plr)
		end
	end)
end)

RunService.Heartbeat:Connect(function(dt)
	updateWaves(dt)
	if run.running then
		Enemies.update(dt, targets())
		updateBolts(dt)
	end
end)
