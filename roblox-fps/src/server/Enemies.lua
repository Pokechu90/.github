-- Security bots: rig construction, AI, attacks and death.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local PathfindingService = game:GetService("PathfindingService")
local Debris = game:GetService("Debris")
local Config = require(ReplicatedStorage:WaitForChild("FoundryShared"):WaitForChild("Config"))

local S = Config.METER
local Enemies = {}
local Enemy = {}
Enemy.__index = Enemy

local list = {}
local byModel = {}
local nextId = 0
local ctx -- set by init: targets(), spawnBolt(), damagePlayer(), fx(), explosion(), onKill(), wave()
local rng = Random.new()
local function rand(a, b) return a + rng:NextNumber() * (b - a) end
local DARK = Color3.fromRGB(24, 28, 32)

function Enemies.init(context) ctx = context end
function Enemies.list() return list end
function Enemies.count() return #list end

function Enemies.fromPart(part)
	local m = part and part:FindFirstAncestorWhichIsA("Model")
	return m and byModel[m]
end

local function weld(a, b)
	local w = Instance.new("WeldConstraint")
	w.Part0, w.Part1 = a, b
	w.Parent = a
end

local function build(kind, pos)
	local k = Config.Enemies[kind]
	local s = k.scale
	local model = Instance.new("Model")
	model.Name = k.name
	local function mk(name, size, color, mat, cf, shape)
		local p = Instance.new("Part")
		p.Name = name
		if shape then p.Shape = shape end
		p.Size = size * s
		p.Color = color
		p.Material = mat
		p.CanCollide = false
		p.Massless = true
		p.TopSurface, p.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
		p.CFrame = cf
		p.Parent = model
		return p
	end
	local V = Vector3.new
	local base = CFrame.new(pos)
	local root = mk("HumanoidRootPart", V(2.2, 2, 1.2), k.color, Enum.Material.SmoothPlastic, base)
	root.Transparency = 1
	root.CanCollide = true
	root.Massless = false
	local torso = mk("Torso", V(2.2, 2.3, 1.4), k.color, Enum.Material.Metal, base * CFrame.new(0, 1.35 * s, 0)); weld(root, torso)
	local plate = mk("Plate", V(1.6, 1, 0.2), DARK, Enum.Material.DiamondPlate, torso.CFrame * CFrame.new(0, 0.1 * s, -0.75 * s)); weld(torso, plate)
	local chest = mk("Glow", V(1.1, 0.2, 0.1), k.glow, Enum.Material.Neon, torso.CFrame * CFrame.new(0, 0.5 * s, -0.86 * s)); weld(torso, chest)
	local pelvis = mk("Pelvis", V(1.5, 0.7, 1.2), DARK, Enum.Material.Metal, base * CFrame.new(0, -0.1 * s, 0)); weld(root, pelvis)
	local head = mk("Head", V(1.2, 1.05, 1.2), k.color, Enum.Material.Metal, torso.CFrame * CFrame.new(0, 1.75 * s, 0)); weld(torso, head)
	local visor = mk("Glow", V(1.0, 0.25, 0.1), k.glow, Enum.Material.Neon, head.CFrame * CFrame.new(0, 0.05 * s, -0.62 * s)); weld(head, visor)
	local ant = mk("Antenna", V(0.1, 0.55, 0.1), DARK, Enum.Material.Metal, head.CFrame * CFrame.new(0.4 * s, 0.75 * s, 0.2 * s)); weld(head, ant)

	for i, side in ipairs({ -1, 1 }) do
		local leg = mk("Leg", V(0.7, 3.6, 0.75), DARK, Enum.Material.Metal, base * CFrame.new(side * 0.6 * s, -2.2 * s, 0))
		local hip = Instance.new("Motor6D")
		hip.Name = "Hip" .. i
		hip.Part0, hip.Part1 = root, leg
		hip.C0 = CFrame.new(side * 0.6 * s, -0.4 * s, 0)
		hip.C1 = CFrame.new(0, 1.8 * s, 0)
		hip.Parent = root
		local thigh = mk("Thigh", V(0.85, 1.4, 0.9), k.color, Enum.Material.Metal, leg.CFrame * CFrame.new(0, 0.9 * s, 0)); weld(leg, thigh)
		local foot = mk("Foot", V(0.8, 0.3, 1.2), k.color, Enum.Material.Metal, leg.CFrame * CFrame.new(0, -1.65 * s, -0.18 * s)); weld(leg, foot)

		local arm = mk("Arm", V(0.55, 2.4, 0.6), DARK, Enum.Material.Metal, torso.CFrame)
		local sh = Instance.new("Motor6D")
		sh.Name = "Shoulder" .. i
		sh.Part0, sh.Part1 = torso, arm
		local aimArm = side == 1 and not k.melee
		sh.C0 = CFrame.new(side * 1.45 * s, 0.8 * s, 0) * (aimArm and CFrame.Angles(math.rad(90), 0, 0) or (not k.melee and CFrame.Angles(math.rad(65), 0, math.rad(-30)) or CFrame.new()))
		sh.C1 = CFrame.new(0, 1.1 * s, 0)
		sh.Parent = torso
		arm.CFrame = torso.CFrame * sh.C0 * sh.C1:Inverse()
		local pad = mk("Shoulder", V(0.95, 0.75, 1), k.color, Enum.Material.Metal, arm.CFrame * CFrame.new(0, 1.0 * s, 0)); weld(arm, pad)
		if kind == "heavy" then local g = mk("Glow", V(0.97, 0.15, 1.02), k.glow, Enum.Material.Neon, pad.CFrame * CFrame.new(0, 0.2 * s, 0)); weld(pad, g) end
		if k.melee then
			local blade = mk("Blade", V(0.12, 2.0, 0.5), k.glow, Enum.Material.Neon, arm.CFrame * CFrame.new(0, -1.9 * s, -0.2 * s)); weld(arm, blade)
		elseif aimArm then
			local gun = mk("Gun", V(0.55, 2.6, 0.65), DARK, Enum.Material.Metal, arm.CFrame * CFrame.new(0, -1.7 * s, 0.1 * s)); weld(arm, gun)
			local tip = mk("GunTip", V(0.4, 0.4, 0.4), k.glow, Enum.Material.Neon, arm.CFrame * CFrame.new(0, -3.05 * s, 0.1 * s), Enum.PartType.Ball); weld(arm, tip)
			tip.Transparency = 0.6
		end
	end

	local hum = Instance.new("Humanoid")
	hum.HipHeight = 3 * s
	hum.WalkSpeed = k.speed
	hum.AutoRotate = false
	hum.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
	hum.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff
	hum.BreakJointsOnDeath = false
	hum.MaxHealth = 1e6
	hum.Health = 1e6
	hum.RequiresNeck = false
	for _, st in ipairs({ Enum.HumanoidStateType.FallingDown, Enum.HumanoidStateType.Ragdoll, Enum.HumanoidStateType.Climbing, Enum.HumanoidStateType.Seated, Enum.HumanoidStateType.Swimming, Enum.HumanoidStateType.Dead }) do
		hum:SetStateEnabled(st, false)
	end
	hum.Parent = model

	local att = Instance.new("Attachment")
	att.Parent = root
	local align = Instance.new("AlignOrientation")
	align.Mode = Enum.OrientationAlignmentMode.OneAttachment
	align.Attachment0 = att
	align.Responsiveness = 18
	align.MaxTorque = 1e8
	align.Parent = root

	local hl = Instance.new("Highlight")
	hl.FillColor = Color3.new(1, 1, 1)
	hl.FillTransparency = 0.35
	hl.OutlineTransparency = 1
	hl.DepthMode = Enum.HighlightDepthMode.Occluded
	hl.Enabled = false
	hl.Parent = model

	model.PrimaryPart = root
	model:SetAttribute("Kind", kind)
	return model, root, hum, align, hl
