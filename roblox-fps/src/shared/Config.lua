--!nonstrict
-- Foundry Breach: shared tuning and content for server and client.
-- Distances are in studs. Layouts are authored in meters and scaled by METER.

local Config = {}

Config.METER = 3.5

Config.Colors = {
	Accent = Color3.fromRGB(245, 165, 36),
	AccentInk = Color3.fromRGB(27, 18, 4),
	Text = Color3.fromRGB(230, 236, 239),
	Muted = Color3.fromRGB(142, 158, 167),
	Panel = Color3.fromRGB(11, 18, 23),
	Panel2 = Color3.fromRGB(22, 34, 42),
	Line = Color3.fromRGB(60, 75, 84),
	Danger = Color3.fromRGB(255, 74, 61),
	Heal = Color3.fromRGB(57, 208, 176),
	Armor = Color3.fromRGB(109, 180, 255),
	Coin = Color3.fromRGB(255, 210, 74),
	Xp = Color3.fromRGB(180, 140, 255),
	Head = Color3.fromRGB(255, 177, 59),
	Weak = Color3.fromRGB(255, 122, 46),
	Block = Color3.fromRGB(124, 200, 255),
}

-- spread / recoil in degrees, range and speeds in studs
Config.Weapons = {
	{ id = "pistol", name = "Warden P9", short = "P9", cls = "Sidearm", mode = "SEMI", fire = "semi", dmg = 30, rpm = 420, mag = 12, reserve = 120, reload = 1.2, spread = 0.8, adsSpread = 0.23, recoil = 0.8, kick = 0.16, range = 420, head = 2, pellets = 1, zoom = 0.82, adsSpeed = 12, move = 1.04, price = 0, level = 1, upCost = 60, sound = "pistol", flashSize = 1.2 },
	{ id = "smg", name = "Wasp MX", short = "MX", cls = "Submachine gun", mode = "AUTO", fire = "auto", dmg = 15, rpm = 900, mag = 32, reserve = 288, reload = 1.7, spread = 1.72, adsSpread = 0.69, recoil = 0.37, kick = 0.08, range = 315, falloff = { 77, 140 }, head = 2, pellets = 1, zoom = 0.8, adsSpeed = 13, move = 1.05, price = 0, level = 1, upCost = 80, sound = "smg", flashSize = 1.3 },
	{ id = "rifle", name = "Vanguard KR7", short = "KR7", cls = "Assault rifle", mode = "AUTO", fire = "auto", dmg = 24, rpm = 660, mag = 30, reserve = 240, reload = 2.1, spread = 1.26, adsSpread = 0.29, recoil = 0.63, kick = 0.11, range = 600, head = 2, pellets = 1, zoom = 0.72, adsSpeed = 9, move = 1, price = 0, level = 1, upCost = 100, sound = "rifle", flashSize = 1.6 },
	{ id = "burst", name = "Triad B3", short = "B3", cls = "Burst rifle", mode = "BURST", fire = "burst", burstCount = 3, burstDelay = 0.34, dmg = 31, rpm = 1000, mag = 24, reserve = 216, reload = 2.0, spread = 0.92, adsSpread = 0.2, recoil = 0.69, kick = 0.11, range = 700, head = 2, pellets = 1, zoom = 0.7, adsSpeed = 9, move = 1, price = 1500, level = 5, upCost = 110, sound = "burst", flashSize = 1.5 },
	{ id = "shotgun", name = "Breaker 12", short = "B12", cls = "Pump shotgun", mode = "PUMP", fire = "semi", pump = true, dmg = 13, rpm = 72, mag = 6, reserve = 42, reload = 0.5, shellReload = true, spread = 4.3, adsSpread = 3.15, recoil = 3.4, kick = 0.45, range = 175, falloff = { 35, 120 }, head = 2, pellets = 10, zoom = 0.88, adsSpeed = 10, move = 1, price = 1200, level = 3, upCost = 100, sound = "shotgun", flashSize = 2.4 },
	{ id = "lmg", name = "Anvil HX", short = "HX", cls = "Light machine gun", mode = "AUTO", fire = "auto", dmg = 23, rpm = 600, mag = 80, reserve = 320, reload = 4.0, spread = 1.83, adsSpread = 0.57, recoil = 0.69, kick = 0.11, range = 560, head = 2, pellets = 1, zoom = 0.75, adsSpeed = 6, move = 0.88, price = 3000, level = 10, upCost = 140, sound = "lmg", flashSize = 1.8 },
	{ id = "sniper", name = "Longreach R2", short = "R2", cls = "Marksman rifle", mode = "BOLT", fire = "semi", bolt = true, dmg = 120, rpm = 48, mag = 5, reserve = 35, reload = 2.7, spread = 4.0, adsSpread = 0, recoil = 3.4, kick = 0.4, range = 1400, head = 3, pellets = 1, zoom = 0.24, scope = true, adsSpeed = 6, move = 0.95, price = 2200, level = 7, upCost = 140, sound = "sniper", flashSize = 2.6 },
	{ id = "plasma", name = "Helion PX", short = "PX", cls = "Plasma rifle", mode = "AUTO", fire = "auto", projectile = true, projSpeed = 273, splash = 8.4, dmg = 36, rpm = 360, mag = 40, reserve = 200, reload = 2.4, spread = 0.69, adsSpread = 0.23, recoil = 0.57, kick = 0.11, range = 560, head = 2, pellets = 1, zoom = 0.78, adsSpeed = 9, move = 1, price = 5000, level = 14, upCost = 170, sound = "plasma", flashSize = 1.8, flashColor = Color3.fromRGB(108, 246, 255) },
}
Config.WeaponById = {}
for i, w in ipairs(Config.Weapons) do
	w.index = i
	Config.WeaponById[w.id] = w
