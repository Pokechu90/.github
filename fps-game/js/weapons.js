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
  stock: { name: 'Factory', metal: 0x2b3036, poly: 0x1b1e21, alt: 0x7a6a4c, accent: 0xf5a524, how: 'Default' },
  desert: { name: 'Dune', metal: 0x6d5d44, poly: 0xb59c6c, alt: 0xc9b081, accent: 0x5a4a30, how: 'Reach level 4' },
  arctic: { name: 'Glacier', metal: 0xc9d1d8, poly: 0xe9eef2, alt: 0xdfe6ea, accent: 0x3f9bff, how: 'Quest: Big spender' },
  crimson: { name: 'Crimson', metal: 0x3a1212, poly: 0x5c1616, alt: 0x7a1d1d, accent: 0xff3a3a, how: 'Quest: Veteran' },
  circuit: { name: 'Circuit', metal: 0x0c1618, poly: 0x0f2226, alt: 0x12303a, accent: 0x2affd5, glow: true, how: 'Quest: Sharpshooter' },
  scorch: { name: 'Scorch', metal: 0x2a2a2a, poly: 0x3a2a20, alt: 0x5a3a20, accent: 0xff7a2e, glow: true, how: 'Boss drop' },
  gold: { name: 'Gilded', metal: 0xd4a93a, poly: 0x1b1e21, alt: 0xc9a03a, accent: 0xfff0b0, shiny: true, how: 'Quest: Untouchable or level 20' },
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

