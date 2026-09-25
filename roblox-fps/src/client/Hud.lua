-- HUD, title screen and game-over screen.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local Config = require(ReplicatedStorage:WaitForChild("FoundryShared"):WaitForChild("Config"))

local C = Config.Colors
local DISPLAY = Enum.Font.Michroma
local MONO = Enum.Font.RobotoMono
local Hud = {}

local function new(class, props, parent)
	local o = Instance.new(class)
	for k, v in pairs(props) do o[k] = v end
	o.Parent = parent
	return o
end
local function label(parent, props)
	local t = new("TextLabel", { BackgroundTransparency = 1, TextColor3 = C.Text, Font = MONO, TextSize = 14, TextXAlignment = Enum.TextXAlignment.Left, Size = UDim2.new(1, 0, 0, 18) }, parent)
	for k, v in pairs(props) do t[k] = v end
	return t
end
local function panel(parent, props)
	local f = new("Frame", { BackgroundColor3 = C.Panel, BackgroundTransparency = 0.3, BorderSizePixel = 0 }, parent)
	new("UIStroke", { Color = C.Line, Transparency = 0.3, Thickness = 1 }, f)
	for k, v in pairs(props) do f[k] = v end
	return f
end
local function pad(f, x, y) new("UIPadding", { PaddingLeft = UDim.new(0, x), PaddingRight = UDim.new(0, x), PaddingTop = UDim.new(0, y), PaddingBottom = UDim.new(0, y) }, f) end
local function bar(parent, color, y, h)
	local bg = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 0.92, BorderSizePixel = 0, Position = UDim2.new(0, 0, 0, y), Size = UDim2.new(1, 0, 0, h) }, parent)
	local fill = new("Frame", { BackgroundColor3 = color, BorderSizePixel = 0, Size = UDim2.new(1, 0, 1, 0) }, bg)
	return fill, bg
