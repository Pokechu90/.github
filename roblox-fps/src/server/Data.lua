--!nonstrict
-- Saved player profiles (DataStore), coins, XP and levels, quests, daily challenges and leaderboards.
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("FoundryShared")
local Config = require(Shared:WaitForChild("Config"))
local Stats = require(Shared:WaitForChild("Stats"))
local Remotes = require(Shared:WaitForChild("Remotes"))

local Data = {}
local profiles: { [Player]: any } = {}
local dirty: { [Player]: boolean } = {}
local syncPending: { [Player]: boolean } = {}
local getRun: (Player) -> any = function() return nil end

local okStore, store = pcall(function() return DataStoreService:GetDataStore("FoundryBreach_v2") end)
if not okStore then store = nil; warn("[Foundry] DataStore unavailable; progress will not be saved. Enable Studio API access to test saving.") end

local function default()
	return {
		v = 2, xp = 0, level = 1, coins = 0,
		weapons = { pistol = true, smg = true, rifle = true },
		attachments = {}, equipped = {}, skin = {}, upgrades = {}, skins = { stock = true },
		loadout = { primary = "rifle", secondary = "pistol" },
		quests = {}, daily = { day = "", q = {} }, board = {},
		stats = { kills = 0, headshots = 0, bestWave = 0, bestScore = 0, bosses = 0, runs = 0, spent = 0, flawless = 0, explosiveKills = 0, weaponKills = {} },
		settings = { sens = 1, adsSens = 1, fov = 80, xhColor = "white", toggleAds = false, dmgNumbers = true },
		difficulty = "normal", map = "yard",
	}
end

local function merge(base, saved)
	if type(saved) ~= "table" then return base end
	for k, v in pairs(saved) do
		if type(v) == "table" and type(base[k]) == "table" and k ~= "loadout" then base[k] = merge(base[k], v) else base[k] = v end
	end
	return base
end

function Data.init(runGetter) getRun = runGetter end

function Data.load(plr: Player)
	local prof = default()
	if store then
		for attempt = 1, 3 do
			local ok, res = pcall(function() return store:GetAsync("u" .. plr.UserId) end)
			if ok then prof = merge(prof, res); break end
			-- Studio without API access: stop trying and play without saving
			if tostring(res):find("StudioAccessToApisNotAllowed") or tostring(res):find("403") then
				warn("[Foundry] DataStore access is off; progress will not be saved. Enable 'Studio Access to API Services' to test saving.")
				store = nil
				break
			end
			warn("[Foundry] profile load failed, retrying:", res)
			task.wait(attempt)
		end
	end
	if not Config.WeaponById[prof.loadout.primary] or not prof.weapons[prof.loadout.primary] then prof.loadout.primary = "rifle" end
	if not Config.WeaponById[prof.loadout.secondary] or not prof.weapons[prof.loadout.secondary] then prof.loadout.secondary = "pistol" end
	profiles[plr] = prof
	Data.sync(plr)
	return prof
end

function Data.save(plr: Player)
	local prof = profiles[plr]
	if not prof or not store or not dirty[plr] then return end
	dirty[plr] = false
	local ok, err = pcall(function() store:SetAsync("u" .. plr.UserId, prof) end)
	if not ok then dirty[plr] = true; warn("[Foundry] save failed:", err) end
end

function Data.get(plr: Player) return profiles[plr] end
function Data.release(plr: Player) Data.save(plr); profiles[plr] = nil; dirty[plr] = nil end

function Data.markDirty(plr: Player)
	dirty[plr] = true
	if syncPending[plr] then return end
	syncPending[plr] = true
	task.delay(0.25, function()
		syncPending[plr] = nil
		if plr.Parent then Data.sync(plr) end
	end)
end

function Data.sync(plr: Player)
	local prof = profiles[plr]
	if prof then Remotes.Profile:FireClient(plr, prof) end
end

local function toast(plr, title, sub, kind) Remotes.Toast:FireClient(plr, title, sub, kind) end

-- coins: raw amounts skip difficulty and buff multipliers
function Data.addCoins(plr: Player, n: number, raw: boolean?): number
	local prof = profiles[plr]
	if not prof then return 0 end
	local run = getRun(plr)
	if not raw and run then
		n *= (Config.Difficulty[run.diff] or Config.Difficulty.normal).reward * Stats.buffMods(run.buffs, run.powerups).coins
	end
	n = math.floor(n + 0.5)
	if n <= 0 then return 0 end
	prof.coins += n
	if run and run.active then run.coins += n end
	Data.markDirty(plr)
	return n
end

function Data.spend(plr: Player, n: number): boolean
	local prof = profiles[plr]
	if not prof or prof.coins < n then return false end
	prof.coins -= n
	prof.stats.spent += n
	Data.markDirty(plr)
	Data.questEvent(plr, "spent", n)
	return true
end

function Data.grant(plr: Player, r)
	local prof = profiles[plr]
	if not prof then return end
	if r.coins then Data.addCoins(plr, r.coins, true) end
	if r.weapon then prof.weapons[r.weapon] = true end
	if r.skin then prof.skins[r.skin] = true end
	local function att(w, a)
		prof.attachments[w] = prof.attachments[w] or {}
		prof.attachments[w][a] = true
		prof.equipped[w] = prof.equipped[w] or {}
		prof.equipped[w][a] = true
	end
	if r.att then att(r.att[1], r.att[2]) end
	if r.atts then for _, a in ipairs(r.atts) do att(a[1], a[2]) end end
	if r.xp then Data.addXp(plr, r.xp, true) end
	Data.markDirty(plr)
