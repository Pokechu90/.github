-- Foundry Breach client: first-person camera, weapons, viewmodel animation, HUD and effects.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local StarterGui = game:GetService("StarterGui")

local Shared = ReplicatedStorage:WaitForChild("FoundryShared")
local Config = require(Shared:WaitForChild("Config"))
local Remotes = require(Shared:WaitForChild("Remotes"))
local Viewmodels = require(script.Parent:WaitForChild("Viewmodels"))
local Effects = require(script.Parent:WaitForChild("Effects"))
local Hud = require(script.Parent:WaitForChild("Hud"))

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera
local State = ReplicatedStorage:WaitForChild("FoundryState")
local W = Config.Weapons
local rng = Random.new()
local function rand(a, b) return a + rng:NextNumber() * (b - a) end
local function lerp(a, b, t) return a + (b - a) * t end
local function damp(a, b, l, dt) return lerp(a, b, 1 - math.exp(-l * dt)) end
local function smooth(t) return t * t * (3 - 2 * t) end

task.spawn(function()
	for _ = 1, 10 do
		local ok = pcall(function()
			StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false)
			StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Health, false)
		end)
		if ok then break end
		task.wait(0.5)
	end
end)

local hud = Hud.new()
local guns = Viewmodels.build()

---------------------------------------------------------------- state
local deployed = false
local char, hum, root
local yaw, pitch = 0, 0
local recoilAccum = 0
local mags, reserves, grenades, armor = {}, {}, Config.Player.StartGrenades, Config.Player.StartArmor
for i, w in ipairs(W) do mags[i] = w.mag; reserves[i] = w.reserve end
local G = { cur = 2, prev = 1, cooldown = 0, reloading = false, reloadT = 0, switchT = 0, switchTo = nil, ads = 0, bloom = 0, pumpT = 1, nadeT = 0, flashT = 0, fireQueued = false, dryClicked = false }
local VM = { kick = 0, kickRot = 0, swayX = 0, swayY = 0, bob = 0, sprint = 0, land = 0, nade = 0, slide = 0, crouch = 0, pull = 0 }
local input = { fire = false, ads = false, sprint = false, crouch = false }
local hurtA, flashA, menuAngle = 0, 0, 0
local stepDist, lastY, wasAir = 0, 0, false
local shells = {}

local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Exclude
local function refreshRayFilter()
	local ignore = { camera, Effects.folder, workspace:FindFirstChild("Projectiles"), workspace:FindFirstChild("Pickups"), workspace:FindFirstChild("Debris") }
	for _, p in ipairs(Players:GetPlayers()) do if p.Character then table.insert(ignore, p.Character) end end
	rayParams.FilterDescendantsInstances = ignore
end

local function showGun(i)
	for j, g in ipairs(guns) do g.model.Parent = (j == i and deployed and hum and hum.Health > 0) and camera or nil end
end

local function equip(i, instant)
	if not W[i] or (i == G.cur and not instant) then return end
	if instant then G.prev = G.cur ~= i and G.cur or G.prev; G.cur = i; G.switchT = 0; showGun(i); return end
	G.switchTo = i
	G.switchT = 0.4
	G.reloading = false
	G.ads = math.min(G.ads, 0.3)
	Remotes.Equip:FireServer(i)
	Effects.sound("click", nil, { pitch = 0.8 })
end

local function startReload()
	local w, i = W[G.cur], G.cur
	if G.reloading or G.switchT > 0 or mags[i] >= w.mag or reserves[i] <= 0 then return end
	G.reloading, G.reloadT = true, 0
	Remotes.Reload:FireServer(i)
	Effects.sound("reload")
	if not w.shellReload then
		Effects.sound("reload", nil, { pitch = 1.3, delay = w.reload * 0.55 })
		Effects.sound("click", nil, { delay = w.reload * 0.85 })
	end
end

---------------------------------------------------------------- character
local function onCharacter(c)
	char = c
	hum = c:WaitForChild("Humanoid")
	root = c:WaitForChild("HumanoidRootPart")
	hum.AutoRotate = false
	G.reloading, G.switchT, G.ads = false, 0, 0
	for i, w in ipairs(W) do mags[i] = w.mag; reserves[i] = w.reserve end
	grenades = Config.Player.StartGrenades
	local _, y = camera.CFrame:ToOrientation()
	yaw, pitch = y, 0
	hum.Died:Connect(function()
		showGun(0)
		hud:setPrompt("Down · respawning", true)
	end)
	hud:setPrompt(nil)
	showGun(G.cur)
