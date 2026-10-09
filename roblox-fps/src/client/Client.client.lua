--!nonstrict
-- Foundry Breach client: first-person camera, movement (sprint, crouch, slide, mantle), weapons,
-- viewmodel animation, gamepad support, HUD wiring and effects.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local StarterGui = game:GetService("StarterGui")

local Shared = ReplicatedStorage:WaitForChild("FoundryShared")
local Config = require(Shared:WaitForChild("Config"))
local Stats = require(Shared:WaitForChild("Stats"))
local Remotes = require(Shared:WaitForChild("Remotes"))
local Viewmodels = require(script.Parent:WaitForChild("Viewmodels"))
local Effects = require(script.Parent:WaitForChild("Effects"))
local Hud = require(script.Parent:WaitForChild("Hud"))

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera
local State = ReplicatedStorage:WaitForChild("FoundryState")
local S = Config.METER
local rng = Random.new()
local function rand(a, b) return a + rng:NextNumber() * (b - a) end
local function lerp(a, b, t) return a + (b - a) * t end
local function damp(a, b, l, dt) return lerp(a, b, 1 - math.exp(-l * dt)) end
local function smooth(t) return t * t * (3 - 2 * t) end
local V = Vector3.new

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

local controls
task.spawn(function()
	-- PlayerModule only exists at runtime, so require it untyped
	local requireAny: any = require
	local ok, mod = pcall(function() return requireAny(player:WaitForChild("PlayerScripts"):WaitForChild("PlayerModule")) end)
	if ok and mod then controls = mod:GetControls() end
end)

---------------------------------------------------------------- state
local prof = nil
local rs = nil -- this player's run snapshot from the server
local settings = { sens = 1, adsSens = 1, fov = 80, padSens = 1, volume = 1, toggleAds = false, dmgNumbers = true, invert = false }
local char, hum, root
local yaw, pitch = 0, 0
local recoilAccum, recoilYaw = 0, 0
local mags, reserves = {}, {}
local G = { slot = 1, prevSlot = 2, cooldown = 0, reloading = false, reloadT = 0, reloadDur = 1, switchT = 0, switchTo = nil, ads = 0, adsToggled = false, bloom = 0, pumpT = 1, nadeT = 0, flashT = 0, fireQueued = false, dryClicked = false, burstLeft = 0, burstT = 0, sprayN = 0, lastShotT = 0, inspectT = 0, hitStop = 0 }
local VM = { kick = 0, kickRot = 0, swayX = 0, swayY = 0, bob = 0, sprint = 0, land = 0, nade = 0, slide = 0, crouch = 0, pull = 0, tilt = 0 }
local input = { fire = false, ads = false, sprint = false, crouch = false }
local pad = { look = Vector2.zero, held = {} }
local hurtA, flashA, menuAngle = 0, 0, 0
local lastY, wasAir = 0, false
local slide, mantle = nil, nil
local shells = {}
local guns = {}
local current -- current viewmodel
local fpsAcc, fpsN, fps = 0, 0, 60
local lastFireLocal = 0

local function deployed() return rs ~= nil and rs.deployed == true end
local function alive() return hum ~= nil and hum.Health > 0 and root ~= nil and root.Parent ~= nil end
local function curId() return rs and rs.slots and rs.slots[G.slot] end
local function wstats(id) return Stats.weapon(id, prof or {}, rs) end

local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Exclude
local function refreshRayFilter()
	local ignore = { camera, Effects.folder, workspace:FindFirstChild("Projectiles"), workspace:FindFirstChild("Pickups"), workspace:FindFirstChild("Debris") }
	for _, p in ipairs(Players:GetPlayers()) do if p.Character then table.insert(ignore, p.Character) end end
	rayParams.FilterDescendantsInstances = ignore
end
local function enemyFromPart(part)
	local ef = workspace:FindFirstChild("Enemies")
	if not ef or not part:IsDescendantOf(ef) then return nil, nil end
	return part, part:GetAttribute("Zone") or "body"
end

---------------------------------------------------------------- settings
local function applySettings(s)
	for k, v in pairs(s) do settings[k] = v end
	if prof then prof.settings = prof.settings or {}; for k, v in pairs(s) do prof.settings[k] = v end end
	Effects.numbers = settings.dmgNumbers ~= false
	Effects.reduceMotion = settings.reduceMotion == true
	Effects.bus.Volume = settings.volume or 1
end

---------------------------------------------------------------- HUD
local hud
hud = Hud.new({
	profile = function() return prof end,
	deployed = deployed,
	state = function(k) return State:GetAttribute(k) end,
	shop = function(req) return Remotes.Shop:InvokeServer(req) end,
	leaderboard = function(m, d)
		local ok, res = pcall(function() return Remotes.Leaderboard:InvokeServer(m, d) end)
		return ok and res or nil
	end,
	deploy = function(m, d, mode)
		input.fire, G.fireQueued = false, false
		hud:closeAll()
		Remotes.Deploy:FireServer(m, d, mode)
	end,
	applySettings = applySettings,
	saveSettings = function(s) applySettings(s); Remotes.SaveSettings:FireServer(s) end,
	buffPick = function(k) Remotes.BuffPick:FireServer(k); hud:closeAll() end,
	ready = function() Remotes.Ready:FireServer() end,
})
hud:showHud(false)

---------------------------------------------------------------- viewmodels
local function gunFor(id)
	if not prof or not id then return nil end
	local sig = Viewmodels.signature(id, prof)
	local g = guns[id]
	if not g or g.signature ~= sig then
		if g then Viewmodels.destroy(g) end
		g = Viewmodels.build(id, prof)
		guns[id] = g
	end
	return g
end
local function showGun(visible)
	local id = curId()
	local g = visible and gunFor(id) or nil
	for gid, x in pairs(guns) do x.model.Parent = (g and gid == id) and camera or nil end
	current = g
end

local function cancelReload()
	G.reloading = false
	G.reloadT = 0
end

local function equip(slot, instant)
	if not rs or not rs.slots[slot] then return end
	if slot == G.slot and not instant then return end
	if instant then
		if slot ~= G.slot then G.prevSlot = G.slot end
		G.slot, G.switchT = slot, 0
		showGun(true)
		return
	end
	G.switchTo = slot
	G.switchT = 0.4
	cancelReload()
	G.burstLeft = 0
	G.ads = math.min(G.ads, 0.3)
	Remotes.Equip:FireServer(slot)
	Effects.sound("click", nil, { pitch = 0.8 })
end