end

Config.Attachments = {
	reddot = { name = "Red dot sight", short = "RDS", price = 350, desc = "See-through glass sight with a glowing dot. No zoom. Aiming: -25% spread, -15% recoil." },
	extmag = { name = "Extended magazine", short = "EXT", price = 450, desc = "+40% magazine size." },
	silencer = { name = "Silencer", short = "SIL", price = 400, desc = "Quiet shots and a small flash. Bots take longer to lock on. -5% damage." },
	grip = { name = "Vertical grip", short = "GRIP", price = 300, desc = "-25% recoil." },
	laser = { name = "Laser sight", short = "LSR", price = 300, desc = "-35% hip-fire spread. Projects a visible beam." },
}
Config.AttachmentOrder = { "reddot", "extmag", "silencer", "grip", "laser" }

Config.Skins = {
	stock = { name = "Factory", metal = Color3.fromRGB(43, 48, 54), poly = Color3.fromRGB(27, 30, 33), alt = Color3.fromRGB(122, 106, 76), accent = Color3.fromRGB(245, 165, 36), how = "Default" },
	desert = { name = "Dune", metal = Color3.fromRGB(109, 93, 68), poly = Color3.fromRGB(181, 156, 108), alt = Color3.fromRGB(201, 176, 129), accent = Color3.fromRGB(90, 74, 48), how = "Reach level 4" },
	arctic = { name = "Glacier", metal = Color3.fromRGB(201, 209, 216), poly = Color3.fromRGB(233, 238, 242), alt = Color3.fromRGB(223, 230, 234), accent = Color3.fromRGB(63, 155, 255), how = "Quest: Big spender" },
	crimson = { name = "Crimson", metal = Color3.fromRGB(58, 18, 18), poly = Color3.fromRGB(92, 22, 22), alt = Color3.fromRGB(122, 29, 29), accent = Color3.fromRGB(255, 58, 58), how = "Quest: Veteran" },
	circuit = { name = "Circuit", metal = Color3.fromRGB(12, 22, 24), poly = Color3.fromRGB(15, 34, 38), alt = Color3.fromRGB(18, 48, 58), accent = Color3.fromRGB(42, 255, 213), glow = true, how = "Quest: Sharpshooter" },
	scorch = { name = "Scorch", metal = Color3.fromRGB(42, 42, 42), poly = Color3.fromRGB(58, 42, 32), alt = Color3.fromRGB(90, 58, 32), accent = Color3.fromRGB(255, 122, 46), glow = true, how = "Boss drop" },
	gold = { name = "Gilded", metal = Color3.fromRGB(212, 169, 58), poly = Color3.fromRGB(27, 30, 33), alt = Color3.fromRGB(201, 160, 58), accent = Color3.fromRGB(255, 240, 176), shiny = true, how = "Quest: Untouchable or level 20" },
}
Config.SkinOrder = { "stock", "desert", "arctic", "crimson", "circuit", "scorch", "gold" }

