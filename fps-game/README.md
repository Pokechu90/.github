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

Every enemy has a head hitbox. Enemies gain health, speed, damage and numbers each wave.

**Enemy factions change every 10 waves**, then the cycle repeats and gets harder:
| Waves | Faction | Troops (same seven roles as the robots) | Bosses |
| --- | --- | --- | --- |
| 1–10, 31–40 … | Machine legion | The seven robots above | Titan-9, Hive Mother, Ironclad |
| 11–20, 41–50 … | Goblin warband | Goblin Archers (arcing arrows), Cutthroats (twin daggers), Fire Bats (fireballs), Crossbow Hunters, Powder Sappers (lit kegs; shoot the fuse), Cave Trolls (throw boulders), Shieldbearers (wooden shields, thrown knives) | **Goblin Elder** |
| 21–30, 51–60 … | Restless dead | Bone Archers, Ghouls, Wraiths, Deadeyes, Bloaters, Bone Colossi, Death Knights | **The Lich** |

Every faction has its own models, projectiles, sounds, hit effects and death effects. Arrows and thrown knives arc with gravity and stick in walls.
- **Goblin Elder**: dual-wields two curved blades.
  - Fights with two-hit slash combos and leap slams on a red ring.
  - From phase two, throws fans of daggers; in the final phase, spins in a berserk whirlwind.
  - Calls in his warband of cutthroats, archers and sappers.
  - A **Goblin Shaman** heals him with a green beam: kill it first. His glowing amulet is the weak point.
- **The Lich**: floats over the field and fires soul volleys.
  - Raises the dead around itself, with an **Acolyte** healer.
  - Blinks away when you get close; in the final phase, erupts grave novas under you. Its soul gem is the weak point.

**Halloween event: Night of Terror** (runs through October and the first week of November; add `?halloween` to the URL to force it on, or `?halloween=off` to hide it):
- A separate mode on the Play screen with night lighting, fog, jack-o'-lanterns, gravestones, dead trees, cobwebs and bat flocks.
- Its own monsters: skeleton archers firing bone arrows, zombies, vampire bats, ghosts, witches with hex bolts, pumpkin bombers, gravedigger brutes and coffin keepers whose lids block shots.
- **Dracula** is the boss every fifth wave. He claws you to heal himself, turns to mist and reappears behind you, drains your life with a beam, rains blood, and summons bats, zombies and a blood thrall that heals him.
- **Candy corn** is the event currency. Every monster drops it in Night of Terror, Dracula drops a pile, and the seven Trick-or-Treat quests pay it out.
- **28 Halloween skins**, three for every gun (pumpkin, bones, cobweb, candy corn, ghost, hex, blood moon, stitches, flames, gravestone and vampire patterns), bought with candy corn.
- **Skin Studio:** a 360° turntable from the main menu or the Armory. Drag to spin, scroll to zoom, preview any skin, then buy or equip it.
- **Reaper's Eye** (sniper) comes from the Reaper's Contract quest line: harvest 350 souls, take 50 headshots, reach wave 10 and defeat Dracula, all in Night of Terror. It has a built-in Soulglass scope and **Fever**: each kill within 5 seconds of the last adds +12% damage (up to 10 stacks) and refunds a round. The streak resets if 5 seconds pass without a kill.
- **Vampire's Fang** (shotgun) drops from Dracula, about 1 in 3, guaranteed by your third win. It has a built-in holo sight, **lifesteal** (heals 12% of damage dealt) and Thirst (+25% damage below half health).

**Pathfinding.** Each map gets a navigation grid built when it loads, and a flow field toward the player is updated a few frames at a time. Every walking enemy climbs stairs and steps, drops off ledges and detours around long obstacles to reach you on raised floors.

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

**Eight weapons.** Warden P9 pistol, Wasp MX SMG, Vanguard KR7 assault rifle, Triad B3 burst rifle, Breaker 12 shotgun, Anvil HX LMG, Longreach R2 sniper, and Helion PX plasma rifle. Each has its own sound and a five-stat upgrade tree. Attachments are the red dot, extended magazine, silencer, grip and laser sight.