local function startReload()
	local id = curId()
	if not id then return end
	local w = wstats(id)
	if G.reloading or G.switchT > 0 or (mags[id] or 0) >= w.mag or (reserves[id] or 0) <= 0 then return end
	G.reloading, G.reloadT = true, 0
	G.reloadDur = w.shellReload and w.reload or w.reload * ((mags[id] or 0) > 0 and 0.8 or 1)
	G.inspectT = 0
	Remotes.Reload:FireServer(G.slot)
	Effects.sound("reload")
	if not w.shellReload then
		Effects.sound("reload", nil, { pitch = 1.3, delay = G.reloadDur * 0.55 })
		Effects.sound("click", nil, { delay = G.reloadDur * 0.85 })
	end
end

---------------------------------------------------------------- character
local function onCharacter(c)
	char = c
	hum = c:WaitForChild("Humanoid")
	root = c:WaitForChild("HumanoidRootPart")
	hum.AutoRotate = false
	cancelReload()
	G.switchT, G.ads, G.burstLeft = 0, 0, 0
	slide, mantle = nil, nil
	if controls then controls:Enable() end
	local _, y = camera.CFrame:ToOrientation()
	yaw, pitch = y, 0
	hum.Died:Connect(function()
		showGun(false)
		if deployed() then hud:setPrompt("Down · respawning", true) end
	end)
	hud:setPrompt(nil)
	if rs then
		for _, id in ipairs(rs.slots) do
			local w = wstats(id)
			mags[id] = rs.mags[id] or w.mag
			reserves[id] = rs.reserves[id] or w.reserve
		end
	end
	showGun(deployed())
end
player.CharacterAdded:Connect(onCharacter)
if player.Character then task.spawn(onCharacter, player.Character) end

---------------------------------------------------------------- killstreaks, grenades, stations
local function throw(kind)
	if not rs or G.nadeT > 0 or G.switchT > 0 then return end
	if (kind == "frag" and rs.frags <= 0) or (kind == "stun" and rs.stuns <= 0) then Effects.sound("deny"); return end
	G.nadeT, VM.nade = 0.9, 1
	if kind == "frag" then rs.frags -= 1 else rs.stuns -= 1 end
	cancelReload()
	Remotes.Throw:FireServer(kind, camera.CFrame.Position, camera.CFrame.LookVector)
	Effects.sound("throw")
end

local function useStreak(kind)
	if not rs or not alive() then return end
	refreshRayFilter()
	if kind == "airstrike" then
		if rs.airstrikes <= 0 then Effects.sound("deny"); hud:toast("No airstrike ready", "Reach a " .. Config.Killstreak.Airstrike .. "-kill streak", "deny"); return end
		local res = workspace:Raycast(camera.CFrame.Position, camera.CFrame.LookVector * 800, rayParams)
		if not res then Effects.sound("deny"); return end
		Remotes.Killstreak:FireServer("airstrike", res.Position)
	else
		if rs.turrets <= 0 then Effects.sound("deny"); hud:toast("No turret ready", "Reach a " .. Config.Killstreak.Turret .. "-kill streak", "deny"); return end
		local look = V(camera.CFrame.LookVector.X, 0, camera.CFrame.LookVector.Z).Unit
		local from = root.Position + look * 7 + V(0, 4, 0)
		local res = workspace:Raycast(from, V(0, -14, 0), rayParams)
		Remotes.Killstreak:FireServer("turret", res and res.Position or (root.Position + look * 7 - V(0, 3, 0)))
	end
end

---------------------------------------------------------------- movement: slide and mantle
local function tryMantle()
	if not alive() or mantle or slide then return false end
	local look = V(math.sin(yaw) * -1, 0, math.cos(yaw) * -1)
	refreshRayFilter()
	local chest = root.Position + V(0, 0.5, 0)
	local wall = workspace:Raycast(chest, look * 4.5, rayParams)
	if not wall or math.abs(wall.Normal.Y) > 0.3 then return false end
	local above = wall.Position + look * 1.6 + V(0, 10, 0)
	local top = workspace:Raycast(above, V(0, -12, 0), rayParams)
	if not top or top.Normal.Y < 0.7 then return false end
	local feet = root.Position.Y - 3
	local h = top.Position.Y - feet
	if h < 2.2 or h > 9.5 then return false end
	-- room to stand on top
	if workspace:Raycast(top.Position + V(0, 0.2, 0), V(0, 5.5, 0), rayParams) then return false end
	mantle = { t = 0, dur = 0.22 + h * 0.03, from = root.Position, to = top.Position + V(0, 3.1, 0) + look * 0.8 }
	if controls then controls:Disable() end
	Effects.sound("slide", nil, { pitch = 1.4, volume = 0.7 })
	VM.land = 0.5
	return true
end

local function startSlide()
	if not alive() or slide or mantle then return end
	local v = root.AssemblyLinearVelocity
	local hs = V(v.X, 0, v.Z)
	if hs.Magnitude < 16 or hum.FloorMaterial == Enum.Material.Air then return end
	slide = { t = 0, dur = 0.75, dir = hs.Unit }
	if controls then controls:Disable() end
	Effects.sound("slide")
end

local function updateMovement(dt)
	if mantle then
		mantle.t += dt
		local k = smooth(math.min(1, mantle.t / mantle.dur))
		local p = mantle.from:Lerp(mantle.to, k) + V(0, math.sin(k * math.pi) * 1.2, 0)
		root.CFrame = CFrame.new(p) * CFrame.Angles(0, yaw, 0)
		root.AssemblyLinearVelocity = Vector3.zero
		if mantle.t >= mantle.dur then
			mantle = nil
			if controls then controls:Enable() end
		end
		return
	end
	if slide then
		slide.t += dt
		local k = slide.t / slide.dur
		hum.WalkSpeed = lerp(46, 14, smooth(math.min(1, k)))
		hum:Move(slide.dir, false)
		VM.tilt = damp(VM.tilt, 0.08, 10, dt)
		if k >= 1 or hum.FloorMaterial == Enum.Material.Air then
			slide = nil
			if controls then controls:Enable() end
		end
		return
	end
	VM.tilt = damp(VM.tilt, 0, 8, dt)
end

---------------------------------------------------------------- input
local function overlayOpen() return hud:isOpen() end
local function canAct() return deployed() and alive() and not overlayOpen() end

local function setAds(on)
	if settings.toggleAds then
		if on then G.adsToggled = not G.adsToggled end
	else
		input.ads = on
	end
end

local KEY_SLOT = { [Enum.KeyCode.One] = 1, [Enum.KeyCode.Two] = 2 }

