# Foundry Breach (Roblox)

The Roblox version of Foundry Breach: a co-op first-person wave shooter written in Luau. Everything is built from code: the map, the lighting, weapon viewmodels, enemy rigs, VFX and the HUD. You don't need to import any models.

## Set up in Roblox Studio

### Option A: Rojo (recommended)
1. Install [Rojo](https://rojo.space/docs/v7/getting-started/installation/) and the Rojo Studio plugin.
2. In this folder, run `rojo serve`.
3. Open a new **Baseplate** in Studio, delete the `Baseplate` part, then click **Connect** in the Rojo plugin.
4. In Explorer, select **Lighting** and set `Technology` to **Future** (scripts can't set this).
5. Press **Play**.

### Option B: copy the scripts by hand
Create these in Studio and paste in each file's contents. The names must match exactly.

| File | Create in Studio as |
| --- | --- |
| `src/shared/Config.lua` | ModuleScript `ReplicatedStorage.FoundryShared.Config` |
| `src/shared/Remotes.lua` | ModuleScript `ReplicatedStorage.FoundryShared.Remotes` |
| `src/server/Main.server.lua` | Script `ServerScriptService.FoundryServer.Main` |
| `src/server/MapBuilder.lua` | ModuleScript `ServerScriptService.FoundryServer.MapBuilder` |
| `src/server/Enemies.lua` | ModuleScript `ServerScriptService.FoundryServer.Enemies` |
| `src/client/Client.client.lua` | LocalScript `StarterPlayer.StarterPlayerScripts.FoundryClient.Client` |
| `src/client/Viewmodels.lua` | ModuleScript `StarterPlayer.StarterPlayerScripts.FoundryClient.Viewmodels` |
| `src/client/Effects.lua` | ModuleScript `StarterPlayer.StarterPlayerScripts.FoundryClient.Effects` |
| `src/client/Hud.lua` | ModuleScript `StarterPlayer.StarterPlayerScripts.FoundryClient.Hud` |
| `src/character/Health.server.lua` | Script `StarterPlayer.StarterCharacterScripts.Health` |

`FoundryShared`, `FoundryServer` and `FoundryClient` are plain Folders.

## What's in it
- **Co-op waves**: everyone in the server fights the same waves. Waves get bigger with more players, and the run ends when every deployed player is down at the same time.
- **Server-authoritative combat**: the server checks fire rate, ammo and hits, so clients can't give themselves damage or infinite ammo.
- **Four weapons** with part-built viewmodels, recoil, sway, bob, ADS, reload and pump/bolt animations, shell ejection, and a scope overlay on the marksman rifle.
- **Enemies**: Grunts, Hounds (melee rushers) and Wardens (heavies). They use pathfinding, strafe, and charge up telegraphed plasma bolts. On death they break apart into physics debris.
- **Grenades, chain-reacting fuel drums**, and health, ammo and armor pickups.
- **Look**: dusk lighting with Atmosphere, Bloom, ColorCorrection and SunRays, lamp-post spotlights, a neon city skyline and smoking chimneys.
- **HUD**: health and armor, ammo, weapon slots, dynamic crosshair, hitmarkers, damage direction, kill feed, streaks, wave banners, a title screen with loadout cards, and a game-over screen with stats.

## Sounds
Roblox only plays audio from asset IDs, so `Config.Sounds` starts out with built-in engine sounds that always load. For better audio, find gunshot, explosion and laser sounds in the Creator Store (Toolbox → Audio) and paste their IDs into `Config.Sounds` (for example `"rbxassetid://1234567890"`).

## Tuning
All weapon, enemy and player numbers live in `src/shared/Config.lua`.
