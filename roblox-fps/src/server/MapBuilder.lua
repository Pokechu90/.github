--!nonstrict
-- Builds the five sites, their lighting, spawn points, explosive drums and the crate/forge stations.
local Lighting = game:GetService("Lighting")
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage:WaitForChild("FoundryShared"):WaitForChild("Config"))

local S = Config.METER
local MapBuilder = {}
local rng = Random.new()
local function rand(a, b) return a + rng:NextNumber() * (b - a) end
local RGB = Color3.fromRGB
local MAT = Enum.Material

local root: Model
local statics: Folder
local drumFolder: Folder

local C = {
	ground = RGB(104, 106, 108), concrete = RGB(128, 128, 124), wall = RGB(70, 80, 88), dark = RGB(29, 34, 38), steel = RGB(94, 103, 110),
	hazard = RGB(224, 169, 28), crate = RGB(86, 96, 63), drum = RGB(163, 40, 28), lamp = RGB(255, 196, 130), strip = RGB(255, 150, 70),
	red = RGB(255, 48, 32), cyan = RGB(95, 242, 255), magenta = RGB(255, 62, 165), rust = RGB(106, 70, 54), sand = RGB(201, 168, 119),
	tile = RGB(201, 206, 210), labwall = RGB(215, 221, 224), white = RGB(234, 246, 255), green = RGB(93, 255, 154),
}
local CONTAINER = { RGB(154, 58, 40), RGB(45, 95, 134), RGB(47, 115, 98), RGB(192, 105, 42), RGB(107, 111, 117), RGB(122, 47, 74) }

-- x, z = centre, y = bottom; meters
local function box(parent, x, y, z, w, h, d, mat, color, props)
	local p = Instance.new("Part")
	p.Anchored = true
	p.Size = Vector3.new(math.max(0.05, w * S), math.max(0.05, h * S), math.max(0.05, d * S))
	p.CFrame = CFrame.new(x * S, (y + h / 2) * S, z * S)
	p.Material = mat
	p.Color = color
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	if props then for k, v in pairs(props) do (p :: any)[k] = v end end
	p.Parent = parent or statics
	return p
end
local function deco(x, y, z, w, h, d, mat, color)
	return box(statics, x, y, z, w, h, d, mat, color, { CanCollide = false, CanQuery = false, CastShadow = false })
end
local function neon(x, y, z, w, h, d, color) return deco(x, y, z, w, h, d, MAT.Neon, color) end
local function cylinder(x, y, z, r, h, mat, color, props)
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Cylinder
	p.Anchored = true
	p.Size = Vector3.new(h * S, r * 2 * S, r * 2 * S)
	p.CFrame = CFrame.new(x * S, (y + h / 2) * S, z * S) * CFrame.Angles(0, 0, math.pi / 2)
	p.Material = mat
	p.Color = color
	if props then for k, v in pairs(props) do (p :: any)[k] = v end end
	p.Parent = statics
	return p
end
local function free(x, z, r, y0, y1)
	local params = OverlapParams.new()
	params.FilterType = Enum.RaycastFilterType.Include
	params.FilterDescendantsInstances = { root }
	local cy = ((y0 or 0) + (y1 or 2)) / 2
	local hits = workspace:GetPartBoundsInBox(CFrame.new(x * S, cy * S, z * S), Vector3.new(r * 2 * S, ((y1 or 2) - (y0 or 0)) * S, r * 2 * S), params)
	for _, h in ipairs(hits) do if h.CanCollide and h.Name ~= "Ground" then return false end end
	return true
end
local function lamp(x, z, color, h)
	h = h or 8
	box(statics, x, 0, z, 0.35, h, 0.35, MAT.Metal, C.steel)
	box(statics, x, h - 0.3, z + 0.8, 0.25, 0.25, 1.8, MAT.Metal, C.steel, { CanCollide = false })
	local head = neon(x, h - 0.5, z + 1.5, 0.7, 0.18, 0.5, color or C.lamp)
	local spot = Instance.new("SpotLight")
	spot.Face = Enum.NormalId.Bottom
	spot.Angle = 110
	spot.Range = 60
	spot.Brightness = 3
	spot.Color = color or RGB(255, 170, 100)
	spot.Shadows = true
	spot.Parent = head
end
local function pointLight(x, y, z, color, brightness, range)
	local p = deco(x, y, z, 0.2, 0.2, 0.2, MAT.Neon, color)
	p.Transparency = 0.3
	local l = Instance.new("PointLight")
	l.Color, l.Brightness, l.Range = color, brightness or 2, range or 40
	l.Parent = p
	return p
end
local function perimeter(half, h, mat, color, hazard)
	local L = half * 2 + 4
	for _, w in ipairs({ { 0, -half, L, 2 }, { 0, half, L, 2 }, { -half, 0, 2, L }, { half, 0, 2, L } }) do
		box(statics, w[1], 0, w[2], w[3], h, w[4], mat, color)
		if hazard then box(statics, w[1], 0, w[2], w[3] + 0.2, 0.9, w[4] + 0.2, MAT.SmoothPlastic, C.hazard, { CanQuery = false }) end
	end
end
local function stairs(x, z, dir, width, steps, stepH, stepD, mat, color)
	for i = 1, steps do
		local off = (steps - i) * stepD + stepD / 2
		if dir == "z-" then box(statics, x, 0, z + off, width, stepH * i, stepD, mat, color)
		elseif dir == "z+" then box(statics, x, 0, z - off, width, stepH * i, stepD, mat, color)
		elseif dir == "x-" then box(statics, x + off, 0, z, stepD, stepH * i, width, mat, color)
		else box(statics, x - off, 0, z, stepD, stepH * i, width, mat, color) end
	end
