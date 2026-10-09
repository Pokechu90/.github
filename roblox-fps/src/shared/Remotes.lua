--!nonstrict
-- Creates the remotes on the server and finds them on the client.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local EVENTS = {
	"Deploy", -- c->s: mapId, difficulty
	"Fire", -- c->s: slot, origin, directions
	"Reload", -- c->s: slot
	"Equip", -- c->s: slot
	"Throw", -- c->s: kind ("frag" | "stun"), origin, direction
	"Killstreak", -- c->s: kind ("airstrike" | "turret"), target position
	"BuffPick", -- c->s: buff key
	"Ready", -- c->s: skip the intermission
	"SaveSettings", -- c->s: settings table
	"Profile", -- s->c: saved profile snapshot
	"Run", -- s->c: this player's run state
	"Hit", -- s->c: { killed, head, numbers = { {pos, text, kind} } }
	"Damage", -- s->c: amount, source position, explosive
	"FX", -- s->all: kind, ...
	"Feed", -- s->all: killer, weapon, victim, headshot
	"Banner", -- s->all: title, subtitle, sound, isBoss
	"Toast", -- s->c: title, subtitle, kind
	"BuffOffer", -- s->c: wave, choices
	"GameOver", -- s->c: summary
}
local FUNCTIONS = {
	"Shop", -- c->s: request table -> ok, message
	"Leaderboard", -- c->s: mapId -> list
}

local folder
if RunService:IsServer() then
	folder = ReplicatedStorage:FindFirstChild("FoundryRemotes") or Instance.new("Folder")
	folder.Name = "FoundryRemotes"
	folder.Parent = ReplicatedStorage
	for _, n in ipairs(EVENTS) do
		if not folder:FindFirstChild(n) then
			local r = Instance.new("RemoteEvent")
			r.Name = n
			r.Parent = folder
		end
	end
	for _, n in ipairs(FUNCTIONS) do
		if not folder:FindFirstChild(n) then
			local r = Instance.new("RemoteFunction")
			r.Name = n
			r.Parent = folder
		end
	end
else
	folder = ReplicatedStorage:WaitForChild("FoundryRemotes")
end

local Remotes: any = {}
for _, n in ipairs(EVENTS) do Remotes[n] = folder:WaitForChild(n) end
for _, n in ipairs(FUNCTIONS) do Remotes[n] = folder:WaitForChild(n) end
return Remotes
