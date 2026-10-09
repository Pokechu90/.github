--!nonstrict
-- Client-side VFX and SFX: particles, tracers, bullet holes, explosions, projectiles, telegraphs,
-- damage numbers, coin bursts and station animations.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local SoundService = game:GetService("SoundService")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")
local Config = require(ReplicatedStorage:WaitForChild("FoundryShared"):WaitForChild("Config"))

local Effects = { shake = 0, volume = 1, numbers = true, reduceMotion = false }
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
local V = Vector3.new

local function fxPart(props)
	local p = Instance.new("Part")
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = true, false, false, false, false
	p.Material = Enum.Material.Neon
	p.TopSurface, p.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
	for k, v in pairs(props) do (p :: any)[k] = v end
	p.Parent = fxFolder
	return p
end

---------------------------------------------------------------- sound
local reverbBus = Instance.new("SoundGroup")
reverbBus.Name = "FoundryFX"
reverbBus.Parent = SoundService
local rev = Instance.new("ReverbSoundEffect")
rev.DecayTime = 1.6
rev.WetLevel = -12
rev.DryLevel = 0
rev.Parent = reverbBus
Effects.bus = reverbBus

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
		a.WorldPosition = pos
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

function Effects.gun(def, pos, silenced)
	if silenced then
		Effects.sound(def.sound, pos, { volume = pos and 0.35 or 0.3, pitch = 1.6 })
		Effects.sound("gunBody", pos, { pitch = 1.4, volume = 0.4 })
		return
	end
	Effects.sound(def.sound, pos, { punch = true, volume = pos and 1.3 or 1 })
	Effects.sound("gunBody", pos, { pitch = def.id == "sniper" and 0.6 or (def.id == "shotgun" and 0.7 or 1), volume = 0.8 })
end

---------------------------------------------------------------- particles
local PRESET = {
	spark = { Texture = Config.Textures.Spark, Color = CS(RGB(255, 214, 130), RGB(255, 90, 16)), LightEmission = 1, Size = NS(0.35, 0), Lifetime = NumberRange.new(0.15, 0.45), Speed = NumberRange.new(20, 55), SpreadAngle = Vector2.new(55, 55), Acceleration = V(0, -90, 0), Drag = 3 },
	elec = { Texture = Config.Textures.Spark, Color = CS(RGB(170, 225, 255), RGB(30, 90, 255)), LightEmission = 1, Size = NS(0.45, 0), Lifetime = NumberRange.new(0.15, 0.5), Speed = NumberRange.new(18, 45), SpreadAngle = Vector2.new(70, 70), Acceleration = V(0, -70, 0), Drag = 2 },
	dust = { Texture = Config.Textures.Smoke, Color = CS(RGB(140, 134, 128), RGB(95, 90, 86)), LightEmission = 0, Size = NS(0.6, 3), Transparency = NS(0.35, 1), Lifetime = NumberRange.new(0.6, 1.2), Speed = NumberRange.new(3, 9), SpreadAngle = Vector2.new(40, 40), Drag = 4, Rotation = NumberRange.new(0, 360), RotSpeed = NumberRange.new(-40, 40) },
	oil = { Texture = Config.Textures.Smoke, Color = CS(RGB(20, 20, 20), RGB(40, 40, 40)), Size = NS(0.4, 1.4), Transparency = NS(0.1, 1), Lifetime = NumberRange.new(0.4, 0.8), Speed = NumberRange.new(6, 14), SpreadAngle = Vector2.new(35, 35), Acceleration = V(0, -40, 0) },
	fire = { Texture = Config.Textures.Fire, Color = CS(RGB(255, 190, 90), RGB(150, 40, 0)), LightEmission = 1, Size = NS(4, 11), Transparency = NS(0, 1), Lifetime = NumberRange.new(0.35, 0.8), Speed = NumberRange.new(15, 45), SpreadAngle = Vector2.new(180, 180), Drag = 5, Rotation = NumberRange.new(0, 360), RotSpeed = NumberRange.new(-90, 90) },
	smoke = { Texture = Config.Textures.Smoke, Color = CS(RGB(58, 54, 52), RGB(100, 94, 90)), Size = NS(5, 18), Transparency = NS(0.25, 1), Lifetime = NumberRange.new(2.5, 4.5), Speed = NumberRange.new(5, 18), SpreadAngle = Vector2.new(180, 180), Drag = 1.5, Acceleration = V(0, 4, 0), Rotation = NumberRange.new(0, 360), RotSpeed = NumberRange.new(-20, 20) },
	warp = { Texture = Config.Textures.Spark, Color = CS(RGB(160, 220, 255), RGB(30, 90, 255)), LightEmission = 1, Size = NS(0.7, 0), Lifetime = NumberRange.new(0.4, 0.9), Speed = NumberRange.new(8, 30), SpreadAngle = Vector2.new(15, 15) },
	glow = { Texture = Config.Textures.Spark, Color = CS(RGB(255, 255, 255), RGB(255, 255, 255)), LightEmission = 1, Size = NS(2, 0), Lifetime = NumberRange.new(0.12), Speed = NumberRange.new(0) },
	stun = { Texture = Config.Textures.Spark, Color = CS(RGB(200, 240, 255), RGB(80, 160, 255)), LightEmission = 1, Size = NS(1.2, 0), Lifetime = NumberRange.new(0.3, 0.8), Speed = NumberRange.new(30, 70), SpreadAngle = Vector2.new(180, 180), Drag = 4 },
	bone = { Texture = Config.Textures.Smoke, Color = CS(RGB(236, 228, 204), RGB(170, 160, 140)), Size = NS(0.5, 0.2), Lifetime = NumberRange.new(0.5, 1.0), Speed = NumberRange.new(14, 34), SpreadAngle = Vector2.new(70, 70), Acceleration = V(0, -80, 0), Drag = 1 },
	ecto = { Texture = Config.Textures.Spark, Color = CS(RGB(150, 255, 200), RGB(60, 200, 160)), LightEmission = 1, Size = NS(0.9, 0), Lifetime = NumberRange.new(0.4, 1.0), Speed = NumberRange.new(6, 22), SpreadAngle = Vector2.new(180, 180), Drag = 2, Acceleration = V(0, 20, 0) },
	gore = { Texture = Config.Textures.Smoke, Color = CS(RGB(160, 16, 24), RGB(70, 8, 12)), Size = NS(0.6, 0.2), Lifetime = NumberRange.new(0.4, 0.8), Speed = NumberRange.new(10, 30), SpreadAngle = Vector2.new(60, 60), Acceleration = V(0, -80, 0) },
	coin = { Texture = Config.Textures.Spark, Color = CS(RGB(255, 230, 120), RGB(255, 180, 40)), LightEmission = 1, Size = NS(0.6, 0.2), Lifetime = NumberRange.new(0.5, 0.9), Speed = NumberRange.new(12, 26), SpreadAngle = Vector2.new(50, 50), Acceleration = V(0, -60, 0) },
}