Config.Upgrades = {
	damage = { name = "Damage", per = 0.08, desc = "+8% damage per level" },
	rate = { name = "Fire rate", per = 0.06, desc = "+6% fire rate per level" },
	reload = { name = "Reload speed", per = 0.08, desc = "-8% reload time per level" },
	mag = { name = "Magazine", per = 0.1, desc = "+10% magazine size per level" },
	accuracy = { name = "Accuracy", per = 0.1, desc = "-10% spread per level" },
}
Config.UpgradeOrder = { "damage", "rate", "reload", "mag", "accuracy" }
Config.UpgradeMax = 5

-- speeds in studs/s, distances in studs
Config.Enemies = {
	grunt = { name = "Grunt", hp = 100, speed = 14.7, scale = 1, color = Color3.fromRGB(138, 147, 155), glow = Color3.fromRGB(255, 59, 42), pref = { 32, 85 }, rate = { 1.4, 2.4 }, dmg = 7, acc = 0.035, boltSpeed = 147, coins = 10, xp = 20, score = 100, from = 1, weight = 10 },
	runner = { name = "Runner", hp = 55, speed = 28, scale = 0.88, color = Color3.fromRGB(93, 84, 72), glow = Color3.fromRGB(255, 160, 32), dmg = 10, coins = 8, xp = 18, score = 110, from = 2, weight = 6, melee = true },
	drone = { name = "Drone", hp = 45, speed = 24, color = Color3.fromRGB(58, 69, 80), glow = Color3.fromRGB(64, 255, 208), rate = { 1.0, 1.7 }, dmg = 5, acc = 0.05, boltSpeed = 133, coins = 12, xp = 22, score = 120, from = 3, weight = 5, flying = true },
	sniper = { name = "Marksman", hp = 80, speed = 12.6, scale = 0.97, color = Color3.fromRGB(74, 80, 64), glow = Color3.fromRGB(255, 42, 106), pref = { 90, 190 }, dmg = 22, coins = 15, xp = 28, score = 150, from = 4, weight = 3 },
	exploder = { name = "Bomber", hp = 45, speed = 26, scale = 0.85, color = Color3.fromRGB(106, 90, 40), glow = Color3.fromRGB(255, 224, 48), dmg = 40, coins = 10, xp = 20, score = 120, from = 5, weight = 4, melee = true },
	tank = { name = "Juggernaut", hp = 600, speed = 8, scale = 1.45, color = Color3.fromRGB(63, 72, 82), glow = Color3.fromRGB(192, 64, 255), pref = { 42, 105 }, rate = { 2.6, 3.4 }, dmg = 16, acc = 0.03, boltSpeed = 84, coins = 35, xp = 70, score = 400, from = 6, weight = 1.4 },
	shield = { name = "Bulwark", hp = 180, speed = 12.6, scale = 1.05, color = Color3.fromRGB(85, 96, 106), glow = Color3.fromRGB(124, 200, 255), pref = { 21, 56 }, rate = { 1.8, 2.8 }, dmg = 8, acc = 0.035, boltSpeed = 140, coins = 20, xp = 35, score = 200, from = 7, weight = 3 },
}
Config.EnemyOrder = { "grunt", "runner", "drone", "sniper", "exploder", "tank", "shield" }
Config.EnemyTips = {
	runner = "Fast melee rusher. Keep moving and shoot early.",
	drone = "Flies erratically. Small target; the glowing eye is its head.",
	sniper = "Long-range shooter. A red laser means it is about to fire: break line of sight.",
	exploder = "Runs at you and self-destructs. Shoot the glowing core to detonate it early.",
	tank = "Slow and very tough. Fires explosive orbs. Hit the purple back vent.",
	shield = "Its energy shield blocks frontal fire. Aim for the head or flank to hit the back cell.",
}

Config.Bosses = {
	{ id = "titan", name = "Titan-9", title = "Siege mech", hp = 5200 },
	{ id = "hive", name = "Hive Mother", title = "Drone carrier", hp = 4200 },
	{ id = "bulwark", name = "Ironclad", title = "Shielded assault tank", hp = 4600, shield = 1000 },
}

