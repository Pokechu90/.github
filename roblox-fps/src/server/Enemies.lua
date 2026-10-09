--!nonstrict
-- Security bots: seven rig types with their own AI, attacks, weak points and deaths.
-- Bosses register through Enemies.add and share the same damage and update interface.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local PathfindingService = game:GetService("PathfindingService")
local Debris = game:GetService("Debris")
local Config = require(ReplicatedStorage:WaitForChild("FoundryShared"):WaitForChild("Config"))

local Enemies = {}
local Enemy = {}
Enemy.__index = Enemy

local list = {}
local byModel = {}
local nextId = 0
-- set by init: bolt, orb, damagePlayer, fx, explosion, onKill, scale, isStunned
local ctx: any
local rng = Random.new()
local function rand(a, b) return a + rng:NextNumber() * (b - a) end
local DARK = Color3.fromRGB(24, 28, 32)
local V = Vector3.new

function Enemies.init(context) ctx = context end
function Enemies.list() return list end
function Enemies.count() return #list end
function Enemies.nextId() nextId += 1; return nextId end

-- returns the enemy and the hit zone ("head", "weak", "limb", "shield", "body") for a part
function Enemies.fromPart(part: Instance?)
	if not part then return nil, nil end
	local m = part:FindFirstAncestorWhichIsA("Model")
	while m and not byModel[m] do m = m.Parent and m.Parent:FindFirstAncestorWhichIsA("Model") or nil end
	if not m then return nil, nil end
	return byModel[m], part:GetAttribute("Zone") or "body"
end

function Enemies.add(e)
	table.insert(list, e)
	byModel[e.model] = e
end

function Enemies.remove(e)
	local i = table.find(list, e)
	if i then table.remove(list, i) end
	byModel[e.model] = nil
end

local function weld(a, b)
	local w = Instance.new("WeldConstraint")
	w.Part0, w.Part1 = a, b
	w.Parent = a
end

local ZONES = { Head = "head", Antenna = "head", Visor = "head", Eye = "head", Socket = "head", Jaw = "head", Hood = "head", Hat = "head", Ear = "head", Hand = "limb", Wing = "limb", Leg = "limb", Arm = "limb", Thigh = "limb", Foot = "limb", Shoulder = "limb", Core = "weak", Vent = "weak", Cell = "weak", Shield = "shield" }

local function maker(model, s)
	return function(name, size, color, mat, cf, shape)
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
		if ZONES[name] then p:SetAttribute("Zone", ZONES[name]) end
		p.Parent = model
		return p
	end
end

local function finishModel(model, kind, root)
	local hl = Instance.new("Highlight")
	hl.FillColor = Color3.new(1, 1, 1)
	hl.FillTransparency = 0.35
	hl.OutlineTransparency = 1
	hl.DepthMode = Enum.HighlightDepthMode.Occluded
	hl.Enabled = false
	hl.Parent = model
	model.PrimaryPart = root
	model:SetAttribute("Kind", kind)
	return hl
end

-- humanoid and facing control shared by every ground walker
local function walkerRig(model, root, k, s)
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
	return hum, align
end

