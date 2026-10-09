--!nonstrict
-- Three bosses that rotate every fifth wave. Each has three phases (50% and 25% health),
-- telegraphed attacks and glowing weak points that take 2.5x damage.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Debris = game:GetService("Debris")
local Config = require(ReplicatedStorage:WaitForChild("FoundryShared"):WaitForChild("Config"))
local Enemies = require(script.Parent:WaitForChild("Enemies"))

local Bosses = {}
local ctx: any
local rng = Random.new()
local function rand(a, b) return a + rng:NextNumber() * (b - a) end
local V = Vector3.new
local RGB = Color3.fromRGB
local DARK = RGB(24, 28, 32)
local ZONES = { Head = "head", Core = "weak", Vent = "weak", Eye = "weak", Pod = "weak", Leg = "limb", Arm = "limb" }

function Bosses.init(context) ctx = context end

local function weld(a, b)
	local w = Instance.new("WeldConstraint")
	w.Part0, w.Part1 = a, b
	w.Parent = a
end
local function maker(model)
	return function(name, size, color, mat, cf, shape)
		local p = Instance.new("Part")
		p.Name = name
		if shape then p.Shape = shape end
		p.Size, p.Color, p.Material, p.CFrame = size, color, mat, cf
		p.CanCollide = false
		p.Massless = true
		p.TopSurface, p.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
		if ZONES[name] then p:SetAttribute("Zone", ZONES[name]) end
		p.Parent = model
		return p
	end
end
local function glow(p, color, range)
	local l = Instance.new("PointLight")
	l.Color, l.Range, l.Brightness = color, range or 18, 2
	l.Parent = p
	return l
end
local function humanoid(model, hip, speed)
	local hum = Instance.new("Humanoid")
	hum.HipHeight = hip
	hum.WalkSpeed = speed
	hum.AutoRotate = false
	hum.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
	hum.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff
	hum.BreakJointsOnDeath = false
	hum.MaxHealth, hum.Health = 1e6, 1e6
	hum.RequiresNeck = false
	for _, st in ipairs({ Enum.HumanoidStateType.FallingDown, Enum.HumanoidStateType.Ragdoll, Enum.HumanoidStateType.Climbing, Enum.HumanoidStateType.Seated, Enum.HumanoidStateType.Swimming, Enum.HumanoidStateType.Dead, Enum.HumanoidStateType.Jumping }) do
		hum:SetStateEnabled(st, false)
	end
	hum.Parent = model
	return hum
end
local function orient(root)
	local att = Instance.new("Attachment"); att.Parent = root
	local ao = Instance.new("AlignOrientation")
	ao.Mode = Enum.OrientationAlignmentMode.OneAttachment
	ao.Attachment0 = att
	ao.Responsiveness = 6
	ao.MaxTorque = 1e9
	ao.Parent = root
	return ao, att
end
local function highlight(model)
	local hl = Instance.new("Highlight")
	hl.FillColor = Color3.new(1, 1, 1)
	hl.FillTransparency = 0.5
	hl.OutlineTransparency = 1
	hl.DepthMode = Enum.HighlightDepthMode.Occluded
	hl.Enabled = false
	hl.Parent = model
	return hl
end
local function flat(v: Vector3) return V(v.X, 0, v.Z) end

---------------------------------------------------------------- shared boss behaviour
local Boss = {}
Boss.__index = Boss

function Boss.new(def, cycle, players)
	local sc = ctx.scale()
	local self = setmetatable({}, Boss)
	self.boss = true
	self.id = Enemies.nextId()
	self.kind = def.id
	self.def = def
	self.k = { name = def.name, scale = 3 }
	self.name = def.name
	self.cycle = cycle
	self.hpMax = def.hp * (1 + 0.3 * (cycle - 1)) * sc.hp * (1 + 0.55 * (players - 1))
	self.hp = self.hpMax
	self.shieldMax = (def.shield or 0) * (1 + 0.3 * (cycle - 1)) * (1 + 0.4 * (players - 1))
	self.shield = self.shieldMax
	self.dmgMul = sc.dmg * (1 + 0.1 * (cycle - 1))
	self.phase = 1
	self.t = 0
	self.flashT = 0
	self.stunT = 0
	self.spawnT = 2
	return self
