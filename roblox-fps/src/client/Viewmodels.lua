--!nonstrict
-- First-person weapon models built from parts. Laid out in meters (x right, y up, -z forward)
-- and scaled to studs. Each gun is rebuilt when its skin or attachments change; every frame the
-- client places each part relative to the camera.
-- The guns are modelled on real designs: Picatinny rails with teeth, trigger guards, iron sights,
-- ejection ports, muzzle devices, screws, magazines with rounds showing and gloved hands.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("FoundryShared")
local Config = require(Shared:WaitForChild("Config"))
local Stats = require(Shared:WaitForChild("Stats"))

local S = Config.METER
local Viewmodels = {}
local RGB = Color3.fromRGB
local M = Enum.Material

local FIXED = {
	glove = { RGB(26, 24, 22), M.Fabric },
	sleeve = { RGB(30, 34, 27), M.Fabric },
	dot = { RGB(255, 42, 26), M.Neon },
	lens = { RGB(58, 122, 176), M.Glass },
	glass = { RGB(154, 212, 255), M.Glass },
	laser = { RGB(255, 42, 26), M.Neon },
	cyan = { RGB(108, 246, 255), M.Neon },
	soul = { RGB(154, 255, 106), M.Neon },
	soulglass = { RGB(120, 255, 150), M.Glass },
	blood = { RGB(255, 36, 52), M.Neon },
	bone = { RGB(236, 228, 204), M.Marble },
	fang = { RGB(250, 250, 245), M.SmoothPlastic },
	-- shared hardware
	dark = { RGB(8, 9, 10), M.SmoothPlastic },
	steel = { RGB(154, 160, 166), M.Metal },
	blued = { RGB(35, 39, 45), M.Metal },
	knurl = { RGB(42, 45, 49), M.DiamondPlate },
	rubber = { RGB(21, 21, 21), M.Rubber },
	brass = { RGB(210, 164, 71), M.Foil },
	copper = { RGB(184, 104, 58), M.Foil },
	shell = { RGB(168, 22, 28), M.SmoothPlastic },
	smoke = { RGB(42, 38, 32), M.Glass },
	white = { RGB(216, 214, 208), M.SmoothPlastic },
	tritium = { RGB(125, 255, 106), M.Neon },
}
local TRANSPARENT = { lens = 0.7, soulglass = 0.7, glass = 0.86, smoke = 0.45 }

local function materials(skin)
	local s = Config.Skins[skin] or Config.Skins.stock
	return {
		metal = { s.metal, s.metalMat or (s.shiny and M.Foil or M.Metal) },
		poly = { s.poly, s.polyMat or M.Plastic },
		alt = { s.alt, s.altMat or M.Plastic },
		accent = { s.accent, s.glow and M.Neon or M.SmoothPlastic },
	}
end

local function newGun(def, skin)
	local model = Instance.new("Model")
	model.Name = "VM_" .. def.id
	return { def = def, model = model, parts = {}, mats = materials(skin), nodes = {} }
end

-- parent: optional node returned by bx/cy/node; offsets are then relative to it
local function add(g, p, off, sub)
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = true, false, false, false, false
	p.TopSurface, p.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
	p.Parent = g.model
	local e = { p = p, off = off, sub = sub, size = p.Size }
	table.insert(g.parts, e)
	return e
end
local function look(g, mat)
	return g.mats[mat] or FIXED[mat]
end
local function paint(p, g, mat)
	local m = look(g, mat)
	p.Color, p.Material = m[1], m[2]
	if TRANSPARENT[mat] then p.Transparency = TRANSPARENT[mat] end
end
local function place(opts, x, y, z, extra)
	local off = CFrame.new(x * S, y * S, z * S) * (opts.rot or CFrame.identity) * (extra or CFrame.identity)
	if opts.parent then off = opts.parent.off * off end
	return off, opts.sub or (opts.parent and opts.parent.sub)
end
local function bx(g, w, h, d, mat, x, y, z, opts)
	opts = opts or {}
	local p = Instance.new("Part")
	p.Size = Vector3.new(math.max(w * S, 0.01), math.max(h * S, 0.01), math.max(d * S, 0.01))
	paint(p, g, mat)
	local off, sub = place(opts, x, y, z)
	return add(g, p, off, sub)
end
-- cylinder along the barrel axis (z)
local function cy(g, r, len, mat, x, y, z, opts)
	opts = opts or {}
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Cylinder
	p.Size = Vector3.new(math.max(len * S, 0.01), math.max(r * 2 * S, 0.01), math.max(r * 2 * S, 0.01))
	paint(p, g, mat)
	local off, sub = place(opts, x, y, z, CFrame.Angles(0, math.pi / 2, 0))
	return add(g, p, off, sub)
end
-- cylinder across the gun (pins, cross-bolts, windage turrets)
local function cyX(g, r, len, mat, x, y, z, opts)
	opts = opts or {}
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Cylinder
	p.Size = Vector3.new(math.max(len * S, 0.01), math.max(r * 2 * S, 0.01), math.max(r * 2 * S, 0.01))
	paint(p, g, mat)
	local off, sub = place(opts, x, y, z)
	return add(g, p, off, sub)
end
-- upright cylinder (turrets, shotgun shells)
local function cyY(g, r, len, mat, x, y, z, opts)
	opts = opts or {}
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Cylinder
	p.Size = Vector3.new(math.max(len * S, 0.01), math.max(r * 2 * S, 0.01), math.max(r * 2 * S, 0.01))
	paint(p, g, mat)
	local off, sub = place(opts, x, y, z, CFrame.Angles(0, 0, math.pi / 2))
	return add(g, p, off, sub)
end
local function ball(g, r, mat, x, y, z, opts)
	opts = opts or {}
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Ball
	p.Size = Vector3.new(r * 2 * S, r * 2 * S, r * 2 * S)
	paint(p, g, mat)
	local off, sub = place(opts, x, y, z)
	return add(g, p, off, sub)
end
local function ring(g, r, mat, x, y, z)
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Cylinder
	p.Size = Vector3.new(0.012 * S, r * 2 * S, r * 2 * S)
	paint(p, g, mat)
	p.Transparency = 0.2
	return add(g, p, CFrame.new(x * S, y * S, z * S) * CFrame.Angles(0, math.pi / 2, 0))
end
-- a frame other parts hang off: moves with `sub` and can be tilted by rx
local function node(x, y, z, rx, sub, parent)
	local off = CFrame.new(x * S, y * S, z * S) * CFrame.Angles(rx or 0, 0, 0)
	if parent then off = parent.off * off end
	return { off = off, sub = sub or (parent and parent.sub) }
end
local function rot(rx, ry, rz) return CFrame.Angles(rx or 0, ry or 0, rz or 0) end

---------------------------------------------------------------- details
-- Picatinny rail: base strip with teeth every 2 cm. y is the bottom; the top sits 8 mm higher.
local function rail(g, mat, len, x, y, z, w, opts)
	w = w or 0.021
	bx(g, w, 0.005, len, mat, x, y + 0.0025, z, opts)
	local n = math.max(2, math.floor(len / 0.02))
	local step = (len - 0.006) / (n - 1)
	for i = 0, n - 1 do bx(g, w + 0.002, 0.0032, 0.006, mat, x, y + 0.0064, z - len / 2 + 0.003 + i * step, opts) end
end
-- trigger guard under a receiver whose underside is at y, with the trigger at z
local function trigger(g, y, z, len, opts)
	len = len or 0.07
	bx(g, 0.011, 0.005, len, "poly", 0, y - 0.036, z + 0.005, opts)
	bx(g, 0.011, 0.034, 0.006, "poly", 0, y - 0.019, z - len / 2 + 0.008, opts)
	for i = 0, 4 do
		bx(g, 0.0055, 0.0085, 0.0045, "blued", 0, y - 0.007 - i * 0.0052, z + 0.002 - (i ^ 1.5) * 0.0022, { parent = opts and opts.parent, rot = rot(-0.2 - i * 0.16) })
	end
