-- Builds the Yard 9 freight terminal, its lighting and atmosphere.
local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage:WaitForChild("FoundryShared"):WaitForChild("Config"))

local S = Config.METER
local MapBuilder = {}

local rng = Random.new(9)
local function rand(a, b) return a + rng:NextNumber() * (b - a) end

local root

-- x, z = centre, y = bottom, all in meters
local function box(parent, x, y, z, w, h, d, material, color, props)
	local p = Instance.new("Part")
	p.Anchored = true
	p.Size = Vector3.new(w * S, h * S, d * S)
	p.CFrame = CFrame.new(x * S, (y + h / 2) * S, z * S)
	p.Material = material
	p.Color = color
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	if props then for k, v in pairs(props) do p[k] = v end end
	p.Parent = parent or root
	return p
end

local function neon(parent, x, y, z, w, h, d, color)
	return box(parent, x, y, z, w, h, d, Enum.Material.Neon, color, { CanCollide = false, CastShadow = false, CanQuery = false })
end

local function folder(name)
	local f = Instance.new("Folder")
	f.Name = name
	f.Parent = root
	return f
end

local function setupLighting()
	Lighting.ClockTime = 18.35
	Lighting.GeographicLatitude = 38
	Lighting.Brightness = 2.4
	Lighting.Ambient = Color3.fromRGB(38, 36, 48)
	Lighting.OutdoorAmbient = Color3.fromRGB(96, 88, 110)
	Lighting.EnvironmentDiffuseScale = 0.45
	Lighting.EnvironmentSpecularScale = 0.8
	Lighting.GlobalShadows = true
	Lighting.ShadowSoftness = 0.25
	Lighting.ExposureCompensation = 0.1
	for _, c in ipairs(Lighting:GetChildren()) do
		if c:IsA("PostEffect") or c:IsA("Atmosphere") or c:IsA("Sky") then c:Destroy() end
	end
	local atmo = Instance.new("Atmosphere")
	atmo.Density = 0.36
	atmo.Offset = 0.12
	atmo.Color = Color3.fromRGB(214, 150, 120)
	atmo.Decay = Color3.fromRGB(92, 70, 96)
	atmo.Glare = 0.6
	atmo.Haze = 1.8
	atmo.Parent = Lighting
	local bloom = Instance.new("BloomEffect")
	bloom.Intensity = 0.7
	bloom.Size = 26
	bloom.Threshold = 1.4
	bloom.Parent = Lighting
	local cc = Instance.new("ColorCorrectionEffect")
	cc.Contrast = 0.12
	cc.Saturation = 0.05
	cc.TintColor = Color3.fromRGB(255, 244, 236)
	cc.Parent = Lighting
	local rays = Instance.new("SunRaysEffect")
	rays.Intensity = 0.07
	rays.Spread = 0.6
	rays.Parent = Lighting
	local sky = Instance.new("Sky")
	sky.StarCount = 2500
	sky.SunAngularSize = 14
	sky.Parent = Lighting
end

local C = {
	ground = Color3.fromRGB(104, 106, 108),
	concrete = Color3.fromRGB(128, 128, 124),
	wall = Color3.fromRGB(70, 80, 88),
	dark = Color3.fromRGB(29, 34, 38),
	steel = Color3.fromRGB(94, 103, 110),
	hazard = Color3.fromRGB(224, 169, 28),
	crate = Color3.fromRGB(86, 96, 63),
	drum = Color3.fromRGB(163, 40, 28),
	lamp = Color3.fromRGB(255, 196, 130),
	strip = Color3.fromRGB(255, 150, 70),
	red = Color3.fromRGB(255, 48, 32),
}
local CONTAINER = {
	Color3.fromRGB(154, 58, 40), Color3.fromRGB(45, 95, 134), Color3.fromRGB(47, 115, 98),
	Color3.fromRGB(192, 105, 42), Color3.fromRGB(107, 111, 117), Color3.fromRGB(122, 47, 74),
}

