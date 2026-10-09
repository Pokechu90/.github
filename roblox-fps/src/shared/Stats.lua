--!nonstrict
-- Stat math shared by server (authoritative) and client (prediction and UI).
local Config = require(script.Parent:WaitForChild("Config"))

local Stats = {}

function Stats.xpForLevel(L: number): number
	return math.floor(500 + 250 * (L - 1) + 40 * (L - 1) * (L - 1) + 0.5)
end

function Stats.upgradeLevel(prof, id: string, stat: string): number
	return (prof.upgrades and prof.upgrades[id] and prof.upgrades[id][stat]) or 0
end

function Stats.upgradeCost(prof, id: string, stat: string): number
	local lvl = Stats.upgradeLevel(prof, id, stat)
	return math.floor(Config.WeaponById[id].upCost * (lvl + 1) * (1 + lvl * 0.35) / 10 + 0.5) * 10
end

function Stats.attOwned(prof, id: string, a: string): boolean
	return prof.attachments ~= nil and prof.attachments[id] ~= nil and prof.attachments[id][a] == true
end

function Stats.attOn(prof, id: string, a: string): boolean
	return Stats.attOwned(prof, id, a) and prof.equipped ~= nil and prof.equipped[id] ~= nil and prof.equipped[id][a] == true
end

function Stats.buffMods(buffs, powerups)
	buffs = buffs or {}
	powerups = powerups or {}
	local function n(k) return buffs[k] or 0 end
	return {
		reload = 0.85 ^ n("reload"),
		rate = 1 + 0.1 * n("rate"),
		damage = (1 + 0.1 * n("damage")) * ((powerups.damage or 0) > 0 and 2 or 1),
		maxHp = 100 + 20 * n("health"),
		speed = (1 + 0.08 * n("speed")) * ((powerups.speed or 0) > 0 and 1.35 or 1),
		mag = 1 + 0.2 * n("mag"),
		regen = 2 * n("regen"),
		head = 0.3 * n("head"),
		leech = 0.03 * n("leech"),
		coins = 1 + 0.15 * n("prospector"),
		blast = 1 + 0.25 * n("blast"),
		armorMul = 0.9 ^ n("plating"),
		infinite = (powerups.ammo or 0) > 0,
	}
end

-- Effective weapon stats: base -> upgrades -> attachments -> run buffs -> overclock tier.
function Stats.weapon(id: string, prof, runState)
	local w = Config.WeaponById[id]
	local s = table.clone(w)
	local up = function(k) return Stats.upgradeLevel(prof, id, k) end
	-- event guns have their own optics, so a red dot attachment never applies to them
	local on = function(a) return not (a == "reddot" and w.event ~= nil) and Stats.attOn(prof, id, a) end
	local U = Config.Upgrades
	s.dmg = w.dmg * (1 + U.damage.per * up("damage")) * (on("silencer") and 0.95 or 1)
	s.rpm = w.rpm * (1 + U.rate.per * up("rate"))
	if w.burstDelay then s.burstDelay = w.burstDelay / (1 + U.rate.per * up("rate")) end
	s.reload = w.reload * (1 - U.reload.per * up("reload"))
	s.mag = math.floor(w.mag * (1 + U.mag.per * up("mag")) * (on("extmag") and 1.4 or 1) + 0.5)
	local acc = 1 - U.accuracy.per * up("accuracy")
	s.spread = w.spread * acc * (on("laser") and 0.65 or 1)
	s.adsSpread = w.adsSpread * acc * (on("reddot") and 0.75 or 1)
	s.recoil = w.recoil * (on("grip") and 0.75 or 1)
	s.adsRecoil = on("reddot") and 0.85 or 1
	s.reddot, s.silenced, s.laser = on("reddot"), on("silencer"), on("laser")
	s.scope = w.scope and not s.reddot
	s.zoom = (w.scope and s.reddot) and 0.8 or w.zoom
	if w.builtinSight then
		-- the Fang's holo sight behaves like a red dot without taking the attachment slot
		s.reddot = true
		s.adsSpread *= 0.85
		s.adsRecoil = 0.85
	end
	if w.special == "fever" then s.rpm *= Config.Halloween.Fever.rate end
	local reserveCap = w.reserve * 1.5
	if runState then
		local m = Stats.buffMods(runState.buffs, runState.powerups)
		s.rpm *= m.rate
		if s.burstDelay then s.burstDelay /= m.rate end
		s.reload *= m.reload
		s.mag = math.max(1, math.floor(s.mag * m.mag + 0.5))
		local oc = (runState.oc and runState.oc[id]) or 0
		if oc > 0 then
			s.dmg *= 1 + 0.45 * oc
			s.mag = math.floor(s.mag * (1 + 0.25 * oc) + 0.5)
			s.reload *= 1 - 0.08 * oc
			reserveCap *= 1 + 0.3 * oc
		end
		s.oc = oc
	end
	s.reserveCap = math.floor(reserveCap + 0.5)
	return s