function Effects.burst(preset, pos, normal, count, color, size)
	local a = Instance.new("Attachment")
	a.CFrame = normal and CFrame.lookAt(pos, pos + normal) or CFrame.new(pos)
	a.Parent = terrain
	local e = Instance.new("ParticleEmitter")
	e.Enabled = false
	e.EmissionDirection = Enum.NormalId.Front
	for k, v in pairs(PRESET[preset]) do (e :: any)[k] = v end
	if not normal then e.SpreadAngle = Vector2.new(180, 180) end
	if color then e.Color = ColorSequence.new(color) end
	if size then e.Size = NS(size, 0) end
	e.Parent = a
	e:Emit(count)
	Debris:AddItem(a, 5)
end

local function flashLight(pos, color, range, brightness, dur)
	local p = fxPart({ Transparency = 1, Size = V(0.1, 0.1, 0.1), CFrame = CFrame.new(pos) })
	local l = Instance.new("PointLight")
	l.Color, l.Range, l.Brightness, l.Shadows = color, range, brightness, false
	l.Parent = p
	TweenService:Create(l, TweenInfo.new(dur), { Brightness = 0 }):Play()
	Debris:AddItem(p, dur + 0.1)
end
Effects.flashLight = flashLight

-- flat ring on the ground that expands and fades
local function groundRing(pos, r0, r1, color, dur, thickness)
	local p = fxPart({ Shape = Enum.PartType.Cylinder, Color = color, Size = V(thickness or 0.2, r0 * 2, r0 * 2), Transparency = 0.15, CFrame = CFrame.new(pos) * CFrame.Angles(0, 0, math.pi / 2) })
	TweenService:Create(p, TweenInfo.new(dur, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), { Size = V(thickness or 0.2, r1 * 2, r1 * 2), Transparency = 1 }):Play()
	Debris:AddItem(p, dur + 0.05)
	return p