end

function Boss:center() return self.root.Position + V(0, 4, 0) end
function Boss:eye() return self:center() end

function Boss:finish(model, root)
	self.model = model
	self.root = root
	self.hl = highlight(model)
	model.PrimaryPart = root
	model:SetAttribute("Kind", self.kind)
	model:SetAttribute("Boss", true)
	model.Parent = workspace.Enemies
	root:SetNetworkOwner(nil)
	Enemies.add(self)
	ctx.fx("bossSpawn", root.Position, self.kind)
end

function Boss:flash(color)
	self.hl.FillColor = color or Color3.new(1, 1, 1)
	self.hl.Enabled = true
	self.flashT = 0.08
end

function Boss:damage(amount: number, info)
	if self.hp <= 0 then return false, 0 end
	local dealt = 0
	if self.shield > 0 then
		local absorbed = math.min(self.shield, amount)
		self.shield -= absorbed
		amount -= absorbed
		dealt += absorbed
		self:flash(Config.Colors.Block)
		if self.shield <= 0 then self:shieldBroken() end
		if amount <= 0 then return false, dealt end
	end
	dealt += math.min(self.hp, amount)
	self.hp -= amount
	self:flash()
	local f = self.hp / self.hpMax
	if self.phase == 1 and f <= 0.5 then self:enterPhase(2)
	elseif self.phase == 2 and f <= 0.25 then self:enterPhase(3) end
	if self.hp <= 0 then
		self:die(info)
		return true, dealt
	end
	return false, dealt
end

function Boss:stun(t)
	-- bosses shrug off most of a stun
	self.stunT = math.max(self.stunT, t * 0.35)
	self:flash(RGB(120, 200, 255))
end

function Boss:shieldBroken()
	ctx.fx("shieldBreak", self:center())
	ctx.banner("Shield down", "Hit it with everything", "boss")
end

function Boss:enterPhase(n)
	self.phase = n
	ctx.fx("roar", self:center())
	ctx.banner(n == 2 and "Phase two" or "Final phase", self:phaseText(n), "boss")
	self:onPhase(n)
end
function Boss:phaseText(_n) return "" end
function Boss:onPhase(_n) end

function Boss:die(info)
	if self.dead then return end
	self.dead = true
	Enemies.remove(self)
	local pos = self:center()
	self.hl:Destroy()
	for _, d in ipairs(self.model:GetDescendants()) do
		if d:IsA("JointInstance") or d:IsA("WeldConstraint") or d:IsA("Constraint") or d:IsA("Humanoid") then d:Destroy() end
	end
	self.model.Parent = workspace.Debris
	for _, p in ipairs(self.model:GetDescendants()) do
		if p:IsA("BasePart") then
			if p.Material == Enum.Material.Neon or p.Material == Enum.Material.ForceField then p.Color = RGB(30, 30, 30); p.Material = Enum.Material.Metal end
			p.CanCollide, p.CanQuery, p.Massless = true, false, false
			p.AssemblyLinearVelocity = V(rand(-30, 30), rand(30, 70), rand(-30, 30))
			p.AssemblyAngularVelocity = V(rand(-6, 6), rand(-6, 6), rand(-6, 6))
		end
	end
	Debris:AddItem(self.model, 10)
	for i = 0, 4 do
		task.delay(i * 0.25, function()
			ctx.fx("boom", pos + V(rand(-10, 10), rand(-2, 8), rand(-10, 10)), 20)
		end)
	end
	ctx.onKill(self, info, pos)
end

function Boss:updateCommon(dt)
	self.t += dt
	if self.flashT > 0 then
		self.flashT -= dt
		if self.flashT <= 0 then self.hl.Enabled = false end
	end
	if self.spawnT > 0 then self.spawnT -= dt; return false end
	if self.stunT > 0 then self.stunT -= dt; return false end
	return true
end

