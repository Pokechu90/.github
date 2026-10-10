'use strict';
// Weapons, attachments, skins, upgrade tree and first-person viewmodels.

const WEAPONS = [
  { id: 'pistol', name: 'Warden P9', short: 'P9', cls: 'Sidearm', mode: 'SEMI', fire: 'semi', dmg: 30, rpm: 420, mag: 12, reserve: 120, reload: 1.2, spread: 0.014, adsSpread: 0.004, recoil: 0.014, kick: 0.045, range: 120, head: 2, pellets: 1, zoom: 0.82, adsSpeed: 12, move: 1.04, price: 0, level: 1, upCost: 60, sound: 'pistol', flash: 0.2 },
  { id: 'smg', name: 'Wasp MX', short: 'MX', cls: 'Submachine gun', mode: 'AUTO', fire: 'auto', dmg: 15, rpm: 900, mag: 32, reserve: 288, reload: 1.7, spread: 0.03, adsSpread: 0.012, recoil: 0.0065, kick: 0.022, range: 90, falloff: [22, 40], head: 2, pellets: 1, zoom: 0.8, adsSpeed: 13, move: 1.05, price: 0, level: 1, upCost: 80, sound: 'smg', flash: 0.22 },
  { id: 'rifle', name: 'Vanguard KR7', short: 'KR7', cls: 'Assault rifle', mode: 'AUTO', fire: 'auto', dmg: 24, rpm: 660, mag: 30, reserve: 240, reload: 2.1, spread: 0.022, adsSpread: 0.005, recoil: 0.011, kick: 0.03, range: 170, head: 2, pellets: 1, zoom: 0.72, adsSpeed: 9, move: 1, price: 0, level: 1, upCost: 100, sound: 'rifle', flash: 0.28 },
  { id: 'burst', name: 'Triad B3', short: 'B3', cls: 'Burst rifle', mode: 'BURST', fire: 'burst', burstCount: 3, burstDelay: 0.34, dmg: 31, rpm: 1000, mag: 24, reserve: 216, reload: 2.0, spread: 0.016, adsSpread: 0.0035, recoil: 0.012, kick: 0.03, range: 200, head: 2, pellets: 1, zoom: 0.7, adsSpeed: 9, move: 1, price: 1500, level: 5, upCost: 110, sound: 'burst', flash: 0.26 },
  { id: 'shotgun', name: 'Breaker 12', short: 'B12', cls: 'Pump shotgun', mode: 'PUMP', fire: 'semi', pump: true, dmg: 13, rpm: 72, mag: 6, reserve: 42, reload: 0.5, shellReload: true, spread: 0.075, adsSpread: 0.055, recoil: 0.06, kick: 0.12, range: 50, falloff: [10, 34], head: 2, pellets: 10, zoom: 0.88, adsSpeed: 10, move: 1, price: 1200, level: 3, upCost: 100, sound: 'shotgun', flash: 0.42 },
  { id: 'lmg', name: 'Anvil HX', short: 'HX', cls: 'Light machine gun', mode: 'AUTO', fire: 'auto', dmg: 23, rpm: 600, mag: 80, reserve: 320, reload: 4.0, spread: 0.032, adsSpread: 0.01, recoil: 0.012, kick: 0.03, range: 160, head: 2, pellets: 1, zoom: 0.75, adsSpeed: 6, move: 0.88, price: 3000, level: 10, upCost: 140, sound: 'lmg', flash: 0.32 },
  { id: 'sniper', name: 'Longreach R2', short: 'R2', cls: 'Marksman rifle', mode: 'BOLT', fire: 'semi', bolt: true, dmg: 120, rpm: 48, mag: 5, reserve: 35, reload: 2.7, spread: 0.07, adsSpread: 0.0, recoil: 0.06, kick: 0.1, range: 400, head: 3, pellets: 1, zoom: 0.24, scope: true, adsSpeed: 6, move: 0.95, price: 2200, level: 7, upCost: 140, sound: 'sniper', flash: 0.5 },
  // Halloween event weapons: never sold, never rolled from crates. Each has a built-in sight and perks.
  { id: 'reaper', name: "Reaper's Eye", short: 'RE', cls: 'Halloween marksman rifle', mode: 'BOLT', fire: 'semi', bolt: true, dmg: 145, rpm: 62, mag: 6, reserve: 42, reload: 2.3, spread: 0.06, adsSpread: 0.0, recoil: 0.055, kick: 0.1, range: 450, head: 3, pellets: 1, zoom: 0.2, scope: true, adsSpeed: 7.5, move: 1, price: 0, level: 1, upCost: 160, sound: 'sniper', flash: 0.5, flashColor: 0x9aff6a, event: 'halloween', special: 'fever', defaultSkin: 'reaper_soul', how: "Halloween quest: The Reaper's Contract", recover: 150,
    perks: ['Soulglass scope built in: 5× zoom', 'Fever: each kill within 5 s of the last adds +12% damage (up to +120%). Five seconds without a kill and it resets', 'Soul harvest: kills put a round back in the magazine', 'Ghost bolt: 30% faster bolt cycle'] },
  { id: 'fang', name: "Vampire's Fang", short: 'VF', cls: 'Halloween combat shotgun', mode: 'SEMI', fire: 'semi', dmg: 15, rpm: 150, mag: 8, reserve: 56, reload: 0.42, shellReload: true, spread: 0.06, adsSpread: 0.035, recoil: 0.05, kick: 0.11, range: 60, falloff: [12, 40], head: 2, pellets: 9, zoom: 0.8, adsSpeed: 11, move: 1.02, price: 0, level: 1, upCost: 160, sound: 'shotgun', flash: 0.45, flashColor: 0xff3040, event: 'halloween', special: 'lifesteal', builtinSight: true, defaultSkin: 'fang_blood', how: 'Rare drop from Dracula (Night of Terror)',
    perks: ['Bloodglass holo sight built in', 'Lifesteal: heals you for 12% of the damage it deals', 'Semi-automatic: no pump between shots', 'Thirst: +25% damage while you are below half health'] },
  { id: 'plasma', name: 'Helion PX', short: 'PX', cls: 'Plasma rifle', mode: 'AUTO', fire: 'auto', projectile: true, projSpeed: 78, splash: 2.4, dmg: 36, rpm: 360, mag: 40, reserve: 200, reload: 2.4, spread: 0.012, adsSpread: 0.004, recoil: 0.01, kick: 0.03, range: 160, head: 2, pellets: 1, zoom: 0.78, adsSpeed: 9, move: 1, price: 5000, level: 14, upCost: 170, sound: 'plasma', flash: 0.34, flashColor: 0x6cf6ff },
];
const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map(w => [w.id, w]));

const ATTACHMENTS = {
  reddot: { name: 'Red dot sight', short: 'RDS', price: 350, desc: 'See-through glass sight with a glowing dot. No zoom. Aiming: −25% spread, −15% recoil.' },
  extmag: { name: 'Extended magazine', short: 'EXT', price: 450, desc: '+40% magazine size.' },
  silencer: { name: 'Silencer', short: 'SIL', price: 400, desc: 'Quiet shots and a small flash. Bots take longer to lock on. −5% damage.' },
  grip: { name: 'Vertical grip', short: 'GRIP', price: 300, desc: '−25% recoil.' },
  laser: { name: 'Laser sight', short: 'LSR', price: 300, desc: '−35% hip-fire spread. Projects a visible beam.' },
};
const ATT_IDS = Object.keys(ATTACHMENTS);

const SKINS = {
  stock: { name: 'Factory', metal: 0x2b3036, poly: 0x1b1e21, alt: 0x6a4428, accent: 0xc0862c, altPattern: 'wood', how: 'Default' },
  desert: { name: 'Dune', metal: 0x5e4a32, poly: 0x9a8058, alt: 0xb89a6a, accent: 0x6a5434, pattern: 'camo_desert', how: 'Reach level 4' },
  arctic: { name: 'Glacier', metal: 0x8e98a2, poly: 0xe9eef2, alt: 0xc8d2da, accent: 0x6aa8d8, pattern: 'camo_snow', how: 'Quest: Big spender' },
  crimson: { name: 'Crimson', metal: 0x8a1a1e, poly: 0x1c0c0e, alt: 0x241012, accent: 0xff3a3a, pattern: 'carbon', anodized: true, gloss: true, how: 'Quest: Veteran' },
  circuit: { name: 'Circuit', metal: 0x0c1618, poly: 0x0f2226, alt: 0x12303a, accent: 0x2affd5, glow: true, pattern: 'circuit', how: 'Quest: Sharpshooter' },
  scorch: { name: 'Scorch', metal: 0x2a2a2a, poly: 0x3a2a20, alt: 0x4a3020, accent: 0xff7a2e, glow: true, pattern: 'scorch', how: 'Boss drop' },
  gold: { name: 'Gilded', metal: 0xd4a93a, poly: 0x1b1e21, alt: 0xc9a03a, accent: 0xfff0b0, shiny: true, metalPattern: 'engrave', altPattern: 'engrave', how: 'Quest: Untouchable or level 20' },
};
// Halloween skins: three per gun, bought with candy corn in the Skin Studio. A pattern is painted onto
// the polymer and furniture parts; glow skins light up their accents.
const H_SKINS = {
  pistol: [['pistol_jack', "Jack's Grin", 'pumpkin', 0x2a1a0e, 0xe8761c, 0x1a120a, 0xffb040, 1, 180], ['pistol_bones', 'Bone Rattler', 'bones', 0x1c1c1e, 0x161618, 0xd8d0b8, 0xf0ead8, 0, 160], ['pistol_hex', 'Nightshade', 'hex', 0x1a1024, 0x3a1a5a, 0x2a1840, 0xb060ff, 1, 200]],
  smg: [['smg_candy', 'Candy Corn Chaos', 'candycorn', 0xf0f0e0, 0xffc020, 0xff7a1a, 0xfff6d0, 0, 180], ['smg_ecto', 'Ectoplasm', 'ghost', 0x0c2228, 0x1a5a5a, 0x10343a, 0x5dffd8, 1, 220], ['smg_web', 'Arachnid', 'web', 0x111114, 0x1a1a1e, 0x26262c, 0xd8d8e0, 0, 160]],
  rifle: [['rifle_moon', 'Blood Moon', 'moon', 0x180c14, 0x2a1020, 0x3a1622, 0xff4a2a, 1, 260], ['rifle_king', 'Pumpkin King', 'pumpkin', 0x1a120a, 0xd8661a, 0x2a1a0e, 0xffa030, 1, 240], ['rifle_grave', 'Graverobber', 'grave', 0x3a3c3a, 0x5a5e58, 0x4a4e48, 0x7aff6a, 0, 200]],
  burst: [['burst_hex', 'Hex Triad', 'hex', 0x140c1e, 0x2e1450, 0x241038, 0x9a5aff, 1, 220], ['burst_stitch', 'Stitched', 'stitch', 0x2a3424, 0x6a8a5a, 0x3a4a30, 0xb0ff60, 1, 220], ['burst_vamp', 'Nosferatu', 'vampire', 0x120808, 0x1a0a0c, 0x5a0e16, 0xff2a3a, 0, 240]],
  shotgun: [['shotgun_bones', 'Boneshaker', 'bones', 0x161618, 0x121214, 0xe0d8c0, 0xfff4e0, 0, 180], ['shotgun_brew', "Witch's Brew", 'flames', 0x160c20, 0x241034, 0x2a3a14, 0x8aff3a, 1, 240], ['shotgun_patch', 'Pumpkin Patch', 'pumpkin', 0x2a1a0e, 0xe8781e, 0x3a5a1a, 0xffb040, 0, 200]],
  lmg: [['lmg_franken', 'Frankenstein', 'stitch', 0x26301e, 0x5a7a4a, 0x2e3a26, 0x9aff4a, 1, 260], ['lmg_phantom', 'Phantom', 'ghost', 0x0e1a22, 0x223a48, 0x18303c, 0xaaf0ff, 1, 260], ['lmg_hoard', 'Candy Hoard', 'candycorn', 0xf4f0e4, 0xffb81a, 0xff6a14, 0xffffff, 0, 220]],
  sniper: [['sniper_raven', "Raven's Watch", 'moon', 0x0c0c18, 0x161630, 0x22223e, 0xffd27a, 1, 280], ['sniper_widow', 'Widowmaker', 'web', 0x0e0e10, 0x141416, 0x5a0a12, 0xff2a3a, 0, 240], ['sniper_crypt', 'Crypt Keeper', 'grave', 0x34363a, 0x52565a, 0x404448, 0x9aff6a, 1, 240]],
  plasma: [['plasma_wisp', "Will-o'-Wisp", 'flames', 0x0a1a1e, 0x0e2a30, 0x103a3a, 0x5dffe0, 1, 300], ['plasma_count', "Count's Crest", 'vampire', 0x100608, 0x180a0c, 0x6a1018, 0xffc040, 0, 300], ['plasma_banshee', 'Banshee', 'ghost', 0x120c1e, 0x2a1a44, 0x1c1430, 0xd0a0ff, 1, 300]],
  reaper: [['reaper_wraith', 'Wraithbone', 'ghost', 0xd8d0b8, 0x26242a, 0x1a3a30, 0x5dffb0, 1, 320], ['reaper_ember', 'Hellreaper', 'flames', 0x161010, 0x2a0e08, 0x3a1608, 0xff7a1a, 1, 320]],
  fang: [['fang_night', 'Nightwalker', 'hex', 0x100c18, 0x2a1440, 0x1a1028, 0xc080ff, 1, 320], ['fang_moon', 'Crimson Moon', 'moon', 0x140808, 0x2a0a10, 0x3a0e16, 0xffd27a, 1, 320]],
};
for (const [gun, list] of Object.entries(H_SKINS)) for (const [k, name, pattern, metal, poly, alt, accent, glow, price] of list)
  SKINS[k] = { name, metal, poly, alt, accent, glow: !!glow, pattern, only: gun, candy: price, event: 'halloween', how: `Skin Studio · ${price} candy corn` };
