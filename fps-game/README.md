# Foundry Breach (web)

A first-person wave shooter that runs in the browser. It's a single HTML file that loads Three.js from a CDN.

**Play:** open `index.html` in a desktop browser (Chrome, Edge or Firefox). Click **Deploy**, then click the game to capture the mouse.

## What's in it
- **Four weapons** with their own viewmodels, recoil, ADS and reload animations: Warden P9 pistol, Vanguard KR7 assault rifle, Breaker 12 pump shotgun (shell-by-shell reload), and Longreach R2 marksman rifle with a scope overlay.
- **Frag grenades** that bounce, plus **explosive fuel drums** that chain-react.
- **Three enemy types**: Grunts that strafe and shoot telegraphed plasma bolts, Hounds that rush you for melee, and Wardens that fire 3-round bursts and explode on death.
- **Endless waves** with rising difficulty, resupply between waves, and health, ammo and armor drops.
- **Effects**: muzzle flashes, tracers, sparks, smoke, bullet-hole decals, scorch marks, shockwaves, camera shake, and bots that break apart into physics debris.
- **Sound**: every effect is synthesized live with the Web Audio API (layered gunshots, reverb, 3D panning, reload clicks, shell casings, footsteps, heartbeat at low health).
- **HUD**: health and armor, ammo, weapon slots, dynamic crosshair, hitmarkers, damage-direction indicators, a rotating minimap, kill feed, streak multipliers, and wave banners.
- **Menus**: title screen, settings (sensitivity, FOV, volume, shadows, invert Y), controls, pause, and a game-over screen with stats and your best score.

## Controls
| Key | Action |
| --- | --- |
| WASD | Move |
| Mouse | Look |
| Left click / Right click | Fire / Aim down sights |
| R | Reload |
| Shift / Space / C | Sprint / Jump / Crouch |
| 1–4, mouse wheel, Q | Switch weapon, previous weapon |
| G | Throw a frag grenade |
| Esc | Pause |