-- mortar volley around a position, each shell telegraphed by a ring on the ground
function Boss:mortars(origin, around, n, dmg)
	for i = 1, n do
		local tgt = around + V(rand(-16, 16), 0, rand(-16, 16))
		ctx.arc(origin, tgt, 1.6 + i * 0.15, dmg * self.dmgMul, 14)
	end
	ctx.fx("boom", origin, 6)
end

---------------------------------------------------------------- Titan-9: siege mech
local Titan = setmetatable({}, { __index = Boss })
Titan.__index = Titan

function Titan.spawn(pos, cycle, players)
	local self = setmetatable(Boss.new(Config.Bosses[1], cycle, players), Titan)
	local model = Instance.new("Model")
	model.Name = self.name
	local mk = maker(model)
	local base = CFrame.new(pos + V(0, math.min(18, ctx.ceiling() - 8), 0))
	local metal, accent = RGB(70, 78, 88), RGB(255, 96, 40)
	local root = mk("HumanoidRootPart", V(8, 6, 5), metal, Enum.Material.Metal, base)
	root.Transparency, root.CanCollide, root.CanQuery, root.Massless = 1, true, false, false
	local torso = mk("Torso", V(13, 8, 9), metal, Enum.Material.DiamondPlate, base * CFrame.new(0, 6, 0)); weld(root, torso)
	local core = mk("Core", V(4, 4, 4), accent, Enum.Material.Neon, torso.CFrame * CFrame.new(0, 0, -4.4), Enum.PartType.Ball); weld(torso, core)
	glow(core, accent, 30)
	local head = mk("Head", V(4.5, 3, 4.5), metal, Enum.Material.Metal, torso.CFrame * CFrame.new(0, 5.5, -1)); weld(torso, head)
	local visor = mk("Visor", V(4, 0.8, 0.3), RGB(255, 48, 32), Enum.Material.Neon, head.CFrame * CFrame.new(0, 0.2, -2.3)); weld(head, visor)
	local pelvis = mk("Pelvis", V(9, 3, 6), DARK, Enum.Material.Metal, base * CFrame.new(0, -1.5, 0)); weld(root, pelvis)
	self.tips = {}
	for _, side in ipairs({ -1, 1 }) do
		local cannon = mk("Arm", V(3.5, 3.5, 10), DARK, Enum.Material.Metal, torso.CFrame * CFrame.new(side * 8.5, 1, -2)); weld(torso, cannon)
		local tip = mk("GunTip", V(2, 2, 2), accent, Enum.Material.Neon, cannon.CFrame * CFrame.new(0, 0, -5.4), Enum.PartType.Ball); weld(cannon, tip)
		table.insert(self.tips, tip)
		local pod = mk("Pod", V(3.5, 3, 4), RGB(255, 140, 60), Enum.Material.Neon, torso.CFrame * CFrame.new(side * 4.5, 5.5, 3.5)); weld(torso, pod)
		pod.Transparency = 0.2
	end
	for i, side in ipairs({ -1, 1 }) do
		local leg = mk("Leg", V(3, 13, 3.5), DARK, Enum.Material.Metal, base * CFrame.new(side * 3.8, -8.5, 0))
		local hip = Instance.new("Motor6D")
		hip.Name = "Hip" .. i
		hip.Part0, hip.Part1 = root, leg
		hip.C0 = CFrame.new(side * 3.8, -2, 0)
		hip.C1 = CFrame.new(0, 6.5, 0)
		hip.Parent = root
		local foot = mk("Foot", V(4.5, 1.2, 6), metal, Enum.Material.Metal, leg.CFrame * CFrame.new(0, -6.2, -0.8)); weld(leg, foot)
		local knee = mk("Knee", V(3.6, 3, 4), metal, Enum.Material.DiamondPlate, leg.CFrame * CFrame.new(0, 0, -0.5)); weld(leg, knee)
	end
	self.hum = humanoid(model, 12, 8)
	self.align = orient(root)
	self.volleyT, self.volleyN, self.shotT, self.missileT, self.stompT = 3, 0, 0, 6, 5
	self:finish(model, root)
	return self
end