function MapBuilder.build()
	local old = workspace:FindFirstChild("Yard9")
	if old then old:Destroy() end
	root = Instance.new("Model")
	root.Name = "Yard9"
	root.Parent = workspace
	setupLighting()

	local statics = folder("Static")
	local A = Config.ARENA

	-- ground + paint
	box(statics, 0, -1, 0, 420, 1, 420, Enum.Material.Concrete, C.ground)
	for _, l in ipairs({ { 0, -36, 0.35, 44 }, { 0, 36, 0.35, 44 }, { -36, 0, 44, 0.35 }, { 36, 0, 44, 0.35 } }) do
		box(statics, l[1], 0, l[2], l[3], 0.02, l[4], Enum.Material.SmoothPlastic, C.hazard, { CanCollide = false, CanQuery = false })
	end

	-- perimeter walls with hazard band and cap
	for _, w in ipairs({ { 0, -A, 148, 2 }, { 0, A, 148, 2 }, { -A, 0, 2, 148 }, { A, 0, 2, 148 } }) do
		box(statics, w[1], 0, w[2], w[3], 9, w[4], Enum.Material.CorrugatedSteel, C.wall)
		box(statics, w[1], 0, w[2], w[3] + 0.2, 0.9, w[4] + 0.2, Enum.Material.SmoothPlastic, C.hazard, { CanQuery = false })
		box(statics, w[1], 9, w[2], w[3] + 0.4, 0.4, w[4] + 0.4, Enum.Material.Metal, C.dark)
	end

	-- warehouses
	for _, wh in ipairs({ { -44, -44, 24, 11, 18 }, { 46, -40, 18, 13, 26 }, { -46, 42, 20, 10, 22 }, { 42, 46, 26, 11, 16 } }) do
		local x, z, w, h, d = wh[1], wh[2], wh[3], wh[4], wh[5]
		box(statics, x, 0, z, w, h, d, Enum.Material.CorrugatedSteel, C.wall)
		box(statics, x, h, z, w + 1, 0.6, d + 1, Enum.Material.Metal, C.dark)
		for _ = 1, 3 do box(statics, x + rand(-w / 3, w / 3), h + 0.6, z + rand(-d / 3, d / 3), 1.6, 1.2, 1.6, Enum.Material.DiamondPlate, C.steel) end
		local facesX = math.abs(x) > math.abs(z)
		if facesX then
			local fx = x - math.sign(x) * (w / 2 + 0.05)
			box(statics, fx, 0, z, 0.1, 6, 7, Enum.Material.CorrugatedSteel, Color3.fromRGB(93, 100, 105), { CanCollide = false })
			neon(statics, fx - math.sign(x) * 0.05, 6.5, z, 0.1, 0.18, 8, C.strip)
		else
			local fz = z - math.sign(z) * (d / 2 + 0.05)
			box(statics, x, 0, fz, 7, 6, 0.1, Enum.Material.CorrugatedSteel, Color3.fromRGB(93, 100, 105), { CanCollide = false })
			neon(statics, x, 6.5, fz - math.sign(z) * 0.05, 8, 0.18, 0.1, C.strip)
		end
	end

	-- central platform with stairs and rails
	local P, H = 7, 3
	box(statics, 0, 0, 0, P * 2, H, P * 2, Enum.Material.Concrete, C.concrete)
	for _, e in ipairs({ { 0, P - 0.25, P * 2, 0.5 }, { 0, -(P - 0.25), P * 2, 0.5 }, { P - 0.25, 0, 0.5, P * 2 }, { -(P - 0.25), 0, 0.5, P * 2 } }) do
		box(statics, e[1], H, e[2], e[3], 0.03, e[4], Enum.Material.SmoothPlastic, C.hazard, { CanCollide = false, CanQuery = false })
	end
	for _, s in ipairs({ 1, -1 }) do
		for i = 1, 5 do box(statics, 0, 0, s * (P + (6 - i) * 0.8 - 0.4), 4.4, 0.5 * i, 0.8, Enum.Material.Concrete, C.concrete) end
		box(statics, s * (P - 0.15), H, 0, 0.3, 1.1, P * 2, Enum.Material.DiamondPlate, C.steel)
		box(statics, s * 4.6, H, P - 0.15, 4.8, 1.1, 0.3, Enum.Material.DiamondPlate, C.steel)
		box(statics, s * 4.6, H, -(P - 0.15), 4.8, 1.1, 0.3, Enum.Material.DiamondPlate, C.steel)
	end
	box(statics, -3, H, 2.5, 2.2, 0.9, 0.8, Enum.Material.WoodPlanks, C.crate)
	box(statics, 3, H, -2.5, 2.2, 0.9, 0.8, Enum.Material.WoodPlanks, C.crate)

	local spawn = Instance.new("SpawnLocation")
	spawn.Anchored = true
	spawn.Size = Vector3.new(4 * S, 0.2, 4 * S)
	spawn.CFrame = CFrame.new(0, H * S + 0.1, 0)
	spawn.Material = Enum.Material.DiamondPlate
	spawn.Color = C.dark
	spawn.Neutral = true
	spawn.Duration = 0
	spawn.Parent = statics
	for _, d in ipairs(spawn:GetChildren()) do if d:IsA("Decal") then d:Destroy() end end

	-- shipping containers
	local CW, CH, CD = 6.1, 2.6, 2.45
	for _, c in ipairs({
		{ -20, -12, 0, 1, 2 }, { 22, 14, 1, 2, 1 }, { 18, -22, 0, 3, 1 }, { -14, 24, 1, 4, 1 }, { -30, 5, 1, 5, 2 },
		{ 30, -5, 1, 1, 1 }, { 5, -32, 0, 6, 1 }, { -6, 34, 0, 2, 2 }, { 55, 10, 1, 3, 1 }, { -56, -8, 1, 4, 1 },
		{ 12, 52, 0, 5, 1 }, { -10, -54, 0, 1, 1 }, { -24, -30, 1, 2, 1 }, { 26, 30, 0, 6, 1 },
	}) do
		local w, d = c[3] == 1 and CD or CW, c[3] == 1 and CW or CD
		for s = 0, c[5] - 1 do
			local col = CONTAINER[((c[4] + s * 2 - 1) % #CONTAINER) + 1]
			local body = box(statics, c[1], s * CH, c[2], w, CH, d, Enum.Material.CorrugatedSteel, col)
			body.Name = "Container"
			box(statics, c[1], s * CH + CH - 0.12, c[2], w + 0.06, 0.12, d + 0.06, Enum.Material.Metal, col:Lerp(Color3.new(), 0.4))
		end
	end

	-- crates
	local crateFolder = folder("Crates")
	for _, a in ipairs({ { -26, -20 }, { 28, 22 }, { -8, -18 }, { 10, 20 }, { 34, -20 }, { -34, 20 }, { 0, -46 }, { 0, 46 }, { -58, 24 }, { 58, -22 }, { -40, -12 }, { 40, 8 }, { 14, -12 }, { -14, 12 } }) do
		for _ = 1, 2 + rng:NextInteger(0, 2) do
			local x, z = a[1] + rand(-2.5, 2.5), a[2] + rand(-2.5, 2.5)
			local hit = workspace:GetPartBoundsInBox(CFrame.new(x * S, 0.7 * S, z * S), Vector3.new(1.9, 1.2, 1.9) * S)
			if #hit <= 1 then
				local cr = box(crateFolder, x, 0, z, 1.3, 1.3, 1.3, Enum.Material.WoodPlanks, C.crate)
				cr.CFrame = cr.CFrame * CFrame.Angles(0, math.rad(rand(-12, 12)), 0)
				if rng:NextNumber() < 0.45 then
					local top = box(crateFolder, x, 1.3, z, 1.3, 1.3, 1.3, Enum.Material.WoodPlanks, C.crate:Lerp(Color3.new(), 0.1))
					top.CFrame = top.CFrame * CFrame.Angles(0, math.rad(rand(-25, 25)), 0)
				end
			end
		end
	end

	-- jersey barriers
	for _, b in ipairs({ { -12, -2, 0 }, { 12, 2, 0 }, { -2, 18, 1 }, { 2, -18, 1 }, { -36, -36, 1 }, { 36, 36, 1 }, { -50, -26, 0 }, { 50, 26, 0 }, { 36, -58, 0 }, { -36, 58, 0 } }) do
		box(statics, b[1], 0, b[2], b[3] == 1 and 0.7 or 3.2, 1.1, b[3] == 1 and 3.2 or 0.7, Enum.Material.Concrete, C.concrete)
	end

	-- lamp posts
	for _, l in ipairs({ { -22, -22 }, { 22, 22 }, { 22, -22 }, { -22, 22 } }) do
		local x, z = l[1], l[2]
		box(statics, x, 0, z, 0.35, 8, 0.35, Enum.Material.Metal, C.steel)
		box(statics, x, 7.7, z + 0.8, 0.25, 0.25, 1.8, Enum.Material.Metal, C.steel, { CanCollide = false })
		local head = neon(statics, x, 7.5, z + 1.5, 0.7, 0.18, 0.5, C.lamp)
		local spot = Instance.new("SpotLight")
		spot.Face = Enum.NormalId.Bottom
		spot.Angle = 110
		spot.Range = 60
		spot.Brightness = 3
		spot.Color = Color3.fromRGB(255, 170, 100)
		spot.Shadows = true
		spot.Parent = head
	end

	-- skyline and smoke stacks outside the walls
	local sky = folder("Skyline")
	for i = 1, 40 do
		local a = i / 40 * math.pi * 2 + rand(-0.05, 0.05)
		local r = rand(120, 190)
		local w, d, h = rand(14, 30), rand(14, 30), rand(18, 90)
		local x, z = math.cos(a) * r, math.sin(a) * r
		local b = box(sky, x, 0, z, w, h, d, Enum.Material.Concrete, Color3.fromRGB(21, 26, 34), { CanCollide = false, CastShadow = false, CanQuery = false })
		b.CFrame = b.CFrame * CFrame.Angles(0, rand(0, 1), 0)
		for f = 1, math.floor(h / 6) do
			if rng:NextNumber() < 0.55 then
				local win = Instance.new("Part")
				win.Anchored, win.CanCollide, win.CanQuery, win.CastShadow = true, false, false, false
				win.Material = Enum.Material.Neon
				win.Color = rng:NextNumber() < 0.2 and Color3.fromRGB(159, 208, 255) or Color3.fromRGB(255, 190, 110)
				win.Size = Vector3.new(w * S * rand(0.3, 0.9), 0.9, d * S + 0.2)
				win.CFrame = b.CFrame * CFrame.new(rand(-0.1, 0.1) * w * S, -h * S / 2 + f * 6 * S - 3, 0)
				win.Transparency = 0.25
				win.Parent = sky
			end
		end
		if rng:NextNumber() < 0.4 then neon(sky, x, h + 0.5, z, 0.6, 0.6, 0.6, C.red) end
	end
	for _, c in ipairs({ { -86, -96 }, { -62, -104 }, { 96, -70 } }) do
		local stack = Instance.new("Part")
		stack.Shape = Enum.PartType.Cylinder
		stack.Anchored, stack.CanCollide = true, false
		stack.Size = Vector3.new(48 * S, 5 * S, 5 * S)
		stack.CFrame = CFrame.new(c[1] * S, 24 * S, c[2] * S) * CFrame.Angles(0, 0, math.pi / 2)
		stack.Material = Enum.Material.Concrete
		stack.Color = Color3.fromRGB(60, 58, 60)
		stack.Parent = sky
		local top = neon(sky, c[1], 48.5, c[2], 0.8, 0.8, 0.8, C.red)
		local smoke = Instance.new("ParticleEmitter")
		smoke.Texture = Config.Textures.Smoke
		smoke.Rate = 6
		smoke.Lifetime = NumberRange.new(9, 13)
		smoke.Speed = NumberRange.new(8, 14)
		smoke.SpreadAngle = Vector2.new(10, 10)
		smoke.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 12), NumberSequenceKeypoint.new(1, 55) })
		smoke.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.6), NumberSequenceKeypoint.new(1, 1) })
		smoke.Color = ColorSequence.new(Color3.fromRGB(70, 64, 66))
		smoke.Acceleration = Vector3.new(6, 2, 0)
		smoke.EmissionDirection = Enum.NormalId.Top
		smoke.Parent = top
	end

	-- explosive fuel drums
	local drums = folder("Drums")
	local barrels = {}
	for _, b in ipairs({ { -17, -6 }, { -16.2, -5.2 }, { 24, 6 }, { 8, -24 }, { -24, 30 }, { 30, -30 }, { -40, -24 }, { 40, 24 }, { 14, 40 }, { -12, -40 }, { 52, -8 }, { -52, 8 }, { 9, 9 }, { -9, -9 } }) do
		local hit = workspace:GetPartBoundsInBox(CFrame.new(b[1] * S, 0.6 * S, b[2] * S), Vector3.new(1, 1, 1) * S)
		if #hit <= 1 then
			local d = Instance.new("Part")
			d.Name = "FuelDrum"
			d.Shape = Enum.PartType.Cylinder
			d.Anchored = true
			d.Size = Vector3.new(1.2 * S, 0.85 * S, 0.85 * S)
			d.CFrame = CFrame.new(b[1] * S, 0.6 * S, b[2] * S) * CFrame.Angles(0, 0, math.pi / 2)
			d.Material = Enum.Material.Metal
			d.Color = C.drum
			d:SetAttribute("HP", Config.Barrel.HP)
			local band = Instance.new("Part")
			band.Shape = Enum.PartType.Cylinder
			band.Anchored, band.CanCollide, band.CanQuery = true, false, false
			band.Size = Vector3.new(0.25 * S, 0.87 * S, 0.87 * S)
			band.CFrame = d.CFrame
			band.Material = Enum.Material.SmoothPlastic
			band.Color = C.hazard
			band.Parent = d
			d.Parent = drums
			table.insert(barrels, d)
		end
	end

	-- runtime folders
	for _, n in ipairs({ "Enemies", "Pickups", "Projectiles", "Debris" }) do
		local f = workspace:FindFirstChild(n) or Instance.new("Folder")
		f.Name = n
		f.Parent = workspace
		f:ClearAllChildren()
	end

	local spawns = {}
	for _, p in ipairs({ { -64, -64 }, { 64, -64 }, { -64, 64 }, { 64, 64 }, { 0, -64 }, { 0, 64 }, { -64, 0 }, { 64, 0 }, { -30, -64 }, { 30, 64 }, { 64, 30 }, { -64, -30 } }) do
		table.insert(spawns, Vector3.new(p[1] * S, 4, p[2] * S))
	end
	return { spawnPoints = spawns, barrels = barrels, drumFolder = drums }
end

return MapBuilder
