'use strict';
// Enemy factions. Every ten waves the attackers change: the machine legion, a goblin warband,
// then the restless dead, and around again. Each faction fills the same seven combat roles
// with its own creatures, projectiles, sounds and boss.

COL.ichor = new THREE.Color(0x5a8a2a); COL.ichorEnd = new THREE.Color(0x1a2a0a);
COL.bone = new THREE.Color(0xe8e0c8); COL.boneEnd = new THREE.Color(0x7a7262);
COL.wisp = new THREE.Color(0xc070ff); COL.wispEnd = new THREE.Color(0x2a0a40);

const GOB = { skin: 0x5e8a3a, leather: 0x5a3a22, cloth: 0x7a2a1e, metal: 0x8a8f94, wood: 0x6b4a2a };
const UND = { bone: 0xd8d0b8, rag: 0x3a3440, iron: 0x4a4e56, flesh: 0x6a7a68 };

// role is the AI behaviour borrowed from the robot of the same role; from = local wave of the faction it first appears
Object.assign(ENEMY_TYPES, {
  g_archer: { faction: 'goblins', role: 'grunt', name: 'Goblin Archer', hp: 85, speed: 4.6, radius: 0.4, height: 1.45, scale: 0.8, color: GOB.skin, glow: 0xffd040, pref: [10, 26], rate: [1.5, 2.4], dmg: 8, acc: 0.028, boltSpeed: 32, proj: 'arrow', coins: 10, xp: 20, score: 100, from: 1, weight: 10, map: '#9adf5a' },
  g_cutthroat: { faction: 'goblins', role: 'runner', name: 'Cutthroat', hp: 55, speed: 8.6, radius: 0.38, height: 1.35, scale: 0.75, color: GOB.skin, glow: 0xffd040, dmg: 9, meleeRate: 0.65, coins: 8, xp: 18, score: 110, from: 2, weight: 6, map: '#c8ff60' },
  g_bat: { faction: 'goblins', role: 'drone', name: 'Fire Bat', hp: 42, speed: 7.5, radius: 0.5, height: 0.5, color: 0x3a2a26, glow: 0xff8a20, rate: [1.1, 1.8], dmg: 6, acc: 0.05, boltSpeed: 30, proj: 'fire', coins: 12, xp: 22, score: 120, from: 3, weight: 5, map: '#ff8a20', flying: true },
  g_hunter: { faction: 'goblins', role: 'sniper', name: 'Crossbow Hunter', hp: 80, speed: 3.8, radius: 0.4, height: 1.45, scale: 0.82, color: GOB.skin, glow: 0xff4020, pref: [26, 55], dmg: 22, proj: 'bolt', beam: 0xff6a20, coins: 15, xp: 28, score: 150, from: 4, weight: 3, map: '#ff6a20' },
  g_sapper: { faction: 'goblins', role: 'exploder', name: 'Powder Sapper', hp: 48, speed: 7.2, radius: 0.42, height: 1.35, scale: 0.78, color: GOB.skin, glow: 0xffa030, dmg: 40, boom: 0xffa040, coins: 10, xp: 20, score: 120, from: 5, weight: 4, map: '#ffa030' },
  g_troll: { faction: 'goblins', role: 'tank', name: 'Cave Troll', hp: 650, speed: 2.5, radius: 0.75, height: 2.9, scale: 1.55, color: 0x6a7a5a, glow: 0xff7a2e, pref: [10, 28], rate: [2.6, 3.4], dmg: 18, acc: 0.03, boltSpeed: 24, coins: 35, xp: 70, score: 400, from: 6, weight: 1.4, map: '#ff7a2e' },
  g_shield: { faction: 'goblins', role: 'shield', name: 'Shieldbearer', hp: 190, speed: 3.8, radius: 0.48, height: 1.5, scale: 0.86, color: GOB.skin, glow: 0xffd040, pref: [6, 16], rate: [1.8, 2.8], dmg: 9, acc: 0.03, boltSpeed: 22, proj: 'dagger', coins: 20, xp: 35, score: 200, from: 7, weight: 3, map: '#d8b070' },
  g_shaman: { faction: 'goblins', role: 'grunt', name: 'Goblin Shaman', hp: 140, speed: 3.6, radius: 0.4, height: 1.45, scale: 0.82, color: 0x4e7a3a, glow: 0x5dff9a, pref: [12, 24], rate: [2, 3], dmg: 9, acc: 0.03, boltSpeed: 24, proj: 'hex', healer: true, coins: 25, xp: 40, score: 250, from: 99, weight: 0, map: '#5dff9a' },
  u_archer: { faction: 'undead', role: 'grunt', name: 'Bone Archer', hp: 90, speed: 4.2, radius: 0.4, height: 1.85, scale: 0.98, color: UND.bone, glow: 0xb060ff, pref: [10, 26], rate: [1.5, 2.4], dmg: 8, acc: 0.028, boltSpeed: 34, proj: 'bonearrow', coins: 10, xp: 20, score: 100, from: 1, weight: 10, map: '#d8d0b8' },
  u_ghoul: { faction: 'undead', role: 'runner', name: 'Ghoul', hp: 60, speed: 8.2, radius: 0.4, height: 1.6, scale: 0.9, color: UND.flesh, glow: 0x9aff6a, dmg: 11, meleeRate: 0.85, coins: 8, xp: 18, score: 110, from: 2, weight: 6, map: '#9aff6a' },
  u_wraith: { faction: 'undead', role: 'drone', name: 'Wraith', hp: 45, speed: 7, radius: 0.5, height: 0.5, color: 0x2a2434, glow: 0xc070ff, rate: [1.0, 1.7], dmg: 6, acc: 0.05, boltSpeed: 30, proj: 'spirit', coins: 12, xp: 22, score: 120, from: 3, weight: 5, map: '#c070ff', flying: true },
  u_deadeye: { faction: 'undead', role: 'sniper', name: 'Deadeye', hp: 85, speed: 3.6, radius: 0.4, height: 1.85, scale: 0.98, color: UND.bone, glow: 0xc070ff, pref: [26, 55], dmg: 22, proj: 'bonebolt', beam: 0xc070ff, coins: 15, xp: 28, score: 150, from: 4, weight: 3, map: '#c070ff' },
  u_bloater: { faction: 'undead', role: 'exploder', name: 'Bloater', hp: 55, speed: 6.4, radius: 0.5, height: 1.6, scale: 0.95, color: 0x6a7a58, glow: 0x9aff5a, dmg: 42, boom: 0x9aff5a, coins: 10, xp: 20, score: 120, from: 5, weight: 4, map: '#9aff5a' },
  u_colossus: { faction: 'undead', role: 'tank', name: 'Bone Colossus', hp: 680, speed: 2.3, radius: 0.75, height: 2.9, scale: 1.5, color: UND.bone, glow: 0xc070ff, pref: [10, 28], rate: [2.6, 3.4], dmg: 17, acc: 0.03, boltSpeed: 26, coins: 35, xp: 70, score: 400, from: 6, weight: 1.4, map: '#c070ff' },
  u_knight: { faction: 'undead', role: 'shield', name: 'Death Knight', hp: 200, speed: 3.6, radius: 0.5, height: 1.95, scale: 1.02, color: UND.iron, glow: 0x7cc8ff, pref: [6, 16], rate: [1.8, 2.8], dmg: 9, acc: 0.03, boltSpeed: 30, proj: 'spirit', coins: 20, xp: 35, score: 200, from: 7, weight: 3, map: '#7cc8ff' },
  u_acolyte: { faction: 'undead', role: 'grunt', name: 'Acolyte', hp: 140, speed: 3.6, radius: 0.4, height: 1.8, scale: 0.95, color: UND.bone, glow: 0x5dff9a, pref: [12, 24], rate: [2, 3], dmg: 9, acc: 0.03, boltSpeed: 26, proj: 'hex', healer: true, coins: 25, xp: 40, score: 250, from: 99, weight: 0, map: '#5dff9a' },
});
for (const k in ENEMY_TYPES) { ENEMY_TYPES[k].faction = ENEMY_TYPES[k].faction || 'robots'; ENEMY_TYPES[k].role = ENEMY_TYPES[k].role || k; }

