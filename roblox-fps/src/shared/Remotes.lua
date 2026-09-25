-- Creates the RemoteEvents on the server and finds them on the client.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local NAMES = {
	"Deploy", -- client -> server: join the fight
	"Fire", -- client -> server: weaponIndex, origin, directions
	"Reload", -- client -> server: weaponIndex
	"Equip", -- client -> server: weaponIndex
	"Throw", -- client -> server: origin, direction
	"Ammo", -- server -> client: mags, reserves, grenades
	"Hit", -- server -> client: killed, headshot
	"Damage", -- server -> client: amount, sourcePosition
	"FX", -- server -> all: kind, ...
	"Feed", -- server -> all: killer name, weapon short, enemy label, headshot
	"Banner", -- server -> all: title, subtitle
	"GameOver", -- server -> all: stats table
}

local folder
if RunService:IsServer() then
	folder = ReplicatedStorage:FindFirstChild("FoundryRemotes") or Instance.new("Folder")
	folder.Name = "FoundryRemotes"
	folder.Parent = ReplicatedStorage
	for _, n in ipairs(NAMES) do
		if not folder:FindFirstChild(n) then
			local r = Instance.new("RemoteEvent")
			r.Name = n
			r.Parent = folder
		end
	end
else
	folder = ReplicatedStorage:WaitForChild("FoundryRemotes")
end

local Remotes = {}
for _, n in ipairs(NAMES) do
	Remotes[n] = folder:WaitForChild(n)
end
return Remotes