end
player.CharacterAdded:Connect(onCharacter)
if player.Character then task.spawn(onCharacter, player.Character) end

---------------------------------------------------------------- menu / deploy
local function deploy()
	input.fire, G.fireQueued = false, false
	Remotes.Deploy:FireServer()
	deployed = true
	hud:showMenu(false)
	hud.over.Visible = false
	hud:showHud(true)
	equip(2, true)
end
hud.deployButton.Activated:Connect(deploy)
hud.redeployButton.Activated:Connect(function()
	hud.over.Visible = false
	deploy()
end)
hud:showHud(false)

---------------------------------------------------------------- input
UserInputService.InputBegan:Connect(function(io, processed)
	if io.UserInputType == Enum.UserInputType.MouseButton1 then input.fire = true; G.fireQueued = true; return end
	if io.UserInputType == Enum.UserInputType.MouseButton2 then input.ads = true; return end
	if processed or not deployed or not hum or hum.Health <= 0 then return end
	local k = io.KeyCode
	if k == Enum.KeyCode.LeftShift then input.sprint = true
	elseif k == Enum.KeyCode.C then input.crouch = true
	elseif k == Enum.KeyCode.R then startReload()
	elseif k == Enum.KeyCode.Q then equip(G.prev)
	elseif k == Enum.KeyCode.G then
		if grenades > 0 and G.nadeT <= 0 and G.switchT <= 0 then
			G.nadeT, VM.nade = 0.9, 1
			grenades -= 1
			Remotes.Throw:FireServer(camera.CFrame.Position, camera.CFrame.LookVector)
			Effects.sound("throw")
		end
	else
		local n = ({ [Enum.KeyCode.One] = 1, [Enum.KeyCode.Two] = 2, [Enum.KeyCode.Three] = 3, [Enum.KeyCode.Four] = 4 })[k]
		if n then equip(n) end
	end
end)
UserInputService.InputEnded:Connect(function(io)
	if io.UserInputType == Enum.UserInputType.MouseButton1 then input.fire = false; G.dryClicked = false end
	if io.UserInputType == Enum.UserInputType.MouseButton2 then input.ads = false end
	if io.KeyCode == Enum.KeyCode.LeftShift then input.sprint = false end
	if io.KeyCode == Enum.KeyCode.C then input.crouch = false end
end)
UserInputService.InputChanged:Connect(function(io, processed)
	if processed or not deployed then return end
	if io.UserInputType == Enum.UserInputType.MouseWheel then
		local target = ((G.switchTo or G.cur) - 1 + (io.Position.Z < 0 and 1 or -1)) % #W + 1
		equip(target)
	end
end)

---------------------------------------------------------------- firing
local function currentSpread(w)
	local v = root and root.AssemblyLinearVelocity or Vector3.zero
	local hs = Vector3.new(v.X, 0, v.Z).Magnitude
	local s = lerp(w.spread, w.adsSpread, smooth(G.ads)) + G.bloom + hs * 0.035 * (1 - G.ads * 0.8)
	if hum and hum.FloorMaterial == Enum.Material.Air then s += 2.5 end
	if VM.crouch > 0.5 then s *= 0.7 end
	return s
end

local function ejectShell(g)
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Cylinder
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = true, false, false, false, false
	p.Size = Vector3.new(0.09, 0.045, 0.045)
	p.Material = Enum.Material.Metal
	p.Color = Color3.fromRGB(200, 160, 64)
	p.Parent = camera
	local off = CFrame.new(0.12, 0.12, -0.2)
	table.insert(shells, { p = p, local_ = off.Position, v = Vector3.new(rand(3, 5), rand(3, 5), rand(-0.3, 1)), t = 0.7, spin = rand(10, 25) })
	if #shells > 12 then table.remove(shells, 1).p:Destroy() end
end