-- ground walker: humanoid rig with Motor6D hips and shoulders the client animates
local function buildWalker(kind, pos)
	local k = Config.Enemies[kind]
	local ai = k.ai or kind
	local s = k.scale or 1
	local model = Instance.new("Model")
	model.Name = k.name
	local mk = maker(model, s)
	local base = CFrame.new(pos)
	local root = mk("HumanoidRootPart", V(2.2, 2, 1.2), k.color, Enum.Material.SmoothPlastic, base)
	root.Transparency = 1
	root.CanCollide = true
	root.CanQuery = false
	root.Massless = false
	local torso = mk("Torso", V(2.2, 2.3, 1.4), k.color, Enum.Material.Metal, base * CFrame.new(0, 1.35 * s, 0)); weld(root, torso)
	local plate = mk("Plate", V(1.6, 1, 0.2), DARK, Enum.Material.DiamondPlate, torso.CFrame * CFrame.new(0, 0.1 * s, -0.75 * s)); weld(torso, plate)
	local chest = mk("Glow", V(1.1, 0.2, 0.1), k.glow, Enum.Material.Neon, torso.CFrame * CFrame.new(0, 0.5 * s, -0.86 * s)); weld(torso, chest)
	local pelvis = mk("Pelvis", V(1.5, 0.7, 1.2), DARK, Enum.Material.Metal, base * CFrame.new(0, -0.1 * s, 0)); weld(root, pelvis)
	local head = mk("Head", V(1.2, 1.05, 1.2), k.color, Enum.Material.Metal, torso.CFrame * CFrame.new(0, 1.75 * s, 0)); weld(torso, head)
	local visor = mk("Visor", V(1.0, 0.25, 0.1), k.glow, Enum.Material.Neon, head.CFrame * CFrame.new(0, 0.05 * s, -0.62 * s)); weld(head, visor)
	local ant = mk("Antenna", V(0.1, 0.55, 0.1), DARK, Enum.Material.Metal, head.CFrame * CFrame.new(0.4 * s, 0.75 * s, 0.2 * s)); weld(head, ant)

	-- per-type silhouettes and weak points
	if ai == "exploder" then
		local core = mk("Core", V(1.2, 1.2, 1.2), k.glow, Enum.Material.Neon, torso.CFrame * CFrame.new(0, 0, -0.75 * s), Enum.PartType.Ball); weld(torso, core)
		local l = Instance.new("PointLight"); l.Color, l.Range, l.Brightness = k.glow, 10, 2; l.Parent = core
	elseif ai == "tank" then
		local vent = mk("Vent", V(1.3, 1.1, 0.3), k.glow, Enum.Material.Neon, torso.CFrame * CFrame.new(0, 0.3 * s, 0.8 * s)); weld(torso, vent)
		for _, side in ipairs({ -1, 1 }) do
			local pod = mk("Armor", V(0.9, 1.6, 1.6), k.color, Enum.Material.DiamondPlate, torso.CFrame * CFrame.new(side * 1.2 * s, 0.7 * s, 0)); weld(torso, pod)
		end
	elseif ai == "shield" then
		local cell = mk("Cell", V(0.9, 1.0, 0.35), k.glow, Enum.Material.Neon, torso.CFrame * CFrame.new(0, 0.2 * s, 0.85 * s)); weld(torso, cell)
	elseif ai == "sniper" then
		local cloak = mk("Cloak", V(2.4, 1.6, 1.5), Color3.fromRGB(58, 64, 50), Enum.Material.Fabric, torso.CFrame * CFrame.new(0, 0.35 * s, 0.05 * s)); weld(torso, cloak)
	elseif ai == "runner" then
		torso.Size = V(1.8, 2.0, 1.2) * s
	end

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
		local shieldArm = side == -1 and ai == "shield"
		local pose = CFrame.new()
		if aimArm or shieldArm then pose = CFrame.Angles(math.rad(90), 0, 0)
		elseif not k.melee then pose = CFrame.Angles(math.rad(65), 0, math.rad(-30)) end
		sh.C0 = CFrame.new(side * 1.45 * s, 0.8 * s, 0) * pose
		sh.C1 = CFrame.new(0, 1.1 * s, 0)
		sh.Parent = torso
		arm.CFrame = torso.CFrame * sh.C0 * sh.C1:Inverse()
		local pad = mk("Shoulder", V(0.95, 0.75, 1), k.color, Enum.Material.Metal, arm.CFrame * CFrame.new(0, 1.0 * s, 0)); weld(arm, pad)
		if k.melee then
			local blade = mk("Blade", V(0.12, 2.0, 0.5), k.glow, Enum.Material.Neon, arm.CFrame * CFrame.new(0, -1.9 * s, -0.2 * s)); weld(arm, blade)
		elseif shieldArm then
			-- a wide energy shield held in front: blocks frontal fire
			local sp = mk("Shield", V(3.6, 3.6, 0.25), k.glow, Enum.Material.ForceField, torso.CFrame * CFrame.new(-0.3 * s, -0.95 * s, -1.6 * s))
			sp.Transparency = 0.15
			weld(torso, sp)
			local frame = mk("ShieldFrame", V(3.7, 0.2, 0.3), DARK, Enum.Material.Metal, sp.CFrame * CFrame.new(0, 1.85 * s, 0)); weld(sp, frame)
		elseif aimArm then
			local long = ai == "sniper"
			local gun = mk("Gun", V(0.55, long and 3.6 or 2.6, 0.65), DARK, Enum.Material.Metal, arm.CFrame * CFrame.new(0, (long and -2.2 or -1.7) * s, 0.1 * s)); weld(arm, gun)
			local tip = mk("GunTip", V(0.4, 0.4, 0.4), k.glow, Enum.Material.Neon, arm.CFrame * CFrame.new(0, (long and -4.05 or -3.05) * s, 0.1 * s), Enum.PartType.Ball); weld(arm, tip)
			tip.Transparency = 0.6
			if ai == "tank" then gun.Size = V(1.0, 2.6, 1.0) * s; tip.Size = V(0.8, 0.8, 0.8) * s end
		end
	end

	local hum, align = walkerRig(model, root, k, s)
	return model, root, hum, align, finishModel(model, kind, root)
end

-- hovering drone: physics body held up by AlignPosition so motion replicates smoothly
local function buildDrone(pos)
	local k = Config.Enemies.drone
	local model = Instance.new("Model")
	model.Name = k.name
	local mk = maker(model, 1)
	local base = CFrame.new(pos)
	local root = mk("Body", V(2.6, 1.3, 2.6), k.color, Enum.Material.Metal, base)
	root.Massless = false
	local eye = mk("Eye", V(1.1, 1.1, 1.1), k.glow, Enum.Material.Neon, base * CFrame.new(0, -0.1, -1.25), Enum.PartType.Ball); weld(root, eye)
	local l = Instance.new("PointLight"); l.Color, l.Range, l.Brightness = k.glow, 12, 1.5; l.Parent = eye
	for i = 0, 3 do
		local a = i / 4 * math.pi * 2 + math.pi / 4
		local off = V(math.cos(a), 0, math.sin(a)) * 1.9
		local arm = mk("Arm", V(0.3, 0.2, 1.6), DARK, Enum.Material.Metal, CFrame.lookAt(pos + off * 0.5, pos + off)); weld(root, arm)
		local rotor = mk("Rotor", V(0.12, 1.5, 1.5), k.glow, Enum.Material.Neon, CFrame.new(pos + off + V(0, 0.25, 0)) * CFrame.Angles(0, 0, math.pi / 2), Enum.PartType.Cylinder)
		rotor.Transparency = 0.55
		weld(root, rotor)
	end
	local tip = mk("GunTip", V(0.5, 0.5, 0.5), k.glow, Enum.Material.Neon, base * CFrame.new(0, -0.9, -0.6), Enum.PartType.Ball); weld(root, tip)
	tip.Transparency = 0.6
	local att = Instance.new("Attachment"); att.Parent = root
	local ap = Instance.new("AlignPosition")
	ap.Mode = Enum.PositionAlignmentMode.OneAttachment
	ap.Attachment0 = att
	ap.MaxForce = 1e6
	ap.MaxVelocity = k.speed
	ap.Responsiveness = 12
	ap.Position = pos
	ap.Parent = root
	local ao = Instance.new("AlignOrientation")
	ao.Mode = Enum.OrientationAlignmentMode.OneAttachment
	ao.Attachment0 = att
	ao.Responsiveness = 14
	ao.MaxTorque = 1e7
	ao.Parent = root
	return model, root, ap, ao, finishModel(model, "drone", root)