end

---------------------------------------------------------------- tracers and holes
function Effects.tracer(a, b, color, width)
	local len = (b - a).Magnitude
	if len < 1 then return end
	local w = width or 0.09
	local seg = math.min(len, 18)
	local p = fxPart({ Color = color or RGB(255, 214, 150), Size = V(w, w, seg), CFrame = CFrame.lookAt(a, b) * CFrame.new(0, 0, -seg / 2) })
	local dur = math.clamp(len / 900, 0.04, 0.14)
	TweenService:Create(p, TweenInfo.new(dur, Enum.EasingStyle.Linear), { CFrame = CFrame.lookAt(a, b) * CFrame.new(0, 0, -(len - seg / 2)), Transparency = 0.6 }):Play()
	Debris:AddItem(p, dur + 0.02)
end

local holes: { BasePart } = {}
function Effects.hole(pos, normal)
	local p = fxPart({ Shape = Enum.PartType.Cylinder, Material = Enum.Material.SmoothPlastic, Color = RGB(18, 16, 14), Size = V(0.03, rand(0.35, 0.5), rand(0.35, 0.5)) })
	p.CFrame = CFrame.lookAt(pos + normal * 0.02, pos + normal * 2) * CFrame.Angles(0, math.pi / 2, 0)
	table.insert(holes, p)
	if #holes > 90 then (table.remove(holes, 1) :: BasePart):Destroy() end
end

function Effects.impact(res, isEnemy, zone)
	local pos, n = res.Position, res.Normal
	if isEnemy then
		if zone == "shield" then
			Effects.burst("elec", pos, n, 14, Config.Colors.Block)
			Effects.sound("hit", pos, { pitch = 0.5, volume = 0.6 })
			return
		end
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
	if inst and inst.Anchored and inst.Transparency < 0.5 then Effects.hole(pos, n) end
end

---------------------------------------------------------------- explosions
local function addShake(pos, amount, radius, camPos)
	local d = camPos and (camPos - pos).Magnitude or 999
	local k = Effects.reduceMotion and 0.35 or 1
	Effects.shake = math.min(1.2, Effects.shake + math.max(0, 1 - d / radius) * amount * k)
	return d
end

function Effects.boom(pos, radius, camPos)
	local ex = Instance.new("Explosion")
	ex.Position = pos
	ex.BlastRadius = radius * 0.45
	ex.BlastPressure = 0
	ex.DestroyJointRadiusPercent = 0
	ex.ExplosionType = Enum.ExplosionType.NoCraters
	ex.Parent = fxFolder
	Effects.burst("fire", pos, nil, math.floor(25 + radius))
	Effects.burst("smoke", pos + V(0, 2, 0), nil, math.floor(8 + radius * 0.5))
	Effects.burst("spark", pos, Vector3.yAxis, 50, nil, 0.6)
	flashLight(pos + V(0, 3, 0), RGB(255, 150, 60), radius * 2.4, 10, 0.6)
	local p = fxPart({ Shape = Enum.PartType.Ball, Color = RGB(255, 150, 60), Size = V(2, 2, 2), Transparency = 0.1, CFrame = CFrame.new(pos) })
	TweenService:Create(p, TweenInfo.new(0.3, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), { Size = Vector3.one * radius * 1.1, Transparency = 1 }):Play()
	Debris:AddItem(p, 0.35)
	groundRing(pos - V(0, 1.5, 0), 1, radius * 1.5, RGB(255, 200, 130), 0.5)
	local down = workspace:Raycast(pos + V(0, 2, 0), V(0, -12, 0), RaycastParams.new())
	if down and down.Instance.Anchored then
		local s = fxPart({ Shape = Enum.PartType.Cylinder, Material = Enum.Material.SmoothPlastic, Color = RGB(14, 12, 10), Transparency = 0.25, Size = V(0.05, radius * 0.9, radius * 0.9) })
		s.CFrame = CFrame.new(down.Position + V(0, 0.03, 0)) * CFrame.Angles(0, 0, math.pi / 2)
		task.delay(18, function() TweenService:Create(s, TweenInfo.new(2), { Transparency = 1 }):Play() end)
		Debris:AddItem(s, 21)
	end
	Effects.sound("explosion", pos, { punch = true, range = 1200 })
	Effects.sound("gunBody", pos, { pitch = 0.35, volume = 1.2, range = 1200 })
	return addShake(pos, 0.9, 120, camPos)
end