end
local function button(parent, text, sub, primary)
	local b = new("TextButton", { AutoButtonColor = false, Text = "", Size = UDim2.new(0, 300, 0, 50), BackgroundColor3 = primary and C.Accent or C.Panel, BackgroundTransparency = primary and 0 or 0.35, BorderSizePixel = 0 }, parent)
	new("UIStroke", { Color = primary and C.Accent or C.Line, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, b)
	label(b, { Text = string.upper(text), Font = DISPLAY, TextSize = 17, TextColor3 = primary and C.AccentInk or C.Text, Position = UDim2.new(0, 18, 0, 0), Size = UDim2.new(1, -36, 1, 0) })
	if sub then label(b, { Text = sub, TextSize = 12, TextColor3 = primary and Color3.fromRGB(80, 55, 12) or C.Muted, TextXAlignment = Enum.TextXAlignment.Right, Position = UDim2.new(0, 18, 0, 0), Size = UDim2.new(1, -36, 1, 0) }) end
	b.MouseEnter:Connect(function() TweenService:Create(b, TweenInfo.new(0.12), { Position = b.Position + UDim2.new(0, 4, 0, 0) }):Play() end)
	b.MouseLeave:Connect(function() TweenService:Create(b, TweenInfo.new(0.12), { Position = b.Position - UDim2.new(0, 4, 0, 0) }):Play() end)
	return b
end

function Hud.new()
	local self = {}
	local gui = new("ScreenGui", { Name = "FoundryHUD", IgnoreGuiInset = true, ResetOnSpawn = false, ZIndexBehavior = Enum.ZIndexBehavior.Sibling }, Players.LocalPlayer:WaitForChild("PlayerGui"))
	self.gui = gui

	-- screen effects
	local vig = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1) }, gui)
	self.vigParts = {}
	for i, spec in ipairs({ { UDim2.new(1, 0, 0.3, 0), UDim2.new(0, 0, 0, 0), 90 }, { UDim2.new(1, 0, 0.3, 0), UDim2.new(0, 0, 0.7, 0), -90 }, { UDim2.new(0.25, 0, 1, 0), UDim2.new(0, 0, 0, 0), 0 }, { UDim2.new(0.25, 0, 1, 0), UDim2.new(0.75, 0, 0, 0), 180 } }) do
		local f = new("Frame", { BackgroundColor3 = Color3.fromRGB(170, 10, 0), BorderSizePixel = 0, Size = spec[1], Position = spec[2] }, vig)
		new("UIGradient", { Rotation = spec[3], Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.1), NumberSequenceKeypoint.new(1, 1) }) }, f)
		self.vigParts[i] = f
	end
	self.vig = vig
	self.flash = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 1, BorderSizePixel = 0, Size = UDim2.fromScale(1, 1), ZIndex = 50 }, gui)

	-- sniper scope: a round hole made from a huge black stroke
	local scope = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), Visible = false }, gui)
	local hole = new("Frame", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromScale(0.74, 0.74) }, scope)
	new("UIAspectRatioConstraint", { AspectRatio = 1 }, hole)
	new("UICorner", { CornerRadius = UDim.new(0.5, 0) }, hole)
	new("UIStroke", { Color = Color3.new(), Thickness = 2500, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, hole)
	new("Frame", { BackgroundColor3 = Color3.new(), BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.new(1, 0, 0, 1) }, hole)
	new("Frame", { BackgroundColor3 = Color3.new(), BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.new(0, 1, 1, 0) }, hole)
	local dot = new("Frame", { BackgroundColor3 = C.Danger, BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(6, 6) }, hole)
	new("UICorner", { CornerRadius = UDim.new(1, 0) }, dot)
	self.scope = scope

	-- crosshair + hitmarker
	local ch = new("Frame", { BackgroundTransparency = 1, Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(0, 0) }, gui)
	self.ch = {}
	for i, s in ipairs({ { 10, 2 }, { 10, 2 }, { 2, 10 }, { 2, 10 } }) do
		local f = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5), Size = UDim2.fromOffset(s[1], s[2]) }, ch)
		new("UIStroke", { Color = Color3.new(), Transparency = 0.45, Thickness = 1 }, f)
		self.ch[i] = f
	end
	new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5), Size = UDim2.fromOffset(2, 2) }, ch)
	self.chRoot = ch
	local hm = new("Frame", { BackgroundTransparency = 1, Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(0, 0), Visible = false }, gui)
	self.hmParts = {}
	for i = 0, 3 do
		local a = math.rad(45 + i * 90)
		local f = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5), Size = UDim2.fromOffset(12, 2), Rotation = 45 + i * 90, Position = UDim2.fromOffset(math.cos(a) * 13, math.sin(a) * 13) }, hm)
		table.insert(self.hmParts, f)
	end
	self.hm = hm
	self.dmgRoot = new("Frame", { BackgroundTransparency = 1, Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(0, 0) }, gui)

	-- top: score, wave, hostiles, kills
	local sc = panel(gui, { Position = UDim2.fromOffset(24, 18), Size = UDim2.fromOffset(170, 70) }); pad(sc, 14, 8)
	label(sc, { Text = "SCORE", TextSize = 10, TextColor3 = C.Muted })
	self.score = label(sc, { Text = "0", Font = DISPLAY, TextSize = 26, Position = UDim2.fromOffset(0, 18), Size = UDim2.new(1, 0, 0, 30) })
	self.mult = label(sc, { Text = "", TextSize = 11, TextColor3 = C.Accent, Position = UDim2.fromOffset(0, 46) })
	local top = new("Frame", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 18), Size = UDim2.fromOffset(3 * 110 + 12, 62) }, gui)
	new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 6) }, top)
	local function stat(name, accent)
		local p = panel(top, { Size = UDim2.fromOffset(110, 62) }); pad(p, 8, 8)
		local l = label(p, { Text = name, TextSize = 10, TextColor3 = C.Muted, TextXAlignment = Enum.TextXAlignment.Center })
		local v = label(p, { Text = "0", Font = DISPLAY, TextSize = 22, TextColor3 = accent and C.Accent or C.Text, TextXAlignment = Enum.TextXAlignment.Center, Position = UDim2.fromOffset(0, 18), Size = UDim2.new(1, 0, 0, 28) })
		return v, l
	end
	self.wave = stat("WAVE", true)
	self.host, self.hostLbl = stat("HOSTILES")
	self.kills = stat("KILLS")

	-- kill feed
	local feed = new("Frame", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -24, 0, 18), Size = UDim2.fromOffset(340, 200) }, gui)
	new("UIListLayout", { HorizontalAlignment = Enum.HorizontalAlignment.Right, Padding = UDim.new(0, 4), SortOrder = Enum.SortOrder.LayoutOrder }, feed)
	self.feed = feed

	-- vitals
	local vit = panel(gui, { AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 24, 1, -24), Size = UDim2.fromOffset(280, 118) }); pad(vit, 16, 12)
	label(vit, { Text = "INTEGRITY", TextSize = 10, TextColor3 = C.Muted })
	self.hp = label(vit, { Text = "100", Font = DISPLAY, TextSize = 38, Position = UDim2.fromOffset(0, 16), Size = UDim2.new(1, 0, 0, 44) })
	label(vit, { Text = "YARD 9 · UNIT 04", TextSize = 10, TextColor3 = C.Muted, TextXAlignment = Enum.TextXAlignment.Right, Position = UDim2.fromOffset(0, 34) })
	self.hpFill = bar(vit, C.Heal, 64, 8)
	self.arFill = bar(vit, C.Armor, 76, 4)
	self.ar = label(vit, { Text = "Armor plating  50", TextSize = 11, TextColor3 = C.Muted, Position = UDim2.fromOffset(0, 84) })

	-- weapon panel
	local wp = panel(gui, { AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -24, 1, -24), Size = UDim2.fromOffset(300, 128) }); pad(wp, 16, 12)
	self.wName = label(wp, { Text = "", Font = DISPLAY, TextSize = 14 })
	self.wMode = label(wp, { Text = "", TextSize = 10, TextColor3 = C.Accent, TextXAlignment = Enum.TextXAlignment.Right })
	self.mag = label(wp, { Text = "30", Font = DISPLAY, TextSize = 42, Position = UDim2.fromOffset(0, 20), Size = UDim2.new(0, 100, 0, 48), TextXAlignment = Enum.TextXAlignment.Left })
	self.res = label(wp, { Text = "/ 210", TextSize = 17, TextColor3 = C.Muted, Position = UDim2.fromOffset(100, 42), Size = UDim2.new(0, 90, 0, 20) })
	self.nades = label(wp, { Text = "FRAG 3", TextSize = 13, TextColor3 = C.Text, TextXAlignment = Enum.TextXAlignment.Right, Position = UDim2.fromOffset(0, 42) })
	local slots = new("Frame", { BackgroundTransparency = 1, Position = UDim2.fromOffset(0, 76), Size = UDim2.new(1, 0, 0, 22) }, wp)
	new("UIGridLayout", { CellSize = UDim2.new(0.25, -4, 1, 0), CellPadding = UDim2.fromOffset(4, 0) }, slots)
	self.slots = {}
	for i, w in ipairs(Config.Weapons) do
		local s = new("TextLabel", { BackgroundColor3 = C.Accent, BackgroundTransparency = 1, Text = i .. " " .. w.short, Font = MONO, TextSize = 11, TextColor3 = C.Muted }, slots)
		new("UIStroke", { Color = C.Line, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, s)
		self.slots[i] = s
	end
	self.reloadFill, self.reloadBg = bar(wp, C.Accent, 102, 3)

	-- banner, streak, prompt
	self.banner = label(gui, { Text = "", Font = DISPLAY, TextSize = 64, TextXAlignment = Enum.TextXAlignment.Center, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.fromScale(0.5, 0.22), Size = UDim2.new(1, 0, 0, 70), TextTransparency = 1, TextStrokeTransparency = 1 })
	self.bannerSub = label(gui, { Text = "", TextSize = 14, TextColor3 = C.Accent, TextXAlignment = Enum.TextXAlignment.Center, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0.22, 78), TextTransparency = 1 })
	self.streak = label(gui, { Text = "", Font = DISPLAY, TextSize = 26, TextColor3 = C.Accent, TextXAlignment = Enum.TextXAlignment.Center, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.fromScale(0.5, 0.36), TextTransparency = 1 })
	self.prompt = label(gui, { Text = "", TextSize = 13, TextXAlignment = Enum.TextXAlignment.Center, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0.5, 60), TextStrokeTransparency = 0.5, Visible = false })
	self.hudRoot = { sc, top, feed, vit, wp, ch }

	self:buildMenu()
	self:buildOver()
	return setmetatable(self, { __index = Hud })