local function fire(w)
	local i = G.cur
	mags[i] -= 1
	G.cooldown = 60 / w.rpm
	local cf = camera.CFrame
	local spread = currentSpread(w)
	refreshRayFilter()
	local g = guns[i]
	local muzzlePos = g.muzzle.Position
	local dirs = {}
	for p = 1, w.pellets do
		local r = math.rad(spread) * math.sqrt(rng:NextNumber())
		local a = rng:NextNumber() * math.pi * 2
		local dir = (cf.LookVector + cf.RightVector * math.cos(a) * r + cf.UpVector * math.sin(a) * r).Unit
		dirs[p] = dir
		local res = workspace:Raycast(cf.Position, dir * w.range, rayParams)
		local endPos = res and res.Position or cf.Position + dir * w.range
		if p <= 4 or rng:NextNumber() < 0.3 then Effects.tracer(muzzlePos, endPos) end
		if res then
			local m = res.Instance:FindFirstAncestorWhichIsA("Model")
			Effects.impact(res, m ~= nil and m.Parent == workspace:FindFirstChild("Enemies"))
		end
	end
	Remotes.Fire:FireServer(i, cf.Position, dirs)
	-- feel
	Effects.gun(w, nil)
	g.flash:Emit(1)
	g.flashCore:Emit(1)
	g.light.Enabled = true
	G.flashT = 0.05
	local mult = (VM.crouch > 0.5 and 0.7 or 1) * lerp(1, 0.6, G.ads)
	local kick = math.rad(w.recoil) * mult * rand(0.8, 1.2)
	pitch += kick
	recoilAccum += kick
	yaw += math.rad(w.recoil) * mult * rand(-0.35, 0.35)
	G.bloom += w.recoil * 0.9
	VM.kick += w.kick
	VM.kickRot += w.kick * 0.6
	VM.slide = 1
	Effects.shake = math.min(1, Effects.shake + w.kick * 0.25)
	if w.id == "shotgun" or w.id == "sniper" then
		G.pumpT = -0.3
		Effects.sound("reload", nil, { delay = 0.3, pitch = 1.1 })
		Effects.sound("click", nil, { delay = w.id == "sniper" and 0.75 or 0.45 })
	end
	if w.id ~= "shotgun" then ejectShell(g) end
end

local function updateWeapon(dt)
	local w, i = W[G.cur], G.cur
	G.cooldown = math.max(0, G.cooldown - dt)
	G.nadeT = math.max(0, G.nadeT - dt)
	G.bloom = damp(G.bloom, 0, 5, dt)
	if G.switchT > 0 then
		local before = G.switchT
		G.switchT -= dt
		if before > 0.2 and G.switchT <= 0.2 and G.switchTo then
			G.prev, G.cur, G.switchTo = G.cur, G.switchTo, nil
			showGun(G.cur)
			Effects.sound("click", nil, { pitch = 1.2 })
		end
		if G.switchT < 0 then G.switchT = 0 end
		w, i = W[G.cur], G.cur
	end
	local wantAds = input.ads and G.switchT <= 0 and VM.sprint < 0.5 and not (G.reloading and not w.shellReload)
	G.ads = math.clamp(G.ads + (wantAds and 1 or -1) * dt * w.adsSpeed, 0, 1)
	if G.reloading then
		G.reloadT += dt
		if w.shellReload then
			if G.reloadT >= w.reload then
				G.reloadT = 0
				mags[i] += 1
				reserves[i] -= 1
				VM.kick += 0.08
				Effects.sound("reload", nil, { pitch = 1.2 })
				if mags[i] >= w.mag or reserves[i] <= 0 then G.reloading = false; G.pumpT = 0 end
			end
		elseif G.reloadT >= w.reload then
			local n = math.min(w.mag - mags[i], reserves[i])
			mags[i] += n
			reserves[i] -= n
			G.reloading = false
		end
	end
	local want = w.auto and input.fire or G.fireQueued
	if want and G.switchT <= 0 and G.nadeT < 0.5 and G.cooldown <= 0 then
		if G.reloading and w.shellReload and mags[i] > 0 then G.reloading = false end
		if not G.reloading then
			if mags[i] <= 0 then
				if G.fireQueued or not G.dryClicked then Effects.sound("dry"); G.dryClicked = true end
				G.cooldown = 0.25
				startReload()
			else
				fire(w)
			end
		end
	end
	G.fireQueued = false
	if mags[i] <= 0 and not G.reloading and reserves[i] > 0 and G.cooldown <= 0 and not input.fire then startReload() end
	if G.pumpT < 1 then G.pumpT += dt / 0.45 end