end
local function crates(ax, az, n)
	for _ = 1, n do
		local x, z = ax + rand(-2.5, 2.5), az + rand(-2.5, 2.5)
		if free(x, z, 0.95, 0.1, 1.2) then
			local c = box(statics, x, 0, z, 1.3, 1.3, 1.3, MAT.WoodPlanks, C.crate)
			c.CFrame *= CFrame.Angles(0, math.rad(rand(-12, 12)), 0)
			if rng:NextNumber() < 0.45 then box(statics, x, 1.3, z, 1.3, 1.3, 1.3, MAT.WoodPlanks, C.crate:Lerp(Color3.new(), 0.1)).CFrame *= CFrame.Angles(0, math.rad(rand(-25, 25)), 0) end
		end
	end
end
local function drum(x, z)
	if not free(x, z, 0.5, 0.1, 1) then return end
	local d = Instance.new("Part")
	d.Name = "FuelDrum"
	d.Shape = Enum.PartType.Cylinder
	d.Anchored = true
	d.Size = Vector3.new(1.2 * S, 0.85 * S, 0.85 * S)
	d.CFrame = CFrame.new(x * S, 0.6 * S, z * S) * CFrame.Angles(0, 0, math.pi / 2)
	d.Material = MAT.Metal
	d.Color = C.drum
	d:SetAttribute("HP", Config.Barrel.HP)
	local band = Instance.new("Part")
	band.Shape = Enum.PartType.Cylinder
	band.Anchored, band.CanCollide, band.CanQuery = true, false, false
	band.Size = Vector3.new(0.25 * S, 0.87 * S, 0.87 * S)
	band.CFrame = d.CFrame
	band.Material = MAT.SmoothPlastic
	band.Color = C.hazard
	band.Parent = d
	d.Parent = drumFolder
end
local function skyline(n, rmin, rmax, hmin, hmax, baseY)
	baseY = baseY or 0
	for i = 1, n do
		local a = i / n * math.pi * 2 + rand(-0.05, 0.05)
		local r, w, d, h = rand(rmin, rmax), rand(14, 30), rand(14, 30), rand(hmin, hmax)
		local x, z = math.cos(a) * r, math.sin(a) * r
		local b = box(statics, x, baseY, z, w, h, d, MAT.Concrete, RGB(21, 26, 34), { CanCollide = false, CastShadow = false, CanQuery = false })
		b.CFrame *= CFrame.Angles(0, rand(0, 1), 0)
		for f = 1, math.floor(h / 6) do
			if rng:NextNumber() < 0.55 then
				local win = Instance.new("Part")
				win.Anchored, win.CanCollide, win.CanQuery, win.CastShadow = true, false, false, false
				win.Material = MAT.Neon
				win.Color = rng:NextNumber() < 0.2 and RGB(159, 208, 255) or RGB(255, 190, 110)
				win.Size = Vector3.new(w * S * rand(0.3, 0.9), 0.9, d * S + 0.2)
				win.CFrame = b.CFrame * CFrame.new(rand(-0.1, 0.1) * w * S, -h * S / 2 + f * 6 * S - 3, 0)
				win.Transparency = 0.25
				win.Parent = statics
			end
		end
	end
end
local function containers(list)
	local CW, CH, CD = 6.1, 2.6, 2.45
	for _, c in ipairs(list) do
		local w, d = c[3] == 1 and CD or CW, c[3] == 1 and CW or CD
		for s = 0, c[5] - 1 do
			local col = CONTAINER[((c[4] + s * 2 - 1) % #CONTAINER) + 1]
			box(statics, c[1], s * CH, c[2], w, CH, d, MAT.Metal, col)
			deco(c[1], s * CH + CH - 0.12, c[2], w + 0.06, 0.12, d + 0.06, MAT.Metal, col:Lerp(Color3.new(), 0.4))
		end
	end
end
local function smokeStack(x, z, h)
	local st = cylinder(x, 0, z, 2.5, h, MAT.Concrete, RGB(60, 58, 60), { CanCollide = false, CanQuery = false })
	st.CastShadow = false
	local top = neon(x, h + 0.3, z, 0.8, 0.8, 0.8, C.red)
	local smoke = Instance.new("ParticleEmitter")
	smoke.Texture = Config.Textures.Smoke
	smoke.Rate = 6
	smoke.Lifetime = NumberRange.new(9, 13)
	smoke.Speed = NumberRange.new(8, 14)
	smoke.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 12), NumberSequenceKeypoint.new(1, 55) })
	smoke.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.6), NumberSequenceKeypoint.new(1, 1) })
	smoke.Color = ColorSequence.new(RGB(70, 64, 66))
	smoke.Acceleration = Vector3.new(6, 2, 0)
	smoke.EmissionDirection = Enum.NormalId.Top
	smoke.Parent = top
end

-- ---------------------------------------------------------------- lighting presets
local function setLighting(t)
	for _, c in ipairs(Lighting:GetChildren()) do
		if c:IsA("PostEffect") or c:IsA("Atmosphere") or c:IsA("Sky") then c:Destroy() end
	end
	Lighting.ClockTime = t.clock
	Lighting.Brightness = t.brightness
	Lighting.Ambient = t.ambient
	Lighting.OutdoorAmbient = t.outdoor
	Lighting.EnvironmentDiffuseScale = 0.45
	Lighting.EnvironmentSpecularScale = 0.8
	Lighting.GlobalShadows = true
	Lighting.ExposureCompensation = t.exposure or 0
	local atmo = Instance.new("Atmosphere")
	atmo.Density, atmo.Offset, atmo.Color, atmo.Decay, atmo.Glare, atmo.Haze = t.density, 0.12, t.atmo, t.decay, 0.5, t.haze or 1.6
	atmo.Parent = Lighting
	local bloom = Instance.new("BloomEffect")
	bloom.Intensity, bloom.Size, bloom.Threshold = 0.7, 26, 1.4
	bloom.Parent = Lighting
	local cc = Instance.new("ColorCorrectionEffect")
	cc.Name = "Grade"
	cc.Contrast, cc.Saturation, cc.TintColor = 0.12, 0.05, t.tint or RGB(255, 244, 236)
	cc.Parent = Lighting
	local rays = Instance.new("SunRaysEffect")
	rays.Intensity, rays.Spread = 0.07, 0.6
	rays.Parent = Lighting
	local sky = Instance.new("Sky")
	sky.StarCount = t.stars or 2500
	sky.SunAngularSize = 14
	sky.Parent = Lighting
