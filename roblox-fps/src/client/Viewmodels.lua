--!nonstrict
-- First-person weapon models built from parts. Laid out in meters (x right, y up, -z forward)
-- and scaled to studs. Each gun is rebuilt when its skin or attachments change; every frame the
-- client places each part relative to the camera.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("FoundryShared")
local Config = require(Shared:WaitForChild("Config"))
local Stats = require(Shared:WaitForChild("Stats"))

local S = Config.METER
local Viewmodels = {}
local RGB = Color3.fromRGB

local FIXED = {
	glove = { RGB(26, 24, 22), Enum.Material.Fabric },
	sleeve = { RGB(30, 34, 27), Enum.Material.Fabric },
	dot = { RGB(255, 42, 26), Enum.Material.Neon },
	lens = { RGB(58, 122, 176), Enum.Material.Glass },
	glass = { RGB(154, 212, 255), Enum.Material.Glass },
	laser = { RGB(255, 42, 26), Enum.Material.Neon },
	cyan = { RGB(108, 246, 255), Enum.Material.Neon },
	soul = { RGB(154, 255, 106), Enum.Material.Neon },
	soulglass = { RGB(120, 255, 150), Enum.Material.Glass },
	blood = { RGB(255, 36, 52), Enum.Material.Neon },
	bone = { RGB(236, 228, 204), Enum.Material.Marble },
	fang = { RGB(250, 250, 245), Enum.Material.SmoothPlastic },
}

local function materials(skin)
	local s = Config.Skins[skin] or Config.Skins.stock
	return {
		metal = { s.metal, s.metalMat or (s.shiny and Enum.Material.Foil or Enum.Material.Metal) },
		poly = { s.poly, s.polyMat or Enum.Material.SmoothPlastic },
		alt = { s.alt, s.altMat or Enum.Material.SmoothPlastic },
		accent = { s.accent, s.glow and Enum.Material.Neon or Enum.Material.SmoothPlastic },
	}
end

local function newGun(def, skin)
	local model = Instance.new("Model")
	model.Name = "VM_" .. def.id
	return { def = def, model = model, parts = {}, mats = materials(skin), nodes = {} }
end

-- parent: optional node returned by bx/cy; offsets are then relative to it
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
local function bx(g, w, h, d, mat, x, y, z, opts)
	opts = opts or {}
	local p = Instance.new("Part")
	p.Size = Vector3.new(math.max(w * S, 0.01), math.max(h * S, 0.01), math.max(d * S, 0.01))
	local m = look(g, mat)
	p.Color, p.Material = m[1], m[2]
	if mat == "lens" or mat == "soulglass" then p.Transparency = 0.7 elseif mat == "glass" then p.Transparency = 0.86 end
	local off = CFrame.new(x * S, y * S, z * S) * (opts.rot or CFrame.identity)
	if opts.parent then off = opts.parent.off * off end
	return add(g, p, off, opts.sub or (opts.parent and opts.parent.sub))
end
local function cy(g, r, len, mat, x, y, z, opts)
	opts = opts or {}
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Cylinder
	p.Size = Vector3.new(len * S, r * 2 * S, r * 2 * S)
	local m = look(g, mat)
	p.Color, p.Material = m[1], m[2]
	local off = CFrame.new(x * S, y * S, z * S) * CFrame.Angles(0, math.pi / 2, 0)
	if opts.parent then off = opts.parent.off * off end
	return add(g, p, off, opts.sub or (opts.parent and opts.parent.sub))
end
local function ring(g, r, mat, x, y, z)
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Cylinder
	p.Size = Vector3.new(0.012 * S, r * 2 * S, r * 2 * S)
	local m = look(g, mat)
	p.Color, p.Material = m[1], m[2]
	p.Transparency = 0.2
	return add(g, p, CFrame.new(x * S, y * S, z * S) * CFrame.Angles(0, math.pi / 2, 0))
end