UserInputService.InputBegan:Connect(function(io, processed)
	local t, k = io.UserInputType, io.KeyCode
	-- menu-level keys work while overlays are open
	if hud.open == "buffs" and rs and rs.offer then
		local n = ({ [Enum.KeyCode.One] = 1, [Enum.KeyCode.Two] = 2, [Enum.KeyCode.Three] = 3 })[k]
		if n and rs.offer[n] then Remotes.BuffPick:FireServer(rs.offer[n]); hud:closeAll(); return end
	end
	if k == Enum.KeyCode.M or k == Enum.KeyCode.ButtonSelect then
		if deployed() then
			if hud.open == "menu" then hud:closeAll() elseif not hud.open then hud:showMenu(true) end
		end
		return
	end
	if (k == Enum.KeyCode.B or k == Enum.KeyCode.DPadRight) and deployed() and State:GetAttribute("Running") and not State:GetAttribute("Active") and (State:GetAttribute("Wave") or 0) > 0 then
		if hud.open == "supply" then hud:closeAll() elseif not hud.open then hud:openSupply() end
		return
	end
	if (k == Enum.KeyCode.Return or k == Enum.KeyCode.KeypadEnter) and deployed() and not State:GetAttribute("Active") and not hud.open then
		Remotes.Ready:FireServer()
		return
	end
	if overlayOpen() then return end
	if t == Enum.UserInputType.MouseButton1 then input.fire = true; G.fireQueued = true; return end
	if t == Enum.UserInputType.MouseButton2 then setAds(true); return end
	if t == Enum.UserInputType.Gamepad1 then
		pad.held[k] = true
		if k == Enum.KeyCode.ButtonR2 then input.fire = true; G.fireQueued = true; return end
		if k == Enum.KeyCode.ButtonL2 then setAds(true); return end
	end
	if processed or not canAct() then return end
	if k == Enum.KeyCode.LeftShift or k == Enum.KeyCode.ButtonL3 then input.sprint = not (k == Enum.KeyCode.ButtonL3 and input.sprint)
	elseif k == Enum.KeyCode.C or k == Enum.KeyCode.LeftControl or k == Enum.KeyCode.ButtonB then
		if input.sprint and VM.sprint > 0.5 then startSlide() end
		input.crouch = true
	elseif k == Enum.KeyCode.R or k == Enum.KeyCode.ButtonX then startReload()
	elseif k == Enum.KeyCode.Q or k == Enum.KeyCode.ButtonY then equip(G.slot == 1 and 2 or 1)
	elseif k == Enum.KeyCode.G or k == Enum.KeyCode.ButtonR1 then throw("frag")
	elseif k == Enum.KeyCode.T or k == Enum.KeyCode.ButtonL1 then throw("stun")
	elseif k == Enum.KeyCode.Z or k == Enum.KeyCode.DPadUp then useStreak("airstrike")
	elseif k == Enum.KeyCode.X or k == Enum.KeyCode.DPadDown then useStreak("turret")
	elseif k == Enum.KeyCode.F or k == Enum.KeyCode.ButtonR3 then
		if not G.reloading and G.switchT <= 0 and G.ads < 0.2 then G.inspectT = 1.8 end
	elseif KEY_SLOT[k] then equip(KEY_SLOT[k])
	end
end)

UserInputService.InputEnded:Connect(function(io)
	local t, k = io.UserInputType, io.KeyCode
	if t == Enum.UserInputType.MouseButton1 or k == Enum.KeyCode.ButtonR2 then input.fire = false; G.dryClicked = false end
	if t == Enum.UserInputType.MouseButton2 or k == Enum.KeyCode.ButtonL2 then if not settings.toggleAds then input.ads = false end end
	if t == Enum.UserInputType.Gamepad1 then pad.held[k] = nil end
	if k == Enum.KeyCode.LeftShift then input.sprint = false end
	if k == Enum.KeyCode.C or k == Enum.KeyCode.LeftControl or k == Enum.KeyCode.ButtonB then input.crouch = false end
end)

UserInputService.InputChanged:Connect(function(io, processed)
	if io.KeyCode == Enum.KeyCode.Thumbstick2 then
		local p = Vector2.new(io.Position.X, io.Position.Y)
		pad.look = p.Magnitude > 0.15 and p or Vector2.zero
		return
	end
	if io.KeyCode == Enum.KeyCode.Thumbstick1 and io.Position.Magnitude < 0.3 and input.sprint and pad.held[Enum.KeyCode.ButtonL3] == nil then
		-- stick sprint ends when the stick is released
		input.sprint = false
	end
	if processed or not canAct() then return end
	if io.UserInputType == Enum.UserInputType.MouseWheel then equip(G.slot == 1 and 2 or 1) end
end)

UserInputService.JumpRequest:Connect(function()
	if canAct() then tryMantle() end
end)

---------------------------------------------------------------- firing
local PATTERN_SEED = { pistol = 0.3, smg = 1.7, rifle = 2.9, burst = 4.1, shotgun = 0.9, lmg = 5.3, sniper = 3.3, plasma = 6.1 }

local function currentSpread(w)
	local v = root and root.AssemblyLinearVelocity or Vector3.zero
	local hs = V(v.X, 0, v.Z).Magnitude
	local s = lerp(w.spread, w.adsSpread, smooth(G.ads)) + G.bloom + hs * 0.03 * (1 - G.ads * 0.8)
	if hum and hum.FloorMaterial == Enum.Material.Air then s += 2.5 end
	if VM.crouch > 0.5 and not slide then s *= 0.7 end
	return s
end

local function ejectShell()
	local p = Instance.new("Part")
	p.Shape = Enum.PartType.Cylinder
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch, p.CastShadow = true, false, false, false, false
	p.Size = V(0.09, 0.045, 0.045)
	p.Material = Enum.Material.Metal
	p.Color = Color3.fromRGB(200, 160, 64)
	p.Parent = camera
	table.insert(shells, { p = p, local_ = V(0.12, 0.12, -0.2), v = V(rand(3, 5), rand(3, 5), rand(-0.3, 1)), t = 0.7, spin = rand(10, 25) })
	if #shells > 12 then (table.remove(shells, 1) :: any).p:Destroy() end
end