end
MapBuilder.baseLighting = nil
function MapBuilder.setBlackout(on: boolean)
	local atmo = Lighting:FindFirstChildOfClass("Atmosphere")
	local base = MapBuilder.baseLighting
	if not atmo or not base then return end
	local goal = on and { Density = 0.82 } or { Density = base.density }
	TweenService:Create(atmo, TweenInfo.new(1.5), goal):Play()
	TweenService:Create(Lighting, TweenInfo.new(1.5), { Brightness = on and base.brightness * 0.3 or base.brightness }):Play()
end

-- ---------------------------------------------------------------- Night of Terror dressing
-- A blood-moon night, purple fog, and pumpkins, gravestones and dead trees scattered on open ground.
local HALLOWEEN_LIGHT = { clock = 0.2, brightness = 1.2, ambient = RGB(52, 36, 70), outdoor = RGB(80, 56, 110), density = 0.42, atmo = RGB(90, 40, 110), decay = RGB(40, 14, 40), exposure = 0.25, tint = RGB(232, 214, 255), stars = 5000 }
local function jackOLantern(parent, pos: Vector3, size: number)
	local p = Instance.new("Part")
	p.Name, p.Shape, p.Anchored, p.CanCollide = "Pumpkin", Enum.PartType.Ball, true, false
	p.Size = Vector3.new(size * 1.2, size, size * 1.2)
	p.Color, p.Material = RGB(232, 118, 28), MAT.SmoothPlastic
	p.CFrame = CFrame.new(pos + Vector3.new(0, size * 0.45, 0)) * CFrame.Angles(0, rand(0, math.pi * 2), 0)
	p.Parent = parent
	local stem = Instance.new("Part")
	stem.Anchored, stem.CanCollide, stem.Size, stem.Color, stem.Material = true, false, Vector3.new(0.3, 0.6, 0.3) * size, RGB(70, 110, 40), MAT.Wood
	stem.CFrame = p.CFrame * CFrame.new(0, size * 0.55, 0)
	stem.Parent = parent
	for _, x in ipairs({ -0.22, 0.22 }) do
		local eye = Instance.new("Part")
		eye.Anchored, eye.CanCollide, eye.Size, eye.Color, eye.Material = true, false, Vector3.new(0.2, 0.18, 0.05) * size, RGB(255, 190, 60), MAT.Neon
		eye.CFrame = p.CFrame * CFrame.new(x * size, 0.12 * size, -0.6 * size) * CFrame.Angles(0, 0, math.rad(45))
		eye.Parent = parent
	end
	local grin = Instance.new("Part")
	grin.Anchored, grin.CanCollide, grin.Size, grin.Color, grin.Material = true, false, Vector3.new(0.55, 0.12, 0.05) * size, RGB(255, 190, 60), MAT.Neon
	grin.CFrame = p.CFrame * CFrame.new(0, -0.15 * size, -0.58 * size)
	grin.Parent = parent
	local l = Instance.new("PointLight")
	l.Color, l.Range, l.Brightness, l.Shadows = RGB(255, 140, 40), size * 4, 1.6, false
	l.Parent = p
end
local function gravestone(parent, pos: Vector3)
	local rot = CFrame.Angles(0, rand(-0.3, 0.3), rand(-0.12, 0.12))
	local slab = Instance.new("Part")
	slab.Name, slab.Anchored, slab.CanCollide = "Grave", true, true
	slab.Size, slab.Color, slab.Material = Vector3.new(2.8, 3.4, 0.7), RGB(110, 112, 118), MAT.Slate
	slab.CFrame = CFrame.new(pos + Vector3.new(0, 1.5, 0)) * rot
	slab.Parent = parent
	local top = Instance.new("Part")
	top.Shape, top.Anchored, top.CanCollide = Enum.PartType.Cylinder, true, false
	top.Size, top.Color, top.Material = Vector3.new(0.7, 2.8, 2.8), slab.Color, MAT.Slate
	top.CFrame = slab.CFrame * CFrame.new(0, 1.7, 0) * CFrame.Angles(0, math.pi / 2, 0)
	top.Parent = parent
	local mound = Instance.new("Part")
	mound.Anchored, mound.CanCollide, mound.Size, mound.Color, mound.Material = true, false, Vector3.new(3.4, 0.6, 5.5), RGB(50, 40, 32), MAT.Ground
	mound.CFrame = CFrame.new(pos + Vector3.new(0, 0.15, -3)) * rot
	mound.Parent = parent
end
local function deadTree(parent, pos: Vector3)
	local trunkH = rand(9, 14)
	local wood = RGB(40, 32, 30)
	local trunk = Instance.new("Part")
	trunk.Name, trunk.Anchored, trunk.CanCollide = "DeadTree", true, true
	trunk.Size, trunk.Color, trunk.Material = Vector3.new(1.3, trunkH, 1.3), wood, MAT.Wood
	trunk.CFrame = CFrame.new(pos + Vector3.new(0, trunkH / 2, 0)) * CFrame.Angles(0, rand(0, 6), rand(-0.08, 0.08))
	trunk.Parent = parent
	for i = 1, 4 do
		local len = rand(4, 7)
		local b = Instance.new("Part")
		b.Anchored, b.CanCollide, b.Size, b.Color, b.Material = true, false, Vector3.new(0.5, len, 0.5), wood, MAT.Wood
		b.CFrame = trunk.CFrame * CFrame.new(0, trunkH * (0.1 + i * 0.1), 0) * CFrame.Angles(0, i * 1.7, rand(0.6, 1.1)) * CFrame.new(0, len / 2, 0)
		b.Parent = parent
	end
end

