--!nonstrict
-- Foundry Breach server: runs, waves, mutators, bosses, weapons, economy, stations and the shop.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage:WaitForChild("FoundryShared")
local Config = require(Shared:WaitForChild("Config"))
local Stats = require(Shared:WaitForChild("Stats"))
local Remotes = require(Shared:WaitForChild("Remotes"))
local Data = require(script.Parent:WaitForChild("Data"))
local MapBuilder = require(script.Parent:WaitForChild("MapBuilder"))
local Enemies = require(script.Parent:WaitForChild("Enemies"))
local Bosses = require(script.Parent:WaitForChild("Bosses"))
local Combat = require(script.Parent:WaitForChild("Combat"))

local rng = Random.new()
local function rand(a, b) return a + rng:NextNumber() * (b - a) end
local V = Vector3.new
Players.RespawnTime = Config.Player.RespawnTime

local State = ReplicatedStorage:FindFirstChild("FoundryState") or Instance.new("Folder")
State.Name = "FoundryState"
State.Parent = ReplicatedStorage
local function setState(k, v) if State:GetAttribute(k) ~= v then State:SetAttribute(k, v) end end

local run = {
	running = false, wave = 0, queue = {}, spawnT = 0, active = false, inter = 0, start = 0, overT = 0,
	diff = "normal", mapId = "yard", mutator = nil, lastMutator = nil, boss = nil, bossPending = 0, isBoss = false,
}
local pdata: { [Player]: any } = {}
local map
local stationConns = {}

---------------------------------------------------------------- helpers
local function aliveChar(plr: Player)
	local c = plr.Character
	local h = c and c:FindFirstChildOfClass("Humanoid")
	local r = c and c:FindFirstChild("HumanoidRootPart")
	local head = c and c:FindFirstChild("Head")
	if h and r and head and h.Health > 0 then return c, h, r, head end
	return nil
end

local function targets()
	local t = {}
	for plr, pr in pairs(pdata) do
		if pr.deployed then
			local c, h, r, head = aliveChar(plr)
			if c then table.insert(t, { player = plr, char = c, hum = h, root = r, head = head }) end
		end
	end
	return t
end

local function deployedCount()
	local n = 0
	for _, pr in pairs(pdata) do if pr.deployed then n += 1 end end
	return math.max(1, n)
end

local function toast(plr, title, sub, kind) Remotes.Toast:FireClient(plr, title, sub, kind) end
local function banner(title, sub, sound, isBoss) Remotes.Banner:FireAllClients(title, sub, sound, isBoss == true) end

local function markRun(plr) local pr = pdata[plr]; if pr then pr.dirty = true end end

local function weaponStats(plr, id)
	return Stats.weapon(id, Data.get(plr) or {}, pdata[plr])
end

local function roundMults(pr) return Stats.roundMults(run.wave, run.mutator, pr.combo) end

local function snapshot(plr)
	local pr = pdata[plr]
	local caps = {}
	for _, id in ipairs(pr.slots) do
		local s = weaponStats(plr, id)
		caps[id] = { mag = s.mag, reserve = s.reserveCap, oc = s.oc }
	end
	return {
		deployed = pr.deployed, slots = pr.slots, cur = pr.cur, mags = pr.mags, reserves = pr.reserves, caps = caps,
		frags = pr.frags, stuns = pr.stuns, score = pr.score, kills = pr.kills, heads = pr.heads,
		combo = pr.combo, comboT = pr.comboT, bestCombo = pr.bestCombo, mults = roundMults(pr),
		coins = pr.coins, xp = pr.xp, buffs = pr.buffs, powerups = pr.powerups, oc = pr.oc,
		killstreak = pr.killstreak, airstrikes = pr.airstrikes, turrets = pr.turrets, offer = pr.offer, ready = pr.ready,
	}
end

local function refillAmmo(plr, frac)
	local pr = pdata[plr]
	if not pr then return end
	for _, id in ipairs(pr.slots) do
		local s = weaponStats(plr, id)
		pr.reserves[id] = math.min(s.reserveCap, (pr.reserves[id] or 0) + math.ceil(s.reserveCap * frac))
	end
	markRun(plr)
end

local function fillWeapon(plr, id)
	local pr = pdata[plr]
	local s = weaponStats(plr, id)
	pr.mags[id] = s.mag
	pr.reserves[id] = s.reserve
end

local function applyHealthBuffs(plr)
	local pr = pdata[plr]
	local _, h = aliveChar(plr)
	local mods = Stats.buffMods(pr.buffs, pr.powerups)
	plr:SetAttribute("Regen", mods.regen)
	if h then
		local before = h.MaxHealth
		h.MaxHealth = mods.maxHp
		if mods.maxHp > before then h.Health = math.min(h.MaxHealth, h.Health + (mods.maxHp - before)) end
	end
end

local function newRun(plr)
	local prof = Data.get(plr)
	local pr = pdata[plr]
	pr.slots = { prof.loadout.primary, prof.loadout.secondary }
	pr.cur = 1
	pr.mags, pr.reserves, pr.lastShot = {}, {}, {}
	pr.buffs, pr.powerups, pr.oc = {}, { damage = 0, speed = 0, ammo = 0 }, {}
	pr.reloadToken = nil
	pr.frags, pr.stuns = Config.Player.StartFrags, Config.Player.StartStuns
	pr.score, pr.kills, pr.heads, pr.shots, pr.hits = 0, 0, 0, 0, 0
	pr.combo, pr.comboT, pr.bestCombo, pr.multi, pr.multiT = 0, 0, 0, 0, 0
	pr.killstreak, pr.airstrikes, pr.turrets = 0, 0, 0
	pr.coins, pr.xp, pr.levelsGained, pr.questsDone, pr.drops = 0, 0, 0, {}, {}
	pr.diff = run.diff
	pr.active = true
	pr.waveHurt, pr.bossHurt = false, false
	pr.offer, pr.ready, pr.rolling = nil, false, false
	for _, id in ipairs(pr.slots) do fillWeapon(plr, id) end
	plr:SetAttribute("Armor", Config.Player.StartArmor)
	local ls = plr:FindFirstChild("leaderstats")
	if ls then ls.Score.Value = 0; ls.Kills.Value = 0 end
