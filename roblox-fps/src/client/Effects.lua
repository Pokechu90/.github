-- Client-side VFX and SFX: particles, tracers, bullet holes, explosions, enemy bolts, sounds.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local SoundService = game:GetService("SoundService")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")
local Config = require(ReplicatedStorage:WaitForChild("FoundryShared"):WaitForChild("Config"))

local Effects = { shake = 0 }
local rng = Random.new()
local function rand(a, b) return a + rng:NextNumber() * (b - a) end
local terrain = workspace.Terrain

local fxFolder = Instance.new("Folder")
fxFolder.Name = "LocalFX"
fxFolder.Parent = workspace
Effects.folder = fxFolder

local function NS(a, b) return NumberSequence.new({ NumberSequenceKeypoint.new(0, a), NumberSequenceKeypoint.new(1, b) }) end
local function CS(a, b) return ColorSequence.new(a, b) end
local RGB = Color3.fromRGB

---------------------------------------------------------------- sound
local reverbBus = Instance.new("SoundGroup")
reverbBus.Name = "FoundryFX"
reverbBus.Parent = SoundService
local rev = Instance.new("ReverbSoundEffect")
rev.DecayTime = 1.6
rev.WetLevel = -12
rev.DryLevel = 0
rev.Parent = reverbBus

function Effects.sound(name, pos, opts)
	local def = Config.Sounds[name]
	if not def then return end
	opts = opts or {}
	local s = Instance.new("Sound")
	s.SoundId = def.id
	s.Volume = def.volume * (opts.volume or 1)
	s.PlaybackSpeed = def.pitch * (opts.pitch or 1) * rand(0.94, 1.06)
	s.SoundGroup = reverbBus
	s.RollOffMaxDistance = opts.range or 600
	s.RollOffMinDistance = 12
	if opts.punch then
		local d = Instance.new("DistortionSoundEffect")
		d.Level = 0.35
		d.Parent = s
		local eq = Instance.new("EqualizerSoundEffect")
		eq.LowGain, eq.MidGain, eq.HighGain = 6, 0, -2
		eq.Parent = s
	end
	if pos then
		local a = Instance.new("Attachment")
		a.Position = pos
		a.Parent = terrain
		s.Parent = a
		Debris:AddItem(a, 5)
	else
		s.Parent = SoundService
		Debris:AddItem(s, 5)
	end
	if opts.delay then task.delay(opts.delay, function() if s.Parent then s:Play() end end) else s:Play() end
	return s
end

function Effects.gun(def, pos)
	Effects.sound(def.sound, pos, { punch = true, volume = pos and 1.3 or 1 })
	Effects.sound("gunBody", pos, { pitch = def.id == "sniper" and 0.6 or (def.id == "shotgun" and 0.7 or 1), volume = 0.8 })
end