end
local function screw(g, x, y, z, r, opts)
	r = r or 0.0032
	cyX(g, r, 0.002, "blued", x, y, z, opts)
	bx(g, 0.0012, r * 1.6, 0.0008, "dark", x + (x < 0 and -0.0008 or 0.0008), y, z, opts)
end
local function grooves(g, n, w, h, d, x, y, z0, dz, opts)
	for i = 0, n - 1 do bx(g, w, h, d, "dark", x, y, z0 + i * dz, opts) end
end
-- iron sights: protected front post and rear aperture; `top` is the sight-line height
local function frontPost(g, mat, top, z, baseY)
	local h = top - baseY
	bx(g, 0.018, 0.006, 0.016, mat, 0, baseY + 0.003, z)
	for _, s in ipairs({ -1, 1 }) do bx(g, 0.003, h + 0.002, 0.009, mat, s * 0.008, baseY + h / 2 + 0.002, z) end
	bx(g, 0.0022, h - 0.004, 0.0022, mat, 0, baseY + 0.004 + (h - 0.004) / 2, z)
end
local function rearAperture(g, mat, top, z, baseY)
	bx(g, 0.022, 0.007, 0.018, mat, 0, baseY + 0.0035, z)
	for _, s in ipairs({ -1, 1 }) do bx(g, 0.0035, top - baseY + 0.004, 0.01, mat, s * 0.0085, (top + baseY) / 2 + 0.002, z) end
	-- the aperture: a square ring of four bars around the sight line
	bx(g, 0.009, 0.0016, 0.003, mat, 0, top + 0.0038, z); bx(g, 0.009, 0.0016, 0.003, mat, 0, top - 0.0038, z)
	bx(g, 0.0016, 0.009, 0.003, mat, -0.0038, top, z); bx(g, 0.0016, 0.009, 0.003, mat, 0.0038, top, z)
	bx(g, 0.004, top - baseY - 0.008, 0.004, mat, 0, (top + baseY) / 2 - 0.004, z)
end
local function cartridge(g, x, y, z, s, opts)
	s = s or 1
	cy(g, 0.0045 * s, 0.03 * s, "brass", x, y, z, opts)
	cy(g, 0.0028 * s, 0.014 * s, "copper", x, y, z - 0.021 * s, opts)
end
local function flashHider(g, mat, r, len, y, z)
	cy(g, r, len, mat, 0, y, z + len / 2)
	for i = 0, 2 do bx(g, r * 2.15, r * 0.36, len * 0.7, "dark", 0, y, z + len * 0.42, { rot = rot(0, 0, i * math.pi / 3) }) end
	cy(g, r * 0.5, 0.002, "dark", 0, y, z - 0.0005)
end
local function muzzleBrake(g, mat, r, len, y, z, ports)
	cy(g, r, len, mat, 0, y, z + len / 2)
	for i = 0, (ports or 3) - 1 do bx(g, r * 2.3, r * 0.55, len / 7, "dark", 0, y, z + len - (i * 2 + 1.5) * len / 7) end
	cy(g, r * 0.45, 0.002, "dark", 0, y, z - 0.0005)
end

-- gloved hands: palm, four curled fingers, thumb, cuff and sleeve
local function hand(g, x, y, z, ry, rx, sleeveLen)
	local n = { off = CFrame.new(x * S, y * S, z * S) * CFrame.Angles(rx, ry, 0) }
	bx(g, 0.05, 0.075, 0.07, "glove", 0.012, 0, 0.012, { parent = n })
	for i = 0, 3 do bx(g, 0.016, 0.017, 0.042, "glove", -0.019, 0.028 - i * 0.019, -0.006, { parent = n }) end
	bx(g, 0.016, 0.044, 0.016, "glove", 0.024, 0.03, -0.012, { parent = n, rot = rot(0.3, 0, -0.25) })
	bx(g, 0.06, 0.05, 0.03, "glove", 0.012, -0.04, 0.05, { parent = n })
	bx(g, 0.075, 0.075, sleeveLen, "sleeve", 0.02, -0.07, 0.05 + sleeveLen / 2, { parent = n, rot = rot(0.35) })
end
local function arms(g, gripZ, foreZ, foreY)
	if g.noArms then return end
	hand(g, 0.012, -0.065, gripZ, 0.2, 0.15, 0.3)
	if foreZ then hand(g, -0.008, foreY - 0.045, foreZ, -0.5, 0.05, 0.36) end
end

local function muzzle(g, y, z)
	local p = Instance.new("Part")
	p.Size = Vector3.new(0.05, 0.05, 0.05)
	p.Transparency = 1
	g.muzzleEntry = add(g, p, CFrame.new(0, y * S, z * S))
	local att = Instance.new("Attachment")
	att.Parent = p
	local def = g.def
	local tint = def.flashColor or RGB(255, 230, 170)
	local flash = Instance.new("ParticleEmitter")
	flash.Texture = Config.Textures.Spark
	flash.LightEmission = 1
	flash.LightInfluence = 0
	flash.Color = ColorSequence.new(tint, def.flashColor or RGB(255, 120, 30))
	local size = def.flashSize * (g.silenced and 0.4 or 1)
	flash.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, size), NumberSequenceKeypoint.new(1, size * 0.4) })
	flash.Transparency = NumberSequence.new(0)
	flash.Lifetime = NumberRange.new(0.05)
	flash.Speed = NumberRange.new(0)
	flash.Rotation = NumberRange.new(0, 360)
	flash.LockedToPart = true
	flash.Enabled = false
	flash.ZOffset = 1
	flash.Parent = att
	local core = flash:Clone()
	core.Texture = Config.Textures.Fire
	core.Size = NumberSequence.new(size * 0.7)
	core.Parent = att
	local light = Instance.new("PointLight")
	light.Color = def.flashColor or RGB(255, 170, 90)
	light.Range = g.silenced and 6 or 14
	light.Brightness = g.silenced and 1.5 or 4
	light.Enabled = false
	light.Parent = p
	g.muzzle, g.flash, g.flashCore, g.light = p, flash, core, light
end

