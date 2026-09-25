-- Replaces Roblox's default regeneration: heal only after 5 seconds without damage.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage:WaitForChild("FoundryShared"):WaitForChild("Config"))

local hum = script.Parent:WaitForChild("Humanoid")
local lastHurt = 0
local prev = hum.Health
hum.HealthChanged:Connect(function(h)
	if h < prev then lastHurt = os.clock() end
	prev = h
end)

while hum.Parent and hum.Health > 0 do
	local dt = task.wait(0.1)
	if os.clock() - lastHurt > Config.Player.RegenDelay and hum.Health < hum.MaxHealth then
		hum.Health = math.min(hum.MaxHealth, hum.Health + Config.Player.RegenPerSecond * dt)
	end
end