local halloweenFolder: Folder? = nil
local mapHalf, mapCeiling = 60, math.huge
function MapBuilder.setHalloween(on: boolean)
	if halloweenFolder then halloweenFolder:Destroy(); halloweenFolder = nil end
	if not on then
		if MapBuilder.baseLighting then setLighting(MapBuilder.baseLighting) end
		return
	end
	setLighting(HALLOWEEN_LIGHT)
	local moon = Lighting:FindFirstChildOfClass("Sky")
	if moon then moon.MoonAngularSize = 22; moon.SunAngularSize = 0 end
	local cc = Lighting:FindFirstChild("Grade") :: ColorCorrectionEffect?
	if cc then cc.Saturation = 0.12; cc.Contrast = 0.18 end
	if not root or not root.Parent then return end
	local folder = Instance.new("Folder")
	folder.Name = "Halloween"
	folder.Parent = root
	halloweenFolder = folder
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Include
	params.FilterDescendantsInstances = { statics }
	local half = mapHalf - 4
	local placed, tries = 0, 0
	while placed < 46 and tries < 400 do
		tries += 1
		local x, z = rand(-half, half), rand(-half, half)
		local hit = workspace:Raycast(Vector3.new(x * S, 400, z * S), Vector3.new(0, -800, 0), params)
		if hit and hit.Normal.Y > 0.9 and free(x, z, 1.4, hit.Position.Y / S + 0.1, hit.Position.Y / S + 2.5) then
			placed += 1
			local r = placed % 6
			if r <= 2 then jackOLantern(folder, hit.Position, rand(1.8, 3))
			elseif r <= 4 then gravestone(folder, hit.Position)
			elseif mapCeiling > 20 then deadTree(folder, hit.Position)
			else jackOLantern(folder, hit.Position, 1.6) end
		end
	end
end

-- ---------------------------------------------------------------- maps
local MAPS = {}

MAPS.yard = {
	half = 72, spawn = { 0, 3, 0 }, crate = { -12, 24 }, forge = { 12, -24 },
	spawns = { { -64, -64 }, { 64, -64 }, { -64, 64 }, { 64, 64 }, { 0, -64 }, { 0, 64 }, { -64, 0 }, { 64, 0 }, { -30, -64 }, { 30, 64 }, { 64, 30 }, { -64, -30 } },
	light = { clock = 18.35, brightness = 2.4, ambient = RGB(38, 36, 48), outdoor = RGB(96, 88, 110), density = 0.36, atmo = RGB(214, 150, 120), decay = RGB(92, 70, 96) },
	build = function()
		box(statics, 0, -1, 0, 420, 1, 420, MAT.Concrete, C.ground, { Name = "Ground" })
		for _, l in ipairs({ { 0, -36, 0.35, 44 }, { 0, 36, 0.35, 44 }, { -36, 0, 44, 0.35 }, { 36, 0, 44, 0.35 } }) do deco(l[1], 0, l[2], l[3], 0.02, l[4], MAT.SmoothPlastic, C.hazard) end
		perimeter(72, 9, MAT.Metal, C.wall, true)
		for _, wh in ipairs({ { -44, -44, 24, 11, 18 }, { 46, -40, 18, 13, 26 }, { -46, 42, 20, 10, 22 }, { 42, 46, 26, 11, 16 } }) do
			local x, z, w, h, d = wh[1], wh[2], wh[3], wh[4], wh[5]
			box(statics, x, 0, z, w, h, d, MAT.Metal, C.wall)
			deco(x, h, z, w + 1, 0.6, d + 1, MAT.Metal, C.dark)
			if math.abs(x) > math.abs(z) then
				local fx = x - math.sign(x) * (w / 2 + 0.05)
				deco(fx, 0, z, 0.1, 6, 7, MAT.Metal, RGB(93, 100, 105)); neon(fx - math.sign(x) * 0.05, 6.5, z, 0.1, 0.18, 8, C.strip)
			else
				local fz = z - math.sign(z) * (d / 2 + 0.05)
				deco(x, 0, fz, 7, 6, 0.1, MAT.Metal, RGB(93, 100, 105)); neon(x, 6.5, fz - math.sign(z) * 0.05, 8, 0.18, 0.1, C.strip)
			end
		end
		local P, H = 7, 3
		box(statics, 0, 0, 0, P * 2, H, P * 2, MAT.Concrete, C.concrete)
		for _, s in ipairs({ 1, -1 }) do
			stairs(0, s * P, s > 0 and "z-" or "z+", 4.4, 5, 0.5, 0.8, MAT.Concrete, C.concrete)
			box(statics, s * (P - 0.15), H, 0, 0.3, 1.1, P * 2, MAT.DiamondPlate, C.steel)
			box(statics, s * 4.6, H, P - 0.15, 4.8, 1.1, 0.3, MAT.DiamondPlate, C.steel)
			box(statics, s * 4.6, H, -(P - 0.15), 4.8, 1.1, 0.3, MAT.DiamondPlate, C.steel)
		end
		containers({ { -20, -12, 0, 1, 2 }, { 22, 14, 1, 2, 1 }, { 18, -22, 0, 3, 1 }, { -14, 24, 1, 4, 1 }, { -30, 5, 1, 5, 2 }, { 30, -5, 1, 1, 1 }, { 5, -32, 0, 6, 1 }, { -6, 34, 0, 2, 2 }, { 55, 10, 1, 3, 1 }, { -56, -8, 1, 4, 1 }, { 12, 52, 0, 5, 1 }, { -10, -54, 0, 1, 1 }, { -24, -30, 1, 2, 1 }, { 26, 30, 0, 6, 1 } })
		for _, a in ipairs({ { -26, -20 }, { 28, 22 }, { -8, -18 }, { 10, 20 }, { 34, -20 }, { -34, 20 }, { 0, -46 }, { 0, 46 }, { -58, 24 }, { 58, -22 }, { -40, -12 }, { 40, 8 } }) do crates(a[1], a[2], 3) end
		for _, b in ipairs({ { -12, -2, 0 }, { 12, 2, 0 }, { -2, 18, 1 }, { 2, -18, 1 }, { -36, -36, 1 }, { 36, 36, 1 }, { -50, -26, 0 }, { 50, 26, 0 } }) do
			box(statics, b[1], 0, b[2], b[3] == 1 and 0.7 or 3.2, 1.1, b[3] == 1 and 3.2 or 0.7, MAT.Concrete, C.concrete)
		end
		for _, l in ipairs({ { -22, -22 }, { 22, 22 }, { 22, -22 }, { -22, 22 } }) do lamp(l[1], l[2]) end
		for _, b in ipairs({ { -17, -6 }, { -16.2, -5.2 }, { 24, 6 }, { 8, -24 }, { -24, 30 }, { 30, -30 }, { -40, -24 }, { 40, 24 }, { 14, 40 }, { -12, -40 }, { 52, -8 }, { -52, 8 }, { 9, 9 }, { -9, -9 } }) do drum(b[1], b[2]) end
		skyline(40, 120, 190, 18, 90)
		smokeStack(-86, -96, 48); smokeStack(-62, -104, 44); smokeStack(96, -70, 46)
	end,
}