Config.Difficulty = {
	easy = { label = "Easy", desc = "Softer hits, fewer bots. 0.8x coins and XP.", hp = 0.75, dmg = 0.6, count = 0.85, speed = 0.95, reward = 0.8 },
	normal = { label = "Normal", desc = "The intended fight.", hp = 1, dmg = 1, count = 1, speed = 1, reward = 1 },
	hard = { label = "Hard", desc = "Tougher, faster, meaner bots. 1.3x coins and XP.", hp = 1.3, dmg = 1.2, count = 1.2, speed = 1.06, reward = 1.3 },
}
Config.DifficultyOrder = { "easy", "normal", "hard" }

Config.Buffs = {
	reload = { name = "Quick hands", desc = "Reload 15% faster.", max = 4, color = Color3.fromRGB(109, 180, 255) },
	rate = { name = "Hair trigger", desc = "Fire 10% faster.", max = 4, color = Color3.fromRGB(245, 165, 36) },
	damage = { name = "Hollow points", desc = "Deal 10% more damage.", max = 6, color = Color3.fromRGB(255, 74, 61) },
	health = { name = "Reinforced frame", desc = "+20 max health and heal 20.", max = 5, color = Color3.fromRGB(57, 208, 176) },
	speed = { name = "Servo legs", desc = "Move 8% faster.", max = 4, color = Color3.fromRGB(180, 140, 255) },
	mag = { name = "Deep mags", desc = "+20% magazine size.", max = 4, color = Color3.fromRGB(255, 210, 74) },
	regen = { name = "Nanite repair", desc = "Regenerate 2 health per second, always.", max = 4, color = Color3.fromRGB(57, 208, 176) },
	head = { name = "Headhunter", desc = "+0.3x headshot damage multiplier.", max = 4, color = Color3.fromRGB(255, 177, 59) },
	leech = { name = "Leech rounds", desc = "Heal for 3% of the damage you deal.", max = 4, color = Color3.fromRGB(255, 122, 154) },
	prospector = { name = "Prospector", desc = "Earn 15% more coins.", max = 5, color = Color3.fromRGB(255, 210, 74) },
	blast = { name = "Blast kit", desc = "+25% explosive damage and +1 frag.", max = 4, color = Color3.fromRGB(255, 122, 46) },
	plating = { name = "Ablative plating", desc = "+30 armor now and 10% less damage taken.", max = 3, color = Color3.fromRGB(109, 180, 255) },
}

Config.Mutators = {
	armored = { name = "Armored", desc = "Bots have 35% more health.", reward = 1.4, hp = 1.35 },
	overclocked = { name = "Overclocked", desc = "Bots move 20% faster.", reward = 1.3, speed = 1.2 },
	swarm = { name = "Swarm", desc = "40% more bots, each with 20% less health.", reward = 1.35, count = 1.4, hp = 0.8 },
	glass = { name = "Glass cannons", desc = "Bots hit 40% harder but have 25% less health.", reward = 1.3, dmg = 1.4, hp = 0.75 },
	blackout = { name = "Blackout", desc = "Visibility drops sharply this round.", reward = 1.3 },
	volatile = { name = "Volatile", desc = "Destroyed bots explode after a short delay. Step back.", reward = 1.3 },
	goldrush = { name = "Gold rush", desc = "Bots have 20% more health but drop double coins.", reward = 1, coins = 2, hp = 1.2 },
	elite = { name = "Elite squad", desc = "Fewer bots, but each is tougher and faster.", reward = 1.45, count = 0.7, hp = 1.5, speed = 1.1 },
}
Config.ComboWindow = 4

