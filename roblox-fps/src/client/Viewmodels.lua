-- First-person weapon models built from parts. Laid out in meters (x right, y up, -z forward)
-- and scaled to studs. Each frame the client places every part relative to the camera.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage:WaitForChild("FoundryShared"):WaitForChild("Config"))

local S = Config.METER
local Viewmodels = {}

local MAT = {
	metal = { Color3.fromRGB(43, 48, 54), Enum.Material.Metal },
	poly = { Color3.fromRGB(27, 30, 33), Enum.Material.SmoothPlastic },
	tan = { Color3.fromRGB(122, 106, 76), Enum.Material.SmoothPlastic },
	accent = { Color3.fromRGB(245, 165, 36), Enum.Material.SmoothPlastic },
	glove = { Color3.fromRGB(26, 24, 22), Enum.Material.Fabric },
	sleeve = { Color3.fromRGB(33, 38, 29), Enum.Material.Fabric },
	dot = { Color3.fromRGB(255, 42, 26), Enum.Material.Neon },
	lens = { Color3.fromRGB(58, 122, 176), Enum.Material.Glass },
}

local function newGun(def)
	local model = Instance.new("Model")
	model.Name = "VM_" .. def.id
	return { def = def, model = model, parts = {}, subs = {} }
end

local function add(g, p, off, sub)
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = true, false, false, false, false
	p.TopSurface, p.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
	p.Parent = g.model
	table.insert(g.parts, { p = p, off = off, sub = sub })
	return p
end

local function bx(g, w, h, d, mat, x, y, z, rot, sub)
	local p = Instance.new("Part")
	p.Size = Vector3.new(math.max(w * S, 0.02), math.max(h * S, 0.02), math.max(d * S, 0.02))
	p.Color, p.Material = MAT[mat][1], MAT[mat][2]
	if mat == "lens" then p.Transparency = 0.75 end
	return add(g, p, CFrame.new(x * S, y * S, z * S) * (rot or CFrame.identity), sub)
end

local function cyl(g, r, len, mat, x, y, z, sub)
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Cylinder
	p.Size = Vector3.new(len * S, r * 2 * S, r * 2 * S)
	p.Color, p.Material = MAT[mat][1], MAT[mat][2]
	return add(g, p, CFrame.new(x * S, y * S, z * S) * CFrame.Angles(0, math.pi / 2, 0), sub)
end

local function arms(g, gripZ, foreZ, foreY)
	bx(g, 0.055, 0.09, 0.09, "glove", 0.012, -0.07, gripZ)
	bx(g, 0.085, 0.085, 0.42, "sleeve", 0.06, -0.14, gripZ + 0.22, CFrame.Angles(0.35, 0.2, 0))
	if foreZ then
		bx(g, 0.06, 0.06, 0.1, "glove", -0.01, foreY - 0.05, foreZ)
		bx(g, 0.085, 0.085, 0.45, "sleeve", -0.14, foreY - 0.14, foreZ + 0.2, CFrame.Angles(0.3, -0.55, 0))
	end
end

local function muzzle(g, z, y)
	local p = Instance.new("Part")
	p.Size = Vector3.new(0.1, 0.1, 0.1)
	p.Transparency = 1
	add(g, p, CFrame.new(0, y * S, z * S))
	local att = Instance.new("Attachment")
	att.CFrame = CFrame.Angles(0, 0, 0)
	att.Parent = p
	local flash = Instance.new("ParticleEmitter")
	flash.Texture = Config.Textures.Spark
	flash.LightEmission = 1
	flash.LightInfluence = 0
	flash.Color = ColorSequence.new(Color3.fromRGB(255, 230, 170), Color3.fromRGB(255, 120, 30))
	flash.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, g.def.flashSize), NumberSequenceKeypoint.new(1, g.def.flashSize * 0.4) })
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
	core.Size = NumberSequence.new(g.def.flashSize * 0.7)
	core.Parent = att
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(255, 170, 90)
	light.Range = 14
	light.Brightness = 4
	light.Enabled = false
	light.Parent = p
	g.muzzle, g.flash, g.flashCore, g.light = p, flash, core, light
end

local builders = {}

function builders.pistol(g)
	bx(g, 0.034, 0.036, 0.19, "metal", 0, 0.018, -0.03, nil, "slide")
	bx(g, 0.035, 0.012, 0.05, "poly", 0, 0.023, 0, nil, "slide")
	bx(g, 0.03, 0.028, 0.17, "poly", 0, -0.012, -0.03)
	bx(g, 0.03, 0.1, 0.048, "poly", 0, -0.07, 0.045, CFrame.Angles(-0.22, 0, 0))
	bx(g, 0.006, 0.01, 0.006, "dot", 0, 0.041, -0.115, nil, "slide")
	bx(g, 0.02, 0.008, 0.008, "metal", 0, 0.04, 0.055, nil, "slide")
	bx(g, 0.024, 0.012, 0.03, "accent", 0, -0.03, -0.02)
	arms(g, 0.05, 0.02, -0.04)
	muzzle(g, -0.135, 0.02)
	g.hip, g.ads = Vector3.new(0.15, -0.15, -0.4), Vector3.new(0, -0.041, -0.42)
end

