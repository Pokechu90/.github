# Foundry Breach (web)

A wave-survival first-person shooter that runs in the browser. It uses plain HTML and JavaScript with Three.js loaded from a CDN, so there's no build step.

**Play:** serve this folder (for example `npx serve fps-game`) or open `index.html` directly in a desktop browser. Click **Play**, pick a map and difficulty, then click the game to capture the mouse.

## Features

**Economy and shop.** Robots drop coins: stronger bots drop more, and bosses drop a large reward. You also earn bonus coins for headshots, multi-kills and flawless waves. Between waves you can open the shop (**B**) to buy ammo, repairs, armor, grenades and killstreak call-ins. You can also spend coins on weapons, attachments and the upgrade tree, from the shop or the main menu.

**Seven robot types**, introduced gradually:
| Type | Arrives | Behaviour |
| --- | --- | --- |
| Grunt | Wave 1 | Strafes and fires telegraphed bolts |
| Runner | Wave 2 | Fast melee rusher |
| Drone | Wave 3 | Flies erratically; small hitbox |
| Marksman | Wave 4 | Stays at range; red laser warns before its accurate shot |
| Bomber | Wave 5 | Runs at you and self-destructs; shoot its core to detonate it early |
| Juggernaut | Wave 6 | Slow, very tough, fires explosive orbs |
| Bulwark | Wave 7 | Energy shield blocks frontal fire; hit the head or flank to reach its back cell |

Every bot has a head hitbox. Enemies gain health, speed, damage and numbers each wave.

**Bosses every fifth wave**, each with a health bar, three phases (at 50% and 25% health) and weak points:
- **Titan-9** siege mech. Cannon volleys, then missile barrages, then a ground stomp. Weak point: its chest reactor.
- **Hive Mother** drone carrier. Launches drones, then drop pods and a sweeping laser, then descends. Weak point: the eye underneath.
- **Ironclad** shielded tank. Its regenerating dome blocks shots from outside (grenades hurt it 3×), then it fires mortars, then it rams you. Weak points: its rear vents.

Every boss kill pays a big coin reward and a guaranteed rare drop (an attachment, skin or weapon).

**Wave buffs.** After each wave you pick 1 of 3 random buffs, from 12 kinds. They stack for the whole run and show as icons on the HUD.

**Headshots** deal 2× damage (3× with the Longreach sniper). They get their own hit marker, sound and amber damage number. Headshots and accuracy are tracked on the end-of-run screen.

**Red dot sight.** Any gun can fit one. It's a see-through glass sight with a glowing dot and no zoom, and it cuts spread and recoil while aiming. Unlock it by buying it or through quests. Toggle it in the loadout or in-game with **T**.

**Quests.** 16 challenges that pay out coins, attachments, weapons and skins, with progress bars and pop-up notifications.

**Five maps.** Yard 9 (dusk freight terminal), Kessler Works (abandoned foundry), Skyline Rooftops (neon night), Outpost Kharon (desert base) and Sublevel 4 (underground lab). New maps unlock by player level or by best wave reached.

**Levels and saving.** You earn XP from kills, headshots, waves and quests. Levels unlock weapons, skins and coins. Level, coins and unlocks are saved in the browser.

**Eight weapons.** Warden P9 pistol, Wasp MX SMG, Vanguard KR7 assault rifle, Triad B3 burst rifle, Breaker 12 shotgun, Anvil HX LMG, Longreach R2 sniper, and Helion PX plasma rifle. Each has its own sound and a five-stat upgrade tree. Attachments are the red dot, extended magazine, silencer, grip and laser sight. There are seven skins.

**Extras:**
- Frag and stun grenades
- Sprint, crouch and slide
- Health, ammo and armor pickups
- Power-ups: double damage, speed boost, infinite ammo
- Killstreaks: an airstrike at 10 kills and an auto-turret at 20
- Floating damage numbers, minimap, kill feed, screen shake
- Synthesized sound effects and procedural music

**Menus:**
- Play (map and difficulty: Easy, Normal or Hard)
- Loadout
- Shop
- Quests
- Settings: sensitivity, FOV, master and music volume, graphics quality, damage numbers, invert Y
- Pause
- Game over, with wave, kills, headshots, accuracy, coins, XP and level progress

## Controls
| Key | Action |
| --- | --- |
| WASD / Mouse | Move / look |
| Left / right click | Fire / aim down sights |
| R | Reload |
| Shift / Space / C | Sprint / jump / crouch (slide while sprinting) |
| 1, 2, wheel, Q | Switch weapon |
| G / F | Frag / stun grenade |
| Z / X | Airstrike / auto-turret (when earned) |
| T | Toggle red dot |
| B / Enter | Between waves: shop / start next wave |
| Esc | Pause |

## Code layout
| File | Contents |
| --- | --- |
| `index.html` | Markup and styles for the HUD and all menus |
| `js/core.js` | Helpers, settings, difficulty, saved profile |
| `js/audio.js` | Synthesized sound effects and music sequencer |
| `js/render.js` | Renderer, textures, particles, decals, collision, damage numbers |
| `js/maps.js` | The five maps and their lighting |
| `js/weapons.js` | Weapons, attachments, skins, upgrades, viewmodels |
| `js/progression.js` | XP and levels, quests, buffs, coins |
| `js/enemies.js` | Robot types and bosses |
| `js/combat.js` | Projectiles, explosions, grenades, pickups, rewards, killstreaks |
| `js/ui.js` | HUD and menu screens |
| `js/game.js` | Player, weapon handling, waves, states, input, main loop |