const FACTIONS = [
  { id: 'robots', name: 'Machine legion', desc: 'Security robots: lasers, drones and armor.', bosses: ['titan', 'hive', 'bulwark'] },
  { id: 'goblins', name: 'Goblin warband', desc: 'Archers, dagger rushers, fire bats and cave trolls. Their Elder fights with two blades.', bosses: ['elder'] },
  { id: 'undead', name: 'Restless dead', desc: 'Bone archers, ghouls, wraiths and death knights, led by a Lich.', bosses: ['lich'] },
];
function factionForWave(w) { return FACTIONS[Math.floor((Math.max(1, w) - 1) / 10) % FACTIONS.length]; }
// the faction's local wave decides which of its troops have arrived; later eras bring them in sooner
function factionLocalWave(w) { const local = ((Math.max(1, w) - 1) % 10) + 1; return w > 10 ? Math.min(10, local * 2 + 1) : local; }
function factionRoster(w) { const f = factionForWave(w).id; return Object.keys(ENEMY_TYPES).filter(k => ENEMY_TYPES[k].faction === f && ENEMY_TYPES[k].weight > 0); }

// ---------------- projectile looks and sounds per faction ----------------
const PROJ = {
  arrow: { speed: 32, grav: 9, solid: 'arrow', sfx: p => SFX.bow(p) },
  bolt: { speed: 95, grav: 2, solid: 'arrow', sfx: p => SFX.bow(p, true) },
  bonearrow: { speed: 34, grav: 9, solid: 'bone', sfx: p => { SFX.bow(p); SFX.rattle(p); } },
  bonebolt: { speed: 95, grav: 2, solid: 'bone', sfx: p => SFX.bow(p, true) },
  dagger: { speed: 24, grav: 7, solid: 'dagger', sfx: p => SFX.throwBlade(p) },
  fire: { speed: 30, color: 0xff7a20, core: 0xffe0a0, size: 1.3, trailCol: COL.fire, sfx: p => SFX.spit(p) },
  spirit: { speed: 30, color: 0xc070ff, core: 0xf0d8ff, size: 1.0, trailCol: COL.wisp, sfx: p => SFX.wail(p) },
  hex: { speed: 24, color: 0x5dff9a, core: 0xe0ffe8, size: 1.1, trailCol: COL.green, sfx: p => SFX.spit(p) },
};
function projStyle(name, speed) {
  const p = PROJ[name];
  return { speed: speed || p.speed, grav: p.grav || 0, solid: p.solid || null, color: p.color, core: p.core, size: p.size, trailCol: p.trailCol };
}
// aim with gravity drop compensation, then fire
function fireProjectile(from, target, dmg, name, speedOverride) {
  const st = projStyle(name, speedOverride);
  const dist = from.distanceTo(target), t = dist / st.speed;
  if (st.grav) target.y += 0.5 * st.grav * t * t;
  spawnBolt(from, tv3.subVectors(target, from).normalize(), dmg, st);
  PROJ[name].sfx(from);
}

// ---------------- hit and death effects ----------------
function enemyHitFx(en, point, n, part) {
  const f = en && en.k ? en.k.faction : (en && en.faction) || 'robots';
  if (f === 'goblins') { sparks(point, part === 'head' ? 10 : 5, n, 4, COL.ichor, COL.ichorEnd); puff(point, 1, n, COL.dust, 0.2, 0.5); }
  else if (f === 'undead') { sparks(point, part === 'head' ? 10 : 5, n, 5, COL.bone, COL.boneEnd); sparks(point, 3, n, 2, COL.wisp, COL.wispEnd); puff(point, 1, n, COL.dust, 0.2, 0.5); }
  else { sparks(point, part === 'head' ? 12 : 6, n, 7, COL.elec, COL.elecEnd); sparks(point, 3, n, 5); if (Math.random() < 0.4) SMOKE.spawn(point, tv2.copy(n).multiplyScalar(1.5), 0.6, 0.1, 0.5, COL.oil, COL.smoke, { grav: 5, alpha: 0.8 }); }
}
function enemyDeathFx(e, p) {
  const f = e.k.faction;
  if (f === 'goblins') { SFX.squeal(p); sparks(p, 22, null, 6, COL.ichor, COL.ichorEnd); puff(p, 8, null, COL.dust, 0.7, 1.4); if (e.role === 'tank') SFX.growl(p); }
  else if (f === 'undead') { SFX.rattle(p); sparks(p, 24, null, 6, COL.bone, COL.boneEnd); for (let i = 0; i < 20; i++) FX.spawn(tv.copy(p).add(tv2.set(rand(-.4, .4), rand(-.5, .6), rand(-.4, .4))), tv2.set(rand(-.5, .5), rand(1, 3), rand(-.5, .5)), rand(.6, 1.2), .3, .02, COL.wisp, COL.wispEnd, { drag: 1 }); puff(p, 8, null, COL.dust, 0.7, 1.4); }
  else { SFX.botDie(p); sparks(p, 30, null, 9, COL.elec, COL.elecEnd); sparks(p, 20, null, 6); puff(p, 8, null, COL.smoke, 0.8, 1.6); }
}
function enemySpawnFx(k, p) {
  if (k.faction === 'goblins') { puff(tv.copy(p).setY(p.y + 0.2), 10, tv2.set(0, 1, 0), COL.dust, 0.6, 1.1); if (Math.random() < 0.4) SFX.squeal(p); }
  else if (k.faction === 'undead') { for (let i = 0; i < 30; i++) FX.spawn(tv.copy(p).add(tv2.set(rand(-.5, .5), rand(0, .3), rand(-.5, .5))), tv2.set(0, rand(1.5, 4), 0), rand(.5, 1), .25, .02, COL.wisp, COL.wispEnd, {}); puff(p, 6, tv2.set(0, 1, 0), COL.dust, 0.5, 1); if (Math.random() < 0.4) SFX.wail(p); }
  else { for (let i = 0; i < 40; i++) { tv.set(rand(-.3, .3), rand(0, 1), rand(-.3, .3)); FX.spawn(tv2.copy(p).add(tv).setY(p.y + rand(0, 3)), tv.set(0, rand(2, 6), 0), rand(.3, .8), .18, .02, COL.elec, COL.elecEnd, {}); } SFX.warp(p); }
}