end

---------------------------------------------------------------- camera and viewmodel
local function updateCamera(dt)
	camera.CameraType = Enum.CameraType.Scriptable
	local w = W[G.cur]
	local zoomSens = lerp(1, w.zoom, G.ads)
	local delta = UserInputService:GetMouseDelta()
	local sens = 0.0028 * zoomSens * UserSettings():GetService("UserGameSettings").MouseSensitivity
	yaw -= delta.X * sens
	pitch -= delta.Y * sens
	VM.swayX = damp(VM.swayX, math.clamp(delta.X * 0.0025, -0.06, 0.06), 10, dt)
	VM.swayY = damp(VM.swayY, math.clamp(delta.Y * 0.0025, -0.06, 0.06), 10, dt)
	local rec = recoilAccum * math.min(1, dt * 7)
	recoilAccum -= rec
	pitch -= rec * 0.7
	pitch = math.clamp(pitch, -1.45, 1.45)

	local alive = hum and hum.Health > 0 and root
	if alive then
		root.CFrame = CFrame.new(root.Position) * CFrame.Angles(0, yaw, 0)
		for _, d in ipairs(char:GetDescendants()) do
			if d:IsA("BasePart") or d:IsA("Decal") then d.LocalTransparencyModifier = 1 end
		end
		local v = root.AssemblyLinearVelocity
		local hs = Vector3.new(v.X, 0, v.Z).Magnitude
		local grounded = hum.FloorMaterial ~= Enum.Material.Air
		VM.crouch = damp(VM.crouch, input.crouch and 1 or 0, 12, dt)
		local sprinting = input.sprint and not input.crouch and G.ads < 0.3 and not G.reloading and hum.MoveDirection.Magnitude > 0.1
		hum.WalkSpeed = input.crouch and Config.Player.CrouchSpeed or (sprinting and Config.Player.SprintSpeed or lerp(Config.Player.WalkSpeed, Config.Player.AdsSpeed, G.ads))
		VM.sprint = damp(VM.sprint, (sprinting and hs > 12) and 1 or 0, 8, dt)
		if grounded and hs > 2 then
			stepDist += hs * dt
			VM.bob += hs * dt * 0.38
			if stepDist > (sprinting and 9 or 7.5) then stepDist = 0 end
		end
		if wasAir and grounded and lastY - root.Position.Y > 0 then
			local fall = math.clamp(-v.Y / 60, 0, 1)
			VM.land = math.max(VM.land, fall)
		end
		wasAir = not grounded
		lastY = root.Position.Y
		VM.land = damp(VM.land, 0, 6, dt)
		local bobA = grounded and math.min(1, hs / 20) * (1 - G.ads * 0.85) or 0
		local shake = Effects.shake * Effects.shake
		local eye = root.Position + Vector3.new(0, 1.5 - VM.crouch * 1.4 - VM.land * 0.6 + math.sin(VM.bob * 2) * 0.12 * bobA, 0)
		eye += Vector3.new(rand(-1, 1), rand(-1, 1), 0) * shake * 0.25
		camera.CFrame = CFrame.new(eye) * CFrame.Angles(0, yaw + rand(-1, 1) * shake * 0.03, 0) * CFrame.Angles(pitch + rand(-1, 1) * shake * 0.03, 0, math.sin(VM.bob) * 0.006 * bobA)
		camera.FieldOfView = damp(camera.FieldOfView, 75 * lerp(1, w.zoom, smooth(G.ads)) * (1 + VM.sprint * 0.06), 18, dt)
		return bobA
	elseif char and char:FindFirstChild("Head") then
		local h = char.Head.Position
		camera.CFrame = camera.CFrame:Lerp(CFrame.lookAt(h + Vector3.new(6, 8, 6), h), math.min(1, dt * 2))
	end
	return 0
end