function Titan:phaseText(n) return n == 2 and "Missile pods online · watch for red rings" or "Reactor overload · get clear when it stomps" end
function Titan:onPhase(n) self.hum.WalkSpeed = n == 3 and 13 or 10 end

function Titan:update(dt, target)
	if not self:updateCommon(dt) then self.hum:Move(Vector3.zero); return end
	local pos = self.root.Position
	local tpos = target.root.Position
	local to = flat(tpos - pos)
	local dist = to.Magnitude
	local dir = dist > 0.1 and to.Unit or Vector3.zAxis
	self.align.CFrame = CFrame.lookAt(pos, pos + dir).Rotation
	if self.stomp then
		self.hum:Move(Vector3.zero)
		self.stomp -= dt
		if self.stomp <= 0 then
			self.stomp = nil
			ctx.fx("stomp", V(pos.X, pos.Y - 14, pos.Z), 55)
			for _, t in ipairs(ctx.targets()) do
				local d = flat(t.root.Position - pos).Magnitude
				local grounded = t.hum.FloorMaterial ~= Enum.Material.Air
				if d < 55 and grounded then ctx.damagePlayer(t.player, 34 * self.dmgMul * (1 - d / 90), pos, "explosion") end
			end
		end
		return
	end
	if dist > 80 then self.hum:Move(dir)
	elseif dist < 45 and self.phase < 3 then self.hum:Move(-dir * 0.6)
	elseif self.phase == 3 then self.hum:Move(dir)
	else self.hum:Move(V(-dir.Z, 0, dir.X) * 0.5) end

	-- cannon volleys
	self.volleyT -= dt
	if self.volleyT <= 0 and self.volleyN == 0 then self.volleyN = 6; self.shotT = 0; self.volleyT = self.phase == 3 and 1.8 or 2.6 end
	if self.volleyN > 0 then
		self.shotT -= dt
		if self.shotT <= 0 then
			self.shotT = 0.14
			self.volleyN -= 1
			local tip = self.tips[self.volleyN % 2 + 1]
			local aim = tpos + V(0, 1, 0) + target.root.AssemblyLinearVelocity * 0.3 + V(rand(-4, 4), rand(-1, 2), rand(-4, 4))
			ctx.bolt(tip.Position, (aim - tip.Position).Unit, 210, 9 * self.dmgMul, "heavy")
		end
	end
	if self.phase >= 2 then
		self.missileT -= dt
		if self.missileT <= 0 then
			self.missileT = self.phase == 3 and 5 or 7
			self:mortars(pos + V(0, 12, 0), tpos, 5, 24)
		end
	end
	if self.phase == 3 then
		self.stompT -= dt
		if self.stompT <= 0 and dist < 50 then
			self.stompT = 6
			self.stomp = 1.0
			ctx.fx("stompCharge", V(pos.X, pos.Y - 14, pos.Z), 55, 1.0)
		end
	end
end

---------------------------------------------------------------- Hive Mother: drone carrier
local Hive = setmetatable({}, { __index = Boss })
Hive.__index = Hive