local function fire(id, w)
	if not rs.powerups or (rs.powerups.ammo or 0) <= 0 then mags[id] -= 1 end
	lastFireLocal = os.clock()
	G.inspectT = 0
	local cf = camera.CFrame
	local spread = currentSpread(w)
	refreshRayFilter()
	local muzzlePos = current and current.muzzle.Position or cf.Position
	local dirs = {}
	for p = 1, w.pellets do
		local r = math.rad(spread) * math.sqrt(rng:NextNumber())
		local a = rng:NextNumber() * math.pi * 2
		local dir = (cf.LookVector + cf.RightVector * math.cos(a) * r + cf.UpVector * math.sin(a) * r).Unit
		dirs[p] = dir
		if not w.projectile then
			local res = workspace:Raycast(cf.Position, dir * w.range, rayParams)
			local endPos = res and res.Position or cf.Position + dir * w.range
			if p <= 4 or rng:NextNumber() < 0.3 then Effects.tracer(muzzlePos, endPos, w.silenced and Color3.fromRGB(200, 200, 200) or nil) end
			if res then
				local e, zone = enemyFromPart(res.Instance)
				Effects.impact(res, e ~= nil, zone)
			end
		end
	end
	Remotes.Fire:FireServer(G.slot, cf.Position, dirs)
	-- feel: sound, flash, pattern recoil, kick
	Effects.gun(w, nil, w.silenced)
	if current then
		current.flash:Emit(1)
		current.flashCore:Emit(1)
		current.light.Enabled = true
	end
	G.flashT = 0.05
	local now = os.clock()
	if now - G.lastShotT > 0.35 then G.sprayN = 0 end
	G.lastShotT = now
	G.sprayN += 1
	local n = G.sprayN
	local mult = (VM.crouch > 0.5 and 0.75 or 1) * lerp(1, 0.6 * w.adsRecoil, G.ads)
	local vert = 1 + math.min(n, 8) * 0.06
	local horiz = math.sin(n * 0.9 + (PATTERN_SEED[w.id] or 0)) * 0.45 + (n > 6 and math.sin(n * 0.37) * 0.35 or 0)
	local kick = math.rad(w.recoil) * mult * vert
	pitch += kick
	recoilAccum += kick
	local yk = math.rad(w.recoil) * mult * horiz * 0.6
	yaw += yk
	recoilYaw += yk
	G.bloom += w.recoil * 0.9
	VM.kick += w.kick
	VM.kickRot += w.kick * 0.6
	VM.slide = 1
	Effects.shake = math.min(1, Effects.shake + w.kick * 0.2 * (settings.reduceMotion and 0.3 or 1))
	if w.pump or w.bolt then
		G.pumpT = -0.3
		Effects.sound("reload", nil, { delay = 0.3, pitch = 1.1 })
		Effects.sound("click", nil, { delay = w.bolt and 0.75 or 0.45 })
	end
	if not w.pump and not w.projectile then ejectShell() end
end

local function updateWeapon(dt)
	local id = curId()
	if not id then return end
	local w = wstats(id)
	G.cooldown = math.max(0, G.cooldown - dt)
	G.nadeT = math.max(0, G.nadeT - dt)
	G.bloom = damp(G.bloom, 0, 5, dt)
	G.inspectT = math.max(0, G.inspectT - dt)
	if G.switchT > 0 then
		local before = G.switchT
		G.switchT -= dt
		if before > 0.2 and G.switchT <= 0.2 and G.switchTo then
			G.prevSlot, G.slot, G.switchTo = G.slot, G.switchTo, nil
			showGun(true)
			Effects.sound("click", nil, { pitch = 1.2 })
		end
		if G.switchT < 0 then G.switchT = 0 end
		id = curId()
		w = wstats(id)
	end
	local wantAds = (input.ads or G.adsToggled) and G.switchT <= 0 and VM.sprint < 0.5 and not (G.reloading and not w.shellReload) and not mantle
	G.ads = math.clamp(G.ads + (wantAds and 1 or -1) * dt * w.adsSpeed, 0, 1)
	if G.reloading then
		G.reloadT += dt
		if w.shellReload then
			if G.reloadT >= w.reload then
				G.reloadT = 0
				mags[id] += 1
				reserves[id] -= 1
				VM.kick += 0.08
				Effects.sound("reload", nil, { pitch = 1.2 })
				if mags[id] >= w.mag or reserves[id] <= 0 then G.reloading = false; G.pumpT = 0 end
			end
		elseif G.reloadT >= G.reloadDur then
			local n = math.min(w.mag - mags[id], reserves[id])
			mags[id] += n
			reserves[id] -= n
			G.reloading = false
		end
	end
	-- burst sequencing
	if G.burstLeft > 0 then
		G.burstT -= dt
		if G.burstT <= 0 and (mags[id] or 0) > 0 then
			fire(id, w)
			G.burstLeft -= 1
			G.burstT = 60 / w.rpm
			if G.burstLeft == 0 then G.cooldown = w.burstDelay end
		elseif (mags[id] or 0) <= 0 then
			G.burstLeft = 0
		end
		G.fireQueued = false
		return
	end
	local want = (w.fire == "auto" and input.fire) or G.fireQueued
	if want and G.switchT <= 0 and G.nadeT < 0.5 and G.cooldown <= 0 and not mantle and VM.sprint < 0.7 then
		if G.reloading and w.shellReload and (mags[id] or 0) > 0 then G.reloading = false end
		if not G.reloading then
			if (mags[id] or 0) <= 0 then
				if G.fireQueued or not G.dryClicked then Effects.sound("dry"); G.dryClicked = true end
				G.cooldown = 0.25
				startReload()
			elseif w.fire == "burst" then
				G.burstLeft = w.burstCount
				G.burstT = 0
			else
				fire(id, w)
				G.cooldown = 60 / w.rpm
			end
		end
	elseif want and VM.sprint >= 0.7 then
		input.sprint = false
	end
	G.fireQueued = false
	if (mags[id] or 0) <= 0 and not G.reloading and (reserves[id] or 0) > 0 and G.cooldown <= 0 and not input.fire then startReload() end
	if G.pumpT < 1 then G.pumpT += dt / 0.45 end
end

---------------------------------------------------------------- camera
local function aimingAtEnemy()
	local res = workspace:Raycast(camera.CFrame.Position, camera.CFrame.LookVector * 400, rayParams)
	return res ~= nil and enemyFromPart(res.Instance) ~= nil
end