local function arms(g, gripZ, foreZ, foreY)
	if g.noArms then return end
	bx(g, 0.055, 0.09, 0.09, "glove", 0.012, -0.07, gripZ)
	bx(g, 0.08, 0.08, 0.28, "sleeve", 0.05, -0.12, gripZ + 0.15, { rot = CFrame.Angles(0.35, 0.2, 0) })
	if foreZ then
		bx(g, 0.06, 0.06, 0.1, "glove", -0.01, foreY - 0.05, foreZ)
		bx(g, 0.08, 0.08, 0.34, "sleeve", -0.11, foreY - 0.12, foreZ + 0.15, { rot = CFrame.Angles(0.3, -0.55, 0) })
	end
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

-- shared attachment points and arms
local function finish(g, o, on)
	g.o = o
	if on.reddot then
		local rd = { off = CFrame.new(0, o.rail[2] * S, o.rail[3] * S) }
		bx(g, 0.036, 0.008, 0.06, "metal", 0, 0.004, 0, { parent = rd })
		bx(g, 0.005, 0.034, 0.012, "metal", -0.018, 0.021, -0.02, { parent = rd })
		bx(g, 0.005, 0.034, 0.012, "metal", 0.018, 0.021, -0.02, { parent = rd })
		bx(g, 0.041, 0.005, 0.012, "metal", 0, 0.04, -0.02, { parent = rd })
		bx(g, 0.012, 0.01, 0.02, "accent", 0.022, 0.012, 0.01, { parent = rd })
		bx(g, 0.031, 0.03, 0.001, "glass", 0, 0.022, -0.02, { parent = rd })
		bx(g, 0.0045, 0.0045, 0.001, "dot", 0, 0.022, -0.0215, { parent = rd })
	end
	local mz = o.muzzleZ
	if on.silencer then
		cy(g, 0.021, 0.17, "poly", 0, o.muzzleY, mz - 0.085)
		cy(g, 0.023, 0.02, "metal", 0, o.muzzleY, mz - 0.005)
		mz -= 0.17
	end
	if on.grip then
		bx(g, 0.03, 0.075, 0.035, "poly", 0, o.underY - 0.04, o.underZ)
		bx(g, 0.035, 0.01, 0.045, "metal", 0, o.underY, o.underZ)
	end
	if on.laser then
		bx(g, 0.018, 0.022, 0.06, "metal", 0.034, o.underY + 0.02, o.underZ - 0.03)
		g.laserEntry = bx(g, 0.01, 0.01, 0.004, "laser", 0.034, o.underY + 0.02, o.underZ - 0.061)
	end
	muzzle(g, o.muzzleY, mz)
	arms(g, o.gripZ, o.foreZ, o.foreY)
	g.hip = o.hip * S
	g.ads = Vector3.new(0, -(on.reddot and o.rail[2] + 0.022 or o.sightY), o.adsZ) * S
	if g.mag and on.extmag then
		-- a tube magazine is a cylinder, whose length runs along X
		g.mag.p.Size = g.tube and Vector3.new(g.mag.size.X * 1.18, g.mag.size.Y, g.mag.size.Z) or Vector3.new(g.mag.size.X, g.mag.size.Y * 1.45, g.mag.size.Z)
		if not g.tube then g.mag.off *= CFrame.new(0, -g.mag.size.Y * 0.225, 0) end
	end
end

local V3 = Vector3.new
local B = {}