---------------------------------------------------------------- particles
local PRESET = {
	spark = { Texture = Config.Textures.Spark, Color = CS(RGB(255, 214, 130), RGB(255, 90, 16)), LightEmission = 1, Size = NS(0.35, 0), Lifetime = NumberRange.new(0.15, 0.45), Speed = NumberRange.new(20, 55), SpreadAngle = Vector2.new(55, 55), Acceleration = Vector3.new(0, -90, 0), Drag = 3 },
	elec = { Texture = Config.Textures.Spark, Color = CS(RGB(170, 225, 255), RGB(30, 90, 255)), LightEmission = 1, Size = NS(0.45, 0), Lifetime = NumberRange.new(0.15, 0.5), Speed = NumberRange.new(18, 45), SpreadAngle = Vector2.new(70, 70), Acceleration = Vector3.new(0, -70, 0), Drag = 2 },
	dust = { Texture = Config.Textures.Smoke, Color = CS(RGB(140, 134, 128), RGB(95, 90, 86)), LightEmission = 0, Size = NS(0.6, 3), Transparency = NS(0.35, 1), Lifetime = NumberRange.new(0.6, 1.2), Speed = NumberRange.new(3, 9), SpreadAngle = Vector2.new(40, 40), Drag = 4, Rotation = NumberRange.new(0, 360), RotSpeed = NumberRange.new(-40, 40) },
	oil = { Texture = Config.Textures.Smoke, Color = CS(RGB(20, 20, 20), RGB(40, 40, 40)), Size = NS(0.4, 1.4), Transparency = NS(0.1, 1), Lifetime = NumberRange.new(0.4, 0.8), Speed = NumberRange.new(6, 14), SpreadAngle = Vector2.new(35, 35), Acceleration = Vector3.new(0, -40, 0) },
	fire = { Texture = Config.Textures.Fire, Color = CS(RGB(255, 190, 90), RGB(150, 40, 0)), LightEmission = 1, Size = NS(4, 11), Transparency = NS(0, 1), Lifetime = NumberRange.new(0.35, 0.8), Speed = NumberRange.new(15, 45), SpreadAngle = Vector2.new(180, 180), Drag = 5, Rotation = NumberRange.new(0, 360), RotSpeed = NumberRange.new(-90, 90) },
	smoke = { Texture = Config.Textures.Smoke, Color = CS(RGB(58, 54, 52), RGB(100, 94, 90)), Size = NS(5, 18), Transparency = NS(0.25, 1), Lifetime = NumberRange.new(2.5, 4.5), Speed = NumberRange.new(5, 18), SpreadAngle = Vector2.new(180, 180), Drag = 1.5, Acceleration = Vector3.new(0, 4, 0), Rotation = NumberRange.new(0, 360), RotSpeed = NumberRange.new(-20, 20) },
	warp = { Texture = Config.Textures.Spark, Color = CS(RGB(160, 220, 255), RGB(30, 90, 255)), LightEmission = 1, Size = NS(0.7, 0), Lifetime = NumberRange.new(0.4, 0.9), Speed = NumberRange.new(8, 30), SpreadAngle = Vector2.new(15, 15) },
	glow = { Texture = Config.Textures.Spark, Color = CS(RGB(255, 255, 255), RGB(255, 255, 255)), LightEmission = 1, Size = NS(2, 0), Lifetime = NumberRange.new(0.12), Speed = NumberRange.new(0) },
}

function Effects.burst(preset, pos, normal, count, color, size)
	local a = Instance.new("Attachment")
	a.CFrame = normal and CFrame.lookAt(pos, pos + normal) or CFrame.new(pos)
	a.Parent = terrain
	local e = Instance.new("ParticleEmitter")
	e.Enabled = false
	e.EmissionDirection = Enum.NormalId.Front
	for k, v in pairs(PRESET[preset]) do e[k] = v end
	if not normal then e.SpreadAngle = Vector2.new(180, 180) end
	if color then e.Color = ColorSequence.new(color) end
	if size then e.Size = NS(size, 0) end
	e.Parent = a
	e:Emit(count)
	Debris:AddItem(a, 5)
end

local function flashLight(pos, color, range, brightness, dur)
	local p = Instance.new("Part")
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.Transparency = true, false, false, false, 1
	p.Size = Vector3.new(0.1, 0.1, 0.1)
	p.CFrame = CFrame.new(pos)
	p.Parent = fxFolder
	local l = Instance.new("PointLight")
	l.Color, l.Range, l.Brightness, l.Shadows = color, range, brightness, false
	l.Parent = p
	TweenService:Create(l, TweenInfo.new(dur), { Brightness = 0 }):Play()
	Debris:AddItem(p, dur + 0.1)
end

---------------------------------------------------------------- tracers and holes
function Effects.tracer(a, b, color)
	local len = (b - a).Magnitude
	if len < 1 then return end
	local p = Instance.new("Part")
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = true, false, false, false, false
	p.Material = Enum.Material.Neon
	p.Color = color or RGB(255, 214, 150)
	local seg = math.min(len, 18)
	p.Size = Vector3.new(0.09, 0.09, seg)
	p.CFrame = CFrame.lookAt(a, b) * CFrame.new(0, 0, -seg / 2)
	p.Parent = fxFolder
	local dur = math.clamp(len / 900, 0.04, 0.14)
	local info = TweenInfo.new(dur, Enum.EasingStyle.Linear)
	TweenService:Create(p, info, { CFrame = CFrame.lookAt(a, b) * CFrame.new(0, 0, -(len - seg / 2)), Transparency = 0.6 }):Play()
	Debris:AddItem(p, dur + 0.02)