end

function Hud:buildMenu()
	local m = new("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.fromRGB(6, 10, 13), BorderSizePixel = 0, ZIndex = 20 }, self.gui)
	new("UIGradient", { Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.05), NumberSequenceKeypoint.new(0.45, 0.25), NumberSequenceKeypoint.new(0.8, 0.9), NumberSequenceKeypoint.new(1, 0.7) }) }, m)
	local col = new("Frame", { BackgroundTransparency = 1, Position = UDim2.new(0, 64, 0.5, -250), Size = UDim2.fromOffset(560, 520) }, m)
	label(col, { Text = "—  YARD 9 FREIGHT TERMINAL · NIGHT SHIFT", Font = DISPLAY, TextSize = 12, TextColor3 = C.Accent })
	label(col, { Text = "FOUNDRY", Font = DISPLAY, TextSize = 84, Position = UDim2.fromOffset(0, 26), Size = UDim2.new(1, 0, 0, 90) })
	local b2 = label(col, { Text = "BREACH", Font = DISPLAY, TextSize = 84, TextColor3 = C.Accent, Position = UDim2.fromOffset(0, 106), Size = UDim2.new(1, 0, 0, 90) })
	b2.TextTransparency = 0
	label(col, { Text = "The yard's security bots have turned on the crew. Hold the freight terminal against endless waves with four weapons, frag grenades and whatever the fuel drums leave standing. Squad up: every player in the server fights the same waves.", TextWrapped = true, TextSize = 14, TextColor3 = C.Muted, TextYAlignment = Enum.TextYAlignment.Top, Position = UDim2.fromOffset(0, 210), Size = UDim2.new(1, -60, 0, 70) })
	local deploy = button(col, "Deploy", "Join the fight", true); deploy.Position = UDim2.fromOffset(0, 300)
	local keys = label(col, { Text = "WASD move · Mouse aim · LMB fire · RMB aim · R reload · Shift sprint · C crouch · 1–4 / wheel switch · Q last weapon · G frag", TextWrapped = true, TextSize = 12, TextColor3 = C.Muted, TextYAlignment = Enum.TextYAlignment.Top, Position = UDim2.fromOffset(0, 370), Size = UDim2.new(1, -60, 0, 40) })
	self.menuStatus = label(col, { Text = "", TextSize = 12, TextColor3 = C.Accent, Position = UDim2.fromOffset(0, 420) })
	-- loadout cards
	local cards = new("Frame", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -48, 1, -48), Size = UDim2.fromOffset(520, 300) }, m)
	new("UIGridLayout", { CellSize = UDim2.new(0.5, -6, 0.5, -6), CellPadding = UDim2.fromOffset(12, 12) }, cards)
	local stats = { pistol = { 34, 70, 45, 30 }, rifle = { 30, 95, 70, 70 }, shotgun = { 95, 20, 20, 25 }, sniper = { 100, 12, 100, 20 } }
	for i, w in ipairs(Config.Weapons) do
		local c = panel(cards, {}); pad(c, 14, 10)
		label(c, { Text = w.name, Font = DISPLAY, TextSize = 14 })
		label(c, { Text = "[" .. i .. "]", TextSize = 12, TextColor3 = C.Accent, TextXAlignment = Enum.TextXAlignment.Right })
		label(c, { Text = string.upper(({ pistol = "Sidearm", rifle = "Assault rifle", shotgun = "Pump shotgun", sniper = "Marksman rifle" })[w.id]) .. " · " .. w.mag .. " RD", TextSize = 10, TextColor3 = C.Muted, Position = UDim2.fromOffset(0, 18) })
		for j, n in ipairs({ "DAMAGE", "RATE", "RANGE", "CONTROL" }) do
			local y = 40 + (j - 1) * 20
			label(c, { Text = n, TextSize = 9, TextColor3 = C.Muted, Position = UDim2.fromOffset(0, y), Size = UDim2.fromOffset(60, 12) })
			local bg = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 0.92, BorderSizePixel = 0, Position = UDim2.new(0, 64, 0, y + 4), Size = UDim2.new(1, -64, 0, 4) }, c)
			new("Frame", { BackgroundColor3 = C.Accent, BorderSizePixel = 0, Size = UDim2.fromScale(stats[w.id][j] / 100, 1) }, bg)
		end
	end
	self.menu, self.deployButton = m, deploy