function B.pistol(g)
	local slide = bx(g, 0.034, 0.036, 0.19, "metal", 0, 0.018, -0.03, { sub = "slide" })
	bx(g, 0.035, 0.012, 0.05, "poly", 0, 0.005, 0.03, { parent = slide })
	bx(g, 0.03, 0.028, 0.17, "poly", 0, -0.012, -0.03)
	bx(g, 0.03, 0.1, 0.048, "poly", 0, -0.07, 0.045, { rot = CFrame.Angles(-0.22, 0, 0) })
	bx(g, 0.004, 0.01, 0.006, "dot", 0, 0.041, -0.115, { sub = "slide" })
	bx(g, 0.02, 0.008, 0.008, "metal", 0, 0.04, 0.055, { sub = "slide" })
	bx(g, 0.024, 0.012, 0.03, "accent", 0, -0.03, -0.02)
	g.mag = bx(g, 0.026, 0.02, 0.04, "alt", 0, -0.125, 0.052, { sub = "mag" })
	return { sightY = 0.041, rail = { 0, 0.036, 0.0 }, muzzleY = 0.02, muzzleZ = -0.135, underY = -0.03, underZ = -0.08, gripZ = 0.05, foreZ = 0.02, foreY = -0.04, hip = V3(0.15, -0.15, -0.4), adsZ = -0.46 }
end

function B.smg(g)
	bx(g, 0.05, 0.06, 0.26, "metal", 0, 0, -0.04)
	local shroud = bx(g, 0.046, 0.046, 0.13, "poly", 0, 0.004, -0.23)
	for i = 0, 3 do bx(g, 0.048, 0.012, 0.012, "metal", 0, 0.012, -0.045 + i * 0.03, { parent = shroud }) end
	cy(g, 0.01, 0.08, "metal", 0, 0.004, -0.33)
	g.mag = bx(g, 0.026, 0.19, 0.04, "poly", 0, -0.12, -0.08, { sub = "mag" })
	bx(g, 0.027, 0.02, 0.041, "accent", 0, -0.2, -0.08, { sub = "mag" })
	bx(g, 0.032, 0.09, 0.04, "poly", 0, -0.07, 0.05, { rot = CFrame.Angles(-0.25, 0, 0) })
	bx(g, 0.012, 0.012, 0.18, "metal", 0.018, -0.005, 0.17); bx(g, 0.012, 0.012, 0.18, "metal", -0.018, -0.005, 0.17); bx(g, 0.05, 0.05, 0.012, "poly", 0, -0.015, 0.26)
	bx(g, 0.014, 0.012, 0.18, "metal", 0, 0.034, -0.05); bx(g, 0.004, 0.012, 0.006, "metal", 0, 0.045, -0.13); bx(g, 0.02, 0.012, 0.006, "metal", 0, 0.045, 0.03)
	bx(g, 0.02, 0.02, 0.05, "metal", 0.03, 0.01, -0.02, { sub = "slide" })
	return { sightY = 0.047, rail = { 0, 0.04, -0.03 }, muzzleY = 0.004, muzzleZ = -0.37, underY = -0.02, underZ = -0.22, gripZ = 0.05, foreZ = -0.08, foreY = -0.2, hip = V3(0.15, -0.15, -0.42), adsZ = -0.52 }
end

function B.rifle(g)
	bx(g, 0.06, 0.07, 0.36, "metal", 0, 0, -0.06)
	bx(g, 0.07, 0.068, 0.24, "poly", 0, 0.002, -0.35)
	for i = 0, 4 do bx(g, 0.072, 0.01, 0.02, "metal", 0, 0.038, -0.26 - i * 0.04) end
	cy(g, 0.012, 0.22, "metal", 0, 0.005, -0.56); cy(g, 0.02, 0.06, "poly", 0, 0.005, -0.66)
	g.mag = bx(g, 0.036, 0.15, 0.07, "poly", 0, -0.1, -0.1, { rot = CFrame.Angles(0.18, 0, 0), sub = "mag" })
	bx(g, 0.037, 0.02, 0.071, "accent", 0, -0.065, 0, { parent = g.mag })
	bx(g, 0.036, 0.1, 0.045, "poly", 0, -0.08, 0.06, { rot = CFrame.Angles(-0.3, 0, 0) })
	bx(g, 0.05, 0.075, 0.22, "poly", 0, -0.01, 0.22); bx(g, 0.052, 0.1, 0.05, "poly", 0, -0.02, 0.32)
	bx(g, 0.02, 0.012, 0.3, "metal", 0, 0.041, -0.08)
	bx(g, 0.006, 0.02, 0.008, "metal", 0, 0.056, -0.42); bx(g, 0.024, 0.018, 0.01, "metal", 0, 0.056, 0.05)
	bx(g, 0.015, 0.02, 0.04, "accent", 0.035, 0.005, -0.04)
	bx(g, 0.012, 0.012, 0.03, "metal", 0.034, 0.02, 0.0, { sub = "slide" })
	return { sightY = 0.062, rail = { 0, 0.047, -0.08 }, muzzleY = 0.005, muzzleZ = -0.7, underY = -0.035, underZ = -0.38, gripZ = 0.06, foreZ = -0.3, foreY = -0.03, hip = V3(0.17, -0.18, -0.5), adsZ = -0.62 }