local function updateCamera(dt)
	camera.CameraType = Enum.CameraType.Scriptable
	local id = curId()
	local w = id and wstats(id) or Config.WeaponById.rifle
	local zoom = lerp(1, w.zoom, G.ads)
	local adsMul = lerp(1, settings.adsSens or 1, G.ads)
	local inv = settings.invert and -1 or 1
	local delta = UserInputService:GetMouseDelta()
	local sens = 0.0028 * zoom * adsMul * (settings.sens or 1) * UserSettings():GetService("UserGameSettings").MouseSensitivity
	yaw -= delta.X * sens
	pitch -= delta.Y * sens * inv
	-- controller look with a response curve and slowdown over targets
	if pad.look.Magnitude > 0 then
		local slow = aimingAtEnemy() and 0.55 or 1
		local curve = pad.look * pad.look.Magnitude
		local rate = 3.2 * (settings.padSens or 1) * zoom * adsMul * slow
		yaw -= curve.X * rate * dt
		pitch += curve.Y * rate * dt * inv
	end
	VM.swayX = damp(VM.swayX, math.clamp(delta.X * 0.0025 + pad.look.X * 0.02, -0.06, 0.06), 10, dt)
	VM.swayY = damp(VM.swayY, math.clamp(delta.Y * 0.0025 - pad.look.Y * 0.02, -0.06, 0.06), 10, dt)
	-- recoil recovers partially toward where you aimed
	local rec = recoilAccum * math.min(1, dt * 7)
	recoilAccum -= rec
	pitch -= rec * 0.7
	local ry = recoilYaw * math.min(1, dt * 5)
	recoilYaw -= ry
	yaw -= ry * 0.5
	pitch = math.clamp(pitch, -1.45, 1.45)

	if alive() then
		if not mantle then root.CFrame = CFrame.new(root.Position) * CFrame.Angles(0, yaw, 0) end
		for _, d in ipairs(char:GetDescendants()) do
			if d:IsA("BasePart") or d:IsA("Decal") then d.LocalTransparencyModifier = 1 end
		end
		local v = root.AssemblyLinearVelocity
		local hs = V(v.X, 0, v.Z).Magnitude
		local grounded = hum.FloorMaterial ~= Enum.Material.Air
		VM.crouch = damp(VM.crouch, (input.crouch or slide) and 1 or 0, 12, dt)
		local moving = hum.MoveDirection.Magnitude > 0.1
		local sprinting = input.sprint and not input.crouch and G.ads < 0.3 and not G.reloading and moving and not slide
		local mods = rs and Stats.buffMods(rs.buffs, rs.powerups) or { speed = 1 }
		if not slide then
			local base = input.crouch and Config.Player.CrouchSpeed or (sprinting and Config.Player.SprintSpeed or lerp(Config.Player.WalkSpeed, Config.Player.AdsSpeed, G.ads))
			hum.WalkSpeed = base * mods.speed * (w.move or 1)
		end
		VM.sprint = damp(VM.sprint, (sprinting and hs > 12) and 1 or 0, 8, dt)
		if grounded and hs > 2 then VM.bob += hs * dt * 0.38 end
		if wasAir and grounded and lastY - root.Position.Y > 0 then
			VM.land = math.max(VM.land, math.clamp(-v.Y / 60, 0, 1))
		end
		wasAir = not grounded
		lastY = root.Position.Y
		VM.land = damp(VM.land, 0, 6, dt)
		local bobA = (grounded and not slide) and math.min(1, hs / 20) * (1 - G.ads * 0.85) or 0
		local shake = Effects.shake * Effects.shake
		local eye = root.Position + V(0, 1.5 - VM.crouch * 1.6 - VM.land * 0.6 + math.sin(VM.bob * 2) * 0.12 * bobA, 0)
		eye += V(rand(-1, 1), rand(-1, 1), 0) * shake * 0.25
		camera.CFrame = CFrame.new(eye) * CFrame.Angles(0, yaw + rand(-1, 1) * shake * 0.03, 0) * CFrame.Angles(pitch + rand(-1, 1) * shake * 0.03, 0, math.sin(VM.bob) * 0.006 * bobA + VM.tilt)
		local baseFov = settings.fov or 80
		camera.FieldOfView = damp(camera.FieldOfView, baseFov * lerp(1, w.zoom, smooth(G.ads)) * (1 + VM.sprint * 0.06 + (slide and 0.08 or 0)), 18, dt)
		return bobA
	elseif char and char:FindFirstChild("Head") then
		local h = char.Head.Position
		camera.CFrame = camera.CFrame:Lerp(CFrame.lookAt(h + V(6, 8, 6), h), math.min(1, dt * 2))
	end
	return 0
end

---------------------------------------------------------------- viewmodel
local laserBeam = Instance.new("Part")
laserBeam.Anchored, laserBeam.CanCollide, laserBeam.CanQuery, laserBeam.CanTouch, laserBeam.CastShadow = true, false, false, false, false
laserBeam.Material = Enum.Material.Neon
laserBeam.Color = Color3.fromRGB(255, 42, 26)
laserBeam.Transparency = 0.45
local laserDot = laserBeam:Clone()
laserDot.Shape = Enum.PartType.Ball
laserDot.Size = V(0.25, 0.25, 0.25)
laserDot.Transparency = 0

local function updateViewmodel(dt, bobA)
	local id = curId()
	local g = current
	if not g or not id then return false end
	local w = wstats(id)
	local vdt = G.hitStop > 0 and dt * 0.15 or dt
	G.hitStop = math.max(0, G.hitStop - dt)
	VM.kick = damp(VM.kick, 0, 16, vdt)
	VM.kickRot = damp(VM.kickRot, 0, 12, vdt)
	VM.slide = damp(VM.slide, 0, 22, vdt)
	VM.nade = math.max(0, VM.nade - dt * 1.4)
	local a = smooth(G.ads)
	local p = g.hip:Lerp(g.ads, a)
	local rx, ry, rz = 0, 0, 0
	local sway = 1 - a * 0.7
	p += V(math.cos(VM.bob) * 0.04 * bobA * (1 + VM.sprint) - VM.swayX * sway, math.abs(math.sin(VM.bob)) * 0.04 * bobA * (1 + VM.sprint) + VM.swayY * sway - VM.land * 0.2, VM.kick * (a > 0.5 and 0.6 or 1))
	rx += VM.kickRot * (a > 0.5 and 0.35 or 1) + VM.swayY * 2
	ry += VM.swayX * 2
	p += V(VM.sprint * 0.15, -VM.sprint * 0.15, 0)
	ry += VM.sprint * 0.7; rx -= VM.sprint * 0.25; rz += VM.sprint * 0.2
	if slide then rz += 0.25; p += V(-0.1, -0.05, 0) end
	if G.switchT > 0 then
		local k = G.switchT > 0.2 and (0.4 - G.switchT) / 0.2 or G.switchT / 0.2
		p -= V(0, smooth(k) * 0.9, 0)
		rx -= smooth(k) * 0.6
	end
	if G.inspectT > 0 then
		local k = math.sin(math.min(1, (1.8 - G.inspectT) / 1.8) * math.pi)
		ry -= k * 0.9; rz += k * 0.5; p += V(-k * 0.25, k * 0.1, k * 0.2)
	end
	local subs = {}
	if G.reloading and not w.shellReload then
		local t = G.reloadT / G.reloadDur
		local rl = math.sin(math.min(1, t) * math.pi)
		rz += rl * 0.45; rx += rl * 0.2; p -= V(0, rl * 0.14, 0)
		local drop = t < 0.3 and smooth(t / 0.3) or (t < 0.55 and 1 or 1 - smooth(math.min(1, (t - 0.55) / 0.2)))
		subs.mag = CFrame.new(0, -math.max(0, drop) * 0.9, 0)
	end
	if G.reloading and w.shellReload then rz += 0.3; rx += 0.1; p -= V(0, 0.07, 0) end
	if VM.nade > 0 then local k = math.sin(VM.nade * math.pi); p -= V(0, k * 0.7, 0); rx -= k * 0.5 end
	-- pull the gun back when pressed against a wall
	local wall = workspace:Raycast(camera.CFrame.Position, camera.CFrame.LookVector * 4, rayParams)
	VM.pull = damp(VM.pull, wall and (1 - wall.Distance / 4) or 0, 14, dt)
	p += V(0, -VM.pull * 0.4, VM.pull * 1.3)
	rx -= VM.pull * 0.5
	subs.slide = CFrame.new(0, 0, VM.slide * 0.16 + ((mags[id] or 0) == 0 and 0.14 or 0))
	local pk = (G.pumpT > 0 and G.pumpT < 1) and math.sin(G.pumpT * math.pi) or 0
	subs.pump = CFrame.new(0, 0, pk * 0.3)
	if g.boltPivot then subs.bolt = g.boltPivot * CFrame.new(0, 0, pk * 0.25) * CFrame.Angles(0, 0, pk * 1.1) * g.boltPivot:Inverse() end
	local base = camera.CFrame * CFrame.new(p) * CFrame.Angles(rx, ry, rz)
	Viewmodels.place(g, base, subs)
	if g.coils then
		for i, c in ipairs(g.coils) do c.p.Transparency = 0.2 + 0.4 * (0.5 + 0.5 * math.sin(os.clock() * 8 + i)) end
	end
	-- laser sight beam
	if g.laserEntry and G.ads < 0.5 and VM.sprint < 0.5 then
		local from = g.laserEntry.p.Position
		local dir = camera.CFrame.LookVector
		local res = workspace:Raycast(from, dir * 300, rayParams)
		local to = res and res.Position or from + dir * 300
		local len = (to - from).Magnitude
		laserBeam.Size = V(0.04, 0.04, len)
		laserBeam.CFrame = CFrame.lookAt(from, to) * CFrame.new(0, 0, -len / 2)
		laserBeam.Parent = camera
		laserDot.CFrame = CFrame.new(to)
		laserDot.Parent = res and camera or nil
	else
		laserBeam.Parent = nil
		laserDot.Parent = nil
	end
	-- flash and shells
	G.flashT -= dt
	if G.flashT <= 0 then g.light.Enabled = false end
	for i = #shells, 1, -1 do
		local s = shells[i]
		s.t -= dt
		s.v -= V(0, 22 * dt, 0)
		s.local_ += s.v * dt
		s.p.CFrame = base * CFrame.new(s.local_) * CFrame.Angles(os.clock() * s.spin, 0, os.clock() * s.spin * 0.7)
		if s.t <= 0 then s.p:Destroy(); table.remove(shells, i) end
	end
	local scoped = w.scope and G.ads > 0.92
	g.model.Parent = if scoped then nil else camera
	return scoped