function newGun(w) {
  const g = new THREE.Group();
  const mats = {
    metal: new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.85 }),
    poly: new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.1 }),
    alt: new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0.1 }),
    accent: new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 }),
  };
  return { g, mats, w, parts: {} };
}
function bx(p, w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); p.add(m); return m; }
function cy(p, r, len, mat, x, y, z, r2 = r, seg = 16) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, len, seg), mat); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); p.add(m); return m; }
function arms(g, gripZ, foreZ, foreY = -0.02) {
  bx(g, 0.055, 0.09, 0.09, VMS_MAT.glove, 0.012, -0.07, gripZ);
  const ra = bx(g, 0.08, 0.08, 0.28, VMS_MAT.sleeve, 0.05, -0.12, gripZ + 0.15); ra.rotation.x = 0.35; ra.rotation.y = 0.2;
  if (foreZ != null) { bx(g, 0.06, 0.06, 0.1, VMS_MAT.glove, -0.01, foreY - 0.05, foreZ); const la = bx(g, 0.08, 0.08, 0.34, VMS_MAT.sleeve, -0.11, foreY - 0.12, foreZ + 0.15); la.rotation.x = 0.3; la.rotation.y = -0.55; }
}
// common attachment points: rail (x,y,z) for the red dot; under (z) for grip/laser; muzzle (y,z)
function finishGun(gun, o) {
  const { g, mats } = gun;
  Object.assign(gun, o);
  gun.muzzle = new THREE.Object3D(); gun.muzzle.position.set(0, o.muzzleY, o.muzzleZ); g.add(gun.muzzle);
  gun.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: gun.w.flashColor || 0xffffff })); gun.flash.visible = false; gun.muzzle.add(gun.flash);
  // red dot sight: open frame, tinted glass and a glowing dot
  const rd = new THREE.Group(); rd.position.set(0, o.rail[1], o.rail[2]); g.add(rd);
  bx(rd, 0.036, 0.008, 0.06, mats.metal, 0, 0.004, 0);
  bx(rd, 0.005, 0.034, 0.012, mats.metal, -0.018, 0.021, -0.02); bx(rd, 0.005, 0.034, 0.012, mats.metal, 0.018, 0.021, -0.02);
  bx(rd, 0.041, 0.005, 0.012, mats.metal, 0, 0.04, -0.02);
  bx(rd, 0.012, 0.01, 0.02, mats.accent, 0.022, 0.012, 0.01);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.031, 0.03), VMS_MAT.glass); glass.position.set(0, 0.022, -0.02); rd.add(glass);
  const dot = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true })); dot.scale.set(0.0045, 0.0045, 1); dot.position.set(0, 0.022, -0.021); dot.renderOrder = 10; rd.add(dot);
  gun.reddot = rd; gun.rdY = o.rail[1] + 0.022;
  // silencer
  const sil = new THREE.Group(); sil.position.set(0, o.muzzleY, o.muzzleZ); g.add(sil);
  cy(sil, 0.021, 0.17, mats.poly, 0, 0, -0.085); cy(sil, 0.023, 0.02, mats.metal, 0, 0, -0.005);
  gun.silencer = sil;
  // grip and laser under the handguard
  const grip = new THREE.Group(); grip.position.set(0, o.underY, o.underZ); g.add(grip);
  bx(grip, 0.03, 0.075, 0.035, mats.poly, 0, -0.04, 0); bx(grip, 0.035, 0.01, 0.045, mats.metal, 0, 0, 0);
  gun.grip = grip;
  const las = new THREE.Group(); las.position.set(0.034, o.underY + 0.02, o.underZ - 0.03); g.add(las);
  bx(las, 0.018, 0.022, 0.06, mats.metal, 0, 0, 0); bx(las, 0.01, 0.01, 0.004, VMS_MAT.laser, 0, 0, -0.031);
  gun.laserMount = las;
  arms(g, o.gripZ, o.foreZ, o.foreY);
  g.visible = false; vmRoot.add(g);
  return gun;
}
const BUILDERS = {
  pistol(gun) {
    const { g, mats } = gun;
    gun.parts.slide = bx(g, 0.034, 0.036, 0.19, mats.metal, 0, 0.018, -0.03); bx(gun.parts.slide, 0.035, 0.012, 0.05, mats.poly, 0, 0.005, 0.03);
    bx(g, 0.03, 0.028, 0.17, mats.poly, 0, -0.012, -0.03);
    const grip = bx(g, 0.03, 0.1, 0.048, mats.poly, 0, -0.07, 0.045); grip.rotation.x = -0.22;
    bx(g, 0.004, 0.01, 0.006, VMS_MAT.dot, 0, 0.041, -0.115); bx(g, 0.02, 0.008, 0.008, mats.metal, 0, 0.04, 0.055);
    bx(g, 0.024, 0.012, 0.03, mats.accent, 0, -0.03, -0.02);
    gun.parts.mag = bx(g, 0.026, 0.02, 0.04, mats.alt, 0, -0.125, 0.052); gun.magY = -0.125;
    return finishGun(gun, { sightY: 0.041, rail: [0, 0.036, 0.0], muzzleY: 0.02, muzzleZ: -0.135, underY: -0.03, underZ: -0.08, gripZ: 0.05, foreZ: 0.02, foreY: -0.04, hip: new V3(0.15, -0.15, -0.4), adsZ: -0.46 });
  },
  smg(gun) {
    const { g, mats } = gun;
    bx(g, 0.05, 0.06, 0.26, mats.metal, 0, 0, -0.04);
    const shroud = bx(g, 0.046, 0.046, 0.13, mats.poly, 0, 0.004, -0.23);
    for (let i = 0; i < 4; i++) bx(shroud, 0.048, 0.012, 0.012, mats.metal, 0, 0.012, -0.045 + i * 0.03);
    cy(g, 0.01, 0.08, mats.metal, 0, 0.004, -0.33);
    gun.parts.mag = bx(g, 0.026, 0.19, 0.04, mats.poly, 0, -0.12, -0.08); gun.magY = -0.12;
    bx(g, 0.027, 0.02, 0.041, mats.accent, 0, -0.2, -0.08);
    const grip = bx(g, 0.032, 0.09, 0.04, mats.poly, 0, -0.07, 0.05); grip.rotation.x = -0.25;
    bx(g, 0.012, 0.012, 0.18, mats.metal, 0.018, -0.005, 0.17); bx(g, 0.012, 0.012, 0.18, mats.metal, -0.018, -0.005, 0.17); bx(g, 0.05, 0.05, 0.012, mats.poly, 0, -0.015, 0.26);
    bx(g, 0.014, 0.012, 0.18, mats.metal, 0, 0.034, -0.05); bx(g, 0.004, 0.012, 0.006, mats.metal, 0, 0.045, -0.13); bx(g, 0.02, 0.012, 0.006, mats.metal, 0, 0.045, 0.03);
    return finishGun(gun, { sightY: 0.047, rail: [0, 0.04, -0.03], muzzleY: 0.004, muzzleZ: -0.37, underY: -0.02, underZ: -0.22, gripZ: 0.05, foreZ: -0.08, foreY: -0.2, hip: new V3(0.15, -0.15, -0.42), adsZ: -0.52 });
  },
  rifle(gun) {
    const { g, mats } = gun;
    bx(g, 0.06, 0.07, 0.36, mats.metal, 0, 0, -0.06);
    bx(g, 0.07, 0.068, 0.24, mats.poly, 0, 0.002, -0.35);
    for (let i = 0; i < 5; i++) bx(g, 0.072, 0.01, 0.02, mats.metal, 0, 0.038, -0.26 - i * 0.04);
    cy(g, 0.012, 0.22, mats.metal, 0, 0.005, -0.56); cy(g, 0.02, 0.06, mats.poly, 0, 0.005, -0.66);
    gun.parts.mag = bx(g, 0.036, 0.15, 0.07, mats.poly, 0, -0.1, -0.1); gun.parts.mag.rotation.x = 0.18; gun.magY = -0.1; bx(gun.parts.mag, 0.037, 0.02, 0.071, mats.accent, 0, -0.065, 0);
    const grip = bx(g, 0.036, 0.1, 0.045, mats.poly, 0, -0.08, 0.06); grip.rotation.x = -0.3;
    bx(g, 0.05, 0.075, 0.22, mats.poly, 0, -0.01, 0.22); bx(g, 0.052, 0.1, 0.05, mats.poly, 0, -0.02, 0.32);
    bx(g, 0.02, 0.012, 0.3, mats.metal, 0, 0.041, -0.08);
    bx(g, 0.006, 0.02, 0.008, mats.metal, 0, 0.056, -0.42); bx(g, 0.024, 0.018, 0.01, mats.metal, 0, 0.056, 0.05);
    bx(g, 0.015, 0.02, 0.04, mats.accent, 0.035, 0.005, -0.04);
    return finishGun(gun, { sightY: 0.062, rail: [0, 0.047, -0.08], muzzleY: 0.005, muzzleZ: -0.7, underY: -0.035, underZ: -0.38, gripZ: 0.06, foreZ: -0.3, foreY: -0.03, hip: new V3(0.17, -0.18, -0.5), adsZ: -0.62 });
  },
  burst(gun) {
    const { g, mats } = gun;
    bx(g, 0.064, 0.085, 0.5, mats.poly, 0, 0, 0.02);
    bx(g, 0.066, 0.02, 0.44, mats.accent, 0, -0.035, 0.02);
    cy(g, 0.013, 0.2, mats.metal, 0, 0.012, -0.33); cy(g, 0.022, 0.05, mats.metal, 0, 0.012, -0.44);
    bx(g, 0.03, 0.03, 0.34, mats.metal, 0, 0.056, -0.02);
    gun.parts.mag = bx(g, 0.036, 0.13, 0.065, mats.metal, 0, -0.1, 0.13); gun.magY = -0.1;
    const grip = bx(g, 0.036, 0.1, 0.045, mats.poly, 0, -0.085, -0.06); grip.rotation.x = -0.3;
    bx(g, 0.04, 0.02, 0.1, mats.metal, 0, -0.05, -0.1);
    bx(g, 0.006, 0.018, 0.008, mats.metal, 0, 0.08, -0.17); bx(g, 0.024, 0.016, 0.01, mats.metal, 0, 0.08, 0.1);
    return finishGun(gun, { sightY: 0.086, rail: [0, 0.071, -0.04], muzzleY: 0.012, muzzleZ: -0.47, underY: -0.045, underZ: -0.2, gripZ: -0.06, foreZ: -0.22, foreY: -0.04, hip: new V3(0.16, -0.18, -0.46), adsZ: -0.6 });
  },
  shotgun(gun) {
    const { g, mats } = gun;
    bx(g, 0.064, 0.075, 0.3, mats.metal, 0, 0, -0.04);
    cy(g, 0.017, 0.52, mats.metal, 0, 0.018, -0.44); gun.parts.mag = cy(g, 0.014, 0.42, mats.metal, 0, -0.022, -0.39); gun.tube = true;
    gun.parts.pump = bx(g, 0.058, 0.052, 0.17, mats.alt, 0, -0.022, -0.34);
    for (let i = 0; i < 6; i++) bx(gun.parts.pump, 0.06, 0.006, 0.01, mats.poly, 0, 0.02, -0.07 + i * 0.028);
    const grip = bx(g, 0.036, 0.1, 0.045, mats.alt, 0, -0.08, 0.1); grip.rotation.x = -0.35;
    bx(g, 0.052, 0.08, 0.26, mats.alt, 0, -0.02, 0.24);
    bx(g, 0.006, 0.01, 0.006, mats.accent, 0, 0.04, -0.69); bx(g, 0.02, 0.01, 0.02, mats.metal, 0, 0.042, 0.03);
    return finishGun(gun, { sightY: 0.045, rail: [0, 0.038, -0.02], muzzleY: 0.018, muzzleZ: -0.72, underY: -0.05, underZ: -0.46, gripZ: 0.1, foreZ: -0.34, foreY: -0.05, hip: new V3(0.17, -0.18, -0.52), adsZ: -0.64 });
  },
  lmg(gun) {
    const { g, mats } = gun;
    bx(g, 0.08, 0.09, 0.42, mats.metal, 0, 0, -0.04);
    const shroud = bx(g, 0.064, 0.064, 0.3, mats.poly, 0, 0.005, -0.4);
    for (let i = 0; i < 6; i++) bx(shroud, 0.066, 0.014, 0.018, mats.metal, 0, 0.01, -0.12 + i * 0.045);
    cy(g, 0.016, 0.22, mats.metal, 0, 0.005, -0.66); cy(g, 0.026, 0.06, mats.poly, 0, 0.005, -0.78);
    gun.parts.mag = bx(g, 0.1, 0.11, 0.13, mats.alt, -0.02, -0.1, -0.06); gun.magY = -0.1;
    bx(gun.parts.mag, 0.102, 0.02, 0.132, mats.accent, 0, 0.03, 0);
    const grip = bx(g, 0.038, 0.1, 0.045, mats.poly, 0, -0.085, 0.1); grip.rotation.x = -0.3;
    bx(g, 0.055, 0.085, 0.26, mats.poly, 0, -0.015, 0.28);
    bx(g, 0.012, 0.035, 0.1, mats.metal, 0, 0.065, -0.02); bx(g, 0.06, 0.012, 0.012, mats.metal, 0, 0.08, -0.02);
    bx(g, 0.012, 0.012, 0.22, mats.metal, 0.02, -0.04, -0.52); bx(g, 0.012, 0.012, 0.22, mats.metal, -0.02, -0.04, -0.52);
    bx(g, 0.006, 0.02, 0.008, mats.metal, 0, 0.06, -0.52); bx(g, 0.026, 0.02, 0.01, mats.metal, 0, 0.066, 0.1);
    return finishGun(gun, { sightY: 0.072, rail: [0, 0.052, 0.04], muzzleY: 0.005, muzzleZ: -0.81, underY: -0.035, underZ: -0.36, gripZ: 0.1, foreZ: -0.34, foreY: -0.03, hip: new V3(0.17, -0.2, -0.52), adsZ: -0.66 });
  },
  sniper(gun) {
    const { g, mats } = gun;
    bx(g, 0.06, 0.07, 0.4, mats.metal, 0, 0, -0.02);
    bx(g, 0.07, 0.07, 0.34, mats.poly, 0, -0.005, -0.38);
    cy(g, 0.014, 0.42, mats.metal, 0, 0.008, -0.74); cy(g, 0.024, 0.08, mats.metal, 0, 0.008, -0.97);
    const scope = new THREE.Group(); g.add(scope); gun.scopeMesh = scope;
    cy(scope, 0.028, 0.3, mats.poly, 0, 0.085, -0.08); cy(scope, 0.04, 0.07, mats.poly, 0, 0.085, -0.25, 0.03); cy(scope, 0.034, 0.06, mats.poly, 0, 0.085, 0.09, 0.028);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.036, 20), VMS_MAT.lens); lens.position.set(0, 0.085, -0.286); lens.rotation.y = Math.PI; scope.add(lens);
    bx(scope, 0.012, 0.035, 0.012, mats.metal, 0, 0.055, -0.14); bx(scope, 0.012, 0.035, 0.012, mats.metal, 0, 0.055, 0.02);
    gun.parts.bolt = new THREE.Group(); gun.parts.bolt.position.set(0.035, 0.02, 0.1); g.add(gun.parts.bolt); bx(gun.parts.bolt, 0.06, 0.012, 0.012, mats.metal, 0.03, 0, 0); const knob = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), mats.metal); knob.position.set(0.062, 0, 0); gun.parts.bolt.add(knob);
    gun.parts.mag = bx(g, 0.04, 0.07, 0.09, mats.poly, 0, -0.06, -0.05); gun.magY = -0.06;
    const grip = bx(g, 0.036, 0.1, 0.045, mats.poly, 0, -0.08, 0.1); grip.rotation.x = -0.3;
    bx(g, 0.055, 0.09, 0.28, mats.accent, 0, -0.02, 0.3); bx(g, 0.05, 0.02, 0.14, mats.poly, 0, 0.035, 0.28);
    return finishGun(gun, { sightY: 0.085, rail: [0, 0.035, -0.26], muzzleY: 0.008, muzzleZ: -1.02, underY: -0.04, underZ: -0.42, gripZ: 0.1, foreZ: -0.36, foreY: -0.04, hip: new V3(0.18, -0.18, -0.5), adsZ: -0.3 });
  },
  reaper(gun) {
    const { g, mats } = gun;
    const soul = new THREE.MeshBasicMaterial({ color: 0x9aff6a }); soul.color.convertSRGBToLinear();
    bx(g, 0.058, 0.072, 0.42, mats.metal, 0, 0, -0.02);
    bx(g, 0.066, 0.066, 0.3, mats.poly, 0, -0.004, -0.34);
    cy(g, 0.015, 0.46, mats.metal, 0, 0.008, -0.72); cy(g, 0.026, 0.07, mats.metal, 0, 0.008, -0.97);
    // skull muzzle brake
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 10), mats.alt); skull.scale.set(1, 1.1, 1.2); skull.position.set(0, 0.012, -1.03); g.add(skull);
    for (const s of [-1, 1]) bx(g, 0.012, 0.01, 0.004, soul, s * 0.013, 0.018, -1.07);
    // scythe blade slung under the barrel
    for (let i = 0; i < 7; i++) { const seg = bx(g, 0.006, 0.03 - i * 0.002, 0.06, mats.metal, 0, -0.05 - i * i * 0.0035, -0.5 - i * 0.055); seg.rotation.x = -i * 0.12; }
    bx(g, 0.008, 0.012, 0.36, mats.accent, 0, -0.038, -0.6);
    // Soulglass scope with a green glow
    const scope = new THREE.Group(); g.add(scope); gun.scopeMesh = scope;
    cy(scope, 0.03, 0.32, mats.poly, 0, 0.09, -0.08); cy(scope, 0.042, 0.07, mats.metal, 0, 0.09, -0.26, 0.032); cy(scope, 0.036, 0.06, mats.metal, 0, 0.09, 0.1, 0.03);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.038, 20), soul); lens.position.set(0, 0.09, -0.297); lens.rotation.y = Math.PI; scope.add(lens);
    for (const z of [-0.18, 0.02]) bx(scope, 0.012, 0.035, 0.012, mats.metal, 0, 0.058, z);
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.004, 6, 16), mats.accent); r.position.set(0, 0.09, -0.16 + i * 0.09); scope.add(r); }
    gun.parts.bolt = new THREE.Group(); gun.parts.bolt.position.set(0.035, 0.02, 0.1); g.add(gun.parts.bolt); bx(gun.parts.bolt, 0.06, 0.012, 0.012, mats.metal, 0.03, 0, 0); const knob = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), mats.alt); knob.position.set(0.064, 0, 0); gun.parts.bolt.add(knob);
    gun.parts.mag = bx(g, 0.04, 0.07, 0.09, mats.poly, 0, -0.06, -0.05); gun.magY = -0.06;
    const grip = bx(g, 0.036, 0.1, 0.045, mats.alt, 0, -0.08, 0.1); grip.rotation.x = -0.3;
    // bone stock with vertebrae ridges
    bx(g, 0.05, 0.085, 0.3, mats.alt, 0, -0.02, 0.31); for (let i = 0; i < 5; i++) bx(g, 0.056, 0.016, 0.02, mats.alt, 0, 0.03, 0.2 + i * 0.05);
    bx(g, 0.008, 0.04, 0.2, soul, 0.026, -0.02, 0.3);
    return finishGun(gun, { sightY: 0.09, rail: [0, 0.035, -0.26], muzzleY: 0.012, muzzleZ: -1.07, underY: -0.04, underZ: -0.42, gripZ: 0.1, foreZ: -0.36, foreY: -0.04, hip: new V3(0.18, -0.18, -0.5), adsZ: -0.3 });
  },
  fang(gun) {
    const { g, mats } = gun;
    const blood = new THREE.MeshBasicMaterial({ color: 0xff2a3a }); blood.color.convertSRGBToLinear();
    bx(g, 0.07, 0.08, 0.34, mats.metal, 0, 0, -0.04);
    bx(g, 0.072, 0.03, 0.3, mats.poly, 0, 0.03, -0.04);
    cy(g, 0.02, 0.46, mats.metal, 0, 0.02, -0.42); cy(g, 0.016, 0.38, mats.metal, 0, -0.022, -0.38);
    // two fangs at the muzzle
    for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.09, 8), mats.alt); f.rotation.x = -Math.PI / 2 - 0.25; f.position.set(s * 0.022, -0.012, -0.68); g.add(f); }
    bx(g, 0.062, 0.05, 0.16, mats.poly, 0, -0.024, -0.32);
    gun.parts.mag = bx(g, 0.05, 0.12, 0.08, mats.poly, 0, -0.1, -0.08); gun.magY = -0.1;
    bx(gun.parts.mag, 0.052, 0.02, 0.082, mats.accent, 0, -0.05, 0);
    const grip = bx(g, 0.036, 0.1, 0.045, mats.metal, 0, -0.08, 0.1); grip.rotation.x = -0.35;
    bx(g, 0.054, 0.08, 0.24, mats.poly, 0, -0.02, 0.24);
    // gold filigree bands and a blood vial in the stock
    for (const z of [-0.2, -0.05, 0.12]) bx(g, 0.074, 0.084, 0.012, mats.accent, 0, 0, z);
    cy(g, 0.012, 0.14, blood, 0.03, -0.01, 0.24);
    // Bloodglass holo sight: an open frame with a red ring reticle
    gun.ownSight = true;
    const hs = new THREE.Group(); hs.position.set(0, 0.04, -0.04); g.add(hs);
    bx(hs, 0.04, 0.008, 0.07, mats.metal, 0, 0.004, 0);
    bx(hs, 0.006, 0.05, 0.012, mats.metal, -0.022, 0.03, -0.02); bx(hs, 0.006, 0.05, 0.012, mats.metal, 0.022, 0.03, -0.02); bx(hs, 0.05, 0.006, 0.012, mats.metal, 0, 0.056, -0.02);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.038, 0.044), VMS_MAT.glass); glass.position.set(0, 0.031, -0.02); hs.add(glass);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.0045, 0.0062, 24), new THREE.MeshBasicMaterial({ color: 0xff2a3a, depthTest: false, transparent: true })); ring.position.set(0, 0.031, -0.021); ring.renderOrder = 10; hs.add(ring);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0012, 10), new THREE.MeshBasicMaterial({ color: 0xff6a6a, depthTest: false, transparent: true })); dot.position.set(0, 0.031, -0.0215); dot.renderOrder = 11; hs.add(dot);
    return finishGun(gun, { sightY: 0.071, rail: [0, 0.04, -0.02], muzzleY: 0.02, muzzleZ: -0.7, underY: -0.05, underZ: -0.44, gripZ: 0.1, foreZ: -0.32, foreY: -0.05, hip: new V3(0.17, -0.18, -0.5), adsZ: -0.58 });
  },
  plasma(gun) {
    const { g, mats } = gun;
    bx(g, 0.07, 0.08, 0.42, mats.poly, 0, 0, -0.04);
    bx(g, 0.074, 0.03, 0.3, mats.accent, 0, 0.03, -0.06);
    const win = bx(g, 0.03, 0.02, 0.16, VMS_MAT.cyan, 0.036, 0.01, -0.06);
    cy(g, 0.018, 0.2, mats.metal, 0, 0.005, -0.35);
    gun.coils = [];
    for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 8, 18), VMS_MAT.cyan); t.position.set(0, 0.005, -0.29 - i * 0.05); g.add(t); gun.coils.push(t); }
    cy(g, 0.03, 0.04, mats.metal, 0, 0.005, -0.47, 0.022);
    gun.parts.mag = bx(g, 0.045, 0.1, 0.07, mats.metal, 0, -0.085, -0.12); gun.magY = -0.085; bx(gun.parts.mag, 0.047, 0.05, 0.03, VMS_MAT.cyan, 0, -0.01, 0);
    const grip = bx(g, 0.036, 0.1, 0.045, mats.poly, 0, -0.08, 0.06); grip.rotation.x = -0.3;
    bx(g, 0.05, 0.07, 0.2, mats.poly, 0, -0.01, 0.24);
    bx(g, 0.006, 0.018, 0.008, mats.metal, 0, 0.054, -0.2); bx(g, 0.024, 0.016, 0.01, mats.metal, 0, 0.054, 0.08);
    void win;
    return finishGun(gun, { sightY: 0.07, rail: [0, 0.045, -0.02], muzzleY: 0.005, muzzleZ: -0.5, underY: -0.045, underZ: -0.3, gripZ: 0.06, foreZ: -0.26, foreY: -0.04, hip: new V3(0.17, -0.18, -0.48), adsZ: -0.6 });
  },
};
const GUNS = {};
for (const w of WEAPONS) GUNS[w.id] = BUILDERS[w.id](newGun(w));