-- shared attachment points, hands, and the parts hidden while aiming
local function finish(g, o, on)
	g.o = o
	if on.reddot then
		-- reflex sight: clamp mount, open hood, tinted glass, glowing dot, turrets and battery cap
		local rd = { off = CFrame.new(0, o.rail[2] * S, o.rail[3] * S) }
		bx(g, 0.03, 0.006, 0.05, "metal", 0, 0.003, 0, { parent = rd })
		bx(g, 0.006, 0.006, 0.04, "blued", 0.017, 0.002, 0, { parent = rd })
		for _, s in ipairs({ -1, 1 }) do bx(g, 0.0045, 0.036, 0.016, "metal", s * 0.0185, 0.022, -0.016, { parent = rd }) end
		bx(g, 0.041, 0.005, 0.016, "metal", 0, 0.0405, -0.016, { parent = rd })
		bx(g, 0.03, 0.01, 0.022, "metal", 0, 0.011, 0.012, { parent = rd })
		cyY(g, 0.004, 0.006, "knurl", 0, 0.018, 0.014, { parent = rd })
		bx(g, 0.004, 0.006, 0.008, "accent", -0.017, 0.011, 0.014, { parent = rd })
		bx(g, 0.031, 0.03, 0.001, "glass", 0, 0.022, -0.02, { parent = rd })
		bx(g, 0.0045, 0.0045, 0.001, "dot", 0, 0.022, -0.0215, { parent = rd })
	end
	local mz = o.muzzleZ
	if on.silencer then
		cy(g, 0.016, 0.01, "poly", 0, o.muzzleY, mz - 0.005)
		cy(g, 0.022, 0.15, "poly", 0, o.muzzleY, mz - 0.085)
		cy(g, 0.0225, 0.02, "knurl", 0, o.muzzleY, mz - 0.03)
		cy(g, 0.019, 0.01, "poly", 0, o.muzzleY, mz - 0.165)
		mz -= 0.17
	end
	if on.grip then
		bx(g, 0.028, 0.008, 0.05, "metal", 0, o.underY - 0.001, o.underZ)
		bx(g, 0.027, 0.075, 0.032, "poly", 0, o.underY - 0.042, o.underZ)
		for i = 0, 2 do bx(g, 0.0275, 0.006, 0.006, "poly", 0, o.underY - 0.022 - i * 0.017, o.underZ - 0.017) end
		bx(g, 0.03, 0.006, 0.035, "accent", 0, o.underY - 0.081, o.underZ)
	end
	if on.laser then
		bx(g, 0.02, 0.024, 0.062, "metal", 0.034, o.underY + 0.02, o.underZ - 0.03)
		cy(g, 0.005, 0.004, "steel", 0.034, o.underY + 0.024, o.underZ - 0.062)
		bx(g, 0.004, 0.008, 0.012, "accent", 0.045, o.underY + 0.022, o.underZ - 0.018)
		g.laserEntry = bx(g, 0.008, 0.008, 0.004, "laser", 0.034, o.underY + 0.024, o.underZ - 0.065)
	end
	muzzle(g, o.muzzleY, mz)
	local first = #g.parts
	arms(g, o.gripZ, o.foreZ, o.foreY)
	g.hip = o.hip * S
	g.ads = Vector3.new(0, -(on.reddot and o.rail[2] + 0.022 or o.sightY), o.adsZ) * S
	if g.mag and on.extmag then
		-- a tube magazine is a cylinder, whose length runs along X
		g.mag.p.Size = g.tube and Vector3.new(g.mag.size.X * 1.18, g.mag.size.Y, g.mag.size.Z) or Vector3.new(g.mag.size.X, g.mag.size.Y * 1.45, g.mag.size.Z)
		if not g.tube then g.mag.off *= CFrame.new(0, -g.mag.size.Y * 0.225, 0) end
	end
	-- anything within 12 cm of the aiming eye (stock, buttpad) sits under the cheek: hidden while aimed
	g.rear = {}
	local eyeZ = (-o.adsZ - 0.12) * S
	if eyeZ < 0.3 * S then
		for i = 1, first do
			local e = g.parts[i]
			if not e.sub and e.off.Position.Z - e.size.Magnitude * 0.25 > eyeZ then table.insert(g.rear, e) end
		end
	end
end

local V3 = Vector3.new
local B = {}

-- Warden P9: polymer-frame striker pistol
function B.pistol(g)
	local sl = node(0, 0.018, -0.03, 0, "slide")
	bx(g, 0.029, 0.03, 0.19, "metal", 0, 0, 0, { parent = sl })
	bx(g, 0.019, 0.005, 0.17, "metal", 0, 0.0145, 0, { parent = sl })
	grooves(g, 6, 0.0298, 0.022, 0.0018, 0, -0.001, 0.06, 0.005, { parent = sl })
	grooves(g, 4, 0.0298, 0.018, 0.0018, 0, -0.002, -0.084, 0.005, { parent = sl })
	bx(g, 0.013, 0.004, 0.044, "dark", 0.003, 0.0158, -0.008, { parent = sl })
	bx(g, 0.0105, 0.004, 0.036, "steel", 0.003, 0.0165, -0.009, { parent = sl })
	bx(g, 0.0035, 0.007, 0.006, "metal", 0, 0.0195, -0.085, { parent = sl })
	bx(g, 0.002, 0.002, 0.001, "tritium", 0, 0.021, -0.0818, { parent = sl })
	for _, s in ipairs({ -1, 1 }) do
		bx(g, 0.008, 0.008, 0.007, "metal", s * 0.0058, 0.019, 0.082, { parent = sl })
		bx(g, 0.002, 0.002, 0.001, "tritium", s * 0.0058, 0.0205, 0.0785, { parent = sl })
	end
	cy(g, 0.0062, 0.004, "steel", 0, -0.003, -0.096, { parent = sl })
	cy(g, 0.0045, 0.002, "dark", 0, -0.003, -0.0985, { parent = sl })
	bx(g, 0.004, 0.006, 0.01, "accent", -0.0146, 0.004, 0.07, { parent = sl })
	bx(g, 0.027, 0.018, 0.13, "poly", 0, -0.006, -0.062)
	bx(g, 0.027, 0.018, 0.07, "poly", 0, -0.006, 0.035)
	rail(g, "poly", 0.045, 0, -0.023, -0.09, 0.02)
	trigger(g, -0.015, -0.012, 0.062)
	local gr = node(0, -0.068, 0.047, -0.22)
	bx(g, 0.029, 0.1, 0.047, "poly", 0, 0, 0, { parent = gr })
	for i = 0, 2 do bx(g, 0.0292, 0.007, 0.007, "poly", 0, 0.026 - i * 0.022, -0.024, { parent = gr }) end
	bx(g, 0.026, 0.012, 0.022, "poly", 0, 0.052, 0.024, { parent = gr })
	bx(g, 0.0296, 0.012, 0.016, "accent", 0, 0.012, 0.006, { parent = gr })
	bx(g, 0.003, 0.004, 0.024, "metal", -0.0145, 0.002, -0.012)
	bx(g, 0.003, 0.0035, 0.009, "metal", -0.0145, -0.005, -0.05)
	bx(g, 0.004, 0.009, 0.009, "metal", -0.0148, -0.013, 0.013)
	screw(g, -0.0137, -0.009, 0.026, 0.0022); screw(g, -0.0137, -0.009, -0.004, 0.0022)
	local mg = node(0, -0.125, 0.052, -0.22, "mag")
	bx(g, 0.024, 0.05, 0.04, "metal", 0, 0.025, 0, { parent = mg })
	g.mag = bx(g, 0.031, 0.012, 0.05, "poly", 0, -0.004, 0, { parent = mg })
	bx(g, 0.032, 0.003, 0.051, "accent", 0, -0.0105, 0, { parent = mg })
	return { sightY = 0.041, rail = { 0, 0.036, 0.0 }, muzzleY = 0.02, muzzleZ = -0.135, underY = -0.03, underZ = -0.08, gripZ = 0.05, foreZ = 0.02, foreY = -0.04, hip = V3(0.15, -0.15, -0.4), adsZ = -0.46 }
end