function Hive.spawn(pos, cycle, players)
	local self = setmetatable(Boss.new(Config.Bosses[2], cycle, players), Hive)
	local ceiling = ctx.ceiling()
	self.alt = math.min(42, ceiling - 10)
	local start = pos + V(0, self.alt, 0)
	local model = Instance.new("Model")
	model.Name = self.name
	local mk = maker(model)
	local base = CFrame.new(start)
	local hull, glowC = RGB(46, 54, 66), RGB(255, 42, 106)
	local root = mk("Hull", V(5, 22, 22), hull, Enum.Material.DiamondPlate, base * CFrame.Angles(0, 0, math.pi / 2), Enum.PartType.Cylinder)
	root.Massless = false
	local dome = mk("Dome", V(13, 13, 13), RGB(30, 36, 44), Enum.Material.Metal, base * CFrame.new(0, 2.5, 0), Enum.PartType.Ball); weld(root, dome)
	local eye = mk("Eye", V(6, 6, 6), glowC, Enum.Material.Neon, base * CFrame.new(0, -3, 0), Enum.PartType.Ball); weld(root, eye)
	glow(eye, glowC, 40)
	self.eyePart = eye
	self.plates = {}
	for i = 0, 3 do
		local a = i / 4 * math.pi * 2
		local plate = mk("Plating", V(3.2, 1, 5), hull, Enum.Material.DiamondPlate, base * CFrame.new(math.cos(a) * 3.2, -3.2, math.sin(a) * 3.2) * CFrame.Angles(0, -a, 0.6)); weld(root, plate)
		table.insert(self.plates, plate)
		local pod = mk("Pod", V(3, 2, 3), RGB(64, 255, 208), Enum.Material.Neon, base * CFrame.new(math.cos(a + 0.78) * 9, -2, math.sin(a + 0.78) * 9)); weld(root, pod)
		local fin = mk("Fin", V(1, 1.4, 8), hull, Enum.Material.Metal, base * CFrame.new(math.cos(a) * 11.5, 0, math.sin(a) * 11.5) * CFrame.Angles(0, -a + math.pi / 2, 0)); weld(root, fin)
	end
	local att = Instance.new("Attachment"); att.Parent = root
	local ap = Instance.new("AlignPosition")
	ap.Mode = Enum.PositionAlignmentMode.OneAttachment
	ap.Attachment0 = att
	ap.MaxForce = 1e8
	ap.MaxVelocity = 22
	ap.Responsiveness = 4
	ap.Position = start
	ap.Parent = root
	local ao = Instance.new("AlignOrientation")
	ao.Mode = Enum.OrientationAlignmentMode.OneAttachment
	ao.Attachment0 = att
	ao.Responsiveness = 4
	ao.MaxTorque = 1e9
	ao.Parent = root
	self.ap, self.align = ap, ao
	self.orbitA = 0
	self.home = pos
	self.droneT, self.rainT, self.laserT = 4, 2.5, 6
	self:finish(model, root)
	return self
end

function Hive:center() return self.eyePart.Position end
function Hive:phaseText(n) return n == 2 and "Drop pods and sweeping laser · keep moving" or "Carrier descending · the eye is exposed" end
function Hive:onPhase(n)
	if n == 3 then
		for _, p in ipairs(self.plates) do
			p.Anchored = false
			for _, w in ipairs(p:GetChildren()) do if w:IsA("WeldConstraint") then w:Destroy() end end
			for _, w in ipairs(self.root:GetChildren()) do if w:IsA("WeldConstraint") and w.Part1 == p then w:Destroy() end end
			p.Massless, p.CanCollide = false, true
			p.Parent = workspace.Debris
			p.AssemblyLinearVelocity = V(rand(-20, 20), -10, rand(-20, 20))
			Debris:AddItem(p, 6)
		end
		self.eyePart.Size *= 1.25
	end
end

function Hive:update(dt, target)
	if not self:updateCommon(dt) then self.ap.Position = self.root.Position; return end
	local tpos = target.root.Position
	local alt = (self.phase == 3 and self.alt * 0.6 or self.alt) + math.sin(self.t * 0.8) * 2
	self.orbitA += dt * (self.phase == 3 and 0.16 or 0.09)
	local r = 34
	local centre = self.home:Lerp(V(tpos.X, self.home.Y, tpos.Z), 0.35)
	self.ap.Position = centre + V(math.cos(self.orbitA) * r, alt, math.sin(self.orbitA) * r)
	self.align.CFrame = CFrame.Angles(0, self.t * 0.3, 0)
	local eyePos = self.eyePart.Position

	self.droneT -= dt
	if self.droneT <= 0 then
		self.droneT = self.phase == 3 and 6 or 8
		local alive = 0
		for _, e in ipairs(Enemies.list()) do if e.kind == "drone" then alive += 1 end end
		for i = 1, 2 do
			if alive + i <= 6 then ctx.spawnEnemy("drone", eyePos - V(rand(-4, 4), self.alt * 0.8, rand(-4, 4))) end
		end
	end
	self.rainT -= dt
	if self.rainT <= 0 then
		self.rainT = self.phase == 3 and 1.4 or 2.6
		local n = self.phase == 3 and 7 or 5
		for i = 1, n do
			local aim = tpos + V(rand(-7, 7), 0.5, rand(-7, 7)) + target.root.AssemblyLinearVelocity * 0.25
			task.delay(i * 0.06, function()
				if self.dead then return end
				ctx.bolt(eyePos, (aim - eyePos).Unit, 170, 8 * self.dmgMul, "drone")
			end)
		end
	end
	if self.phase >= 2 then
		self.laserT -= dt
		if self.laserT <= 0 and not self.sweep then
			self.laserT = self.phase == 3 and 6 or 8
			self.sweep = { t = -1.1, from = tpos + V(-18, 0, 0), to = tpos + V(18, 0, 0), shot = 0 }
			ctx.fx("snipeCharge", self.eyePart, target.player, 1.1)
		end
		if self.sweep then
			local sw = self.sweep
			sw.t += dt
			if sw.t > 0 then
				sw.shot -= dt
				if sw.shot <= 0 then
					sw.shot = 0.08
					local p = sw.from:Lerp(sw.to, math.clamp(sw.t / 1.4, 0, 1))
					ctx.bolt(eyePos, (p - eyePos).Unit, 520, 6 * self.dmgMul, "snipe")
				end
				if sw.t > 1.4 then self.sweep = nil end
			end
		end
	end