function Effects.stunBoom(pos, radius, camPos)
	Effects.burst("stun", pos, nil, 60)
	flashLight(pos, RGB(160, 220, 255), radius * 2, 12, 0.5)
	groundRing(pos - V(0, 1, 0), 1, radius, Config.Colors.Block, 0.6, 0.3)
	local p = fxPart({ Shape = Enum.PartType.Ball, Material = Enum.Material.ForceField, Color = Config.Colors.Block, Size = V(2, 2, 2), CFrame = CFrame.new(pos) })
	TweenService:Create(p, TweenInfo.new(0.45, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), { Size = Vector3.one * radius * 2, Transparency = 1 }):Play()
	Debris:AddItem(p, 0.5)
	Effects.sound("laser", pos, { pitch = 0.3, volume = 1.4, range = 800 })
	Effects.sound("explosion", pos, { pitch = 1.8, volume = 0.6 })
	return addShake(pos, 0.4, 80, camPos)
end

---------------------------------------------------------------- projectiles
local shots = {}
local STYLE = {
	bolt = { RGB(255, 80, 48), V(0.35, 0.35, 4) },
	heavy = { RGB(255, 120, 40), V(0.6, 0.6, 5) },
	drone = { RGB(64, 255, 208), V(0.3, 0.3, 3) },
	snipe = { RGB(255, 42, 106), V(0.25, 0.25, 12) },
	arrow = { RGB(236, 228, 204), V(0.18, 0.18, 4.5) },
	hex = { RGB(150, 255, 90), V(0.5, 0.5, 2.5) },
	blood = { RGB(255, 36, 52), V(0.4, 0.4, 2.5) },
}
function Effects.bolt(id, origin, vel, style)
	local st = STYLE[style] or STYLE.bolt
	local p = fxPart({ Color = st[1], Size = st[2], CFrame = CFrame.lookAt(origin, origin + vel) })
	local l = Instance.new("PointLight")
	l.Color, l.Range, l.Brightness = st[1], 12, 2
	l.Parent = p
	shots[id] = { p = p, pos = origin, vel = vel, t = 0, color = st[1] }
	Effects.burst("glow", origin, nil, 1, st[1], 2.5)
	Effects.sound("laser", origin, { pitch = style == "snipe" and 0.5 or (style == "heavy" and 0.7 or 1) })
end

function Effects.orb(id, origin, vel, color)
	color = color or RGB(192, 64, 255)
	local p = fxPart({ Shape = Enum.PartType.Ball, Color = color, Size = V(2.2, 2.2, 2.2), CFrame = CFrame.new(origin) })
	local l = Instance.new("PointLight")
	l.Color, l.Range, l.Brightness = color, 18, 3
	l.Parent = p
	local trail = Instance.new("ParticleEmitter")
	trail.Texture = Config.Textures.Spark
	trail.Color = ColorSequence.new(color)
	trail.LightEmission = 1
	trail.Size = NS(1.4, 0)
	trail.Lifetime = NumberRange.new(0.3)
	trail.Rate = 60
	trail.Speed = NumberRange.new(0)
	trail.Parent = p
	shots[id] = { p = p, pos = origin, vel = vel, t = 0, color = color, ball = true }
	Effects.sound("laser", origin, { pitch = 0.35, volume = 1.2 })
end

function Effects.plasma(id, origin, vel, mine)
	local color = RGB(108, 246, 255)
	local p = fxPart({ Shape = Enum.PartType.Ball, Color = color, Size = V(0.9, 0.9, 0.9), CFrame = CFrame.new(origin) })
	local l = Instance.new("PointLight")
	l.Color, l.Range, l.Brightness = color, 14, 3
	l.Parent = p
	shots[id] = { p = p, pos = origin, vel = vel, t = 0, color = color, ball = true, mine = mine }
end

function Effects.boltEnd(id, pos, normal, hitPlayer)
	local b = shots[id]
	if b then b.p:Destroy(); shots[id] = nil end
	if pos then
		Effects.burst("spark", pos, normal, 10, b and b.color or nil)
		if b and b.ball then Effects.burst("elec", pos, normal, 16, b.color); flashLight(pos, b.color, 18, 4, 0.25) end
		if not hitPlayer then Effects.burst("dust", pos, normal, 2) end
	end
end