end

---------------------------------------------------------------- Halloween mobs (Night of Terror)
local M = Enum.Material
local BONE, BLACK = Color3.fromRGB(230, 220, 192), Color3.fromRGB(10, 8, 10)
local function motor(name, p0, p1, c0, c1)
	local m = Instance.new("Motor6D")
	m.Name, m.Part0, m.Part1, m.C0, m.C1 = name, p0, p1, c0, c1
	m.Parent = p0
	return m
end

-- spooky walkers share the bot skeleton (root, hips, shoulders) so the client animates them the same way
local function buildSpook(kind, pos)
	local k = Config.Enemies[kind]
	local look = k.look
	local s = k.scale or 1
	local model = Instance.new("Model")
	model.Name = k.name
	local mk = maker(model, s)
	local base = CFrame.new(pos)
	local skin = look == "skeleton" and BONE or (look == "witch" and Color3.fromRGB(122, 170, 96) or k.color)
	local cloth = ({ zombie = Color3.fromRGB(70, 84, 104), witch = Color3.fromRGB(34, 22, 44), pumpkin = Color3.fromRGB(84, 64, 40), brute = Color3.fromRGB(70, 60, 44), keeper = Color3.fromRGB(28, 24, 34) })[look] or BONE
	local root = mk("HumanoidRootPart", V(2.2, 2, 1.2), cloth, M.SmoothPlastic, base)
	root.Transparency, root.CanCollide, root.CanQuery, root.Massless = 1, true, false, false
	local thin = look == "skeleton"
	local torso = mk("Torso", thin and V(1.5, 2.2, 0.8) or V(2.2, 2.3, 1.3), thin and BONE or cloth, thin and M.Marble or M.Fabric, base * CFrame.new(0, 1.35 * s, 0)); weld(root, torso)
	if thin then
		for i = 0, 2 do
			local rib = mk("Rib", V(1.9, 0.18, 1.1), BONE, M.Marble, torso.CFrame * CFrame.new(0, 0.55 * s - i * 0.45 * s, 0)); weld(torso, rib)
		end
	end
	local pelvis = mk("Pelvis", V(1.5, 0.6, 1.0), thin and BONE or cloth, thin and M.Marble or M.Fabric, base * CFrame.new(0, -0.1 * s, 0)); weld(root, pelvis)

	-- heads
	local head
	if look == "pumpkin" then
		head = mk("Core", V(1.9, 1.6, 1.9), Color3.fromRGB(232, 118, 28), M.SmoothPlastic, torso.CFrame * CFrame.new(0, 2.0 * s, 0), Enum.PartType.Ball); weld(torso, head)
		local stem = mk("Stem", V(0.2, 0.45, 0.2), Color3.fromRGB(70, 110, 40), M.Wood, head.CFrame * CFrame.new(0, 0.95 * s, 0)); weld(head, stem)
		for _, x in ipairs({ -0.4, 0.4 }) do
			local eye = mk("Glow", V(0.35, 0.3, 0.1), k.glow, M.Neon, head.CFrame * CFrame.new(x * s, 0.2 * s, -0.92 * s) * CFrame.Angles(0, 0, math.rad(45))); weld(head, eye)
		end
		local grin = mk("Glow", V(0.95, 0.22, 0.1), k.glow, M.Neon, head.CFrame * CFrame.new(0, -0.3 * s, -0.9 * s)); weld(head, grin)
		local l = Instance.new("PointLight"); l.Color, l.Range, l.Brightness = k.glow, 12, 2; l.Parent = head
	else
		head = mk("Head", look == "brute" and V(1.4, 1.2, 1.4) or V(1.1, 1.15, 1.15), skin, thin and M.Marble or M.SmoothPlastic, torso.CFrame * CFrame.new(0, 1.75 * s, look == "brute" and -0.35 * s or 0)); weld(torso, head)
		for _, x in ipairs({ -0.25, 0.25 }) do
			local eye = mk(thin and "Socket" or "Eye", V(0.26, 0.22, 0.1), thin and BLACK or k.glow, thin and M.SmoothPlastic or M.Neon, head.CFrame * CFrame.new(x * s, 0.12 * s, -0.58 * s)); weld(head, eye)
			if thin then
				local spark = mk("Eye", V(0.1, 0.1, 0.05), k.glow, M.Neon, eye.CFrame * CFrame.new(0, 0, -0.04 * s)); weld(head, spark)
			end
		end
		if thin then
			local jaw = mk("Jaw", V(0.8, 0.3, 0.75), BONE, M.Marble, head.CFrame * CFrame.new(0, -0.62 * s, -0.12 * s)); weld(head, jaw)
		end
	end
	if look == "witch" then
		local brim = mk("Hat", V(0.12, 2.4, 2.4), BLACK, M.Fabric, head.CFrame * CFrame.new(0, 0.62 * s, 0) * CFrame.Angles(0, 0, math.pi / 2), Enum.PartType.Cylinder); weld(head, brim)
		for i = 1, 4 do
			local w = 1.15 - i * 0.24
			local cone = mk("Hat", V(w, 0.5, w), BLACK, M.Fabric, head.CFrame * CFrame.new(0.06 * i * s, (0.75 + i * 0.42) * s, 0.04 * i * s) * CFrame.Angles(0, 0, math.rad(-6 * i))); weld(head, cone)
		end
		local band = mk("Glow", V(1.17, 0.14, 1.17), Color3.fromRGB(110, 60, 160), M.Neon, head.CFrame * CFrame.new(0, 0.95 * s, 0)); weld(head, band)
		local robe = mk("Robe", V(2.3, 3.0, 1.6), cloth, M.Fabric, base * CFrame.new(0, -1.3 * s, 0)); weld(root, robe)
	elseif look == "keeper" then
		local hood = mk("Hood", V(1.45, 1.45, 1.45), cloth, M.Fabric, head.CFrame * CFrame.new(0, 0.15 * s, 0.12 * s)); weld(head, hood)
		head.Color = Color3.fromRGB(16, 12, 18)
		local robe = mk("Robe", V(2.4, 3.2, 1.6), cloth, M.Fabric, base * CFrame.new(0, -1.4 * s, 0)); weld(root, robe)
	elseif look == "zombie" then
		local rag = mk("Rag", V(2.25, 0.5, 1.35), Color3.fromRGB(110, 40, 36), M.Fabric, torso.CFrame * CFrame.new(0.2 * s, -0.9 * s, 0) * CFrame.Angles(0, 0, math.rad(8))); weld(torso, rag)
	elseif look == "brute" then
		local lantern = mk("Vent", V(0.9, 1.2, 0.9), k.glow, M.Neon, torso.CFrame * CFrame.new(0, 0.2 * s, 0.95 * s)); weld(torso, lantern)
		local l = Instance.new("PointLight"); l.Color, l.Range, l.Brightness = k.glow, 14, 2; l.Parent = lantern
		local hump = mk("Hump", V(2.0, 1.2, 1.2), skin, M.SmoothPlastic, torso.CFrame * CFrame.new(0, 1.1 * s, 0.2 * s)); weld(torso, hump)
	end

	-- limbs: legs on hip motors, arms on shoulder motors
	local limb = thin and BONE or (look == "zombie" and Color3.fromRGB(60, 52, 40) or cloth)
	for i, side in ipairs({ -1, 1 }) do
		local leg = mk("Leg", thin and V(0.35, 3.6, 0.35) or V(0.7, 3.6, 0.75), limb, thin and M.Marble or M.Fabric, base * CFrame.new(side * 0.6 * s, -2.2 * s, 0))
		motor("Hip" .. i, root, leg, CFrame.new(side * 0.6 * s, -0.4 * s, 0), CFrame.new(0, 1.8 * s, 0))
		local foot = mk("Foot", V(0.7, 0.3, 1.0), thin and BONE or BLACK, thin and M.Marble or M.SmoothPlastic, leg.CFrame * CFrame.new(0, -1.65 * s, -0.18 * s)); weld(leg, foot)

		local arm = mk("Arm", thin and V(0.3, 2.4, 0.3) or V(0.55, 2.4, 0.6), (look == "zombie" or look == "brute" or look == "witch") and skin or limb, thin and M.Marble or M.SmoothPlastic, torso.CFrame)
		local aimArm = side == 1 and not k.melee
		local shieldArm = side == -1 and k.ai == "shield"
		local pose = CFrame.new()
		if look == "zombie" or aimArm or shieldArm then pose = CFrame.Angles(math.rad(90), 0, 0)
		elseif not k.melee then pose = CFrame.Angles(math.rad(65), 0, math.rad(-30)) end
		local sh = motor("Shoulder" .. i, torso, arm, CFrame.new(side * (thin and 1.0 or 1.45) * s, 0.8 * s, 0) * pose, CFrame.new(0, 1.1 * s, 0))
		arm.CFrame = torso.CFrame * sh.C0 * sh.C1:Inverse()
		local tipAt
		if look == "skeleton" and aimArm then
			-- a bone bow held upright with a glowing nocked arrow
			local grip = arm.CFrame * CFrame.new(0, -1.3 * s, 0)
			for j = -1, 1 do
				local seg = mk("Bow", V(0.16, 1.2, 0.16), Color3.fromRGB(90, 60, 34), M.Wood, grip * CFrame.new(0, 0, j * 1.0 * s) * CFrame.Angles(math.rad(90 + j * 25), 0, 0) * CFrame.new(0, 0, j * -0.25 * s)); weld(arm, seg)
			end
			local str = mk("String", V(0.04, 0.04, 2.6), Color3.fromRGB(240, 240, 240), M.SmoothPlastic, grip * CFrame.new(0, 0.45 * s, 0)); weld(arm, str)
			tipAt = grip * CFrame.new(0, -0.3 * s, -0.1 * s)
		elseif look == "witch" and aimArm then
			local staff = mk("Staff", V(0.18, 4.2, 0.18), Color3.fromRGB(70, 44, 26), M.Wood, arm.CFrame * CFrame.new(0, -1.1 * s, 0) * CFrame.Angles(math.rad(-90), 0, 0)); weld(arm, staff)
			tipAt = arm.CFrame * CFrame.new(0, -1.1 * s, -2.2 * s)
		elseif look == "brute" and aimArm then
			local shovel = mk("Shovel", V(0.2, 3.4, 0.2), Color3.fromRGB(70, 50, 30), M.Wood, arm.CFrame * CFrame.new(0, -2.2 * s, 0)); weld(arm, shovel)
			local blade = mk("Blade", V(0.9, 1.0, 0.1), Color3.fromRGB(120, 120, 120), M.Metal, arm.CFrame * CFrame.new(0, -4.0 * s, 0)); weld(arm, blade)
			tipAt = arm.CFrame * CFrame.new(0, -4.2 * s, 0)
		elseif look == "keeper" and aimArm then
			local lamp = mk("Censer", V(0.5, 0.6, 0.5), Color3.fromRGB(60, 50, 40), M.Metal, arm.CFrame * CFrame.new(0, -1.5 * s, 0)); weld(arm, lamp)
			tipAt = arm.CFrame * CFrame.new(0, -1.9 * s, 0)
		elseif shieldArm then
			-- a coffin lid as a shield: blocks frontal fire like the Bulwark's energy shield
			local lid = mk("Shield", V(2.4, 4.2, 0.3), Color3.fromRGB(84, 52, 30), M.WoodPlanks, torso.CFrame * CFrame.new(-0.3 * s, -0.8 * s, -1.6 * s)); weld(torso, lid)
			local crossV = mk("Cross", V(0.25, 2.2, 0.1), Color3.fromRGB(200, 170, 90), M.Metal, lid.CFrame * CFrame.new(0, 0.4 * s, -0.2 * s)); weld(lid, crossV)
			local crossH = mk("Cross", V(1.2, 0.25, 0.1), Color3.fromRGB(200, 170, 90), M.Metal, lid.CFrame * CFrame.new(0, 0.9 * s, -0.2 * s)); weld(lid, crossH)
		elseif look == "zombie" or look == "pumpkin" then
			local hand = mk("Hand", V(0.5, 0.5, 0.5), skin, M.SmoothPlastic, arm.CFrame * CFrame.new(0, -1.3 * s, 0)); weld(arm, hand)
		end
		if tipAt then
			local tip = mk("GunTip", V(0.4, 0.4, 0.4), k.glow, M.Neon, tipAt, Enum.PartType.Ball); weld(arm, tip)
			tip.Transparency = 0.6
		end
	end
	local hum, align = walkerRig(model, root, k, s)
	return model, root, hum, align, finishModel(model, kind, root)