// signature finishes that come with the event guns
SKINS.reaper_soul = { name: 'Soulreaper', metal: 0x14161a, poly: 0x0c0d10, alt: 0xd8d0b8, accent: 0x9aff6a, glow: true, pattern: 'bones', only: 'reaper', how: 'Comes with the weapon' };
SKINS.fang_blood = { name: 'First Blood', metal: 0x1a0a0c, poly: 0x5a0a12, alt: 0x0e0708, accent: 0xff2a3a, glow: true, pattern: 'vampire', only: 'fang', how: 'Comes with the weapon' };

const UPGRADES = {
  damage: { name: 'Damage', per: 0.08, desc: '+8% damage per level' },
  rate: { name: 'Fire rate', per: 0.06, desc: '+6% fire rate per level' },
  reload: { name: 'Reload speed', per: 0.08, desc: '−8% reload time per level' },
  mag: { name: 'Magazine', per: 0.1, desc: '+10% magazine size per level' },
  accuracy: { name: 'Accuracy', per: 0.1, desc: '−10% spread per level' },
};
const UP_MAX = 5;
function upgradeLevel(id, stat) { return (profile.upgrades[id] && profile.upgrades[id][stat]) || 0; }
function upgradeCost(id, stat) { const lvl = upgradeLevel(id, stat); return Math.round(WEAPON_BY_ID[id].upCost * (lvl + 1) * (1 + lvl * 0.35) / 10) * 10; }
function weaponOwned(id) { return !!profile.weapons[id]; }
function attOwned(id, a) { return !!(profile.attachments[id] && profile.attachments[id][a]); }
function attOn(id, a) { return attOwned(id, a) && !!(profile.equipped[id] && profile.equipped[id][a]); }
function setAtt(id, a, on) { (profile.equipped[id] || (profile.equipped[id] = {}))[a] = !!on; saveProfile(); refreshViewmodel(id); }
function grantAtt(id, a, equip = true) { (profile.attachments[id] || (profile.attachments[id] = {}))[a] = true; if (equip) (profile.equipped[id] || (profile.equipped[id] = {}))[a] = true; saveProfile(); refreshViewmodel(id); }
function skinFits(k, id) { const s = SKINS[k]; return !!s && (!s.only || s.only === id); }
function skinOwned(k) { const s = SKINS[k]; return !!s && (!!profile.skins[k] || (s.only && WEAPON_BY_ID[s.only] && WEAPON_BY_ID[s.only].defaultSkin === k && weaponOwned(s.only))); }
function weaponSkin(id) { const s = profile.skin[id]; if (s && skinOwned(s) && skinFits(s, id)) return s; const d = WEAPON_BY_ID[id] && WEAPON_BY_ID[id].defaultSkin; return d || 'stock'; }

// effective stats before run buffs
function weaponStats(id) {
  const w = WEAPON_BY_ID[id], up = k => upgradeLevel(id, k);
  const s = Object.assign({}, w);
  s.dmg = w.dmg * (1 + UPGRADES.damage.per * up('damage')) * (attOn(id, 'silencer') ? 0.95 : 1);
  s.rpm = w.rpm * (1 + UPGRADES.rate.per * up('rate'));
  if (w.burstDelay) s.burstDelay = w.burstDelay / (1 + UPGRADES.rate.per * up('rate'));
  s.reload = w.reload * (1 - UPGRADES.reload.per * up('reload'));
  s.mag = Math.round(w.mag * (1 + UPGRADES.mag.per * up('mag')) * (attOn(id, 'extmag') ? 1.4 : 1));
  const acc = 1 - UPGRADES.accuracy.per * up('accuracy');
  s.spread = w.spread * acc * (attOn(id, 'laser') ? 0.65 : 1);
  s.adsSpread = w.adsSpread * acc * (attOn(id, 'reddot') ? 0.75 : 1);
  s.recoil = w.recoil * (attOn(id, 'grip') ? 0.75 : 1);
  s.adsRecoil = attOn(id, 'reddot') ? 0.85 : 1;
  s.reddot = attOn(id, 'reddot') || !!w.builtinSight; s.silenced = attOn(id, 'silencer'); s.laser = attOn(id, 'laser');
  if (w.builtinSight) s.adsSpread *= 0.85;
  if (w.special === 'fever') s.rpm *= 1.3;
  s.scope = w.scope && !s.reddot; s.zoom = w.scope && s.reddot ? 0.8 : w.zoom;
  return s;
}