**Realistic gun models.** Every gun is modelled on a real design: bevelled parts, Picatinny rails with teeth, trigger guards, protected iron sights and rear apertures, ejection ports with the bolt showing, flash hiders and ported brakes, screws and pins, stippled grips, fluted barrels, a scope with turrets, a translucent magazine with rounds inside, a side saddle of shells and a linked ammo belt. Metal has a brushed, machined finish and reflects a soft studio light; polymer is stippled; furniture shows wood grain. Aiming puts your eye at a real cheek weld behind the rear sight.

**Skins.** Seven standard finishes (walnut Factory, desert camo, arctic splinter camo, anodized red with carbon fibre, glowing circuit traces, charred with ember cracks, and engraved gold) plus 28 Halloween skins. Patterns keep a real-world scale on every part, and glowing skins light up their patterns.

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

**Round multipliers.** Every kill's score is multiplied by a running total shown on the HUD:
- **Wave multiplier:** +0.1× per wave.
- **Round modifiers:** from wave 3, some rounds roll a risk such as Armored, Swarm, Blackout, Volatile or Elite squad, with a bigger reward multiplier (up to ×1.45). Gold rush doubles coins instead.
- **Combo:** each kill within 4 seconds of the last adds +0.1× (up to ×3). Taking a hit halves it.

Coins and XP get a smaller share of the same multipliers.

**Gunplay and feel** (from research into what makes shooters satisfying):
- Learnable per-weapon recoil patterns, driven by springs:
  - Each shot is an impulse, so the aim snaps up and settles smoothly instead of stepping.
  - Most recoil springs back, and 30% stays for you to pull down.
  - A separate camera punch adds weight without affecting where bullets go.
- The viewmodel kicks back and rises with a slight overshoot. It lags behind your turns, leans into strafes, floats on jumps and dips on landing.
- After a long burst, smoke drifts from the hot barrel.
- Bots flinch and get knocked back; headshot kills pop the head off; a short hit-stop lands on headshot and boss kills.
- Tactical reloads (with ammo left) are 20% faster than empty reloads.
- Mantle up ledges.
- Inspect your weapon.

**Mystery crate and Overclock forge.** Every map has a mystery crate: 950 coins rolls a random weapon (including locked ones) for the rest of the run. The forge overclocks your current gun up to three tiers (+45% damage and +25% magazine per tier) with a glowing finish.

**Daily challenges and leaderboards.** Three new challenges every day, and a personal top-5 for each map and difficulty.

**Smoothness.** Static map geometry is merged (about half the draw calls), robot shadow casters and lights are trimmed, dynamic resolution keeps the frame rate up on slower GPUs, and there's an optional FPS counter.

**Controller support** with aim slowdown over targets, plus settings for aiming sensitivity, toggle aim, and crosshair style, color and size.

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
| E | Use the mystery crate or overclock forge |
| I | Inspect weapon |
| Space at a ledge | Mantle |
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
| `js/gunparts.js` | Gunsmith kit: bevelled parts, rails, sights, triggers, muzzle devices, surfaces, reflections, mesh merging |
| `js/weapons.js` | Weapons, attachments, skins, upgrades, viewmodels |
| `js/progression.js` | XP and levels, quests, buffs, coins |
| `js/nav.js` | Navigation grid and flow-field pathfinding |
| `js/enemies.js` | Robot types, shared enemy AI and the robot bosses |
| `js/factions.js` | Goblin and undead troops, their models and projectiles, the Goblin Elder and the Lich, faction rotation |
| `js/halloween.js` | Night of Terror: monsters, Dracula, candy corn, quests, Reaper's Contract, Fever and lifesteal, map dressing |
| `js/studio.js` | Skin Studio 360° weapon viewer |
| `js/combat.js` | Projectiles, explosions, grenades, pickups, rewards, killstreaks |
| `js/ui.js` | HUD and menu screens |
| `js/game.js` | Player, weapon handling, waves, states, input, main loop |