end

---------------------------------------------------------------- local animation of bots and pickups
local enemyPhase = setmetatable({}, { __mode = "k" })
local pickupBase = setmetatable({}, { __mode = "k" })
local function animateWorld(dt)
	local ef = workspace:FindFirstChild("Enemies")
	if ef then
		for _, m in ipairs(ef:GetChildren()) do
			local r = m.PrimaryPart
			if r then
				local v = r.AssemblyLinearVelocity
				local sp = V(v.X, 0, v.Z).Magnitude
				local kind = m:GetAttribute("Kind")
				local boss = m:GetAttribute("Boss")
				local ph = (enemyPhase[m] or rng:NextNumber() * 6) + dt * sp * (boss and 0.25 or 0.65)
				enemyPhase[m] = ph
				local amt = math.min(1, sp / 6) * (boss and 0.4 or 0.7)
				local sw = math.sin(ph) * amt
				local h1, h2 = r:FindFirstChild("Hip1"), r:FindFirstChild("Hip2")
				if h1 then h1.Transform = CFrame.Angles(sw, 0, 0) end
				if h2 then h2.Transform = CFrame.Angles(-sw, 0, 0) end
				if kind == "runner" or kind == "exploder" or kind == "h_pumpkin" then
					local t = m:FindFirstChild("Torso")
					local s1, s2 = t and t:FindFirstChild("Shoulder1"), t and t:FindFirstChild("Shoulder2")
					if s1 then s1.Transform = CFrame.Angles(-sw * 1.3, 0, 0) end
					if s2 then s2.Transform = CFrame.Angles(sw * 1.3, 0, 0) end
				elseif kind == "h_zombie" then
					-- arms stay reaching forward and claw out of step with the shamble
					local t = m:FindFirstChild("Torso")
					local s1, s2 = t and t:FindFirstChild("Shoulder1"), t and t:FindFirstChild("Shoulder2")
					if s1 then s1.Transform = CFrame.Angles(sw * 0.35, 0, math.sin(ph * 0.5) * 0.12) end
					if s2 then s2.Transform = CFrame.Angles(-sw * 0.35, 0, -math.sin(ph * 0.5) * 0.12) end
				end
			end
		end
	end
	local pf = workspace:FindFirstChild("Pickups")
	if pf then
		local t = os.clock()
		for _, m in ipairs(pf:GetChildren()) do
			if m:IsA("Model") then
				if not pickupBase[m] then pickupBase[m] = m:GetPivot() end
				m:PivotTo(pickupBase[m] * CFrame.new(0, math.sin(t * 3) * 0.4, 0) * CFrame.Angles(0, t * 1.8, 0))
			end
		end
	end
end

local function radarList()
	local out = {}
	local ef = workspace:FindFirstChild("Enemies")
	if ef then
		for _, m in ipairs(ef:GetChildren()) do
			local r = m.PrimaryPart
			if r then table.insert(out, { pos = r.Position, boss = m:GetAttribute("Boss") == true }) end
		end
	end
	local pf = workspace:FindFirstChild("Pickups")
	if pf then
		for _, m in ipairs(pf:GetChildren()) do
			if m:IsA("Model") and m.PrimaryPart then table.insert(out, { pos = m.PrimaryPart.Position, pickup = true }) end
		end
	end
	return out
end

-- the forge prompt shows the cost for the weapon in your hands
local function updateStationPrompts()
	local mapModel = workspace:FindFirstChild("FoundryMap")
	local forgeModel = mapModel and mapModel:FindFirstChild("OverclockForge")
	local body = forgeModel and forgeModel:FindFirstChild("Body")
	local prompt = body and body:FindFirstChildOfClass("ProximityPrompt")
	local id = curId()
	if prompt and id and rs then
		local tier = (rs.oc and rs.oc[id]) or 0
		prompt.ActionText = tier >= 3 and (Config.WeaponById[id].short .. " fully overclocked") or string.format("Overclock %s to tier %d", Config.WeaponById[id].short, tier + 1)
		prompt.ObjectText = tier >= 3 and "Forge" or (Config.OverclockCost[tier + 1] .. " coins")
		prompt.Enabled = deployed()
	end
	local crateModel = mapModel and mapModel:FindFirstChild("MysteryCrate")
	local cbody = crateModel and crateModel:FindFirstChild("Body")
	local cprompt = cbody and cbody:FindFirstChildOfClass("ProximityPrompt")
	if cprompt then
		cprompt.Enabled = deployed()
		cprompt.ActionText = "Mystery crate · random weapon"
	end