end

function B.burst(g)
	bx(g, 0.064, 0.085, 0.5, "poly", 0, 0, 0.02)
	bx(g, 0.066, 0.02, 0.44, "accent", 0, -0.035, 0.02)
	cy(g, 0.013, 0.2, "metal", 0, 0.012, -0.33); cy(g, 0.022, 0.05, "metal", 0, 0.012, -0.44)
	bx(g, 0.03, 0.03, 0.34, "metal", 0, 0.056, -0.02)
	g.mag = bx(g, 0.036, 0.13, 0.065, "metal", 0, -0.1, 0.13, { sub = "mag" })
	bx(g, 0.036, 0.1, 0.045, "poly", 0, -0.085, -0.06, { rot = CFrame.Angles(-0.3, 0, 0) })
	bx(g, 0.04, 0.02, 0.1, "metal", 0, -0.05, -0.1)
	bx(g, 0.006, 0.018, 0.008, "metal", 0, 0.08, -0.17); bx(g, 0.024, 0.016, 0.01, "metal", 0, 0.08, 0.1)
	return { sightY = 0.086, rail = { 0, 0.071, -0.04 }, muzzleY = 0.012, muzzleZ = -0.47, underY = -0.045, underZ = -0.2, gripZ = -0.06, foreZ = -0.22, foreY = -0.04, hip = V3(0.16, -0.18, -0.46), adsZ = -0.6 }
end

function B.shotgun(g)
	bx(g, 0.064, 0.075, 0.3, "metal", 0, 0, -0.04)
	cy(g, 0.017, 0.52, "metal", 0, 0.018, -0.44)
	g.mag = cy(g, 0.014, 0.42, "metal", 0, -0.022, -0.39)
	g.tube = true
	local pump = bx(g, 0.058, 0.052, 0.17, "alt", 0, -0.022, -0.34, { sub = "pump" })
	for i = 0, 5 do bx(g, 0.06, 0.006, 0.01, "poly", 0, 0.02, -0.07 + i * 0.028, { parent = pump }) end
	bx(g, 0.036, 0.1, 0.045, "alt", 0, -0.08, 0.1, { rot = CFrame.Angles(-0.35, 0, 0) })
	bx(g, 0.052, 0.08, 0.26, "alt", 0, -0.02, 0.24)
	bx(g, 0.006, 0.01, 0.006, "accent", 0, 0.04, -0.69); bx(g, 0.02, 0.01, 0.02, "metal", 0, 0.042, 0.03)
	return { sightY = 0.045, rail = { 0, 0.038, -0.02 }, muzzleY = 0.018, muzzleZ = -0.72, underY = -0.05, underZ = -0.46, gripZ = 0.1, foreZ = -0.34, foreY = -0.05, hip = V3(0.17, -0.18, -0.52), adsZ = -0.64 }
end