function builders.rifle(g)
	bx(g, 0.06, 0.07, 0.36, "metal", 0, 0, -0.06)
	bx(g, 0.07, 0.068, 0.24, "poly", 0, 0.002, -0.35)
	for i = 0, 4 do bx(g, 0.072, 0.01, 0.02, "metal", 0, 0.038, -0.26 - i * 0.04) end
	cyl(g, 0.012, 0.22, "metal", 0, 0.005, -0.56)
	cyl(g, 0.02, 0.06, "poly", 0, 0.005, -0.66)
	bx(g, 0.036, 0.15, 0.07, "poly", 0, -0.1, -0.1, CFrame.Angles(0.18, 0, 0), "mag")
	bx(g, 0.037, 0.02, 0.071, "accent", 0, -0.165, -0.088, CFrame.Angles(0.18, 0, 0), "mag")
	bx(g, 0.036, 0.1, 0.045, "poly", 0, -0.08, 0.06, CFrame.Angles(-0.3, 0, 0))
	bx(g, 0.05, 0.075, 0.22, "poly", 0, -0.01, 0.22)
	bx(g, 0.052, 0.1, 0.05, "poly", 0, -0.02, 0.32)
	bx(g, 0.02, 0.012, 0.3, "metal", 0, 0.041, -0.08)
	bx(g, 0.042, 0.012, 0.08, "metal", 0, 0.05, -0.06)
	bx(g, 0.006, 0.05, 0.08, "metal", -0.018, 0.075, -0.06)
	bx(g, 0.006, 0.05, 0.08, "metal", 0.018, 0.075, -0.06)
	bx(g, 0.042, 0.008, 0.08, "metal", 0, 0.1, -0.06)
	bx(g, 0.03, 0.035, 0.004, "lens", 0, 0.074, -0.1)
	bx(g, 0.006, 0.006, 0.004, "dot", 0, 0.074, -0.102)
	bx(g, 0.015, 0.02, 0.04, "accent", 0.035, 0.005, -0.04)
	arms(g, 0.06, -0.33, -0.03)
	muzzle(g, -0.7, 0.005)
	g.hip, g.ads = Vector3.new(0.17, -0.18, -0.5), Vector3.new(0, -0.074, -0.5)
end

function builders.shotgun(g)
	bx(g, 0.064, 0.075, 0.3, "metal", 0, 0, -0.04)
	cyl(g, 0.017, 0.52, "metal", 0, 0.018, -0.44)
	cyl(g, 0.014, 0.42, "metal", 0, -0.022, -0.39)
	bx(g, 0.058, 0.052, 0.17, "tan", 0, -0.022, -0.34, nil, "pump")
	for i = 0, 5 do bx(g, 0.06, 0.006, 0.01, "poly", 0, -0.002, -0.41 + i * 0.028, nil, "pump") end
	bx(g, 0.036, 0.1, 0.045, "tan", 0, -0.08, 0.1, CFrame.Angles(-0.35, 0, 0))
	bx(g, 0.052, 0.08, 0.26, "tan", 0, -0.02, 0.24)
	bx(g, 0.006, 0.01, 0.006, "accent", 0, 0.04, -0.69)
	bx(g, 0.02, 0.01, 0.02, "metal", 0, 0.042, 0.03)
	arms(g, 0.1, -0.34, -0.05)
	muzzle(g, -0.72, 0.018)
	g.hip, g.ads = Vector3.new(0.17, -0.18, -0.52), Vector3.new(0, -0.045, -0.52)
end

function builders.sniper(g)
	bx(g, 0.06, 0.07, 0.4, "metal", 0, 0, -0.02)
	bx(g, 0.07, 0.07, 0.34, "poly", 0, -0.005, -0.38)
	cyl(g, 0.014, 0.42, "metal", 0, 0.008, -0.74)
	cyl(g, 0.024, 0.08, "metal", 0, 0.008, -0.97)
	cyl(g, 0.028, 0.3, "poly", 0, 0.085, -0.08)
	cyl(g, 0.04, 0.07, "poly", 0, 0.085, -0.25)
	cyl(g, 0.034, 0.06, "poly", 0, 0.085, 0.09)
	bx(g, 0.012, 0.035, 0.012, "metal", 0, 0.055, -0.14)
	bx(g, 0.012, 0.035, 0.012, "metal", 0, 0.055, 0.02)
	bx(g, 0.06, 0.012, 0.012, "metal", 0.065, 0.02, 0.1, nil, "bolt")
	bx(g, 0.025, 0.025, 0.025, "metal", 0.097, 0.02, 0.1, nil, "bolt")
	bx(g, 0.04, 0.07, 0.09, "poly", 0, -0.06, -0.05, nil, "mag")
	bx(g, 0.036, 0.1, 0.045, "poly", 0, -0.08, 0.1, CFrame.Angles(-0.3, 0, 0))
	bx(g, 0.055, 0.09, 0.28, "accent", 0, -0.02, 0.3)
	bx(g, 0.05, 0.02, 0.14, "poly", 0, 0.035, 0.28)
	arms(g, 0.1, -0.36, -0.04)
	muzzle(g, -1.02, 0.008)
	g.hip, g.ads = Vector3.new(0.18, -0.18, -0.5), Vector3.new(0, -0.085, -0.3)
	g.boltPivot = CFrame.new(0.035 * S, 0.02 * S, 0.1 * S)
end

function Viewmodels.build()
	local guns = {}
	for i, def in ipairs(Config.Weapons) do
		local g = newGun(def)
		builders[def.id](g)
		g.hip *= S
		g.ads *= S
		guns[i] = g
	end
	return guns
end

-- place every part of gun g relative to base; subs holds extra CFrames for moving parts
function Viewmodels.place(g, base, subs)
	for _, e in ipairs(g.parts) do
		local s = e.sub and subs[e.sub]
		e.p.CFrame = s and (base * s * e.off) or (base * e.off)
	end
end

return Viewmodels