end

function Enemies.spawn(kind, pos)
	local k = Config.Enemies[kind]
	nextId += 1
	local p = pos + Vector3.new(0, 3 * k.scale * 1.35 + 1, 0)
	local model, root, hum, align, hl = build(kind, p)
	model.Parent = workspace.Enemies
	root:SetNetworkOwner(nil)
	local self = setmetatable({
		id = nextId, kind = kind, k = k, model = model, root = root, hum = hum, align = align, hl = hl,
		tip = model:FindFirstChild("GunTip", true), head = model:FindFirstChild("Head"),
		hpMax = k.hp * (1 + (ctx.wave() - 1) * 0.07),
		fireT = rand(1.2, 2.6), thinkT = rand(0, 0.2), los = false, strafe = rng:NextNumber() < 0.5 and 1 or -1,
		strafeT = rand(1, 3), stuckT = 0, lastPos = p, meleeT = 0.8, burst = 0, burstT = 0, spawnT = 0.7,
		waypoints = nil, wpi = 1, pathT = 0, flashT = 0, charged = false,
	}, Enemy)
	self.hp = self.hpMax
	list[#list + 1] = self
	byModel[model] = self
	ctx.fx("warp", pos, kind)
	return self
end

local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Exclude
local function refreshFilter()
	rayParams.FilterDescendantsInstances = { workspace.Enemies, workspace.Projectiles, workspace.Debris, workspace.Pickups }
end

function Enemy:eye()
	return self.head and self.head.Position or self.root.Position
end

function Enemy:computePath(goal)
	if self.pathing then return end
	self.pathing = true
	task.spawn(function()
		local path = PathfindingService:CreatePath({ AgentRadius = 2.2 * self.k.scale, AgentHeight = 7 * self.k.scale, AgentCanJump = true, WaypointSpacing = 10 })
		local ok = pcall(function() path:ComputeAsync(self.root.Position, goal) end)
		if ok and path.Status == Enum.PathStatus.Success and self.hp > 0 then
			self.waypoints = path:GetWaypoints()
			self.wpi = 2
		else
			self.waypoints = nil
		end
		self.pathing = false
	end)
end

function Enemy:think(target)
	local rootPos = self.root.Position
	local tpos = target.root.Position
	local flat = Vector3.new(tpos.X - rootPos.X, 0, tpos.Z - rootPos.Z)
	local dist = flat.Magnitude
	local dir = dist > 0.01 and flat / dist or Vector3.zAxis
	local eye = self:eye()
	local res = workspace:Raycast(eye, target.head.Position - eye, rayParams)
	self.los = (res == nil) or res.Instance:IsDescendantOf(target.char)
	self.dist = dist

	local goal
	if self.k.melee then
		goal = tpos
	else
		self.strafeT -= 0.15
		if self.strafeT <= 0 then self.strafe = -self.strafe; self.strafeT = rand(1.2, 3) end
		if not self.los or dist > self.k.pref[2] then goal = tpos
		elseif dist < self.k.pref[1] then goal = rootPos - dir * 14
		else goal = rootPos + Vector3.new(-dir.Z, 0, dir.X) * self.strafe * 14 end
	end

	-- follow a path when the target is out of sight, otherwise steer directly
	if not self.los then
		self.pathT -= 0.15
		if self.pathT <= 0 then self.pathT = 1.4; self:computePath(tpos) end
	else
		self.waypoints = nil
	end
	if self.waypoints and self.waypoints[self.wpi] then
		local wp = self.waypoints[self.wpi]
		self.hum:MoveTo(wp.Position)
		if wp.Action == Enum.PathWaypointAction.Jump then self.hum.Jump = true end
		if (Vector3.new(wp.Position.X, rootPos.Y, wp.Position.Z) - rootPos).Magnitude < 5 then self.wpi += 1 end
	elseif self.unstickT and self.unstickT > os.clock() then
		self.hum:MoveTo(self.unstickGoal)
	else
		self.hum:MoveTo(goal)
	end

	-- stuck detection
	local moved = (rootPos - self.lastPos).Magnitude
	self.lastPos = rootPos
	if moved < 0.6 and dist > 8 then
		self.stuckT += 0.15
		if self.stuckT > 1 then
			self.stuckT = 0
			self.hum.Jump = true
			local a = rand(0, math.pi * 2)
			self.unstickGoal = rootPos + Vector3.new(math.cos(a), 0, math.sin(a)) * 18
			self.unstickT = os.clock() + 1.2
		end
	else
		self.stuckT = 0
	end
end

function Enemy:update(dt, target)
	if self.spawnT > 0 then
		self.spawnT -= dt
		self.hum:Move(Vector3.zero)
		return
	end
	self.thinkT -= dt
	if self.thinkT <= 0 then
		self.thinkT = 0.15
		self:think(target)
	end
	-- facing
	local rootPos = self.root.Position
	local look
	if self.los or (self.dist or 99) < 40 then
		look = Vector3.new(target.root.Position.X, rootPos.Y, target.root.Position.Z)
	else
		local v = self.root.AssemblyLinearVelocity
		if Vector3.new(v.X, 0, v.Z).Magnitude > 2 then look = rootPos + Vector3.new(v.X, 0, v.Z) end
	end
	if look and (look - rootPos).Magnitude > 0.1 then self.align.CFrame = CFrame.lookAt(rootPos, look).Rotation end

	if self.flashT > 0 then
		self.flashT -= dt
		if self.flashT <= 0 then self.hl.Enabled = false end
	end

	if self.k.melee then
		self.meleeT -= dt
		local tp = target.root.Position
		if self.meleeT <= 0 and (tp - rootPos).Magnitude < 8 * self.k.scale then
			self.meleeT = 1
			ctx.fx("slash", rootPos, self.model)
			ctx.damagePlayer(target.player, self.k.damage + ctx.wave() * 0.6, rootPos, false)
		end
		return
	end

	if self.burst > 0 then
		self.burstT -= dt
		if self.burstT <= 0 then self:fire(target); self.burst -= 1; self.burstT = 0.16 end
	end
	if self.los and (self.dist or 999) < 210 then
		self.fireT -= dt
		local win = 0.45
		if self.fireT < win and self.tip then
			local c = 1 - math.max(self.fireT, 0) / win
			self.tip.Transparency = 0.6 - c * 0.6
			self.tip.Size = Vector3.new(0.4, 0.4, 0.4) * self.k.scale * (1 + c * 1.3)
			if not self.charged then self.charged = true; ctx.fx("charge", self.tip.Position) end
		end
		if self.fireT <= 0 then
			self.fireT = rand(self.k.rate[1], self.k.rate[2]) * ((self.dist or 99) < 35 and 0.8 or 1)
			self:resetTip()
			if self.k.burst then self.burst = self.k.burst; self.burstT = 0 else self:fire(target) end
		end
	else
		self.fireT = math.max(self.fireT, 0.7)
		if self.charged then self:resetTip() end
	end
end

function Enemy:resetTip()
	self.charged = false
	if self.tip then
		self.tip.Transparency = 0.6
		self.tip.Size = Vector3.new(0.4, 0.4, 0.4) * self.k.scale
	end
end

function Enemy:fire(target)
	if not self.tip or not target.root.Parent then return end
	local origin = self.tip.Position
	local aim = target.root.Position + Vector3.new(0, 1.2, 0)
	local dist = (aim - origin).Magnitude
	aim += target.root.AssemblyLinearVelocity * (dist / self.k.boltSpeed) * 0.6
	local speed = target.root.AssemblyLinearVelocity.Magnitude
	local inacc = self.k.accuracy * (1 + speed * 0.02) * dist
	aim += Vector3.new(rand(-1, 1) * inacc, rand(-1, 1) * inacc * 0.6, rand(-1, 1) * inacc)
	ctx.spawnBolt(origin, (aim - origin).Unit, self.k.boltSpeed, self.k.damage + math.min(6, ctx.wave() * 0.5), self.kind == "heavy")
end

-- returns true when this hit killed the bot
function Enemy:damage(amount, dir, killer, weaponIndex, headshot)
	if self.hp <= 0 then return false end
	self.hp -= amount
	self.fireT += 0.08
	self.hl.Enabled = true
	self.flashT = 0.07
	if self.hp <= 0 then
		self:die(dir or Vector3.zAxis, killer, weaponIndex, headshot)
		return true
	end
	return false
end

function Enemy:die(dir, killer, weaponIndex, headshot)
	for i, e in ipairs(list) do if e == self then table.remove(list, i) break end end
	byModel[self.model] = nil
	local pos = self.root.Position
	local eye = self:eye()
	self.hl:Destroy()
	for _, d in ipairs(self.model:GetDescendants()) do
		if d:IsA("JointInstance") or d:IsA("WeldConstraint") or d:IsA("AlignOrientation") or d:IsA("Humanoid") then d:Destroy() end
	end
	self.model.Parent = workspace.Debris
	for _, p in ipairs(self.model:GetDescendants()) do
		if p:IsA("BasePart") then
			if p.Material == Enum.Material.Neon then p.Color = Color3.fromRGB(25, 25, 25); p.Material = Enum.Material.Metal end
			if p.Name == "GunTip" then p.Transparency = 1 end
			p.CanCollide = p.Name ~= "HumanoidRootPart"
			p.CanQuery = false
			p.Massless = false
			p.Color = p.Color:Lerp(Color3.new(), 0.35)
			p.AssemblyLinearVelocity = dir * rand(20, 45) + Vector3.new(rand(-12, 12), rand(18, 40), rand(-12, 12))
			p.AssemblyAngularVelocity = Vector3.new(rand(-12, 12), rand(-12, 12), rand(-12, 12))
		end
	end
	Debris:AddItem(self.model, 6)
	ctx.fx("botDeath", eye, self.kind)
	if self.kind == "heavy" then ctx.explosion(pos, 16, 40, nil) end
	ctx.onKill(self, killer, weaponIndex, headshot, pos)
end

function Enemies.update(dt, targets)
	refreshFilter()
	if #targets == 0 then
		for _, e in ipairs(list) do e.hum:Move(Vector3.zero) end
		return
	end
	for _, e in ipairs(table.clone(list)) do
		if e.root.Parent == nil or e.root.Position.Y < -50 then
			e.hp = 0
			for i, x in ipairs(list) do if x == e then table.remove(list, i) break end end
			byModel[e.model] = nil
			e.model:Destroy()
		else
			local best, bd = nil, math.huge
			for _, t in ipairs(targets) do
				local d = (t.root.Position - e.root.Position).Magnitude
				if d < bd then best, bd = t, d end
			end
			e:update(dt, best)
		end
	end
end

function Enemies.clear()
	for _, e in ipairs(list) do e.model:Destroy() end
	table.clear(list)
	table.clear(byModel)
end

return Enemies