Config.Quests = {
	{ id = "first", name = "First contact", desc = "Destroy 50 robots.", goal = 50, ev = "kill", reward = { coins = 250 } },
	{ id = "headhunter", name = "Headhunter", desc = "Land 25 headshot kills.", goal = 25, ev = "headshot", reward = { att = { "rifle", "reddot" }, coins = 150 } },
	{ id = "wasp", name = "Wasp swarm", desc = "Destroy 100 robots with the Wasp MX.", goal = 100, ev = "kill", weapon = "smg", reward = { atts = { { "smg", "reddot" }, { "smg", "extmag" } } } },
	{ id = "holdout", name = "Holdout", desc = "Survive to wave 10.", goal = 10, ev = "wave", max = true, reward = { coins = 600, xp = 500 } },
	{ id = "untouchable", name = "Untouchable", desc = "Defeat a boss without taking damage during its fight.", goal = 1, ev = "bossFlawless", reward = { skin = "gold", coins = 500 } },
	{ id = "slayer", name = "Giant slayer", desc = "Defeat 3 bosses.", goal = 3, ev = "boss", reward = { weapon = "plasma" } },
	{ id = "demo", name = "Demolition", desc = "Destroy 30 robots with explosives.", goal = 30, ev = "explosiveKill", reward = { coins = 400 } },
	{ id = "marksman", name = "Marksman", desc = "Destroy 50 robots with the Longreach R2.", goal = 50, ev = "kill", weapon = "sniper", reward = { atts = { { "sniper", "reddot" }, { "sniper", "silencer" } } } },
	{ id = "pump", name = "Close quarters", desc = "Destroy 75 robots with the Breaker 12.", goal = 75, ev = "kill", weapon = "shotgun", reward = { atts = { { "shotgun", "reddot" }, { "shotgun", "grip" } } } },
	{ id = "sharp", name = "Sharpshooter", desc = "Land 150 headshot kills.", goal = 150, ev = "headshot", reward = { skin = "circuit", coins = 500 } },
	{ id = "flawless", name = "Clean sweep", desc = "Clear 5 waves without taking damage.", goal = 5, ev = "flawless", reward = { coins = 500 } },
	{ id = "streaker", name = "Air support", desc = "Earn an airstrike killstreak.", goal = 1, ev = "airstrike", reward = { coins = 300 } },
	{ id = "veteran", name = "Veteran", desc = "Survive to wave 20.", goal = 20, ev = "wave", max = true, reward = { skin = "crimson", coins = 1500 } },
	{ id = "spender", name = "Big spender", desc = "Spend 5,000 coins.", goal = 5000, ev = "spent", reward = { skin = "arctic" } },
	{ id = "rifleman", name = "Rifleman", desc = "Destroy 150 robots with the Vanguard KR7.", goal = 150, ev = "kill", weapon = "rifle", reward = { atts = { { "rifle", "grip" }, { "rifle", "extmag" } } } },
	{ id = "hardcore", name = "Hard target", desc = "Reach wave 10 on Hard.", goal = 10, ev = "wave", max = true, diff = "hard", reward = { coins = 2000, skin = "scorch" } },
}

Config.DailyPool = {
	{ id = "kills", name = "Scrapper", desc = "Destroy %d robots.", goals = { 60, 90, 120 }, ev = "kill", reward = 300 },
	{ id = "heads", name = "Precision", desc = "Land %d headshot kills.", goals = { 20, 30, 45 }, ev = "headshot", reward = 350 },
	{ id = "wave", name = "Endurance", desc = "Survive to wave %d in one run.", goals = { 6, 8, 10 }, ev = "wave", max = true, reward = 400 },
	{ id = "drones", name = "Skeet shooter", desc = "Destroy %d drones.", goals = { 15, 25 }, ev = "killType", type = "drone", reward = 300 },
	{ id = "runners", name = "Stopping power", desc = "Destroy %d runners.", goals = { 20, 30 }, ev = "killType", type = "runner", reward = 300 },
	{ id = "boom", name = "Demolitions", desc = "Destroy %d robots with explosives.", goals = { 10, 15 }, ev = "explosiveKill", reward = 350 },
	{ id = "boss", name = "Giant hunter", desc = "Defeat %d boss.", goals = { 1 }, ev = "boss", reward = 500 },
	{ id = "combo", name = "Chain reaction", desc = "Reach a %d-kill combo.", goals = { 12, 18 }, ev = "combo", max = true, reward = 350 },
	{ id = "box", name = "Feeling lucky", desc = "Roll the mystery crate %d times.", goals = { 2, 3 }, ev = "box", reward = 250 },
}

Config.LevelRewards = {
	[2] = { coins = 150 }, [3] = { weapon = "shotgun" }, [4] = { skin = "desert" }, [5] = { weapon = "burst" },
	[6] = { coins = 400, att = { "pistol", "reddot" } }, [7] = { weapon = "sniper" }, [8] = { coins = 500 }, [10] = { weapon = "lmg" },
	[12] = { coins = 1000 }, [14] = { weapon = "plasma" }, [16] = { coins = 1500 }, [20] = { skin = "gold" },
}