function B.lmg(g)
	bx(g, 0.08, 0.09, 0.42, "metal", 0, 0, -0.04)
	local shroud = bx(g, 0.064, 0.064, 0.3, "poly", 0, 0.005, -0.4)
	for i = 0, 5 do bx(g, 0.066, 0.014, 0.018, "metal", 0, 0.01, -0.12 + i * 0.045, { parent = shroud }) end
	cy(g, 0.016, 0.22, "metal", 0, 0.005, -0.66); cy(g, 0.026, 0.06, "poly", 0, 0.005, -0.78)
	g.mag = bx(g, 0.1, 0.11, 0.13, "alt", -0.02, -0.1, -0.06, { sub = "mag" })
	bx(g, 0.102, 0.02, 0.132, "accent", 0, 0.03, 0, { parent = g.mag })
	bx(g, 0.038, 0.1, 0.045, "poly", 0, -0.085, 0.1, { rot = CFrame.Angles(-0.3, 0, 0) })
	bx(g, 0.055, 0.085, 0.26, "poly", 0, -0.015, 0.28)
	bx(g, 0.012, 0.035, 0.1, "metal", 0, 0.065, -0.02); bx(g, 0.06, 0.012, 0.012, "metal", 0, 0.08, -0.02, { sub = "slide" })
	bx(g, 0.012, 0.012, 0.22, "metal", 0.02, -0.04, -0.52); bx(g, 0.012, 0.012, 0.22, "metal", -0.02, -0.04, -0.52)
	bx(g, 0.006, 0.02, 0.008, "metal", 0, 0.06, -0.52); bx(g, 0.026, 0.02, 0.01, "metal", 0, 0.066, 0.1)
	return { sightY = 0.072, rail = { 0, 0.052, 0.04 }, muzzleY = 0.005, muzzleZ = -0.81, underY = -0.035, underZ = -0.36, gripZ = 0.1, foreZ = -0.34, foreY = -0.03, hip = V3(0.17, -0.2, -0.52), adsZ = -0.66 }
end

function B.sniper(g, on)
	bx(g, 0.06, 0.07, 0.4, "metal", 0, 0, -0.02)
	bx(g, 0.07, 0.07, 0.34, "poly", 0, -0.005, -0.38)
	cy(g, 0.014, 0.42, "metal", 0, 0.008, -0.74); cy(g, 0.024, 0.08, "metal", 0, 0.008, -0.97)
	if not on.reddot then
		cy(g, 0.028, 0.3, "poly", 0, 0.085, -0.08); cy(g, 0.04, 0.07, "poly", 0, 0.085, -0.25); cy(g, 0.034, 0.06, "poly", 0, 0.085, 0.09)
		bx(g, 0.07, 0.07, 0.002, "lens", 0, 0.085, -0.286)
		bx(g, 0.012, 0.035, 0.012, "metal", 0, 0.055, -0.14); bx(g, 0.012, 0.035, 0.012, "metal", 0, 0.055, 0.02)
	end
	bx(g, 0.06, 0.012, 0.012, "metal", 0.065, 0.02, 0.1, { sub = "bolt" })
	bx(g, 0.028, 0.028, 0.028, "metal", 0.097, 0.02, 0.1, { sub = "bolt" })
	g.mag = bx(g, 0.04, 0.07, 0.09, "poly", 0, -0.06, -0.05, { sub = "mag" })
	bx(g, 0.036, 0.1, 0.045, "poly", 0, -0.08, 0.1, { rot = CFrame.Angles(-0.3, 0, 0) })
	bx(g, 0.055, 0.09, 0.28, "accent", 0, -0.02, 0.3); bx(g, 0.05, 0.02, 0.14, "poly", 0, 0.035, 0.28)
	g.boltPivot = CFrame.new(0.035 * S, 0.02 * S, 0.1 * S)
	return { sightY = 0.085, rail = { 0, 0.035, -0.26 }, muzzleY = 0.008, muzzleZ = -1.02, underY = -0.04, underZ = -0.42, gripZ = 0.1, foreZ = -0.36, foreY = -0.04, hip = V3(0.18, -0.18, -0.5), adsZ = -0.3 }
