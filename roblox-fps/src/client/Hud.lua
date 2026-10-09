--!nonstrict
-- HUD, menus (play, armory, quests, settings), buff picker, intermission supplies and game over.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local GuiService = game:GetService("GuiService")
local Shared = ReplicatedStorage:WaitForChild("FoundryShared")
local Config = require(Shared:WaitForChild("Config"))
local Stats = require(Shared:WaitForChild("Stats"))

local C = Config.Colors
local DISPLAY = Enum.Font.Michroma
local MONO = Enum.Font.RobotoMono
local BODY = Enum.Font.GothamMedium
local BOLD = Enum.Font.GothamBold
local RGB = Color3.fromRGB
local Hud = {}

local XH_COLOR = { white = RGB(240, 244, 246), green = RGB(93, 255, 154), cyan = RGB(95, 242, 255), yellow = RGB(255, 226, 74), magenta = RGB(255, 62, 165), red = RGB(255, 74, 61) }
Hud.XH_COLOR = XH_COLOR

---------------------------------------------------------------- builders
local function new(class, props, parent)
	local o = Instance.new(class)
	for k, v in pairs(props) do (o :: any)[k] = v end
	o.Parent = parent
	return o
end
local function corner(o, r) new("UICorner", { CornerRadius = UDim.new(0, r or 6) }, o) end
local function stroke(o, color, t) return new("UIStroke", { Color = color or C.Line, Transparency = t or 0.3, Thickness = 1, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, o) end
local function pad(o, x, y) new("UIPadding", { PaddingLeft = UDim.new(0, x), PaddingRight = UDim.new(0, x), PaddingTop = UDim.new(0, y or x), PaddingBottom = UDim.new(0, y or x) }, o) end
local function vlist(o, gap, align) return new("UIListLayout", { Padding = UDim.new(0, gap or 6), SortOrder = Enum.SortOrder.LayoutOrder, HorizontalAlignment = align or Enum.HorizontalAlignment.Left }, o) end
local function hlist(o, gap, valign) return new("UIListLayout", { Padding = UDim.new(0, gap or 6), FillDirection = Enum.FillDirection.Horizontal, SortOrder = Enum.SortOrder.LayoutOrder, VerticalAlignment = valign or Enum.VerticalAlignment.Center }, o) end
local function text(parent, str, size, props)
	local t = new("TextLabel", { BackgroundTransparency = 1, Text = str, TextColor3 = C.Text, Font = BODY, TextSize = size or 14, TextXAlignment = Enum.TextXAlignment.Left, Size = UDim2.new(1, 0, 0, (size or 14) + 6), TextWrapped = false }, parent)
	if props then for k, v in pairs(props) do (t :: any)[k] = v end end
	return t
end
local function panel(parent, props)
	local f = new("Frame", { BackgroundColor3 = C.Panel, BackgroundTransparency = 0.25, BorderSizePixel = 0 }, parent)
	corner(f, 6)
	stroke(f)
	if props then for k, v in pairs(props) do (f :: any)[k] = v end end
	return f
end
local function button(parent, label, props, onClick, primary)
	local b = new("TextButton", { AutoButtonColor = false, Text = label, Font = BOLD, TextSize = 14, TextColor3 = primary and C.AccentInk or C.Text, BackgroundColor3 = primary and C.Accent or C.Panel2, BorderSizePixel = 0, Size = UDim2.fromOffset(140, 36), Selectable = true }, parent)
	corner(b, 5)
	local s = stroke(b, primary and C.Accent or C.Line, 0.2)
	if props then for k, v in pairs(props) do (b :: any)[k] = v end end
	local base = b.BackgroundColor3
	b.MouseEnter:Connect(function() TweenService:Create(b, TweenInfo.new(0.1), { BackgroundColor3 = base:Lerp(Color3.new(1, 1, 1), 0.12) }):Play() end)
	b.MouseLeave:Connect(function() TweenService:Create(b, TweenInfo.new(0.1), { BackgroundColor3 = base }):Play() end)
	b.SelectionGained:Connect(function() s.Color = C.Accent; s.Transparency = 0 end)
	b.SelectionLost:Connect(function() s.Color = primary and C.Accent or C.Line; s.Transparency = 0.2 end)
	if onClick then b.Activated:Connect(onClick) end
	return b
end
local function bar(parent, color, props)
	local bg = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 0.9, BorderSizePixel = 0, Size = UDim2.new(1, 0, 0, 6) }, parent)
	corner(bg, 3)
	local fill = new("Frame", { BackgroundColor3 = color, BorderSizePixel = 0, Size = UDim2.new(1, 0, 1, 0) }, bg)
	corner(fill, 3)
	if props then for k, v in pairs(props) do (bg :: any)[k] = v end end
	return fill, bg
end
local function clear(f)
	for _, c in ipairs(f:GetChildren()) do
		if not c:IsA("UIListLayout") and not c:IsA("UIPadding") and not c:IsA("UIGridLayout") and not c:IsA("UICorner") and not c:IsA("UIStroke") then c:Destroy() end
	end
end
local function fmt(n)
	n = math.floor(n + 0.5)
	local s = tostring(math.abs(n))
	local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	if out:sub(1, 1) == "," then out = out:sub(2) end
	return (n < 0 and "-" or "") .. out
end
Hud.fmt = fmt