// ---------------- creature models ----------------
// Same joint layout as the robots (hips at 0.95, legs, torso, head, arms), so one animation set drives every faction.
function buildCreature(kind, k) {
  const g = new THREE.Group(), hit = [];
  const gob = k.faction === 'goblins';
  const skinCol = k.color;
  const body = new THREE.MeshStandardMaterial({ color: skinCol, roughness: gob ? 0.75 : 0.6, metalness: 0.05, emissive: 0x000000 });
  const glow = new THREE.MeshBasicMaterial({ color: k.glow });
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8, metalness: 0.05 }, o));
  const leather = mat(gob ? GOB.leather : UND.rag), cloth = mat(gob ? GOB.cloth : 0x2a2430), metal = mat(gob ? GOB.metal : UND.iron, { roughness: 0.4, metalness: 0.8 }), wood = mat(GOB.wood);
  const part = (geo, m, x, y, z, parent, name) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); if (name) { o.userData.part = name; hit.push(o); } return o; };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const S = (r, a = 10, b = 8) => new THREE.SphereGeometry(r, a, b);
  const Cy = (r1, r2, h, n = 8) => new THREE.CylinderGeometry(r1, r2, h, n);
  const skeletal = k.faction === 'undead' && !['u_ghoul', 'u_bloater'].includes(kind);
  const limbW = skeletal ? 0.07 : 0.13;
  const root = new THREE.Group(); root.scale.setScalar(k.scale || 1); g.add(root);
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const role = k.role;
  // torso
  let torso;
  if (role === 'exploder') torso = part(S(0.42, 16, 12), gob ? leather : body, 0, 0.36, 0, hips, 'torso');
  else if (skeletal) {
    torso = part(B(0.4, 0.5, 0.24), new THREE.MeshStandardMaterial({ color: 0x000000, transparent: true, opacity: 0 }), 0, 0.36, 0, hips, 'torso');
    torso.castShadow = false;
    part(Cy(0.04, 0.04, 0.55), body, 0, 0, -0.06, torso);
    for (let i = 0; i < 4; i++) { const r = part(new THREE.TorusGeometry(0.17 - i * 0.012, 0.022, 5, 12, Math.PI * 1.4), body, 0, 0.16 - i * 0.1, 0.0, torso); r.rotation.set(Math.PI / 2, 0, -Math.PI * 0.2); }
    part(B(0.36, 0.08, 0.14), body, 0, -0.3, 0, torso);
  } else torso = part(B(gob ? 0.46 : 0.5, gob ? 0.52 : 0.58, 0.3), role === 'shield' || kind === 'u_knight' ? metal : (gob ? leather : body), 0, 0.36, 0, hips, 'torso');
  if (gob && role !== 'exploder') { part(B(0.48, 0.12, 0.32), cloth, 0, -0.22, 0, torso); part(B(0.5, 0.06, 0.33), leather, 0, -0.1, 0, torso); }
  if (kind === 'u_knight') { part(B(0.6, 0.14, 0.36), metal, 0, 0.25, 0, torso); part(B(0.3, 0.3, 0.05), mat(0x2a2e36), 0, 0.02, 0.16, torso); }
  if (kind === 'u_ghoul') torso.scale.set(0.9, 0.9, 1);
  // head
  const head = part(gob ? B(0.34, 0.3, 0.32) : (skeletal ? S(0.16, 12, 10) : B(0.3, 0.3, 0.3)), skeletal ? body : (gob ? body : body), 0, gob ? 0.47 : 0.52, gob ? 0.06 : 0, torso, 'head');
  if (skeletal) { head.scale.set(1, 1.15, 1.1); part(B(0.16, 0.07, 0.12), body, 0, -0.13, 0.04, head); }
  const eyeY = gob ? 0.03 : 0.02, eyeZ = gob ? 0.165 : 0.14;
  for (const s of [-1, 1]) {
    if (skeletal) { part(S(0.045, 6, 5), new THREE.MeshBasicMaterial({ color: 0x050505 }), s * 0.06, eyeY, eyeZ - 0.01, head); }
    part(S(gob ? 0.035 : 0.025, 6, 5), glow, s * (gob ? 0.08 : 0.06), eyeY, eyeZ + 0.005, head);
    if (gob) { const ear = part(new THREE.ConeGeometry(0.07, 0.3, 5), body, s * 0.24, 0.05, -0.02, head); ear.rotation.z = -s * 1.25; ear.rotation.x = -0.25; }
  }
  if (gob) { const nose = part(new THREE.ConeGeometry(0.045, 0.16, 5), body, 0, -0.03, 0.2, head); nose.rotation.x = Math.PI / 2; part(B(0.2, 0.04, 0.02), mat(0x1a1a10), 0, -0.1, 0.165, head); }
  // headgear
  if (kind === 'g_archer' || kind === 'g_hunter') { const hood = part(new THREE.ConeGeometry(0.24, 0.32, 8), cloth, 0, 0.2, -0.03, head); hood.rotation.x = -0.25; }
  if (kind === 'g_shield' || kind === 'g_sapper') part(new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), metal, 0, 0.1, 0, head);
  if (kind === 'g_shaman' || kind === 'u_acolyte') { for (let i = 0; i < 3; i++) { const f = part(B(0.03, 0.22, 0.03), new THREE.MeshBasicMaterial({ color: [0x5dff9a, 0xffd040, 0xff5a40][i] }), (i - 1) * 0.08, 0.24, -0.05, head); f.rotation.z = (i - 1) * 0.4; } }
  if (kind === 'u_knight') { part(B(0.34, 0.32, 0.34), metal, 0, 0.02, 0, head); part(B(0.22, 0.03, 0.02), glow, 0, 0.03, 0.175, head); }
  if (kind === 'u_deadeye' || kind === 'u_archer') { const hood = part(new THREE.ConeGeometry(0.22, 0.34, 8), mat(UND.rag), 0, 0.18, -0.03, head); hood.rotation.x = -0.3; }
  // legs and arms
  const legs = [], armsA = [];
  const shoulderX = role === 'exploder' ? 0.44 : (gob ? 0.3 : 0.32);
  for (const s of [-1, 1]) {
    const lp = new THREE.Group(); lp.position.set(s * 0.15, 0, 0); hips.add(lp); legs.push(lp);
    part(B(limbW + 0.03, 0.48, limbW + 0.04), skeletal ? body : (gob ? leather : body), 0, -0.24, 0, lp, 'limb');
    part(B(limbW, 0.46, limbW + 0.02), body, 0, -0.7, 0.02, lp, 'limb');
    part(B(skeletal ? 0.1 : 0.15, 0.07, gob ? 0.3 : 0.24), skeletal ? body : leather, 0, -0.93, 0.06, lp);
    const ap = new THREE.Group(); ap.position.set(s * shoulderX, 0.56 - (role === 'exploder' ? 0.18 : 0), 0); torso.add(ap); armsA.push(ap);
    part(S(skeletal ? 0.06 : 0.09, 8, 6), kind === 'u_knight' || role === 'shield' ? metal : body, 0, 0, 0, ap);
    part(B(limbW, 0.34, limbW + 0.01), body, 0, -0.18, 0, ap, 'limb');
    part(B(limbW - 0.01, 0.32, limbW), body, 0, -0.48, 0.0, ap, 'limb');
    part(S(skeletal ? 0.05 : 0.07, 8, 6), body, 0, -0.66, 0.0, ap);
  }
  if (kind === 'u_ghoul') armsA.forEach(a => { for (let i = -1; i <= 1; i++) { const c = part(new THREE.ConeGeometry(0.02, 0.18, 4), mat(0xd8d0b8), i * 0.035, -0.78, 0.03, a); c.rotation.x = Math.PI; } });
  let gunTip = null, tipMat = null; const extra = {};
  const rArm = armsA[1], lArm = armsA[0];
  if (role === 'runner') {
    if (kind === 'g_cutthroat') armsA.forEach(a => { part(B(0.025, 0.3, 0.07), metal, 0, -0.86, 0.03, a); part(B(0.08, 0.02, 0.03), leather, 0, -0.71, 0.03, a); });
  } else if (role === 'exploder') {
    const coreMat = new THREE.MeshBasicMaterial({ color: k.glow });
    if (gob) {
      const keg = part(Cy(0.2, 0.2, 0.36, 12), wood, 0, -0.05, 0.36, torso); keg.rotation.x = Math.PI / 2;
      for (const z of [-0.12, 0.12]) { const band = part(new THREE.TorusGeometry(0.205, 0.015, 5, 16), metal, 0, -0.05, 0.36 + z, torso); band.rotation.x = 0; }
      extra.core = part(S(0.07, 8, 6), coreMat, 0, 0.17, 0.4, torso, 'weak');
      part(Cy(0.012, 0.012, 0.12), mat(0x222222), 0, 0.12, 0.38, torso);
      lArm.rotation.x = -1.0; rArm.rotation.x = -1.0;
    } else {
      extra.core = part(S(0.18, 12, 10), coreMat, 0, -0.02, 0.36, torso, 'weak');
      for (let i = 0; i < 5; i++) part(S(rand(0.05, 0.09), 6, 5), coreMat, rand(-0.3, 0.3), rand(-0.25, 0.25), rand(0.2, 0.33), torso);
    }
    extra.coreMat = coreMat;
  } else {
    // ranged roles hold their weapon in the right hand, which the AI points at the player
    rArm.rotation.x = -1.35; lArm.rotation.x = -1.1; lArm.rotation.z = -0.5;
    tipMat = new THREE.MeshBasicMaterial({ color: k.glow, transparent: true, opacity: 0.3 });
    const proj = k.proj || '';
    if (proj === 'arrow' || proj === 'bonearrow') {
      const bowMat = proj === 'bonearrow' ? body : wood;
      const bow = new THREE.Group(); bow.position.set(0, -0.7, 0); rArm.add(bow);
      part(B(0.035, 0.035, 0.16), leather, 0, 0, 0, bow);
      for (const s of [-1, 1]) { const limb = part(B(0.025, 0.025, 0.42), bowMat, 0, -0.07, s * 0.28, bow); limb.rotation.x = s * 0.45; }
      part(B(0.006, 0.006, 0.86), mat(0xe8e0d0), 0, 0.12, 0, bow);
      part(B(0.012, 0.6, 0.012), proj === 'bonearrow' ? body : wood, 0, -0.12, 0, bow);
      gunTip = part(S(0.03, 6, 5), tipMat, 0, -0.44, 0, bow);
      const quiver = part(Cy(0.07, 0.06, 0.42, 8), leather, 0.1, 0.05, -0.2, torso); quiver.rotation.z = 0.4;
    } else if (proj === 'bolt' || proj === 'bonebolt') {
      const xb = new THREE.Group(); xb.position.set(0, -0.72, 0); rArm.add(xb);
      part(B(0.06, 0.55, 0.07), proj === 'bonebolt' ? body : wood, 0, -0.1, 0.02, xb);
      part(B(0.55, 0.04, 0.04), metal, 0, -0.32, 0.02, xb);
      part(B(0.5, 0.005, 0.005), mat(0xe8e0d0), 0, -0.26, 0.04, xb);
      gunTip = part(S(0.03, 6, 5), tipMat, 0, -0.4, 0.05, xb);
    } else if (role === 'tank') {
      const club = part(Cy(0.09, 0.05, 0.9, 8), gob ? wood : body, 0, -0.95, 0.15, rArm, 'limb'); club.rotation.x = 0.3;
      if (gob) for (let i = 0; i < 4; i++) part(new THREE.ConeGeometry(0.03, 0.08, 4), metal, Math.cos(i * 1.6) * 0.09, -1.25 - i * 0.04, 0.2 + Math.sin(i * 1.6) * 0.09, rArm);
      gunTip = part(S(0.16, 8, 6), tipMat, 0, -0.7, 0.12, lArm);
      part(B(0.4, 0.3, 0.12), glow, 0, 0.05, -0.17, torso, 'weak');
      part(S(0.2, 8, 6), body, 0, 0.42, -0.08, torso);
    } else if (proj === 'hex') {
      const staff = part(Cy(0.02, 0.025, 1.3, 6), wood, 0, -0.6, 0, rArm); staff.rotation.x = 0;
      gunTip = part(S(0.07, 8, 6), tipMat, 0, -1.25, 0, rArm);
      part(S(0.04, 6, 5), glow, 0, -1.25, 0, rArm);
      part(B(0.5, 0.4, 0.08), cloth, 0, -0.32, -0.16, torso);
    } else if (proj === 'dagger') {
      part(B(0.025, 0.3, 0.07), metal, 0, -0.86, 0.03, rArm);
      gunTip = part(S(0.03, 6, 5), tipMat, 0, -0.95, 0.03, rArm);
    } else {
      // spirit casters (death knight): a sword and a palm-glow
      part(B(0.04, 0.8, 0.09), metal, 0, -1.0, 0.03, rArm);
      gunTip = part(S(0.05, 6, 5), tipMat, 0, -0.7, 0.0, lArm);
    }
    if (role === 'shield') {
      const sh = new THREE.Group(); sh.position.set(0, -0.05, 0.5); torso.add(sh);
      const shMat = kind === 'u_knight' ? metal : wood;
      const plate = part(B(0.95, 1.25, 0.07), shMat, 0, -0.25, 0, sh, 'shield');
      if (gob) { for (const y of [-0.7, 0.2]) part(B(1.0, 0.06, 0.09), metal, 0, y, 0, sh); part(S(0.1, 8, 6), metal, 0, -0.25, 0.05, sh); }
      else part(B(0.2, 0.2, 0.02), glow, 0, -0.1, 0.045, sh);
      void plate;
      part(B(0.3, 0.28, 0.1), glow, 0, 0, -0.2, torso, 'weak');
      extra.shield = sh;
    }
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = meshVolume(o) > 0.012; });
  return Object.assign({ g, root, hips, torso, head, legs, arms: armsA, hit, body, glow, gunTip, tipMat }, extra);
}