end

---------------------------------------------------------------- network events
Remotes.Profile.OnClientEvent:Connect(function(p)
	local first = prof == nil
	prof = p
	applySettings(p.settings or {})
	if first then
		hud:showMenu(false)
	else
		hud:refresh()
		if deployed() and alive() then showGun(true) end
	end
end)

Remotes.Run.OnClientEvent:Connect(function(snap)
	local was = deployed()
	local prevSlots = rs and rs.slots
	rs = snap
	local quiet = os.clock() - lastFireLocal > 0.35 and not G.reloading and G.burstLeft == 0
	for _, id in ipairs(snap.slots) do
		if quiet or mags[id] == nil then mags[id] = snap.mags[id] end
		if not G.reloading or reserves[id] == nil then reserves[id] = snap.reserves[id] end
	end
	if snap.cur and snap.cur ~= G.slot and G.switchT <= 0 and not was then G.slot = snap.cur end
	if snap.deployed and not was then
		hud:closeAll()
		hud:showHud(true)
		G.slot = 1
		cancelReload()
		for _, id in ipairs(snap.slots) do mags[id], reserves[id] = snap.mags[id], snap.reserves[id] end
		showGun(alive())
	elseif not snap.deployed and was then
		hud:showHud(false)
		showGun(false)
	end
	-- the mystery crate can swap the weapon in your hands
	if prevSlots and snap.deployed and prevSlots[G.slot] ~= snap.slots[G.slot] then
		cancelReload()
		mags[snap.slots[G.slot]] = snap.mags[snap.slots[G.slot]]
		showGun(alive())
	end
end)

Remotes.Hit.OnClientEvent:Connect(function(r)
	local kind = r.head and "head" or (r.weak and "weak" or (r.killed and "kill" or (r.block and "block" or "hit")))
	if r.head and r.killed then kind = "head" end
	hud:hitmarker(kind)
	if r.killed then
		Effects.sound("kill", nil, { pitch = r.head and 1.3 or 1 })
		if r.head and not settings.reduceMotion then G.hitStop = 0.05 end
	elseif r.block then
		Effects.sound("hit", nil, { pitch = 0.5 })
	else
		Effects.sound(r.head and "headshot" or "hit")
	end
	for _, n in ipairs(r.numbers or {}) do Effects.damageNumber(n[1], n[2], n[3]) end
end)

Remotes.Damage.OnClientEvent:Connect(function(amount, from, kind)
	hurtA = 1
	Effects.shake = math.min(1, Effects.shake + (0.2 + amount * 0.01) * (settings.reduceMotion and 0.3 or 1))
	Effects.sound("hurt", nil, { pitch = rand(0.9, 1.1) })
	if from and kind ~= "explosion" and root then
		local to = from - root.Position
		local ang = math.atan2(to.X, to.Z) - math.atan2(-math.sin(yaw), -math.cos(yaw))
		hud:damageDir(-ang)
	end
end)

Remotes.FX.OnClientEvent:Connect(function(kind, ...)
	local a = { ... }
	local camPos = camera.CFrame.Position
	if kind == "shot" then
		local shooter, id, origin, ends, silenced = a[1], a[2], a[3], a[4], a[5]
		if shooter == player then return end
		local w = Config.WeaponById[id]
		if w then Effects.gun(w, origin, silenced) end
		for n, e in ipairs(ends) do
			if n <= 4 then Effects.tracer(origin + (e - origin).Unit * 3, e) end
			Effects.burst("spark", e, (origin - e).Unit, 4)
		end
	elseif kind == "bolt" then Effects.bolt(a[1], a[2], a[3], a[4])
	elseif kind == "orb" then Effects.orb(a[1], a[2], a[3], a[4])
	elseif kind == "plasma" then
		Effects.plasma(a[1], a[2], a[3], a[4] == player)
		if a[4] ~= player then Effects.gun(Config.WeaponById.plasma, a[2]) end
	elseif kind == "boltEnd" then Effects.boltEnd(a[1], a[2], a[3], a[4])
	elseif kind == "arc" then Effects.arc(a[1], a[2], a[3], a[4], a[5])
	elseif kind == "arcEnd" then Effects.arcEnd(a[1])
	elseif kind == "boom" then
		local d = Effects.boom(a[1], a[2], camPos)
		if d < 90 then flashA = math.max(flashA, 0.35 * (1 - d / 90)) end
	elseif kind == "stunBoom" then
		local d = Effects.stunBoom(a[1], a[2], camPos)
		if d < 60 then flashA = math.max(flashA, 0.5 * (1 - d / 60)) end
	elseif kind == "warnRing" then Effects.warnRing(a[1], a[2], a[3])
	elseif kind == "strikeMark" then Effects.strikeMark(a[1], a[2])
	elseif kind == "turretShot" then Effects.turretShot(a[1], a[2])
	elseif kind == "snipeCharge" then Effects.snipeCharge(a[1], a[2], a[3])
	elseif kind == "snipeCancel" then Effects.snipeCancel(a[1])
	elseif kind == "fuse" then Effects.fuse(a[1])
	elseif kind == "warp" then Effects.warp(a[1], a[2])
	elseif kind == "botDeath" then Effects.botDeath(a[1], a[2], a[3])
	elseif kind == "bossSpawn" then Effects.bossSpawn(a[1])
	elseif kind == "roar" then Effects.roar(a[1], camPos)
	elseif kind == "stompCharge" then Effects.stompCharge(a[1], a[2], a[3])
	elseif kind == "stomp" then Effects.stomp(a[1], a[2], camPos)
	elseif kind == "shieldBreak" then Effects.shieldBreak(a[1])
	elseif kind == "charge" then Effects.sound("laser", a[1], { pitch = 0.35, volume = 0.5 })
	elseif kind == "slash" then Effects.sound("slash", a[1])
	elseif kind == "coins" then Effects.coins(a[1], a[2], a[3])
	elseif kind == "candy" then Effects.candy(a[1], a[2])
	elseif kind == "crateRoll" then Effects.crateRoll(a[1], a[2])
	elseif kind == "forge" then
		Effects.forge(a[1], a[3])
	elseif kind == "pickup" then
		Effects.sound("pickup", nil, { pitch = a[3] and 0.7 or 1 })
		hud:toast(a[1], nil, a[3] and "drop" or "buff")
	end
end)