---------------------------------------------------------------- HUD
function Hud.new(ctx)
	local self: any = { open = nil, menuTab = "play", armorySel = "rifle", mapSel = "yard", diffSel = "normal", feed = {}, toasts = {} }
	local player = Players.LocalPlayer
	local gui = new("ScreenGui", { Name = "FoundryHUD", IgnoreGuiInset = true, ResetOnSpawn = false, ZIndexBehavior = Enum.ZIndexBehavior.Sibling, DisplayOrder = 5 }, player:WaitForChild("PlayerGui"))
	self.gui = gui
	local uiScale = new("UIScale", { Scale = 1 }, gui)
	local function rescale()
		local vp = workspace.CurrentCamera.ViewportSize
		uiScale.Scale = math.clamp(math.min(vp.Y / 900, vp.X / 1500), 0.55, 1.25)
	end
	workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(rescale)
	rescale()

	-- screen effects
	local vig = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1) }, gui)
	local vigParts = {}
	for i, spec in ipairs({ { UDim2.new(1, 0, 0.3, 0), UDim2.new(0, 0, 0, 0), 90 }, { UDim2.new(1, 0, 0.3, 0), UDim2.new(0, 0, 0.7, 0), -90 }, { UDim2.new(0.25, 0, 1, 0), UDim2.new(0, 0, 0, 0), 0 }, { UDim2.new(0.25, 0, 1, 0), UDim2.new(0.75, 0, 0, 0), 180 } }) do
		local f = new("Frame", { BackgroundColor3 = RGB(170, 10, 0), BorderSizePixel = 0, Size = spec[1], Position = spec[2], BackgroundTransparency = 1 }, vig)
		new("UIGradient", { Rotation = spec[3], Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.1), NumberSequenceKeypoint.new(1, 1) }) }, f)
		vigParts[i] = f
	end
	local flash = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 1, BorderSizePixel = 0, Size = UDim2.fromScale(1, 1), ZIndex = 50 }, gui)
	local powerTint = new("Frame", { BackgroundColor3 = RGB(255, 60, 40), BackgroundTransparency = 1, BorderSizePixel = 0, Size = UDim2.fromScale(1, 1) }, gui)

	-- sniper scope: a round hole made from a huge black stroke
	local scope = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), Visible = false }, gui)
	local hole = new("Frame", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromScale(0.74, 0.74) }, scope)
	new("UIAspectRatioConstraint", { AspectRatio = 1 }, hole)
	new("UICorner", { CornerRadius = UDim.new(0.5, 0) }, hole)
	new("UIStroke", { Color = Color3.new(), Thickness = 2500, ApplyStrokeMode = Enum.ApplyStrokeMode.Border }, hole)
	new("Frame", { BackgroundColor3 = Color3.new(), BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.new(1, 0, 0, 1) }, hole)
	new("Frame", { BackgroundColor3 = Color3.new(), BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.new(0, 1, 1, 0) }, hole)
	for i = 1, 4 do new("Frame", { BackgroundColor3 = Color3.new(), BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, i * 22), Size = UDim2.fromOffset(14 - i * 2, 1) }, hole) end
	local sdot = new("Frame", { BackgroundColor3 = C.Danger, BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(5, 5) }, hole)
	corner(sdot, 3)

	-- crosshair, hitmarker and damage direction
	local ch = new("Frame", { BackgroundTransparency = 1, Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(0, 0) }, gui)
	local lines = {}
	for i = 1, 4 do
		local f = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5), Size = UDim2.fromOffset(10, 2) }, ch)
		new("UIStroke", { Color = Color3.new(), Transparency = 0.45, Thickness = 1 }, f)
		lines[i] = f
	end
	local cdot = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5), Size = UDim2.fromOffset(3, 3) }, ch)
	new("UIStroke", { Color = Color3.new(), Transparency = 0.45, Thickness = 1 }, cdot)
	local circle = new("Frame", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(0.5, 0.5), Size = UDim2.fromOffset(30, 30) }, ch)
	corner(circle, 100)
	local circleStroke = new("UIStroke", { Color = Color3.new(1, 1, 1), Thickness = 1.5, Transparency = 0.1 }, circle)
	local hm = new("Frame", { BackgroundTransparency = 1, Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(0, 0) }, gui)
	local hmParts = {}
	for i = 1, 4 do
		local a = math.rad(45 + 90 * i)
		local f = new("Frame", { BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5), Size = UDim2.fromOffset(9, 2), Rotation = 45 + 90 * i, Position = UDim2.fromOffset(math.cos(a) * 9, math.sin(a) * 9), BackgroundTransparency = 1 }, hm)
		hmParts[i] = f
	end
	local hmT, hmKill = 0, false
	local dmgDirs = {}
	for i = 1, 4 do
		local holder = new("Frame", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(240, 240) }, gui)
		local w = new("Frame", { BackgroundColor3 = C.Danger, BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.fromScale(0.5, 0), Size = UDim2.fromOffset(60, 6), BackgroundTransparency = 1 }, holder)
		corner(w, 3)
		dmgDirs[i] = { holder = holder, wedge = w, t = 0 }
	end
	local dmgIdx = 0

	---------------------------------------------------------------- HUD root
	local hudRoot = new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1) }, gui)
	self.hudRoot = hudRoot
	-- vitals (bottom left)
	local vit = panel(hudRoot, { AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 22, 1, -22), Size = UDim2.fromOffset(300, 86) })
	pad(vit, 12, 10)
	local hpText = text(vit, "100", 30, { Font = DISPLAY, Size = UDim2.new(0, 120, 0, 34) })
	text(vit, "HEALTH", 11, { Position = UDim2.fromOffset(110, 6), TextColor3 = C.Muted, Size = UDim2.fromOffset(80, 14) })
	local armorText = text(vit, "50", 14, { Font = MONO, Position = UDim2.fromOffset(196, 6), Size = UDim2.fromOffset(80, 16), TextXAlignment = Enum.TextXAlignment.Right, TextColor3 = C.Armor })
	local hpFill = bar(vit, C.Heal, { Position = UDim2.fromOffset(0, 40), Size = UDim2.new(1, 0, 0, 8) })
	local arFill = bar(vit, C.Armor, { Position = UDim2.fromOffset(0, 54), Size = UDim2.new(1, 0, 0, 5) })
	local powerRow = new("Frame", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 22, 1, -116), Size = UDim2.fromOffset(300, 28) }, hudRoot)
	hlist(powerRow, 6)
	local buffRow = new("Frame", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 22, 1, -148), Size = UDim2.fromOffset(300, 22) }, hudRoot)
	hlist(buffRow, 4)

	-- weapon (bottom right)
	local wp = panel(hudRoot, { AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -22, 1, -22), Size = UDim2.fromOffset(330, 112) })
	pad(wp, 12, 10)
	local wName = text(wp, "VANGUARD KR7", 15, { Font = DISPLAY, Size = UDim2.new(1, 0, 0, 20) })
	local wMode = text(wp, "AUTO", 11, { Position = UDim2.fromOffset(0, 22), TextColor3 = C.Muted, Size = UDim2.new(1, 0, 0, 14) })
	local magText = text(wp, "30", 40, { Font = DISPLAY, Position = UDim2.fromOffset(0, 36), Size = UDim2.fromOffset(120, 46) })
	local resText = text(wp, "/ 240", 16, { Font = MONO, Position = UDim2.fromOffset(110, 58), Size = UDim2.fromOffset(100, 20), TextColor3 = C.Muted })
	local reloadFill, reloadBg = bar(wp, C.Accent, { Position = UDim2.new(0, 0, 1, -6), Size = UDim2.new(1, 0, 0, 4), Visible = false })
	local equip = text(wp, "", 12, { Font = MONO, Position = UDim2.fromOffset(200, 40), Size = UDim2.fromOffset(110, 60), TextXAlignment = Enum.TextXAlignment.Right, TextYAlignment = Enum.TextYAlignment.Top, TextColor3 = C.Muted, RichText = true })
	local slotsRow = new("Frame", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -22, 1, -142), Size = UDim2.fromOffset(330, 26) }, hudRoot)
	local sl = hlist(slotsRow, 6)
	sl.HorizontalAlignment = Enum.HorizontalAlignment.Right
	local slotLabels = {}
	for i = 1, 2 do
		local f = panel(slotsRow, { Size = UDim2.fromOffset(120, 26), LayoutOrder = i })
		slotLabels[i] = text(f, i .. "  —", 12, { Font = MONO, Size = UDim2.fromScale(1, 1), TextXAlignment = Enum.TextXAlignment.Center })
	end
	-- killstreak meter
	local streakPanel = panel(hudRoot, { AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -22, 1, -176), Size = UDim2.fromOffset(200, 22), BackgroundTransparency = 0.45 })
	local streakFill = bar(streakPanel, C.Danger, { Position = UDim2.new(0, 6, 1, -6), Size = UDim2.new(1, -12, 0, 3) })
	local streakText = text(streakPanel, "STREAK 0", 10, { Font = MONO, Position = UDim2.fromOffset(8, 0), Size = UDim2.new(1, -16, 0, 16), TextColor3 = C.Muted })

	-- score and multipliers (top left)
	local sp = panel(hudRoot, { Position = UDim2.fromOffset(22, 22), Size = UDim2.fromOffset(300, 132) })
	pad(sp, 12, 10)
	local scoreText = text(sp, "0", 26, { Font = DISPLAY, Size = UDim2.new(1, 0, 0, 30) })
	local multText = text(sp, "x1.0", 22, { Font = DISPLAY, Position = UDim2.fromOffset(0, 0), Size = UDim2.new(1, 0, 0, 30), TextXAlignment = Enum.TextXAlignment.Right, TextColor3 = C.Accent })
	local multParts = text(sp, "", 11, { Font = MONO, Position = UDim2.fromOffset(0, 32), Size = UDim2.new(1, 0, 0, 14), TextColor3 = C.Muted, TextXAlignment = Enum.TextXAlignment.Right })
	local comboText = text(sp, "", 13, { Font = BOLD, Position = UDim2.fromOffset(0, 50), Size = UDim2.new(1, 0, 0, 16), TextColor3 = C.Head })
	local comboFill = bar(sp, C.Head, { Position = UDim2.fromOffset(0, 70), Size = UDim2.new(1, 0, 0, 3) })
	local coinText = text(sp, "0", 14, { Font = MONO, Position = UDim2.fromOffset(0, 80), Size = UDim2.new(0.5, 0, 0, 18), TextColor3 = C.Coin })
	local levelText = text(sp, "LV 1", 12, { Font = MONO, Position = UDim2.new(0.5, 0, 0, 80), Size = UDim2.new(0.5, 0, 0, 18), TextXAlignment = Enum.TextXAlignment.Right, TextColor3 = C.Xp })
	local xpFill = bar(sp, C.Xp, { Position = UDim2.fromOffset(0, 102), Size = UDim2.new(1, 0, 0, 3) })
	local fpsText = text(hudRoot, "", 11, { Font = MONO, Position = UDim2.fromOffset(22, 158), Size = UDim2.fromOffset(120, 14), TextColor3 = C.Muted, Visible = false })

	-- wave (top centre) and boss bar
	local wave = panel(hudRoot, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 18), Size = UDim2.fromOffset(300, 58) })
	local waveText = text(wave, "WAVE 0", 18, { Font = DISPLAY, Position = UDim2.fromOffset(0, 6), Size = UDim2.new(1, 0, 0, 22), TextXAlignment = Enum.TextXAlignment.Center })
	local waveSub = text(wave, "", 12, { Font = MONO, Position = UDim2.fromOffset(0, 32), Size = UDim2.new(1, 0, 0, 16), TextXAlignment = Enum.TextXAlignment.Center, TextColor3 = C.Muted })
	local mutTag = panel(hudRoot, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 82), Size = UDim2.fromOffset(220, 22), BackgroundColor3 = RGB(60, 20, 16), Visible = false })
	local mutText = text(mutTag, "", 11, { Font = BOLD, Size = UDim2.fromScale(1, 1), TextXAlignment = Enum.TextXAlignment.Center, TextColor3 = C.Danger })
	local bossPanel = panel(hudRoot, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 110), Size = UDim2.fromOffset(560, 46), Visible = false })
	pad(bossPanel, 12, 6)
	local bossName = text(bossPanel, "", 13, { Font = DISPLAY, Size = UDim2.new(1, 0, 0, 16) })
	local bossPhase = text(bossPanel, "", 11, { Font = MONO, Size = UDim2.new(1, 0, 0, 16), TextXAlignment = Enum.TextXAlignment.Right, TextColor3 = C.Muted })
	local bossFill = bar(bossPanel, C.Danger, { Position = UDim2.fromOffset(0, 22), Size = UDim2.new(1, 0, 0, 8) })
	local shieldFill, shieldBg = bar(bossPanel, C.Block, { Position = UDim2.fromOffset(0, 32), Size = UDim2.new(1, 0, 0, 3) })

	-- minimap radar (top right)
	local radar = panel(hudRoot, { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -22, 0, 22), Size = UDim2.fromOffset(150, 150), BackgroundTransparency = 0.35 })
	corner(radar, 75)
	new("Frame", { BackgroundColor3 = C.Line, BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.new(1, -10, 0, 1), BackgroundTransparency = 0.6 }, radar)
	new("Frame", { BackgroundColor3 = C.Line, BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.new(0, 1, 1, -10), BackgroundTransparency = 0.6 }, radar)
	new("Frame", { BackgroundColor3 = C.Accent, BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(8, 8), Rotation = 45 }, radar)
	local dots = {}
	local function dot(i)
		local d = dots[i]
		if not d then
			d = new("Frame", { BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5), Size = UDim2.fromOffset(6, 6) }, radar)
			corner(d, 3)
			dots[i] = d
		end
		return d
	end

	-- kill feed, toasts, banners, streak text, prompt
	local feedBox = new("Frame", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -22, 0, 182), Size = UDim2.fromOffset(340, 200) }, hudRoot)
	vlist(feedBox, 4, Enum.HorizontalAlignment.Right)
	local toastBox = new("Frame", { BackgroundTransparency = 1, Position = UDim2.fromOffset(22, 186), Size = UDim2.fromOffset(320, 400) }, gui)
	vlist(toastBox, 6)
	local bannerF = new("Frame", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.3), Size = UDim2.fromOffset(700, 90), Visible = false }, gui)
	local bannerTitle = text(bannerF, "", 38, { Font = DISPLAY, Size = UDim2.new(1, 0, 0, 46), TextXAlignment = Enum.TextXAlignment.Center, TextStrokeTransparency = 0.6 })
	local bannerSub = text(bannerF, "", 15, { Position = UDim2.fromOffset(0, 50), Size = UDim2.new(1, 0, 0, 20), TextXAlignment = Enum.TextXAlignment.Center, TextColor3 = C.Muted, TextStrokeTransparency = 0.7 })
	local bannerT = 0
	local streakBig = text(gui, "", 24, { Font = DISPLAY, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.62), Size = UDim2.fromOffset(500, 30), TextXAlignment = Enum.TextXAlignment.Center, TextColor3 = C.Accent, TextTransparency = 1, TextStrokeTransparency = 1 })
	local streakT = 0
	local prompt = panel(gui, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0.66, 0), Size = UDim2.fromOffset(360, 30), Visible = false })
	local promptText = text(prompt, "", 13, { Font = BOLD, Size = UDim2.fromScale(1, 1), TextXAlignment = Enum.TextXAlignment.Center })
	self.prompt = prompt
	self.promptAuto = false

	-- intermission bar
	local inter = panel(hudRoot, { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -24), Size = UDim2.fromOffset(520, 40), Visible = false })
	local interText = text(inter, "", 13, { Font = BOLD, Size = UDim2.fromScale(1, 1), TextXAlignment = Enum.TextXAlignment.Center, RichText = true })

	function self:setPrompt(str, danger)
		if not str then prompt.Visible = false; return end
		prompt.Visible = true
		promptText.Text = str
		promptText.TextColor3 = danger and C.Danger or C.Text
		prompt.Size = UDim2.fromOffset(math.max(220, #str * 8 + 40), 30)
	end

	function self:hitmarker(kind)
		hmT = 0.22
		hmKill = kind == "kill" or kind == "head" or kind == "weak"
		local color = kind == "head" and C.Head or (kind == "kill" and C.Danger or (kind == "weak" and C.Weak or (kind == "block" and C.Block or Color3.new(1, 1, 1))))
		for _, f in ipairs(hmParts) do f.BackgroundColor3 = color end
	end

	function self:damageDir(angle)
		dmgIdx = dmgIdx % 4 + 1
		local d = dmgDirs[dmgIdx]
		d.holder.Rotation = math.deg(angle)
		d.t = 1.2
	end

	function self:feedEntry(killer, weapon, victim, head, mine)
		local row = panel(feedBox, { Size = UDim2.fromOffset(330, 24), BackgroundTransparency = mine and 0.15 or 0.45, LayoutOrder = -os.clock() * 100 })
		if mine then row:FindFirstChildOfClass("UIStroke").Color = C.Accent end
		text(row, string.format("<b>%s</b>  <font color=\"#8e9ea7\">[%s]</font>%s  %s", killer, weapon, head and " <font color=\"#ffb13b\">◎</font>" or "", victim), 12, { RichText = true, Font = MONO, Size = UDim2.fromScale(1, 1), TextXAlignment = Enum.TextXAlignment.Right, Position = UDim2.fromOffset(-8, 0) })
		table.insert(self.feed, row)
		if #self.feed > 6 then (table.remove(self.feed, 1) :: any):Destroy() end
		task.delay(5, function()
			if row.Parent then
				TweenService:Create(row, TweenInfo.new(0.4), { BackgroundTransparency = 1 }):Play()
				task.wait(0.4)
				local i = table.find(self.feed, row)
				if i then table.remove(self.feed, i) end
				row:Destroy()
			end
		end)
	end

	local TOAST_COLOR = { quest = C.Accent, level = C.Xp, drop = C.Coin, deny = C.Danger, buff = C.Heal, threat = C.Danger }
	function self:toast(title, sub, kind)
		local t = panel(toastBox, { Size = UDim2.fromOffset(320, sub and sub ~= "" and 52 or 32), LayoutOrder = os.clock() * 100 })
		pad(t, 10, 6)
		new("Frame", { BackgroundColor3 = TOAST_COLOR[kind] or C.Accent, BorderSizePixel = 0, Size = UDim2.new(0, 3, 1, 12), Position = UDim2.fromOffset(-10, -6) }, t)
		text(t, title, 13, { Font = BOLD, Size = UDim2.new(1, 0, 0, 18) })
		if sub and sub ~= "" then text(t, sub, 11, { Position = UDim2.fromOffset(0, 20), Size = UDim2.new(1, 0, 0, 16), TextColor3 = C.Muted, TextTruncate = Enum.TextTruncate.AtEnd }) end
		table.insert(self.toasts, t)
		if #self.toasts > 5 then (table.remove(self.toasts, 1) :: any):Destroy() end
		task.delay(4.5, function()
			local i = table.find(self.toasts, t)
			if i then table.remove(self.toasts, i) end
			t:Destroy()
		end)
	end

	function self:banner(title, sub, isBoss)
		bannerF.Visible = true
		bannerTitle.Text = string.upper(title)
		bannerTitle.TextColor3 = isBoss and C.Danger or C.Text
		bannerSub.Text = sub or ""
		bannerT = isBoss and 3.2 or 2.4
		bannerTitle.TextTransparency = 0
		bannerSub.TextTransparency = 0
		bannerF.Position = UDim2.fromScale(0.5, 0.28)
		TweenService:Create(bannerF, TweenInfo.new(0.35, Enum.EasingStyle.Back), { Position = UDim2.fromScale(0.5, 0.3) }):Play()
	end

	function self:showStreak(str)
		streakBig.Text = string.upper(str)
		streakBig.TextTransparency = 0
		streakBig.TextStrokeTransparency = 0.5
		streakBig.TextSize = 30
		TweenService:Create(streakBig, TweenInfo.new(0.25, Enum.EasingStyle.Back), { TextSize = 24 }):Play()
		streakT = 1.2
	end

	function self:showHud(on) hudRoot.Visible = on; ch.Visible = on end

	---------------------------------------------------------------- per-frame HUD update
	local POWER_NAME = { damage = { "2x DMG", RGB(255, 74, 61) }, speed = { "SPEED", RGB(180, 140, 255) }, ammo = { "INF AMMO", RGB(255, 210, 74) } }
	local powerChips = {}
	local lastBuffKey = ""
	function self:update(dt, s)
		local prof = ctx.profile() or {}
		local settings = prof.settings or {}
		-- vitals
		hpText.Text = tostring(math.ceil(s.hp))
		hpText.TextColor3 = s.hp / math.max(1, s.maxHp) < 0.3 and C.Danger or C.Text
		hpFill.Size = UDim2.fromScale(math.clamp(s.hp / math.max(1, s.maxHp), 0, 1), 1)
		armorText.Text = "ARMOR " .. math.floor(s.armor)
		arFill.Size = UDim2.fromScale(math.clamp(s.armor / Config.Player.MaxArmor, 0, 1), 1)
		for i, f in ipairs(vigParts) do f.BackgroundTransparency = 1 - math.max(s.hurt * 0.85, (1 - s.hp / math.max(1, s.maxHp)) * 0.55 * (s.hp < s.maxHp * 0.35 and 1 or 0)) * (i <= 2 and 0.8 or 1) end
		flash.BackgroundTransparency = 1 - s.flash
		powerTint.BackgroundTransparency = (s.powerups and (s.powerups.damage or 0) > 0) and 0.94 or 1
		-- power-ups and buffs
		for k, def in pairs(POWER_NAME) do
			local left = s.powerups and s.powerups[k] or 0
			local chip = powerChips[k]
			if left > 0 then
				if not chip then
					chip = panel(powerRow, { Size = UDim2.fromOffset(96, 26), BackgroundColor3 = def[2], BackgroundTransparency = 0.25 })
					chip:SetAttribute("t", 0)
					text(chip, "", 12, { Name = "T", Font = BOLD, Size = UDim2.fromScale(1, 1), TextXAlignment = Enum.TextXAlignment.Center, TextColor3 = RGB(15, 10, 8) })
					powerChips[k] = chip
				end
				chip.T.Text = string.format("%s %.0f", def[1], left)
			elseif chip then
				chip:Destroy()
				powerChips[k] = nil
			end
		end
		local bk = ""
		if s.buffs then for k, n in pairs(s.buffs) do bk ..= k .. n end end
		if bk ~= lastBuffKey then
			lastBuffKey = bk
			clear(buffRow)
			if s.buffs then
				for _, k in ipairs({ "damage", "rate", "reload", "mag", "health", "speed", "regen", "head", "leech", "prospector", "blast", "plating" }) do
					local n = s.buffs[k]
					if n and n > 0 then
						local b = Config.Buffs[k]
						local chip = panel(buffRow, { Size = UDim2.fromOffset(44, 20), BackgroundColor3 = b.color, BackgroundTransparency = 0.6 })
						text(chip, string.upper(k:sub(1, 3)) .. n, 10, { Font = MONO, Size = UDim2.fromScale(1, 1), TextXAlignment = Enum.TextXAlignment.Center })
					end
				end
			end
		end
		-- weapon
		local w = s.weapon
		if w then
			wName.Text = string.upper(w.name) .. ((s.oc or 0) > 0 and ("  OC" .. s.oc) or "")
			wName.TextColor3 = (s.oc or 0) > 0 and C.Weak or C.Text
			wMode.Text = w.mode .. (s.infinite and "  ·  BOTTOMLESS" or "") .. (s.reddot and "  ·  RDS" or "")
			magText.Text = s.infinite and "∞" or tostring(s.mag)
			magText.TextColor3 = s.mag <= math.ceil(w.mag * 0.25) and C.Danger or C.Text
			resText.Text = "/ " .. s.reserve
			resText.Position = UDim2.fromOffset(magText.TextBounds.X + 8, 58)
		end
		reloadBg.Visible = s.reload ~= nil
		if s.reload then reloadFill.Size = UDim2.fromScale(math.clamp(s.reload, 0, 1), 1) end
		equip.Text = string.format("G  FRAG %d\nT  STUN %d\nZ  AIR %d   X  TUR %d", s.frags or 0, s.stuns or 0, s.airstrikes or 0, s.turrets or 0)
		for i = 1, 2 do
			local id = s.slots and s.slots[i]
			slotLabels[i].Text = id and (i .. "  " .. Config.WeaponById[id].short) or (i .. "  —")
			slotLabels[i].TextColor3 = (s.slot == i) and C.Accent or C.Muted
		end
		local ks = s.killstreak or 0
		local nextAt = ks < Config.Killstreak.Airstrike and Config.Killstreak.Airstrike or Config.Killstreak.Turret
		streakText.Text = string.format("STREAK %d  ·  %s AT %d", ks, ks < Config.Killstreak.Airstrike and "AIRSTRIKE" or "TURRET", nextAt)
		streakFill.Size = UDim2.fromScale(math.clamp(ks / nextAt, 0, 1), 1)
		-- score
		scoreText.Text = fmt(s.score or 0)
		local m = s.mults
		if m then
			multText.Text = string.format("x%.2f", m.total)
			multParts.Text = string.format("WAVE x%.1f%s%s", m.wave, m.mut ~= 1 and string.format("  RISK x%.2g", m.mut) or "", m.combo > 1 and string.format("  COMBO x%.1f", m.combo) or "")
		end
		local combo = s.combo or 0
		comboText.Text = combo >= 2 and string.format("%d KILL COMBO", combo) or ""
		comboFill.Size = UDim2.fromScale(combo >= 1 and math.clamp((s.comboT or 0) / Config.ComboWindow, 0, 1) or 0, 1)
		coinText.Text = "◉ " .. fmt(prof.coins or 0)
		levelText.Text = "LV " .. (prof.level or 1)
		xpFill.Size = UDim2.fromScale(math.clamp((prof.xp or 0) / Stats.xpForLevel(prof.level or 1), 0, 1), 1)
		fpsText.Visible = settings.fpsCounter == true
		if fpsText.Visible then fpsText.Text = string.format("%d FPS", s.fps or 0) end
		-- wave
		if s.running then
			if s.active then
				waveText.Text = "WAVE " .. s.wave
				waveSub.Text = s.hostiles .. " HOSTILES"
			else
				waveText.Text = s.wave == 0 and "STAND BY" or ("WAVE " .. s.wave .. " CLEARED")
				waveSub.Text = "NEXT WAVE IN " .. s.inter
			end
		else
			waveText.Text = "FOUNDRY BREACH"
			waveSub.Text = ""
		end
		local mu = s.mutator and Config.Mutators[s.mutator]
		mutTag.Visible = mu ~= nil and s.active
		if mu then mutText.Text = string.upper(mu.name) .. "  ·  x" .. mu.reward end
		inter.Visible = s.running and not s.active and s.wave > 0
		if inter.Visible then interText.Text = string.format("<font color=\"#f5a524\">B</font>  SUPPLIES     <font color=\"#f5a524\">ENTER</font>  %s     %ds", s.ready and "READY ✓" or "READY UP", s.inter) end
		-- boss
		local b = s.boss
		bossPanel.Visible = b ~= nil
		if b then
			bossName.Text = string.upper(b.name)
			bossPhase.Text = "PHASE " .. b.phase .. "  ·  " .. fmt(b.hp)
			bossFill.Size = UDim2.fromScale(math.clamp(b.hp / math.max(1, b.max), 0, 1), 1)
			shieldBg.Visible = b.shieldMax > 0
			shieldFill.Size = UDim2.fromScale(math.clamp(b.shield / math.max(1, b.shieldMax), 0, 1), 1)
		end
		-- crosshair
		local style = settings.xhStyle or "cross"
		local color = XH_COLOR[settings.xhColor or "white"] or XH_COLOR.white
		local size = settings.xhSize or 1
		local gap = s.gap
		local len = 9 * size
		local showLines = s.showCross and style == "cross"
		for i, f in ipairs(lines) do
			f.Visible = showLines
			f.BackgroundColor3 = color
			local horiz = i <= 2
			f.Size = horiz and UDim2.fromOffset(len, 2) or UDim2.fromOffset(2, len)
			local o = gap + len / 2
			f.Position = ({ UDim2.fromOffset(-o, 0), UDim2.fromOffset(o, 0), UDim2.fromOffset(0, -o), UDim2.fromOffset(0, o) })[i]
		end
		cdot.Visible = s.showCross and (style == "dot" or style == "circle")
		cdot.BackgroundColor3 = color
		cdot.Size = UDim2.fromOffset(3 * size + 1, 3 * size + 1)
		circle.Visible = s.showCross and style == "circle"
		circle.Size = UDim2.fromOffset(gap * 2 + 6, gap * 2 + 6)
		circleStroke.Color = color
		scope.Visible = s.scoped
		hmT = math.max(0, hmT - dt)
		local hmA = hmT / 0.22
		for _, f in ipairs(hmParts) do
			f.BackgroundTransparency = 1 - hmA
			f.Size = UDim2.fromOffset(hmKill and 12 or 9, 2)
		end
		for _, d in ipairs(dmgDirs) do
			d.t = math.max(0, d.t - dt)
			d.wedge.BackgroundTransparency = 1 - math.min(1, d.t)
		end
		-- radar
		local n = 0
		if s.radar and s.root then
			local rot = CFrame.Angles(0, -s.yaw, 0)
			local range = 260
			for _, e in ipairs(s.radar) do
				local rel = rot * (e.pos - s.root)
				local dx, dz = rel.X / range, rel.Z / range
				local dist = math.sqrt(dx * dx + dz * dz)
				if dist > 0.95 then dx, dz = dx / dist * 0.95, dz / dist * 0.95 end
				n += 1
				local d = dot(n)
				d.Visible = true
				d.Position = UDim2.fromScale(0.5 + dx * 0.5, 0.5 + dz * 0.5)
				d.BackgroundColor3 = e.boss and C.Danger or (e.pickup and C.Heal or RGB(255, 120, 90))
				d.Size = e.boss and UDim2.fromOffset(12, 12) or UDim2.fromOffset(6, 6)
			end
		end
		for i = n + 1, #dots do dots[i].Visible = false end
		-- banners and streak text
		if bannerT > 0 then
			bannerT -= dt
			if bannerT < 0.5 then
				bannerTitle.TextTransparency = 1 - bannerT * 2
				bannerSub.TextTransparency = 1 - bannerT * 2
			end
			if bannerT <= 0 then bannerF.Visible = false end
		end
		if streakT > 0 then
			streakT -= dt
			if streakT < 0.4 then
				streakBig.TextTransparency = 1 - streakT / 0.4
				streakBig.TextStrokeTransparency = 1 - streakT / 0.4 * 0.5
			end
		end
	end

	---------------------------------------------------------------- modal screens
	local screens = {}
	local function screen(name, w, h)
		local back = new("Frame", { BackgroundColor3 = RGB(4, 8, 10), BackgroundTransparency = 0.35, BorderSizePixel = 0, Size = UDim2.fromScale(1, 1), Visible = false, ZIndex = 20 }, gui)
		local sheet = panel(back, { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.fromOffset(w, h), BackgroundTransparency = 0.08, ZIndex = 21 })
		pad(sheet, 20, 18)
		screens[name] = back
		return back, sheet
	end
	local function selectFirst(root)
		task.defer(function()
			for _, d in ipairs(root:GetDescendants()) do
				if d:IsA("GuiButton") and d.Visible and d.Selectable then GuiService.SelectedObject = d; return end
			end
		end)
	end
	function self:closeAll()
		for _, s in pairs(screens) do s.Visible = false end
		self.open = nil
		GuiService.SelectedObject = nil
	end
	function self:isOpen() return self.open ~= nil end
	local function show(name)
		for n, s in pairs(screens) do s.Visible = n == name end
		self.open = name
		selectFirst(screens[name])
	end

	---------------------------------------------------------------- main menu (title, play, armory, quests, settings)
	local menu, menuSheet = screen("menu", 1080, 640)
	menu.BackgroundTransparency = 0.55
	text(menuSheet, "FOUNDRY BREACH", 30, { Font = DISPLAY, Size = UDim2.new(1, 0, 0, 36), TextColor3 = C.Text })
	local profLine = text(menuSheet, "", 13, { Font = MONO, Position = UDim2.fromOffset(0, 40), Size = UDim2.new(1, 0, 0, 16), TextColor3 = C.Muted, RichText = true })
	local tabs = new("Frame", { BackgroundTransparency = 1, Position = UDim2.fromOffset(0, 66), Size = UDim2.new(1, 0, 0, 36) }, menuSheet)
	hlist(tabs, 8)
	local body = new("Frame", { BackgroundTransparency = 1, Position = UDim2.fromOffset(0, 112), Size = UDim2.new(1, 0, 1, -112), ClipsDescendants = true }, menuSheet)
	local closeBtn = button(menuSheet, "RESUME", { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, 0, 0, 0), Size = UDim2.fromOffset(120, 34), Visible = false }, function() self:closeAll() end)
	local tabButtons = {}
	local renderTab
	for i, t in ipairs({ { "play", "PLAY" }, { "armory", "ARMORY" }, { "quests", "QUESTS" }, { "settings", "SETTINGS" } }) do
		tabButtons[t[1]] = button(tabs, t[2], { LayoutOrder = i, Size = UDim2.fromOffset(130, 34) }, function() self.menuTab = t[1]; renderTab() end)
	end

	local function statRow(parent, label, value, frac, order)
		local r = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 22), LayoutOrder = order }, parent)
		text(r, label, 12, { Size = UDim2.new(0.35, 0, 1, 0), TextColor3 = C.Muted })
		text(r, value, 12, { Font = MONO, Position = UDim2.new(0.35, 0, 0, 0), Size = UDim2.new(0.2, 0, 1, 0) })
		local f = bar(r, C.Accent, { Position = UDim2.new(0.56, 0, 0.5, -3), Size = UDim2.new(0.44, 0, 0, 6) })
		f.Size = UDim2.fromScale(math.clamp(frac, 0.02, 1), 1)
	end

	local function shopReq(req)
		local ok, msg = ctx.shop(req)
		if msg and msg ~= "" then self:toast(if ok then msg else "Can't do that", if ok then nil else msg, if ok then "buff" else "deny") end
		task.delay(0.35, function() if self.open == "menu" then renderTab() end end)
		return ok
	end

	local boardBox
	local function renderBoard(parent)
		boardBox = parent
		clear(parent)
		text(parent, "LEADERBOARD · " .. Config.MapById[self.mapSel].name .. " · " .. Config.Difficulty[self.diffSel].label, 12, { Font = BOLD, LayoutOrder = 0, TextColor3 = C.Muted })
		task.spawn(function()
			local data = ctx.leaderboard(self.mapSel, self.diffSel)
			if boardBox ~= parent or not parent.Parent then return end
			text(parent, "Your best runs", 12, { LayoutOrder = 1, Font = BOLD })
			local personal = data and data.personal or {}
			if #personal == 0 then text(parent, "No runs yet", 11, { LayoutOrder = 2, TextColor3 = C.Muted }) end
			for i, e in ipairs(personal) do
				text(parent, string.format("%d.  %s   wave %d   %d kills", i, fmt(e.score), e.wave, e.kills), 11, { Font = MONO, LayoutOrder = 2 + i })
			end
			text(parent, "Global top 10", 12, { LayoutOrder = 10, Font = BOLD })
			local global = data and data.global or {}
			if #global == 0 then text(parent, "Global board unavailable in this server", 11, { LayoutOrder = 11, TextColor3 = C.Muted }) end
			for i, e in ipairs(global) do
				text(parent, string.format("%d.  %-16s %s", i, e.name, fmt(e.score)), 11, { Font = MONO, LayoutOrder = 11 + i })
			end
		end)
	end

	local function renderPlay(prof)
		local running = ctx.state("Running")
		local left = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(0.62, 0, 1, 0) }, body)
		vlist(left, 8)
		text(left, running and ("A run is in progress on " .. Config.MapById[ctx.state("Map") or "yard"].name .. " · wave " .. (ctx.state("Wave") or 0)) or "SELECT A SITE", 13, { Font = BOLD, LayoutOrder = 1, TextColor3 = running and C.Accent or C.Muted })
		local maps = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 132), LayoutOrder = 2 }, left)
		new("UIGridLayout", { CellSize = UDim2.fromOffset(124, 62), CellPadding = UDim2.fromOffset(8, 8), SortOrder = Enum.SortOrder.LayoutOrder }, maps)
		for i, m in ipairs(Config.Maps) do
			local unlocked = Stats.mapUnlocked(prof, m.id)
			local sel = self.mapSel == m.id
			local b = button(maps, "", { LayoutOrder = i, BackgroundColor3 = sel and C.Panel2:Lerp(C.Accent, 0.25) or C.Panel2, AutoButtonColor = false }, function()
				if running then return end
				if not unlocked then self:toast(m.name .. " is locked", string.format("Reach level %d or wave %d", m.unlock.level, m.unlock.wave), "deny"); return end
				self.mapSel = m.id
				ctx.shop({ type = "prefs", map = m.id })
				renderTab()
			end)
			text(b, m.name, 12, { Font = BOLD, Position = UDim2.fromOffset(8, 6), Size = UDim2.new(1, -16, 0, 16) })
			text(b, unlocked and m.desc or string.format("LV %d or wave %d", m.unlock.level, m.unlock.wave), 10, { Position = UDim2.fromOffset(8, 26), Size = UDim2.new(1, -16, 0, 28), TextWrapped = true, TextYAlignment = Enum.TextYAlignment.Top, TextColor3 = unlocked and C.Muted or C.Danger })
		end
		text(left, "DIFFICULTY", 13, { Font = BOLD, LayoutOrder = 3, TextColor3 = C.Muted })
		local diffs = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 62), LayoutOrder = 4 }, left)
		hlist(diffs, 8)
		for i, k in ipairs(Config.DifficultyOrder) do
			local d = Config.Difficulty[k]
			local sel = self.diffSel == k
			local b = button(diffs, "", { LayoutOrder = i, Size = UDim2.fromOffset(204, 60), BackgroundColor3 = sel and C.Panel2:Lerp(C.Accent, 0.25) or C.Panel2 }, function()
				if running then return end
				self.diffSel = k
				ctx.shop({ type = "prefs", diff = k })
				renderTab()
			end)
			text(b, d.label, 13, { Font = BOLD, Position = UDim2.fromOffset(8, 6), Size = UDim2.new(1, -16, 0, 16) })
			text(b, d.desc, 10, { Position = UDim2.fromOffset(8, 26), Size = UDim2.new(1, -16, 0, 28), TextWrapped = true, TextYAlignment = Enum.TextYAlignment.Top, TextColor3 = C.Muted })
		end
		local lo = prof.loadout or {}
		text(left, string.format("Loadout: %s + %s   ·   change it in the Armory", Config.WeaponById[lo.primary or "rifle"].name, Config.WeaponById[lo.secondary or "pistol"].name), 12, { LayoutOrder = 5, TextColor3 = C.Muted })
		button(left, running and "JOIN RUN" or "DEPLOY", { LayoutOrder = 6, Size = UDim2.fromOffset(260, 48), TextSize = 18, Font = DISPLAY }, function() ctx.deploy(self.mapSel, self.diffSel) end, true)
		text(left, "WASD move · Shift sprint · C crouch/slide · Space jump/mantle · RMB aim · R reload · Q swap · G frag · T stun · Z airstrike · X turret · E use · F inspect · M menu", 11, { LayoutOrder = 7, TextWrapped = true, Size = UDim2.new(1, 0, 0, 30), TextColor3 = C.Muted })
		local right = panel(body, { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, 0, 0, 0), Size = UDim2.new(0.36, 0, 1, -4), BackgroundColor3 = C.Panel2 })
		pad(right, 12, 10)
		vlist(right, 3)
		renderBoard(right)
	end

	local function renderArmory(prof)
		local list = new("ScrollingFrame", { BackgroundTransparency = 1, BorderSizePixel = 0, Size = UDim2.new(0, 230, 1, 0), CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollBarThickness = 4 }, body)
		vlist(list, 6)
		for i, w in ipairs(Config.Weapons) do
			local owned = prof.weapons and prof.weapons[w.id]
			local b = button(list, "", { LayoutOrder = i, Size = UDim2.new(1, -8, 0, 44), BackgroundColor3 = self.armorySel == w.id and C.Panel2:Lerp(C.Accent, 0.25) or C.Panel2 }, function() self.armorySel = w.id; renderTab() end)
			text(b, w.name, 13, { Font = BOLD, Position = UDim2.fromOffset(10, 4), Size = UDim2.new(1, -20, 0, 18) })
			local tag = owned and ((prof.loadout.primary == w.id and "PRIMARY") or (prof.loadout.secondary == w.id and "SECONDARY") or w.cls) or (prof.level >= w.level and (fmt(w.price) .. " coins") or ("Level " .. w.level))
			text(b, tag, 10, { Position = UDim2.fromOffset(10, 24), Size = UDim2.new(1, -20, 0, 14), TextColor3 = owned and C.Muted or C.Coin })
		end
		local w = Config.WeaponById[self.armorySel]
		local owned = prof.weapons and prof.weapons[w.id]
		local s = Stats.weapon(w.id, prof, nil)
		local detail = new("ScrollingFrame", { BackgroundTransparency = 1, BorderSizePixel = 0, Position = UDim2.fromOffset(244, 0), Size = UDim2.new(1, -244, 1, 0), CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollBarThickness = 4 }, body)
		vlist(detail, 6)
		text(detail, w.name, 20, { Font = DISPLAY, LayoutOrder = 1 })
		text(detail, w.cls .. " · " .. w.mode, 12, { LayoutOrder = 2, TextColor3 = C.Muted })
		statRow(detail, "Damage", string.format("%.0f%s", s.dmg, w.pellets > 1 and ("x" .. w.pellets) or ""), s.dmg * w.pellets / 140, 3)
		statRow(detail, "Fire rate", string.format("%.0f rpm", s.rpm), s.rpm / 1000, 4)
		statRow(detail, "Magazine", tostring(s.mag), s.mag / 80, 5)
		statRow(detail, "Reload", string.format("%.2fs", s.reload), 1 - s.reload / 4.5, 6)
		statRow(detail, "Accuracy", string.format("%.2f°", s.spread), 1 - s.spread / 4.5, 7)
		statRow(detail, "Range", tostring(w.range), w.range / 1400, 8)
		local actions = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 38), LayoutOrder = 9 }, detail)
		hlist(actions, 8)
		if owned then
			button(actions, prof.loadout.primary == w.id and "PRIMARY ✓" or "SET PRIMARY", { Size = UDim2.fromOffset(150, 34) }, function() shopReq({ type = "loadout", slot = "primary", id = w.id }) end, prof.loadout.primary ~= w.id)
			button(actions, prof.loadout.secondary == w.id and "SECONDARY ✓" or "SET SECONDARY", { Size = UDim2.fromOffset(160, 34) }, function() shopReq({ type = "loadout", slot = "secondary", id = w.id }) end)
		else
			button(actions, prof.level >= w.level and ("UNLOCK · " .. fmt(w.price)) or ("REQUIRES LEVEL " .. w.level), { Size = UDim2.fromOffset(240, 34) }, function() shopReq({ type = "buyWeapon", id = w.id }) end, prof.level >= w.level)
		end
		if owned then
			text(detail, "UPGRADES", 12, { Font = BOLD, LayoutOrder = 10, TextColor3 = C.Muted })
			for i, k in ipairs(Config.UpgradeOrder) do
				local u = Config.Upgrades[k]
				local lvl = Stats.upgradeLevel(prof, w.id, k)
				local r = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 30), LayoutOrder = 10 + i }, detail)
				text(r, u.name, 12, { Size = UDim2.new(0.3, 0, 1, 0) })
				text(r, string.rep("■", lvl) .. string.rep("□", Config.UpgradeMax - lvl), 13, { Font = MONO, Position = UDim2.new(0.3, 0, 0, 0), Size = UDim2.new(0.25, 0, 1, 0), TextColor3 = C.Accent })
				text(r, u.desc, 10, { Position = UDim2.new(0.55, 0, 0, 0), Size = UDim2.new(0.25, 0, 1, 0), TextColor3 = C.Muted, TextWrapped = true })
				if lvl < Config.UpgradeMax then
					button(r, fmt(Stats.upgradeCost(prof, w.id, k)), { AnchorPoint = Vector2.new(1, 0.5), Position = UDim2.new(1, -4, 0.5, 0), Size = UDim2.fromOffset(100, 26), TextSize = 12 }, function() shopReq({ type = "upgrade", id = w.id, stat = k }) end)
				end
			end
			text(detail, "ATTACHMENTS", 12, { Font = BOLD, LayoutOrder = 20, TextColor3 = C.Muted })
			for i, a in ipairs(Config.AttachmentOrder) do
				local def = Config.Attachments[a]
				local has = Stats.attOwned(prof, w.id, a)
				local on = Stats.attOn(prof, w.id, a)
				local r = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 34), LayoutOrder = 20 + i }, detail)
				text(r, def.name, 12, { Size = UDim2.new(0.3, 0, 0, 16), Font = BOLD })
				text(r, def.desc, 10, { Position = UDim2.fromOffset(0, 16), Size = UDim2.new(0.75, 0, 0, 16), TextColor3 = C.Muted, TextTruncate = Enum.TextTruncate.AtEnd })
				button(r, has and (on and "ON" or "OFF") or fmt(def.price), { AnchorPoint = Vector2.new(1, 0.5), Position = UDim2.new(1, -4, 0.5, 0), Size = UDim2.fromOffset(100, 26), TextSize = 12 }, function()
					if has then shopReq({ type = "toggleAtt", id = w.id, att = a }) else shopReq({ type = "buyAtt", id = w.id, att = a }) end
				end, has and on)
			end
			text(detail, "SKINS", 12, { Font = BOLD, LayoutOrder = 30, TextColor3 = C.Muted })
			local skins = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 66), LayoutOrder = 31 }, detail)
			new("UIGridLayout", { CellSize = UDim2.fromOffset(110, 30), CellPadding = UDim2.fromOffset(6, 6), SortOrder = Enum.SortOrder.LayoutOrder }, skins)
			for i, k in ipairs(Config.SkinOrder) do
				local sk = Config.Skins[k]
				local unlocked = prof.skins and prof.skins[k]
				local active = ((prof.skin and prof.skin[w.id]) or "stock") == k
				local b = button(skins, unlocked and sk.name or "🔒 " .. sk.name, { LayoutOrder = i, TextSize = 11, BackgroundColor3 = sk.metal:Lerp(C.Panel2, 0.4), TextColor3 = active and C.Accent or (unlocked and C.Text or C.Muted) }, function()
					if unlocked then shopReq({ type = "skin", id = w.id, skin = k }) else self:toast(sk.name .. " is locked", sk.how, "deny") end
				end)
				new("Frame", { BackgroundColor3 = sk.accent, BorderSizePixel = 0, Size = UDim2.new(0, 4, 1, 0) }, b)
			end
		end
	end

	local function questRow(parent, order, name, desc, p, goal, reward, done)
		local r = panel(parent, { Size = UDim2.new(1, -8, 0, 54), LayoutOrder = order, BackgroundColor3 = C.Panel2 })
		pad(r, 10, 6)
		text(r, (done and "✓  " or "") .. name, 13, { Font = BOLD, Size = UDim2.new(0.6, 0, 0, 16), TextColor3 = done and C.Heal or C.Text })
		text(r, reward, 11, { Font = MONO, Position = UDim2.new(0.4, 0, 0, 0), Size = UDim2.new(0.6, 0, 0, 16), TextXAlignment = Enum.TextXAlignment.Right, TextColor3 = C.Coin })
		text(r, desc, 11, { Position = UDim2.fromOffset(0, 18), Size = UDim2.new(0.8, 0, 0, 14), TextColor3 = C.Muted })
		text(r, string.format("%s / %s", fmt(math.min(p, goal)), fmt(goal)), 11, { Font = MONO, Position = UDim2.new(0.8, 0, 0, 18), Size = UDim2.new(0.2, 0, 0, 14), TextXAlignment = Enum.TextXAlignment.Right })
		local f = bar(r, done and C.Heal or C.Accent, { Position = UDim2.new(0, 0, 1, -5), Size = UDim2.new(1, 0, 0, 4) })
		f.Size = UDim2.fromScale(math.clamp(p / goal, 0, 1), 1)
	end

	local function renderQuests(prof)
		local sc = new("ScrollingFrame", { BackgroundTransparency = 1, BorderSizePixel = 0, Size = UDim2.fromScale(1, 1), CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollBarThickness = 4 }, body)
		vlist(sc, 6)
		local now = os.time()
		local reset = 86400 - now % 86400
		text(sc, string.format("DAILY CHALLENGES · resets in %dh %02dm", reset // 3600, (reset % 3600) // 60), 12, { Font = BOLD, LayoutOrder = 0, TextColor3 = C.Muted })
		for i, d in ipairs((prof.daily and prof.daily.q) or {}) do
			local t
			for _, x in ipairs(Config.DailyPool) do if x.id == d.id then t = x end end
			if t then questRow(sc, i, t.name, string.format(t.desc, d.goal), d.p, d.goal, t.reward .. " coins · 200 XP", d.done) end
		end
		text(sc, "QUESTS", 12, { Font = BOLD, LayoutOrder = 10, TextColor3 = C.Muted })
		for i, q in ipairs(Config.Quests) do
			local st = (prof.quests and prof.quests[q.id]) or { p = 0, done = false }
			questRow(sc, 10 + i, q.name, q.desc, st.p, q.goal, Stats.rewardText(q.reward), st.done)
		end
	end

	local settingsDraft
	local function renderSettings(prof)
		settingsDraft = settingsDraft or table.clone(prof.settings or {})
		local s = settingsDraft
		local sc = new("ScrollingFrame", { BackgroundTransparency = 1, BorderSizePixel = 0, Size = UDim2.fromScale(1, 1), CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollBarThickness = 4 }, body)
		vlist(sc, 6)
		local order = 0
		local function row(label)
			order += 1
			local r = new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, -8, 0, 32), LayoutOrder = order }, sc)
			text(r, label, 13, { Size = UDim2.new(0.4, 0, 1, 0) })
			return r
		end
		local function numeric(label, key, lo, hi, step, default, fmtStr)
			local r = row(label)
			local v = s[key] or default
			local val = text(r, string.format(fmtStr, v), 13, { Font = MONO, Position = UDim2.new(0.4, 50, 0, 0), Size = UDim2.fromOffset(80, 32), TextXAlignment = Enum.TextXAlignment.Center })
			local f = bar(r, C.Accent, { Position = UDim2.new(0.4, 190, 0.5, -3), Size = UDim2.new(0.6, -200, 0, 6) })
			local function set(nv)
				nv = math.clamp(math.floor(nv / step + 0.5) * step, lo, hi)
				s[key] = nv
				val.Text = string.format(fmtStr, nv)
				f.Size = UDim2.fromScale((nv - lo) / (hi - lo), 1)
				ctx.applySettings(s)
			end
			button(r, "−", { Position = UDim2.new(0.4, 0, 0, 2), Size = UDim2.fromOffset(40, 28) }, function() set((s[key] or default) - step) end)
			button(r, "+", { Position = UDim2.new(0.4, 136, 0, 2), Size = UDim2.fromOffset(40, 28) }, function() set((s[key] or default) + step) end)
			f.Size = UDim2.fromScale((v - lo) / (hi - lo), 1)
		end
		local function toggle(label, key, default)
			local r = row(label)
			local b
			b = button(r, "", { Position = UDim2.new(0.4, 0, 0, 2), Size = UDim2.fromOffset(100, 28) }, function()
				local cur = s[key]
				if cur == nil then cur = default end
				s[key] = not cur
				b.Text = s[key] and "ON" or "OFF"
				ctx.applySettings(s)
			end)
			local cur = s[key]
			if cur == nil then cur = default end
			b.Text = cur and "ON" or "OFF"
		end
		local function choice(label, key, options, default)
			local r = row(label)
			for i, o in ipairs(options) do
				local b
				b = button(r, string.upper(o), { Position = UDim2.new(0.4, (i - 1) * 86, 0, 2), Size = UDim2.fromOffset(80, 28), TextSize = 11, TextColor3 = (s[key] or default) == o and C.Accent or C.Text }, function()
					s[key] = o
					ctx.applySettings(s)
					renderTab()
				end)
				if XH_COLOR[o] then new("Frame", { BackgroundColor3 = XH_COLOR[o], BorderSizePixel = 0, Size = UDim2.new(1, 0, 0, 3), Position = UDim2.new(0, 0, 1, -3) }, b) end
			end
		end
		numeric("Mouse sensitivity", "sens", 0.1, 4, 0.05, 1, "%.2f")
		numeric("Aim sensitivity (multiplier)", "adsSens", 0.2, 2, 0.05, 1, "%.2f")
		numeric("Controller look speed", "padSens", 0.3, 3, 0.1, 1, "%.1f")
		numeric("Field of view", "fov", 70, 100, 1, 80, "%d")
		numeric("Effects volume", "volume", 0, 1, 0.05, 1, "%.2f")
		numeric("Crosshair size", "xhSize", 0.5, 2, 0.1, 1, "%.1f")
		choice("Crosshair style", "xhStyle", { "cross", "dot", "circle" }, "cross")
		choice("Crosshair colour", "xhColor", { "white", "green", "cyan", "yellow", "magenta" }, "white")
		toggle("Toggle aim (instead of hold)", "toggleAds", false)
		toggle("Damage numbers", "dmgNumbers", true)
		toggle("Invert look", "invert", false)
		toggle("FPS counter", "fpsCounter", false)
		toggle("Reduce motion (less shake)", "reduceMotion", false)
		order += 1
		button(sc, "SAVE SETTINGS", { LayoutOrder = order, Size = UDim2.fromOffset(200, 38) }, function()
			ctx.saveSettings(s)
			self:toast("Settings saved", nil, "buff")
		end, true)
	end

	function renderTab()
		local prof = ctx.profile()
		if not prof then return end
		clear(body)
		for k, b in pairs(tabButtons) do b.TextColor3 = k == self.menuTab and C.Accent or C.Text end
		tabButtons.play.Visible = not ctx.deployed()
		if ctx.deployed() and self.menuTab == "play" then self.menuTab = "armory" end
		profLine.Text = string.format("<font color=\"#b48cff\">LEVEL %d</font>   %s / %s XP     <font color=\"#ffd24a\">◉ %s coins</font>     best wave %d   ·   bosses %d   ·   kills %s", prof.level, fmt(prof.xp), fmt(Stats.xpForLevel(prof.level)), fmt(prof.coins), prof.stats.bestWave, prof.stats.bosses, fmt(prof.stats.kills))
		if self.menuTab == "play" then renderPlay(prof)
		elseif self.menuTab == "armory" then renderArmory(prof)
		elseif self.menuTab == "quests" then renderQuests(prof)
		else renderSettings(prof) end
	end

	function self:showMenu(inRun)
		closeBtn.Visible = inRun == true
		settingsDraft = nil
		local prof = ctx.profile()
		if prof and not inRun then
			if prof.map and Stats.mapUnlocked(prof, prof.map) then self.mapSel = prof.map end
			if prof.difficulty and Config.Difficulty[prof.difficulty] then self.diffSel = prof.difficulty end
			self.menuTab = "play"
		end
		show("menu")
		renderTab()
	end
	function self:refresh()
		if self.open == "menu" then renderTab() end
	end

	---------------------------------------------------------------- buff picker
	local _, buffSheet = screen("buffs", 780, 330)
	local buffTitle = text(buffSheet, "", 22, { Font = DISPLAY, Size = UDim2.new(1, 0, 0, 28) })
	local buffSub = text(buffSheet, "", 12, { Position = UDim2.fromOffset(0, 32), Size = UDim2.new(1, 0, 0, 16), TextColor3 = C.Muted })
	local buffCards = new("Frame", { BackgroundTransparency = 1, Position = UDim2.fromOffset(0, 64), Size = UDim2.new(1, 0, 1, -64) }, buffSheet)
	hlist(buffCards, 12, Enum.VerticalAlignment.Top)
	self.buffChoices = nil
	function self:openBuffs(wave, choices, bonus, run)
		self.buffChoices = choices
		buffTitle.Text = "WAVE " .. wave .. " CLEARED"
		buffSub.Text = "+" .. fmt(bonus or 0) .. " coins. Pick one upgrade; it lasts for the rest of this run.  (1 / 2 / 3)"
		clear(buffCards)
		for i, k in ipairs(choices) do
			local b = Config.Buffs[k]
			local have = run and run.buffs and run.buffs[k] or 0
			local card = button(buffCards, "", { LayoutOrder = i, Size = UDim2.fromOffset(236, 230), BackgroundColor3 = C.Panel2 }, function() ctx.buffPick(k) end)
			new("Frame", { BackgroundColor3 = b.color, BorderSizePixel = 0, Size = UDim2.new(1, 0, 0, 6) }, card)
			text(card, tostring(i), 34, { Font = DISPLAY, Position = UDim2.fromOffset(14, 18), Size = UDim2.fromOffset(40, 40), TextColor3 = b.color })
			text(card, b.name, 16, { Font = BOLD, Position = UDim2.fromOffset(14, 70), Size = UDim2.new(1, -28, 0, 22) })
			text(card, b.desc, 12, { Position = UDim2.fromOffset(14, 98), Size = UDim2.new(1, -28, 0, 60), TextWrapped = true, TextYAlignment = Enum.TextYAlignment.Top, TextColor3 = C.Muted })
			text(card, string.format("Rank %d / %d", have + 1, b.max), 11, { Font = MONO, Position = UDim2.new(0, 14, 1, -30), Size = UDim2.new(1, -28, 0, 16), TextColor3 = b.color })
		end
		show("buffs")
	end

	---------------------------------------------------------------- intermission supplies
	local _, supplySheet = screen("supply", 640, 250)
	text(supplySheet, "SUPPLY DROP", 20, { Font = DISPLAY, Size = UDim2.new(1, 0, 0, 26) })
	text(supplySheet, "Spend coins between waves. B or Esc closes this panel.", 12, { Position = UDim2.fromOffset(0, 30), Size = UDim2.new(1, 0, 0, 16), TextColor3 = C.Muted })
	local supplyGrid = new("Frame", { BackgroundTransparency = 1, Position = UDim2.fromOffset(0, 60), Size = UDim2.new(1, 0, 0, 120) }, supplySheet)
	new("UIGridLayout", { CellSize = UDim2.fromOffset(190, 52), CellPadding = UDim2.fromOffset(10, 10), SortOrder = Enum.SortOrder.LayoutOrder }, supplyGrid)
	for i, it in ipairs({ { "ammo", "Ammo crate", 150, "Refill all reserves" }, { "armor", "Armor plate", 200, "+50 armor" }, { "heal", "Field repair", 150, "Full health" }, { "frag", "Frag grenade", 120, "+1 frag" }, { "stun", "Stun grenade", 120, "+1 stun" } }) do
		local b = button(supplyGrid, "", { LayoutOrder = i }, function() local ok, msg = ctx.shop({ type = "supply", item = it[1] }); self:toast(if ok then msg else "Can't buy", if ok then nil else msg, if ok then "buff" else "deny") end)
		text(b, it[2], 13, { Font = BOLD, Position = UDim2.fromOffset(10, 6), Size = UDim2.new(1, -20, 0, 16) })
		text(b, it[4], 11, { Position = UDim2.fromOffset(10, 26), Size = UDim2.new(0.6, 0, 0, 16), TextColor3 = C.Muted })
		text(b, "◉ " .. it[3], 12, { Font = MONO, Position = UDim2.fromOffset(10, 26), Size = UDim2.new(1, -20, 0, 16), TextXAlignment = Enum.TextXAlignment.Right, TextColor3 = C.Coin })
	end
	button(supplySheet, "READY UP", { AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 0, 1, 0), Size = UDim2.fromOffset(180, 38) }, function() ctx.ready(); self:closeAll() end, true)
	button(supplySheet, "CLOSE", { AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, 0, 1, 0), Size = UDim2.fromOffset(120, 38) }, function() self:closeAll() end)
	function self:openSupply() show("supply") end

	---------------------------------------------------------------- game over
	local _, overSheet = screen("over", 860, 560)
	local overTitle = text(overSheet, "OVERRUN", 30, { Font = DISPLAY, Size = UDim2.new(1, 0, 0, 36), TextColor3 = C.Danger })
	local overSub = text(overSheet, "", 13, { Position = UDim2.fromOffset(0, 40), Size = UDim2.new(1, 0, 0, 16), TextColor3 = C.Muted })
	local overGrid = new("Frame", { BackgroundTransparency = 1, Position = UDim2.fromOffset(0, 70), Size = UDim2.new(0.55, 0, 0, 210) }, overSheet)
	new("UIGridLayout", { CellSize = UDim2.fromOffset(150, 62), CellPadding = UDim2.fromOffset(8, 8), SortOrder = Enum.SortOrder.LayoutOrder }, overGrid)
	local overExtra = new("Frame", { BackgroundTransparency = 1, Position = UDim2.fromOffset(0, 290), Size = UDim2.new(0.55, 0, 0, 160) }, overSheet)
	vlist(overExtra, 4)
	local overBoard = panel(overSheet, { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, 0, 0, 70), Size = UDim2.new(0.42, 0, 0, 380), BackgroundColor3 = C.Panel2 })
	pad(overBoard, 12, 10)
	vlist(overBoard, 3)
	button(overSheet, "REDEPLOY", { AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 0, 1, 0), Size = UDim2.fromOffset(200, 42) }, function() self:closeAll(); ctx.deploy(self.mapSel, self.diffSel) end, true)
	button(overSheet, "MAIN MENU", { AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 212, 1, 0), Size = UDim2.fromOffset(160, 42) }, function() self:showMenu(false) end)
	function self:showOver(s)
		self.mapSel, self.diffSel = s.map or self.mapSel, s.diff or self.diffSel
		overTitle.Text = "OVERRUN AT WAVE " .. s.wave
		overSub.Text = string.format("%s · %s · %dm %02ds%s", Config.MapById[s.map or "yard"].name, Config.Difficulty[s.diff or "normal"].label, s.time // 60, math.floor(s.time % 60), (s.rank and s.rank == 1) and "  ·  NEW PERSONAL BEST" or "")
		clear(overGrid)
		for i, kv in ipairs({ { "SCORE", fmt(s.score) }, { "KILLS", fmt(s.kills) }, { "HEADSHOTS", fmt(s.heads) }, { "ACCURACY", s.acc .. "%" }, { "BEST COMBO", tostring(s.bestCombo) }, { "COINS", "+" .. fmt(s.coins) }, { "XP", "+" .. fmt(s.xp) }, { "LEVELS", "+" .. s.levels } }) do
			local c = panel(overGrid, { LayoutOrder = i, BackgroundColor3 = C.Panel2 })
			text(c, kv[1], 10, { Position = UDim2.fromOffset(10, 8), Size = UDim2.new(1, -20, 0, 14), TextColor3 = C.Muted })
			text(c, kv[2], 20, { Font = DISPLAY, Position = UDim2.fromOffset(10, 26), Size = UDim2.new(1, -20, 0, 26) })
		end
		clear(overExtra)
		if #s.quests > 0 then text(overExtra, "Quests completed: " .. table.concat(s.quests, ", "), 12, { TextColor3 = C.Accent, TextWrapped = true, Size = UDim2.new(1, 0, 0, 34) }) end
		if #s.drops > 0 then text(overExtra, "Rare drops: " .. table.concat(s.drops, ", "), 12, { TextColor3 = C.Coin, TextWrapped = true, Size = UDim2.new(1, 0, 0, 34) }) end
		renderBoard(overBoard)
		show("over")
	end

	function self:screen(name) return screens[name] end
	return self
end

return Hud