end

---------------------------------------------------------------- kills and rewards
local WEAPON_LABEL = { frag = "FRAG", stun = "STUN", drum = "DRUM", turret = "TURRET", airstrike = "AIR", explosion = "BLAST" }
local function weaponLabel(id) return Config.WeaponById[id] and Config.WeaponById[id].short or WEAPON_LABEL[id] or "—" end

local function rollRareDrop(prof)
	local pool: { any } = {}
	for _, w in ipairs(Config.Weapons) do
		if prof.weapons[w.id] then
			for _, a in ipairs(Config.AttachmentOrder) do
				if not Stats.attOwned(prof, w.id, a) then table.insert(pool, { r = { att = { w.id, a } }, wt = 6 }) end
			end
		end
	end
	for _, s in ipairs({ "scorch", "circuit", "arctic", "crimson", "desert" }) do
		if not prof.skins[s] then table.insert(pool, { r = { skin = s }, wt = s == "scorch" and 6 or 2 }) end
	end
	for _, w in ipairs(Config.Weapons) do
		if not prof.weapons[w.id] and w.id ~= "plasma" then table.insert(pool, { r = { weapon = w.id }, wt = 1.5 }) end
	end
	if #pool == 0 then return { coins = 1000, xp = 800 } end
	local tot = 0
	for _, x in ipairs(pool) do tot += x.wt end
	local r = rng:NextNumber() * tot
	for _, x in ipairs(pool) do
		r -= x.wt
		if r <= 0 then return x.r end
	end
	return pool[1].r
end

local function onBossKilled(boss, pos)
	local rewardPos = pos
	for plr, pr in pairs(pdata) do
		if pr.deployed then
			local prof = Data.get(plr)
			local rm = roundMults(pr)
			local coins = Data.addCoins(plr, (400 + 100 * run.wave) * rm.coins)
			Data.addXp(plr, 600 + 150 * boss.cycle)
			pr.score += math.floor((2500 + 500 * boss.cycle) * rm.total + 0.5)
			prof.stats.bosses += 1
			Data.questEvent(plr, "boss")
			if not pr.bossHurt then Data.questEvent(plr, "bossFlawless") end
			local drop = rollRareDrop(prof)
			Data.grant(plr, drop)
			local txt = Stats.rewardText(drop)
			table.insert(pr.drops, txt)
			toast(plr, "Rare drop", txt, "drop")
			Remotes.Banner:FireClient(plr, boss.name .. " destroyed", "+" .. coins .. " coins · " .. txt, "clear", true)
			Remotes.FX:FireClient(plr, "coins", rewardPos, 12)
			markRun(plr)
		end
	end
	Combat.spawnPickup("health", pos + V(6, 0, 0))
	Combat.spawnPickup("ammo", pos - V(6, 0, 0))
	run.boss = nil
	setState("Boss", "")
end

local function onKill(e, info, pos)
	if run.mutator == "volatile" and not e.boss then Combat.delayedBlast(pos, 26 * Stats.waveScale(run.wave, run.diff, nil).dmg) end
	if e.boss then onBossKilled(e, pos) end
	local plr = info.owner
	local pr = plr and pdata[plr]
	local victim = e.boss and e.name or string.format("%s-%02d", e.k.name, e.id % 100)
	if not pr or not pr.deployed then
		Remotes.Feed:FireAllClients(map and map.name or "Foundry", weaponLabel(info.weapon), victim, false, nil, 0)
		return
	end
	local prof = Data.get(plr)
	local direct = info.source == "bullet" or info.source == "plasma"
	local head = info.part == "head" and direct
	pr.kills += 1
	prof.stats.kills += 1
	if head then pr.heads += 1; prof.stats.headshots += 1; Data.questEvent(plr, "headshot") end
	local weapon = info.weapon or "unknown"
	prof.stats.weaponKills[weapon] = (prof.stats.weaponKills[weapon] or 0) + 1
	Data.questEvent(plr, "kill", 1, { weapon = weapon })
	if info.source == "explosion" or info.source == "airstrike" then
		prof.stats.explosiveKills += 1
		Data.questEvent(plr, "explosiveKill")
	end
	pr.multi = pr.multiT > 0 and pr.multi + 1 or 1
	pr.multiT = 1.6
	pr.combo += 1
	pr.comboT = Config.ComboWindow
	pr.bestCombo = math.max(pr.bestCombo, pr.combo)
	if not e.boss then Data.questEvent(plr, "killType", 1, { type = e.kind }) end
	Data.questEvent(plr, "combo", pr.combo)
	pr.killstreak += 1
	if pr.killstreak == Config.Killstreak.Airstrike then
		pr.airstrikes += 1
		toast(plr, "Airstrike ready", "Press Z to mark a target", "drop")
		Data.questEvent(plr, "airstrike")
	end
	if pr.killstreak >= Config.Killstreak.Turret then
		pr.turrets += 1
		pr.killstreak = 0
		toast(plr, "Auto-turret ready", "Press X to deploy it", "drop")
	end
	local rm = roundMults(pr)
	if not e.boss then
		local k = e.k
		local coins = k.coins + (head and 5 or 0) + (pr.multi >= 2 and 5 * math.min(pr.multi - 1, 4) or 0)
		local got = Data.addCoins(plr, coins * rm.coins)
		Remotes.FX:FireClient(plr, "coins", pos, math.ceil(got / 5), got)
		Data.addXp(plr, (k.xp + (head and 10 or 0)) * rm.xp)
		pr.score += math.floor((k.score + (head and 50 or 0)) * rm.total + 0.5)
		if e.kind ~= "exploder" then
			local r = rng:NextNumber()
			if e.kind == "tank" or r < 0.12 then Combat.spawnPickup("health", pos)
			elseif r < 0.36 then Combat.spawnPickup("ammo", pos)
			elseif r < 0.41 then Combat.spawnPickup("armor", pos)
			elseif r < 0.46 then Combat.spawnPickup(({ "pu_damage", "pu_speed", "pu_ammo" })[rng:NextInteger(1, 3)], pos) end
		end
	end
	local ls = plr:FindFirstChild("leaderstats")
	if ls then ls.Score.Value = pr.score; ls.Kills.Value = pr.kills end
	Remotes.Feed:FireAllClients(plr.DisplayName, weaponLabel(weapon), victim, head, plr, pr.multi)
	markRun(plr)