end

local holes = {}
function Effects.hole(pos, normal)
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Cylinder
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = true, false, false, false, false
	p.Size = Vector3.new(0.03, rand(0.35, 0.5), rand(0.35, 0.5))
	p.Color = RGB(18, 16, 14)
	p.Material = Enum.Material.SmoothPlastic
	p.CFrame = CFrame.lookAt(pos + normal * 0.02, pos + normal * 2) * CFrame.Angles(0, math.pi / 2, 0)
	p.Parent = fxFolder
	table.insert(holes, p)
	if #holes > 90 then table.remove(holes, 1):Destroy() end
end

function Effects.impact(res, isEnemy)
	local pos, n = res.Position, res.Normal
	if isEnemy then
		Effects.burst("elec", pos, n, 10)
		Effects.burst("spark", pos, n, 4)
		if rng:NextNumber() < 0.5 then Effects.burst("oil", pos, n, 3) end
		return
	end
	local inst = res.Instance
	if inst and inst.Name == "FuelDrum" then
		Effects.burst("spark", pos, n, 10)
		Effects.hole(pos, n)
		return
	end
	Effects.burst("spark", pos, n, 6)
	Effects.burst("dust", pos, n, 3, inst and inst.Color:Lerp(RGB(140, 134, 128), 0.5) or nil)
	if inst and inst.Anchored then Effects.hole(pos, n) end
end

---------------------------------------------------------------- explosions
function Effects.boom(pos, radius, camPos)
	local ex = Instance.new("Explosion")
	ex.Position = pos
	ex.BlastRadius = radius * 0.45
	ex.BlastPressure = 0
	ex.DestroyJointRadiusPercent = 0
	ex.ExplosionType = Enum.ExplosionType.NoCraters
	ex.Parent = fxFolder
	Effects.burst("fire", pos, nil, 45)
	Effects.burst("smoke", pos + Vector3.new(0, 2, 0), nil, 20)
	Effects.burst("spark", pos, Vector3.yAxis, 50, nil, 0.6)
	flashLight(pos + Vector3.new(0, 3, 0), RGB(255, 150, 60), radius * 2.4, 10, 0.6)
	local function flat(color, size0, size1, dur, shape)
		local p = Instance.new("Part")
		p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = true, false, false, false, false
		p.Material = Enum.Material.Neon
		p.Color = color
		p.Shape = shape
		p.Size = size0
		p.Transparency = 0.1
		p.CFrame = shape == Enum.PartType.Cylinder and CFrame.new(pos.X, pos.Y - 1.5, pos.Z) * CFrame.Angles(0, 0, math.pi / 2) or CFrame.new(pos)
		p.Parent = fxFolder
		TweenService:Create(p, TweenInfo.new(dur, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), { Size = size1, Transparency = 1 }):Play()
		Debris:AddItem(p, dur + 0.05)
	end
	flat(RGB(255, 200, 130), Vector3.new(0.2, 2, 2), Vector3.new(0.2, radius * 3, radius * 3), 0.5, Enum.PartType.Cylinder)
	flat(RGB(255, 150, 60), Vector3.new(2, 2, 2), Vector3.one * radius * 1.1, 0.3, Enum.PartType.Ball)
	-- scorch mark
	local down = workspace:Raycast(pos + Vector3.new(0, 2, 0), Vector3.new(0, -12, 0), RaycastParams.new())
	if down then
		local s = Instance.new("Part")
		s.Shape = Enum.PartType.Cylinder
		s.Anchored, s.CanCollide, s.CanQuery, s.CanTouch, s.CastShadow = true, false, false, false, false
		s.Size = Vector3.new(0.05, radius * 0.9, radius * 0.9)
		s.Color = RGB(14, 12, 10)
		s.Transparency = 0.25
		s.CFrame = CFrame.new(down.Position + Vector3.new(0, 0.03, 0)) * CFrame.Angles(0, 0, math.pi / 2)
		s.Parent = fxFolder
		task.delay(18, function() TweenService:Create(s, TweenInfo.new(2), { Transparency = 1 }):Play() end)
		Debris:AddItem(s, 21)
	end
	Effects.sound("explosion", pos, { punch = true, range = 1200 })
	Effects.sound("gunBody", pos, { pitch = 0.35, volume = 1.2, range = 1200 })
	local d = camPos and (camPos - pos).Magnitude or 999
	Effects.shake = math.min(1.2, Effects.shake + math.max(0, 1 - d / 120) * 0.9)
	return d