local function updateViewmodel(dt, bobA)
	local w, g = W[G.cur], guns[G.cur]
	VM.kick = damp(VM.kick, 0, 16, dt)
	VM.kickRot = damp(VM.kickRot, 0, 12, dt)
	VM.slide = damp(VM.slide, 0, 22, dt)
	VM.nade = math.max(0, VM.nade - dt * 1.4)
	local a = smooth(G.ads)
	local p = g.hip:Lerp(g.ads, a)
	local rx, ry, rz = 0, 0, 0
	local sway = 1 - a * 0.7
	p += Vector3.new(math.cos(VM.bob) * 0.04 * bobA * (1 + VM.sprint) - VM.swayX * sway, math.abs(math.sin(VM.bob)) * 0.04 * bobA * (1 + VM.sprint) + VM.swayY * sway - VM.land * 0.2, VM.kick * (a > 0.5 and 0.6 or 1))
	rx += VM.kickRot * (a > 0.5 and 0.35 or 1) + VM.swayY * 2
	ry += VM.swayX * 2
	p += Vector3.new(VM.sprint * 0.15, -VM.sprint * 0.15, 0)
	ry += VM.sprint * 0.7; rx -= VM.sprint * 0.25; rz += VM.sprint * 0.2
	if G.switchT > 0 then
		local k = G.switchT > 0.2 and (0.4 - G.switchT) / 0.2 or G.switchT / 0.2
		p -= Vector3.new(0, smooth(k) * 0.9, 0)
		rx -= smooth(k) * 0.6
	end
	local subs = {}
	if G.reloading and not w.shellReload then
		local t = G.reloadT / w.reload
		local rl = math.sin(math.min(1, t) * math.pi)
		rz += rl * 0.45; rx += rl * 0.2; p -= Vector3.new(0, rl * 0.14, 0)
		local drop = t < 0.3 and smooth(t / 0.3) or (t < 0.55 and 1 or 1 - smooth(math.min(1, (t - 0.55) / 0.2)))
		subs.mag = CFrame.new(0, -math.max(0, drop) * 0.9, 0)
	end
	if G.reloading and w.shellReload then rz += 0.3; rx += 0.1; p -= Vector3.new(0, 0.07, 0) end
	if VM.nade > 0 then local k = math.sin(VM.nade * math.pi); p -= Vector3.new(0, k * 0.7, 0); rx -= k * 0.5 end
	-- pull the gun back when pressed against a wall
	local wall = workspace:Raycast(camera.CFrame.Position, camera.CFrame.LookVector * 4, rayParams)
	VM.pull = damp(VM.pull, wall and (1 - wall.Distance / 4) or 0, 14, dt)
	p += Vector3.new(0, -VM.pull * 0.4, VM.pull * 1.3)
	rx -= VM.pull * 0.5
	subs.slide = CFrame.new(0, 0, VM.slide * 0.16 + (mags[G.cur] == 0 and 0.14 or 0))
	local pk = (G.pumpT > 0 and G.pumpT < 1) and math.sin(G.pumpT * math.pi) or 0
	subs.pump = CFrame.new(0, 0, pk * 0.3)
	if g.boltPivot then subs.bolt = g.boltPivot * CFrame.new(0, 0, pk * 0.25) * CFrame.Angles(0, 0, pk * 1.1) * g.boltPivot:Inverse() end
	local base = camera.CFrame * CFrame.new(p) * CFrame.Angles(rx, ry, rz)
	Viewmodels.place(g, base, subs)
	-- flash + shells
	G.flashT -= dt
	if G.flashT <= 0 then g.light.Enabled = false end
	for i = #shells, 1, -1 do
		local s = shells[i]
		s.t -= dt
		s.v -= Vector3.new(0, 22 * dt, 0)
		s.local_ += s.v * dt
		s.p.CFrame = base * CFrame.new(s.local_) * CFrame.Angles(os.clock() * s.spin, 0, os.clock() * s.spin * 0.7)
		if s.t <= 0 then s.p:Destroy(); table.remove(shells, i) end
	end
	local scoped = w.scope and G.ads > 0.92
	g.model.Parent = (scoped or not (hum and hum.Health > 0)) and nil or camera
	return scoped
end