end

local function onDamaged(plr, _amount)
	local pr = pdata[plr]
	if not pr then return end
	pr.waveHurt = true
	if run.boss then pr.bossHurt = true end
	if pr.combo > 0 then
		pr.combo = math.floor(pr.combo / 2)
		markRun(plr)
	end
end

local function heal(plr, n)
	local _, h = aliveChar(plr)
	if h then h.Health = math.min(h.MaxHealth, h.Health + n) end
end

local function scale() return Stats.waveScale(math.max(1, run.wave), run.diff, run.mutator) end

Combat.init({
	pr = function(plr) return pdata[plr] end, alive = aliveChar, targets = targets, map = function() return map end,
	running = function() return run.running end, markRun = markRun, onDamaged = onDamaged, heal = heal,
	refillAmmo = refillAmmo,
})
local enemyCtx = {
	bolt = Combat.bolt, orb = Combat.orb, arc = Combat.arc, damagePlayer = Combat.damagePlayer, explosion = Combat.explosion,
	fx = Combat.fx, onKill = onKill, scale = scale, targets = targets, wave = function() return math.max(1, run.wave) end,
	ceiling = function() return map and map.ceiling or math.huge end, banner = banner,
	spawnEnemy = function(kind, pos) return Enemies.spawn(kind, pos) end,
}
Enemies.init(enemyCtx)
Bosses.init(enemyCtx)
Data.init(function(plr) return pdata[plr] end)

---------------------------------------------------------------- stations: mystery crate and overclock forge
local function crate(plr)
	local pr = pdata[plr]
	if not run.running or not pr or not pr.deployed or pr.rolling or not aliveChar(plr) then return end
	local pool = {}
	for _, w in ipairs(Config.Weapons) do
		if not table.find(pr.slots, w.id) then table.insert(pool, { id = w.id, wt = w.id == "plasma" and 0.6 or (w.price >= 2200 and 1 or 1.3) }) end
	end
	if #pool == 0 then return end
	if not Data.spend(plr, Config.CrateCost) then
		toast(plr, "Not enough coins", "The mystery crate costs " .. Config.CrateCost, "deny")
		return
	end
	local tot = 0
	for _, x in ipairs(pool) do tot += x.wt end
	local r, pick = rng:NextNumber() * tot, pool[1].id
	for _, x in ipairs(pool) do
		r -= x.wt
		if r <= 0 then pick = x.id; break end
	end
	pr.rolling = true
	Data.questEvent(plr, "box")
	Remotes.FX:FireAllClients("crateRoll", map.crate, pick, plr)
	task.delay(1.7, function()
		pr.rolling = false
		if not run.running or not pr.deployed then return end
		local old = pr.slots[pr.cur]
		pr.slots[pr.cur] = pick
		pr.mags[old], pr.reserves[old] = nil, nil
		fillWeapon(plr, pick)
		markRun(plr)
		toast(plr, "Mystery crate", Config.WeaponById[pick].name .. " replaces your " .. Config.WeaponById[old].short .. " for this run", "drop")
	end)
end

local function forge(plr)
	local pr = pdata[plr]
	if not run.running or not pr or not pr.deployed or not aliveChar(plr) then return end
	local id = pr.slots[pr.cur]
	local tier = pr.oc[id] or 0
	if tier >= 3 then toast(plr, "Fully overclocked", Config.WeaponById[id].name .. " is at tier 3", "deny"); return end
	local cost = Config.OverclockCost[tier + 1]
	if not Data.spend(plr, cost) then toast(plr, "Not enough coins", "Overclock tier " .. (tier + 1) .. " costs " .. cost, "deny"); return end
	pr.oc[id] = tier + 1
	local s = weaponStats(plr, id)
	pr.mags[id] = s.mag
	pr.reserves[id] = math.max(pr.reserves[id] or 0, math.floor(s.reserveCap * 0.6))
	markRun(plr)
	Remotes.FX:FireAllClients("forge", map.forge, plr, tier + 1)
	toast(plr, "Overclock tier " .. (tier + 1), Config.WeaponById[id].name .. ": +45% damage, bigger mags, faster reloads", "drop")
end

local function buildMap(id)
	for _, c in ipairs(stationConns) do c:Disconnect() end
	table.clear(stationConns)
	map = MapBuilder.build(id)
	run.mapId = id
	setState("Map", id)
	table.insert(stationConns, map.cratePrompt.Triggered:Connect(crate))
	table.insert(stationConns, map.forgePrompt.Triggered:Connect(forge))
end
buildMap("yard")