Config.Maps = {
	{ id = "yard", name = "Yard 9", desc = "Dusk at the freight terminal.", unlock = nil },
	{ id = "factory", name = "Kessler Works", desc = "An abandoned foundry.", unlock = { level = 3, wave = 8 } },
	{ id = "rooftops", name = "Skyline Rooftops", desc = "Forty storeys up at night.", unlock = { level = 6, wave = 12 } },
	{ id = "desert", name = "Outpost Kharon", desc = "A sun-bleached military base.", unlock = { level = 9, wave = 15 } },
	{ id = "lab", name = "Sublevel 4", desc = "An underground research lab.", unlock = { level = 12, wave = 20 } },
}
Config.MapById = {}
for _, m in ipairs(Config.Maps) do Config.MapById[m.id] = m end

Config.Player = {
	WalkSpeed = 20, SprintSpeed = 30, CrouchSpeed = 10, AdsSpeed = 13,
	MaxArmor = 100, StartArmor = 50, StartFrags = 3, StartStuns = 2, MaxFrags = 5, MaxStuns = 4,
	RegenDelay = 5, RegenPerSecond = 6, RespawnTime = 6,
}
Config.Grenade = { Fuse = 2.2, StunFuse = 1.6, Radius = 25, Damage = 140, Speed = 70, StunRadius = 32 }
Config.Barrel = { HP = 30, Radius = 23, Damage = 130 }
Config.CrateCost = 950
Config.OverclockCost = { 1200, 2400, 3600 }
Config.Killstreak = { Airstrike = 10, Turret = 20 }

-- Built-in engine sounds work out of the box. For better audio, replace with Creator Store IDs.
Config.Sounds = {
	pistol = { id = "rbxasset://sounds/paintball.wav", volume = 0.9, pitch = 0.75 },
	smg = { id = "rbxasset://sounds/paintball.wav", volume = 0.7, pitch = 0.95 },
	rifle = { id = "rbxasset://sounds/paintball.wav", volume = 0.8, pitch = 0.62 },
	burst = { id = "rbxasset://sounds/paintball.wav", volume = 0.8, pitch = 0.7 },
	shotgun = { id = "rbxasset://sounds/Rocket shot.wav", volume = 0.9, pitch = 1.35 },
	lmg = { id = "rbxasset://sounds/paintball.wav", volume = 0.9, pitch = 0.52 },
	sniper = { id = "rbxasset://sounds/Rocket shot.wav", volume = 1.0, pitch = 1.1 },
	plasma = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.7, pitch = 0.5 },
	gunBody = { id = "rbxasset://sounds/collide.wav", volume = 0.5, pitch = 1.6 },
	click = { id = "rbxasset://sounds/switch.wav", volume = 0.5, pitch = 1.4 },
	reload = { id = "rbxasset://sounds/switch.wav", volume = 0.6, pitch = 0.8 },
	dry = { id = "rbxasset://sounds/switch.wav", volume = 0.6, pitch = 2 },
	hit = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.35, pitch = 1.6 },
	headshot = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.55, pitch = 2.2 },
	kill = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.5, pitch = 1.1 },
	laser = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.6, pitch = 0.45 },
	explosion = { id = "rbxasset://sounds/collide.wav", volume = 1.2, pitch = 0.55 },
	slash = { id = "rbxasset://sounds/swordslash.wav", volume = 0.8, pitch = 0.9 },
	hurt = { id = "rbxasset://sounds/collide.wav", volume = 0.5, pitch = 0.8 },
	pickup = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.5, pitch = 1.3 },
	coin = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.25, pitch = 2.6 },
	siren = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.7, pitch = 0.3 },
	throw = { id = "rbxasset://sounds/swordlunge.wav", volume = 0.6, pitch = 1.2 },
	warp = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.6, pitch = 0.6 },
	buy = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.5, pitch = 1.8 },
	deny = { id = "rbxasset://sounds/switch.wav", volume = 0.6, pitch = 0.5 },
	level = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.7, pitch = 1.5 },
	slide = { id = "rbxasset://sounds/swordlunge.wav", volume = 0.5, pitch = 0.6 },
}

Config.Textures = {
	Spark = "rbxasset://textures/particles/sparkles_main.dds",
	Fire = "rbxasset://textures/particles/fire_main.dds",
	Smoke = "rbxasset://textures/particles/smoke_main.dds",
}

return Config
