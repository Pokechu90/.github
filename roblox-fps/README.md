# Foundry Breach (Roblox)

The Roblox version of Foundry Breach: a co-op first-person wave shooter written in Luau. Everything is built from code: the five maps, the lighting, weapon viewmodels, enemy and boss rigs, VFX and every menu. You don't need to import any models.

It has the same features as the browser version: an economy and shop, 8 weapons with upgrades, attachments and skins, 7 enemy types, 3 bosses, round modifiers and score multipliers, quests and daily challenges, levels saved to a DataStore, and leaderboards.

## Set up in Roblox Studio

### Option A: Rojo (recommended)
1. Install [Rojo](https://rojo.space/docs/v7/getting-started/installation/) and the Rojo Studio plugin.
2. In this folder, run `rojo serve`.
3. Open a new **Baseplate** in Studio, delete the `Baseplate` part, then click **Connect** in the Rojo plugin.
4. In Explorer, select **Lighting** and set `Technology` to **Future** (scripts can't set this).
5. To test saving in Studio, open **Game Settings → Security** and turn on **Enable Studio Access to API Services**. The game still runs without it; progress just isn't saved.
6. Press **Play**. To try co-op, use **Test → Clients and Servers** with 2 or more players.

### Option B: copy the scripts by hand
Create these in Studio and paste in each file's contents. The names must match exactly. `FoundryShared`, `FoundryServer` and `FoundryClient` are plain Folders.

| File | Create in Studio as |
| --- | --- |
| `src/shared/Config.lua` | ModuleScript `ReplicatedStorage.FoundryShared.Config` |
| `src/shared/Stats.lua` | ModuleScript `ReplicatedStorage.FoundryShared.Stats` |
| `src/shared/Remotes.lua` | ModuleScript `ReplicatedStorage.FoundryShared.Remotes` |
| `src/server/Main.server.lua` | Script `ServerScriptService.FoundryServer.Main` |
| `src/server/Data.lua` | ModuleScript `ServerScriptService.FoundryServer.Data` |
| `src/server/MapBuilder.lua` | ModuleScript `ServerScriptService.FoundryServer.MapBuilder` |
| `src/server/Enemies.lua` | ModuleScript `ServerScriptService.FoundryServer.Enemies` |
| `src/server/Bosses.lua` | ModuleScript `ServerScriptService.FoundryServer.Bosses` |
| `src/server/Combat.lua` | ModuleScript `ServerScriptService.FoundryServer.Combat` |
| `src/client/Client.client.lua` | LocalScript `StarterPlayer.StarterPlayerScripts.FoundryClient.Client` |
| `src/client/Viewmodels.lua` | ModuleScript `StarterPlayer.StarterPlayerScripts.FoundryClient.Viewmodels` |
| `src/client/Effects.lua` | ModuleScript `StarterPlayer.StarterPlayerScripts.FoundryClient.Effects` |
| `src/client/Hud.lua` | ModuleScript `StarterPlayer.StarterPlayerScripts.FoundryClient.Hud` |
| `src/character/Health.server.lua` | Script `StarterPlayer.StarterCharacterScripts.Health` |

## Controls

| Action | Keyboard and mouse | Controller |
| --- | --- | --- |
| Fire / aim | Left / right mouse | RT / LT |
| Sprint | Shift | Click left stick |
| Crouch; slide while sprinting | C or Ctrl | B |
| Jump; mantle onto ledges | Space | A |
| Reload | R | X |
| Swap weapon | Q, 1, 2, mouse wheel | Y |
| Frag / stun grenade | G / T | RB / LB |
| Airstrike / auto-turret | Z / X | D-pad up / down |
| Mystery crate, overclock forge | E (hold near it) | D-pad left |
| Inspect weapon | F | Click right stick |
| Supplies between waves | B | D-pad right |
| Ready up for the next wave | Enter | |
| Menu during a run | M | Select / View |

## What's in it

**Runs and waves**
- Co-op: everyone in the server fights the same run. Waves grow with player count. The run ends when every deployed player is down at once. The first player to deploy picks the map and difficulty; later players join that run.
- 5 maps, each with its own lighting: Yard 9 (dusk freight yard), Kessler Works (foundry), Skyline Rooftops (night), Outpost Kharon (desert base) and Sublevel 4 (underground lab). Each map unlocks at a player level or a best wave.
- 3 difficulties. Hard pays 1.3x coins and XP.
- **Round multipliers**:
  - Every wave raises the score multiplier by 0.1x.
  - From wave 3, a round may roll a modifier (Armored, Overclocked, Swarm, Glass cannons, Blackout, Volatile, Gold rush, Elite squad) that pays up to 1.45x.
  - Chaining kills within 4 seconds builds a combo worth up to +2.0x. Taking damage halves the combo.
  - The HUD shows the total and each part.
- After each wave you pick 1 of 3 run buffs. Between waves you can buy ammo, armor, grenades and repairs, then ready up to start early.

**Enemies and bosses**
- 7 bot types:
  - **Grunt**
  - **Runner**: melee
  - **Drone**: flying
  - **Marksman**: a laser warns before it shoots
  - **Bomber**: shoot its core to detonate it early
  - **Juggernaut**: explosive orbs; weak back vent
  - **Bulwark**: its frontal shield blocks shots; aim at the head or flank it
- Headshots deal 2x damage (3x with the sniper). Weak points deal 2.5x. Limbs deal 0.8x. Damage numbers are colour-coded.
- Every fifth wave brings a boss with three phases and weak points:
  - **Titan-9**: cannon volleys, mortars, then ground stomps.
  - **Hive Mother**: launches drones, rains bolts, sweeps a laser, and exposes its eye in the final phase.
  - **Ironclad**: has a shield to break first, fires mortars, then rams.
- Bosses drop a rare reward: an attachment, a skin or a weapon.

**Weapons**
- 8 weapons with part-built viewmodels: pistol, SMG, assault rifle, burst rifle, pump shotgun, LMG, bolt-action sniper and a plasma rifle.
- Handling: recoil patterns you can learn, sway, bob, ADS, faster tactical reloads, shell-by-shell shotgun reloads, pump and bolt animations, and an inspect animation.
- 5 upgrade tracks per weapon.
- 5 attachments: a **red dot sight** (a real glass sight with a glowing dot), extended mag, silencer, grip and a laser that projects a beam.
- 7 skins.
- **Mystery crate** (950 coins): swaps the weapon in your hands for a random one for the rest of the run.
- **Overclock forge**: up to 3 tiers per weapon, each giving +45% damage, bigger mags and faster reloads.

**Other gameplay**
- Frag and stun grenades, and fuel drums that chain-react.
- Pickups: health, ammo, armor, and 10-second power-ups (double damage, overdrive, bottomless mag).
- Killstreaks: an airstrike at 10 kills and an auto-turret at 20.
- Movement: slide while sprinting, and mantle onto ledges.

**Progression (saved with DataStoreService)**
- Coins, XP and levels, with rewards at most levels.
- 16 quests and 3 daily challenges that rotate every UTC day.
- Your 5 best runs per map and difficulty, and a global top 10 (OrderedDataStore).
- Settings are saved too: sensitivity, aim sensitivity, controller look speed, FOV, crosshair style, colour and size, toggle aim, damage numbers, invert look, FPS counter, reduce motion and volume.

**Feel**
- Hit markers that change colour for headshots and kills, with a short hit-stop on headshot kills.
- Coin bursts that fly to the screen, a damage direction indicator and a radar minimap.
- Kill feed with multi-kill callouts, boss bar and wave banners.
- Controller aim slowdown over targets.

**Server-authoritative**
- The server checks fire rate, ammo, grenades and killstreak counts, resolves all hits, and owns the economy. Clients can't give themselves damage, coins or ammo.

## Sounds and music
Roblox only plays audio from asset IDs. `Config.Sounds` starts out with built-in engine sounds that always load, so the game works out of the box. For better audio:
1. Find gunshot, explosion and laser sounds in the Creator Store (Toolbox → Audio).
2. Paste their IDs into `Config.Sounds`, for example `"rbxassetid://1234567890"`.

## Tuning
- All weapon, enemy, boss, buff, modifier, quest and economy numbers are in `src/shared/Config.lua`.
- Stat formulas (upgrades, multipliers, wave scaling) are in `src/shared/Stats.lua`, which both the server and the client use.

## Checking the code
The project type-checks cleanly with [luau-lsp](https://github.com/JohnnyMorganz/luau-lsp) against the Roblox API definitions. You need a sourcemap from `rojo sourcemap default.project.json -o sourcemap.json` first.