MAPS.factory = {
	half = 50, spawn = { 0, 0, 0 }, crate = { -8, 5 }, forge = { 8, -5 },
	spawns = { { -45, -42 }, { 45, -42 }, { -45, 42 }, { 45, 42 }, { 0, -45 }, { 0, 45 }, { -45, 0 }, { 45, 6 }, { -25, -45 }, { 25, 45 } },
	light = { clock = 15.5, brightness = 1.6, ambient = RGB(48, 40, 36), outdoor = RGB(88, 72, 60), density = 0.42, atmo = RGB(140, 100, 70), decay = RGB(70, 50, 40), stars = 0, exposure = -0.1 },
	build = function()
		box(statics, 0, -1, 0, 220, 1, 220, MAT.Concrete, RGB(150, 140, 132), { Name = "Ground" })
		perimeter(50, 14, MAT.CorrodedMetal, C.rust, true)
		for x = -45, 45, 10 do for z = -45, 45, 10 do if rng:NextNumber() > 0.35 then deco(x, 14, z, 10, 0.3, 10, MAT.CorrodedMetal, C.rust).CastShadow = true end end end
		for x = -40, 40, 10 do deco(x, 13.2, 0, 0.5, 0.8, 100, MAT.Metal, C.steel) end
		for _, x in ipairs({ -30, -10, 10, 30 }) do for _, z in ipairs({ -30, 30 }) do box(statics, x, 0, z, 0.9, 14, 0.9, MAT.Metal, C.steel) end end
		for _, z in ipairs({ -18, 18 }) do
			for _, r in ipairs({ { -38, -2.5 }, { 2.5, 38 } }) do
				local w, cx = r[2] - r[1], (r[1] + r[2]) / 2
				box(statics, cx, 0, z, w, 1.0, 2.2, MAT.Metal, C.dark)
				deco(cx, 1.0, z - 1.05, w, 0.25, 0.1, MAT.SmoothPlastic, C.hazard); deco(cx, 1.0, z + 1.05, w, 0.25, 0.1, MAT.SmoothPlastic, C.hazard)
			end
		end
		for _, p in ipairs({ { -21, 0 }, { 21, 0 }, { 0, -32 }, { 0, 32 } }) do
			local x, z = p[1], p[2]
			box(statics, x, 0, z, 5, 1.6, 5, MAT.CorrodedMetal, C.rust)
			for _, o in ipairs({ { -2.2, -2.2 }, { 2.2, -2.2 }, { -2.2, 2.2 }, { 2.2, 2.2 } }) do box(statics, x + o[1], 1.6, z + o[2], 0.6, 7, 0.6, MAT.Metal, C.steel) end
			deco(x, 8.6, z, 5.2, 1.2, 5.2, MAT.CorrodedMetal, C.rust)
			local head = box(statics, x, 2.3, z, 3.6, 1.4, 3.6, MAT.Metal, C.steel, { CanCollide = false })
			local tw = TweenService:Create(head, TweenInfo.new(1.6, Enum.EasingStyle.Quad, Enum.EasingDirection.InOut, -1, true, rand(0, 1.5)), { CFrame = head.CFrame + Vector3.new(0, 5.4 * S, 0) })
			tw:Play()
		end
		box(statics, -42, 0, -2, 8, 10, 14, MAT.CorrodedMetal, C.rust)
		local mouth = neon(-37.95, 0.5, -2, 0.1, 3.4, 5, RGB(255, 122, 32))
		local fire = Instance.new("Fire"); fire.Size, fire.Heat = 12, 8; fire.Parent = mouth
		pointLight(-35.5, 2.2, -2, RGB(255, 106, 32), 3, 60)
		box(statics, 36, 0, 0, 10, 3.2, 18, MAT.CorrodedMetal, C.rust)
		stairs(31, 0, "x+", 4, 6, 0.53, 0.8, MAT.Metal, C.steel)
		box(statics, 36, 3.2, 8.85, 10, 1.1, 0.25, MAT.Metal, C.steel); box(statics, 36, 3.2, -8.85, 10, 1.1, 0.25, MAT.Metal, C.steel)
		for _, a in ipairs({ { -12, -8 }, { 12, 8 }, { -15, 28 }, { 15, -28 }, { -30, 40 }, { 30, -40 }, { -8, 42 }, { 8, -42 } }) do crates(a[1], a[2], 3) end
		for _, b in ipairs({ { -5, -12 }, { 5, 12 }, { -28, 10 }, { 28, -10 }, { -40, 30 }, { 42, -30 }, { 16, -4 }, { -16, 4 } }) do drum(b[1], b[2]) end
		for _, l in ipairs({ { -20, -10 }, { 20, 10 }, { -20, 20 }, { 20, -20 }, { 0, 0 } }) do pointLight(l[1], 10.4, l[2], RGB(255, 160, 72), 2, 70) end
	end,
}