---------------------------------------------------------------- enemies and pickups (local animation)
local enemyPhase = setmetatable({}, { __mode = "k" })
local pickupBase = setmetatable({}, { __mode = "k" })
local function animateWorld(dt)
	local ef = workspace:FindFirstChild("Enemies")
	if ef then
		for _, m in ipairs(ef:GetChildren()) do
			local r = m.PrimaryPart
			if r then
				local v = r.AssemblyLinearVelocity
				local sp = Vector3.new(v.X, 0, v.Z).Magnitude
				local ph = (enemyPhase[m] or rng:NextNumber() * 6) + dt * sp * 0.65
				enemyPhase[m] = ph
				local amt = math.min(1, sp / 6) * 0.7
				local sw = math.sin(ph) * amt
				local h1, h2 = r:FindFirstChild("Hip1"), r:FindFirstChild("Hip2")
				if h1 then h1.Transform = CFrame.Angles(sw, 0, 0) end
				if h2 then h2.Transform = CFrame.Angles(-sw, 0, 0) end
				if m:GetAttribute("Kind") == "rusher" then
					local t = m:FindFirstChild("Torso")
					local s1, s2 = t and t:FindFirstChild("Shoulder1"), t and t:FindFirstChild("Shoulder2")
					if s1 then s1.Transform = CFrame.Angles(-sw * 1.3, 0, 0) end
					if s2 then s2.Transform = CFrame.Angles(sw * 1.3, 0, 0) end
				end
			end
		end
	end
	local pf = workspace:FindFirstChild("Pickups")
	if pf then
		local t = os.clock()
		for _, m in ipairs(pf:GetChildren()) do
			if not pickupBase[m] then pickupBase[m] = m:GetPivot() end
			m:PivotTo(pickupBase[m] * CFrame.new(0, math.sin(t * 3) * 0.4, 0) * CFrame.Angles(0, t * 1.8, 0))
		end
	end
end

---------------------------------------------------------------- network events
Remotes.Ammo.OnClientEvent:Connect(function(m, r, gcount, a)
	for i = 1, #W do mags[i] = m[i]; reserves[i] = r[i] end
	grenades = gcount
	if a then armor = a end
	if G.reloading and not W[G.cur].shellReload then G.reloading = false end
end)
player:GetAttributeChangedSignal("Armor"):Connect(function() armor = player:GetAttribute("Armor") or 0 end)

Remotes.Hit.OnClientEvent:Connect(function(killed, head)
	hud:hitmarker(killed)
	Effects.sound(killed and "kill" or "hit", nil, { pitch = head and 1.3 or 1 })
end)

Remotes.Damage.OnClientEvent:Connect(function(amount, from, explosive)
	hurtA = 1
	Effects.shake = math.min(1, Effects.shake + 0.25 + amount * 0.01)
	Effects.sound("hurt", nil, { pitch = rand(0.9, 1.1) })
	if from and not explosive and root then
		local to = from - root.Position
		local ang = math.atan2(to.X, to.Z) - math.atan2(-math.sin(yaw), -math.cos(yaw))
		hud:damageDir(-ang)
	end
end)

Remotes.FX.OnClientEvent:Connect(function(kind, ...)
	local args = { ... }
	local camPos = camera.CFrame.Position
	if kind == "shot" then
		local shooter, wi, origin, ends = args[1], args[2], args[3], args[4]
		if shooter == player then return end
		local w = W[wi]
		if w then Effects.gun(w, origin) end
		for n, e in ipairs(ends) do
			if n <= 4 then Effects.tracer(origin + (e - origin).Unit * 3, e) end
			Effects.burst("spark", e, (origin - e).Unit, 4)
		end
	elseif kind == "bolt" then
		Effects.bolt(args[1], args[2], args[3], args[4])
		Effects.sound("laser", args[2], { pitch = args[4] and 0.7 or 1 })
	elseif kind == "boltEnd" then
		Effects.boltEnd(args[1], args[2], args[3], args[4])
	elseif kind == "boom" then
		local d = Effects.boom(args[1], args[2], camPos)
		if d < 90 then flashA = math.max(flashA, 0.35 * (1 - d / 90)) end
	elseif kind == "warp" then
		Effects.warp(args[1])
	elseif kind == "botDeath" then
		Effects.botDeath(args[1], args[2])
	elseif kind == "charge" then
		Effects.sound("laser", args[1], { pitch = 0.35, volume = 0.5 })
	elseif kind == "slash" then
		Effects.sound("slash", args[1])
	elseif kind == "pickup" then
		Effects.sound("pickup")
		hud:setPrompt(args[1])
		hud.promptAuto = false
		task.delay(1.2, function() hud:setPrompt(nil) end)
	end
end)