end

-- bats and ghosts fly like drones
local function buildSpookFlyer(kind, pos)
	local k = Config.Enemies[kind]
	local model = Instance.new("Model")
	model.Name = k.name
	local mk = maker(model, 1)
	local base = CFrame.new(pos)
	local root
	if k.look == "bat" then
		root = mk("Body", V(1.6, 1.4, 1.8), k.color, M.Fabric, base, Enum.PartType.Ball)
		local head = mk("Head", V(1.0, 0.9, 0.9), k.color, M.Fabric, base * CFrame.new(0, 0.4, -0.9)); weld(root, head)
		for _, side in ipairs({ -1, 1 }) do
			local ear = mk("Ear", V(0.2, 0.6, 0.3), k.color, M.Fabric, head.CFrame * CFrame.new(side * 0.32, 0.6, 0)); weld(head, ear)
			local eye = mk("Eye", V(0.18, 0.18, 0.1), k.glow, M.Neon, head.CFrame * CFrame.new(side * 0.22, 0.1, -0.48)); weld(head, eye)
			local wing = mk("Wing", V(3.0, 0.1, 1.6), Color3.fromRGB(60, 30, 40), M.Fabric, base * CFrame.new(side * 2.0, 0.2, 0) * CFrame.Angles(0, 0, side * math.rad(-12))); weld(root, wing)
			local bone = mk("WingBone", V(3.0, 0.16, 0.16), Color3.fromRGB(30, 20, 26), M.SmoothPlastic, wing.CFrame * CFrame.new(0, 0.05, -0.75)); weld(wing, bone)
		end
	else
		root = mk("Body", V(2.2, 2.6, 2.2), k.color, M.Glass, base, Enum.PartType.Ball)
		root.Transparency = 0.35
		local skirt = mk("Sheet", V(2.4, 1.8, 2.4), k.color, M.Glass, base * CFrame.new(0, -1.6, 0)); weld(root, skirt)
		skirt.Transparency = 0.45
		for _, side in ipairs({ -1, 1 }) do
			local eye = mk("Eye", V(0.38, 0.55, 0.1), BLACK, M.SmoothPlastic, base * CFrame.new(side * 0.42, 0.3, -1.08)); weld(root, eye)
		end
		local mouth = mk("Eye", V(0.5, 0.35, 0.1), BLACK, M.SmoothPlastic, base * CFrame.new(0, -0.35, -1.08)); weld(root, mouth)
		local l = Instance.new("PointLight"); l.Color, l.Range, l.Brightness = k.glow, 14, 1.2; l.Parent = root
	end
	root.Massless = false
	local tip = mk("GunTip", V(0.45, 0.45, 0.45), k.glow, M.Neon, base * CFrame.new(0, -0.2, -1.2), Enum.PartType.Ball); weld(root, tip)
	tip.Transparency = 0.6
	local att = Instance.new("Attachment"); att.Parent = root
	local ap = Instance.new("AlignPosition")
	ap.Mode = Enum.PositionAlignmentMode.OneAttachment
	ap.Attachment0 = att
	ap.MaxForce = 1e6
	ap.MaxVelocity = k.speed
	ap.Responsiveness = 12
	ap.Position = pos
	ap.Parent = root
	local ao = Instance.new("AlignOrientation")
	ao.Mode = Enum.OrientationAlignmentMode.OneAttachment
	ao.Attachment0 = att
	ao.Responsiveness = 14
	ao.MaxTorque = 1e7
	ao.Parent = root
	return model, root, ap, ao, finishModel(model, kind, root)