end

function B.plasma(g)
	bx(g, 0.07, 0.08, 0.42, "poly", 0, 0, -0.04)
	bx(g, 0.074, 0.03, 0.3, "accent", 0, 0.03, -0.06)
	bx(g, 0.03, 0.02, 0.16, "cyan", 0.036, 0.01, -0.06)
	cy(g, 0.018, 0.2, "metal", 0, 0.005, -0.35)
	g.coils = {}
	for i = 0, 2 do table.insert(g.coils, ring(g, 0.03, "cyan", 0, 0.005, -0.29 - i * 0.05)) end
	cy(g, 0.03, 0.04, "metal", 0, 0.005, -0.47)
	g.mag = bx(g, 0.045, 0.1, 0.07, "metal", 0, -0.085, -0.12, { sub = "mag" })
	bx(g, 0.047, 0.05, 0.03, "cyan", 0, -0.01, 0, { parent = g.mag })
	bx(g, 0.036, 0.1, 0.045, "poly", 0, -0.08, 0.06, { rot = CFrame.Angles(-0.3, 0, 0) })
	bx(g, 0.05, 0.07, 0.2, "poly", 0, -0.01, 0.24)
	bx(g, 0.006, 0.018, 0.008, "metal", 0, 0.054, -0.2); bx(g, 0.024, 0.016, 0.01, "metal", 0, 0.054, 0.08)
	return { sightY = 0.07, rail = { 0, 0.045, -0.02 }, muzzleY = 0.005, muzzleZ = -0.5, underY = -0.045, underZ = -0.3, gripZ = 0.06, foreZ = -0.26, foreY = -0.04, hip = V3(0.17, -0.18, -0.48), adsZ = -0.6 }
end

-- Reaper's Eye: a bone-and-iron marksman rifle with a skull muzzle, a scythe blade and a green Soulglass scope
function B.reaper(g)
	bx(g, 0.06, 0.075, 0.42, "metal", 0, 0, -0.02)
	bx(g, 0.07, 0.07, 0.36, "poly", 0, -0.005, -0.4)
	for i = 0, 3 do bx(g, 0.074, 0.012, 0.03, "alt", 0, 0.036, -0.28 - i * 0.07) end
	cy(g, 0.015, 0.44, "metal", 0, 0.008, -0.78)
	-- skull muzzle with glowing eyes
	local skull = bx(g, 0.07, 0.07, 0.07, "bone", 0, 0.012, -1.02)
	bx(g, 0.016, 0.014, 0.004, "soul", -0.016, 0.022, -0.036, { parent = skull })
	bx(g, 0.016, 0.014, 0.004, "soul", 0.016, 0.022, -0.036, { parent = skull })
	bx(g, 0.05, 0.016, 0.03, "bone", 0, -0.04, -0.01, { parent = skull })
	-- scythe blade sweeping back under the barrel
	bx(g, 0.008, 0.02, 0.26, "metal", 0, -0.06, -0.7, { rot = CFrame.Angles(0.35, 0, 0) })
	bx(g, 0.006, 0.05, 0.2, "accent", 0, -0.1, -0.58, { rot = CFrame.Angles(0.6, 0, 0) })
	-- Soulglass scope
	cy(g, 0.03, 0.3, "poly", 0, 0.09, -0.08); cy(g, 0.042, 0.07, "alt", 0, 0.09, -0.26); cy(g, 0.036, 0.06, "alt", 0, 0.09, 0.09)
	bx(g, 0.074, 0.074, 0.002, "soulglass", 0, 0.09, -0.296)
	ring(g, 0.044, "soul", 0, 0.09, -0.22)
	bx(g, 0.012, 0.04, 0.012, "metal", 0, 0.058, -0.14); bx(g, 0.012, 0.04, 0.012, "metal", 0, 0.058, 0.02)
	bx(g, 0.06, 0.012, 0.012, "metal", 0.065, 0.02, 0.1, { sub = "bolt" })
	bx(g, 0.028, 0.028, 0.028, "bone", 0.097, 0.02, 0.1, { sub = "bolt" })
	g.mag = bx(g, 0.04, 0.07, 0.09, "poly", 0, -0.06, -0.05, { sub = "mag" })
	bx(g, 0.036, 0.1, 0.045, "poly", 0, -0.08, 0.1, { rot = CFrame.Angles(-0.3, 0, 0) })
	bx(g, 0.055, 0.09, 0.28, "alt", 0, -0.02, 0.3); bx(g, 0.05, 0.02, 0.14, "poly", 0, 0.035, 0.28)
	bx(g, 0.057, 0.02, 0.2, "soul", 0, -0.04, 0.3)
	g.boltPivot = CFrame.new(0.035 * S, 0.02 * S, 0.1 * S)
	return { sightY = 0.09, rail = { 0, 0.04, -0.26 }, muzzleY = 0.012, muzzleZ = -1.07, underY = -0.04, underZ = -0.42, gripZ = 0.1, foreZ = -0.36, foreY = -0.04, hip = V3(0.18, -0.18, -0.5), adsZ = -0.3 }