// ---------------- viewmodels ----------------
vmScene.add(new THREE.HemisphereLight(0x9fb2d8, 0x2a2018, 0.9));
const vmSun = new THREE.DirectionalLight(0xffc090, 1.6); vmSun.position.set(-1, 2, 1); vmScene.add(vmSun);
const vmFlashLight = new THREE.PointLight(0xffb060, 0, 2, 2); vmFlashLight.position.set(0.1, -0.05, -0.7); vmScene.add(vmFlashLight);
const VMS_MAT = {
  glove: new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 0.9 }),
  sleeve: new THREE.MeshStandardMaterial({ color: 0x1a1e17, roughness: 0.95, side: THREE.DoubleSide }),
  lens: new THREE.MeshStandardMaterial({ color: 0x3a7ab0, roughness: 0.05, metalness: 0.9, emissive: 0x0a2040, transparent: true, opacity: 0.16, depthWrite: false }),
  glass: new THREE.MeshBasicMaterial({ color: 0x9ad4ff, transparent: true, opacity: 0.12, depthWrite: false }),
  dot: new THREE.MeshBasicMaterial({ color: 0xff2a1a }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc8a040, roughness: 0.3, metalness: 1 }),
  laser: new THREE.MeshBasicMaterial({ color: 0xff2a1a }),
  cyan: new THREE.MeshBasicMaterial({ color: 0x6cf6ff }),
};
Object.values(VMS_MAT).forEach(m => m.color.convertSRGBToLinear());
const dotTex = (() => { const [c, g] = cv(64, 64); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,80,60,1)'); gr.addColorStop(0.45, 'rgba(255,30,20,.35)'); gr.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return tex(c, 1, 1, false); })();
const flashTex = tex(T.flash, 1, 1, false);
const vmRoot = new THREE.Group(); vmScene.add(vmRoot);
vmScene.environment = makeGunEnv(renderer);

function newGun(w) {
  const g = new THREE.Group();
  const mats = {
    metal: new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0.85, envMapIntensity: 0.9 }),
    poly: new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.05, envMapIntensity: 0.6 }),
    alt: new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.05, envMapIntensity: 0.6 }),
    accent: new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 }),
  };
  gunSurfaces(mats);
  const body = new THREE.Group(); g.add(body);
  return { g, mats, w, parts: {}, body };
}
// legacy helpers kept for simple props elsewhere
function bx(p, w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); p.add(m); return m; }
function cy(p, r, len, mat, x, y, z, r2 = r, seg = 16) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, len, seg), mat); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); p.add(m); return m; }
// common attachment points: rail (x,y,z) for the red dot; under (z) for grip/laser; muzzle (y,z)
function finishGun(gun, o) {
  const { g, mats } = gun, K = GP_MAT;
  Object.assign(gun, o);
  gun.muzzle = new THREE.Object3D(); gun.muzzle.position.set(0, o.muzzleY, o.muzzleZ); g.add(gun.muzzle);
  gun.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: gun.w.flashColor || 0xffffff })); gun.flash.visible = false; gun.muzzle.add(gun.flash);
  // reflex sight: clamp mount, open hood with a tinted lens, adjustment turrets and a battery cap
  const rd = new THREE.Group(); rd.position.set(0, o.rail[1], o.rail[2]); g.add(rd);
  rb(rd, 0.03, 0.006, 0.05, mats.metal, 0, 0.003, 0, 0.0015);
  rb(rd, 0.006, 0.006, 0.04, K.blued, 0.017, 0.002, 0, 0.0015); cylX(rd, 0.003, 0.004, K.steel, 0.021, 0.002, 0.008);
  for (const s of [-1, 1]) rb(rd, 0.0045, 0.036, 0.016, mats.metal, s * 0.0185, 0.022, -0.016, 0.0015);
  rb(rd, 0.041, 0.005, 0.016, mats.metal, 0, 0.0405, -0.016, 0.0018);
  rb(rd, 0.03, 0.01, 0.022, mats.metal, 0, 0.011, 0.012, 0.003);
  cylY(rd, 0.004, 0.006, K.knurl, 0, 0.018, 0.014); cylX(rd, 0.004, 0.006, K.knurl, 0.017, 0.011, 0.012);
  rb(rd, 0.004, 0.006, 0.008, mats.accent, -0.017, 0.011, 0.014, 0.0015);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.032, 0.031), VMS_MAT.glass); glass.position.set(0, 0.022, -0.02); rd.add(glass);
  const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true })); dot.scale.set(0.0045, 0.0045, 1); dot.position.set(0, 0.022, -0.021); dot.renderOrder = 10; rd.add(dot);
  gun.reddot = rd; gun.rdY = o.rail[1] + 0.022;
  // suppressor: threaded collar, tapered can with a knurled band, end cap
  const sil = new THREE.Group(); sil.position.set(0, o.muzzleY, o.muzzleZ); g.add(sil);
  lathe(sil, [[0.012, 0.004], [0.016, -0.004], [0.022, -0.012], [0.022, -0.155], [0.019, -0.168], [0.009, -0.17]], mats.poly, 0, 0, 0);
  cyl(sil, 0.0225, 0.02, K.knurl, 0, 0, -0.03); bore(sil, 0.006, 0, 0, -0.17);
  gun.silencer = sil;
  // vertical foregrip with finger grooves and a rail clamp
  const grip = new THREE.Group(); grip.position.set(0, o.underY, o.underZ); g.add(grip);
  rb(grip, 0.028, 0.008, 0.05, mats.metal, 0, -0.001, 0, 0.002);
  rb(grip, 0.027, 0.075, 0.032, mats.poly, 0, -0.042, 0, 0.011);
  for (let i = 0; i < 3; i++) rb(grip, 0.0275, 0.006, 0.006, mats.poly, 0, -0.022 - i * 0.017, -0.017, 0.003);
  rb(grip, 0.03, 0.006, 0.035, mats.accent, 0, -0.081, 0, 0.003);
  gun.grip = grip;
  // laser module: housing, emitter lens and pressure buttons
  const las = new THREE.Group(); las.position.set(0.034, o.underY + 0.02, o.underZ - 0.03); g.add(las);
  rb(las, 0.02, 0.024, 0.062, mats.metal, 0, 0, 0, 0.003);
  cyl(las, 0.005, 0.004, K.steel, 0, 0.004, -0.032); const lz = new THREE.Mesh(new THREE.CircleGeometry(0.0035, 12), VMS_MAT.laser); lz.position.set(0, 0.004, -0.0345); lz.rotation.y = Math.PI; las.add(lz);
  cyl(las, 0.004, 0.004, K.dark, 0, -0.005, -0.032); rb(las, 0.004, 0.008, 0.012, mats.accent, 0.011, 0.002, 0.012, 0.0015);
  gun.laserMount = las;
  mergeGroup(gpHands(g, o.gripZ, o.foreZ, o.foreY));
  // remember rest positions of moving parts, then flatten every static group into a few meshes
  for (const k of ['slide', 'pump', 'bolt']) if (gun.parts[k]) gun.parts[k].userData.z0 = gun.parts[k].position.z;
  // parts within 12 cm of the aiming eye (the stock and buttpad) go to their own group, hidden while aimed
  const eyeZ = -o.adsZ - 0.12;
  if (eyeZ < 0.3) {
    gun.rear = new THREE.Group(); g.add(gun.rear);
    gun.body.children.slice().forEach(c => { const z = c.isMesh && c.geometry.boundingSphere ? c.position.z - c.geometry.boundingSphere.radius * 0.5 : c.position.z; if (z > eyeZ) gun.rear.add(c); });
    mergeGroup(gun.rear);
  }
  for (const grp_ of [gun.body, gun.scopeMesh, rd, sil, grip, las, ...Object.values(gun.parts)]) if (grp_ && grp_.isGroup) mergeGroup(grp_);
  g.children.filter(c => c.isGroup && !c.children.length).forEach(c => g.remove(c));
  g.visible = false; vmRoot.add(g);
  return gun;
}
const BUILDERS = {
  // Warden P9: polymer-frame striker pistol
  pistol(gun) {
    const { mats: M, body: b } = gun, K = GP_MAT;
    const sl = gun.parts.slide = grp(gun.g, 0, 0.018, -0.03);
    rb(sl, 0.029, 0.03, 0.19, M.metal, 0, 0, 0, 0.004);
    rb(sl, 0.019, 0.005, 0.17, M.metal, 0, 0.0145, 0, 0.002);
    grooves(sl, 8, 0.0298, 0.022, 0.0018, 0, -0.001, 0.058, 0.0042);
    grooves(sl, 5, 0.0298, 0.018, 0.0018, 0, -0.002, -0.084, 0.0042);
    rb(sl, 0.013, 0.004, 0.044, K.dark, 0.003, 0.0158, -0.008, 0.001);
    rb(sl, 0.0105, 0.004, 0.036, K.steel, 0.003, 0.0162, -0.009, 0.001);
    rb(sl, 0.0035, 0.007, 0.006, M.metal, 0, 0.0195, -0.085, 0.001); rb(sl, 0.0018, 0.0018, 0.001, K.tritium, 0, 0.021, -0.0818, 0.0003);
    for (const s of [-1, 1]) { rb(sl, 0.008, 0.008, 0.007, M.metal, s * 0.0058, 0.019, 0.082, 0.0012); rb(sl, 0.0018, 0.0018, 0.001, K.tritium, s * 0.0058, 0.0205, 0.0785, 0.0003); }
    cyl(sl, 0.0062, 0.004, K.steel, 0, -0.003, -0.096); bore(sl, 0.0045, 0, -0.003, -0.098);
    rb(sl, 0.004, 0.006, 0.01, M.accent, -0.0146, 0.004, 0.07, 0.0015);
    // frame
    rb(b, 0.027, 0.018, 0.13, M.poly, 0, -0.006, -0.062, 0.004);
    rb(b, 0.027, 0.018, 0.07, M.poly, 0, -0.006, 0.035, 0.004);
    const ur = grp(b, 0, -0.015, -0.09); ur.rotation.z = Math.PI; rail(ur, M.poly, 0.045, 0, 0, 0, 0.02);
    trigger(b, M, -0.015, -0.012, 0.062);
    const gr = grp(b, 0, -0.068, 0.047, -0.22);
    rb(gr, 0.029, 0.1, 0.047, M.poly, 0, 0, 0, 0.008);
    for (let i = 0; i < 3; i++) rb(gr, 0.0292, 0.007, 0.007, M.poly, 0, 0.026 - i * 0.022, -0.024, 0.0034);
    rb(gr, 0.026, 0.012, 0.022, M.poly, 0, 0.052, 0.024, 0.005);
    rb(gr, 0.0296, 0.012, 0.016, M.accent, 0, 0.012, 0.006, 0.003);
    rb(b, 0.003, 0.004, 0.024, M.metal, -0.0145, 0.002, -0.012, 0.0012);
    rb(b, 0.003, 0.0035, 0.009, M.metal, -0.0145, -0.005, -0.05, 0.0012);
    rb(b, 0.004, 0.009, 0.009, M.metal, -0.0148, -0.013, 0.013, 0.002);
    screw(b, -0.0137, -0.009, 0.026, 0.0022); screw(b, -0.0137, -0.009, -0.004, 0.0022);
    const mg = gun.parts.mag = grp(gun.g, 0, -0.125, 0.052, -0.22); gun.magY = -0.125;
    rb(mg, 0.024, 0.05, 0.04, M.metal, 0, 0.025, 0, 0.002);
    rb(mg, 0.031, 0.012, 0.05, M.poly, 0, -0.004, 0, 0.004);
    rb(mg, 0.032, 0.003, 0.051, M.accent, 0, -0.0105, 0, 0.001);
    return finishGun(gun, { sightY: 0.041, rail: [0, 0.036, 0.0], muzzleY: 0.02, muzzleZ: -0.135, underY: -0.03, underZ: -0.08, gripZ: 0.05, foreZ: 0.02, foreY: -0.04, hip: new V3(0.15, -0.15, -0.4), adsZ: -0.46 });
  },
  // Wasp MX: roller-delayed submachine gun with a collapsing stock
  smg(gun) {
    const { mats: M, body: b, g } = gun, K = GP_MAT;
    rb(b, 0.044, 0.056, 0.27, M.metal, 0, 0, -0.045, 0.005);
    rb(b, 0.0455, 0.006, 0.25, M.metal, 0, -0.012, -0.045, 0.002);
    rail(b, M.metal, 0.11, 0, 0.032, -0.03, 0.02);
    cyl(b, 0.011, 0.18, M.metal, 0, 0.022, -0.18);
    rearAperture(b, M.metal, 0.047, 0.07, 0.028);
    frontPost(b, M.metal, 0.047, -0.255, 0.033);
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.0105, 0.002, 8, 20, Math.PI), M.metal); hood.position.set(0, 0.044, -0.255); b.add(hood);
    rb(b, 0.05, 0.048, 0.13, M.poly, 0, -0.01, -0.235, 0.012);
    grooves(b, 4, 0.0506, 0.006, 0.022, 0, -0.008, -0.285, 0.03);
    cyl(b, 0.0085, 0.06, M.metal, 0, 0.004, -0.325);
    lathe(b, [[0.0085, 0], [0.011, -0.004], [0.011, -0.028], [0.009, -0.03]], M.metal, 0, 0.004, -0.34);
    for (let i = 0; i < 3; i++) { const lg = grp(b, 0, 0.004, -0.352); lg.rotation.z = i * 2.094; rb(lg, 0.005, 0.004, 0.012, M.metal, 0, 0.012, 0, 0.0012); }
    bore(b, 0.0045, 0, 0.004, -0.37);
    rot(rb(b, 0.024, 0.006, 0.007, M.metal, -0.02, 0.022, -0.205, 0.002), 0, 0.5, 0); rb(b, 0.011, 0.011, 0.011, M.poly, -0.031, 0.022, -0.2, 0.005);
    rb(b, 0.03, 0.03, 0.046, M.metal, 0, -0.04, -0.08, 0.004);
    rb(b, 0.002, 0.016, 0.04, K.dark, 0.0225, 0.008, -0.04, 0.0006);
    const mg = gun.parts.mag = grp(g, 0, -0.12, -0.08); gun.magY = -0.12;
    rb(mg, 0.024, 0.1, 0.036, M.poly, 0, 0.035, 0, 0.004);
    rot(rb(mg, 0.024, 0.09, 0.036, M.poly, 0, -0.052, 0.013, 0.004), 0.28);
    grooves(mg, 2, 0.0246, 0.07, 0.003, 0, 0.03, -0.006, 0.012);
    rot(rb(mg, 0.028, 0.008, 0.042, M.accent, 0, -0.097, 0.026, 0.002), 0.28);
    rb(b, 0.034, 0.03, 0.1, M.poly, 0, -0.04, 0.03, 0.006);
    trigger(b, M, -0.055, 0.008, 0.06);
    const gr = grp(b, 0, -0.1, 0.058, -0.25);
    rb(gr, 0.032, 0.085, 0.042, M.poly, 0, 0, 0, 0.009);
    for (let i = 0; i < 3; i++) rb(gr, 0.0322, 0.006, 0.006, M.poly, 0, 0.022 - i * 0.019, -0.021, 0.003);
    cylX(b, 0.0065, 0.004, M.metal, -0.018, -0.035, 0.05); rot(rb(b, 0.003, 0.016, 0.005, M.metal, -0.0205, -0.03, 0.05, 0.001), 0.6);
    rb(b, 0.0012, 0.003, 0.003, K.white, -0.0178, -0.026, 0.041, 0.0004); rb(b, 0.0012, 0.003, 0.003, M.accent, -0.0178, -0.042, 0.04, 0.0004);
    screw(b, -0.0222, -0.012, 0.075); screw(b, -0.0222, -0.012, -0.16); screw(b, -0.0172, -0.04, 0.0);
    for (const s of [-1, 1]) cyl(b, 0.006, 0.18, M.metal, s * 0.017, -0.004, 0.17);
    rb(b, 0.042, 0.042, 0.02, M.metal, 0, -0.005, 0.085, 0.004);
    rb(b, 0.046, 0.064, 0.012, M.poly, 0, -0.015, 0.252, 0.004); rb(b, 0.05, 0.068, 0.016, K.rubber, 0, -0.015, 0.265, 0.006);
    return finishGun(gun, { sightY: 0.047, rail: [0, 0.04, -0.03], muzzleY: 0.004, muzzleZ: -0.37, underY: -0.02, underZ: -0.22, gripZ: 0.05, foreZ: -0.08, foreY: -0.2, hip: new V3(0.15, -0.15, -0.42), adsZ: -0.24 });
  },
  // Vanguard KR7: direct-impingement carbine with a free-float handguard
  rifle(gun) {
    const { mats: M, body: b, g } = gun, K = GP_MAT;
    rb(b, 0.05, 0.05, 0.26, M.metal, 0, 0.015, -0.05, 0.005);              // upper receiver
    rail(b, M.metal, 0.24, 0, 0.039, -0.05, 0.022);
    rb(b, 0.046, 0.04, 0.2, M.metal, 0, -0.03, -0.04, 0.004);              // lower receiver
    rb(b, 0.044, 0.042, 0.075, M.metal, 0, -0.064, -0.1, 0.005);            // magwell
    rb(b, 0.047, 0.006, 0.08, M.metal, 0, -0.084, -0.1, 0.003);             // flared lip
    rb(b, 0.002, 0.017, 0.046, K.dark, 0.0252, 0.016, -0.02, 0.0006);       // ejection port
    rb(b, 0.0015, 0.011, 0.04, K.steel, 0.0258, 0.016, -0.02, 0.0005);      // bolt carrier in the port
    rot(rb(b, 0.002, 0.013, 0.05, M.metal, 0.03, -0.003, -0.02, 0.0007), 0, 0, 0.55); // dust cover hanging open
    rb(b, 0.008, 0.016, 0.014, M.metal, 0.028, 0.028, 0.026, 0.003);        // brass deflector
    cyl(b, 0.0065, 0.024, M.metal, 0.029, 0.026, 0.055); cyl(b, 0.008, 0.008, K.knurl, 0.029, 0.026, 0.069);
    rb(b, 0.03, 0.008, 0.02, M.metal, 0, 0.036, 0.09, 0.003); rb(b, 0.044, 0.006, 0.008, M.metal, 0, 0.036, 0.1, 0.0025); // charging handle
    rb(b, 0.003, 0.016, 0.01, M.metal, -0.0245, -0.026, -0.058, 0.0012);   // bolt catch
    rb(b, 0.004, 0.009, 0.009, M.metal, 0.0245, -0.04, -0.064, 0.002);     // mag release
    cylX(b, 0.0065, 0.003, M.metal, -0.0245, -0.022, 0.03); rot(rb(b, 0.003, 0.004, 0.02, M.metal, -0.0262, -0.022, 0.024, 0.0012), -0.4);
    rb(b, 0.0012, 0.003, 0.003, K.white, -0.0235, -0.012, 0.03, 0.0004); rb(b, 0.0012, 0.003, 0.003, M.accent, -0.0235, -0.03, 0.038, 0.0004);
    for (const z of [0.045, -0.13]) screw(b, -0.0235, -0.03, z, 0.003); screw(b, -0.0255, 0.0, 0.07, 0.0028);
    // handguard with M-LOK slots and a top rail
    rb(b, 0.054, 0.054, 0.3, M.poly, 0, 0.008, -0.33, 0.012);
    rail(b, M.metal, 0.29, 0, 0.035, -0.33, 0.021);
    grooves(b, 5, 0.0545, 0.008, 0.03, 0, -0.004, -0.44, 0.052);
    rb(b, 0.0548, 0.003, 0.27, M.accent, 0, 0.021, -0.33, 0.001);
    rb(b, 0.06, 0.06, 0.012, M.metal, 0, 0.008, -0.178, 0.005);             // barrel nut ring
    // barrel and flash hider
    cyl(b, 0.0085, 0.2, M.metal, 0, 0.005, -0.57);
    flashHider(b, M.metal, 0.011, 0.05, 0.005, -0.71);
    // folding sights
    rearAperture(b, M.metal, 0.062, 0.06, 0.047);
    frontPost(b, M.metal, 0.062, -0.455, 0.043);
    // grip, trigger and stock
    trigger(b, M, -0.05, -0.022, 0.075);
    const gr = grp(b, 0, -0.085, 0.058, -0.3);
    rb(gr, 0.034, 0.1, 0.044, M.poly, 0, 0, 0, 0.009);
    rb(gr, 0.0342, 0.012, 0.012, M.poly, 0, 0.03, -0.024, 0.005); rb(gr, 0.03, 0.012, 0.03, M.poly, 0, 0.05, 0.022, 0.006);
    cyl(b, 0.0155, 0.16, M.metal, 0, 0.002, 0.16); cyl(b, 0.017, 0.012, K.knurl, 0, 0.002, 0.09);
    rb(b, 0.045, 0.062, 0.15, M.poly, 0, -0.012, 0.245, 0.012);
    rb(b, 0.046, 0.024, 0.11, M.poly, 0, 0.024, 0.255, 0.008);
    rb(b, 0.012, 0.009, 0.06, M.poly, 0, -0.047, 0.2, 0.003);
    rb(b, 0.048, 0.1, 0.022, K.rubber, 0, -0.02, 0.33, 0.008);
    for (const z of [0.205, 0.23, 0.255, 0.28]) rb(b, 0.0455, 0.04, 0.004, K.dark, 0, -0.012, z, 0.0015);
    // curved 30-round magazine with the top round showing
    const mg = gun.parts.mag = grp(g, 0, -0.1, -0.1, 0.18); gun.magY = -0.1;
    rb(mg, 0.026, 0.09, 0.066, M.poly, 0, 0.01, 0, 0.005);
    rot(rb(mg, 0.026, 0.08, 0.064, M.poly, 0, -0.068, 0.012, 0.005), 0.22);
    for (const y of [0.03, -0.01, -0.05]) rb(mg, 0.0266, 0.004, 0.05, K.dark, 0, y, 0.004, 0.0012);
    rot(rb(mg, 0.03, 0.012, 0.072, M.accent, 0, -0.112, 0.022, 0.004), 0.22);
    cartridge(mg, 0, 0.058, 0, 0.9);
    return finishGun(gun, { sightY: 0.062, rail: [0, 0.047, -0.08], muzzleY: 0.005, muzzleZ: -0.7, underY: -0.035, underZ: -0.38, gripZ: 0.06, foreZ: -0.3, foreY: -0.03, hip: new V3(0.17, -0.18, -0.5), adsZ: -0.3 });
  },
  // Triad B3: bullpup burst rifle with a clear magazine
  burst(gun) {
    const { mats: M, body: b, g } = gun, K = GP_MAT;
    rb(b, 0.064, 0.085, 0.42, M.poly, 0, 0, 0.06, 0.02);
    rb(b, 0.058, 0.062, 0.1, M.poly, 0, 0.006, -0.19, 0.018);
    rb(b, 0.0655, 0.003, 0.4, M.accent, 0, -0.03, 0.06, 0.001);
    rb(b, 0.03, 0.03, 0.34, M.metal, 0, 0.056, -0.02, 0.006);
    rail(b, M.metal, 0.3, 0, 0.063, -0.02, 0.026);
    rearAperture(b, M.metal, 0.086, 0.09, 0.071);
    frontPost(b, M.metal, 0.086, -0.16, 0.071);
    // barrel, ribbed barrel nut and flash hider
    cyl(b, 0.012, 0.21, M.metal, 0, 0.012, -0.32);
    cyl(b, 0.019, 0.05, M.metal, 0, 0.012, -0.245);
    for (let i = 0; i < 8; i++) { const r = grp(b, 0, 0.012, -0.245); r.rotation.z = i * Math.PI / 4; rb(r, 0.005, 0.006, 0.046, M.metal, 0, 0.02, 0, 0.0015); }
    flashHider(b, M.metal, 0.013, 0.045, 0.012, -0.47);
    // full-hand trigger guard, grip and trigger
    rb(b, 0.03, 0.065, 0.012, M.poly, 0, -0.072, -0.12, 0.005);
    rb(b, 0.03, 0.012, 0.13, M.poly, 0, -0.108, -0.06, 0.005);
    const gr = grp(b, 0, -0.082, -0.05, -0.3);
    rb(gr, 0.034, 0.1, 0.044, M.poly, 0, 0, 0, 0.01);
    for (let i = 0; i < 3; i++) rb(gr, 0.0342, 0.006, 0.006, M.poly, 0, 0.025 - i * 0.02, -0.023, 0.003);
    for (let i = 0; i < 5; i++) rot(rb(b, 0.0055, 0.0085, 0.0045, K.blued, 0, -0.049 - i * 0.0052, -0.088 - Math.pow(i, 1.5) * 0.0022, 0.0018), -0.2 - i * 0.16);
    cylX(b, 0.005, 0.07, K.blued, 0, -0.042, -0.02);
    rb(b, 0.012, 0.01, 0.026, M.metal, -0.02, 0.05, -0.12, 0.003);
    rb(b, 0.002, 0.022, 0.05, K.dark, 0.0325, 0.012, 0.13, 0.0008);
    for (const z of [0.0, 0.2]) screw(b, -0.0322, -0.012, z, 0.0034);
    rb(b, 0.066, 0.094, 0.022, K.rubber, 0, -0.004, 0.278, 0.01);
    rb(b, 0.04, 0.03, 0.12, M.poly, 0, 0.044, 0.2, 0.01);                     // cheek rest
    // translucent magazine behind the grip with rounds stacked inside
    const mg = gun.parts.mag = grp(g, 0, -0.1, 0.13); gun.magY = -0.1;
    const shell = rb(mg, 0.034, 0.12, 0.062, K.smoke, 0, 0, 0, 0.006); shell.renderOrder = 2;
    for (let i = 0; i < 7; i++) cartridge(mg, i % 2 ? 0.0055 : -0.0055, 0.05 - i * 0.012, 0.004, 0.85);
    rb(mg, 0.038, 0.012, 0.066, M.metal, 0, -0.064, 0, 0.004);
    return finishGun(gun, { sightY: 0.086, rail: [0, 0.071, -0.04], muzzleY: 0.012, muzzleZ: -0.47, underY: -0.045, underZ: -0.2, gripZ: -0.06, foreZ: -0.22, foreY: -0.04, hip: new V3(0.16, -0.18, -0.46), adsZ: -0.26 });
  },
  // Breaker 12: pump-action shotgun with a vent rib, wood furniture and a side saddle
  shotgun(gun) {
    const { mats: M, body: b, g } = gun, K = GP_MAT;
    rb(b, 0.05, 0.07, 0.2, M.metal, 0, 0.004, -0.02, 0.006);
    rb(b, 0.0505, 0.004, 0.18, K.dark, 0, -0.012, -0.02, 0.001);
    rb(b, 0.002, 0.024, 0.062, K.dark, 0.0252, 0.012, -0.04, 0.0008);
    cylX(b, 0.0085, 0.012, K.shell, 0.02, 0.012, -0.04); cylX(b, 0.0088, 0.004, K.brass, 0.026, 0.012, -0.04);
    rb(b, 0.03, 0.002, 0.06, K.dark, 0, -0.0312, -0.05, 0.0008);
    // barrel with a ventilated rib, beads and crown
    cyl(b, 0.012, 0.605, M.metal, 0, 0.018, -0.4125);
    rb(b, 0.009, 0.004, 0.58, M.metal, 0, 0.038, -0.42, 0.0015);
    for (let i = 0; i < 14; i++) rb(b, 0.006, 0.006, 0.006, M.metal, 0, 0.033, -0.15 - i * 0.04, 0.001);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.003, 10, 8), M.accent); bead.position.set(0, 0.042, -0.7); b.add(bead);
    const mid = new THREE.Mesh(new THREE.SphereGeometry(0.0018, 8, 6), K.white); mid.position.set(0, 0.0415, -0.4); b.add(mid);
    lathe(b, [[0.012, 0], [0.0135, -0.003], [0.0135, -0.012], [0.012, -0.014]], M.metal, 0, 0.018, -0.701); bore(b, 0.0095, 0, 0.018, -0.715);
    // magazine tube, cap and barrel clamp
    gun.parts.mag = cyl(g, 0.013, 0.46, M.metal, 0, -0.022, -0.36); gun.tube = true;
    lathe(b, [[0.013, 0], [0.0155, -0.004], [0.0155, -0.024], [0.011, -0.028]], K.knurl, 0, -0.022, -0.595);
    rb(b, 0.018, 0.052, 0.014, M.metal, 0, -0.002, -0.575, 0.005);
    // pump forend with grooves and action bars
    const pump = gun.parts.pump = grp(g, 0, -0.022, -0.34);
    rb(pump, 0.056, 0.05, 0.17, M.alt, 0, 0, 0, 0.014);
    grooves(pump, 7, 0.0575, 0.034, 0.005, 0, 0.0, -0.06, 0.02);
    for (const s of [-1, 1]) rb(pump, 0.003, 0.005, 0.2, K.steel, s * 0.022, 0.008, 0.17, 0.001);
    // furniture: wrist, grip and stock with a recoil pad
    const gr = grp(b, 0, -0.075, 0.1, -0.35);
    rb(gr, 0.036, 0.09, 0.045, M.alt, 0, 0, 0, 0.01);
    rot(rb(b, 0.048, 0.07, 0.25, M.alt, 0, -0.03, 0.22, 0.016), -0.06);
    rb(b, 0.04, 0.05, 0.08, M.alt, 0, -0.03, 0.115, 0.012);
    rb(b, 0.051, 0.09, 0.003, K.white, 0, -0.04, 0.336, 0.001);
    rb(b, 0.05, 0.088, 0.022, K.rubber, 0, -0.04, 0.349, 0.008);
    trigger(b, M, -0.031, 0.04, 0.07);
    cylX(b, 0.005, 0.056, K.blued, 0, -0.036, 0.066); rb(b, 0.0012, 0.008, 0.008, K.shell, 0.0285, -0.036, 0.066, 0.0004);
    for (const z of [0.03, -0.09]) screw(b, -0.0255, -0.015, z, 0.0034);
    // side saddle with four shells
    rb(b, 0.004, 0.036, 0.11, M.poly, -0.0275, 0.004, -0.02, 0.0015);
    for (let i = 0; i < 4; i++) { const z = -0.06 + i * 0.026; cylY(b, 0.0095, 0.046, K.shell, -0.04, 0.008, z); cylY(b, 0.0098, 0.012, K.brass, -0.04, -0.019, z); }
    rb(b, 0.003, 0.008, 0.11, M.accent, -0.0505, 0.008, -0.02, 0.0012);
    return finishGun(gun, { sightY: 0.045, rail: [0, 0.038, -0.02], muzzleY: 0.018, muzzleZ: -0.72, underY: -0.05, underZ: -0.46, gripZ: 0.1, foreZ: -0.34, foreY: -0.05, hip: new V3(0.17, -0.18, -0.52), adsZ: -0.32 });
  },
  // Anvil HX: belt-fed light machine gun with a folded bipod
  lmg(gun) {
    const { mats: M, body: b, g } = gun, K = GP_MAT;
    rb(b, 0.07, 0.08, 0.36, M.metal, 0, 0, -0.02, 0.006);
    rb(b, 0.0705, 0.006, 0.34, K.dark, 0, -0.015, -0.02, 0.0015);
    rb(b, 0.07, 0.008, 0.18, M.metal, 0, 0.043, 0.04, 0.003);                // feed cover
    rail(b, M.metal, 0.12, 0, 0.044, 0.04, 0.022);
    rb(b, 0.03, 0.01, 0.014, M.accent, 0, 0.046, 0.13, 0.003);                // cover latch
    rearAperture(b, M.metal, 0.072, 0.135, 0.047);
    for (const z of [0.0, 0.1]) screw(b, -0.0355, 0.02, z, 0.0036); screw(b, -0.0355, -0.025, -0.12, 0.0036);
    rb(b, 0.02, 0.012, 0.012, M.metal, 0.042, 0.0, -0.12, 0.004); rb(b, 0.002, 0.012, 0.1, K.dark, 0.0355, 0.0, -0.1, 0.0008);
    // barrel group: heat shield, gas tube, carry handle, front sight and flash hider
    cyl(b, 0.014, 0.42, M.metal, 0, 0.005, -0.5);
    rb(b, 0.032, 0.006, 0.2, M.poly, 0, 0.024, -0.36, 0.002);
    grooves(b, 6, 0.012, 0.0065, 0.012, 0, 0.024, -0.44, 0.03);
    cyl(b, 0.008, 0.36, M.metal, 0, -0.024, -0.45);
    rb(b, 0.03, 0.05, 0.03, M.metal, 0, -0.008, -0.6, 0.006);
    rb(b, 0.012, 0.03, 0.012, M.poly, -0.03, 0.02, -0.22, 0.004); rb(b, 0.012, 0.012, 0.12, M.poly, -0.03, 0.035, -0.27, 0.005);
    rb(b, 0.012, 0.05, 0.015, M.metal, 0, 0.04, -0.62, 0.004);
    frontPost(b, M.metal, 0.072, -0.62, 0.062);
    flashHider(b, M.metal, 0.016, 0.09, 0.005, -0.8);
    // handguard and folded bipod
    rb(b, 0.06, 0.04, 0.14, M.poly, 0, -0.035, -0.28, 0.01);
    grooves(b, 4, 0.0605, 0.024, 0.006, 0, -0.035, -0.32, 0.026);
    for (const s of [-1, 1]) { rb(b, 0.008, 0.008, 0.22, M.metal, s * 0.012, -0.04, -0.52, 0.002); rb(b, 0.014, 0.012, 0.02, K.rubber, s * 0.012, -0.04, -0.405, 0.004); }
    rb(b, 0.034, 0.016, 0.03, M.metal, 0, -0.03, -0.63, 0.004);
    // ammo belt feeding the receiver from the box
    for (let i = 0; i < 5; i++) { const y = -0.042 + i * 0.012, x = -0.04 - Math.sin(i * 0.5) * 0.006; cartridge(b, x, y, -0.04, 1.1); rb(b, 0.012, 0.004, 0.02, K.blued, x, y - 0.006, -0.05, 0.001); }
    // grip, trigger and skeleton stock
    trigger(b, M, -0.04, 0.07, 0.075);
    const gr = grp(b, 0, -0.085, 0.105, -0.3);
    rb(gr, 0.038, 0.1, 0.045, M.poly, 0, 0, 0, 0.01);
    for (let i = 0; i < 3; i++) rb(gr, 0.0382, 0.006, 0.006, M.poly, 0, 0.025 - i * 0.02, -0.024, 0.003);
    rb(b, 0.05, 0.08, 0.03, M.poly, 0, -0.015, 0.175, 0.008);
    rb(b, 0.05, 0.02, 0.24, M.poly, 0, 0.012, 0.29, 0.008);
    rot(rb(b, 0.04, 0.018, 0.24, M.poly, 0, -0.05, 0.28, 0.007), 0.08);
    cyl(b, 0.012, 0.2, M.metal, 0, -0.02, 0.29);
    rb(b, 0.052, 0.1, 0.022, K.rubber, 0, -0.02, 0.41, 0.008);
    // ammo box with latch, rivets and a strap
    const mg = gun.parts.mag = grp(g, -0.02, -0.1, -0.06); gun.magY = -0.1;
    rb(mg, 0.1, 0.11, 0.13, M.poly, 0, 0, 0, 0.01);
    rb(mg, 0.102, 0.02, 0.132, M.accent, 0, 0.03, 0, 0.004);
    rb(mg, 0.03, 0.05, 0.004, M.metal, 0, -0.01, -0.066, 0.0015);
    for (const x of [-0.04, 0.04]) for (const y of [-0.04, 0.045]) screw(mg, x, y, 0, 0.0025);
    rb(mg, 0.104, 0.008, 0.02, K.rubber, 0, -0.01, 0.03, 0.003);
    return finishGun(gun, { sightY: 0.072, rail: [0, 0.052, 0.04], muzzleY: 0.005, muzzleZ: -0.81, underY: -0.035, underZ: -0.36, gripZ: 0.1, foreZ: -0.34, foreY: -0.03, hip: new V3(0.17, -0.2, -0.52), adsZ: -0.3 });
  },
  // Longreach R2: bolt-action precision rifle on a chassis, fluted barrel, 5-25x scope
  sniper(gun) {
    const { mats: M, body: b, g } = gun, K = GP_MAT;
    cyl(b, 0.022, 0.24, M.metal, 0, 0.012, -0.02);
    lathe(b, [[0.022, 0], [0.02, 0.02], [0.012, 0.045]], M.metal, 0, 0.012, 0.1);
    rail(b, M.metal, 0.34, 0, 0.027, -0.11, 0.022);
    rb(b, 0.002, 0.018, 0.06, K.dark, 0.0215, 0.016, -0.02, 0.0008); cartridge(b, 0.012, 0.016, -0.02, 1.2);
    // chassis: forend with slots, action bed, thumbhole stock
    rb(b, 0.06, 0.06, 0.36, M.poly, 0, -0.014, -0.36, 0.012);
    grooves(b, 5, 0.0605, 0.01, 0.034, 0, -0.016, -0.48, 0.05);
    rb(b, 0.062, 0.05, 0.22, M.poly, 0, -0.022, -0.03, 0.01);
    rb(b, 0.055, 0.03, 0.3, M.poly, 0, 0.01, 0.3, 0.01);
    rb(b, 0.05, 0.03, 0.26, M.poly, 0, -0.062, 0.29, 0.01);
    rb(b, 0.05, 0.022, 0.12, M.poly, 0, 0.036, 0.28, 0.008); cylX(b, 0.008, 0.008, M.accent, -0.028, 0.03, 0.24); rb(b, 0.0562, 0.004, 0.24, M.accent, 0, -0.012, 0.3, 0.0015);
    rb(b, 0.052, 0.11, 0.02, M.poly, 0, -0.025, 0.43, 0.006);
    rb(b, 0.056, 0.12, 0.024, K.rubber, 0, -0.025, 0.452, 0.009);
    rb(b, 0.01, 0.04, 0.012, M.metal, 0, -0.095, 0.4, 0.003); cylY(b, 0.008, 0.01, K.knurl, 0, -0.118, 0.4);
    for (const z of [-0.08, 0.04]) screw(b, -0.031, -0.022, z, 0.0034);
    // fluted heavy barrel and a ported brake
    cyl(b, 0.016, 0.82, M.metal, 0, 0.008, -0.55, 0.012);
    for (let i = 0; i < 3; i++) rot(rb(b, 0.0032, 0.0322, 0.42, K.dark, 0, 0.008, -0.55, 0.0008), 0, 0, i * Math.PI / 3);
    muzzleBrake(b, M.metal, 0.02, 0.075, 0.008, -1.02, 3);
    // folded bipod under the forend
    for (const s of [-1, 1]) { rb(b, 0.009, 0.009, 0.18, M.metal, s * 0.014, -0.052, -0.56, 0.002); rb(b, 0.014, 0.014, 0.016, K.rubber, s * 0.014, -0.052, -0.46, 0.005); }
    rb(b, 0.036, 0.018, 0.03, M.metal, 0, -0.048, -0.66, 0.005);
    // grip and trigger
    trigger(b, M, -0.047, 0.06, 0.07);
    const gr = grp(b, 0, -0.088, 0.105, -0.25);
    rb(gr, 0.036, 0.1, 0.046, M.poly, 0, 0, 0, 0.01);
    rb(gr, 0.0365, 0.03, 0.02, M.poly, 0, 0.0, -0.02, 0.008);
    // 5-25x scope: main tube, objective bell, turrets, eyepiece and two rings
    const scope = new THREE.Group(); g.add(scope); gun.scopeMesh = scope;
    cyl(scope, 0.0155, 0.22, M.poly, 0, 0.085, -0.06);
    lathe(scope, [[0.0155, -0.17], [0.0155, -0.185], [0.03, -0.225], [0.03, -0.285], [0.027, -0.292], [0.025, -0.29]], M.poly, 0, 0.085, 0);
    lathe(scope, [[0.0155, 0.05], [0.017, 0.058], [0.022, 0.085], [0.022, 0.12], [0.02, 0.126]], M.poly, 0, 0.085, 0);
    cyl(scope, 0.0222, 0.016, K.rubber, 0, 0.085, 0.112);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.026, 24), VMS_MAT.lens); lens.position.set(0, 0.085, -0.288); lens.rotation.y = Math.PI; scope.add(lens);
    rb(scope, 0.036, 0.036, 0.05, M.poly, 0, 0.085, -0.06, 0.008);
    cylY(scope, 0.012, 0.016, K.knurl, 0, 0.111, -0.06); cylY(scope, 0.01, 0.004, M.accent, 0, 0.121, -0.06);
    cylX(scope, 0.012, 0.016, K.knurl, 0.026, 0.085, -0.06); cylX(scope, 0.01, 0.006, K.knurl, -0.024, 0.085, -0.06);
    for (const z of [-0.13, 0.02]) {
      cyl(scope, 0.0185, 0.014, M.metal, 0, 0.085, z);
      rb(scope, 0.026, 0.034, 0.016, M.metal, 0, 0.052, z, 0.004);
      for (const s of [-1, 1]) cylY(scope, 0.0025, 0.004, K.blued, s * 0.012, 0.104, z, 8);
    }
    // bolt: handle with a tactical knob
    gun.parts.bolt = grp(g, 0.035, 0.02, 0.1);
    rb(gun.parts.bolt, 0.06, 0.011, 0.011, K.steel, 0.03, 0, 0, 0.004);
    cyl(gun.parts.bolt, 0.012, 0.022, K.knurl, 0.062, 0, 0.002);
    // detachable box magazine
    const mg = gun.parts.mag = grp(g, 0, -0.06, -0.05); gun.magY = -0.06;
    rb(mg, 0.036, 0.07, 0.085, M.metal, 0, 0, 0, 0.004);
    rb(mg, 0.04, 0.012, 0.09, M.poly, 0, -0.036, 0, 0.004);
    return finishGun(gun, { sightY: 0.085, rail: [0, 0.035, -0.26], muzzleY: 0.008, muzzleZ: -1.02, underY: -0.04, underZ: -0.42, gripZ: 0.1, foreZ: -0.36, foreY: -0.04, hip: new V3(0.18, -0.18, -0.5), adsZ: -0.3 });
  },
  // Reaper's Eye: bone-and-iron marksman rifle with a skull brake, a scythe blade and the Soulglass scope
  reaper(gun) {
    const { mats: M, body: b, g } = gun, K = GP_MAT;
    const soul = new THREE.MeshBasicMaterial({ color: 0x9aff6a }); soul.color.convertSRGBToLinear();
    cyl(b, 0.022, 0.26, M.metal, 0, 0.012, -0.02);
    lathe(b, [[0.022, 0], [0.019, 0.02], [0.012, 0.04]], M.metal, 0, 0.012, 0.11);
    rb(b, 0.062, 0.058, 0.32, M.poly, 0, -0.012, -0.34, 0.014);
    for (let i = 0; i < 5; i++) rb(b, 0.064, 0.006, 0.02, M.alt, 0, 0.012, -0.22 - i * 0.055, 0.003);
    rb(b, 0.0005, 0.006, 0.28, soul, 0.0315, -0.012, -0.34, 0.0002); rb(b, 0.0005, 0.006, 0.28, soul, -0.0315, -0.012, -0.34, 0.0002);
    cyl(b, 0.015, 0.46, M.metal, 0, 0.008, -0.72);
    for (let i = 0; i < 3; i++) rot(rb(b, 0.003, 0.0302, 0.3, K.dark, 0, 0.008, -0.72, 0.0008), 0, 0, i * Math.PI / 3);
    // skull muzzle brake with glowing sockets and a jaw
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.034, 16, 12), M.alt); skull.scale.set(1, 1.1, 1.2); skull.position.set(0, 0.014, -1.03); b.add(skull);
    rb(b, 0.044, 0.018, 0.04, M.alt, 0, -0.016, -1.045, 0.008);
    for (let i = -2; i <= 2; i++) rb(b, 0.005, 0.008, 0.004, K.white, i * 0.0065, -0.012, -1.066, 0.0012);
    for (const s of [-1, 1]) { rb(b, 0.014, 0.012, 0.006, K.dark, s * 0.013, 0.02, -1.068, 0.004); rb(b, 0.008, 0.007, 0.003, soul, s * 0.013, 0.02, -1.071, 0.002); }
    bore(b, 0.007, 0, 0.004, -1.075);
    // scythe blade slung under the barrel
    for (let i = 0; i < 8; i++) rot(rb(b, 0.006, 0.032 - i * 0.002, 0.06, M.metal, 0, -0.05 - i * i * 0.003, -0.48 - i * 0.052, 0.002), -i * 0.11);
    rb(b, 0.008, 0.012, 0.38, M.accent, 0, -0.036, -0.62, 0.003);
    // Soulglass scope
    const scope = new THREE.Group(); g.add(scope); gun.scopeMesh = scope;
    cyl(scope, 0.0165, 0.24, M.poly, 0, 0.09, -0.07);
    lathe(scope, [[0.0165, -0.19], [0.032, -0.235], [0.032, -0.29], [0.029, -0.297]], M.metal, 0, 0.09, 0);
    lathe(scope, [[0.0165, 0.05], [0.023, 0.085], [0.023, 0.125], [0.021, 0.13]], M.metal, 0, 0.09, 0);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.029, 24), soul); lens.position.set(0, 0.09, -0.296); lens.rotation.y = Math.PI; scope.add(lens);
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.0175, 0.0035, 8, 20), M.alt); r.position.set(0, 0.09, -0.15 + i * 0.07); scope.add(r); }
    cylY(scope, 0.011, 0.016, K.knurl, 0, 0.115, -0.07); cylX(scope, 0.011, 0.016, K.knurl, 0.027, 0.09, -0.07);
    for (const z of [-0.18, 0.02]) { rb(scope, 0.024, 0.034, 0.014, M.metal, 0, 0.056, z, 0.004); cyl(scope, 0.019, 0.012, M.metal, 0, 0.09, z); }
    // bolt with a bone knob
    gun.parts.bolt = grp(g, 0.035, 0.02, 0.1);
    rb(gun.parts.bolt, 0.06, 0.011, 0.011, K.steel, 0.03, 0, 0, 0.004);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 10), M.alt); knob.position.set(0.064, 0, 0); gun.parts.bolt.add(knob);
    const mg = gun.parts.mag = grp(g, 0, -0.06, -0.05); gun.magY = -0.06;
    rb(mg, 0.04, 0.07, 0.09, M.poly, 0, 0, 0, 0.004); rb(mg, 0.044, 0.01, 0.094, M.alt, 0, -0.036, 0, 0.004);
    trigger(b, M, -0.04, 0.06, 0.07);
    const gr = grp(b, 0, -0.08, 0.1, -0.3); rb(gr, 0.036, 0.1, 0.045, M.alt, 0, 0, 0, 0.01);
    // bone stock with vertebrae ridges and a soul-light inlay
    rb(b, 0.05, 0.085, 0.3, M.alt, 0, -0.02, 0.31, 0.014);
    for (let i = 0; i < 6; i++) rb(b, 0.056, 0.016, 0.02, M.alt, 0, 0.03, 0.19 + i * 0.045, 0.006);
    rb(b, 0.0008, 0.04, 0.2, soul, 0.0254, -0.02, 0.3, 0.0003);
    rb(b, 0.054, 0.1, 0.022, K.rubber, 0, -0.022, 0.47, 0.009);
    return finishGun(gun, { sightY: 0.09, rail: [0, 0.035, -0.26], muzzleY: 0.012, muzzleZ: -1.07, underY: -0.04, underZ: -0.42, gripZ: 0.1, foreZ: -0.36, foreY: -0.04, hip: new V3(0.18, -0.18, -0.5), adsZ: -0.3 });
  },
  // Vampire's Fang: blood-red semi-auto shotgun with fangs at the muzzle and the Bloodglass holo sight
  fang(gun) {
    const { mats: M, body: b, g } = gun, K = GP_MAT;
    const blood = new THREE.MeshBasicMaterial({ color: 0xff2a3a }); blood.color.convertSRGBToLinear();
    rb(b, 0.07, 0.08, 0.34, M.metal, 0, 0, -0.04, 0.008);
    rb(b, 0.072, 0.03, 0.3, M.poly, 0, 0.03, -0.04, 0.006);
    rb(b, 0.002, 0.026, 0.07, K.dark, 0.0352, 0.0, -0.06, 0.0008); cylX(b, 0.009, 0.014, K.shell, 0.03, 0.0, -0.06);
    cyl(b, 0.02, 0.46, M.metal, 0, 0.02, -0.42); cyl(b, 0.016, 0.38, M.metal, 0, -0.022, -0.38);
    for (let i = 0; i < 6; i++) rb(b, 0.012, 0.006, 0.03, K.dark, 0, 0.038, -0.24 - i * 0.07, 0.002);
    lathe(b, [[0.02, 0], [0.024, -0.004], [0.024, -0.03], [0.021, -0.034]], M.accent, 0, 0.02, -0.65); bore(b, 0.014, 0, 0.02, -0.684);
    // two fangs hanging from the muzzle
    for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.09, 10), K.white); f.rotation.x = -Math.PI / 2 - 0.25; f.position.set(s * 0.022, -0.012, -0.68); b.add(f); }
    rb(b, 0.062, 0.05, 0.16, M.poly, 0, -0.024, -0.32, 0.012);
    grooves(b, 5, 0.0635, 0.03, 0.005, 0, -0.024, -0.38, 0.03);
    const mg = gun.parts.mag = grp(g, 0, -0.1, -0.08); gun.magY = -0.1;
    rb(mg, 0.05, 0.12, 0.08, M.poly, 0, 0, 0, 0.006); rb(mg, 0.052, 0.02, 0.082, M.accent, 0, -0.05, 0, 0.004);
    trigger(b, M, -0.04, 0.06, 0.07);
    const gr = grp(b, 0, -0.08, 0.1, -0.35); rb(gr, 0.036, 0.1, 0.045, M.metal, 0, 0, 0, 0.01);
    rb(b, 0.054, 0.08, 0.24, M.poly, 0, -0.02, 0.24, 0.014);
    rb(b, 0.056, 0.088, 0.022, K.rubber, 0, -0.02, 0.37, 0.009);
    // gold filigree bands and a blood vial in the stock
    for (const z of [-0.2, -0.05, 0.12]) rb(b, 0.074, 0.084, 0.012, M.accent, 0, 0, z, 0.003);
    cyl(b, 0.012, 0.14, blood, 0.03, -0.01, 0.24); cyl(b, 0.0135, 0.012, GP_MAT.brass, 0.03, -0.01, 0.168); cyl(b, 0.0135, 0.012, GP_MAT.brass, 0.03, -0.01, 0.312);
    for (const z of [0.0, -0.13]) screw(b, -0.0355, -0.02, z, 0.0036);
    // Bloodglass holo sight: an open frame with a red ring reticle
    gun.ownSight = true;
    const hs = grp(g, 0, 0.04, -0.04);
    rb(hs, 0.04, 0.008, 0.07, M.metal, 0, 0.004, 0, 0.002);
    for (const s of [-1, 1]) rb(hs, 0.006, 0.05, 0.014, M.metal, s * 0.022, 0.03, -0.02, 0.002);
    rb(hs, 0.05, 0.007, 0.014, M.metal, 0, 0.056, -0.02, 0.0025);
    cylX(hs, 0.004, 0.006, K.knurl, 0.026, 0.014, 0.01);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.038, 0.044), VMS_MAT.glass); glass.position.set(0, 0.031, -0.02); hs.add(glass);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.0045, 0.0062, 24), new THREE.MeshBasicMaterial({ color: 0xff2a3a, depthTest: false, transparent: true })); ring.position.set(0, 0.031, -0.021); ring.renderOrder = 10; hs.add(ring);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0012, 10), new THREE.MeshBasicMaterial({ color: 0xff6a6a, depthTest: false, transparent: true })); dot.position.set(0, 0.031, -0.0215); dot.renderOrder = 11; hs.add(dot);
    mergeGroup(hs);
    return finishGun(gun, { sightY: 0.071, rail: [0, 0.04, -0.02], muzzleY: 0.02, muzzleZ: -0.7, underY: -0.05, underZ: -0.44, gripZ: 0.1, foreZ: -0.32, foreY: -0.05, hip: new V3(0.17, -0.18, -0.5), adsZ: -0.26 });
  },
  // Helion PX: plasma rifle with heat-sink fins, an emitter crown and a glowing power cell
  plasma(gun) {
    const { mats: M, body: b, g } = gun, K = GP_MAT;
    rb(b, 0.07, 0.08, 0.42, M.poly, 0, 0, -0.04, 0.014);
    rb(b, 0.074, 0.03, 0.3, M.accent, 0, 0.03, -0.06, 0.008);
    rb(b, 0.03, 0.02, 0.16, VMS_MAT.cyan, 0.036, 0.01, -0.06, 0.004);
    grooves(b, 6, 0.0705, 0.004, 0.02, 0, -0.022, -0.2, 0.03);
    rail(b, M.metal, 0.2, 0, 0.037, -0.02, 0.02);
    rearAperture(b, M.metal, 0.07, 0.08, 0.045);
    frontPost(b, M.metal, 0.07, -0.2, 0.045);
    cyl(b, 0.018, 0.2, M.metal, 0, 0.005, -0.35);
    for (let i = 0; i < 7; i++) rb(b, 0.05, 0.05, 0.003, M.metal, 0, 0.005, -0.27 - i * 0.022, 0.003);
    gun.coils = [];
    for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 8, 18), VMS_MAT.cyan); t.position.set(0, 0.005, -0.29 - i * 0.05); g.add(t); gun.coils.push(t); }
    lathe(b, [[0.022, 0], [0.03, -0.006], [0.03, -0.03], [0.022, -0.04]], M.metal, 0, 0.005, -0.45);
    for (let i = 0; i < 3; i++) { const pr = grp(b, 0, 0.005, -0.5); pr.rotation.z = i * 2.094; rb(pr, 0.006, 0.006, 0.03, M.metal, 0, 0.024, 0, 0.002); }
    bore(b, 0.012, 0, 0.005, -0.49);
    // power cell with charge lights and a braided cable to the action
    const mg = gun.parts.mag = grp(g, 0, -0.085, -0.12); gun.magY = -0.085;
    rb(mg, 0.045, 0.1, 0.07, M.metal, 0, 0, 0, 0.008);
    rb(mg, 0.047, 0.05, 0.03, VMS_MAT.cyan, 0, -0.01, 0, 0.005);
    for (let i = 0; i < 4; i++) rb(mg, 0.0475, 0.006, 0.006, i < 3 ? VMS_MAT.cyan : K.dark, 0, 0.03 - i * 0.01, 0.028, 0.002);
    for (let i = 0; i < 5; i++) cyl(b, 0.006, 0.03, K.rubber, -0.03, -0.04 + Math.sin(i * 0.6) * 0.01, -0.05 + i * 0.022);
    trigger(b, M, -0.04, -0.02, 0.07);
    const gr = grp(b, 0, -0.08, 0.06, -0.3);
    rb(gr, 0.036, 0.1, 0.045, M.poly, 0, 0, 0, 0.01);
    for (let i = 0; i < 3; i++) rb(gr, 0.0362, 0.006, 0.006, M.poly, 0, 0.025 - i * 0.02, -0.023, 0.003);
    rb(b, 0.05, 0.07, 0.2, M.poly, 0, -0.01, 0.24, 0.014);
    rb(b, 0.052, 0.075, 0.02, K.rubber, 0, -0.012, 0.35, 0.008);
    rb(b, 0.0505, 0.006, 0.16, VMS_MAT.cyan, 0, 0.012, 0.24, 0.002);
    for (const z of [0.05, -0.15]) screw(b, -0.0355, -0.02, z, 0.0036);
    return finishGun(gun, { sightY: 0.07, rail: [0, 0.045, -0.02], muzzleY: 0.005, muzzleZ: -0.5, underY: -0.045, underZ: -0.3, gripZ: 0.06, foreZ: -0.26, foreY: -0.04, hip: new V3(0.17, -0.18, -0.48), adsZ: -0.25 });
  },
};
const GUNS = {};
for (const w of WEAPONS) GUNS[w.id] = BUILDERS[w.id](newGun(w));