end

function Enemies.spawn(kind: string, pos: Vector3, opts: any?)
	local k = Config.Enemies[kind]
	local sc = ctx.scale()
	local s = k.scale or 1
	local e = setmetatable({
		id = Enemies.nextId(), kind = kind, k = k, hpMax = k.hp * sc.hp, dmgMul = sc.dmg, speedMul = sc.speed,
		fireT = rand(1.2, 2.6), thinkT = rand(0, 0.2), los = false, strafe = rng:NextNumber() < 0.5 and 1 or -1,
		strafeT = rand(1, 3), stuckT = 0, meleeT = 0.8, burst = 0, burstT = 0, spawnT = 0.7, stunT = 0,
		waypoints = nil, wpi = 1, pathT = 0, flashT = 0, charged = false, dist = 999, fuse = nil, orbitA = rand(0, math.pi * 2),
	}, Enemy)
	e.ai = k.ai or kind
	if e.ai == "drone" then
		local p = pos + V(0, rand(12, 18), 0)
		local model, root, ap, ao, hl
		if k.look then model, root, ap, ao, hl = buildSpookFlyer(kind, p) else model, root, ap, ao, hl = buildDrone(p) end
		e.model, e.root, e.ap, e.align, e.hl = model, root, ap, ao, hl
		e.lastPos = p
		e.alt = rand(12, 18)
		ap.MaxVelocity = k.speed * e.speedMul
	else
		local p = pos + V(0, 3 * s * 1.35 + 1, 0)
		local model, root, hum, align, hl
		if k.look then model, root, hum, align, hl = buildSpook(kind, p) else model, root, hum, align, hl = buildWalker(kind, p) end
		e.model, e.root, e.hum, e.align, e.hl = model, root, hum, align, hl
		e.lastPos = p
		hum.WalkSpeed = k.speed * e.speedMul
	end
	if opts and opts.elite then e.hpMax *= 1.4 end
	e.hp = e.hpMax
	e.tip = e.model:FindFirstChild("GunTip", true)
	e.head = e.model:FindFirstChild("Head") or e.model:FindFirstChild("Core") or e.model:FindFirstChild("Eye")
	e.model.Parent = workspace.Enemies
	e.root:SetNetworkOwner(nil)
	Enemies.add(e)
	ctx.fx("warp", pos, kind)
	return e