end

---------------------------------------------------------------- Ironclad: shielded assault tank
local Iron = setmetatable({}, { __index = Boss })
Iron.__index = Iron

function Iron.spawn(pos, cycle, players)
	local self = setmetatable(Boss.new(Config.Bosses[3], cycle, players), Iron)
	local model = Instance.new("Model")
	model.Name = self.name
	local mk = maker(model)
	local base = CFrame.new(pos + V(0, 6, 0))
	local hullC = RGB(78, 86, 72)
	local root = mk("HumanoidRootPart", V(12, 4, 16), hullC, Enum.Material.Metal, base)
	root.Transparency, root.CanCollide, root.CanQuery, root.Massless = 1, true, false, false
	local hull = mk("Hull", V(13, 4.5, 17), hullC, Enum.Material.DiamondPlate, base * CFrame.new(0, 1, 0)); weld(root, hull)
	for _, side in ipairs({ -1, 1 }) do
		local tread = mk("Tread", V(3.2, 4, 18), DARK, Enum.Material.Metal, base * CFrame.new(side * 7.6, -1, 0)); weld(root, tread)
	end
	local turret = mk("Turret", V(8, 3.5, 8), hullC, Enum.Material.Metal, base * CFrame.new(0, 5, 1)); weld(root, turret)
	local barrel = mk("Barrel", V(1.6, 1.6, 11), DARK, Enum.Material.Metal, base * CFrame.new(0, 5.3, -8)); weld(turret, barrel)
	local tip = mk("GunTip", V(2.2, 2.2, 2.2), RGB(255, 160, 64), Enum.Material.Neon, base * CFrame.new(0, 5.3, -13.6), Enum.PartType.Ball); weld(barrel, tip)
	tip.Transparency = 0.3
	self.tip = tip
	local head = mk("Head", V(3, 1.5, 3), DARK, Enum.Material.Metal, base * CFrame.new(-2, 7.4, 2.5)); weld(turret, head)
	for _, side in ipairs({ -1, 1 }) do
		local vent = mk("Vent", V(3, 2, 0.6), RGB(255, 122, 46), Enum.Material.Neon, base * CFrame.new(side * 3.4, 2, 8.6)); weld(root, vent)
		glow(vent, RGB(255, 122, 46), 14)
	end
	local gen = mk("Generator", V(3, 3, 3), Config.Colors.Block, Enum.Material.Neon, base * CFrame.new(0, 7.8, 4), Enum.PartType.Ball); weld(turret, gen)
	self.gen = gen
	local bubble = mk("Bubble", V(30, 30, 30), Config.Colors.Block, Enum.Material.ForceField, base * CFrame.new(0, 2, 0), Enum.PartType.Ball)
	bubble.CanQuery, bubble.CastShadow = false, false
	bubble.Transparency = 0.1
	weld(root, bubble)
	self.bubble = bubble
	self.hum = humanoid(model, 1, 9)
	self.align = orient(root)
	self.cannonT, self.mortarT, self.ramT = 2.5, 6, 4
	self:finish(model, root)
	return self