---------------------------------------------------------------- waves
local function rollMutator(w)
	if w < 3 or w % 5 == 0 or rng:NextNumber() > 0.6 then return nil end
	local keys = {}
	for k in pairs(Config.Mutators) do if k ~= run.lastMutator then table.insert(keys, k) end end
	table.sort(keys)
	return keys[rng:NextInteger(1, #keys)]
end

local function composeWave(w)
	local d = Config.Difficulty[run.diff]
	local isBoss = w % 5 == 0
	local mu = run.mutator and Config.Mutators[run.mutator] or {}
	local count = math.floor((isBoss and 3 + w * 0.5 or 5 + w * 2) * d.count * (mu.count or 1) * (1 + 0.5 * (deployedCount() - 1)) + 0.5)
	count = math.min(count, 44)
	local caps = { tank = w >= 6 and 1 + math.floor((w - 6) / 4) or 0, sniper = 1 + math.floor(w / 4), shield = 1 + math.floor(w / 3), exploder = 2 + math.floor(w / 3) }
	local q, counts = {}, {}
	local avail = {}
	for _, kind in ipairs(Config.EnemyOrder) do
		local k = Config.Enemies[kind]
		if k.from <= w then table.insert(avail, kind) end
		if k.from == w and not isBoss then table.insert(q, kind); counts[kind] = 1 end
	end
	local function weight(kind)
		local k = Config.Enemies[kind]
		return k.weight * (k.from == 1 and math.max(0.35, 1 - w * 0.04) or 1)
	end
	while #q < count do
		local pool, tot = {}, 0
		for _, kind in ipairs(avail) do
			if caps[kind] == nil or (counts[kind] or 0) < caps[kind] then table.insert(pool, kind); tot += weight(kind) end
		end
		local r, pick = rng:NextNumber() * tot, pool[1]
		for _, kind in ipairs(pool) do
			r -= weight(kind)
			if r <= 0 then pick = kind; break end
		end
		table.insert(q, pick)
		counts[pick] = (counts[pick] or 0) + 1
	end
	for i = #q, 2, -1 do local j = rng:NextInteger(1, i); q[i], q[j] = q[j], q[i] end
	return q, isBoss
end

local function farSpawn()
	local pts = {}
	local t = targets()
	for _, p in ipairs(map.spawnPoints) do
		local near = false
		for _, x in ipairs(t) do if (x.root.Position - p).Magnitude < math.min(105, map.half * 0.6) then near = true end end
		if not near then table.insert(pts, p) end
	end
	if #pts == 0 then pts = map.spawnPoints end
	return pts[rng:NextInteger(1, #pts)]
end

local function startWave()
	run.wave += 1
	local w = run.wave
	run.mutator = rollMutator(w)
	if run.mutator then run.lastMutator = run.mutator end
	setState("Mutator", run.mutator or "")
	MapBuilder.setBlackout(run.mutator == "blackout")
	local q, isBoss = composeWave(w)
	run.queue, run.active, run.spawnT, run.isBoss = q, true, 1.2, isBoss
	run.bossPending = isBoss and 2.5 or 0
	for plr, pr in pairs(pdata) do
		if pr.deployed then
			pr.waveHurt = false
			pr.ready = false
			if pr.offer then pr.offer = nil end
			markRun(plr)
		end
	end
	setState("Wave", w)
	setState("Active", true)
	if isBoss then
		local def = Bosses.forWave(w)
		for _, pr in pairs(pdata) do pr.bossHurt = false end
		banner(def.name, def.title .. " · boss wave " .. w, "boss", true)
	else
		local mu = run.mutator and Config.Mutators[run.mutator]
		local wm = 1 + 0.1 * (w - 1)
		if mu then
			banner("Wave " .. w, string.format("%s · x%.1f wave · x%.2g risk", mu.name, wm, mu.reward), "siren")
			for plr, pr in pairs(pdata) do
				if pr.deployed then toast(plr, "Round modifier: " .. mu.name, mu.desc .. " Reward x" .. mu.reward .. (mu.coins and (", coins x" .. mu.coins) or "") .. ".", "drop") end
			end
		else
			banner("Wave " .. w, string.format("%d hostiles · x%.1f wave multiplier", #q, wm), "siren")
		end
		for _, kind in ipairs(Config.EnemyOrder) do
			local k = Config.Enemies[kind]
			if k.from == w and Config.EnemyTips[kind] then
				for plr, pr in pairs(pdata) do if pr.deployed then toast(plr, "New threat: " .. k.name, Config.EnemyTips[kind], "threat") end end
			end
		end
	end
end

local function rollBuffs(pr, n)
	local keys = {}
	for k, b in pairs(Config.Buffs) do if (pr.buffs[k] or 0) < b.max then table.insert(keys, k) end end
	table.sort(keys)
	for i = #keys, 2, -1 do local j = rng:NextInteger(1, i); keys[i], keys[j] = keys[j], keys[i] end
	local out = {}
	for i = 1, math.min(n, #keys) do out[i] = keys[i] end
	return out
end

local function waveCleared()
	run.active = false
	local w = run.wave
	run.mutator = nil
	setState("Mutator", "")
	MapBuilder.setBlackout(false)
	for plr, pr in pairs(pdata) do
		if pr.deployed then
			local prof = Data.get(plr)
			local rm = roundMults(pr)
			local bonus = Data.addCoins(plr, 25 * w * rm.coins)
			Data.addXp(plr, (60 + 20 * w) * rm.xp)
			if not pr.waveHurt then
				local fb = Data.addCoins(plr, 50 + 10 * w)
				prof.stats.flawless += 1
				Data.questEvent(plr, "flawless")
				toast(plr, "Flawless wave", "+" .. fb .. " coins for taking no damage", "drop")
			end
			prof.stats.bestWave = math.max(prof.stats.bestWave, w)
			Data.questEvent(plr, "wave", w)
			pr.score += 250 * w
			plr:SetAttribute("Armor", math.min(Config.Player.MaxArmor, (plr:GetAttribute("Armor") or 0) + 15))
			pr.frags = math.min(Config.Player.MaxFrags, pr.frags + 1)
			refillAmmo(plr, 0.3)
			local ls = plr:FindFirstChild("leaderstats")
			if ls then ls.Score.Value = pr.score end
			local choices = rollBuffs(pr, 3)
			pr.offer = #choices > 0 and choices or nil
			pr.ready = false
			if pr.offer then Remotes.BuffOffer:FireClient(plr, w, choices, bonus) end
			Remotes.Banner:FireClient(plr, "Wave " .. w .. " cleared", "+" .. bonus .. " coins · resupply delivered", "clear", false)
			markRun(plr)
		end
	end
	run.inter = 20
	setState("Active", false)
end

---------------------------------------------------------------- run lifecycle
local function clearWorld()
	Enemies.clear()
	Combat.clear()
	run.boss = nil
	setState("Boss", "")
	for _, n in ipairs({ "Pickups", "Projectiles", "Debris" }) do
		local f = workspace:FindFirstChild(n)
		if f then f:ClearAllChildren() end
	end
	map.drumFolder:ClearAllChildren()
	for _, t in ipairs(map.drumTemplates) do t:Clone().Parent = map.drumFolder end
end

local function startRun(mapId, diff)
	if mapId ~= run.mapId then buildMap(mapId) end
	clearWorld()
	run.running, run.wave, run.queue, run.active, run.inter, run.start, run.overT = true, 0, {}, false, 6, os.clock(), 0
	run.diff, run.mutator, run.lastMutator = diff, nil, nil
	setState("Running", true); setState("Wave", 0); setState("Diff", diff); setState("Mutator", "")
	MapBuilder.setBlackout(false)
	banner(map.name, Config.Difficulty[diff].label .. " · first wave in 6 seconds", "start", false)
end

local function endRun()
	if not run.running then return end
	run.running = false
	setState("Running", false); setState("Active", false); setState("Hostiles", 0); setState("Mutator", "")
	MapBuilder.setBlackout(false)
	local duration = os.clock() - run.start
	for plr, pr in pairs(pdata) do
		if pr.deployed then
			local prof = Data.get(plr)
			prof.stats.runs += 1
			prof.stats.bestScore = math.max(prof.stats.bestScore, pr.score)
			local entry = { score = pr.score, wave = run.wave, kills = pr.kills, map = run.mapId, diff = run.diff, date = os.date("!%Y-%m-%d") }
			local rank = Data.recordScore(plr, entry)
			Data.markDirty(plr)
			Remotes.GameOver:FireClient(plr, {
				score = pr.score, wave = run.wave, kills = pr.kills, heads = pr.heads, time = duration,
				acc = pr.shots > 0 and math.floor(pr.hits / pr.shots * 100 + 0.5) or 0,
				coins = pr.coins, xp = pr.xp, levels = pr.levelsGained, quests = pr.questsDone, drops = pr.drops,
				bestCombo = pr.bestCombo, rank = rank, map = run.mapId, diff = run.diff,
			})
			pr.deployed = false
			pr.active = false
			markRun(plr)
			task.spawn(Data.save, plr)
		end
	end
	task.delay(4, function()
		if run.running then return end
		clearWorld()
		for plr in pairs(pdata) do if plr.Parent then plr:LoadCharacter() end end
	end)
end

local function updateWaves(dt)
	if not run.running then return end
	if run.active then
		if run.bossPending > 0 then
			run.bossPending -= dt
			if run.bossPending <= 0 then
				run.boss = Bosses.spawn(run.wave, farSpawn(), deployedCount())
			end
		end
		run.spawnT -= dt
		local normal = Enemies.count() - (run.boss and 1 or 0)
		local d = Config.Difficulty[run.diff]
		local cap = math.min(20, math.floor((6 + run.wave) * d.count + 0.5)) - (run.isBoss and 3 or 0) + 3 * (deployedCount() - 1)
		if #run.queue > 0 and run.spawnT <= 0 and normal < cap then
			local p = farSpawn() + V(rand(-8, 8), 0, rand(-8, 8))
			Enemies.spawn(table.remove(run.queue, 1) :: any, p)
			run.spawnT = rand(0.5, 1.3) * (run.isBoss and 2 or 1)
		end
		if #run.queue == 0 and Enemies.count() == 0 and run.bossPending <= 0 then waveCleared() end
	else
		run.inter -= dt
		-- everyone ready and no buff picks pending: start early
		local all, any = true, false
		for _, pr in pairs(pdata) do
			if pr.deployed then
				any = true
				if not pr.ready or pr.offer then all = false end
			end
		end
		if any and all and run.inter > 3 then run.inter = 3 end
		setState("Intermission", math.max(0, math.ceil(run.inter)))
		if run.inter <= 0 then startWave() end
	end
	setState("Hostiles", Enemies.count() + #run.queue)
	local b = run.boss
	if b and (b.dead or not table.find(Enemies.list(), b)) then
		run.boss = nil
		setState("Boss", "")
	elseif b and b.hp > 0 then
		setState("Boss", b.name)
		setState("BossHp", math.ceil(b.hp)); setState("BossMax", math.ceil(b.hpMax))
		setState("BossShield", math.ceil(b.shield)); setState("BossShieldMax", math.ceil(b.shieldMax))
		setState("BossPhase", b.phase)
	end
	-- overrun when every deployed player is down at once
	local deployed, alive = 0, 0
	for plr, pr in pairs(pdata) do
		if pr.deployed then
			deployed += 1
			if aliveChar(plr) then alive += 1 end
		end
	end
	if deployed == 0 then endRun()
	elseif alive == 0 then
		run.overT += dt
		if run.overT > 1.5 then endRun() end
	else
		run.overT = 0
	end
end

---------------------------------------------------------------- players
local function onPlayer(plr: Player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	local sc = Instance.new("IntValue"); sc.Name = "Score"; sc.Parent = ls
	local k = Instance.new("IntValue"); k.Name = "Kills"; k.Parent = ls
	local lv = Instance.new("IntValue"); lv.Name = "Level"; lv.Parent = ls
	ls.Parent = plr
	pdata[plr] = { deployed = false, slots = { "rifle", "pistol" }, cur = 1, mags = {}, reserves = {}, lastShot = {}, buffs = {}, powerups = {}, oc = {}, frags = 0, stuns = 0, score = 0, kills = 0, heads = 0, combo = 0, comboT = 0, bestCombo = 0, killstreak = 0, airstrikes = 0, turrets = 0, coins = 0, xp = 0, levelsGained = 0, questsDone = {}, drops = {}, lastThrow = 0, multi = 0, multiT = 0, shots = 0, hits = 0 }
	local prof = Data.load(plr)
	lv.Value = prof.level
	Data.ensureDaily(plr)
	plr:SetAttribute("Armor", Config.Player.StartArmor)
	plr.CharacterAdded:Connect(function(c)
		local pr = pdata[plr]
		if not pr then return end
		pr.reloadToken = nil
		local hum = c:WaitForChild("Humanoid") :: Humanoid
		if pr.deployed and run.running then
			for _, id in ipairs(pr.slots) do
				local s = weaponStats(plr, id)
				pr.mags[id] = s.mag
				pr.reserves[id] = math.max(pr.reserves[id] or 0, math.floor(s.reserve * 0.5))
			end
			plr:SetAttribute("Armor", Config.Player.StartArmor)
		end
		task.wait()
		applyHealthBuffs(plr)
		hum.Health = hum.MaxHealth
		hum.Died:Connect(function()
			local p = pdata[plr]
			if p then p.killstreak = 0; p.combo = 0; markRun(plr) end
		end)
		markRun(plr)
	end)
	markRun(plr)
end
Players.PlayerAdded:Connect(onPlayer)
for _, p in ipairs(Players:GetPlayers()) do task.spawn(onPlayer, p) end
Players.PlayerRemoving:Connect(function(p)
	pdata[p] = nil
	Data.release(p)
end)

---------------------------------------------------------------- remotes
Remotes.Deploy.OnServerEvent:Connect(function(plr, mapId, diff)
	local pr = pdata[plr]
	local prof = Data.get(plr)
	if not pr or not prof or pr.deployed then return end
	if not run.running then
		if typeof(mapId) ~= "string" or not Config.MapById[mapId] or not Stats.mapUnlocked(prof, mapId) then mapId = "yard" end
		if typeof(diff) ~= "string" or not Config.Difficulty[diff] then diff = "normal" end
		prof.map, prof.difficulty = mapId, diff
		startRun(mapId, diff)
	end
	pr.deployed = true
	newRun(plr)
	plr:LoadCharacter()
	markRun(plr)
end)

local function validOrigin(plr, origin)
	local c, _, _, head = aliveChar(plr)
	return c ~= nil and typeof(origin) == "Vector3" and (origin - head.Position).Magnitude < 14
end

Remotes.Fire.OnServerEvent:Connect(function(plr, slot, origin, dirs)
	local pr = pdata[plr]
	if not pr or not pr.deployed or not run.running or typeof(slot) ~= "number" or typeof(dirs) ~= "table" or not validOrigin(plr, origin) then return end
	local id = pr.slots[slot]
	if not id then return end
	if slot ~= pr.cur then pr.cur = slot; pr.reloadToken = nil end
	local w = weaponStats(plr, id)
	local now = os.clock()
	if now - (pr.lastShot[id] or 0) < 60 / w.rpm * 0.55 then return end
	if pr.reloadToken then
		if not w.shellReload then return end
		pr.reloadToken = nil
	end
	if (pr.mags[id] or 0) <= 0 then markRun(plr); return end
	pr.lastShot[id] = now
	if (pr.powerups.ammo or 0) <= 0 then pr.mags[id] -= 1 end
	pr.shots += 1
	if w.projectile then
		local dir = dirs[1]
		if typeof(dir) ~= "Vector3" or dir.Magnitude < 0.01 then return end
		Combat.plasma(plr, origin, dir.Unit, w)
		Remotes.FX:FireAllClients("shot", plr, id, origin, {}, w.silenced)
	else
		local any, ends = Combat.hitscan(plr, origin, dirs, w)
		if any then pr.hits += 1 end
		Remotes.FX:FireAllClients("shot", plr, id, origin, ends, w.silenced)
	end
end)

Remotes.Reload.OnServerEvent:Connect(function(plr, slot)
	local pr = pdata[plr]
	local id = pr and typeof(slot) == "number" and pr.slots[slot]
	if not pr or not id or not pr.deployed then return end
	local w = weaponStats(plr, id)
	if pr.reloadToken or (pr.mags[id] or 0) >= w.mag or (pr.reserves[id] or 0) <= 0 then return end
	local token = {}
	pr.reloadToken = token
	local tactical = (pr.mags[id] or 0) > 0 and not w.shellReload
	task.spawn(function()
		if w.shellReload then
			while pr.reloadToken == token and pr.mags[id] and pr.mags[id] < w.mag and pr.reserves[id] > 0 do
				task.wait(w.reload * 0.9)
				if pr.reloadToken ~= token or not pr.mags[id] then break end
				pr.mags[id] += 1
				pr.reserves[id] -= 1
			end
		else
			task.wait(w.reload * (tactical and 0.8 or 1) * 0.9)
			if pr.reloadToken == token and pr.mags[id] then
				local n = math.min(w.mag - pr.mags[id], pr.reserves[id])
				pr.mags[id] += n
				pr.reserves[id] -= n
			end
		end
		if pr.reloadToken == token then pr.reloadToken = nil end
		markRun(plr)
	end)
end)

Remotes.Equip.OnServerEvent:Connect(function(plr, slot)
	local pr = pdata[plr]
	if pr and typeof(slot) == "number" and pr.slots[slot] then
		pr.cur = slot
		pr.reloadToken = nil
	end
end)

Remotes.Throw.OnServerEvent:Connect(function(plr, kind, origin, dir)
	local pr = pdata[plr]
	if not pr or not pr.deployed or not run.running or typeof(dir) ~= "Vector3" or dir.Magnitude < 0.01 or not validOrigin(plr, origin) then return end
	if kind ~= "frag" and kind ~= "stun" then return end
	if os.clock() - pr.lastThrow < 0.8 then return end
	if kind == "frag" then
		if pr.frags <= 0 then return end
		pr.frags -= 1
	else
		if pr.stuns <= 0 then return end
		pr.stuns -= 1
	end
	pr.lastThrow = os.clock()
	markRun(plr)
	Combat.throw(plr, kind, origin, dir.Unit)
end)

Remotes.Killstreak.OnServerEvent:Connect(function(plr, kind, pos)
	local pr = pdata[plr]
	local c, _, root = nil, nil, nil
	if pr then c, _, root = aliveChar(plr) end
	if not pr or not pr.deployed or not run.running or not c or typeof(pos) ~= "Vector3" then return end
	if kind == "airstrike" and pr.airstrikes > 0 then
		if (pos - root.Position).Magnitude > 800 then return end
		pr.airstrikes -= 1
		Combat.airstrike(plr, pos)
	elseif kind == "turret" and pr.turrets > 0 then
		if (pos - root.Position).Magnitude > 40 then pos = root.Position + root.CFrame.LookVector * 8 - V(0, 3, 0) end
		pr.turrets -= 1
		Combat.turret(plr, pos)
	end
	markRun(plr)
end)

Remotes.BuffPick.OnServerEvent:Connect(function(plr, key)
	local pr = pdata[plr]
	if not pr or not pr.offer or typeof(key) ~= "string" or not table.find(pr.offer, key) then return end
	pr.offer = nil
	pr.buffs[key] = (pr.buffs[key] or 0) + 1
	if key == "health" then applyHealthBuffs(plr); heal(plr, 20)
	elseif key == "blast" then pr.frags = math.min(Config.Player.MaxFrags, pr.frags + 1)
	elseif key == "plating" then plr:SetAttribute("Armor", math.min(Config.Player.MaxArmor, (plr:GetAttribute("Armor") or 0) + 30))
	elseif key == "regen" then applyHealthBuffs(plr) end
	toast(plr, Config.Buffs[key].name, Config.Buffs[key].desc, "buff")
	markRun(plr)
end)

Remotes.Ready.OnServerEvent:Connect(function(plr)
	local pr = pdata[plr]
	if pr and pr.deployed and run.running and not run.active then pr.ready = true; markRun(plr) end
end)

local XH_COLORS = { white = true, green = true, cyan = true, yellow = true, magenta = true, red = true }
Remotes.SaveSettings.OnServerEvent:Connect(function(plr, s)
	local prof = Data.get(plr)
	if not prof or typeof(s) ~= "table" then return end
	local out = prof.settings
	local function num(k, lo, hi) if typeof(s[k]) == "number" and s[k] == s[k] then out[k] = math.clamp(s[k], lo, hi) end end
	local function bool(k) if typeof(s[k]) == "boolean" then out[k] = s[k] end end
	num("sens", 0.1, 4); num("adsSens", 0.2, 2); num("fov", 70, 100); num("volume", 0, 1); num("music", 0, 1); num("padSens", 0.3, 3); num("xhSize", 0.5, 2)
	bool("toggleAds"); bool("dmgNumbers"); bool("invert"); bool("fpsCounter"); bool("reduceMotion")
	if typeof(s.xhColor) == "string" and XH_COLORS[s.xhColor] then out.xhColor = s.xhColor end
	if typeof(s.xhStyle) == "string" and (s.xhStyle == "cross" or s.xhStyle == "dot" or s.xhStyle == "circle") then out.xhStyle = s.xhStyle end
	Data.markDirty(plr)
end)

---------------------------------------------------------------- shop (profile purchases, loadout and intermission supplies)
local SUPPLY = {
	ammo = { cost = 150, name = "Ammo crate" },
	armor = { cost = 200, name = "Armor plate" },
	frag = { cost = 120, name = "Frag grenade" },
	stun = { cost = 120, name = "Stun grenade" },
	heal = { cost = 150, name = "Field repair" },
}
local function shop(plr, req)
	local prof = Data.get(plr)
	local pr = pdata[plr]
	if not prof or not pr or typeof(req) ~= "table" then return false, "Bad request" end
	local t = req.type
	local w = typeof(req.id) == "string" and Config.WeaponById[req.id] or nil
	if t == "buyWeapon" then
		if not w then return false, "Unknown weapon" end
		if prof.weapons[w.id] then return false, "Already owned" end
		if prof.level < w.level then return false, "Reach level " .. w.level end
		if not Data.spend(plr, w.price) then return false, "Not enough coins" end
		prof.weapons[w.id] = true
		return true, w.name .. " unlocked"
	elseif t == "buyAtt" then
		local a = typeof(req.att) == "string" and Config.Attachments[req.att]
		if not w or not a or not prof.weapons[w.id] then return false, "Unavailable" end
		if Stats.attOwned(prof, w.id, req.att) then return false, "Already owned" end
		if not Data.spend(plr, a.price) then return false, "Not enough coins" end
		Data.grant(plr, { att = { w.id, req.att } })
		return true, a.name .. " fitted"
	elseif t == "toggleAtt" then
		if not w or not Stats.attOwned(prof, w.id, req.att) then return false, "Not owned" end
		prof.equipped[w.id] = prof.equipped[w.id] or {}
		prof.equipped[w.id][req.att] = not prof.equipped[w.id][req.att]
		Data.markDirty(plr)
		return true, (prof.equipped[w.id][req.att] and "Equipped " or "Removed ") .. Config.Attachments[req.att].name
	elseif t == "upgrade" then
		local u = typeof(req.stat) == "string" and Config.Upgrades[req.stat]
		if not w or not u or not prof.weapons[w.id] then return false, "Unavailable" end
		local lvl = Stats.upgradeLevel(prof, w.id, req.stat)
		if lvl >= Config.UpgradeMax then return false, "Maxed" end
		if not Data.spend(plr, Stats.upgradeCost(prof, w.id, req.stat)) then return false, "Not enough coins" end
		prof.upgrades[w.id] = prof.upgrades[w.id] or {}
		prof.upgrades[w.id][req.stat] = lvl + 1
		Data.markDirty(plr)
		return true, u.name .. " level " .. (lvl + 1)
	elseif t == "skin" then
		if not w or typeof(req.skin) ~= "string" or not prof.skins[req.skin] then return false, "Skin locked" end
		prof.skin[w.id] = req.skin
		Data.markDirty(plr)
		return true, Config.Skins[req.skin].name .. " applied"
	elseif t == "loadout" then
		if not w or not prof.weapons[w.id] or (req.slot ~= "primary" and req.slot ~= "secondary") then return false, "Unavailable" end
		local other = req.slot == "primary" and "secondary" or "primary"
		if prof.loadout[other] == w.id then prof.loadout[other] = prof.loadout[req.slot] end
		prof.loadout[req.slot] = w.id
		Data.markDirty(plr)
		return true, w.name .. " equipped"
	elseif t == "sync" then
		Data.sync(plr)
		markRun(plr)
		return true, ""
	elseif t == "prefs" then
		if typeof(req.map) == "string" and Config.MapById[req.map] then prof.map = req.map end
		if typeof(req.diff) == "string" and Config.Difficulty[req.diff] then prof.difficulty = req.diff end
		Data.markDirty(plr)
		return true, ""
	elseif t == "supply" then
		local item = typeof(req.item) == "string" and SUPPLY[req.item]
		if not item then return false, "Unknown item" end
		if not run.running or run.active or not pr.deployed then return false, "Supplies are sold between waves" end
		local _, h = aliveChar(plr)
		if req.item == "armor" and (plr:GetAttribute("Armor") or 0) >= Config.Player.MaxArmor then return false, "Armor full" end
		if req.item == "frag" and pr.frags >= Config.Player.MaxFrags then return false, "Frags full" end
		if req.item == "stun" and pr.stuns >= Config.Player.MaxStuns then return false, "Stuns full" end
		if req.item == "heal" and (not h or h.Health >= h.MaxHealth) then return false, "Health full" end
		if not Data.spend(plr, item.cost) then return false, "Not enough coins" end
		if req.item == "ammo" then refillAmmo(plr, 1)
		elseif req.item == "armor" then plr:SetAttribute("Armor", math.min(Config.Player.MaxArmor, (plr:GetAttribute("Armor") or 0) + 50))
		elseif req.item == "frag" then pr.frags += 1
		elseif req.item == "stun" then pr.stuns += 1
		elseif req.item == "heal" and h then h.Health = h.MaxHealth end
		markRun(plr)
		return true, item.name
	end
	return false, "Unknown request"
end
Remotes.Shop.OnServerInvoke = function(plr, req)
	local ok, a, b = pcall(shop, plr, req)
	if not ok then warn("[Foundry] shop error:", a); return false, "Server error" end
	-- profile edits during a run can change magazine sizes
	local pr = pdata[plr]
	if a and pr and pr.deployed then
		for _, id in ipairs(pr.slots) do
			local s = weaponStats(plr, id)
			pr.mags[id] = math.min(pr.mags[id] or 0, s.mag)
		end
		markRun(plr)
	end
	return a, b
end

Remotes.Leaderboard.OnServerInvoke = function(plr, mapId, diff)
	local prof = Data.get(plr)
	if typeof(mapId) ~= "string" or not Config.MapById[mapId] then mapId = "yard" end
	if typeof(diff) ~= "string" or not Config.Difficulty[diff] then diff = "normal" end
	return { personal = prof and prof.board[mapId .. "|" .. diff] or {}, global = Data.globalTop(mapId, diff) }
end

---------------------------------------------------------------- main loop
local syncT = 0
RunService.Heartbeat:Connect(function(dt)
	updateWaves(dt)
	if run.running then
		Enemies.update(dt, targets())
		Combat.update(dt)
	end
	Combat.flush()
	for plr, pr in pairs(pdata) do
		if pr.deployed then
			if pr.comboT > 0 then
				pr.comboT -= dt
				if pr.comboT <= 0 then pr.combo = 0; pr.comboT = 0; markRun(plr) end
			end
			if pr.multiT > 0 then pr.multiT -= dt end
			for k, v in pairs(pr.powerups) do
				if v > 0 then
					pr.powerups[k] = math.max(0, v - dt)
					if pr.powerups[k] == 0 then markRun(plr) end
				end
			end
		end
	end
	syncT -= dt
	if syncT <= 0 then
		syncT = 0.1
		for plr, pr in pairs(pdata) do
			if pr.dirty then
				pr.dirty = false
				Remotes.Run:FireClient(plr, snapshot(plr))
				local prof = Data.get(plr)
				local ls = plr:FindFirstChild("leaderstats")
				if prof and ls then ls.Level.Value = prof.level end
			end
		end
	end
end)