Remotes.Feed.OnClientEvent:Connect(function(killerName, weapon, victim, head, streak, killer)
	local mine = killer == player
	hud:feedEntry(killerName, weapon, victim, head, mine)
	if mine and streak >= 2 then hud:showStreak(({ [2] = "Double kill", [3] = "Triple kill", [4] = "Quad kill" })[streak] or "Rampage") end
end)

Remotes.Banner.OnClientEvent:Connect(function(title, sub, sound)
	hud:banner(title, sub)
	if sound == "siren" then Effects.sound("siren") elseif sound == "clear" then Effects.sound("pickup", nil, { pitch = 0.8 }) end
end)

Remotes.GameOver.OnClientEvent:Connect(function(stats)
	deployed = false
	hud:showHud(false)
	hud:showOver(stats)
	showGun(0)
end)

---------------------------------------------------------------- main loop
RunService:BindToRenderStep("FoundryBreach", Enum.RenderPriority.Camera.Value + 1, function(dt)
	dt = math.min(dt, 0.05)
	Effects.update(dt, camera.CFrame.Position)
	animateWorld(dt)
	local overlay = hud.menu.Visible or hud.over.Visible
	UserInputService.MouseBehavior = overlay and Enum.MouseBehavior.Default or Enum.MouseBehavior.LockCenter
	UserInputService.MouseIconEnabled = overlay
	if not deployed then
		camera.CameraType = Enum.CameraType.Scriptable
		menuAngle += dt * 0.05
		local S = Config.METER
		camera.CFrame = CFrame.lookAt(Vector3.new(math.sin(menuAngle) * 46 * S, 14 * S, math.cos(menuAngle) * 46 * S), Vector3.new(0, 3 * S, 0))
		camera.FieldOfView = 60
		return
	end
	local alive = hum and hum.Health > 0
	if alive then updateWeapon(dt) end
	local bobA = updateCamera(dt)
	local scoped = false
	if alive then scoped = updateViewmodel(dt, bobA) end
	hurtA = math.max(0, hurtA - dt * 2.5)
	flashA = math.max(0, flashA - dt * 2)
	local w = W[G.cur]
	local reloadProgress = G.reloading and (w.shellReload and mags[G.cur] / w.mag or G.reloadT / w.reload) or nil
	local gap = math.tan(math.rad(currentSpread(w))) / math.tan(math.rad(camera.FieldOfView / 2)) * camera.ViewportSize.Y / 2 + 4
	local ls = player:FindFirstChild("leaderstats")
	hud:update(dt, {
		hp = hum and hum.Health or 0, maxHp = hum and hum.MaxHealth or 100, armor = armor,
		weapon = w, mag = mags[G.cur], reserve = reserves[G.cur], grenades = grenades, slot = G.switchTo or G.cur,
		reload = reloadProgress, wave = State:GetAttribute("Wave") or 0, active = State:GetAttribute("Active"),
		hostiles = State:GetAttribute("Hostiles") or 0, inter = State:GetAttribute("Intermission") or 0,
		kills = ls and ls.Kills.Value or 0, score = ls and ls.Score.Value or 0,
		gap = gap, showCross = alive and G.ads < 0.5 and VM.sprint < 0.5, scoped = scoped,
		hurt = hurtA, flash = flashA,
	})
	if alive then
		local m, r = mags[G.cur], reserves[G.cur]
		if not hud.prompt.Visible or hud.promptAuto then
			if m == 0 and r == 0 then hud:setPrompt("Out of ammo · switch weapon", true); hud.promptAuto = true
			elseif m <= math.ceil(w.mag * 0.25) and not G.reloading and r > 0 then hud:setPrompt("R · Reload"); hud.promptAuto = true
			elseif hud.promptAuto then hud:setPrompt(nil); hud.promptAuto = false end
		end
	end
end)