// flying creatures share the drone interface: { g, hit, body, glow, gunTip, tipMat, rotors, eye }
function buildFlyer(kind, k) {
  const g = new THREE.Group(), hit = [];
  const body = new THREE.MeshStandardMaterial({ color: k.color, roughness: 0.8, metalness: 0.05, emissive: 0x000000 });
  const glow = new THREE.MeshBasicMaterial({ color: k.glow });
  const add = (geo, mat, x, y, z, name, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); if (name) { m.userData.part = name; hit.push(m); } return m; };
  const tipMat = new THREE.MeshBasicMaterial({ color: k.glow, transparent: true, opacity: 0.3 });
  const wings = [];
  let eye;
  if (kind === 'g_bat') {
    add(new THREE.SphereGeometry(0.24, 12, 10), body, 0, 0, 0, 'torso');
    eye = add(new THREE.SphereGeometry(0.15, 10, 8), body, 0, 0.06, 0.24, 'head');
    for (const s of [-1, 1]) {
      add(new THREE.SphereGeometry(0.035, 6, 5), glow, s * 0.06, 0.1, 0.36);
      const ear = add(new THREE.ConeGeometry(0.05, 0.16, 4), body, s * 0.08, 0.2, 0.22); ear.rotation.z = -s * 0.3;
      const wg = new THREE.Group(); wg.position.set(s * 0.2, 0.04, 0); g.add(wg); wings.push(wg);
      const mem = add(new THREE.BoxGeometry(0.7, 0.02, 0.42), new THREE.MeshStandardMaterial({ color: 0x5a2a20, roughness: 0.9, side: THREE.DoubleSide }), s * 0.36, 0, -0.04, 'limb', wg);
      void mem;
      add(new THREE.BoxGeometry(0.72, 0.03, 0.03), body, s * 0.36, 0.01, 0.17, null, wg);
    }
    add(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff6a20 }), 0, -0.02, 0.37);
  } else {
    // wraith: a hooded, ragged robe with a skull and grasping hands
    const robe = add(new THREE.ConeGeometry(0.34, 1.0, 10, 1, true), new THREE.MeshStandardMaterial({ color: k.color, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x000000 }), 0, -0.25, 0, 'torso');
    robe.material = body; body.side = THREE.DoubleSide;
    add(new THREE.ConeGeometry(0.22, 0.34, 10), body, 0, 0.36, -0.02);
    eye = add(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: UND.bone, roughness: 0.6 }), 0, 0.28, 0.06, 'head');
    for (const s of [-1, 1]) {
      add(new THREE.SphereGeometry(0.03, 6, 5), glow, s * 0.05, 0.3, 0.17);
      const wg = new THREE.Group(); wg.position.set(s * 0.2, 0.12, 0.05); g.add(wg); wings.push(wg);
      add(new THREE.BoxGeometry(0.06, 0.4, 0.06), body, s * 0.05, -0.2, 0.08, 'limb', wg);
    }
  }
  const gunTip = add(new THREE.SphereGeometry(0.05, 8, 6), tipMat, 0, 0, 0.42);
  g.traverse(o => { if (o.isMesh) o.castShadow = o.userData.part === 'torso'; });
  return { g, hit, body, glow, gunTip, tipMat, rotors: [], eye, wings };
}