end

local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Exclude
local function refreshFilter()
	rayParams.FilterDescendantsInstances = { workspace.Enemies, workspace.Projectiles, workspace.Debris, workspace.Pickups }
end

function Enemy:eye()
	return self.head and self.head.Position or self.root.Position
end

function Enemy:center()
	return self.root.Position + (self.hum and V(0, 1.4 * (self.k.scale or 1), 0) or Vector3.zero)
end

function Enemy:computePath(goal)
	if self.pathing then return end
	self.pathing = true
	task.spawn(function()
		local s = self.k.scale or 1
		local path = PathfindingService:CreatePath({ AgentRadius = 2.2 * s, AgentHeight = 7 * s, AgentCanJump = true, WaypointSpacing = 10 })
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
	local flat = V(tpos.X - rootPos.X, 0, tpos.Z - rootPos.Z)
	local dist = flat.Magnitude
	local dir = dist > 0.01 and flat / dist or Vector3.zAxis
	local eye = self:eye()
	local res = workspace:Raycast(eye, target.head.Position - eye, rayParams)
	self.los = (res == nil) or res.Instance:IsDescendantOf(target.char)
	self.dist = dist
	if not self.hum then return end

	local goal
	local k = self.k
	if k.melee then
		goal = tpos
	elseif self.ai == "shield" then
		-- presses forward behind its shield, stopping at close range
		goal = dist > k.pref[1] and tpos or rootPos + V(-dir.Z, 0, dir.X) * self.strafe * 8
	else
		self.strafeT -= 0.15
		if self.strafeT <= 0 then self.strafe = -self.strafe; self.strafeT = rand(1.2, 3) end
		if not self.los or dist > k.pref[2] then goal = tpos
		elseif dist < k.pref[1] then goal = rootPos - dir * 14
		else goal = rootPos + V(-dir.Z, 0, dir.X) * self.strafe * 14 end
	end

	-- follow a path when the target is out of sight or up on a raised floor (stairs), otherwise steer directly
	local elevated = tpos.Y - rootPos.Y > 4
	if elevated and k.melee then goal = tpos end
	if not self.los or elevated then
		self.pathT -= 0.15
		if self.pathT <= 0 then self.pathT = 1.4; self:computePath(tpos) end
	else
		self.waypoints = nil
	end
	if self.waypoints and self.waypoints[self.wpi] then
		local wp = self.waypoints[self.wpi]
		self.hum:MoveTo(wp.Position)
		if wp.Action == Enum.PathWaypointAction.Jump then self.hum.Jump = true end
		if (V(wp.Position.X, rootPos.Y, wp.Position.Z) - rootPos).Magnitude < 5 then self.wpi += 1 end
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
			self.unstickGoal = rootPos + V(math.cos(a), 0, math.sin(a)) * 18
			self.unstickT = os.clock() + 1.2
		end
	else
		self.stuckT = 0
	end
end

function Enemy:resetTip()
	self.charged = false
	if self.tip then
		self.tip.Transparency = 0.6
		self.tip.Size = V(0.4, 0.4, 0.4) * (self.k.scale or 1) * (self.ai == "tank" and 2 or 1)
	end
end

function Enemy:aimAt(target, lead, accMul)
	local origin = self.tip and self.tip.Position or self:eye()
	local aim = target.root.Position + V(0, 1.2, 0)
	local dist = (aim - origin).Magnitude
	local vel = target.root.AssemblyLinearVelocity
	local speed = self.k.boltSpeed or 300
	aim += vel * (dist / speed) * (lead or 0.6)
	local inacc = (self.k.acc or 0.03) * (1 + vel.Magnitude * 0.02) * dist * (accMul or 1)
	aim += V(rand(-1, 1) * inacc, rand(-1, 1) * inacc * 0.6, rand(-1, 1) * inacc)
	return origin, (aim - origin).Unit
end

function Enemy:fire(target)
	if not target.root.Parent then return end
	local k = self.k
	if self.ai == "tank" then
		local origin, dir = self:aimAt(target, 0.4)
		ctx.orb(origin, dir, k.boltSpeed, k.dmg * self.dmgMul, 10, k.event and Color3.fromRGB(110, 120, 90) or k.glow)
	elseif self.ai == "sniper" then
		local origin, dir = self:aimAt(target, 0.15, 0.25)
		ctx.bolt(origin, dir, 700, k.dmg * self.dmgMul, k.bolt or "snipe")
	else
		local origin, dir = self:aimAt(target)
		ctx.bolt(origin, dir, k.boltSpeed, k.dmg * self.dmgMul, k.bolt or (self.ai == "drone" and "drone" or "bolt"))
	end
end

function Enemy:face(look)
	local rootPos = self.root.Position
	if look and (look - rootPos).Magnitude > 0.1 then self.align.CFrame = CFrame.lookAt(rootPos, look).Rotation end
end

function Enemy:detonate(owner, weapon)
	if self.blown then return end
	self.blown = true
	local pos = self:center()
	if owner then
		ctx.explosion(pos, 22, 120, owner, { source = "explosion", weapon = weapon or "explosion", selfDamage = 0.35 })
	else
		ctx.explosion(pos, 22, self.k.dmg * self.dmgMul * 2, nil, { source = "enemy", enemyDamage = 0.5 })
	end
end

function Enemy:update(dt, target)
	if self.spawnT > 0 then
		self.spawnT -= dt
		if self.hum then self.hum:Move(Vector3.zero) end
		return
	end
	if self.flashT > 0 then
		self.flashT -= dt
		if self.flashT <= 0 then self.hl.Enabled = false end
	end
	if self.stunT > 0 then
		self.stunT -= dt
		if self.hum then self.hum:Move(Vector3.zero); self.hum.WalkSpeed = 0 end
		if self.ap then self.ap.Position = self.root.Position - V(0, 3 * dt, 0) end
		if self.stunT <= 0 then
			self.hl.Enabled = false
			if self.hum then self.hum.WalkSpeed = self.k.speed * self.speedMul end
		end
		if self.charged then self:resetTip() end
		return
	end
	self.thinkT -= dt
	if self.thinkT <= 0 then
		self.thinkT = 0.15
		self:think(target)
	end
	local rootPos = self.root.Position
	local tpos = target.root.Position
	local k = self.k

	if self.ai == "drone" then
		-- orbit the target at range, bobbing, and dive closer when it has no line of sight
		self.orbitA += dt * 0.6 * self.strafe
		local r = self.los and 36 or 16
		local want = tpos + V(math.cos(self.orbitA) * r, self.alt + math.sin(os.clock() * 2 + self.id) * 2, math.sin(self.orbitA) * r)
		local ceiling = ctx.ceiling and ctx.ceiling() or math.huge
		want = V(want.X, math.min(want.Y, ceiling - 4), want.Z)
		self.ap.Position = want
		self:face(V(tpos.X, rootPos.Y, tpos.Z))
	else
		local look
		if self.los or self.dist < 40 or self.ai == "shield" then
			look = V(tpos.X, rootPos.Y, tpos.Z)
		else
			local v = self.root.AssemblyLinearVelocity
			if V(v.X, 0, v.Z).Magnitude > 2 then look = rootPos + V(v.X, 0, v.Z) end
		end
		self:face(look)
	end

	if k.melee then
		local d = (tpos - rootPos).Magnitude
		if self.ai == "exploder" then
			if self.fuse then
				self.fuse -= dt
				if self.fuse <= 0 then
					self.hp = 0
					self:die({ dir = Vector3.yAxis, source = "self" })
				end
			elseif d < 9 * (k.scale or 1) then
				self.fuse = 0.55
				self.hum.WalkSpeed = k.speed * self.speedMul * 0.4
				ctx.fx("fuse", self.model)
			end
			return
		end
		self.meleeT -= dt
		if self.meleeT <= 0 and d < 8 * (k.scale or 1) then
			self.meleeT = 0.9
			ctx.fx("slash", rootPos, self.model)
			ctx.damagePlayer(target.player, k.dmg * self.dmgMul, rootPos, "melee")
		end
		return
	end

	if self.burst > 0 then
		self.burstT -= dt
		if self.burstT <= 0 then self:fire(target); self.burst -= 1; self.burstT = 0.16 end
	end
	local range = self.ai == "sniper" and 260 or 210
	if self.los and self.dist < range then
		self.fireT -= dt
		local win = self.ai == "sniper" and 1.1 or 0.45
		if self.fireT < win and self.tip then
			local c = 1 - math.max(self.fireT, 0) / win
			self.tip.Transparency = 0.6 - c * 0.6
			self.tip.Size = V(0.4, 0.4, 0.4) * (k.scale or 1) * (self.ai == "tank" and 2 or 1) * (1 + c * 1.3)
			if not self.charged then
				self.charged = true
				if self.ai == "sniper" then ctx.fx("snipeCharge", self.tip, target.player, win) else ctx.fx("charge", self.tip.Position) end
			end
		end
		if self.fireT <= 0 then
			if self.ai == "sniper" then self.fireT = rand(3.2, 4.4)
			else self.fireT = rand(k.rate[1], k.rate[2]) * (self.dist < 35 and 0.8 or 1) end
			self:resetTip()
			if self.ai == "grunt" and ctx.wave() >= 8 and rng:NextNumber() < 0.4 then self.burst = 3; self.burstT = 0 else self:fire(target) end
		end
	else
		self.fireT = math.max(self.fireT, self.ai == "sniper" and 1.3 or 0.7)
		if self.charged then
			self:resetTip()
			if self.ai == "sniper" then ctx.fx("snipeCancel", self.tip) end
		end
	end
end

-- info: { dir, owner, weapon, part, source }. Returns killed, damage dealt.
function Enemy:damage(amount: number, info)
	if self.hp <= 0 then return false, 0 end
	if info.part == "weak" and self.ai == "exploder" and info.owner then
		local dealt = self.hp
		self.hp = 0
		self:die(info)
		return true, dealt
	end
	local dealt = math.min(self.hp, amount)
	self.hp -= amount
	self.fireT += 0.08
	self.hl.FillColor = Color3.new(1, 1, 1)
	self.hl.Enabled = true
	self.flashT = 0.07
	if info.dir and self.hum then
		self.root.AssemblyLinearVelocity += V(info.dir.X, 0, info.dir.Z) * math.min(12, amount * 0.15) / (self.k.scale or 1)
	end
	if self.hp <= 0 then
		self:die(info)
		return true, dealt
	end
	return false, dealt
end

function Enemy:stun(t)
	if self.hp <= 0 then return end
	self.stunT = math.max(self.stunT, t)
	self.hl.FillColor = Color3.fromRGB(120, 200, 255)
	self.hl.Enabled = true
	self.flashT = t
	self.fuse = nil
end

function Enemy:die(info)
	if self.dead then return end
	self.dead = true
	Enemies.remove(self)
	local pos = self:center()
	local eye = self:eye()
	local dir = info.dir or Vector3.zAxis
	self.hl:Destroy()
	for _, d in ipairs(self.model:GetDescendants()) do
		if d:IsA("JointInstance") or d:IsA("WeldConstraint") or d:IsA("AlignOrientation") or d:IsA("AlignPosition") or d:IsA("Humanoid") then d:Destroy() end
	end
	self.model.Parent = workspace.Debris
	local popHead = info.part == "head" and (info.source == "bullet" or info.source == "plasma")
	for _, p in ipairs(self.model:GetDescendants()) do
		if p:IsA("BasePart") then
			if p.Material == Enum.Material.Neon or p.Material == Enum.Material.ForceField then p.Color = Color3.fromRGB(25, 25, 25); p.Material = Enum.Material.Metal end
			if p.Name == "GunTip" or p.Name == "Shield" then p.Transparency = 1 end
			p.CanCollide = p.Name ~= "HumanoidRootPart"
			p.CanQuery = false
			p.Massless = false
			p.Color = p.Color:Lerp(Color3.new(), 0.35)
			local up = (popHead and p.Name == "Head") and 90 or rand(18, 40)
			p.AssemblyLinearVelocity = dir * rand(20, 45) + V(rand(-12, 12), up, rand(-12, 12))
			p.AssemblyAngularVelocity = V(rand(-12, 12), rand(-12, 12), rand(-12, 12))
		end
	end
	Debris:AddItem(self.model, 6)
	ctx.fx("botDeath", eye, self.kind, popHead)
	if self.ai == "exploder" then self:detonate(info.source ~= "self" and info.owner or nil, info.weapon) end
	if self.ai == "tank" then ctx.explosion(pos, 16, 40, info.owner, { source = "explosion", weapon = info.weapon, selfDamage = 0.25 }) end
	ctx.onKill(self, info, pos)
end

function Enemies.update(dt, targets)
	refreshFilter()
	if #targets == 0 then
		for _, e in ipairs(list) do if e.hum then e.hum:Move(Vector3.zero) end end
		return
	end
	for _, e in ipairs(table.clone(list)) do
		if e.root.Parent == nil or e.root.Position.Y < -60 then
			e.hp = 0
			Enemies.remove(e)
			e.model:Destroy()
			if e.boss and e.onLost then e:onLost() end
		elseif e.hp > 0 then
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
	for _, e in ipairs(list) do e.dead = true; e.hp = 0; e.model:Destroy() end
	table.clear(list)
	table.clear(byModel)
end

return Enemies