end

---------------------------------------------------------------- enemy bolts
local bolts = {}
function Effects.bolt(id, origin, vel, heavy)
	local color = heavy and RGB(208, 96, 255) or RGB(255, 80, 48)
	local p = Instance.new("Part")
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = true, false, false, false, false
	p.Material = Enum.Material.Neon
	p.Color = color
	p.Size = Vector3.new(0.35, 0.35, 4)
	p.CFrame = CFrame.lookAt(origin, origin + vel)
	p.Parent = fxFolder
	local l = Instance.new("PointLight")
	l.Color, l.Range, l.Brightness = color, 12, 2
	l.Parent = p
	bolts[id] = { p = p, pos = origin, vel = vel, t = 0, color = color }
	Effects.burst("glow", origin, nil, 1, color, 2.5)
end

function Effects.boltEnd(id, pos, normal, hitPlayer)
	local b = bolts[id]
	if b then b.p:Destroy(); bolts[id] = nil end
	if pos then
		Effects.burst("spark", pos, normal, 10, b and b.color or nil)
		if not hitPlayer then Effects.burst("dust", pos, normal, 2) end
	end
end

function Effects.update(dt, camPos)
	for id, b in pairs(bolts) do
		b.t += dt
		b.pos += b.vel * dt
		b.p.CFrame = CFrame.lookAt(b.pos, b.pos + b.vel)
		if not b.whiz and camPos and (b.pos - camPos).Magnitude < 9 then
			b.whiz = true
			Effects.sound("laser", nil, { pitch = 2.2, volume = 0.5 })
		end
		if b.t > 3.2 then b.p:Destroy(); bolts[id] = nil end
	end
	Effects.shake = math.max(0, Effects.shake - dt * 1.6)
end

---------------------------------------------------------------- misc events
function Effects.warp(pos)
	Effects.burst("warp", pos, Vector3.yAxis, 40)
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Cylinder
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = true, false, false, false, false
	p.Material = Enum.Material.Neon
	p.Color = RGB(120, 190, 255)
	p.Size = Vector3.new(30, 3, 3)
	p.CFrame = CFrame.new(pos + Vector3.new(0, 15, 0)) * CFrame.Angles(0, 0, math.pi / 2)
	p.Transparency = 0.2
	p.Parent = fxFolder
	TweenService:Create(p, TweenInfo.new(0.6), { Size = Vector3.new(30, 0.1, 0.1), Transparency = 1 }):Play()
	Debris:AddItem(p, 0.7)
	flashLight(pos + Vector3.new(0, 4, 0), RGB(120, 190, 255), 30, 5, 0.6)
	Effects.sound("warp", pos)
end

function Effects.botDeath(pos, kind)
	Effects.burst("elec", pos, nil, 30)
	Effects.burst("spark", pos, nil, 20)
	Effects.burst("smoke", pos, nil, kind == "heavy" and 10 or 5, nil)
	flashLight(pos, RGB(140, 200, 255), 25, 4, 0.4)
	Effects.sound("laser", pos, { pitch = 0.4, volume = 1.2 })
	Effects.sound("gunBody", pos, { pitch = 0.5 })
end

return Effects