end

function Hud:buildOver()
	local o = new("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.fromRGB(6, 10, 13), BackgroundTransparency = 0.2, BorderSizePixel = 0, Visible = false, ZIndex = 30 }, self.gui)
	local sheet = panel(o, { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(520, 360), BackgroundTransparency = 0.05 }); pad(sheet, 28, 24)
	label(sheet, { Text = "OVERRUN", Font = DISPLAY, TextSize = 30, TextColor3 = C.Danger, Size = UDim2.new(1, 0, 0, 36) })
	self.overSub = label(sheet, { Text = "", TextColor3 = C.Muted, Position = UDim2.fromOffset(0, 42) })
	local grid = new("Frame", { BackgroundTransparency = 1, Position = UDim2.fromOffset(0, 76), Size = UDim2.new(1, 0, 0, 150) }, sheet)
	new("UIGridLayout", { CellSize = UDim2.new(1 / 3, -4, 0.5, -4), CellPadding = UDim2.fromOffset(4, 4) }, grid)
	self.overStats = {}
	for _, n in ipairs({ "Score", "Wave", "Kills", "Headshots", "Accuracy", "Time" }) do
		local c = panel(grid, {}); pad(c, 12, 8)
		label(c, { Text = string.upper(n), TextSize = 10, TextColor3 = C.Muted })
		self.overStats[n] = label(c, { Text = "0", Font = DISPLAY, TextSize = 22, Position = UDim2.fromOffset(0, 20), Size = UDim2.new(1, 0, 0, 28) })
	end
	local again = button(sheet, "Redeploy", "Start a new run", true)
	again.Position = UDim2.fromOffset(0, 250)
	self.over, self.redeployButton = o, again
end

function Hud:showMenu(v) self.menu.Visible = v end
function Hud:showHud(v) for _, f in ipairs(self.hudRoot) do f.Visible = v end end

function Hud:showOver(s)
	self.overSub.Text = "The yard fell on wave " .. s.wave .. "."
	local t = math.floor(s.time)
	for k, v in pairs({ Score = s.score, Wave = s.wave, Kills = s.kills, Headshots = s.heads, Accuracy = s.acc .. "%", Time = string.format("%d:%02d", t // 60, t % 60) }) do self.overStats[k].Text = tostring(v) end
	self.over.Visible = true
end

function Hud:banner(title, sub, dur)
	self.banner.Text = string.upper(title)
	self.bannerSub.Text = string.upper(sub or "")
	for _, l in ipairs({ self.banner, self.bannerSub }) do
		l.TextTransparency = 0
		l.TextStrokeTransparency = l == self.banner and 0.7 or 1
	end
	self.bannerT = dur or 2.6
end

function Hud:showStreak(text)
	self.streak.Text = string.upper(text)
	self.streak.TextTransparency = 0
	self.streak.TextSize = 40
	TweenService:Create(self.streak, TweenInfo.new(0.2), { TextSize = 26 }):Play()
	TweenService:Create(self.streak, TweenInfo.new(0.5, Enum.EasingStyle.Linear, Enum.EasingDirection.In, 0, false, 1.1), { TextTransparency = 1 }):Play()
end

function Hud:hitmarker(kill)
	self.hm.Visible = true
	for _, f in ipairs(self.hmParts) do
		f.BackgroundColor3 = kill and C.Danger or Color3.new(1, 1, 1)
		f.Size = UDim2.fromOffset(kill and 16 or 12, 2)
	end
	self.hmT = 0.25
end

function Hud:damageDir(angle)
	local R = 110
	local f = new("Frame", { BackgroundColor3 = C.Danger, BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5), Size = UDim2.fromOffset(70, 4), Position = UDim2.fromOffset(math.sin(angle) * R, -math.cos(angle) * R), Rotation = math.deg(angle) }, self.dmgRoot)
	new("UIGradient", { Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.5, 0), NumberSequenceKeypoint.new(1, 1) }) }, f)
	TweenService:Create(f, TweenInfo.new(1), { BackgroundTransparency = 1 }):Play()
	task.delay(1, function() f:Destroy() end)