-- mortar shells: a glowing shell on a parabola and a red warning ring where it lands
local arcs = {}
function Effects.arc(id, origin, target, time, radius)
	local ring = fxPart({ Shape = Enum.PartType.Cylinder, Color = RGB(255, 40, 30), Size = V(0.15, radius * 2, radius * 2), Transparency = 0.55, CFrame = CFrame.new(target + V(0, 0.15, 0)) * CFrame.Angles(0, 0, math.pi / 2) })
	local inner = fxPart({ Shape = Enum.PartType.Cylinder, Color = RGB(255, 90, 60), Size = V(0.18, 0.5, 0.5), Transparency = 0.3, CFrame = ring.CFrame })
	TweenService:Create(inner, TweenInfo.new(time, Enum.EasingStyle.Linear), { Size = V(0.18, radius * 2, radius * 2) }):Play()
	local shell = fxPart({ Shape = Enum.PartType.Ball, Color = RGB(255, 160, 64), Size = V(1.4, 1.4, 1.4), CFrame = CFrame.new(origin) })
	arcs[id] = { ring = ring, inner = inner, shell = shell, from = origin, to = target, time = time, t = 0 }
end
function Effects.arcEnd(id)
	local a = arcs[id]
	if not a then return end
	a.ring:Destroy(); a.inner:Destroy(); a.shell:Destroy()
	arcs[id] = nil
end

function Effects.warnRing(pos, radius, time)
	local ring = fxPart({ Shape = Enum.PartType.Cylinder, Color = RGB(255, 200, 40), Size = V(0.15, radius * 2, radius * 2), Transparency = 0.5, CFrame = CFrame.new(pos - V(0, 2.5, 0)) * CFrame.Angles(0, 0, math.pi / 2) })
	TweenService:Create(ring, TweenInfo.new(time, Enum.EasingStyle.Linear), { Transparency = 0.1 }):Play()
	Debris:AddItem(ring, time)
	Effects.sound("click", pos, { pitch = 2.4, volume = 1.2 })
end

function Effects.strikeMark(pos, along)
	local smoke = Instance.new("Attachment")
	smoke.WorldPosition = pos
	smoke.Parent = terrain
	local e = Instance.new("ParticleEmitter")
	e.Texture = Config.Textures.Smoke
	e.Color = ColorSequence.new(RGB(255, 60, 40))
	e.Size = NS(3, 12)
	e.Transparency = NS(0.2, 1)
	e.Lifetime = NumberRange.new(2, 3)
	e.Speed = NumberRange.new(6, 14)
	e.Rate = 30
	e.EmissionDirection = Enum.NormalId.Top
	e.Parent = smoke
	Debris:AddItem(smoke, 3.5)
	for i = -3, 3 do
		local p = pos + along * i * 9
		local ring = fxPart({ Shape = Enum.PartType.Cylinder, Color = RGB(255, 60, 40), Size = V(0.15, 10, 10), Transparency = 0.5, CFrame = CFrame.new(p + V(0, 0.3, 0)) * CFrame.Angles(0, 0, math.pi / 2) })
		Debris:AddItem(ring, 1.6 + (i + 3) * 0.14)
	end
	Effects.sound("siren", pos, { pitch = 1.6, volume = 1.2, range = 1500 })
end

function Effects.turretShot(a, b)
	Effects.tracer(a, b, RGB(57, 208, 176), 0.12)
	Effects.burst("spark", b, (a - b).Unit, 4, RGB(57, 208, 176))
	Effects.sound("smg", a, { pitch = 1.3, volume = 0.6 })
end

-- marksman laser: a beam from the gun tip to the target that tightens before the shot
local lasers = {}
function Effects.snipeCharge(tip, targetPlayer, time)
	if not tip or not tip.Parent then return end
	Effects.snipeCancel(tip)
	local char = targetPlayer and targetPlayer.Character
	local head = char and char:FindFirstChild("Head")
	if not head then return end
	local a0 = Instance.new("Attachment"); a0.Parent = tip
	local a1 = Instance.new("Attachment"); a1.Parent = head
	local beam = Instance.new("Beam")
	beam.Attachment0, beam.Attachment1 = a0, a1
	beam.Color = ColorSequence.new(RGB(255, 30, 60))
	beam.LightEmission = 1
	beam.FaceCamera = true
	beam.Width0, beam.Width1 = 0.15, 0.15
	beam.Transparency = NumberSequence.new(0.6)
	beam.Parent = tip
	lasers[tip] = { beam = beam, a0 = a0, a1 = a1, t = 0, time = time }
	Effects.sound("laser", tip.Position, { pitch = 0.3, volume = 0.9 })
	task.delay(time + 0.15, function() Effects.snipeCancel(tip) end)