MAPS.rooftops = {
	half = 48, spawn = { 0, 2.5, 0 }, crate = { -14, -6 }, forge = { 14, 6 },
	spawns = { { -43, -43 }, { 43, -43 }, { -43, 43 }, { 43, 43 }, { 0, -43 }, { 0, 43 }, { -43, 0 }, { 43, 0 }, { -20, 43 }, { 20, -43 } },
	light = { clock = 0.5, brightness = 1.2, ambient = RGB(50, 54, 90), outdoor = RGB(80, 80, 130), density = 0.3, atmo = RGB(90, 60, 120), decay = RGB(40, 30, 70), exposure = 0.2 },
	build = function()
		box(statics, 0, -1, 0, 100, 1, 100, MAT.Pebble, RGB(91, 90, 87), { Name = "Ground" })
		box(statics, 0, -121, 0, 100, 120, 100, MAT.Concrete, RGB(21, 26, 34), { CanCollide = false, CanQuery = false })
		for _, w in ipairs({ { 0, -49, 100, 2 }, { 0, 49, 100, 2 }, { -49, 0, 2, 100 }, { 49, 0, 2, 100 } }) do box(statics, w[1], 0, w[2], w[3], 1.4, w[4], MAT.Concrete, C.concrete) end
		skyline(36, 90, 200, 60, 180, -120)
		box(statics, 0, 0, 0, 16, 2, 16, MAT.Concrete, C.concrete)
		stairs(0, 8, "z-", 4, 4, 0.5, 0.8, MAT.Metal, C.steel); stairs(0, -8, "z+", 4, 4, 0.5, 0.8, MAT.Metal, C.steel)
		for i = 0, 11 do local a = i / 12 * math.pi * 2; neon(math.cos(a) * 7.4, 2, math.sin(a) * 7.4, 0.3, 0.12, 0.3, C.cyan) end
		for _, h in ipairs({ { -30, -26, C.magenta }, { 28, 30, C.cyan }, { -32, 30, C.cyan } }) do
			box(statics, h[1], 0, h[2], 5, 3.6, 4, MAT.Concrete, C.concrete)
			neon(h[1], 3.3, h[2] + 2.05, 5.1, 0.12, 0.12, h[3])
		end
		for _, a in ipairs({ { -18, -10 }, { -14, -14 }, { 18, 12 }, { 22, 8 }, { -8, 22 }, { 10, -22 }, { 34, -8 }, { -36, 8 }, { 6, 34 }, { -24, 40 }, { 38, 40 }, { -40, -40 } }) do
			if free(a[1], a[2], 1.6, 0.1, 1.5) then box(statics, a[1], 0, a[2], 2.2, 1.6, 2.2, MAT.Metal, C.steel) end
		end
		for _, o in ipairs({ { -2, -2 }, { 2, -2 }, { -2, 2 }, { 2, 2 } }) do box(statics, 32 + o[1], 0, -30 + o[2], 0.4, 5, 0.4, MAT.Metal, C.steel) end
		cylinder(32, 5, -30, 3, 4.2, MAT.WoodPlanks, RGB(106, 74, 54))
		box(statics, -44, 0, 12, 0.4, 10, 0.4, MAT.Metal, C.steel); box(statics, -44, 0, 24, 0.4, 10, 0.4, MAT.Metal, C.steel)
		local bb = neon(-43.7, 4.5, 18, 0.2, 6, 14, C.magenta); bb.Transparency = 0.15
		for i = 0, 3 do box(statics, 22, 0, -10 + i * 3.2, 8, 0.9, 1.8, MAT.Glass, RGB(27, 42, 74)) end
		box(statics, 40, 0, -44, 0.35, 16, 0.35, MAT.Metal, C.steel); neon(40, 16.2, -44, 0.6, 0.6, 0.6, C.red)
		for _, a in ipairs({ { -20, 14 }, { 14, -38 }, { -6, -36 } }) do crates(a[1], a[2], 3) end
		for _, b in ipairs({ { -12, 8 }, { 12, -8 }, { -26, -4 }, { 26, 4 }, { 0, 40 }, { 0, -40 } }) do drum(b[1], b[2]) end
		pointLight(-20, 5, -20, C.cyan, 2, 60); pointLight(20, 5, 20, C.magenta, 2, 60)
	end,
}