-- Wasp MX: roller-delayed submachine gun with a collapsing stock
function B.smg(g)
	bx(g, 0.044, 0.056, 0.27, "metal", 0, 0, -0.045)
	bx(g, 0.0455, 0.006, 0.25, "metal", 0, -0.012, -0.045)
	rail(g, "metal", 0.11, 0, 0.032, -0.03, 0.02)
	cy(g, 0.011, 0.18, "metal", 0, 0.022, -0.18)
	rearAperture(g, "metal", 0.047, 0.07, 0.028)
	frontPost(g, "metal", 0.047, -0.255, 0.033)
	bx(g, 0.022, 0.004, 0.006, "metal", 0, 0.056, -0.255)
	bx(g, 0.05, 0.048, 0.13, "poly", 0, -0.01, -0.235)
	grooves(g, 4, 0.0506, 0.006, 0.022, 0, -0.008, -0.285, 0.03)
	cy(g, 0.0085, 0.06, "metal", 0, 0.004, -0.325)
	cy(g, 0.011, 0.03, "metal", 0, 0.004, -0.355)
	for i = 0, 2 do bx(g, 0.005, 0.004, 0.012, "metal", 0, 0.004, -0.352, { rot = rot(0, 0, i * 2.094) * CFrame.new(0, 0.012 * S, 0) }) end
	cy(g, 0.0045, 0.002, "dark", 0, 0.004, -0.3705)
	bx(g, 0.024, 0.006, 0.007, "metal", -0.02, 0.022, -0.205, { rot = rot(0, 0.5, 0) })
	bx(g, 0.011, 0.011, 0.011, "poly", -0.031, 0.022, -0.2)
	bx(g, 0.03, 0.03, 0.046, "metal", 0, -0.04, -0.08)
	bx(g, 0.002, 0.016, 0.04, "dark", 0.0225, 0.008, -0.04)
	local mg = node(0, -0.12, -0.08, 0, "mag")
	g.mag = bx(g, 0.024, 0.1, 0.036, "poly", 0, 0.035, 0, { parent = mg })
	bx(g, 0.024, 0.09, 0.036, "poly", 0, -0.052, 0.013, { parent = mg, rot = rot(0.28) })
	grooves(g, 2, 0.0246, 0.07, 0.003, 0, 0.03, -0.006, 0.012, { parent = mg })
	bx(g, 0.028, 0.008, 0.042, "accent", 0, -0.097, 0.026, { parent = mg, rot = rot(0.28) })
	bx(g, 0.034, 0.03, 0.1, "poly", 0, -0.04, 0.03)
	trigger(g, -0.055, 0.008, 0.06)
	local gr = node(0, -0.1, 0.058, -0.25)
	bx(g, 0.032, 0.085, 0.042, "poly", 0, 0, 0, { parent = gr })
	for i = 0, 2 do bx(g, 0.0322, 0.006, 0.006, "poly", 0, 0.022 - i * 0.019, -0.021, { parent = gr }) end
	cyX(g, 0.0065, 0.004, "metal", -0.018, -0.035, 0.05)
	bx(g, 0.003, 0.016, 0.005, "metal", -0.0205, -0.03, 0.05, { rot = rot(0.6) })
	bx(g, 0.0012, 0.003, 0.003, "white", -0.0178, -0.026, 0.041); bx(g, 0.0012, 0.003, 0.003, "accent", -0.0178, -0.042, 0.04)
	screw(g, -0.0222, -0.012, 0.075); screw(g, -0.0222, -0.012, -0.16)
	for _, s in ipairs({ -1, 1 }) do cy(g, 0.006, 0.18, "metal", s * 0.017, -0.004, 0.17) end
	bx(g, 0.042, 0.042, 0.02, "metal", 0, -0.005, 0.085)
	bx(g, 0.046, 0.064, 0.012, "poly", 0, -0.015, 0.252)
	bx(g, 0.05, 0.068, 0.016, "rubber", 0, -0.015, 0.265)
	return { sightY = 0.047, rail = { 0, 0.04, -0.03 }, muzzleY = 0.004, muzzleZ = -0.37, underY = -0.02, underZ = -0.22, gripZ = 0.05, foreZ = -0.08, foreY = -0.2, hip = V3(0.15, -0.15, -0.42), adsZ = -0.24 }
end

-- Vanguard KR7: direct-impingement carbine with a free-float handguard
function B.rifle(g)
	bx(g, 0.05, 0.05, 0.26, "metal", 0, 0.015, -0.05)
	rail(g, "metal", 0.24, 0, 0.039, -0.05, 0.022)
	bx(g, 0.046, 0.04, 0.2, "metal", 0, -0.03, -0.04)
	bx(g, 0.044, 0.042, 0.075, "metal", 0, -0.064, -0.1)
	bx(g, 0.047, 0.006, 0.08, "metal", 0, -0.084, -0.1)
	bx(g, 0.002, 0.017, 0.046, "dark", 0.0252, 0.016, -0.02)
	bx(g, 0.0015, 0.011, 0.04, "steel", 0.0258, 0.016, -0.02)
	bx(g, 0.002, 0.013, 0.05, "metal", 0.03, -0.003, -0.02, { rot = rot(0, 0, 0.55) })
	bx(g, 0.008, 0.016, 0.014, "metal", 0.028, 0.028, 0.026)
	cy(g, 0.0065, 0.024, "metal", 0.029, 0.026, 0.055); cy(g, 0.008, 0.008, "knurl", 0.029, 0.026, 0.069)
	bx(g, 0.03, 0.008, 0.02, "metal", 0, 0.036, 0.09); bx(g, 0.044, 0.006, 0.008, "metal", 0, 0.036, 0.1)
	bx(g, 0.003, 0.016, 0.01, "metal", -0.0245, -0.026, -0.058)
	bx(g, 0.004, 0.009, 0.009, "metal", 0.0245, -0.04, -0.064)
	cyX(g, 0.0065, 0.003, "metal", -0.0245, -0.022, 0.03)
	bx(g, 0.003, 0.004, 0.02, "metal", -0.0262, -0.022, 0.024, { rot = rot(-0.4) })
	bx(g, 0.0012, 0.003, 0.003, "white", -0.0235, -0.012, 0.03); bx(g, 0.0012, 0.003, 0.003, "accent", -0.0235, -0.03, 0.038)
	screw(g, -0.0235, -0.03, 0.045, 0.003); screw(g, -0.0235, -0.03, -0.13, 0.003)
	-- handguard with M-LOK slots and a top rail
	bx(g, 0.054, 0.054, 0.3, "poly", 0, 0.008, -0.33)
	rail(g, "metal", 0.29, 0, 0.035, -0.33, 0.021)
	grooves(g, 5, 0.0545, 0.008, 0.03, 0, -0.004, -0.44, 0.052)
	bx(g, 0.0548, 0.003, 0.27, "accent", 0, 0.021, -0.33)
	bx(g, 0.06, 0.06, 0.012, "metal", 0, 0.008, -0.178)
	cy(g, 0.0085, 0.2, "metal", 0, 0.005, -0.57)
	flashHider(g, "metal", 0.011, 0.05, 0.005, -0.71)
	rearAperture(g, "metal", 0.062, 0.06, 0.047)
	frontPost(g, "metal", 0.062, -0.455, 0.043)
	trigger(g, -0.05, -0.022, 0.075)
	local gr = node(0, -0.085, 0.058, -0.3)
	bx(g, 0.034, 0.1, 0.044, "poly", 0, 0, 0, { parent = gr })
	bx(g, 0.0342, 0.012, 0.012, "poly", 0, 0.03, -0.024, { parent = gr })
	bx(g, 0.03, 0.012, 0.03, "poly", 0, 0.05, 0.022, { parent = gr })
	cy(g, 0.0155, 0.16, "metal", 0, 0.002, 0.16); cy(g, 0.017, 0.012, "knurl", 0, 0.002, 0.09)
	bx(g, 0.045, 0.062, 0.15, "poly", 0, -0.012, 0.245)
	bx(g, 0.046, 0.024, 0.11, "poly", 0, 0.024, 0.255)
	bx(g, 0.012, 0.009, 0.06, "poly", 0, -0.047, 0.2)
	bx(g, 0.048, 0.1, 0.022, "rubber", 0, -0.02, 0.33)
	grooves(g, 4, 0.0455, 0.04, 0.004, 0, -0.012, 0.205, 0.025)
	local mg = node(0, -0.1, -0.1, 0.18, "mag")
	g.mag = bx(g, 0.026, 0.09, 0.066, "poly", 0, 0.01, 0, { parent = mg })
	bx(g, 0.026, 0.08, 0.064, "poly", 0, -0.068, 0.012, { parent = mg, rot = rot(0.22) })
	for _, y in ipairs({ 0.03, -0.01, -0.05 }) do bx(g, 0.0266, 0.004, 0.05, "dark", 0, y, 0.004, { parent = mg }) end
	bx(g, 0.03, 0.012, 0.072, "accent", 0, -0.112, 0.022, { parent = mg, rot = rot(0.22) })
	cartridge(g, 0, 0.058, 0, 0.9, { parent = mg })
	return { sightY = 0.062, rail = { 0, 0.047, -0.08 }, muzzleY = 0.005, muzzleZ = -0.7, underY = -0.035, underZ = -0.38, gripZ = 0.06, foreZ = -0.3, foreY = -0.03, hip = V3(0.17, -0.18, -0.5), adsZ = -0.3 }