// ---------------- Goblin Elder: dual-wielding warlord with a support warband ----------------
BOSSES.push(
  { id: 'elder', name: 'Goblin Elder', title: 'Dual-blade warlord and his warband', hp: 4600, faction: 'goblins' },
  { id: 'lich', name: 'The Lich', title: 'Necromancer of the restless dead', hp: 4400, faction: 'undead' },
);
BOSSES.forEach(b => { b.faction = b.faction || 'robots'; });

// shared helpers for creature bosses: walking via the nav field, telegraphed ground rings, summoning
class WarlordBase extends BossBase {
  summonRing(kinds, n, radius = 6) {
    let made = 0;
    for (let i = 0; i < n * 3 && made < n; i++) {
      const a = rand(0, Math.PI * 2), d = rand(radius * 0.6, radius);
      const p = new V3(this.pos.x + Math.cos(a) * d, 0, this.pos.z + Math.sin(a) * d);
      if (!pointFree(p.x, p.z, 0.6, 0.1, 1.8)) continue;
      p.y = groundAt(p.x, p.z, this.pos.y + 1);
      const e = new Enemy(pick(kinds), p); e.minion = true; enemies.push(e); made++;
    }
    return made;
  }
  minionCount() { return enemies.filter(e => e.minion && !e.dead).length; }
  walkToward(dt, speed, stopAt) {
    const b = this.body, dx = player.pos.x - b.pos.x, dz = player.pos.z - b.pos.z, dist = Math.hypot(dx, dz) || 0.01;
    let wx = 0, wz = 0;
    if (dist > stopAt) {
      const wp = (Math.abs(player.pos.y - b.pos.y) > 0.8 || dist > 6) ? navNext(b.pos, this.wp || (this.wp = new V3())) : null;
      if (wp) { const ex = wp.x - b.pos.x, ez = wp.z - b.pos.z, ed = Math.hypot(ex, ez) || 1; wx = ex / ed; wz = ez / ed; } else { wx = dx / dist; wz = dz / dist; }
    }
    b.vel.x = damp(b.vel.x, wx * speed, 5, dt); b.vel.z = damp(b.vel.z, wz * speed, 5, dt);
    moveBody(b, dt, 0.6);
    return dist;
  }
  face(dt, rate = 6) { const t = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z); let d = t - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * Math.min(1, dt * rate); this.group.rotation.y = this.yaw; }
  ring(p, r, t, color = 0xff3020) { const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.9, r, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.copy(p).setY(p.y + 0.06); scene.add(m); this.rings.push({ m, t, max: t }); return m; }
  updateRings(dt) { for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.t -= dt; r.m.material.opacity = 0.35 + 0.45 * Math.abs(Math.sin(time * 14)); if (r.t <= 0) { scene.remove(r.m); this.rings.splice(i, 1); } } }
  cleanup() { this.rings.forEach(r => scene.remove(r.m)); this.rings.length = 0; if (this.extraCleanup) this.extraCleanup(); }
}