end

-- Vampire's Fang: a blood-red combat shotgun with fangs at the muzzle and its own holo sight
function B.fang(g)
	bx(g, 0.066, 0.08, 0.34, "metal", 0, 0, -0.04)
	cy(g, 0.019, 0.5, "poly", 0, 0.016, -0.46)
	g.mag = cy(g, 0.015, 0.4, "metal", 0, -0.024, -0.4)
	g.tube = true
	local pump = bx(g, 0.06, 0.054, 0.17, "alt", 0, -0.024, -0.36, { sub = "pump" })
	for i = 0, 4 do bx(g, 0.062, 0.006, 0.01, "blood", 0, 0.022, -0.06 + i * 0.03, { parent = pump }) end
	-- fangs hanging from the muzzle
	cy(g, 0.026, 0.05, "metal", 0, 0.016, -0.72)
	for _, x in ipairs({ -0.014, 0.014 }) do bx(g, 0.008, 0.05, 0.008, "fang", x, -0.022, -0.735, { rot = CFrame.Angles(0.15, 0, 0) }) end
	bx(g, 0.07, 0.012, 0.3, "blood", 0, -0.04, -0.04)
	-- holo sight: frame, glass and a red ring dot
	bx(g, 0.05, 0.008, 0.08, "metal", 0, 0.046, -0.06)
	bx(g, 0.006, 0.044, 0.012, "metal", -0.024, 0.07, -0.09); bx(g, 0.006, 0.044, 0.012, "metal", 0.024, 0.07, -0.09)
	bx(g, 0.054, 0.006, 0.012, "metal", 0, 0.094, -0.09)
	bx(g, 0.042, 0.038, 0.001, "glass", 0, 0.071, -0.09)
	bx(g, 0.005, 0.005, 0.001, "blood", 0, 0.071, -0.0915)
	bx(g, 0.036, 0.1, 0.045, "alt", 0, -0.08, 0.1, { rot = CFrame.Angles(-0.35, 0, 0) })
	bx(g, 0.054, 0.08, 0.26, "poly", 0, -0.02, 0.24)
	bx(g, 0.056, 0.016, 0.1, "accent", 0, 0.03, 0.3)
	return { sightY = 0.071, rail = { 0, 0.05, -0.06 }, muzzleY = 0.016, muzzleZ = -0.76, underY = -0.05, underZ = -0.46, gripZ = 0.1, foreZ = -0.36, foreY = -0.05, hip = V3(0.17, -0.18, -0.52), adsZ = -0.5 }
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
	if def.scope and def.event then on.reddot = false end
	if def.builtinSight then on.reddot = false end
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

function Viewmodels.destroy(g)
	g.model:Destroy()
end

return Viewmodels