// ---------------- skin patterns ----------------
// Painted once per skin onto a 256px canvas: pumpkins, bones, webs, candy corn, ghosts, runes and so on.
const hx = c => '#' + c.toString(16).padStart(6, '0');
function paintPattern(g, kind, s) {
  const S = 256, base = hx(s.poly), alt = hx(s.alt), acc = hx(s.accent);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
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
    g.globalAlpha = 0.5; g.fillStyle = alt; for (let i = 0; i < 40; i++) g.fillRect(rand(0, S), rand(0, S), 2, 2); g.globalAlpha = 1;
  } else if (kind === 'moon') {
    const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, base); gr.addColorStop(1, alt); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.fillStyle = '#ffffff'; for (let i = 0; i < 50; i++) { g.globalAlpha = rand(.3, .9); g.fillRect(rand(0, S), rand(0, S), 1.5, 1.5); } g.globalAlpha = 1;
    const mg = g.createRadialGradient(170, 80, 0, 170, 80, 60); mg.addColorStop(0, acc); mg.addColorStop(.6, acc); mg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = mg; g.beginPath(); g.arc(170, 80, 60, 0, 7); g.fill();
    g.fillStyle = '#050307'; for (const [bx, by, sc] of [[70, 60, 1], [120, 120, .7], [200, 170, .8], [40, 190, .6]]) { g.save(); g.translate(bx, by); g.scale(sc, sc); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-14, -12, -30, -4); g.quadraticCurveTo(-20, 0, -18, 8); g.quadraticCurveTo(-8, 2, 0, 8); g.quadraticCurveTo(8, 2, 18, 8); g.quadraticCurveTo(20, 0, 30, -4); g.quadraticCurveTo(14, -12, 0, 0); g.fill(); g.restore(); }
  } else if (kind === 'stitch') {
    for (let i = 0; i < 300; i++) { g.fillStyle = Math.random() < .5 ? alt : base; g.globalAlpha = .25; g.beginPath(); g.arc(rand(0, S), rand(0, S), rand(4, 14), 0, 7); g.fill(); } g.globalAlpha = 1;
    g.strokeStyle = '#0c0e0a'; g.lineWidth = 3;
    for (const [x0, y0, x1, y1] of [[20, 40, 230, 60], [40, 150, 210, 210], [130, 10, 110, 250]]) {
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      const n = 10; for (let i = 1; i < n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, a = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2; g.beginPath(); g.moveTo(x - Math.cos(a) * 7, y - Math.sin(a) * 7); g.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); g.stroke(); }
    }
    g.fillStyle = acc; for (const [x, y] of [[20, 40], [230, 60]]) { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); }
  } else if (kind === 'flames') {
    for (let i = 0; i < 9; i++) {
      const x = i * 32 + rand(-6, 6), h = rand(120, 230);
      const fg = g.createLinearGradient(0, S, 0, S - h); fg.addColorStop(0, acc); fg.addColorStop(0.6, alt); fg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = fg; g.beginPath(); g.moveTo(x - 18, S); g.quadraticCurveTo(x - 22, S - h * 0.5, x + rand(-8, 8), S - h); g.quadraticCurveTo(x + 22, S - h * 0.5, x + 18, S); g.fill();
    }
  } else if (kind === 'grave') {
    for (let i = 0; i < 6000; i++) { g.fillStyle = Math.random() < .5 ? alt : hx(s.metal); g.globalAlpha = .4; g.fillRect(rand(0, S), rand(0, S), 2, 2); } g.globalAlpha = 1;
    for (let i = 0; i < 12; i++) { const x = rand(0, S), y = rand(0, S), r = rand(10, 30); const mg = g.createRadialGradient(x, y, 0, x, y, r); mg.addColorStop(0, 'rgba(70,110,50,.7)'); mg.addColorStop(1, 'rgba(70,110,50,0)'); g.fillStyle = mg; g.fillRect(x - r, y - r, r * 2, r * 2); }
    g.strokeStyle = 'rgba(10,10,10,.6)'; g.lineWidth = 1.5; for (let k = 0; k < 6; k++) { let x = rand(0, S), y = rand(0, S); g.beginPath(); g.moveTo(x, y); for (let i = 0; i < 12; i++) { x += rand(-12, 12); y += rand(-12, 12); g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = acc; g.globalAlpha = .6; g.font = 'bold 26px serif'; g.textAlign = 'center'; g.fillText('R.I.P.', 128, 136); g.globalAlpha = 1;
  } else if (kind === 'vampire') {
    g.strokeStyle = alt; g.lineWidth = 3;
    for (let y = 0; y < S; y += 64) for (let x = 0; x < S; x += 64) {
      g.beginPath(); g.moveTo(x + 32, y + 4); g.bezierCurveTo(x + 60, y + 4, x + 60, y + 40, x + 32, y + 32); g.bezierCurveTo(x + 4, y + 40, x + 4, y + 4, x + 32, y + 4); g.stroke();
      g.beginPath(); g.moveTo(x + 32, y + 32); g.quadraticCurveTo(x + 46, y + 52, x + 32, y + 60); g.quadraticCurveTo(x + 18, y + 52, x + 32, y + 32); g.stroke();
    }
    g.fillStyle = acc; for (let i = 0; i < 6; i++) star(rand(10, 246), rand(10, 246), 4);
  }
}
const patternCache = {};
function skinTexture(key) {
  if (patternCache[key]) return patternCache[key];
  const s = SKINS[key]; const [c, g] = cv(256, 256); paintPattern(g, s.pattern, s);
  return (patternCache[key] = tex(c, 1, 1));
}
// apply a skin to any gun object (the live viewmodel or a Skin Studio preview)
function applySkinTo(gun, key) {
  const s = SKINS[key] || SKINS.stock, t = s.pattern ? skinTexture(key) : null;
  for (const [mk, col] of [['metal', s.metal], ['poly', s.poly], ['alt', s.alt], ['accent', s.accent]]) {
    const m = gun.mats[mk];
    const patterned = t && (mk === 'poly' || mk === 'alt');
    m.map = patterned ? t : null; m.color.setHex(patterned ? 0xffffff : col).convertSRGBToLinear(); m.needsUpdate = true;
  }
  gun.mats.accent.emissive.setHex(s.glow ? s.accent : 0x000000); gun.mats.accent.emissiveIntensity = s.glow ? 0.9 : 0;
  gun.mats.metal.metalness = s.shiny ? 1 : 0.85; gun.mats.metal.roughness = s.shiny ? 0.22 : 0.35;
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