end

-- Triad B3: bullpup burst rifle with a clear magazine
function B.burst(g)
	bx(g, 0.064, 0.085, 0.42, "poly", 0, 0, 0.06)
	bx(g, 0.058, 0.062, 0.1, "poly", 0, 0.006, -0.19)
	bx(g, 0.0655, 0.003, 0.4, "accent", 0, -0.03, 0.06)
	bx(g, 0.03, 0.03, 0.34, "metal", 0, 0.056, -0.02)
	rail(g, "metal", 0.3, 0, 0.063, -0.02, 0.026)
	rearAperture(g, "metal", 0.086, 0.09, 0.071)
	frontPost(g, "metal", 0.086, -0.16, 0.071)
	cy(g, 0.012, 0.21, "metal", 0, 0.012, -0.32)
	cy(g, 0.019, 0.05, "metal", 0, 0.012, -0.245)
	for i = 0, 7 do bx(g, 0.005, 0.006, 0.046, "metal", 0, 0.012, -0.245, { rot = rot(0, 0, i * math.pi / 4) * CFrame.new(0, 0.02 * S, 0) }) end
	flashHider(g, "metal", 0.013, 0.045, 0.012, -0.47)
	bx(g, 0.03, 0.065, 0.012, "poly", 0, -0.072, -0.12)
	bx(g, 0.03, 0.012, 0.13, "poly", 0, -0.108, -0.06)
	local gr = node(0, -0.082, -0.05, -0.3)
	bx(g, 0.034, 0.1, 0.044, "poly", 0, 0, 0, { parent = gr })
	for i = 0, 2 do bx(g, 0.0342, 0.006, 0.006, "poly", 0, 0.025 - i * 0.02, -0.023, { parent = gr }) end
	for i = 0, 4 do bx(g, 0.0055, 0.0085, 0.0045, "blued", 0, -0.049 - i * 0.0052, -0.088 - (i ^ 1.5) * 0.0022, { rot = rot(-0.2 - i * 0.16) }) end
	cyX(g, 0.005, 0.07, "blued", 0, -0.042, -0.02)
	bx(g, 0.012, 0.01, 0.026, "metal", -0.02, 0.05, -0.12)
	bx(g, 0.002, 0.022, 0.05, "dark", 0.0325, 0.012, 0.13)
	screw(g, -0.0322, -0.012, 0.0, 0.0034); screw(g, -0.0322, -0.012, 0.2, 0.0034)
	bx(g, 0.066, 0.094, 0.022, "rubber", 0, -0.004, 0.278)
	bx(g, 0.04, 0.03, 0.12, "poly", 0, 0.044, 0.2)
	local mg = node(0, -0.1, 0.13, 0, "mag")
	g.mag = bx(g, 0.034, 0.12, 0.062, "smoke", 0, 0, 0, { parent = mg })
	for i = 0, 6 do cartridge(g, (i % 2 == 1) and 0.0055 or -0.0055, 0.05 - i * 0.012, 0.004, 0.85, { parent = mg }) end
	bx(g, 0.038, 0.012, 0.066, "metal", 0, -0.064, 0, { parent = mg })
	return { sightY = 0.086, rail = { 0, 0.071, -0.04 }, muzzleY = 0.012, muzzleZ = -0.47, underY = -0.045, underZ = -0.2, gripZ = -0.06, foreZ = -0.22, foreY = -0.04, hip = V3(0.16, -0.18, -0.46), adsZ = -0.26 }
end

-- Breaker 12: pump-action shotgun with a vent rib, wood furniture and a side saddle
function B.shotgun(g)
	bx(g, 0.05, 0.07, 0.2, "metal", 0, 0.004, -0.02)
	bx(g, 0.0505, 0.004, 0.18, "dark", 0, -0.012, -0.02)
	bx(g, 0.002, 0.024, 0.062, "dark", 0.0252, 0.012, -0.04)
	cyX(g, 0.0085, 0.012, "shell", 0.02, 0.012, -0.04); cyX(g, 0.0088, 0.004, "brass", 0.026, 0.012, -0.04)
	bx(g, 0.03, 0.002, 0.06, "dark", 0, -0.0312, -0.05)
	cy(g, 0.012, 0.605, "metal", 0, 0.018, -0.4125)
	bx(g, 0.009, 0.004, 0.58, "metal", 0, 0.038, -0.42)
	for i = 0, 13 do bx(g, 0.006, 0.006, 0.006, "metal", 0, 0.033, -0.15 - i * 0.04) end
	ball(g, 0.003, "accent", 0, 0.042, -0.7)
	ball(g, 0.0018, "white", 0, 0.0415, -0.4)
	cy(g, 0.0135, 0.014, "metal", 0, 0.018, -0.708)
	cy(g, 0.0095, 0.002, "dark", 0, 0.018, -0.7155)
	g.mag = cy(g, 0.013, 0.46, "metal", 0, -0.022, -0.36)
	g.tube = true
	cy(g, 0.0155, 0.024, "knurl", 0, -0.022, -0.607)
	bx(g, 0.018, 0.052, 0.014, "metal", 0, -0.002, -0.575)
	local pump = node(0, -0.022, -0.34, 0, "pump")
	bx(g, 0.056, 0.05, 0.17, "alt", 0, 0, 0, { parent = pump })
	grooves(g, 7, 0.0575, 0.034, 0.005, 0, 0, -0.06, 0.02, { parent = pump })
	for _, s in ipairs({ -1, 1 }) do bx(g, 0.003, 0.005, 0.2, "steel", s * 0.022, 0.008, 0.17, { parent = pump }) end
	local gr = node(0, -0.075, 0.1, -0.35)
	bx(g, 0.036, 0.09, 0.045, "alt", 0, 0, 0, { parent = gr })
	bx(g, 0.048, 0.07, 0.25, "alt", 0, -0.03, 0.22, { rot = rot(-0.06) })
	bx(g, 0.04, 0.05, 0.08, "alt", 0, -0.03, 0.115)
	bx(g, 0.051, 0.09, 0.003, "white", 0, -0.04, 0.336)
	bx(g, 0.05, 0.088, 0.022, "rubber", 0, -0.04, 0.349)
	trigger(g, -0.031, 0.04, 0.07)
	cyX(g, 0.005, 0.056, "blued", 0, -0.036, 0.066)
	screw(g, -0.0255, -0.015, 0.03, 0.0034); screw(g, -0.0255, -0.015, -0.09, 0.0034)
	bx(g, 0.004, 0.036, 0.11, "poly", -0.0275, 0.004, -0.02)
	for i = 0, 3 do
		local z = -0.06 + i * 0.026
		cyY(g, 0.0095, 0.046, "shell", -0.04, 0.008, z)
		cyY(g, 0.0098, 0.012, "brass", -0.04, -0.019, z)
	end
	bx(g, 0.003, 0.008, 0.11, "accent", -0.0505, 0.008, -0.02)
	return { sightY = 0.045, rail = { 0, 0.038, -0.02 }, muzzleY = 0.018, muzzleZ = -0.72, underY = -0.05, underZ = -0.46, gripZ = 0.1, foreZ = -0.34, foreY = -0.05, hip = V3(0.17, -0.18, -0.52), adsZ = -0.32 }
end