end
function Effects.snipeCancel(tip)
	local l = tip and lasers[tip]
	if not l then return end
	l.beam:Destroy(); l.a0:Destroy(); l.a1:Destroy()
	lasers[tip] = nil
end

function Effects.fuse(model)
	local core = model and model:FindFirstChild("Core")
	if not core then return end
	for i = 0, 3 do
		task.delay(i * 0.13, function()
			if core.Parent then
				Effects.sound("click", core.Position, { pitch = 3, volume = 1.2 })
				Effects.burst("glow", core.Position, nil, 1, RGB(255, 224, 48), 5)
			end
		end)
	end
end

---------------------------------------------------------------- spawns, deaths and bosses
function Effects.warp(pos, kind)
	Effects.burst("warp", pos, Vector3.yAxis, 40)
	local p = fxPart({ Shape = Enum.PartType.Cylinder, Color = kind == "turret" and Config.Colors.Heal or RGB(120, 190, 255), Size = V(30, 3, 3), Transparency = 0.2, CFrame = CFrame.new(pos + V(0, 15, 0)) * CFrame.Angles(0, 0, math.pi / 2) })
	TweenService:Create(p, TweenInfo.new(0.6), { Size = V(30, 0.1, 0.1), Transparency = 1 }):Play()
	Debris:AddItem(p, 0.7)
	flashLight(pos + V(0, 4, 0), RGB(120, 190, 255), 30, 5, 0.6)
	Effects.sound("warp", pos)
end

function Effects.botDeath(pos, kind, pop)
	local k = Config.Enemies[kind]
	if k and k.event then
		-- monsters burst into bone, ectoplasm, blood or pumpkin pulp instead of sparks
		local look = k.look
		if look == "skeleton" then Effects.burst("bone", pos, nil, pop and 30 or 18)
		elseif look == "ghost" or look == "witch" then Effects.burst("ecto", pos, nil, 30)
		elseif look == "pumpkin" then Effects.burst("bone", pos, nil, 20, RGB(232, 118, 28))
		else Effects.burst("gore", pos, nil, pop and 26 or 16) end
		Effects.burst("smoke", pos, nil, 3, look == "ghost" and RGB(200, 240, 230) or RGB(60, 40, 70))
		flashLight(pos, k.glow, 18, 2, 0.3)
		Effects.sound("slash", pos, { pitch = 0.6, volume = 0.8 })
		if pop then Effects.sound("headshot", pos, { pitch = 0.7, volume = 1.2 }) end
		return
	end
	Effects.burst("elec", pos, nil, 30)
	Effects.burst("spark", pos, nil, pop and 40 or 20)
	Effects.burst("smoke", pos, nil, kind == "tank" and 10 or 5)
	flashLight(pos, RGB(140, 200, 255), 25, 4, 0.4)
	Effects.sound("laser", pos, { pitch = 0.4, volume = 1.2 })
	Effects.sound("gunBody", pos, { pitch = 0.5 })
	if pop then Effects.sound("headshot", pos, { pitch = 0.7, volume = 1.2 }) end
end

function Effects.bossSpawn(pos)
	for i = 0, 2 do
		task.delay(i * 0.2, function() groundRing(pos, 2, 60, RGB(255, 60, 40), 1.2, 0.4) end)
	end
	flashLight(pos + V(0, 10, 0), RGB(255, 80, 60), 120, 8, 1.5)
	Effects.sound("siren", pos, { pitch = 0.6, volume = 1.6, range = 2000 })
	Effects.sound("explosion", pos, { pitch = 0.4, volume = 1.4, range = 2000 })
end

function Effects.roar(pos, camPos)
	Effects.sound("siren", pos, { pitch = 0.45, volume = 1.6, range = 2000 })
	Effects.sound("explosion", pos, { pitch = 0.3, volume = 1, range = 2000 })
	addShake(pos, 0.5, 400, camPos)
end

function Effects.stompCharge(pos, radius, time)
	local ring = fxPart({ Shape = Enum.PartType.Cylinder, Color = RGB(255, 40, 30), Size = V(0.15, radius * 2, radius * 2), Transparency = 0.6, CFrame = CFrame.new(pos + V(0, 0.2, 0)) * CFrame.Angles(0, 0, math.pi / 2) })
	TweenService:Create(ring, TweenInfo.new(time, Enum.EasingStyle.Linear), { Transparency = 0.15 }):Play()
	Debris:AddItem(ring, time)
	Effects.sound("laser", pos, { pitch = 0.25, volume = 1.4, range = 1500 })
