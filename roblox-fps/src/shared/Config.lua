-- Foundry Breach: shared tuning for server and client.
-- Distances are in studs. The map is laid out in meters and scaled by METER.

local Config = {}

Config.METER = 3.5 -- studs per meter
Config.ARENA = 72 -- half-width of the yard in meters

Config.Colors = {
	Accent = Color3.fromRGB(245, 165, 36),
	AccentInk = Color3.fromRGB(27, 18, 4),
	Text = Color3.fromRGB(230, 236, 239),
	Muted = Color3.fromRGB(142, 158, 167),
	Panel = Color3.fromRGB(11, 18, 23),
	Line = Color3.fromRGB(60, 75, 84),
	Danger = Color3.fromRGB(255, 74, 61),
	Heal = Color3.fromRGB(57, 208, 176),
	Armor = Color3.fromRGB(109, 180, 255),
}

-- spread / recoil in degrees, range in studs
Config.Weapons = {
	{
		id = "pistol", name = "Warden P9", short = "P9", mode = "SEMI", auto = false,
		damage = 34, rpm = 420, mag = 12, reserve = 96, reload = 1.3,
		spread = 0.8, adsSpread = 0.2, recoil = 0.9, kick = 0.18, range = 450,
		head = 2.0, pellets = 1, zoom = 0.82, adsSpeed = 12,
		sound = "pistol", flashSize = 1.2,
	},
	{
		id = "rifle", name = "Vanguard KR7", short = "KR7", mode = "AUTO", auto = true,
		damage = 24, rpm = 680, mag = 30, reserve = 210, reload = 2.1,
		spread = 1.25, adsSpread = 0.28, recoil = 0.65, kick = 0.12, range = 600,
		head = 1.8, pellets = 1, zoom = 0.72, adsSpeed = 9,
		sound = "rifle", flashSize = 1.6,
	},
	{
		id = "shotgun", name = "Breaker 12", short = "B12", mode = "PUMP", auto = false,
		damage = 14, rpm = 72, mag = 6, reserve = 36, reload = 0.5, shellReload = true,
		spread = 4.3, adsSpread = 3.2, recoil = 3.4, kick = 0.45, range = 175,
		head = 1.5, pellets = 10, zoom = 0.88, adsSpeed = 10, falloff = { 35, 120 },
		sound = "shotgun", flashSize = 2.4,
	},
	{
		id = "sniper", name = "Longreach R2", short = "R2", mode = "BOLT", auto = false,
		damage = 115, rpm = 48, mag = 5, reserve = 30, reload = 2.7,
		spread = 4.0, adsSpread = 0, recoil = 3.4, kick = 0.4, range = 1400,
		head = 2.5, pellets = 1, zoom = 0.24, adsSpeed = 6, scope = true,
		sound = "sniper", flashSize = 2.6,
	},
}

Config.Enemies = {
	grunt = {
		name = "SEC-GRUNT", hp = 100, speed = 15, scale = 1,
		color = Color3.fromRGB(138, 147, 155), glow = Color3.fromRGB(255, 59, 42),
		pref = { 32, 85 }, rate = { 1.3, 2.3 }, damage = 8, accuracy = 0.035,
		boltSpeed = 145, score = 100,
	},
	rusher = {
		name = "SEC-HOUND", hp = 60, speed = 27, scale = 0.88,
		color = Color3.fromRGB(93, 84, 72), glow = Color3.fromRGB(255, 160, 32),
		damage = 16, score = 120, melee = true,
	},
	heavy = {
		name = "SEC-WARDEN", hp = 380, speed = 9, scale = 1.35,
		color = Color3.fromRGB(63, 72, 82), glow = Color3.fromRGB(192, 64, 255),
		pref = { 42, 105 }, rate = { 2.4, 3.2 }, damage = 11, accuracy = 0.03,
		boltSpeed = 120, burst = 3, score = 300,
	},
}

Config.Player = {
	WalkSpeed = 20,
	SprintSpeed = 30,
	CrouchSpeed = 10,
	AdsSpeed = 13,
	MaxArmor = 100,
	StartArmor = 50,
	StartGrenades = 3,
	MaxGrenades = 5,
	RegenDelay = 5,
	RegenPerSecond = 9,
	RespawnTime = 6,
}

Config.Grenade = { Fuse = 2.2, Radius = 25, Damage = 140, Speed = 70 }
Config.Barrel = { HP = 30, Radius = 23, Damage = 130 }

-- Built-in engine sounds so the game works out of the box. For better audio,
-- replace these with Creator Store sound IDs, e.g. "rbxassetid://123456789".
Config.Sounds = {
	pistol = { id = "rbxasset://sounds/paintball.wav", volume = 0.9, pitch = 0.75 },
	rifle = { id = "rbxasset://sounds/paintball.wav", volume = 0.8, pitch = 0.62 },
	shotgun = { id = "rbxasset://sounds/Rocket shot.wav", volume = 0.9, pitch = 1.35 },
	sniper = { id = "rbxasset://sounds/Rocket shot.wav", volume = 1.0, pitch = 1.1 },
	gunBody = { id = "rbxasset://sounds/collide.wav", volume = 0.5, pitch = 1.6 },
	click = { id = "rbxasset://sounds/switch.wav", volume = 0.5, pitch = 1.4 },
	reload = { id = "rbxasset://sounds/switch.wav", volume = 0.6, pitch = 0.8 },
	dry = { id = "rbxasset://sounds/switch.wav", volume = 0.6, pitch = 2 },
	hit = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.35, pitch = 1.6 },
	kill = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.5, pitch = 1.1 },
	laser = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.6, pitch = 0.45 },
	explosion = { id = "rbxasset://sounds/collide.wav", volume = 1.2, pitch = 0.55 },
	slash = { id = "rbxasset://sounds/swordslash.wav", volume = 0.8, pitch = 0.9 },
	hurt = { id = "rbxasset://sounds/collide.wav", volume = 0.5, pitch = 0.8 },
	pickup = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.5, pitch = 1.3 },
	siren = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.7, pitch = 0.3 },
	throw = { id = "rbxasset://sounds/swordlunge.wav", volume = 0.6, pitch = 1.2 },
	warp = { id = "rbxasset://sounds/electronicpingshort.wav", volume = 0.6, pitch = 0.6 },
}

Config.Textures = {
	Spark = "rbxasset://textures/particles/sparkles_main.dds",
	Fire = "rbxasset://textures/particles/fire_main.dds",
	Smoke = "rbxasset://textures/particles/smoke_main.dds",
}

return Config