-- Anvil HX: belt-fed light machine gun with a folded bipod
function B.lmg(g)
	bx(g, 0.07, 0.08, 0.36, "metal", 0, 0, -0.02)
	bx(g, 0.0705, 0.006, 0.34, "dark", 0, -0.015, -0.02)
	bx(g, 0.07, 0.008, 0.18, "metal", 0, 0.043, 0.04)
	rail(g, "metal", 0.12, 0, 0.044, 0.04, 0.022)
	bx(g, 0.03, 0.01, 0.014, "accent", 0, 0.046, 0.13)
	rearAperture(g, "metal", 0.072, 0.135, 0.047)
	screw(g, -0.0355, 0.02, 0.0, 0.0036); screw(g, -0.0355, 0.02, 0.1, 0.0036); screw(g, -0.0355, -0.025, -0.12, 0.0036)
	bx(g, 0.02, 0.012, 0.012, "metal", 0.042, 0.0, -0.12)
	bx(g, 0.002, 0.012, 0.1, "dark", 0.0355, 0.0, -0.1)
	cy(g, 0.014, 0.42, "metal", 0, 0.005, -0.5)
	bx(g, 0.032, 0.006, 0.2, "poly", 0, 0.024, -0.36)
	grooves(g, 6, 0.012, 0.0065, 0.012, 0, 0.024, -0.44, 0.03)
	cy(g, 0.008, 0.36, "metal", 0, -0.024, -0.45)
	bx(g, 0.03, 0.05, 0.03, "metal", 0, -0.008, -0.6)
	bx(g, 0.012, 0.03, 0.012, "poly", -0.03, 0.02, -0.22); bx(g, 0.012, 0.012, 0.12, "poly", -0.03, 0.035, -0.27)
	bx(g, 0.012, 0.05, 0.015, "metal", 0, 0.04, -0.62)
	frontPost(g, "metal", 0.072, -0.62, 0.062)
	flashHider(g, "metal", 0.016, 0.09, 0.005, -0.8)
	bx(g, 0.06, 0.04, 0.14, "poly", 0, -0.035, -0.28)
	grooves(g, 4, 0.0605, 0.024, 0.006, 0, -0.035, -0.32, 0.026)
	for _, s in ipairs({ -1, 1 }) do
		bx(g, 0.008, 0.008, 0.22, "metal", s * 0.012, -0.04, -0.52)
		bx(g, 0.014, 0.012, 0.02, "rubber", s * 0.012, -0.04, -0.405)
	end
	bx(g, 0.034, 0.016, 0.03, "metal", 0, -0.03, -0.63)
	for i = 0, 4 do
		local y, x = -0.042 + i * 0.012, -0.04 - math.sin(i * 0.5) * 0.006
		cartridge(g, x, y, -0.04, 1.1)
		bx(g, 0.012, 0.004, 0.02, "blued", x, y - 0.006, -0.05)
	end
	trigger(g, -0.04, 0.07, 0.075)
	local gr = node(0, -0.085, 0.105, -0.3)
	bx(g, 0.038, 0.1, 0.045, "poly", 0, 0, 0, { parent = gr })
	for i = 0, 2 do bx(g, 0.0382, 0.006, 0.006, "poly", 0, 0.025 - i * 0.02, -0.024, { parent = gr }) end
	bx(g, 0.05, 0.08, 0.03, "poly", 0, -0.015, 0.175)
	bx(g, 0.05, 0.02, 0.24, "poly", 0, 0.012, 0.29)
	bx(g, 0.04, 0.018, 0.24, "poly", 0, -0.05, 0.28, { rot = rot(0.08) })
	cy(g, 0.012, 0.2, "metal", 0, -0.02, 0.29)
	bx(g, 0.052, 0.1, 0.022, "rubber", 0, -0.02, 0.41)
	local mg = node(-0.02, -0.1, -0.06, 0, "mag")
	g.mag = bx(g, 0.1, 0.11, 0.13, "poly", 0, 0, 0, { parent = mg })
	bx(g, 0.102, 0.02, 0.132, "accent", 0, 0.03, 0, { parent = mg })
	bx(g, 0.03, 0.05, 0.004, "metal", 0, -0.01, -0.066, { parent = mg })
	bx(g, 0.104, 0.008, 0.02, "rubber", 0, -0.01, 0.03, { parent = mg })
	return { sightY = 0.072, rail = { 0, 0.052, 0.04 }, muzzleY = 0.005, muzzleZ = -0.81, underY = -0.035, underZ = -0.36, gripZ = 0.1, foreZ = -0.34, foreY = -0.03, hip = V3(0.17, -0.2, -0.52), adsZ = -0.3 }
end

-- Longreach R2: bolt-action precision rifle on a chassis, fluted barrel, 5-25x scope
function B.sniper(g, on)
	cy(g, 0.022, 0.24, "metal", 0, 0.012, -0.02)
	cy(g, 0.016, 0.04, "metal", 0, 0.012, 0.12)
	rail(g, "metal", 0.34, 0, 0.027, -0.11, 0.022)
	bx(g, 0.002, 0.018, 0.06, "dark", 0.0215, 0.016, -0.02)
	cartridge(g, 0.012, 0.016, -0.02, 1.2)
	bx(g, 0.06, 0.06, 0.36, "poly", 0, -0.014, -0.36)
	grooves(g, 5, 0.0605, 0.01, 0.034, 0, -0.016, -0.48, 0.05)
	bx(g, 0.062, 0.05, 0.22, "poly", 0, -0.022, -0.03)
	bx(g, 0.055, 0.03, 0.3, "poly", 0, 0.01, 0.3)
	bx(g, 0.05, 0.03, 0.26, "poly", 0, -0.062, 0.29)
	bx(g, 0.05, 0.022, 0.12, "poly", 0, 0.036, 0.28)
	cyX(g, 0.008, 0.008, "accent", -0.028, 0.03, 0.24)
	bx(g, 0.0562, 0.004, 0.24, "accent", 0, -0.012, 0.3)
	bx(g, 0.052, 0.11, 0.02, "poly", 0, -0.025, 0.43)
	bx(g, 0.056, 0.12, 0.024, "rubber", 0, -0.025, 0.452)
	bx(g, 0.01, 0.04, 0.012, "metal", 0, -0.095, 0.4)
	screw(g, -0.031, -0.022, -0.08, 0.0034); screw(g, -0.031, -0.022, 0.04, 0.0034)
	cy(g, 0.015, 0.82, "metal", 0, 0.008, -0.55)
	for i = 0, 2 do bx(g, 0.0032, 0.0308, 0.42, "dark", 0, 0.008, -0.55, { rot = rot(0, 0, i * math.pi / 3) }) end
	muzzleBrake(g, "metal", 0.02, 0.075, 0.008, -1.02, 3)
	for _, s in ipairs({ -1, 1 }) do
		bx(g, 0.009, 0.009, 0.18, "metal", s * 0.014, -0.052, -0.56)
		bx(g, 0.014, 0.014, 0.016, "rubber", s * 0.014, -0.052, -0.46)
	end
	bx(g, 0.036, 0.018, 0.03, "metal", 0, -0.048, -0.66)
	trigger(g, -0.047, 0.06, 0.07)
	local gr = node(0, -0.088, 0.105, -0.25)
	bx(g, 0.036, 0.1, 0.046, "poly", 0, 0, 0, { parent = gr })
	bx(g, 0.0365, 0.03, 0.02, "poly", 0, 0, -0.02, { parent = gr })
	if not on.reddot then
		-- 5-25x scope: tube, objective bell, eyepiece, turrets and two rings
		cy(g, 0.0155, 0.22, "poly", 0, 0.085, -0.06)
		cy(g, 0.022, 0.035, "poly", 0, 0.085, -0.2)
		cy(g, 0.03, 0.06, "poly", 0, 0.085, -0.255)
		bx(g, 0.054, 0.054, 0.002, "lens", 0, 0.085, -0.287)
		cy(g, 0.019, 0.03, "poly", 0, 0.085, 0.07)
		cy(g, 0.022, 0.04, "poly", 0, 0.085, 0.1)
		cy(g, 0.0222, 0.016, "rubber", 0, 0.085, 0.112)
		bx(g, 0.036, 0.036, 0.05, "poly", 0, 0.085, -0.06)
		cyY(g, 0.012, 0.016, "knurl", 0, 0.111, -0.06); cyY(g, 0.01, 0.004, "accent", 0, 0.121, -0.06)
		cyX(g, 0.012, 0.016, "knurl", 0.026, 0.085, -0.06); cyX(g, 0.01, 0.006, "knurl", -0.024, 0.085, -0.06)
		for _, z in ipairs({ -0.13, 0.02 }) do
			cy(g, 0.0185, 0.014, "metal", 0, 0.085, z)
			bx(g, 0.026, 0.034, 0.016, "metal", 0, 0.052, z)
		end
	end
	bx(g, 0.06, 0.011, 0.011, "steel", 0.065, 0.02, 0.1, { sub = "bolt" })
	cy(g, 0.012, 0.022, "knurl", 0.097, 0.02, 0.102, { sub = "bolt" })
	local mg = node(0, -0.06, -0.05, 0, "mag")
	g.mag = bx(g, 0.036, 0.07, 0.085, "metal", 0, 0, 0, { parent = mg })
	bx(g, 0.04, 0.012, 0.09, "poly", 0, -0.036, 0, { parent = mg })
	g.boltPivot = CFrame.new(0.035 * S, 0.02 * S, 0.1 * S)
	return { sightY = 0.085, rail = { 0, 0.035, -0.26 }, muzzleY = 0.008, muzzleZ = -1.02, underY = -0.04, underZ = -0.42, gripZ = 0.1, foreZ = -0.36, foreY = -0.04, hip = V3(0.18, -0.18, -0.5), adsZ = -0.3 }