MAPS.desert = {
	half = 70, spawn = { 0, 0, 6 }, crate = { -8, -10 }, forge = { 10, 12 },
	spawns = { { -64, -60 }, { 64, -60 }, { -64, 60 }, { 64, 60 }, { 0, -64 }, { 0, 64 }, { -64, 0 }, { 64, 0 }, { -34, 64 }, { 34, -64 } },
	light = { clock = 12.8, brightness = 3, ambient = RGB(110, 100, 90), outdoor = RGB(150, 140, 125), density = 0.3, atmo = RGB(220, 196, 160), decay = RGB(200, 170, 130), stars = 0, haze = 2.4, tint = RGB(255, 246, 230) },
	build = function()
		box(statics, 0, -1, 0, 520, 1, 520, MAT.Sand, C.sand, { Name = "Ground" })
		perimeter(70, 4.5, MAT.Concrete, RGB(217, 204, 180), false)
		for _, hg in ipairs({ { -42, -38 }, { 42, -38 }, { -42, 38 } }) do
			box(statics, hg[1], 0, hg[2], 18, 6, 13, MAT.Metal, RGB(201, 185, 154))
			local roof = cylinder(hg[1], 6 - 6.8, hg[2], 6.8, 18.4, MAT.Metal, RGB(124, 127, 106))
			roof.CFrame = CFrame.new(hg[1] * S, 6 * S, hg[2] * S) * CFrame.Angles(0, 0, math.pi / 2)
			roof.CanCollide = false
			box(statics, hg[1], 6, hg[2], 18, 6, 13, MAT.Metal, RGB(124, 127, 106), { Transparency = 1, CanQuery = false })
		end
		box(statics, 42, 0, 40, 14, 5, 10, MAT.Concrete, RGB(205, 191, 164))
		for _, t in ipairs({ { -58, -58 }, { 58, -58 }, { -58, 58 }, { 58, 58 } }) do
			for _, o in ipairs({ { -1.6, -1.6 }, { 1.6, -1.6 }, { -1.6, 1.6 }, { 1.6, 1.6 } }) do box(statics, t[1] + o[1], 0, t[2] + o[2], 0.35, 6, 0.35, MAT.WoodPlanks, RGB(107, 90, 64)) end
			box(statics, t[1], 6, t[2], 4.2, 1.5, 4.2, MAT.Sand, C.sand)
			deco(t[1], 9, t[2], 4.8, 0.2, 4.8, MAT.Fabric, RGB(70, 85, 58))
		end
		local function nest(x, z)
			box(statics, x, 0, z - 1.6, 4, 1.1, 0.8, MAT.Sand, C.sand); box(statics, x - 1.6, 0, z, 0.8, 1.1, 2.6, MAT.Sand, C.sand); box(statics, x + 1.6, 0, z, 0.8, 1.1, 2.6, MAT.Sand, C.sand)
		end
		nest(0, -18); nest(0, 22); nest(-20, 0); nest(20, 0); nest(-18, -52); nest(18, 54)
		for _, r in ipairs({ { -30, -12, 5, "x" }, { 24, 14, 5, "x" }, { -10, 36, 4, "z" }, { 10, -40, 4, "z" }, { 52, 0, 5, "z" }, { -54, 16, 5, "z" } }) do
			for i = 0, r[3] - 1 do box(statics, r[4] == "x" and r[1] + i * 1.35 or r[1], 0, r[4] == "z" and r[2] + i * 1.35 or r[2], 1.3, 1.4, 1.3, MAT.Sand, RGB(185, 165, 124)) end
		end
		cylinder(30, 0, -12, 2.8, 5, MAT.Metal, RGB(227, 221, 208)); cylinder(37, 0, -12, 2.8, 5, MAT.Metal, RGB(227, 221, 208))
		containers({ { 8, 12, 0, 1, 1 }, { -24, -24, 1, 5, 1 }, { 26, 34, 1, 4, 1 }, { -38, 8, 0, 2, 1 } })
		for _, a in ipairs({ { -6, -6 }, { 6, 8 }, { 30, -20 }, { -44, -20 }, { 44, 20 }, { -8, 40 } }) do crates(a[1], a[2], 3) end
		for _, b in ipairs({ { -2, -8 }, { 4, 6 }, { 34, -18 }, { -40, 22 }, { -26, -40 }, { 26, 44 }, { 48, -6 }, { -14, 10 } }) do drum(b[1], b[2]) end
	end,
}

MAPS.lab = {
	half = 38, ceiling = 7, spawn = { 0, 0, 22 }, crate = { -7, 25 }, forge = { 7, 25 },
	spawns = { { -34, -30 }, { 34, -30 }, { -34, 30 }, { 34, 30 }, { 0, -34 }, { -34, 0 }, { 34, 0 }, { -18, -34 }, { 18, -34 } },
	light = { clock = 0, brightness = 0.6, ambient = RGB(120, 140, 150), outdoor = RGB(90, 120, 130), density = 0.45, atmo = RGB(40, 90, 100), decay = RGB(20, 40, 50), stars = 0, exposure = 0.3, tint = RGB(230, 248, 255) },
	build = function()
		box(statics, 0, -1, 0, 80, 1, 80, MAT.SmoothPlastic, C.tile, { Name = "Ground" })
		perimeter(38, 7, MAT.SmoothPlastic, C.labwall, false)
		box(statics, 0, 7, 0, 80, 0.5, 80, MAT.Metal, RGB(26, 35, 40))
		for x = -30, 30, 10 do neon(x, 6.95, 0, 0.4, 0.05, 64, C.white) end
		box(statics, 0, 0, 0, 7, 0.6, 7, MAT.Metal, C.steel)
		cylinder(0, 0.6, 0, 1.4, 6.4, MAT.Neon, C.cyan, { CanCollide = false })
		cylinder(0, 0.6, 0, 2.6, 6.4, MAT.Glass, RGB(159, 216, 255), { Transparency = 0.6 })
		pointLight(0, 3.5, 0, C.cyan, 3, 70)
		for _, t in ipairs({ { -14, -14 }, { -14, 14 }, { 14, -14 }, { 14, 14 }, { -22, 0 }, { 22, 0 } }) do
			cylinder(t[1], 0, t[2], 1.3, 0.5, MAT.Metal, C.steel)
			cylinder(t[1], 0.5, t[2], 1.1, 3.6, MAT.Neon, C.green, { CanCollide = false, Transparency = 0.45 })
			cylinder(t[1], 0.5, t[2], 1.3, 3.6, MAT.Glass, RGB(159, 216, 255), { Transparency = 0.6 })
			cylinder(t[1], 4.1, t[2], 1.35, 0.4, MAT.Metal, C.steel)
		end
		for _, x in ipairs({ -30, 30 }) do for _, z in ipairs({ -24, -8, 8, 24 }) do
			box(statics, x, 0, z, 1.2, 2.6, 6, MAT.Metal, RGB(18, 22, 27)); box(statics, x + (x > 0 and -3 or 3), 0, z, 1.2, 2.6, 6, MAT.Metal, RGB(18, 22, 27))
			neon(x + (x > 0 and -0.62 or 0.62), 1.3, z, 0.02, 2, 5, C.green)
		end end
		for _, b in ipairs({ { -6, 12, 0 }, { 6, -12, 0 }, { -8, -20, 1 }, { 8, 20, 1 }, { 0, 30, 0 }, { 0, -30, 0 } }) do
			box(statics, b[1], 0, b[2], b[3] == 1 and 1.2 or 3.4, 1, b[3] == 1 and 3.4 or 1.2, MAT.Metal, C.steel)
		end
		for _, g in ipairs({ { -10, 0, 0.2, 8 }, { 10, 0, 0.2, 8 }, { 0, -10, 8, 0.2 }, { 0, 10, 8, 0.2 } }) do box(statics, g[1], 0, g[2], g[3], 3, g[4], MAT.Glass, RGB(159, 216, 255), { Transparency = 0.6 }) end
		for _, x in ipairs({ -20, 20 }) do for _, z in ipairs({ -28, 28 }) do box(statics, x, 0, z, 1, 7, 1, MAT.SmoothPlastic, C.labwall) end end
		for _, a in ipairs({ { -37.9, -15 }, { 37.9, 15 }, { 15, -37.9 }, { -15, 37.9 } }) do neon(a[1], 5.2, a[2], 0.6, 0.25, 0.6, C.red) end
		for _, b in ipairs({ { -26, -32 }, { 26, 32 }, { -4, 34 }, { 4, -34 }, { -26, 16 }, { 26, -16 } }) do drum(b[1], b[2]) end
		for _, a in ipairs({ { -18, 32 }, { 18, -32 } }) do crates(a[1], a[2], 2) end
		for _, l in ipairs({ { -20, -20 }, { 20, 20 }, { -20, 20 }, { 20, -20 } }) do pointLight(l[1], 6, l[2], C.white, 1.6, 60) end
	end,
}