end

function Hud:feedEntry(killer, weapon, victim, head, mine)
	local f = new("Frame", { BackgroundColor3 = C.Panel, BackgroundTransparency = 0.3, BorderSizePixel = 0, AutomaticSize = Enum.AutomaticSize.X, Size = UDim2.fromOffset(0, 24), LayoutOrder = 0 }, self.feed)
	self.feedN = (self.feedN or 0) + 1
	f.LayoutOrder = -self.feedN
	pad(f, 10, 0)
	new("Frame", { BackgroundColor3 = mine and C.Accent or C.Muted, BorderSizePixel = 0, AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, 10, 0, 0), Size = UDim2.new(0, 2, 1, 0) }, f)
	local t = new("TextLabel", { BackgroundTransparency = 1, AutomaticSize = Enum.AutomaticSize.X, Size = UDim2.fromScale(0, 1), RichText = true, Font = MONO, TextSize = 12, TextColor3 = C.Text,
		Text = string.format('%s  <font color="#8e9ea7">%s ▸</font>  <font color="#ff4a3d">%s</font>%s', killer, weapon, victim, head and '  <font color="#f5a524">HEADSHOT</font>' or "") }, f)
	t.TextXAlignment = Enum.TextXAlignment.Right
	local items = {}
	for _, c in ipairs(self.feed:GetChildren()) do if c:IsA("Frame") then table.insert(items, c) end end
	if #items > 5 then table.sort(items, function(a, b) return a.LayoutOrder > b.LayoutOrder end); items[1]:Destroy() end
	task.delay(4, function() if f.Parent then TweenService:Create(f, TweenInfo.new(0.4), { BackgroundTransparency = 1 }):Play(); TweenService:Create(t, TweenInfo.new(0.4), { TextTransparency = 1 }):Play(); task.wait(0.45); f:Destroy() end end)