// ---------------- skin patterns ----------------
// Painted once per skin onto a 256px canvas: pumpkins, bones, webs, candy corn, ghosts, runes and so on.
const hx = c => '#' + c.toString(16).padStart(6, '0');
let _seed = 1;
const sr1 = () => { _seed = (_seed * 16807) % 2147483647; return (_seed - 1) / 2147483646; };
const sr = (a, b) => a + sr1() * (b - a);
const PATTERN_NAME = { pumpkin: 'pumpkin', bones: 'bones', web: 'cobweb', candycorn: 'candy corn', ghost: 'ghost', hex: 'hex runes', moon: 'blood moon', stitch: 'stitched', flames: 'flames', grave: 'gravestone', vampire: 'vampire', wood: 'walnut wood', camo_desert: 'desert camo', camo_snow: 'arctic splinter camo', carbon: 'carbon fibre', circuit: 'circuit traces', scorch: 'charred', engrave: 'engraved gold' };
function paintPattern(g, kind, s) {
  const S = 256, base = hx(s.poly), alt = hx(s.alt), acc = hx(s.accent), metal = hx(s.metal);
  _seed = [...kind].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 2147483647, 7) + 1;
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  // blob drawn on all nine wrapped copies so the pattern tiles without seams
  const blob = (x, y, r, col, pts = 9) => { const off = []; for (let i = 0; i < pts; i++) off.push(r * sr(0.55, 1.15)); g.fillStyle = col; wrap9(S, S, (ox, oy) => { g.beginPath(); for (let i = 0; i <= pts; i++) { const a = i / pts * Math.PI * 2, rr = off[i % pts]; g.lineTo(x + ox + Math.cos(a) * rr, y + oy + Math.sin(a) * rr * 0.7); } g.fill(); }); };
  const star = (x, y, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); };
  if (kind === 'pumpkin') {
    for (let x = 0; x < S; x += 32) { const gr = g.createLinearGradient(x, 0, x + 32, 0); gr.addColorStop(0, 'rgba(0,0,0,.28)'); gr.addColorStop(.5, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(0,0,0,.28)'); g.fillStyle = gr; g.fillRect(x, 0, 32, S); }
    for (const [cx, cy] of [[64, 64], [192, 64], [128, 160], [32, 208], [224, 208]]) {
      g.fillStyle = alt; g.beginPath(); g.moveTo(cx - 22, cy - 6); g.lineTo(cx - 10, cy - 20); g.lineTo(cx - 2, cy - 4); g.fill(); g.beginPath(); g.moveTo(cx + 22, cy - 6); g.lineTo(cx + 10, cy - 20); g.lineTo(cx + 2, cy - 4); g.fill();
      g.beginPath(); g.moveTo(cx - 26, cy + 6); for (let i = 0; i <= 8; i++) g.lineTo(cx - 26 + i * 6.5, cy + 6 + (i % 2 ? 10 : 2)); g.lineTo(cx + 26, cy + 22); g.lineTo(cx - 26, cy + 22); g.fill();
      g.fillStyle = acc; g.globalAlpha = 0.35; g.fillRect(cx - 4, cy - 10, 8, 4); g.globalAlpha = 1;
    }
  } else if (kind === 'bones') {
    g.strokeStyle = alt; g.fillStyle = alt; g.lineCap = 'round';
    for (const [cx, cy, r] of [[50, 50, .6], [180, 80, -.5], [100, 180, .3], [220, 210, -.9]]) {
      g.save(); g.translate(cx, cy); g.rotate(r); g.lineWidth = 7; g.beginPath(); g.moveTo(-26, 0); g.lineTo(26, 0); g.stroke();
      for (const sx of [-26, 26]) for (const sy of [-5, 5]) { g.beginPath(); g.arc(sx, sy, 6, 0, 7); g.fill(); } g.restore();
    }
    for (const [cx, cy] of [[190, 170], [60, 120], [150, 30]]) { g.beginPath(); g.arc(cx, cy, 16, 0, 7); g.fill(); g.fillRect(cx - 9, cy + 8, 18, 12); g.fillStyle = base; g.beginPath(); g.arc(cx - 6, cy, 4.5, 0, 7); g.arc(cx + 6, cy, 4.5, 0, 7); g.fill(); g.fillRect(cx - 1.5, cy + 6, 3, 5); g.fillStyle = alt; }
  } else if (kind === 'web') {
    g.strokeStyle = alt; g.globalAlpha = 0.8; g.lineWidth = 1.5;
    for (const [cx, cy] of [[0, 0], [256, 256], [256, 0], [0, 256], [128, 128]]) {
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 140, cy + Math.sin(a) * 140); g.stroke(); }
      for (let r = 16; r < 140; r += 16) { g.beginPath(); for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI * 2, rr = r + (i % 2) * 3; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.stroke(); }
    }
    g.globalAlpha = 1; g.fillStyle = acc; g.beginPath(); g.arc(128, 150, 9, 0, 7); g.arc(128, 136, 6, 0, 7); g.fill();
  } else if (kind === 'candycorn') {
    const cols = [base, alt, hx(s.metal)];
    for (let i = -8; i < 16; i++) { g.fillStyle = cols[((i % 3) + 3) % 3]; g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 32, 0); g.lineTo(i * 32 + 32 + S, S); g.lineTo(i * 32 + S, S); g.fill(); }
  } else if (kind === 'ghost') {
    const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, alt); gr.addColorStop(1, base); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    for (const [cx, cy] of [[60, 70], [190, 60], [120, 170], [230, 200], [20, 210]]) {
      g.fillStyle = acc; g.globalAlpha = 0.55; g.beginPath(); g.arc(cx, cy, 18, Math.PI, 0); g.lineTo(cx + 18, cy + 26); for (let i = 0; i < 4; i++) g.lineTo(cx + 18 - (i + 0.5) * 9, cy + (i % 2 ? 26 : 18)); g.lineTo(cx - 18, cy + 26); g.fill();
      g.globalAlpha = 1; g.fillStyle = base; g.beginPath(); g.arc(cx - 6, cy - 2, 3.5, 0, 7); g.arc(cx + 6, cy - 2, 3.5, 0, 7); g.fill(); g.beginPath(); g.ellipse(cx, cy + 8, 3, 5, 0, 0, 7); g.fill();
    }
  } else if (kind === 'hex') {
    g.strokeStyle = acc; g.lineWidth = 2;
    for (const [cx, cy, r] of [[64, 64, 40], [192, 192, 46], [200, 60, 26], [56, 196, 30]]) {
      g.globalAlpha = 0.85; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); g.beginPath(); g.arc(cx, cy, r * 0.8, 0, 7); g.stroke();
      g.beginPath(); for (let i = 0; i <= 5; i++) { const a = i * 4 * Math.PI / 5 - Math.PI / 2; g.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8); } g.stroke();
    }
    g.globalAlpha = 0.5; g.fillStyle = alt; for (let i = 0; i < 40; i++) g.fillRect(sr(0, S), sr(0, S), 2, 2); g.globalAlpha = 1;
  } else if (kind === 'moon') {
    const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, base); gr.addColorStop(1, alt); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.fillStyle = '#ffffff'; for (let i = 0; i < 50; i++) { g.globalAlpha = sr(.3, .9); g.fillRect(sr(0, S), sr(0, S), 1.5, 1.5); } g.globalAlpha = 1;
    const mg = g.createRadialGradient(170, 80, 0, 170, 80, 60); mg.addColorStop(0, acc); mg.addColorStop(.6, acc); mg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = mg; g.beginPath(); g.arc(170, 80, 60, 0, 7); g.fill();
    g.fillStyle = '#050307'; for (const [bx, by, sc] of [[70, 60, 1], [120, 120, .7], [200, 170, .8], [40, 190, .6]]) { g.save(); g.translate(bx, by); g.scale(sc, sc); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-14, -12, -30, -4); g.quadraticCurveTo(-20, 0, -18, 8); g.quadraticCurveTo(-8, 2, 0, 8); g.quadraticCurveTo(8, 2, 18, 8); g.quadraticCurveTo(20, 0, 30, -4); g.quadraticCurveTo(14, -12, 0, 0); g.fill(); g.restore(); }
  } else if (kind === 'stitch') {
    for (let i = 0; i < 300; i++) { g.fillStyle = sr1() < .5 ? alt : base; g.globalAlpha = .25; g.beginPath(); g.arc(sr(0, S), sr(0, S), sr(4, 14), 0, 7); g.fill(); } g.globalAlpha = 1;
    g.strokeStyle = '#0c0e0a'; g.lineWidth = 3;
    for (const [x0, y0, x1, y1] of [[20, 40, 230, 60], [40, 150, 210, 210], [130, 10, 110, 250]]) {
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      const n = 10; for (let i = 1; i < n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, a = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2; g.beginPath(); g.moveTo(x - Math.cos(a) * 7, y - Math.sin(a) * 7); g.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); g.stroke(); }
    }
    g.fillStyle = acc; for (const [x, y] of [[20, 40], [230, 60]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
  } else if (kind === 'flames') {
    for (let i = 0; i < 9; i++) {
      const x = i * 32 + sr(-6, 6), h = sr(120, 230);
      const fg = g.createLinearGradient(0, S, 0, S - h); fg.addColorStop(0, acc); fg.addColorStop(0.6, alt); fg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = fg; g.beginPath(); g.moveTo(x - 18, S); g.quadraticCurveTo(x - 22, S - h * 0.5, x + sr(-8, 8), S - h); g.quadraticCurveTo(x + 22, S - h * 0.5, x + 18, S); g.fill();
    }
  } else if (kind === 'grave') {
    for (let i = 0; i < 6000; i++) { g.fillStyle = sr1() < .5 ? alt : hx(s.metal); g.globalAlpha = .4; g.fillRect(sr(0, S), sr(0, S), 2, 2); } g.globalAlpha = 1;
    for (let i = 0; i < 12; i++) { const x = sr(0, S), y = sr(0, S), r = sr(10, 30); const mg = g.createRadialGradient(x, y, 0, x, y, r); mg.addColorStop(0, 'rgba(70,110,50,.7)'); mg.addColorStop(1, 'rgba(70,110,50,0)'); g.fillStyle = mg; g.fillRect(x - r, y - r, r * 2, r * 2); }
    g.strokeStyle = 'rgba(10,10,10,.6)'; g.lineWidth = 1.5; for (let k = 0; k < 6; k++) { let x = sr(0, S), y = sr(0, S); g.beginPath(); g.moveTo(x, y); for (let i = 0; i < 12; i++) { x += sr(-12, 12); y += sr(-12, 12); g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = acc; g.globalAlpha = .6; g.font = 'bold 26px serif'; g.textAlign = 'center'; g.fillText('R.I.P.', 128, 136); g.globalAlpha = 1;
  } else if (kind === 'vampire') {
    g.strokeStyle = alt; g.lineWidth = 3;
    for (let y = 0; y < S; y += 64) for (let x = 0; x < S; x += 64) {
      g.beginPath(); g.moveTo(x + 32, y + 4); g.bezierCurveTo(x + 60, y + 4, x + 60, y + 40, x + 32, y + 32); g.bezierCurveTo(x + 4, y + 40, x + 4, y + 4, x + 32, y + 4); g.stroke();
      g.beginPath(); g.moveTo(x + 32, y + 32); g.quadraticCurveTo(x + 46, y + 52, x + 32, y + 60); g.quadraticCurveTo(x + 18, y + 52, x + 32, y + 32); g.stroke();
    }
    g.fillStyle = acc; for (let i = 0; i < 6; i++) star(sr(10, 246), sr(10, 246), 4);
  } else if (kind === 'wood') {
    // walnut: wavy grain that tiles along the length, darker streaks, pores and a couple of knots
    g.fillStyle = alt; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y++) { const n = Math.sin(y * 0.11 + Math.sin(y * 0.031) * 2.5) * 0.5 + 0.5; g.fillStyle = `rgba(36,16,6,${0.06 + n * 0.2})`; g.fillRect(0, y, S, 1); }
    for (let i = 0; i < 60; i++) { const y0 = sr(0, S), amp = sr(1, 5), k = Math.round(sr(1, 3)), ph = sr(0, 6.3); g.strokeStyle = `rgba(28,12,4,${sr(0.1, 0.35)})`; g.lineWidth = sr(0.5, 2); g.beginPath(); for (let x = 0; x <= S; x += 4) g.lineTo(x, y0 + Math.sin(x / S * Math.PI * 2 * k + ph) * amp); g.stroke(); }
    for (let i = 0; i < 2; i++) { const x = sr(40, 216), y = sr(40, 216); for (let r = 14; r > 2; r -= 3) { g.strokeStyle = 'rgba(30,12,4,.35)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, r * 2.2, r, 0, 0, 7); g.stroke(); } }
    speckle(g, S, S, 1600, ['#1a0c04', '#e8c8a0'], 1.2, 0.25);
  } else if (kind === 'camo_desert') {
    // multi-tone desert camouflage: soft tan field, light blotches, brown shapes, dark twigs
    for (let i = 0; i < 26; i++) blob(sr(0, S), sr(0, S), sr(16, 34), alt);
    for (let i = 0; i < 18; i++) blob(sr(0, S), sr(0, S), sr(12, 26), metal);
    for (let i = 0; i < 14; i++) blob(sr(0, S), sr(0, S), sr(5, 11), 'rgba(58,42,24,.85)', 6);
    g.strokeStyle = 'rgba(70,52,30,.7)'; g.lineWidth = 2; for (let i = 0; i < 18; i++) { let x = sr(0, S), y = sr(0, S); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += sr(-14, 14); y += sr(-8, 8); g.lineTo(x, y); } g.stroke(); }
    speckle(g, S, S, 1200, ['#000', '#fff'], 1.5, 0.08);
  } else if (kind === 'camo_snow') {
    // arctic splinter camouflage: angular grey and ice-blue shards on white
    const shard = (col) => { const x = sr(0, S), y = sr(0, S), a = sr(0, 3.14), l = sr(30, 70), w = sr(8, 18); g.fillStyle = col; wrap9(S, S, (ox, oy) => { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.lineTo(x + ox + Math.cos(a + 0.4) * l * 0.6 + Math.cos(a + 1.57) * w, y + oy + Math.sin(a + 0.4) * l * 0.6 + Math.sin(a + 1.57) * w); g.fill(); }); };
    for (let i = 0; i < 30; i++) shard(alt);
    for (let i = 0; i < 18; i++) shard('#9aa6b2');
    for (let i = 0; i < 8; i++) shard(acc);
    speckle(g, S, S, 900, ['#5a6672'], 1.2, 0.2);
  } else if (kind === 'carbon') {
    // twill carbon-fibre weave with a clear-coat sheen
    for (let y = 0; y < S; y += 16) for (let x = 0; x < S; x += 16) {
      const h = ((x + y) / 16) % 2 === 0, gr = h ? g.createLinearGradient(x, y, x, y + 16) : g.createLinearGradient(x, y, x + 16, y);
      gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(0.5, 'rgba(255,255,255,.07)'); gr.addColorStop(1, 'rgba(0,0,0,.6)');
      g.fillStyle = gr; g.fillRect(x, y, 16, 16);
    }
    const sh = g.createLinearGradient(0, 0, S, S); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,.06)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(0, 0, S, S);
  } else if (kind === 'circuit') {
    // printed-circuit traces with vias and chips; the traces glow on Circuit
    g.strokeStyle = acc; g.lineWidth = 2; g.lineCap = 'round';
    for (let i = 0; i < 40; i++) {
      let x = Math.round(sr(0, 16)) * 16, y = Math.round(sr(0, 16)) * 16; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { const d = Math.floor(sr(0, 4)), l = Math.round(sr(1, 4)) * 16; if (d === 0) x += l; else if (d === 1) y += l; else if (d === 2) { x += l; y += l; } else { x += l; y -= l; } g.lineTo(x, y); }
      g.stroke(); g.fillStyle = acc; g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); g.fillStyle = base; g.beginPath(); g.arc(x, y, 1.5, 0, 7); g.fill();
    }
    for (let i = 0; i < 5; i++) { const x = sr(10, 220), y = sr(10, 220); g.fillStyle = '#05080a'; g.fillRect(x, y, 26, 18); g.fillStyle = acc; for (let k = 0; k < 6; k++) { g.fillRect(x + 2 + k * 4, y - 3, 2, 3); g.fillRect(x + 2 + k * 4, y + 18, 2, 3); } }
  } else if (kind === 'scorch') {
    // charred finish: soot blotches, ash flecks and glowing ember cracks
    for (let i = 0; i < 22; i++) blob(sr(0, S), sr(0, S), sr(14, 34), 'rgba(8,6,5,.55)');
    speckle(g, S, S, 1400, ['#8a8580', '#2a2622'], 1.8, 0.35);
    g.strokeStyle = acc; g.lineCap = 'round';
    for (let k = 0; k < 14; k++) { let x = sr(0, S), y = sr(0, S); g.lineWidth = sr(1, 2.6); g.beginPath(); g.moveTo(x, y); for (let i = 0; i < 9; i++) { x += sr(-11, 11); y += sr(-11, 11); g.lineTo(x, y); } g.stroke(); }
  } else if (kind === 'engrave') {
    // hand-engraved scrollwork on polished gold
    g.fillStyle = metal; g.fillRect(0, 0, S, S);
    const sh = g.createLinearGradient(0, 0, 0, S); sh.addColorStop(0, 'rgba(255,255,255,.12)'); sh.addColorStop(0.5, 'rgba(0,0,0,.08)'); sh.addColorStop(1, 'rgba(255,255,255,.12)'); g.fillStyle = sh; g.fillRect(0, 0, S, S);
    const scroll = (cx, cy, r, dir) => { g.beginPath(); for (let a = 0; a < 12; a += 0.12) { const rr = r * (1 - a / 13); g.lineTo(cx + Math.cos(a * dir) * rr, cy + Math.sin(a * dir) * rr); } g.stroke(); };
    for (const [col, w, off] of [['rgba(70,42,8,.75)', 2.2, 0], ['rgba(255,244,200,.55)', 1, 0.9]]) {
      g.strokeStyle = col; g.lineWidth = w;
      for (const [cx, cy, r, d] of [[64, 64, 40, 1], [192, 64, 34, -1], [128, 170, 44, 1], [32, 210, 26, -1], [224, 200, 30, 1]]) scroll(cx + off, cy + off, r, d);
      for (let i = 0; i < 16; i++) { const x = sr(0, S), y = sr(0, S), a = sr(0, 6.3); g.beginPath(); g.ellipse(x + off, y + off, 9, 3.5, a, 0, 7); g.stroke(); }
    }
    g.strokeStyle = 'rgba(70,42,8,.6)'; g.lineWidth = 1.5; for (const y of [4, 252]) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
  }
}
const patternCache = {};
// one repeat of a pattern covers about 25 cm of gun (wood grain a little more)
function skinTexture(key, kind) {
  const s = SKINS[key]; kind = kind || s.pattern || s.altPattern || s.metalPattern;
  const ck = key + '|' + kind;
  if (patternCache[ck]) return patternCache[ck];
  const [c, g] = cv(256, 256); paintPattern(g, kind, s);
  const t = tex(c, 1, 1); const rep = GP_TILE / (kind === 'wood' ? 0.3 : kind === 'carbon' ? 0.12 : 0.25); t.repeat.set(rep, rep);
  return (patternCache[ck] = t);
}
// the same pattern with every non-accent colour painted black: drives the glow of glowing skins
function glowTexture(key, kind) {
  const ck = key + '|' + kind + '|glow';
  if (patternCache[ck]) return patternCache[ck];
  const s = SKINS[key], [c, g] = cv(256, 256); paintPattern(g, kind, Object.assign({}, s, { poly: 0, alt: 0, metal: 0 }));
  const t = tex(c, 1, 1); t.repeat.copy(skinTexture(key, kind).repeat);
  return (patternCache[ck] = t);
}
// apply a skin to any gun object (the live viewmodel or a Skin Studio preview)
function applySkinTo(gun, key) {
  if (!SKINS[key]) key = 'stock';
  const s = SKINS[key];
  const pat = { metal: s.metalPattern, poly: s.polyPattern || s.pattern, alt: s.altPattern || s.pattern };
  for (const [mk, col] of [['metal', s.metal], ['poly', s.poly], ['alt', s.alt], ['accent', s.accent]]) {
    const m = gun.mats[mk], kind = pat[mk], t = kind ? skinTexture(key, kind) : null;
    m.map = t; m.color.setHex(t ? 0xffffff : col).convertSRGBToLinear();
    if (mk !== 'accent') { const gt = t && s.glow ? glowTexture(key, kind) : null; m.emissiveMap = gt; m.emissive.setHex(gt ? 0xffffff : 0); m.emissiveIntensity = gt ? 0.75 : 0; }
    m.needsUpdate = true;
  }
  gun.mats.accent.emissive.setHex(s.glow ? s.accent : 0x000000); gun.mats.accent.emissiveIntensity = s.glow ? 0.9 : 0;
  // finish: polished, anodized or the usual parkerized metal; gloss or matte furniture
  gun.mats.metal.metalness = s.shiny ? 1 : s.anodized ? 0.9 : 0.85; gun.mats.metal.roughness = s.shiny ? 0.2 : s.anodized ? 0.3 : 0.4;
  for (const mk of ['poly', 'alt']) gun.mats[mk].roughness = s.gloss ? 0.35 : mk === 'alt' && pat.alt === 'wood' ? 0.55 : 0.78;
}
function applySkin(id) { applySkinTo(GUNS[id], weaponSkin(id)); }
function configureGun(gun, id, skinKey) {
  applySkinTo(gun, skinKey || weaponSkin(id));
  const on = a => attOn(id, a), w = WEAPON_BY_ID[id];
  gun.reddot.visible = on('reddot') && !w.builtinSight && !gun.ownSight;
  if (gun.scopeMesh) gun.scopeMesh.visible = !on('reddot');
  gun.silencer.visible = on('silencer');
  gun.muzzle.position.z = gun.muzzleZ - (on('silencer') ? 0.17 : 0);
  gun.grip.visible = on('grip'); gun.laserMount.visible = on('laser');
  if (gun.parts.mag) {
    if (gun.tube) { gun.parts.mag.scale.y = on('extmag') ? 1.18 : 1; }
    else gun.parts.mag.scale.y = on('extmag') ? 1.45 : 1;
  }
  gun.adsPos = new V3(0, -(on('reddot') && !w.builtinSight ? gun.rdY : gun.sightY), gun.adsZ);
}
function refreshViewmodel(id) { const gun = GUNS[id]; if (gun) configureGun(gun, id); }
for (const w of WEAPONS) refreshViewmodel(w.id);