end

-- Helion PX: plasma rifle with heat-sink fins, an emitter crown and a glowing power cell
function B.plasma(g)
	bx(g, 0.07, 0.08, 0.42, "poly", 0, 0, -0.04)
	bx(g, 0.074, 0.03, 0.3, "accent", 0, 0.03, -0.06)
	bx(g, 0.03, 0.02, 0.16, "cyan", 0.036, 0.01, -0.06)
	grooves(g, 6, 0.0705, 0.004, 0.02, 0, -0.022, -0.2, 0.03)
	rail(g, "metal", 0.2, 0, 0.037, -0.02, 0.02)
	rearAperture(g, "metal", 0.07, 0.08, 0.045)
	frontPost(g, "metal", 0.07, -0.2, 0.045)
	cy(g, 0.018, 0.2, "metal", 0, 0.005, -0.35)
	for i = 0, 6 do bx(g, 0.05, 0.05, 0.003, "metal", 0, 0.005, -0.27 - i * 0.022) end
	g.coils = {}
	for i = 0, 2 do table.insert(g.coils, ring(g, 0.03, "cyan", 0, 0.005, -0.29 - i * 0.05)) end
	cy(g, 0.03, 0.03, "metal", 0, 0.005, -0.465)
	for i = 0, 2 do bx(g, 0.006, 0.006, 0.03, "metal", 0, 0.005, -0.5, { rot = rot(0, 0, i * 2.094) * CFrame.new(0, 0.024 * S, 0) }) end
	cy(g, 0.012, 0.002, "dark", 0, 0.005, -0.4815)
	local mg = node(0, -0.085, -0.12, 0, "mag")
	g.mag = bx(g, 0.045, 0.1, 0.07, "metal", 0, 0, 0, { parent = mg })
	bx(g, 0.047, 0.05, 0.03, "cyan", 0, -0.01, 0, { parent = mg })
	for i = 0, 3 do bx(g, 0.0475, 0.006, 0.006, i < 3 and "cyan" or "dark", 0, 0.03 - i * 0.01, 0.028, { parent = mg }) end
	for i = 0, 4 do cy(g, 0.006, 0.03, "rubber", -0.03, -0.04 + math.sin(i * 0.6) * 0.01, -0.05 + i * 0.022) end
	trigger(g, -0.04, -0.02, 0.07)
	local gr = node(0, -0.08, 0.06, -0.3)
	bx(g, 0.036, 0.1, 0.045, "poly", 0, 0, 0, { parent = gr })
	for i = 0, 2 do bx(g, 0.0362, 0.006, 0.006, "poly", 0, 0.025 - i * 0.02, -0.023, { parent = gr }) end
	bx(g, 0.05, 0.07, 0.2, "poly", 0, -0.01, 0.24)
	bx(g, 0.052, 0.075, 0.02, "rubber", 0, -0.012, 0.35)
	bx(g, 0.0505, 0.006, 0.16, "cyan", 0, 0.012, 0.24)
	screw(g, -0.0355, -0.02, 0.05, 0.0036); screw(g, -0.0355, -0.02, -0.15, 0.0036)
	return { sightY = 0.07, rail = { 0, 0.045, -0.02 }, muzzleY = 0.005, muzzleZ = -0.5, underY = -0.045, underZ = -0.3, gripZ = 0.06, foreZ = -0.26, foreY = -0.04, hip = V3(0.17, -0.18, -0.48), adsZ = -0.25 }
end

-- Reaper's Eye: bone-and-iron marksman rifle with a skull brake, a scythe blade and the Soulglass scope
function B.reaper(g)
	cy(g, 0.022, 0.26, "metal", 0, 0.012, -0.02)
	cy(g, 0.016, 0.04, "metal", 0, 0.012, 0.13)
	bx(g, 0.062, 0.058, 0.32, "poly", 0, -0.012, -0.34)
	for i = 0, 4 do bx(g, 0.064, 0.006, 0.02, "alt", 0, 0.012, -0.22 - i * 0.055) end
	bx(g, 0.064, 0.004, 0.28, "soul", 0, -0.012, -0.34)
	cy(g, 0.015, 0.46, "metal", 0, 0.008, -0.72)
	for i = 0, 2 do bx(g, 0.003, 0.0302, 0.3, "dark", 0, 0.008, -0.72, { rot = rot(0, 0, i * math.pi / 3) }) end
	-- skull muzzle brake with glowing sockets and teeth
	bx(g, 0.068, 0.072, 0.08, "bone", 0, 0.014, -1.03)
	bx(g, 0.044, 0.018, 0.04, "bone", 0, -0.016, -1.045)
	for i = -2, 2 do bx(g, 0.005, 0.008, 0.004, "white", i * 0.0065, -0.012, -1.066) end
	for _, s in ipairs({ -1, 1 }) do
		bx(g, 0.014, 0.012, 0.006, "dark", s * 0.013, 0.02, -1.068)
		bx(g, 0.008, 0.007, 0.003, "soul", s * 0.013, 0.02, -1.071)
	end
	-- scythe blade slung under the barrel
	for i = 0, 7 do bx(g, 0.006, 0.032 - i * 0.002, 0.06, "metal", 0, -0.05 - i * i * 0.003, -0.48 - i * 0.052, { rot = rot(-i * 0.11) }) end
	bx(g, 0.008, 0.012, 0.38, "accent", 0, -0.036, -0.62)
	-- Soulglass scope
	cy(g, 0.0165, 0.24, "poly", 0, 0.09, -0.07)
	cy(g, 0.032, 0.06, "metal", 0, 0.09, -0.26)
	bx(g, 0.056, 0.056, 0.002, "soul", 0, 0.09, -0.292)
	cy(g, 0.023, 0.05, "metal", 0, 0.09, 0.1)
	for i = 0, 2 do cy(g, 0.02, 0.008, "alt", 0, 0.09, -0.15 + i * 0.07) end
	cyY(g, 0.011, 0.016, "knurl", 0, 0.115, -0.07); cyX(g, 0.011, 0.016, "knurl", 0.027, 0.09, -0.07)
	for _, z in ipairs({ -0.18, 0.02 }) do bx(g, 0.024, 0.034, 0.014, "metal", 0, 0.056, z) end
	bx(g, 0.06, 0.011, 0.011, "steel", 0.065, 0.02, 0.1, { sub = "bolt" })
	ball(g, 0.016, "alt", 0.099, 0.02, 0.1, { sub = "bolt" })
	g.boltPivot = CFrame.new(0.035 * S, 0.02 * S, 0.1 * S)
	local mg = node(0, -0.06, -0.05, 0, "mag")
	g.mag = bx(g, 0.04, 0.07, 0.09, "poly", 0, 0, 0, { parent = mg })
	bx(g, 0.044, 0.01, 0.094, "alt", 0, -0.036, 0, { parent = mg })
	trigger(g, -0.04, 0.06, 0.07)
	local gr = node(0, -0.08, 0.1, -0.3)
	bx(g, 0.036, 0.1, 0.045, "alt", 0, 0, 0, { parent = gr })
	bx(g, 0.05, 0.085, 0.3, "alt", 0, -0.02, 0.31)
	for i = 0, 5 do bx(g, 0.056, 0.016, 0.02, "alt", 0, 0.03, 0.19 + i * 0.045) end
	bx(g, 0.052, 0.04, 0.2, "soul", 0, -0.02, 0.3)
	bx(g, 0.054, 0.1, 0.022, "rubber", 0, -0.022, 0.47)
	return { sightY = 0.09, rail = { 0, 0.04, -0.26 }, muzzleY = 0.012, muzzleZ = -1.07, underY = -0.04, underZ = -0.42, gripZ = 0.1, foreZ = -0.36, foreY = -0.04, hip = V3(0.18, -0.18, -0.5), adsZ = -0.3 }