end

function Hud:setPrompt(text, warn)
	if text then
		self.prompt.Text = string.upper(text)
		self.prompt.TextColor3 = warn and C.Danger or C.Text
		self.prompt.Visible = true
	else
		self.prompt.Visible = false
	end
end

function Hud:update(dt, s)
	self.hp.Text = tostring(math.max(0, math.ceil(s.hp)))
	self.hpFill.Size = UDim2.fromScale(math.clamp(s.hp / s.maxHp, 0, 1), 1)
	self.hpFill.BackgroundColor3 = s.hp < 30 and C.Danger or C.Heal
	self.arFill.Size = UDim2.fromScale(math.clamp(s.armor / 100, 0, 1), 1)
	self.ar.Text = "Armor plating  " .. math.ceil(s.armor)
	self.wName.Text = string.upper(s.weapon.name)
	self.wMode.Text = s.weapon.mode
	self.mag.Text = tostring(s.mag)
	self.mag.TextColor3 = s.mag <= math.ceil(s.weapon.mag * 0.25) and C.Danger or C.Text
	self.res.Text = "/ " .. s.reserve
	self.nades.Text = "FRAG " .. s.grenades
	for i, sl in ipairs(self.slots) do
		local on = i == s.slot
		sl.BackgroundTransparency = on and 0 or 1
		sl.TextColor3 = on and C.AccentInk or C.Muted
	end
	self.reloadBg.Visible = s.reload ~= nil
	if s.reload then self.reloadFill.Size = UDim2.fromScale(math.clamp(s.reload, 0, 1), 1) end
	self.wave.Text = tostring(s.wave)
	if s.active then self.hostLbl.Text = "HOSTILES"; self.host.Text = tostring(s.hostiles)
	else self.hostLbl.Text = "NEXT WAVE"; self.host.Text = s.inter .. "s" end
	self.kills.Text = tostring(s.kills)
	self.score.Text = tostring(s.score)
	-- crosshair
	local g = s.gap
	self.ch[1].Position = UDim2.fromOffset(-g - 5, 0); self.ch[2].Position = UDim2.fromOffset(g + 5, 0)
	self.ch[3].Position = UDim2.fromOffset(0, -g - 5); self.ch[4].Position = UDim2.fromOffset(0, g + 5)
	self.chRoot.Visible = s.showCross
	self.scope.Visible = s.scoped
	-- fx
	local low = math.clamp((45 - s.hp) / 45, 0, 1) * (0.55 + math.sin(os.clock() * 6) * 0.15)
	local hurt = s.hurt or 0
	for _, f in ipairs(self.vigParts) do f.BackgroundTransparency = 1 - math.max(low, hurt * 0.8) end
	self.flash.BackgroundTransparency = 1 - (s.flash or 0)
	if self.hmT then
		self.hmT -= dt
		if self.hmT <= 0 then self.hm.Visible = false; self.hmT = nil end
	end
	if self.bannerT then
		self.bannerT -= dt
		if self.bannerT <= 0 then
			self.bannerT = nil
			for _, l in ipairs({ self.banner, self.bannerSub }) do TweenService:Create(l, TweenInfo.new(0.35), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play() end
		end
	end
end

return Hud