end

function Effects.stomp(pos, radius, camPos)
	groundRing(pos + V(0, 0.4, 0), 2, radius, RGB(255, 140, 60), 0.6, 1.2)
	Effects.burst("dust", pos, Vector3.yAxis, 40, nil, 4)
	Effects.sound("explosion", pos, { punch = true, pitch = 0.5, range = 1500 })
	addShake(pos, 1, radius * 2.5, camPos)
end

function Effects.shieldBreak(pos)
	Effects.burst("elec", pos, nil, 80, Config.Colors.Block)
	flashLight(pos, Config.Colors.Block, 80, 10, 0.8)
	Effects.sound("laser", pos, { pitch = 0.2, volume = 1.6, range = 1500 })
end

---------------------------------------------------------------- damage numbers and coins
local NUM = {
	normal = { RGB(235, 240, 244), 18 }, kill = { RGB(255, 255, 255), 22 }, head = { Config.Colors.Head, 24 },
	weak = { Config.Colors.Weak, 22 }, block = { Config.Colors.Block, 16 }, coin = { Config.Colors.Coin, 18 },
	candy = { RGB(255, 178, 56), 20 },
}
function Effects.damageNumber(pos: Vector3, text: any, kind: string)
	local suffix = if kind == "head" then "!" else ""
	if not Effects.numbers and kind ~= "coin" and kind ~= "candy" then return end
	local st = NUM[kind] or NUM.normal
	local a = Instance.new("Attachment")
	a.WorldPosition = pos + V(rand(-0.8, 0.8), rand(0.5, 1.5), rand(-0.8, 0.8))
	a.Parent = terrain
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromOffset(140, 40)
	bb.AlwaysOnTop = true
	bb.LightInfluence = 0
	bb.MaxDistance = 600
	bb.Adornee = a
	bb.Parent = a
	local t = Instance.new("TextLabel")
	t.BackgroundTransparency = 1
	t.Size = UDim2.fromScale(1, 1)
	t.Font = Enum.Font.GothamBlack
	t.Text = tostring(text) .. suffix
	t.TextColor3 = st[1]
	t.TextSize = st[2]
	t.TextStrokeTransparency = 0.35
	t.Parent = bb
	local up = V(0, 4, 0)
	TweenService:Create(bb, TweenInfo.new(0.7, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { StudsOffsetWorldSpace = up }):Play()
	TweenService:Create(t, TweenInfo.new(0.35, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { TextSize = st[2] * 1.15 }):Play()
	task.delay(0.45, function() TweenService:Create(t, TweenInfo.new(0.3), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play() end)
	Debris:AddItem(a, 0.8)
end

local coins = {}
function Effects.coins(pos, count, amount)
	Effects.burst("coin", pos, Vector3.yAxis, math.min(20, count * 2))
	for _ = 1, math.min(10, count) do
		local p = fxPart({ Shape = Enum.PartType.Cylinder, Color = Config.Colors.Coin, Size = V(0.15, 0.7, 0.7), CFrame = CFrame.new(pos) })
		table.insert(coins, { p = p, pos = pos, vel = V(rand(-12, 12), rand(18, 30), rand(-12, 12)), t = 0, delay = rand(0.25, 0.45) })
	end
	if amount then Effects.damageNumber(pos + V(0, 2, 0), "+" .. amount, "coin") end
end

function Effects.candy(pos, amount)
	Effects.burst("coin", pos, Vector3.yAxis, 8, RGB(255, 150, 30))
	if amount and amount > 0 then Effects.damageNumber(pos + V(0, 3, 0), "+" .. amount .. " candy", "candy") end
end

---------------------------------------------------------------- stations
function Effects.crateRoll(model, weaponId)
	if not model then return end
	local lid = model:FindFirstChild("Lid")
	local body = model.PrimaryPart
	if not body then return end
	local def = Config.WeaponById[weaponId]
	Effects.sound("warp", body.Position, { pitch = 1.4 })
	if lid then
		local base = lid.CFrame
		TweenService:Create(lid, TweenInfo.new(0.3, Enum.EasingStyle.Back), { CFrame = base * CFrame.new(0, 1.5, 1.4) * CFrame.Angles(-1.2, 0, 0) }):Play()
		task.delay(1.8, function() if lid.Parent then TweenService:Create(lid, TweenInfo.new(0.3), { CFrame = base }):Play() end end)
	end
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromOffset(240, 46)
	bb.StudsOffsetWorldSpace = V(0, 6, 0)
	bb.AlwaysOnTop = true
	bb.Adornee = body
	bb.Parent = body
	local t = Instance.new("TextLabel")
	t.BackgroundTransparency = 1
	t.Size = UDim2.fromScale(1, 1)
	t.Font = Enum.Font.Michroma
	t.TextSize = 22
	t.TextColor3 = Color3.new(1, 1, 1)
	t.TextStrokeTransparency = 0.3
	t.Parent = bb
	task.spawn(function()
		local t0 = os.clock()
		while os.clock() - t0 < 1.5 do
			t.Text = Config.Weapons[rng:NextInteger(1, #Config.Weapons)].name
			Effects.sound("click", body.Position, { pitch = 2, volume = 0.4 })
			task.wait(0.06 + (os.clock() - t0) * 0.12)
		end
		t.Text = def and def.name or "?"
		t.TextColor3 = Config.Colors.Accent
		Effects.burst("warp", body.Position + V(0, 4, 0), Vector3.yAxis, 40)
		Effects.sound("level", body.Position)
		task.wait(1.4)
		bb:Destroy()
	end)
end

function Effects.forge(model, tier)
	local body = model and model.PrimaryPart
	if not body then return end
	Effects.burst("fire", body.Position + V(0, 4, 0), Vector3.yAxis, 20)
	Effects.burst("spark", body.Position + V(0, 4, 0), Vector3.yAxis, 40)
	flashLight(body.Position + V(0, 4, 0), RGB(255, 122, 46), 30, 6, 0.8)
	Effects.sound("explosion", body.Position, { pitch = 1.6, volume = 0.5 })
	Effects.sound("level", body.Position, { pitch = 0.8 + tier * 0.15 })
end

---------------------------------------------------------------- per-frame
function Effects.update(dt, camPos)
	for id, b in pairs(shots) do
		b.t += dt
		b.pos += b.vel * dt
		b.p.CFrame = b.ball and CFrame.new(b.pos) or CFrame.lookAt(b.pos, b.pos + b.vel)
		if not b.whiz and not b.mine and camPos and (b.pos - camPos).Magnitude < 9 then
			b.whiz = true
			Effects.sound("laser", nil, { pitch = 2.2, volume = 0.5 })
		end
		if b.t > 4.2 then b.p:Destroy(); shots[id] = nil end
	end
	for id, a in pairs(arcs) do
		a.t += dt
		local k = math.min(1, a.t / a.time)
		local p = a.from:Lerp(a.to, k) + V(0, math.sin(k * math.pi) * (20 + (a.from - a.to).Magnitude * 0.3), 0)
		a.shell.CFrame = CFrame.new(p)
		if a.t > a.time + 1 then Effects.arcEnd(id) end
	end
	-- coins pop up then fly into the camera
	for i = #coins, 1, -1 do
		local c = coins[i]
		c.t += dt
		if c.t < c.delay then
			c.vel -= V(0, 80 * dt, 0)
			c.pos += c.vel * dt
		elseif camPos then
			local target = camPos - V(0, 1.5, 0)
			c.pos = c.pos:Lerp(target, math.min(1, dt * 9 + (c.t - c.delay) * 0.15))
			if (c.pos - target).Magnitude < 1.5 then
				c.p:Destroy()
				table.remove(coins, i)
				Effects.sound("coin", nil, { volume = 0.6 })
				continue
			end
		end
		c.p.CFrame = CFrame.new(c.pos) * CFrame.Angles(0, c.t * 12, math.pi / 2)
		if c.t > 2 then c.p:Destroy(); table.remove(coins, i) end
	end
	for tip, l in pairs(lasers) do
		l.t += dt
		local k = math.min(1, l.t / l.time)
		l.beam.Width0 = 0.15 + k * 0.2
		l.beam.Transparency = NumberSequence.new(0.6 - k * 0.5)
		if not tip.Parent then Effects.snipeCancel(tip) end
	end
	Effects.shake = math.max(0, Effects.shake - dt * 1.6)
end

function Effects.clear()
	for id in pairs(shots) do shots[id].p:Destroy(); shots[id] = nil end
	for id in pairs(arcs) do Effects.arcEnd(id) end
end

return Effects