end

function Data.addXp(plr: Player, n: number, raw: boolean?)
	local prof = profiles[plr]
	if not prof then return end
	local run = getRun(plr)
	if not raw and run then n *= (Config.Difficulty[run.diff] or Config.Difficulty.normal).reward end
	n = math.floor(n + 0.5)
	if n <= 0 then return end
	prof.xp += n
	if run and run.active then run.xp += n end
	while prof.xp >= Stats.xpForLevel(prof.level) do
		prof.xp -= Stats.xpForLevel(prof.level)
		prof.level += 1
		if run and run.active then run.levelsGained += 1 end
		local r = table.clone(Config.LevelRewards[prof.level] or {})
		r.coins = (r.coins or 0) + 100
		Data.grant(plr, r)
		toast(plr, "Level " .. prof.level, Stats.rewardText(r), "level")
	end
	Data.markDirty(plr)
end

-- daily challenges rotate each UTC day, seeded so every server agrees
local function todayKey() return os.date("!%Y-%m-%d") end
local function ensureDaily(prof)
	local day = todayKey()
	if prof.daily.day == day and #prof.daily.q > 0 then return prof.daily.q end
	local rng = Random.new(tonumber((day:gsub("-", ""))) or 1)
	local pool = table.clone(Config.DailyPool)
	local q = {}
	while #q < 3 and #pool > 0 do
		local t = table.remove(pool, rng:NextInteger(1, #pool))
		table.insert(q, { id = t.id, goal = t.goals[rng:NextInteger(1, #t.goals)], p = 0, done = false })
	end
	prof.daily = { day = day, q = q }
	return q
end
Data.ensureDaily = function(plr) local prof = profiles[plr]; return prof and ensureDaily(prof) end

function Data.questEvent(plr: Player, ev: string, amountIn: number?, extraIn: any?)
	local prof = profiles[plr]
	if not prof then return end
	local amount: number = amountIn or 1
	local extra = extraIn or {}
	local run = getRun(plr)
	for _, q in ipairs(Config.Quests) do
		if q.ev == ev then
			local st = prof.quests[q.id] or { p = 0, done = false }
			prof.quests[q.id] = st
			if not st.done and (not q.weapon or q.weapon == extra.weapon) and (not q.diff or (run and run.diff == q.diff)) then
				st.p = q.max and math.max(st.p, amount) or st.p + amount
				if st.p >= q.goal then
					st.p = q.goal
					st.done = true
					Data.grant(plr, q.reward)
					if run and run.active then table.insert(run.questsDone, q.name) end
					toast(plr, "Quest complete: " .. q.name, Stats.rewardText(q.reward), "quest")
				end
			end
		end
	end
	for _, d in ipairs(ensureDaily(prof)) do
		local t
		for _, x in ipairs(Config.DailyPool) do if x.id == d.id then t = x end end
		if t and not d.done and t.ev == ev and (not t.type or t.type == extra.type) then
			d.p = t.max and math.max(d.p, amount) or d.p + amount
			if d.p >= d.goal then
				d.p = d.goal
				d.done = true
				Data.addCoins(plr, t.reward, true)
				Data.addXp(plr, 200, true)
				toast(plr, "Daily: " .. t.name, t.reward .. " coins · 200 XP", "quest")
			end
		end
	end
	Data.markDirty(plr)
end

-- personal top 5 per map and difficulty, plus a global best score board
local globalStores = {}
local function globalStore(mapId, diff)
	local key = mapId .. "_" .. diff
	if globalStores[key] == nil then
		local ok, s = pcall(function() return DataStoreService:GetOrderedDataStore("FB_Best_" .. key) end)
		globalStores[key] = ok and s or false
	end
	return globalStores[key] or nil
end

function Data.recordScore(plr: Player, entry): number
	local prof = profiles[plr]
	if not prof then return -1 end
	local key = entry.map .. "|" .. entry.diff
	local list = prof.board[key] or {}
	prof.board[key] = list
	table.insert(list, entry)
	table.sort(list, function(a, b) return a.score > b.score end)
	while #list > 5 do table.remove(list) end
	Data.markDirty(plr)
	local gs = globalStore(entry.map, entry.diff)
	if gs and entry.score > 0 then
		task.spawn(function()
			pcall(function()
				gs:UpdateAsync(tostring(plr.UserId), function(old) if not old or entry.score > old then return entry.score end return nil end)
			end)
		end)
	end
	return table.find(list, entry) or -1
end

local topCache = {}
local nameCache = {}
function Data.globalTop(mapId: string, diff: string)
	local key = mapId .. "_" .. diff
	local c = topCache[key]
	if c and os.clock() - c.t < 60 then return c.list end
	local gs = globalStore(mapId, diff)
	local list = {}
	if gs then
		local ok, pages = pcall(function() return gs:GetSortedAsync(false, 10) end)
		if ok and pages then
			for _, e in ipairs(pages:GetCurrentPage()) do
				local uid = tonumber(e.key) or 0
				local name = nameCache[uid]
				if not name then
					local ok2, n = pcall(function() return Players:GetNameFromUserIdAsync(uid) end)
					name = ok2 and n or ("Player " .. uid)
					nameCache[uid] = name
				end
				table.insert(list, { name = name, score = e.value })
			end
		end
	end
	topCache[key] = { t = os.clock(), list = list }
	return list
end

task.spawn(function()
	while true do
		task.wait(60)
		for plr in pairs(profiles) do task.spawn(Data.save, plr) end
	end
end)
game:BindToClose(function()
	for plr in pairs(profiles) do Data.save(plr) end
end)

return Data