class ElderBoss extends WarlordBase {
  constructor(p, cycle) {
    super(BOSSES.find(b => b.id === 'elder'), cycle);
    this.faction = 'goblins'; this.mapColor = '#9adf5a';
    this.body = { pos: p.clone(), vel: new V3(), radius: 0.9, height: 3.2, onGround: true };
    this.pos = this.body.pos; this.centerY = 1.9; this.yaw = 0; this.rings = [];
    const G = this.group, skin = this.mat(0x4e7a32, { roughness: 0.75, metalness: 0.05 }), robe = this.mat(0x5a1e2a, { roughness: 0.9, metalness: 0 }), gold = this.mat(0xd4a93a, { roughness: 0.3, metalness: 0.9 }), steel = this.mat(0xc8d0d8, { roughness: 0.25, metalness: 0.95 }), hair = this.mat(0xd8d8d0, { roughness: 1, metalness: 0 });
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const add = (geo, m, x, y, z, parent, part) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); if (part) this.mark(o, part); else o.castShadow = true; return o; };
    this.hips = new THREE.Group(); this.hips.position.y = 1.35; G.add(this.hips);
    this.legs = [];
    for (const s of [-1, 1]) { const l = new THREE.Group(); l.position.set(s * 0.28, 0, 0); this.hips.add(l); add(B(0.26, 0.7, 0.28), robe, 0, -0.35, 0, l, 'limb'); add(B(0.22, 0.65, 0.24), skin, 0, -0.95, 0.02, l, 'limb'); add(B(0.26, 0.1, 0.42), this.mat(0x3a2618), 0, -1.3, 0.08, l); this.legs.push(l); }
    this.torso = new THREE.Group(); this.torso.position.y = 0.1; this.hips.add(this.torso);
    add(B(0.95, 1.0, 0.55), robe, 0, 0.5, 0, this.torso, 'body');
    add(new THREE.ConeGeometry(0.7, 1.1, 10, 1, true), robe, 0, -0.25, 0, this.torso);
    // glowing war-amulet: the weak point
    this.amulet = add(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0x5dff9a }), 0, 0.72, 0.31, this.torso, 'weak');
    add(new THREE.TorusGeometry(0.22, 0.025, 6, 16, Math.PI), gold, 0, 0.92, 0.28, this.torso).rotation.z = Math.PI;
    for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.28, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold, s * 0.55, 1.0, 0, this.torso, 'body');
    this.head = add(B(0.56, 0.5, 0.52), skin, 0, 1.3, 0.08, this.torso, 'head');
    for (const s of [-1, 1]) {
      add(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd040 }), s * 0.13, 0.05, 0.27, this.head);
      const ear = add(new THREE.ConeGeometry(0.1, 0.5, 5), skin, s * 0.42, 0.06, -0.02, this.head); ear.rotation.z = -s * 1.3;
    }
    add(new THREE.ConeGeometry(0.07, 0.26, 5), skin, 0, -0.02, 0.33, this.head).rotation.x = Math.PI / 2;
    const beard = add(new THREE.ConeGeometry(0.24, 0.75, 8), hair, 0, -0.5, 0.2, this.head); beard.rotation.x = Math.PI;
    for (let i = 0; i < 5; i++) { const sp = add(new THREE.ConeGeometry(0.05, 0.4, 4), gold, (i - 2) * 0.12, 0.38, -0.05, this.head); sp.rotation.z = (i - 2) * 0.2; }
    // two curved blades
    this.arms = []; this.blades = [];
    this.bladeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const s of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(s * 0.62, 0.95, 0); this.torso.add(a); this.arms.push(a);
      add(B(0.2, 0.6, 0.2), skin, 0, -0.3, 0, a, 'limb'); add(B(0.18, 0.55, 0.18), skin, 0, -0.85, 0.05, a, 'limb');
      const hilt = new THREE.Group(); hilt.position.set(0, -1.15, 0.1); a.add(hilt);
      add(B(0.07, 0.25, 0.07), this.mat(0x3a2618), 0, 0, 0, hilt); add(B(0.3, 0.05, 0.08), gold, 0, -0.14, 0, hilt);
      for (let i = 0; i < 6; i++) { const seg = add(B(0.03, 0.22, 0.11 - i * 0.012), steel, 0, -0.26 - i * 0.18, 0.03 + i * i * 0.012, hilt); seg.rotation.x = -i * 0.08; }
      const trail = add(B(0.02, 1.1, 0.14), this.bladeMat, 0, -0.75, 0.15, hilt); trail.castShadow = false;
      this.blades.push(hilt);
    }
    this.group.traverse(o => { if (o.isMesh && o.material !== this.bladeMat) o.castShadow = true; });
    this.group.position.copy(this.pos);
    this.state = 'walk'; this.stateT = 0; this.atkT = 1.5; this.leapT = 5; this.fanT = 6; this.summonT = 2; this.spinT = 8; this.walkPh = 0; this.combo = 0;
    this.minionKinds = ['g_cutthroat', 'g_cutthroat', 'g_archer'];
  }
  phaseText(n) { return n === 2 ? 'Throwing blades and a bigger warband · keep moving' : 'Berserk whirlwind · get distance when the blades glow'; }
  onPhase(n) { this.summonT = 0.5; if (n === 3) this.minionKinds = ['g_cutthroat', 'g_sapper', 'g_archer']; }
  extraCleanup() { }
  update(dt) {
    this.t += dt; this.spawnT = Math.min(1, this.spawnT + dt * 0.9); this.stunT = Math.max(0, this.stunT - dt); this.flash(dt); this.updateRings(dt);
    const b = this.body;
    this.amulet.rotation.y += dt * 2; this.amulet.scale.setScalar(1 + Math.sin(this.t * 6) * 0.12);
    this.bladeMat.opacity = Math.max(0, this.bladeMat.opacity - dt * 2);
    if (this.spawnT < 1 || this.stunT > 0 || !player.alive) { b.vel.x *= 0.8; b.vel.z *= 0.8; moveBody(b, dt, 0.6); this.group.position.copy(b.pos); return; }
    const enraged = this.phase === 3, speed = enraged ? 5.2 : 3.8;
    this.stateT -= dt;
    let dist = Math.hypot(player.pos.x - b.pos.x, player.pos.z - b.pos.z);
    // warband: opens with a guard of cutthroats and a shaman who heals the Elder
    this.summonT -= dt;
    if (this.summonT <= 0) {
      this.summonT = this.phase === 1 ? 13 : 10;
      const cap = 4 + this.phase * 2 + this.cycle;
      const room = cap - this.minionCount();
      if (room > 0) { const n = this.summonRing(this.minionKinds, Math.min(room, 2 + this.phase), 7); if (n) { SFX.growl(this.pos); ui.toast('The Elder calls his warband', `${n} goblins join the fight`, 'drop'); } }
      if (!enemies.some(e => e.k && e.k.healer && !e.dead)) this.summonRing(['g_shaman'], 1, 9);
    }
    if (this.state === 'walk') {
      dist = this.walkToward(dt, speed, 2.6);
      this.face(dt);
      this.atkT -= dt; this.leapT -= dt; this.fanT -= dt; this.spinT -= dt;
      if (dist < 3.4 && this.atkT <= 0) { this.state = 'windup'; this.stateT = enraged ? 0.28 : 0.4; this.combo = 2; SFX.whoosh(this.pos); }
      else if (dist > 9 && dist < 30 && this.leapT <= 0) { this.state = 'crouch'; this.stateT = 0.55; this.leapTarget = player.pos.clone(); this.leapTarget.y = groundAt(this.leapTarget.x, this.leapTarget.z, player.pos.y + 0.5); this.ring(this.leapTarget, 4.2, 1.5); SFX.growl(this.pos); }
      else if (this.phase >= 2 && dist > 6 && this.fanT <= 0) { this.state = 'fan'; this.stateT = 0.5; SFX.whoosh(this.pos); }
      else if (enraged && this.spinT <= 0 && dist < 14) { this.state = 'spin'; this.stateT = 3; this.spinHit = 0; this.bladeMat.opacity = 0.9; SFX.roar(this.pos); }
    } else if (this.state === 'windup') {
      b.vel.multiplyScalar(0.8); moveBody(b, dt, 0.6); this.face(dt, 10);
      this.bladeMat.opacity = 0.8;
      if (this.stateT <= 0) {
        // a slash from one blade, then the other
        const s = this.combo % 2 ? 1 : 0;
        this.swing = { arm: s, t: 0.25 };
        SFX.slash(this.pos);
        const reach = Math.hypot(player.pos.x - b.pos.x, player.pos.z - b.pos.z);
        const ang = Math.atan2(player.pos.x - b.pos.x, player.pos.z - b.pos.z) - this.yaw;
        if (reach < 3.6 && Math.cos(ang) > 0.2 && Math.abs(player.pos.y - b.pos.y) < 2) hurtPlayer(16 * this.dmgMul, b.pos);
        this.combo--;
        if (this.combo > 0) { this.stateT = 0.3; } else { this.state = 'walk'; this.atkT = enraged ? 0.9 : 1.5; }
      }
    } else if (this.state === 'crouch') {
      b.vel.multiplyScalar(0.7); moveBody(b, dt, 0.6); this.face(dt, 8);
      if (this.stateT <= 0) { this.state = 'leap'; this.stateT = 0.9; this.leapFrom = b.pos.clone(); SFX.whoosh(this.pos); }
    } else if (this.state === 'leap') {
      const u = 1 - Math.max(0, this.stateT) / 0.9;
      b.pos.lerpVectors(this.leapFrom, this.leapTarget, u); b.pos.y += Math.sin(u * Math.PI) * 6; b.vel.set(0, 0, 0);
      if (this.stateT <= 0) {
        b.pos.copy(this.leapTarget); this.state = 'walk'; this.leapT = enraged ? 5 : 7.5; this.atkT = 0.6;
        SFX.stomp(b.pos); SFX.boom(b.pos, 0.5); shake = Math.min(1.3, shake + 0.7);
        blast(tv.copy(b.pos).setY(b.pos.y + 0.2), 4.5, 0xc0a060, 0xffe0a0); puff(tv.copy(b.pos), 18, tv2.set(0, 1, 0), COL.dust, 1.2, 1.3);
        const d = Math.hypot(player.pos.x - b.pos.x, player.pos.z - b.pos.z);
        if (d < 4.4 && Math.abs(player.pos.y - b.pos.y) < 1.6) { hurtPlayer(30 * this.dmgMul, b.pos); tv.set(player.pos.x - b.pos.x, 0, player.pos.z - b.pos.z).normalize(); player.vel.addScaledVector(tv, 10); player.vel.y += 5; }
      }
    } else if (this.state === 'fan') {
      b.vel.multiplyScalar(0.85); moveBody(b, dt, 0.6); this.face(dt, 10);
      if (this.stateT <= 0) {
        // a fan of thrown daggers from both hands
        const n = this.phase === 3 ? 9 : 7;
        this.blades[1].getWorldPosition(tv);
        for (let i = 0; i < n; i++) { const tgt = playerAim(tv2, 0.25); const side = tv4.set(-(tgt.z - tv.z), 0, tgt.x - tv.x).normalize(); tgt.addScaledVector(side, (i - (n - 1) / 2) * 1.4); fireProjectile(tv.clone(), tgt.clone(), 9 * this.dmgMul, 'dagger', 30); }
        this.state = 'walk'; this.fanT = enraged ? 4 : 6;
      }
    } else if (this.state === 'spin') {
      // whirlwind: spins toward the player, hitting everything near
      this.group.rotation.y += dt * 18;
      const dx = player.pos.x - b.pos.x, dz = player.pos.z - b.pos.z, d = Math.hypot(dx, dz) || 1;
      b.vel.x = damp(b.vel.x, dx / d * 4.2, 3, dt); b.vel.z = damp(b.vel.z, dz / d * 4.2, 3, dt); moveBody(b, dt, 0.6);
      this.spinHit -= dt;
      if (this.spinHit <= 0) { this.spinHit = 0.3; SFX.whoosh(b.pos); if (d < 3.2 && Math.abs(player.pos.y - b.pos.y) < 2) hurtPlayer(9 * this.dmgMul, b.pos); }
      this.bladeMat.opacity = 0.9;
      if (this.stateT <= 0) { this.state = 'walk'; this.spinT = 8; this.atkT = 1.2; this.yaw = this.group.rotation.y; }
    }
    this.group.position.copy(b.pos);
    // animation
    const sp = Math.hypot(b.vel.x, b.vel.z);
    this.walkPh += dt * sp * 1.6;
    const sw = Math.sin(this.walkPh) * Math.min(1, sp / 2) * 0.5;
    this.legs[0].rotation.x = sw; this.legs[1].rotation.x = -sw;
    this.hips.position.y = 1.35 + Math.abs(Math.cos(this.walkPh)) * 0.06 * Math.min(1, sp) - (this.state === 'crouch' ? 0.35 : 0);
    let a0 = -0.4 + sw * 0.6, a1 = -0.4 - sw * 0.6;
    if (this.state === 'windup' || this.state === 'crouch') { a0 = -2.4; a1 = -2.4; }
    if (this.state === 'fan') { a1 = -2.2; }
    if (this.state === 'spin') { a0 = -1.5; a1 = -1.5; this.arms[0].rotation.z = -1.2; this.arms[1].rotation.z = 1.2; } else { this.arms[0].rotation.z = 0; this.arms[1].rotation.z = 0; }
    if (this.swing) { this.swing.t -= dt; const k = Math.max(0, this.swing.t / 0.25); if (this.swing.arm === 0) a0 = -2.4 + (1 - k) * 2.6; else a1 = -2.4 + (1 - k) * 2.6; if (this.swing.t <= 0) this.swing = null; }
    this.arms[0].rotation.x = damp(this.arms[0].rotation.x, a0, 18, dt); this.arms[1].rotation.x = damp(this.arms[1].rotation.x, a1, 18, dt);
    this.torso.rotation.x = this.state === 'crouch' ? 0.35 : 0.1;
  }
}