end

-- Vampire's Fang: blood-red semi-auto shotgun with fangs at the muzzle and the Bloodglass holo sight
function B.fang(g)
	bx(g, 0.07, 0.08, 0.34, "metal", 0, 0, -0.04)
	bx(g, 0.072, 0.03, 0.3, "poly", 0, 0.03, -0.04)
	bx(g, 0.002, 0.026, 0.07, "dark", 0.0352, 0.0, -0.06)
	cyX(g, 0.009, 0.014, "shell", 0.03, 0.0, -0.06)
	cy(g, 0.02, 0.46, "metal", 0, 0.02, -0.42)
	cy(g, 0.016, 0.38, "metal", 0, -0.022, -0.38)
	for i = 0, 5 do bx(g, 0.012, 0.006, 0.03, "dark", 0, 0.038, -0.24 - i * 0.07) end
	cy(g, 0.024, 0.034, "accent", 0, 0.02, -0.667)
	cy(g, 0.014, 0.002, "dark", 0, 0.02, -0.6845)
	for _, s in ipairs({ -1, 1 }) do bx(g, 0.008, 0.05, 0.008, "fang", s * 0.022, -0.012, -0.68, { rot = rot(0.25) }) end
	bx(g, 0.062, 0.05, 0.16, "poly", 0, -0.024, -0.32)
	grooves(g, 5, 0.0635, 0.03, 0.005, 0, -0.024, -0.38, 0.03)
	local mg = node(0, -0.1, -0.08, 0, "mag")
	g.mag = bx(g, 0.05, 0.12, 0.08, "poly", 0, 0, 0, { parent = mg })
	bx(g, 0.052, 0.02, 0.082, "accent", 0, -0.05, 0, { parent = mg })
	trigger(g, -0.04, 0.06, 0.07)
	local gr = node(0, -0.08, 0.1, -0.35)
	bx(g, 0.036, 0.1, 0.045, "metal", 0, 0, 0, { parent = gr })
	bx(g, 0.054, 0.08, 0.24, "poly", 0, -0.02, 0.24)
	bx(g, 0.056, 0.088, 0.022, "rubber", 0, -0.02, 0.37)
	for _, z in ipairs({ -0.2, -0.05, 0.12 }) do bx(g, 0.074, 0.084, 0.012, "accent", 0, 0, z) end
	cy(g, 0.012, 0.14, "blood", 0.03, -0.01, 0.24)
	cy(g, 0.0135, 0.012, "brass", 0.03, -0.01, 0.168); cy(g, 0.0135, 0.012, "brass", 0.03, -0.01, 0.312)
	screw(g, -0.0355, -0.02, 0.0, 0.0036); screw(g, -0.0355, -0.02, -0.13, 0.0036)
	-- Bloodglass holo sight: open frame, glass and a red ring reticle
	bx(g, 0.04, 0.008, 0.07, "metal", 0, 0.044, -0.04)
	for _, s in ipairs({ -1, 1 }) do bx(g, 0.006, 0.05, 0.014, "metal", s * 0.022, 0.07, -0.06) end
	bx(g, 0.05, 0.007, 0.014, "metal", 0, 0.096, -0.06)
	cyX(g, 0.004, 0.006, "knurl", 0.026, 0.054, -0.03)
	bx(g, 0.038, 0.044, 0.001, "glass", 0, 0.071, -0.06)
	bx(g, 0.012, 0.0016, 0.001, "blood", 0, 0.0765, -0.0605); bx(g, 0.012, 0.0016, 0.001, "blood", 0, 0.0655, -0.0605)
	bx(g, 0.0016, 0.012, 0.001, "blood", -0.0055, 0.071, -0.0605); bx(g, 0.0016, 0.012, 0.001, "blood", 0.0055, 0.071, -0.0605)
	bx(g, 0.0024, 0.0024, 0.001, "blood", 0, 0.071, -0.0606)
	return { sightY = 0.071, rail = { 0, 0.05, -0.06 }, muzzleY = 0.02, muzzleZ = -0.69, underY = -0.05, underZ = -0.44, gripZ = 0.1, foreZ = -0.32, foreY = -0.05, hip = V3(0.17, -0.18, -0.5), adsZ = -0.26 }
end

-- a key that changes whenever the gun needs rebuilding
function Viewmodels.signature(id, prof)
	local t = { Stats.weaponSkin(prof, id) }
	for _, a in ipairs(Config.AttachmentOrder) do if Stats.attOn(prof, id, a) then table.insert(t, a) end end
	return table.concat(t, ",")
end

-- opts (optional): skin = preview a specific skin, noArms = leave the hands out (skin studio turntable)
function Viewmodels.build(id, prof, opts)
	opts = opts or {}
	local def = Config.WeaponById[id]
	local on = {}
	for _, a in ipairs(Config.AttachmentOrder) do on[a] = Stats.attOn(prof, id, a) end
	-- event guns carry their own optics
	if def.event then on.reddot = false end
	local skin = opts.skin or Stats.weaponSkin(prof, id)
	local g = newGun(def, skin)
	g.noArms = opts.noArms
	g.silenced = on.silencer
	g.reddot = on.reddot
	g.laser = on.laser
	local o = B[id](g, on)
	finish(g, o, on)
	g.signature = Viewmodels.signature(id, prof)
	return g
end

-- place every part of gun g relative to base; subs holds extra CFrames for moving parts
function Viewmodels.place(g, base, subs)
	for _, e in ipairs(g.parts) do
		local s = e.sub and subs[e.sub]
		e.p.CFrame = s and (base * s * e.off) or (base * e.off)
	end
end

-- hide the stock and buttpad while aiming (they sit under the cheek)
function Viewmodels.setRear(g, visible: boolean)
	if g.rearShown == visible then return end
	g.rearShown = visible
	for _, e in ipairs(g.rear or {}) do
		if e.t0 == nil then e.t0 = e.p.Transparency end
		e.p.Transparency = visible and e.t0 or 1
	end
end

function Viewmodels.destroy(g)
	g.model:Destroy()
end

return Viewmodels