end

function Iron:center() return self.root.Position + V(0, 3, 0) end
function Iron:phaseText(n) return n == 2 and "Mortars incoming · watch for red rings" or "Generator destroyed · it will ram you" end
function Iron:shieldBroken()
	Boss.shieldBroken(self)
	if self.bubble then self.bubble:Destroy(); self.bubble = nil end
end
function Iron:onPhase(n)
	if n == 3 then
		if self.bubble then self.bubble:Destroy(); self.bubble = nil end
		self.shield = 0
		if self.gen then self.gen.Color = RGB(40, 40, 40); self.gen.Material = Enum.Material.Metal end
	end
end

function Iron:update(dt, target)
	if not self:updateCommon(dt) then self.hum:Move(Vector3.zero); return end
	local pos = self.root.Position
	local tpos = target.root.Position
	local to = flat(tpos - pos)
	local dist = to.Magnitude
	local dir = dist > 0.1 and to.Unit or Vector3.zAxis
	if self.ram then
		local r = self.ram
		r.t -= dt
		if r.stage == "charge" then
			self.hum:Move(Vector3.zero)
			self.align.CFrame = CFrame.lookAt(pos, pos + dir).Rotation
			r.dir = dir
			if r.t <= 0 then r.stage = "go"; r.t = 2.2; self.hum.WalkSpeed = 46; ctx.fx("roar", pos) end
		else
			self.hum:Move(r.dir)
			for _, t in ipairs(ctx.targets()) do
				if not r.hit[t.player] and (t.root.Position - pos).Magnitude < 14 then
					r.hit[t.player] = true
					ctx.damagePlayer(t.player, 40 * self.dmgMul, pos, "melee")
					t.root.AssemblyLinearVelocity += r.dir * 90 + V(0, 40, 0)
				end
			end
			if r.t <= 0 then self.ram = nil; self.hum.WalkSpeed = 12 end
		end
		return
	end
	self.align.CFrame = CFrame.lookAt(pos, pos + dir).Rotation
	if dist > 50 then self.hum:Move(dir) elseif dist < 28 then self.hum:Move(-dir * 0.5) else self.hum:Move(V(-dir.Z, 0, dir.X) * 0.4) end

	self.cannonT -= dt
	if self.cannonT <= 0 then
		self.cannonT = self.phase == 3 and 2.2 or 3.2
		local o = self.tip.Position
		local aim = tpos + target.root.AssemblyLinearVelocity * 0.4
		ctx.orb(o, (aim - o).Unit, 105, 26 * self.dmgMul, 14, RGB(255, 160, 64))
	end
	if self.phase >= 2 then
		self.mortarT -= dt
		if self.mortarT <= 0 then
			self.mortarT = self.phase == 3 and 5.5 or 7
			self:mortars(pos + V(0, 10, 0), tpos, 4, 22)
		end
	end
	if self.phase == 3 then
		self.ramT -= dt
		if self.ramT <= 0 and dist < 120 then
			self.ramT = 7
			self.ram = { stage = "charge", t = 0.9, hit = {} }
			ctx.fx("stompCharge", V(pos.X, pos.Y - 3, pos.Z), 18, 0.9)
		end
	end
end

local CLASSES = { titan = Titan, hive = Hive, bulwark = Iron }

-- wave 5 spawns the first boss, 10 the second, 15 the third, then they repeat stronger
function Bosses.forWave(wave: number)
	local n = math.floor(wave / 5)
	local def = Config.Bosses[(n - 1) % #Config.Bosses + 1]
	local cycle = math.floor((n - 1) / #Config.Bosses) + 1
	return def, cycle
end

function Bosses.spawn(wave: number, pos: Vector3, players: number)
	local def, cycle = Bosses.forWave(wave)
	return CLASSES[def.id].spawn(pos, cycle, players), def
end

return Bosses