// ---------------- The Lich: floating necromancer who raises the dead ----------------
class LichBoss extends WarlordBase {
  constructor(p, cycle) {
    super(BOSSES.find(b => b.id === 'lich'), cycle);
    this.faction = 'undead'; this.mapColor = '#c070ff';
    this.body = { pos: p.clone(), vel: new V3(), radius: 0.8, height: 3.2, onGround: true, gravity: 0 };
    this.pos = this.body.pos; this.centerY = 2.2; this.yaw = 0; this.rings = []; this.hover = 0.6;
    const G = this.group, robe = this.mat(0x241c2c, { roughness: 0.95, metalness: 0 }), bone = this.mat(UND.bone, { roughness: 0.6, metalness: 0 }), gold = this.mat(0xb08a30, { roughness: 0.35, metalness: 0.9 });
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const add = (geo, m, x, y, z, parent, part) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); if (part) this.mark(o, part); else o.castShadow = true; return o; };
    this.root = new THREE.Group(); G.add(this.root);
    const r1 = add(new THREE.ConeGeometry(0.9, 2.2, 12, 1, true), robe, 0, 1.2, 0, this.root, 'body'); r1.material.side = THREE.DoubleSide;
    add(B(0.9, 0.9, 0.5), robe, 0, 2.3, 0, this.root, 'body');
    for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.26, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold, s * 0.52, 2.72, 0, this.root, 'body');
    this.gem = add(new THREE.OctahedronGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0xc070ff }), 0, 2.45, 0.28, this.root, 'weak');
    this.head = add(new THREE.SphereGeometry(0.28, 14, 12), bone, 0, 3.05, 0.05, this.root, 'head'); this.head.scale.set(1, 1.15, 1.05);
    for (const s of [-1, 1]) { add(new THREE.SphereGeometry(0.075, 6, 5), new THREE.MeshBasicMaterial({ color: 0x050505 }), s * 0.1, 0.03, 0.22, this.head); add(new THREE.SphereGeometry(0.04, 6, 5), new THREE.MeshBasicMaterial({ color: 0xc070ff }), s * 0.1, 0.03, 0.26, this.head); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const sp = add(new THREE.ConeGeometry(0.05, 0.3, 4), gold, Math.cos(a) * 0.24, 0.28, Math.sin(a) * 0.24, this.head); sp.rotation.z = 0; }
    add(new THREE.ConeGeometry(0.42, 0.6, 10, 1, true), robe, 0, 3.15, -0.05, this.root).material.side = THREE.DoubleSide;
    this.arms = [];
    for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(s * 0.6, 2.6, 0); this.root.add(a); this.arms.push(a); add(B(0.12, 0.8, 0.12), bone, 0, -0.4, 0, a, 'limb'); add(B(0.3, 0.5, 0.3), robe, 0, -0.15, 0, a); }
    const staff = add(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 6), this.mat(0x2a2030, { roughness: 0.8, metalness: 0.1 }), 0, -0.6, 0.15, this.arms[1]);
    void staff;
    this.orb = add(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshBasicMaterial({ color: 0x9aff6a }), 0, 0.75, 0.15, this.arms[1]);
    this.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.group.position.copy(this.pos);
    this.volleyT = 2.5; this.summonT = 1.5; this.blinkT = 6; this.novaT = 7; this.minionKinds = ['u_archer', 'u_ghoul', 'u_ghoul'];
  }
  phaseText(n) { return n === 2 ? 'It blinks away when you get close · soul volleys grow' : 'Grave nova · the dead rise faster'; }
  onPhase(n) { this.summonT = 0.4; if (n === 3) this.minionKinds = ['u_ghoul', 'u_bloater', 'u_archer', 'u_knight']; }
  update(dt) {
    this.t += dt; this.spawnT = Math.min(1, this.spawnT + dt * 0.8); this.stunT = Math.max(0, this.stunT - dt); this.flash(dt); this.updateRings(dt);
    const b = this.body;
    this.gem.rotation.y += dt * 2.5; this.orb.scale.setScalar(1 + Math.sin(this.t * 5) * 0.15);
    const ground = groundAt(b.pos.x, b.pos.z, b.pos.y + 1);
    this.root.position.y = this.hover + Math.sin(this.t * 1.6) * 0.18;
    for (let i = 0; i < 2; i++) if (Math.random() < 0.5) FX.spawn(tv.copy(b.pos).add(tv2.set(rand(-.7, .7), 0.2, rand(-.7, .7))), tv2.set(0, rand(.5, 1.5), 0), rand(.6, 1.1), .35, .02, COL.wisp, COL.wispEnd, {});
    if (this.spawnT < 1 || this.stunT > 0 || !player.alive) { this.group.position.copy(b.pos); return; }
    const dist = this.walkToward(dt, this.phase === 3 ? 3.4 : 2.6, 12);
    b.pos.y = Math.max(b.pos.y, ground);
    this.face(dt, 4);
    this.group.position.copy(b.pos);
    this.arms[0].rotation.x = damp(this.arms[0].rotation.x, this.cast > 0 ? -1.6 : -0.3, 8, dt);
    this.arms[1].rotation.x = damp(this.arms[1].rotation.x, this.cast > 0 ? -1.2 : -0.5, 8, dt);
    this.cast = Math.max(0, (this.cast || 0) - dt);
    // soul volleys
    this.volleyT -= dt;
    if (this.volleyT <= 0) {
      this.volleyT = this.phase === 1 ? 2.8 : 2;
      this.orb.getWorldPosition(tv); const n = this.phase === 3 ? 7 : 5;
      for (let i = 0; i < n; i++) { const tgt = playerAim(tv2, 0.3); tgt.x += rand(-2.2, 2.2); tgt.z += rand(-2.2, 2.2); tgt.y += rand(-0.3, 0.6); fireProjectile(tv.clone(), tgt.clone(), 8 * this.dmgMul, 'spirit', 26); }
      this.cast = 0.5;
    }
    // raise the dead from the ground around the Lich
    this.summonT -= dt;
    if (this.summonT <= 0) {
      this.summonT = this.phase === 3 ? 7 : 10;
      const cap = 4 + this.phase * 2 + this.cycle, room = cap - this.minionCount();
      if (room > 0) { const n = this.summonRing(this.minionKinds, Math.min(room, 2 + this.phase), 8); if (n) { SFX.wail(this.pos); ui.toast('The dead rise', `${n} undead answer the Lich`, 'drop'); } }
      if (!enemies.some(e => e.k && e.k.healer && !e.dead)) this.summonRing(['u_acolyte'], 1, 10);
      this.cast = 0.8;
    }
    // blink away from close threats
    if (this.phase >= 2) {
      this.blinkT -= dt;
      if (this.blinkT <= 0 && dist < 7) {
        this.blinkT = 5;
        for (let tries = 0; tries < 20; tries++) {
          const a = rand(0, Math.PI * 2), d = rand(14, 22), x = player.pos.x + Math.cos(a) * d, z = player.pos.z + Math.sin(a) * d;
          if (Math.abs(x) > world.half - 3 || Math.abs(z) > world.half - 3 || !pointFree(x, z, 1, 0.1, 3.2)) continue;
          for (let i = 0; i < 30; i++) FX.spawn(tv.copy(b.pos).setY(b.pos.y + rand(0, 3)), randDir(tv2, rand(2, 6)), rand(.4, .8), .4, .03, COL.wisp, COL.wispEnd, { drag: 2 });
          b.pos.set(x, groundAt(x, z), z); SFX.wail(b.pos); SFX.warp(b.pos); break;
        }
      }
    }
    // grave nova: a ring that erupts under the player
    if (this.phase === 3) {
      this.novaT -= dt;
      if (this.novaT <= 0) {
        this.novaT = 6;
        const at = player.pos.clone(); at.y = groundAt(at.x, at.z, player.pos.y + 0.5);
        this.ring(at, 3.5, 1.2, 0xc070ff);
        setTimeout(() => { if (this.dead || !run.active) return; blast(tv.copy(at).setY(at.y + 0.2), 3.5, 0xc070ff, 0xf0d8ff); SFX.boom(at, 0.4); if (Math.hypot(player.pos.x - at.x, player.pos.z - at.z) < 3.6 && Math.abs(player.pos.y - at.y) < 1.5) hurtPlayer(24 * this.dmgMul, at); }, 1200);
      }
    }
    // healing from the acolyte shows on the gem
    this.gem.material.color.setHex(this.healedT > 0 ? 0x9aff6a : 0xc070ff); this.healedT = Math.max(0, (this.healedT || 0) - dt);
  }
}
const BOSS_CLASSES = { titan: TitanBoss, hive: HiveBoss, bulwark: BulwarkBoss, elder: ElderBoss, lich: LichBoss };
// which boss guards a boss wave: each faction cycles through its own bosses
function bossDefForWave(w) {
  const f = factionForWave(w), era = Math.floor((w - 1) / 10), slot = w % 10 === 0 ? 1 : 0;
  const n = Math.floor(era / FACTIONS.length) * 2 + slot;
  return BOSSES.find(b => b.id === f.bosses[n % f.bosses.length]);
}