local MULTI = { [2] = "Double kill", [3] = "Triple kill", [4] = "Quad kill" }
Remotes.Feed.OnClientEvent:Connect(function(killerName, weapon, victim, head, killer, multi)
	local mine = killer == player
	hud:feedEntry(killerName, weapon, victim, head, mine)
	if mine and multi and multi >= 2 then hud:showStreak(MULTI[multi] or "Rampage") end
end)

Remotes.Banner.OnClientEvent:Connect(function(title, sub, sound, isBoss)
	hud:banner(title, sub, isBoss)
	if sound == "siren" or sound == "boss" then Effects.sound("siren", nil, { pitch = isBoss and 0.6 or 1 })
	elseif sound == "clear" then Effects.sound("level", nil, { pitch = 0.8 })
	elseif sound == "strike" then Effects.sound("siren", nil, { pitch = 1.6 }) end
end)

Remotes.Toast.OnClientEvent:Connect(function(title, sub, kind)
	hud:toast(title, sub, kind)
	if kind == "level" then Effects.sound("level")
	elseif kind == "quest" then Effects.sound("level", nil, { pitch = 1.3 })
	elseif kind == "deny" then Effects.sound("deny")
	elseif kind == "drop" then Effects.sound("buy") end
end)

Remotes.BuffOffer.OnClientEvent:Connect(function(wave, choices, bonus)
	input.fire, input.ads, G.adsToggled = false, false, false
	hud:openBuffs(wave, choices, bonus, rs)
end)

Remotes.GameOver.OnClientEvent:Connect(function(summary)
	hud:showHud(false)
	showGun(false)
	Effects.clear()
	slide, mantle = nil, nil
	if controls then controls:Enable() end
	hud:showOver(summary)
end)

-- the server pushes the profile on join; ask again in case it arrived before we listened
task.spawn(function()
	task.wait(1)
	if not prof then pcall(function() Remotes.Shop:InvokeServer({ type = "sync" }) end) end
end)

---------------------------------------------------------------- main loop
RunService:BindToRenderStep("FoundryBreach", Enum.RenderPriority.Camera.Value + 1, function(dt)
	dt = math.min(dt, 0.05)
	fpsAcc += dt
	fpsN += 1
	if fpsAcc >= 0.5 then fps = math.floor(fpsN / fpsAcc + 0.5); fpsAcc, fpsN = 0, 0 end
	Effects.update(dt, camera.CFrame.Position)
	animateWorld(dt)
	local overlay = overlayOpen()
	local playing = deployed() and alive()
	UserInputService.MouseBehavior = (overlay or not playing) and Enum.MouseBehavior.Default or Enum.MouseBehavior.LockCenter
	UserInputService.MouseIconEnabled = overlay or not playing
	if overlay then input.fire = false end
	if not deployed() then
		camera.CameraType = Enum.CameraType.Scriptable
		menuAngle += dt * 0.05
		camera.CFrame = CFrame.lookAt(V(math.sin(menuAngle) * 46 * S, 14 * S, math.cos(menuAngle) * 46 * S), V(0, 3 * S, 0))
		camera.FieldOfView = 60
		return
	end
	if playing then
		updateMovement(dt)
		if not overlay then updateWeapon(dt) end
	end
	local bobA = updateCamera(dt)
	local scoped = false
	if playing then scoped = updateViewmodel(dt, bobA) else laserBeam.Parent = nil; laserDot.Parent = nil end
	hurtA = math.max(0, hurtA - dt * 2.5)
	flashA = math.max(0, flashA - dt * 2)
	updateStationPrompts()
	local id = curId()
	local w = id and wstats(id)
	if w and rs then
		local boss = nil
		local bossName = State:GetAttribute("Boss")
		if bossName and bossName ~= "" then
			boss = { name = bossName, hp = State:GetAttribute("BossHp") or 0, max = State:GetAttribute("BossMax") or 1, shield = State:GetAttribute("BossShield") or 0, shieldMax = State:GetAttribute("BossShieldMax") or 0, phase = State:GetAttribute("BossPhase") or 1 }
		end
		local gap = math.tan(math.rad(currentSpread(w))) / math.tan(math.rad(camera.FieldOfView / 2)) * camera.ViewportSize.Y / 2 + 4
		local mut = State:GetAttribute("Mutator")
		hud:update(dt, {
			hp = hum and hum.Health or 0, maxHp = hum and hum.MaxHealth or 100, armor = player:GetAttribute("Armor") or 0,
			weapon = w, mag = mags[id] or 0, reserve = reserves[id] or 0, slot = G.switchTo or G.slot, slots = rs.slots, oc = w.oc, reddot = w.reddot,
			infinite = rs.powerups and (rs.powerups.ammo or 0) > 0,
			reload = if G.reloading then (if w.shellReload then (mags[id] or 0) / w.mag else G.reloadT / G.reloadDur) else nil,
			frags = rs.frags, stuns = rs.stuns, airstrikes = rs.airstrikes, turrets = rs.turrets, killstreak = rs.killstreak,
			score = rs.score, mults = rs.mults, combo = rs.combo, comboT = rs.comboT, powerups = rs.powerups, buffs = rs.buffs,
			running = State:GetAttribute("Running"), active = State:GetAttribute("Active"), wave = State:GetAttribute("Wave") or 0,
			hostiles = State:GetAttribute("Hostiles") or 0, inter = State:GetAttribute("Intermission") or 0, mutator = (mut and mut ~= "") and mut or nil,
			ready = rs.ready, boss = boss, fps = fps,
			hasFever = rs.slots ~= nil and table.find(rs.slots, "reaper") ~= nil, fever = rs.fever, feverT = rs.feverT, night = rs.mode == "halloween",
			gap = gap, showCross = playing and G.ads < 0.5 and VM.sprint < 0.5 and G.inspectT <= 0, scoped = scoped,
			hurt = hurtA, flash = flashA, radar = radarList(), root = root and root.Position, yaw = yaw,
		})
		-- the server's combo timer only arrives with snapshots; count it down between them
		if rs.comboT and rs.comboT > 0 then rs.comboT = math.max(0, rs.comboT - dt) end
		if rs.feverT and rs.feverT > 0 then rs.feverT = math.max(0, rs.feverT - dt) end
		if rs.powerups then for k, v in pairs(rs.powerups) do if v > 0 then rs.powerups[k] = math.max(0, v - dt) end end end
	end
	if playing and w and not overlay then
		local m, r = mags[id] or 0, reserves[id] or 0
		if not hud.prompt.Visible or hud.promptAuto then
			if m == 0 and r == 0 then hud:setPrompt("Out of ammo · switch weapon or find a resupply", true); hud.promptAuto = true
			elseif m <= math.ceil(w.mag * 0.25) and not G.reloading and r > 0 then hud:setPrompt("R · Reload"); hud.promptAuto = true
			elseif hud.promptAuto then hud:setPrompt(nil); hud.promptAuto = false end
		end
	end
end)

