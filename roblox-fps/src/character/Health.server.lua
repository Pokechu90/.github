--!nonstrict
-- Replaces Roblox's default regeneration: heal only after a few seconds without damage,
-- plus the always-on Nanite repair buff (the server sets the player's Regen attribute).
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage:WaitForChild("FoundryShared"):WaitForChild("Config"))

local char = script.Parent
local hum = char:WaitForChild("Humanoid") :: Humanoid
local player = Players:GetPlayerFromCharacter(char)
local lastHurt = 0
local prev = hum.Health
hum.HealthChanged:Connect(function(h)
	if h < prev then lastHurt = os.clock() end
	prev = h
end)

while hum.Parent and hum.Health > 0 do
	local dt = task.wait(0.1)
	if hum.Health < hum.MaxHealth then
		local rate = (player and player:GetAttribute("Regen")) or 0
		if os.clock() - lastHurt > Config.Player.RegenDelay then rate += Config.Player.RegenPerSecond end
		if rate > 0 then hum.Health = math.min(hum.MaxHealth, hum.Health + rate * dt) end
	end
end