-- ---------------------------------------------------------------- stations
local function station(kind, x, z)
	for ring = 0, 25 do
		local found = false
		for k = 0, 11 do
			local a = k / 12 * math.pi * 2
			local px, pz = x + math.cos(a) * ring * 1.2, z + math.sin(a) * ring * 1.2
			if free(px, pz, 1.3, 0.1, 2.4) then x, z = px, pz; found = true; break end
			if ring == 0 then break end
		end
		if found then break end
	end
	local model = Instance.new("Model")
	model.Name = kind == "crate" and "MysteryCrate" or "OverclockForge"
	local body
	if kind == "crate" then
		body = box(model, x, 0, z, 1.6, 0.9, 1, MAT.Metal, RGB(35, 48, 58))
		local lid = box(model, x, 0.9, z, 1.64, 0.14, 1.04, MAT.Neon, C.cyan, { CanCollide = false })
		lid.Name = "Lid"
		local beam = box(model, x, 1, z, 1.2, 7, 1.2, MAT.ForceField, C.cyan, { CanCollide = false, CanQuery = false, CastShadow = false })
		beam.Transparency = 0.6
	else
		body = box(model, x, 0, z, 1.5, 2.2, 1.1, MAT.Metal, RGB(43, 47, 53))
		for i = 0, 2 do
			local ring = Instance.new("Part")
			ring.Shape = Enum.PartType.Cylinder
			ring.Anchored, ring.CanCollide, ring.CanQuery = true, false, false
			ring.Material = MAT.Neon
			ring.Color = RGB(255, 122, 46)
			ring.Size = Vector3.new(0.05 * S, (0.84 - i * 0.2) * S, (0.84 - i * 0.2) * S)
			ring.CFrame = CFrame.new(x * S, 1.25 * S, (z + 0.56) * S + i * 0.02) * CFrame.Angles(0, math.pi / 2, 0)
			ring.Parent = model
		end
	end
	body.Name = "Body"
	model.PrimaryPart = body
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = kind == "crate" and "Mystery crate" or "Overclock weapon"
	prompt.ObjectText = kind == "crate" and (Config.CrateCost .. " coins") or "Forge"
	prompt.KeyboardKeyCode = Enum.KeyCode.E
	prompt.GamepadKeyCode = Enum.KeyCode.DPadLeft
	prompt.MaxActivationDistance = 10
	prompt.RequiresLineOfSight = false
	prompt.Parent = body
	model.Parent = root
	return model, prompt
end

-- ---------------------------------------------------------------- build
function MapBuilder.build(id: string)
	local def = MAPS[id] or MAPS.yard
	local old = workspace:FindFirstChild("FoundryMap")
	if old then old:Destroy() end
	root = Instance.new("Model")
	root.Name = "FoundryMap"
	root.Parent = workspace
	statics = Instance.new("Folder")
	statics.Name = "Static"
	statics.Parent = root
	drumFolder = Instance.new("Folder")
	drumFolder.Name = "Drums"
	drumFolder.Parent = root
	setLighting(def.light)
	MapBuilder.baseLighting = def.light
	mapHalf, mapCeiling = def.half, def.ceiling or math.huge
	halloweenFolder = nil
	def.build()
	for _, n in ipairs({ "Enemies", "Pickups", "Projectiles", "Debris" }) do
		local f = workspace:FindFirstChild(n) or Instance.new("Folder")
		f.Name = n
		f.Parent = workspace
		f:ClearAllChildren()
	end
	local spawn = workspace:FindFirstChild("FoundrySpawn") :: SpawnLocation?
	if not spawn then
		local s = Instance.new("SpawnLocation")
		s.Name = "FoundrySpawn"
		s.Anchored = true
		s.Neutral = true
		s.Duration = 0
		s.Transparency = 1
		s.CanCollide = false
		s.Size = Vector3.new(6, 1, 6)
		s.Parent = workspace
		spawn = s
	end
	local ps = def.spawn
	if spawn then spawn.CFrame = CFrame.new(ps[1] * S, ps[2] * S + 3, ps[3] * S) end
	local spawns = {}
	for _, p in ipairs(def.spawns) do if free(p[1], p[2], 1, 0.1, 2) then table.insert(spawns, Vector3.new(p[1] * S, 4, p[2] * S)) end end
	local templates = {}
	for _, d in ipairs(drumFolder:GetChildren()) do table.insert(templates, d:Clone()) end
	local crate, cratePrompt = station("crate", def.crate[1], def.crate[2])
	local forge, forgePrompt = station("forge", def.forge[1], def.forge[2])
	return {
		id = id, name = Config.MapById[id].name, half = def.half * S, ceiling = def.ceiling and def.ceiling * S or math.huge,
		spawnPoints = spawns, drumFolder = drumFolder, drumTemplates = templates,
		crate = crate, cratePrompt = cratePrompt, forge = forge, forgePrompt = forgePrompt,
	}
end

return MapBuilder