end

-- Round multipliers: wave growth x round modifier x kill combo.
function Stats.roundMults(wave: number, mutator: string?, combo: number)
	wave = math.max(1, wave)
	local mu = mutator and Config.Mutators[mutator] or nil
	local c = math.min(combo or 0, 20)
	local w = 1 + 0.1 * (wave - 1)
	local mut = mu and mu.reward or 1
	local cm = 1 + 0.1 * c
	return {
		wave = w, mut = mut, combo = cm, total = w * mut * cm,
		coins = (1 + 0.03 * (wave - 1)) * mut * ((mu and mu.coins) or 1) * (1 + 0.01 * c),
		xp = (1 + 0.03 * (wave - 1)) * mut,
	}
end

-- Enemy scaling per wave, difficulty and modifier.
function Stats.waveScale(wave: number, diff: string, mutator: string?)
	local d = Config.Difficulty[diff] or Config.Difficulty.normal
	local mu = mutator and Config.Mutators[mutator] or {}
	return {
		hp = (1 + 0.09 * (wave - 1)) * d.hp * (mu.hp or 1),
		speed = math.min(1.35, 1 + 0.015 * (wave - 1)) * d.speed * (mu.speed or 1),
		dmg = (1 + 0.035 * (wave - 1)) * d.dmg * (mu.dmg or 1),
	}
end

-- ---------------------------------------------------------------- events, skins and the grind loop
function Stats.halloweenActive(): boolean
	local force = Config.Halloween.Force
	if force ~= nil then return force end
	local d = os.date("!*t")
	return d.month == 10 or (d.month == 11 and d.day <= 7)
end

-- a skin fits a weapon unless it is gun-specific
function Stats.skinFits(key: string, id: string): boolean
	local s = Config.Skins[key]
	return s ~= nil and (s.only == nil or s.only == id)
end

-- the skin a weapon actually shows: an owned, fitting choice, else the weapon's own finish, else Factory
function Stats.weaponSkin(prof, id: string): string
	local k = prof.skin and prof.skin[id]
	if k and Stats.skinFits(k, id) and prof.skins and prof.skins[k] then return k end
	local w = Config.WeaponById[id]
	return (w and w.defaultSkin) or "stock"
end

function Stats.prestigeMult(prof): number
	return 1 + Config.Prestige.bonus * ((prof and prof.prestige) or 0)
end

function Stats.passTier(prof): number
	local xp = (prof and prof.pass and prof.pass.xp) or 0
	return math.min(Config.Pass.tiers, math.floor(xp / Config.Pass.xpPerTier))
end

function Stats.mapUnlocked(prof, mapId: string): boolean
	local m = Config.MapById[mapId]
	if not m then return false end
	if not m.unlock then return true end
	return (prof.level or 1) >= m.unlock.level or ((prof.stats and prof.stats.bestWave) or 0) >= m.unlock.wave
end

function Stats.partMult(part: string, headMult: number): number
	if part == "head" then return headMult end
	if part == "weak" then return 2.5 end
	if part == "limb" then return 0.8 end
	return 1
end

function Stats.rewardText(r): string
	local out = {}
	if r.coins then table.insert(out, string.format("%d coins", r.coins)) end
	if r.weapon then table.insert(out, Config.WeaponById[r.weapon].name) end
	if r.skin then table.insert(out, Config.Skins[r.skin].name .. " skin") end
	if r.att then table.insert(out, Config.Attachments[r.att[2]].name .. " (" .. Config.WeaponById[r.att[1]].short .. ")") end
	if r.atts then
		local t = {}
		for _, a in ipairs(r.atts) do table.insert(t, Config.Attachments[a[2]].short .. " " .. Config.WeaponById[a[1]].short) end
		table.insert(out, table.concat(t, ", "))
	end
	if r.xp then table.insert(out, string.format("%d XP", r.xp)) end
	if r.candy then table.insert(out, string.format("%d candy corn", r.candy)) end
	return table.concat(out, " · ")
end

return Stats
