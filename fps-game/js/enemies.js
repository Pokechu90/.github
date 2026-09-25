'use strict';
// Robots: seven regular types and three bosses with phases and weak points.

const ENEMY_TYPES = {
  grunt: { name: 'Grunt', hp: 100, speed: 4.2, radius: 0.45, height: 1.95, scale: 1, color: 0x8a939b, glow: 0xff3b2a, pref: [9, 24], rate: [1.4, 2.4], dmg: 7, acc: 0.035, boltSpeed: 42, coins: 10, xp: 20, score: 100, from: 1, weight: 10, map: '#ff4a3d' },
  runner: { name: 'Runner', hp: 55, speed: 8, radius: 0.4, height: 1.7, scale: 0.88, color: 0x5d5448, glow: 0xffa020, dmg: 10, coins: 8, xp: 18, score: 110, from: 2, weight: 6, map: '#ffa020' },
  drone: { name: 'Drone', hp: 45, speed: 7, radius: 0.5, height: 0.5, color: 0x3a4550, glow: 0x40ffd0, rate: [1.0, 1.7], dmg: 5, acc: 0.05, boltSpeed: 38, coins: 12, xp: 22, score: 120, from: 3, weight: 5, map: '#40ffd0', flying: true },
  sniper: { name: 'Marksman', hp: 80, speed: 3.6, radius: 0.42, height: 1.9, scale: 0.97, color: 0x4a5040, glow: 0xff2a6a, pref: [26, 55], dmg: 22, coins: 15, xp: 28, score: 150, from: 4, weight: 3, map: '#ff2a6a' },
  exploder: { name: 'Bomber', hp: 45, speed: 7.4, radius: 0.45, height: 1.6, scale: 0.85, color: 0x6a5a28, glow: 0xffe030, dmg: 40, coins: 10, xp: 20, score: 120, from: 5, weight: 4, map: '#ffe030' },
  tank: { name: 'Juggernaut', hp: 600, speed: 2.3, radius: 0.7, height: 2.8, scale: 1.45, color: 0x3f4852, glow: 0xc040ff, pref: [12, 30], rate: [2.6, 3.4], dmg: 16, acc: 0.03, boltSpeed: 30, coins: 35, xp: 70, score: 400, from: 6, weight: 1.4, map: '#c040ff' },
  shield: { name: 'Bulwark', hp: 180, speed: 3.6, radius: 0.5, height: 1.95, scale: 1.05, color: 0x55606a, glow: 0x7cc8ff, pref: [6, 16], rate: [1.8, 2.8], dmg: 8, acc: 0.035, boltSpeed: 40, coins: 20, xp: 35, score: 200, from: 7, weight: 3, map: '#7cc8ff' },
};
const enemies = [];
let enemyId = 0;
function waveScale(w) {
  const d = DIFFICULTY[run.diff];
  return { hp: (1 + 0.09 * (w - 1)) * d.hp, speed: Math.min(1.35, 1 + 0.015 * (w - 1)) * d.speed, dmg: (1 + 0.035 * (w - 1)) * d.dmg };
}
function playerAim(out, lead = 0) {
  out.copy(player.pos).setY(player.pos.y + eyeHeight() - 0.35);
  if (lead) out.addScaledVector(player.vel, lead);
  return out;
}
const botDark = new THREE.MeshStandardMaterial({ color: 0x181c20, roughness: 0.6, metalness: 0.7 });
const energyMat = new THREE.MeshBasicMaterial({ color: 0x7cc8ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

// damage multiplier per hit location
function partMult(part, headMult) { return part === 'head' ? headMult : part === 'weak' ? 2.5 : part === 'limb' ? 0.8 : 1; }

function buildBot(kind, k) {
  const g = new THREE.Group(); const hit = [];
  const body = new THREE.MeshStandardMaterial({ color: k.color, roughness: 0.42, metalness: 0.75, emissive: 0x000000 });
  const glow = new THREE.MeshBasicMaterial({ color: k.glow });
  const part = (geo, mat, x, y, z, parent, name) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); if (name) { m.userData.part = name; hit.push(m); } return m; };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const root = new THREE.Group(); root.scale.setScalar(k.scale); g.add(root);
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const torso = part(kind === 'exploder' ? new THREE.SphereGeometry(0.42, 16, 12) : B(0.62, 0.66, 0.4), body, 0, 0.42, 0, hips, 'torso');
  if (kind !== 'exploder') { part(B(0.44, 0.3, 0.06), botDark, 0, 0.05, 0.22, torso); part(B(0.3, 0.06, 0.02), glow, 0, 0.12, 0.26, torso); }
  part(B(0.4, 0.2, 0.34), botDark, 0, -0.34, 0, torso);
  const head = part(B(0.34, 0.3, 0.34), body, 0, kind === 'exploder' ? 0.52 : 0.53, 0, torso, 'head');
  if (kind === 'sniper') { part(new THREE.SphereGeometry(0.09, 10, 8), glow, 0, 0.02, 0.17, head); part(B(0.03, 0.4, 0.03), botDark, -0.12, 0.3, -0.05, head); }
  else part(B(0.28, 0.07, 0.03), glow, 0, 0.02, 0.175, head);
  part(B(0.03, 0.14, 0.03), botDark, 0.12, 0.2, -0.05, head);
  const legs = [], armsA = [];
  for (const s of [-1, 1]) {
    const lp = new THREE.Group(); lp.position.set(s * 0.17, 0, 0); hips.add(lp); legs.push(lp);
    part(B(0.18, 0.5, 0.2), body, 0, -0.25, 0, lp, 'limb'); part(B(0.16, 0.48, 0.18), botDark, 0, -0.72, 0.02, lp, 'limb'); part(B(0.2, 0.08, 0.3), body, 0, -0.93, 0.05, lp);
    const ap = new THREE.Group(); ap.position.set(s * (kind === 'exploder' ? 0.46 : 0.42), 0.66 - (kind === 'exploder' ? 0.2 : 0), 0); torso.add(ap); armsA.push(ap);
    part(B(0.22, 0.2, 0.26), body, s * 0.03, 0.02, 0, ap);
    part(B(0.13, 0.62, 0.15), botDark, 0, -0.33, 0, ap, 'limb');
  }
  let gunTip = null, tipMat = null, extra = {};
  const rArm = armsA[1];
  if (kind === 'runner') {
    armsA.forEach(a => { const bl = part(B(0.03, 0.5, 0.12), glow, 0, -0.8, 0.05, a); bl.rotation.x = 0.3; });
  } else if (kind === 'exploder') {
    const core = part(new THREE.SphereGeometry(0.2, 14, 10), glow, 0, 0, 0.34, torso, 'weak');
    extra.core = core; extra.coreMat = glow;
    for (let i = 0; i < 3; i++) { const r = part(new THREE.TorusGeometry(0.43, 0.025, 6, 20), botDark, 0, -0.1 + i * 0.1, 0, torso); r.rotation.x = Math.PI / 2; }
  } else {
    rArm.rotation.x = -1.35; armsA[0].rotation.x = -1.1; armsA[0].rotation.z = -0.5;
    tipMat = new THREE.MeshBasicMaterial({ color: k.glow, transparent: true, opacity: 0.3 });
    if (kind === 'sniper') {
      part(B(0.07, 1.1, 0.08), botDark, 0, -1.0, 0.04, rArm, 'limb'); part(B(0.06, 0.25, 0.09), body, 0, -0.75, 0.1, rArm);
      gunTip = part(new THREE.SphereGeometry(0.05, 8, 6), tipMat, 0, -1.58, 0.04, rArm);
    } else if (kind === 'tank') {
      part(B(0.14, 0.62, 0.18), botDark, 0, -0.78, 0.04, rArm, 'limb');
      const cannon = part(new THREE.CylinderGeometry(0.16, 0.2, 0.9, 12), botDark, 0.05, 0.25, 0.25, armsA[1]); cannon.rotation.x = 0; cannon.position.set(0.1, -0.2, 0.2);
      gunTip = part(new THREE.SphereGeometry(0.14, 10, 8), tipMat, 0, -1.2, 0.04, rArm);
      part(B(0.7, 0.5, 0.12), body, 0, 0.1, 0.26, torso); part(B(0.4, 0.3, 0.12), glow, 0, 0.0, -0.27, torso, 'weak');
      armsA.forEach(a => part(B(0.34, 0.14, 0.36), glow, 0, 0.14, 0, a));
    } else {
      part(B(0.12, 0.62, 0.16), botDark, 0, -0.78, 0.04, rArm, 'limb');
      part(B(0.07, 0.16, 0.07), M.steel, 0, -1.12, 0.04, rArm);
      gunTip = part(new THREE.SphereGeometry(0.06, 10, 8), tipMat, 0, -1.22, 0.04, rArm);
    }
    if (kind === 'shield') {
      const sh = new THREE.Group(); sh.position.set(0, -0.05, 0.62); torso.add(sh);
      const plate = part(B(1.05, 1.35, 0.06), energyMat, 0, -0.25, 0, sh, 'shield'); plate.castShadow = false;
      part(B(1.1, 0.06, 0.1), botDark, 0, 0.44, 0, sh); part(B(1.1, 0.06, 0.1), botDark, 0, -0.94, 0, sh);
      part(B(0.06, 1.4, 0.1), botDark, -0.55, -0.25, 0, sh); part(B(0.06, 1.4, 0.1), botDark, 0.55, -0.25, 0, sh);
      part(B(0.36, 0.34, 0.12), glow, 0, 0, -0.27, torso, 'weak');
      extra.shield = sh;
    }
  }
  g.traverse(o => { if (o.isMesh && o.material !== energyMat) o.castShadow = true; });
  return Object.assign({ g, root, hips, torso, head, legs, arms: armsA, hit, body, glow, gunTip, tipMat }, extra);
}

function buildDrone(k) {
  const g = new THREE.Group(), hit = [];
  const body = new THREE.MeshStandardMaterial({ color: k.color, roughness: 0.4, metalness: 0.8, emissive: 0x000000 });
  const glow = new THREE.MeshBasicMaterial({ color: k.glow });
  const add = (geo, mat, x, y, z, name) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); if (name) { m.userData.part = name; hit.push(m); } return m; };
  add(new THREE.BoxGeometry(0.62, 0.22, 0.62), body, 0, 0, 0, 'torso');
  add(new THREE.BoxGeometry(0.4, 0.12, 0.4), botDark, 0, 0.16, 0);
  const eye = add(new THREE.SphereGeometry(0.14, 12, 10), glow, 0, -0.02, 0.33, 'head');
  const rotors = [];
  for (const [x, z] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
    const arm = add(new THREE.BoxGeometry(0.08, 0.05, 0.5), botDark, x * 0.6, 0.02, z * 0.6, 'limb'); arm.lookAt(0, 0.02, 0);
    const rotor = add(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 14), new THREE.MeshBasicMaterial({ color: 0x9aa4ad, transparent: true, opacity: 0.35 }), x, 0.1, z);
    rotors.push(rotor);
  }
  const tipMat = new THREE.MeshBasicMaterial({ color: k.glow, transparent: true, opacity: 0.3 });
  add(new THREE.BoxGeometry(0.08, 0.08, 0.3), botDark, 0, -0.16, 0.1);
  const gunTip = add(new THREE.SphereGeometry(0.05, 8, 6), tipMat, 0, -0.16, 0.28);
  return { g, hit, body, glow, gunTip, tipMat, rotors, eye };
}

class Enemy {
  constructor(kind, p) {
    this.kind = kind; this.k = ENEMY_TYPES[kind]; this.id = ++enemyId;
    const ws = waveScale(Math.max(1, run.wave));
    this.hpMax = Math.round(this.k.hp * ws.hp); this.hp = this.hpMax; this.speedMul = ws.speed; this.dmgMul = ws.dmg;
    this.flying = !!this.k.flying;
    this.body = { pos: p.clone(), vel: new V3(), radius: this.k.radius, height: this.k.height * (this.k.scale || 1), onGround: true };
    this.pos = this.body.pos;
    this.m = this.flying ? buildDrone(this.k) : buildBot(kind, this.k);
    this.hitMeshes = this.m.hit;
    this.hitMeshes.forEach(h => h.userData.enemy = this);
    scene.add(this.m.g); this.m.g.position.copy(p);
    if (this.flying) { this.pos.y = groundAt(p.x, p.z) + 5; this.alt = rand(4, 6.5); this.orbit = Math.random() < 0.5 ? 1 : -1; this.orbitT = rand(2, 4); }
    this.fireT = rand(1.2, 2.6); this.losT = 0; this.los = false; this.strafe = Math.random() < .5 ? 1 : -1; this.strafeT = rand(1, 3);
    this.stuckT = 0; this.wanderT = 0; this.wander = new V3(); this.phase = Math.random() * 6; this.spawnT = 0; this.flashT = 0; this.meleeT = 0.8; this.burst = 0; this.burstT = 0; this.yaw = 0; this.charged = false; this.swing = 0; this.kick = 0; this.stunT = 0;
    this.armT = -1; this.beepT = 0; this.aimT = 0; this.dead = false; this.lastDir = new V3(0, 0, 1);
    this.mapColor = this.k.map; this.mapSize = kind === 'tank' ? 2 : 1.4;
    if (kind === 'sniper') { this.beam = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1), new THREE.MeshBasicMaterial({ color: 0xff2a4a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(this.beam); }
    for (let i = 0; i < 40; i++) { tv.set(rand(-.3, .3), rand(0, 1), rand(-.3, .3)); FX.spawn(tv2.copy(p).add(tv).setY(p.y + rand(0, 3)), tv.set(0, rand(2, 6), 0), rand(.3, .8), .18, .02, COL.elec, COL.elecEnd, {}); }
    SFX.warp(p);
  }
  eye(out) { return this.flying ? out.copy(this.pos) : out.copy(this.pos).setY(this.pos.y + this.body.height * 0.85); }
  center(out) { return this.flying ? out.copy(this.pos) : out.copy(this.pos).setY(this.pos.y + this.body.height * 0.55); }
  stun(t) { this.stunT = Math.max(this.stunT, t); this.charged = false; this.armT = this.armT > 0 ? this.armT + 0.8 : this.armT; }
  update(dt) {
    const k = this.k, m = this.m;
    this.spawnT = Math.min(1, this.spawnT + dt * 2.2);
    const s = this.spawnT < 1 ? 1 + 1.7 * Math.pow(this.spawnT - 1, 3) + 0.7 * Math.pow(this.spawnT - 1, 2) : 1;
    m.g.scale.setScalar(Math.max(0.01, s));
    this.flashT = Math.max(0, this.flashT - dt);
    if (this.stunT > 0) {
      this.stunT -= dt;
      m.body.emissive.setHex(0x3a7cff); m.body.emissiveIntensity = 0.4 + Math.random() * 0.5;
      if (Math.random() < 0.3) { this.center(tv); sparks(tv.add(tv2.set(rand(-.4, .4), rand(-.5, .5), rand(-.4, .4))), 2, null, 4, COL.elec, COL.elecEnd); }
      if (this.flying) { this.body.vel.multiplyScalar(0.9); this.pos.y = Math.max(groundAt(this.pos.x, this.pos.z) + 1.2, this.pos.y - dt * 1.5); m.g.position.copy(this.pos); m.rotors.forEach(r => r.rotation.y += dt * 8); }
      else { this.body.vel.x *= 0.8; this.body.vel.z *= 0.8; moveBody(this.body, dt); m.g.position.copy(this.pos); }
      if (this.beam) this.beam.material.opacity = 0;
      return;
    }
    m.body.emissive.setHex(this.flashT > 0 ? 0xffffff : 0x000000); m.body.emissiveIntensity = this.flashT > 0 ? 0.9 : 0;
    if (this.flying) return this.updateDrone(dt);
    const b = this.body;
    const dx = player.pos.x - b.pos.x, dz = player.pos.z - b.pos.z, dist = Math.hypot(dx, dz) || 0.001;
    const tx = dx / dist, tz = dz / dist;
    this.dist = dist;
    this.losT -= dt;
    if (this.losT <= 0) {
      this.losT = rand(0.18, 0.32); this.eye(tv); playerAim(tv2).y += 0.3;
      const had = this.los; this.los = !segBlocked(tv, tv2);
      if (!had && this.los && k.rate) this.fireT = Math.max(this.fireT, weaponRuntime().silenced ? 1.4 : 0.5);
    }
    let wx = 0, wz = 0, speed = k.speed * this.speedMul;
    if (this.kind === 'runner' || this.kind === 'exploder') { if (dist > 1.6 && this.armT < 0) { wx = tx; wz = tz; } }
    else {
      this.strafeT -= dt; if (this.strafeT <= 0) { this.strafe *= -1; this.strafeT = rand(1.2, 3); }
      if (!this.los || dist > k.pref[1]) { wx = tx; wz = tz; }
      else if (dist < k.pref[0]) { wx = -tx * 0.8; wz = -tz * 0.8; }
      else if (this.kind === 'sniper' && this.aimT > 0) { wx = wz = 0; }
      else { wx = -tz * this.strafe; wz = tx * this.strafe; speed *= this.kind === 'shield' ? 0.4 : 0.55; if (this.kind === 'shield') { wx += tx * 0.6; wz += tz * 0.6; } }
    }
    if (this.wanderT > 0) { this.wanderT -= dt; wx = this.wander.x; wz = this.wander.z; }
    else if (wx || wz) { const d = this.steer(wx, wz); wx = d[0]; wz = d[1]; }
    for (const o of enemies) { if (o === this || o.flying || o.isBoss) continue; const ox = b.pos.x - o.body.pos.x, oz = b.pos.z - o.body.pos.z, od = Math.hypot(ox, oz), min = b.radius + o.body.radius + 0.3; if (od < min && od > 1e-3) { wx += ox / od * (min - od) * 2; wz += oz / od * (min - od) * 2; } }
    if (this.spawnT < 0.6) { wx = wz = 0; }
    b.vel.x = damp(b.vel.x, wx * speed, 7, dt); b.vel.z = damp(b.vel.z, wz * speed, 7, dt);
    const px = b.pos.x, pz = b.pos.z; b.blocked = false;
    moveBody(b, dt);
    const moved = Math.hypot(b.pos.x - px, b.pos.z - pz);
    if ((wx || wz) && moved < speed * dt * 0.25) { this.stuckT += dt; if (this.stuckT > 0.7) { this.stuckT = 0; this.wanderT = rand(0.8, 1.6); const a = Math.atan2(wz, wx) + (Math.random() < .5 ? 1 : -1) * rand(1.2, 2.2); this.wander.set(Math.cos(a), 0, Math.sin(a)); } }
    else this.stuckT = Math.max(0, this.stuckT - dt);
    const face = (this.los || dist < 12 || this.kind === 'shield') ? Math.atan2(dx, dz) : (Math.abs(b.vel.x) + Math.abs(b.vel.z) > 0.3 ? Math.atan2(b.vel.x, b.vel.z) : this.yaw);
    let dy = face - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * Math.min(1, dt * (this.kind === 'shield' ? 5 : 8));
    m.g.position.copy(b.pos); m.g.rotation.y = this.yaw;
    const sp = Math.hypot(b.vel.x, b.vel.z); this.phase += dt * sp * (this.kind === 'runner' || this.kind === 'exploder' ? 1.9 : 2.3);
    const sw = Math.sin(this.phase) * Math.min(1, sp / 2) * 0.7;
    m.legs[0].rotation.x = sw; m.legs[1].rotation.x = -sw; m.hips.position.y = 0.95 + Math.abs(Math.cos(this.phase)) * 0.05 * Math.min(1, sp / 2);
    if (this.kind === 'runner') { m.torso.rotation.x = 0.35; this.swing = Math.max(0, this.swing - dt * 4); m.arms[0].rotation.x = -sw * 1.2 - this.swing * 2.2; m.arms[1].rotation.x = sw * 1.2 - this.swing * 2.2; }
    else if (this.kind === 'exploder') { m.torso.rotation.x = 0.25; m.arms[0].rotation.x = -sw; m.arms[1].rotation.x = sw; }
    else if (m.gunTip) { const aimP = Math.atan2((player.pos.y + 1.3) - (b.pos.y + b.height * 0.75), dist); m.arms[1].rotation.x = -1.35 - (this.los ? aimP : 0) + this.kick; this.kick = Math.max(0, this.kick - dt * 3); }
    if (!player.alive || this.spawnT < 1) return;
    if (this.kind === 'runner') {
      this.meleeT -= dt;
      if (dist < 2.0 && Math.abs(player.pos.y - b.pos.y) < 1.4 && this.meleeT <= 0) { this.meleeT = 1.0; this.swing = 1; SFX.slash(b.pos); hurtPlayer(k.dmg * this.dmgMul, b.pos); }
      return;
    }
    if (this.kind === 'exploder') return this.updateExploder(dt, dist);
    if (this.kind === 'sniper') return this.updateSniper(dt, dist);
    if (this.burst > 0) { this.burstT -= dt; if (this.burstT <= 0) { this.fire(); this.burst--; this.burstT = 0.16; } }
    if (this.los && dist < 60) {
      this.fireT -= dt;
      const win = 0.45;
      if (this.fireT < win) { if (!this.charged) { this.charged = true; SFX.charge(b.pos); } const c = 1 - Math.max(0, this.fireT) / win; m.tipMat.opacity = 0.3 + c * 0.7; m.gunTip.scale.setScalar(1 + c * 1.4); }
      if (this.fireT <= 0) { this.fireT = rand(k.rate[0], k.rate[1]) * (dist < 10 ? 0.8 : 1); this.resetTip(); if (this.kind === 'tank') this.fireTank(); else this.fire(); }
    } else { this.fireT = Math.max(this.fireT, 0.7); if (this.charged) this.resetTip(); }
  }
  resetTip() { this.charged = false; if (this.m.tipMat) { this.m.tipMat.opacity = 0.3; this.m.gunTip.scale.setScalar(1); } }
  updateExploder(dt, dist) {
    const m = this.m;
    this.beepT -= dt;
    const pulse = this.armT >= 0 ? 0.08 : clamp(dist / 30, 0.15, 0.6);
    if (this.beepT <= 0) { this.beepT = pulse; SFX.beep(this.pos, this.armT >= 0 ? 2600 : 1800); m.coreMat.color.setHex(0xffffff); }
    else if (this.beepT < pulse * 0.6) m.coreMat.color.setHex(this.k.glow);
    if (this.armT < 0 && dist < 2.6 && Math.abs(player.pos.y - this.pos.y) < 1.5) { this.armT = 0.55; this.body.vel.set(0, 0, 0); }
    if (this.armT >= 0) {
      this.armT -= dt; m.g.scale.setScalar(1 + (0.55 - this.armT) * 0.4);
      if (this.armT <= 0) { this.selfDestruct = true; this.damage(9999, { part: 'torso', dir: tv.set(0, 1, 0), point: this.pos, source: 'self' }); }
    }
  }
  updateSniper(dt, dist) {
    const m = this.m, beam = this.beam;
    if (this.aimT > 0) {
      this.aimT -= dt;
      m.gunTip.getWorldPosition(tv);
      if (!this.aimTarget) this.aimTarget = new V3();
      playerAim(tv2); this.aimTarget.lerp(tv2, Math.min(1, dt * (this.aimT > 0.35 ? 6 : 1.5)));
      const d = tv.distanceTo(this.aimTarget);
      beam.position.lerpVectors(tv, this.aimTarget, 0.5); beam.lookAt(this.aimTarget); beam.scale.set(1, 1, d);
      beam.material.opacity = 0.25 + (1 - this.aimT / 1.3) * 0.6 + (this.aimT < 0.3 ? Math.sin(time * 60) * 0.2 : 0);
      m.tipMat.opacity = 0.4 + (1 - this.aimT / 1.3) * 0.6;
      if (!this.los) { this.aimT = 0; beam.material.opacity = 0; this.fireT = 1; return; }
      if (this.aimT <= 0) {
        beam.material.opacity = 0; m.tipMat.opacity = 0.3;
        const dir = tv3.subVectors(this.aimTarget, tv).normalize();
        dir.x += rand(-1, 1) * 0.006; dir.y += rand(-1, 1) * 0.004; dir.z += rand(-1, 1) * 0.006; dir.normalize();
        spawnBolt(tv, dir, this.k.dmg * this.dmgMul, { speed: 130, color: 0xff2a6a, core: 0xffd0dc, size: 0.8 });
        SFX.laser(this.pos, 'sniper'); this.kick = 0.5;
        this.fireT = rand(2.2, 3.2);
      }
      return;
    }
    if (this.los && dist < 90) {
      this.fireT -= dt;
      if (this.fireT <= 0) { this.aimT = 1.3; this.aimTarget = playerAim(new V3()); SFX.charge(this.pos, true); }
    } else this.fireT = Math.max(this.fireT, 0.8);
  }
  updateDrone(dt) {
    const m = this.m, p = this.pos, k = this.k;
    const dx = player.pos.x - p.x, dz = player.pos.z - p.z, dist = Math.hypot(dx, dz) || 0.001;
    this.dist = dist;
    this.losT -= dt;
    if (this.losT <= 0) { this.losT = rand(0.2, 0.35); playerAim(tv2).y += 0.3; const had = this.los; this.los = !segBlocked(p, tv2); if (!had && this.los) this.fireT = Math.max(this.fireT, weaponRuntime().silenced ? 1.4 : 0.5); }
    this.orbitT -= dt; if (this.orbitT <= 0) { this.orbit *= -1; this.orbitT = rand(1.5, 3.5); this.alt = rand(3.5, 7); }
    const want = dist > 18 ? 1 : dist < 9 ? -1 : 0;
    let vx = dx / dist * want + (-dz / dist) * this.orbit * 0.9, vz = dz / dist * want + (dx / dist) * this.orbit * 0.9;
    for (const o of enemies) { if (o === this || !o.flying) continue; const ox = p.x - o.pos.x, oz = p.z - o.pos.z, od = Math.hypot(ox, oz); if (od < 2.5 && od > 1e-3) { vx += ox / od; vz += oz / od; } }
    const sp = this.k.speed * this.speedMul;
    const ground = topAt(p.x + vx, p.z + vz, 0.8);
    const targetY = Math.min(world.ceiling - 1.2, Math.max(ground + 2.5, player.pos.y + this.alt) + Math.sin(time * 2 + this.id) * 0.4);
    this.body.vel.x = damp(this.body.vel.x, vx * sp, 3, dt); this.body.vel.z = damp(this.body.vel.z, vz * sp, 3, dt);
    this.body.vel.y = damp(this.body.vel.y, (targetY - p.y) * 2.2, 4, dt);
    tv.copy(p).addScaledVector(this.body.vel, dt);
    const c = pointInCollider(tv);
    if (c) { this.body.vel.x *= -0.5; this.body.vel.z *= -0.5; this.body.vel.y = Math.max(this.body.vel.y, 3); }
    else p.copy(tv);
    const lim = world.half - 2; p.x = clamp(p.x, -lim, lim); p.z = clamp(p.z, -lim, lim);
    m.g.position.copy(p);
    const face = Math.atan2(dx, dz); let dy = face - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * Math.min(1, dt * 6);
    m.g.rotation.set(this.body.vel.z * 0.03, this.yaw, -this.body.vel.x * 0.03);
    m.rotors.forEach((r, i) => r.rotation.y += dt * (30 + i));
    if (!player.alive || this.spawnT < 1) return;
    if (this.los && dist < 45) {
      this.fireT -= dt;
      if (this.fireT < 0.3) { m.tipMat.opacity = 1; }
      if (this.fireT <= 0) { this.fireT = rand(k.rate[0], k.rate[1]); m.tipMat.opacity = 0.3; this.fire(); }
    } else this.fireT = Math.max(this.fireT, 0.6);
  }
  steer(wx, wz) {
    const b = this.body, base = Math.atan2(wz, wx), offs = [0, 0.55, -0.55, 1.1, -1.1, 1.7, -1.7, 2.4, -2.4];
    for (const o of offs) {
      const a = base + o * (this.strafe > 0 ? 1 : -1), cx = Math.cos(a), cz = Math.sin(a);
      if (pointFree(b.pos.x + cx * 1.4, b.pos.z + cz * 1.4, b.radius + 0.05, b.pos.y + 0.56, b.pos.y + b.height) && pointFree(b.pos.x + cx * 0.6, b.pos.z + cz * 0.6, b.radius, b.pos.y + 0.56, b.pos.y + b.height)) return [cx, cz];
    }
    return [wx, wz];
  }
  fire() {
    const m = this.m; m.gunTip.getWorldPosition(tv);
    const target = playerAim(tv2);
    const dist = tv.distanceTo(target); target.addScaledVector(player.vel, dist / this.k.boltSpeed * 0.6);
    const inacc = this.k.acc * (1 + Math.hypot(player.vel.x, player.vel.z) * 0.08);
    target.x += rand(-1, 1) * dist * inacc; target.y += rand(-1, 1) * dist * inacc * 0.6; target.z += rand(-1, 1) * dist * inacc;
    const style = this.kind === 'drone' ? { speed: this.k.boltSpeed, color: 0x40ffd0, core: 0xd0fff4, size: 0.6 } : this.kind === 'shield' ? { speed: this.k.boltSpeed, color: 0x7cc8ff, core: 0xe0f4ff } : { speed: this.k.boltSpeed };
    spawnBolt(tv, target.sub(tv).normalize(), this.k.dmg * this.dmgMul, style);
    this.kick = 0.35; SFX.laser(this.pos, this.kind === 'drone' ? 'drone' : 'grunt');
    FX.spawn(tv, tv3.set(0, 0, 0), 0.1, 0.5, 0.1, new THREE.Color(this.k.glow), COL.white, {});
  }
  fireTank() {
    const m = this.m; m.gunTip.getWorldPosition(tv);
    const target = playerAim(tv2, 0.4);
    spawnOrb(tv, tv3.subVectors(target, tv).normalize(), 24, this.k.dmg * this.dmgMul, 3.2, 0xc040ff);
    for (let i = 0; i < 3; i++) { const d = tv3.subVectors(playerAim(tv4), tv).normalize(); d.x += rand(-0.08, 0.08); d.y += rand(-0.03, 0.05); d.z += rand(-0.08, 0.08); spawnBolt(tv, d.normalize(), 6 * this.dmgMul, { speed: 36, color: 0xc040ff, core: 0xf0c0ff, size: 0.8 }); }
    this.kick = 0.6; SFX.laser(this.pos, 'heavy');
  }
  // returns { dealt, killed, blocked }
  damage(amount, info) {
    if (this.dead) return { dealt: 0, killed: false };
    if (info.part === 'shield') { SFX.blocked(info.point); sparks(info.point, 6, info.normal || null, 5, COL.elec, COL.elecEnd); return { dealt: 0, killed: false, blocked: true }; }
    const dealt = Math.min(this.hp, amount);
    this.hp -= amount; this.flashT = 0.07; this.fireT += 0.05;
    if (this.kind === 'grunt' && Math.random() < 0.3) this.strafe *= -1;
    if (this.kind === 'exploder' && info.part === 'weak' && this.hp > 0) { this.hp = 0; }
    if (this.hp <= 0) { this.die(info); return { dealt, killed: true }; }
    return { dealt, killed: false };
  }
  die(info) {
    if (this.dead) return; this.dead = true;
    const i = enemies.indexOf(this); if (i >= 0) enemies.splice(i, 1);
    if (this.beam) scene.remove(this.beam);
    const p = this.center(new V3());
    SFX.botDie(p);
    const dir = info.dir || tv.set(0, 1, 0);
    const meshes = []; this.m.g.traverse(o => { if (o.isMesh) meshes.push(o); });
    this.m.g.updateMatrixWorld(true);
    this.m.glow.color.setHex(0x111111); if (this.m.tipMat) this.m.tipMat.opacity = 0;
    this.m.body.emissive.setHex(0x000000); this.m.body.color.multiplyScalar(0.55);
    for (const o of meshes) {
      const pr = o.geometry.parameters || {};
      if (o.material === energyMat || ((pr.width || 1) < 0.1 && (pr.height || 1) < 0.1)) { o.parent.remove(o); continue; }
      scene.attach(o);
      const v = new V3(rand(-2, 2), rand(2.5, 6), rand(-2, 2)).addScaledVector(dir, rand(3, 7));
      debris.push({ m: o, v, w: new V3(rand(-8, 8), rand(-8, 8), rand(-8, 8)), t: rand(3, 4.5), spark: o === this.m.torso || o === this.m.head || o === this.m.eye });
    }
    scene.remove(this.m.g);
    sparks(p, 30, null, 9, COL.elec, COL.elecEnd); sparks(p, 20, null, 6); puff(p, 8, null, COL.smoke, 0.8, 1.6);
    if (this.kind === 'exploder') {
      const src = this.selfDestruct ? null : info.source;
      explosion(p, 5, this.k.dmg * this.dmgMul, { hurtsPlayer: true, owner: src === 'self' || !src ? 'enemy' : 'player', enemyDamage: this.selfDestruct ? 30 : 60, color: 0xffe030 });
    }
    if (this.kind === 'tank') explosion(p, 3.5, 20, { hurtsPlayer: true, owner: 'player', enemyDamage: 40 });
    if (!this.selfDestruct) onEnemyKilled(this, info);
  }
}

// ---------------- bosses ----------------
const BOSSES = [
  { id: 'titan', name: 'Titan-9', title: 'Siege mech', hp: 5200 },
  { id: 'hive', name: 'Hive Mother', title: 'Drone carrier', hp: 4200 },
  { id: 'bulwark', name: 'Ironclad', title: 'Shielded assault tank', hp: 4600, shield: 1000 },
];
let boss = null;

class BossBase {
  constructor(def, cycle) {
    this.isBoss = true; this.def = def; this.id = ++enemyId; this.kind = def.id; this.name = def.name;
    const d = DIFFICULTY[run.diff];
    this.hpMax = Math.round(def.hp * (1 + 0.6 * cycle) * d.hp); this.hp = this.hpMax;
    this.dmgMul = (1 + 0.15 * cycle) * d.dmg; this.cycle = cycle;
    this.phase = 1; this.hitMeshes = []; this.flashT = 0; this.stunT = 0; this.dead = false; this.t = 0; this.spawnT = 0;
    this.group = new THREE.Group(); scene.add(this.group);
    this.mats = []; this.mapColor = '#ff4a3d'; this.mapSize = 3.5; this.tookDamage = false;
    this.pos = new V3();
  }
  mark(mesh, part) { mesh.userData.enemy = this; mesh.userData.part = part; this.hitMeshes.push(mesh); mesh.castShadow = true; return mesh; }
  mat(color, o = {}) { const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.45, metalness: 0.75 }, o)); this.mats.push(m); return m; }
  center(out) { return out.copy(this.pos).setY(this.pos.y + (this.centerY || 2)); }
  eye(out) { return this.center(out); }
  stun(t) { this.stunT = Math.max(this.stunT, Math.min(t, 0.8)); }
  headMultFor(part, headMult) { return partMult(part, headMult); }
  damage(amount, info) {
    if (this.dead) return { dealt: 0, killed: false };
    const r = this.absorb ? this.absorb(amount, info) : null;
    if (r) return r;
    const dealt = Math.min(this.hp, amount);
    this.hp -= amount; this.flashT = 0.06;
    const f = this.hp / this.hpMax;
    if (this.phase === 1 && f <= 0.5) this.enterPhase(2);
    if (this.phase === 2 && f <= 0.25) this.enterPhase(3);
    if (this.hp <= 0) { this.die(info); return { dealt, killed: true }; }
    return { dealt, killed: false };
  }
  enterPhase(n) {
    this.phase = n; SFX.roar(this.pos); shake = Math.min(1.2, shake + 0.5);
    ui.banner(n === 2 ? 'Phase two' : 'Final phase', this.phaseText(n), 2.2, true);
    this.onPhase && this.onPhase(n);
  }
  phaseText() { return ''; }
  flash(dt) {
    this.flashT = Math.max(0, this.flashT - dt);
    for (const m of this.mats) { m.emissive.setHex(this.flashT > 0 ? 0xffffff : (this.stunT > 0 ? 0x3a7cff : 0x000000)); m.emissiveIntensity = this.flashT > 0 ? 0.6 : 0.35; }
  }
  die(info) {
    if (this.dead) return; this.dead = true;
    const i = enemies.indexOf(this); if (i >= 0) enemies.splice(i, 1);
    const p = this.center(new V3());
    for (let k = 0; k < 6; k++) setTimeout(() => { if (!run.active) return; explosion(tv.copy(p).add(tv2.set(rand(-3, 3), rand(-2, 2), rand(-3, 3))), 4, 0, { hurtsPlayer: false, owner: 'player', enemyDamage: 0, silentDecal: k > 1 }); }, k * 180);
    const meshes = []; this.group.traverse(o => { if (o.isMesh) meshes.push(o); });
    this.group.updateMatrixWorld(true);
    for (const o of meshes) {
      if (o.material && o.material.blending === THREE.AdditiveBlending) { o.parent && o.parent.remove(o); continue; }
      scene.attach(o);
      debris.push({ m: o, v: new V3(rand(-6, 6), rand(4, 12), rand(-6, 6)), w: new V3(rand(-4, 4), rand(-4, 4), rand(-4, 4)), t: rand(4, 6), spark: Math.random() < 0.3 });
    }
    scene.remove(this.group);
    this.cleanup && this.cleanup();
    boss = null;
    onBossKilled(this, info);
    onEnemyKilled(this, info);
  }
  remove() { scene.remove(this.group); this.cleanup && this.cleanup(); const i = enemies.indexOf(this); if (i >= 0) enemies.splice(i, 1); this.dead = true; boss = null; }
}

class TitanBoss extends BossBase {
  constructor(p, cycle) {
    super(BOSSES[0], cycle);
    this.body = { pos: p.clone(), vel: new V3(), radius: 2.2, height: 7.5, onGround: true };
    this.pos = this.body.pos; this.centerY = 5.5;
    const G = this.group, dark = this.mat(0x23282d), plate = this.mat(0x6b737b), acc = this.mat(0x9a5b25);
    const glow = new THREE.MeshBasicMaterial({ color: 0xff3b2a }), core = new THREE.MeshBasicMaterial({ color: 0x6cf6ff });
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    this.pelvis = new THREE.Group(); this.pelvis.position.y = 4.3; G.add(this.pelvis);
    this.mark(new THREE.Mesh(B(2.4, 1, 1.6), dark), 'body'); this.pelvis.add(this.hitMeshes[0]);
    this.legs = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(s * 1.25, 0, 0); this.pelvis.add(hip);
      const thigh = this.mark(new THREE.Mesh(B(0.9, 2.2, 1.1), plate), 'limb'); thigh.position.y = -1.1; hip.add(thigh);
      const knee = new THREE.Group(); knee.position.y = -2.2; hip.add(knee);
      const shin = this.mark(new THREE.Mesh(B(0.8, 2.2, 0.95), dark), 'limb'); shin.position.y = -1.0; knee.add(shin);
      const foot = this.mark(new THREE.Mesh(B(1.3, 0.35, 2), plate), 'limb'); foot.position.set(0, -2.0, 0.3); knee.add(foot);
      this.legs.push({ hip, knee });
    }
    this.upper = new THREE.Group(); this.upper.position.y = 4.8; G.add(this.upper);
    const torso = this.mark(new THREE.Mesh(B(3.6, 2.4, 2.4), plate), 'body'); torso.position.y = 1.2; this.upper.add(torso);
    const chest = new THREE.Mesh(B(2.2, 1.4, 0.3), dark); chest.position.set(0, 1.3, 1.25); this.upper.add(chest);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.12, 8, 24), acc); ring.position.set(0, 1.3, 1.42); this.upper.add(ring);
    this.core = this.mark(new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), core), 'weak'); this.core.position.set(0, 1.3, 1.35); this.upper.add(this.core);
    const head = this.mark(new THREE.Mesh(B(1.3, 0.9, 1.3), dark), 'head'); head.position.set(0, 2.85, 0.2); this.upper.add(head);
    const visor = new THREE.Mesh(B(1.0, 0.18, 0.05), glow); visor.position.set(0, 2.9, 0.87); this.upper.add(visor);
    this.cannons = [];
    for (const s of [-1, 1]) {
      const sh = this.mark(new THREE.Mesh(B(1.1, 1.1, 1.4), dark), 'body'); sh.position.set(s * 2.35, 1.8, 0); this.upper.add(sh);
      const arm = this.mark(new THREE.Mesh(B(0.8, 0.8, 2.6), plate), 'limb'); arm.position.set(s * 2.35, 1.1, 0.9); this.upper.add(arm);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.6, 12), dark); barrel.rotation.x = Math.PI / 2; barrel.position.set(s * 2.35, 1.1, 2.9); this.upper.add(barrel);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff6a30, transparent: true, opacity: 0.5 })); tip.position.set(s * 2.35, 1.1, 3.75); this.upper.add(tip);
      this.cannons.push(tip);
    }
    for (const s of [-1, 1]) { const pod = this.mark(new THREE.Mesh(B(1.2, 1.1, 1.3), acc), 'body'); pod.position.set(s * 1.2, 2.7, -1.3); this.upper.add(pod); for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(B(0.18, 0.18, 0.05), glow); d.position.set(s * 1.2 + (i % 2 - 0.5) * 0.45, 2.5 + (i >> 1) * 0.45, -0.63); this.upper.add(d); } }
    this.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.volleyT = 3; this.volleyN = 0; this.volleyShotT = 0; this.missileT = 6; this.stompT = 3; this.stompCharge = -1; this.walk = 0; this.yawLow = 0; this.yawUp = 0;
  }
  phaseText(n) { return n === 2 ? 'Missile pods online · watch for red rings' : 'Reactor overload · keep off the ground when it stomps'; }
  update(dt) {
    this.t += dt; this.spawnT = Math.min(1, this.spawnT + dt * 0.8);
    this.stunT = Math.max(0, this.stunT - dt); this.flash(dt);
    const b = this.body, dx = player.pos.x - b.pos.x, dz = player.pos.z - b.pos.z, dist = Math.hypot(dx, dz) || 0.01;
    this.core.scale.setScalar(1 + Math.sin(this.t * (this.phase === 3 ? 12 : 5)) * 0.08);
    const speed = (this.phase === 3 ? 3.4 : 2.4);
    let wx = 0, wz = 0;
    if (this.stunT <= 0 && this.stompCharge < 0) { if (dist > 24) { wx = dx / dist; wz = dz / dist; } else if (dist < 14 && this.phase < 3) { wx = -dx / dist * 0.6; wz = -dz / dist * 0.6; } else if (this.phase === 3) { wx = dx / dist; wz = dz / dist; } else { wx = -dz / dist * 0.5; wz = dx / dist * 0.5; } }
    b.vel.x = damp(b.vel.x, wx * speed, 2, dt); b.vel.z = damp(b.vel.z, wz * speed, 2, dt);
    moveBody(b, dt, 0.8);
    this.group.position.copy(b.pos);
    const sp = Math.hypot(b.vel.x, b.vel.z);
    if (sp > 0.2) { const ty = Math.atan2(b.vel.x, b.vel.z); let d = ty - this.yawLow; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yawLow += d * Math.min(1, dt * 2); }
    const ty = Math.atan2(dx, dz); let d = ty - this.yawUp; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yawUp += d * Math.min(1, dt * 2.5);
    this.pelvis.rotation.y = this.yawLow; this.upper.rotation.y = this.yawUp;
    this.walk += dt * sp * 0.9;
    const sw = Math.sin(this.walk) * Math.min(1, sp / 1.5) * 0.45;
    this.legs[0].hip.rotation.x = sw; this.legs[1].hip.rotation.x = -sw;
    this.legs[0].knee.rotation.x = Math.max(0, -sw) * 1.2; this.legs[1].knee.rotation.x = Math.max(0, sw) * 1.2;
    const bob = Math.abs(Math.cos(this.walk)) * 0.12 * Math.min(1, sp);
    this.pelvis.position.y = 4.3 + bob - (this.stompCharge >= 0 ? (0.6 - this.stompCharge) * 1.2 : 0); this.upper.position.y = this.pelvis.position.y + 0.5;
    if (sp > 0.5 && Math.abs(Math.sin(this.walk)) < 0.08 && this.lastStep !== Math.round(this.walk / Math.PI)) { this.lastStep = Math.round(this.walk / Math.PI); SFX.stomp(b.pos); shake = Math.min(1, shake + Math.max(0, 0.25 - dist / 120)); }
    if (!player.alive || this.spawnT < 1 || this.stunT > 0) return;
    this.upper.updateMatrixWorld(true);
    // cannon volleys
    this.volleyT -= dt;
    if (this.volleyT <= 0 && this.volleyN === 0) { this.volleyN = 6; this.volleyShotT = 0; this.volleyT = this.phase === 3 ? 1.6 : 2.4; }
    if (this.volleyN > 0) {
      this.volleyShotT -= dt;
      if (this.volleyShotT <= 0) {
        const tip = this.cannons[this.volleyN % 2]; tip.getWorldPosition(tv);
        const tgt = playerAim(tv2, tv.distanceTo(player.pos) / 48 * 0.5); tgt.x += rand(-1, 1) * 1.2; tgt.z += rand(-1, 1) * 1.2;
        spawnBolt(tv, tgt.sub(tv).normalize(), 10 * this.dmgMul, { speed: 48, color: 0xff6a30, core: 0xffe0c0, size: 1.3 });
        SFX.laser(tv, 'heavy'); this.volleyN--; this.volleyShotT = 0.12;
      }
    }
    // missile barrage
    if (this.phase >= 2) {
      this.missileT -= dt;
      if (this.missileT <= 0) {
        this.missileT = this.phase === 3 ? 5 : 7;
        for (let i = 0; i < 6; i++) { const tgt = new V3(player.pos.x + rand(-6, 6), 0, player.pos.z + rand(-6, 6)); tgt.y = groundAt(tgt.x, tgt.z, player.pos.y + 1); tv.set(rand(-1, 1), 3.5, -1.3).applyAxisAngle(tv2.set(0, 1, 0), this.yawUp).add(this.upper.position).add(this.group.position); setTimeout(() => { if (!this.dead && run.active) spawnArc(tv3.copy(this.group.position).setY(this.group.position.y + 7.5), tgt, 1.6 + i * 0.08, 22 * this.dmgMul, 3.5, 0xff5020); }, i * 120); }
        SFX.siren();
      }
    }
    // stomp shockwave
    if (this.phase === 3) {
      this.stompT -= dt;
      if (this.stompCharge < 0 && this.stompT <= 0 && dist < 10) { this.stompCharge = 0.6; SFX.charge(b.pos); }
      if (this.stompCharge >= 0) {
        this.stompCharge -= dt;
        if (this.stompCharge < 0) {
          this.stompT = 4; SFX.stomp(b.pos); SFX.boom(b.pos, 0.8); shake = Math.min(1.3, shake + 0.8);
          blast(tv.copy(b.pos).setY(b.pos.y + 0.2), 11, 0xffa050, 0xffd0a0);
          puff(tv.copy(b.pos), 20, tv2.set(0, 1, 0), COL.dust, 1.5, 1.4);
          if (player.onGround && dist < 11 && Math.abs(player.pos.y - b.pos.y) < 1.5) { hurtPlayer(28 * this.dmgMul, b.pos); tv.set(dx, 0, dz).normalize(); player.vel.addScaledVector(tv, 12); player.vel.y += 6; }
        }
      }
    }
  }
}

class HiveBoss extends BossBase {
  constructor(p, cycle) {
    super(BOSSES[1], cycle);
    const lab = world.ceiling < 20;
    this.scale = lab ? 0.55 : 1;
    this.alt = lab ? world.ceiling - 2.4 : 15; this.orbitR = Math.min(24, world.half * 0.45); this.ang = Math.atan2(p.z, p.x);
    this.pos.set(Math.cos(this.ang) * this.orbitR, this.alt, Math.sin(this.ang) * this.orbitR); this.centerY = 0;
    const G = this.group; G.scale.setScalar(this.scale);
    const hull = this.mat(0x2c3238), plate = this.mat(0x59626b), glowC = new THREE.MeshBasicMaterial({ color: 0x40ffd0 });
    const disk = this.mark(new THREE.Mesh(new THREE.CylinderGeometry(5.5, 4.2, 1.3, 32), hull), 'body'); G.add(disk);
    const rim = this.mark(new THREE.Mesh(new THREE.CylinderGeometry(5.8, 5.8, 0.35, 32), plate), 'body'); rim.position.y = 0.2; G.add(rim);
    const dome = this.mark(new THREE.Mesh(new THREE.SphereGeometry(2.6, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), plate), 'head'); dome.position.y = 0.6; G.add(dome);
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a6a });
    this.eyeMesh = this.mark(new THREE.Mesh(new THREE.SphereGeometry(1.1, 18, 14), this.eyeMat), 'weak'); this.eyeMesh.position.y = -0.8; G.add(this.eyeMesh);
    this.lights = new THREE.Group(); G.add(this.lights);
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.35), glowC); l.position.set(Math.cos(a) * 5.85, 0.2, Math.sin(a) * 5.85); this.lights.add(l); }
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; const bay = this.mark(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), hull), 'body'); bay.position.set(Math.cos(a) * 3.2, -0.75, Math.sin(a) * 3.2); G.add(bay); const g2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.9), glowC); g2.position.set(Math.cos(a) * 3.2, -1.02, Math.sin(a) * 3.2); G.add(g2); }
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; const ant = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.1), hull); ant.position.set(Math.cos(a) * 1.6, 2.6, Math.sin(a) * 1.6); G.add(ant); }
    this.group.position.copy(this.pos);
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xff2a6a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    scene.add(this.beam); this.beamLine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 1), new THREE.MeshBasicMaterial({ color: 0xff2a6a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(this.beamLine);
    this.droneT = 3; this.rainT = 2.5; this.dropT = 5; this.laserT = 6; this.laser = null;
  }
  cleanup() { scene.remove(this.beam); scene.remove(this.beamLine); }
  phaseText(n) { return n === 2 ? 'Drop pods and sweeping laser · keep moving' : 'Carrier descending · the eye is exposed'; }
  eyeWorld(out) { this.eyeMesh.getWorldPosition(out); return out; }
  center(out) { return out.copy(this.pos); }
  update(dt) {
    this.t += dt; this.spawnT = Math.min(1, this.spawnT + dt * 0.6); this.stunT = Math.max(0, this.stunT - dt); this.flash(dt);
    const alt = (this.phase === 3 ? this.alt * 0.62 : this.alt) * (world.ceiling < 20 ? 1 : 1) + Math.sin(this.t * 0.8) * 0.6;
    const orbitSpeed = this.stunT > 0 ? 0 : (this.phase === 3 ? 0.16 : 0.09);
    this.ang += dt * orbitSpeed;
    const tx = Math.cos(this.ang) * this.orbitR, tz = Math.sin(this.ang) * this.orbitR;
    this.pos.x = damp(this.pos.x, tx, 1.2, dt); this.pos.z = damp(this.pos.z, tz, 1.2, dt); this.pos.y = damp(this.pos.y, Math.max(groundAt(this.pos.x, this.pos.z) + 4, alt), 1, dt);
    this.group.position.copy(this.pos); this.group.rotation.y += dt * 0.15; this.lights.rotation.y -= dt * 0.8;
    this.eyeMat.color.setHex(this.laser ? 0xffffff : (this.phase === 3 ? 0xff5070 : 0xff2a6a));
    if (!player.alive || this.spawnT < 1) { this.beam.material.opacity = 0; this.beamLine.material.opacity = 0; return; }
    if (this.stunT > 0) return;
    this.group.updateMatrixWorld(true);
    // drones
    this.droneT -= dt;
    if (this.droneT <= 0) { this.droneT = this.phase === 3 ? 6 : 8; const alive = enemies.filter(e => e.kind === 'drone').length; for (let i = 0; i < 2 && alive + i < 6; i++) { const e = new Enemy('drone', tv.copy(this.pos).add(tv2.set(rand(-3, 3), -2 * this.scale, rand(-3, 3)))); e.pos.y = this.pos.y - 1.5 * this.scale; enemies.push(e); } }
    // bolt rain from the eye
    this.rainT -= dt;
    if (this.rainT <= 0) {
      this.rainT = this.phase === 3 ? 1.3 : 2.6;
      const n = this.phase === 3 ? 7 : 5; this.eyeWorld(tv);
      for (let i = 0; i < n; i++) { const tgt = playerAim(tv2, 0.25); tgt.x += rand(-2.5, 2.5); tgt.z += rand(-2.5, 2.5); spawnBolt(tv, tgt.sub(tv).normalize(), 8 * this.dmgMul, { speed: 40, color: 0xff2a6a, core: 0xffd0dc, size: 1 }); }
      SFX.laser(tv, 'heavy');
    }
    if (this.phase >= 2) {
      this.dropT -= dt;
      if (this.dropT <= 0) { this.dropT = 9; for (let i = 0; i < 2; i++) { const gp = new V3(this.pos.x + rand(-4, 4), 0, this.pos.z + rand(-4, 4)); if (!pointFree(gp.x, gp.z, 0.8)) gp.set(this.pos.x, 0, this.pos.z); if (!pointFree(gp.x, gp.z, 0.8)) continue; gp.y = groundAt(gp.x, gp.z); enemies.push(new Enemy(Math.random() < 0.5 ? 'runner' : 'exploder', gp)); tracer(tv.copy(this.pos), gp, 0x40ffd0, 6); } }
      this.laserT -= dt;
      if (!this.laser && this.laserT <= 0) {
        const pp = tv.copy(player.pos); const side = tv2.set(rand(-1, 1), 0, rand(-1, 1)).normalize().multiplyScalar(9);
        this.laser = { t: 0, tele: 1.0, dur: 2.4, a: pp.clone().add(side), b: pp.clone().sub(side) };
        this.laserT = this.phase === 3 ? 6 : 8; SFX.charge(this.pos, true);
      }
    }
    if (this.laser) {
      const L = this.laser; L.t += dt;
      const eye = this.eyeWorld(tv3);
      if (L.t < L.tele) {
        const mid = tv.lerpVectors(L.a, L.b, 0.5); this.beamLine.position.set(mid.x, groundAt(mid.x, mid.z, player.pos.y + 1) + 0.05, mid.z); this.beamLine.lookAt(L.b.x, this.beamLine.position.y, L.b.z); this.beamLine.scale.set(1, 1, L.a.distanceTo(L.b)); this.beamLine.material.opacity = 0.4 + Math.sin(time * 30) * 0.3;
      } else {
        this.beamLine.material.opacity = 0;
        const u = (L.t - L.tele) / L.dur; const gp = tv.lerpVectors(L.a, L.b, u); gp.y = groundAt(gp.x, gp.z, player.pos.y + 1);
        const len = eye.distanceTo(gp); this.beam.position.lerpVectors(eye, gp, 0.5); this.beam.scale.set(1, len, 1); this.beam.lookAt(gp); this.beam.rotateX(Math.PI / 2);
        this.beam.material.opacity = 0.75;
        sparks(gp, 3, tv2.set(0, 1, 0), 8, COL.red, COL.redEnd);
        if (Math.random() < 0.3) decal(gp, tv2.set(0, 1, 0), 0.8, true);
        // damage if player near the beam segment
        const pe = playerAim(tv4);
        const ab = tv2.subVectors(gp, eye), t = clamp(tv4.clone().sub(eye).dot(ab) / ab.lengthSq(), 0, 1);
        const closest = eye.clone().addScaledVector(ab, t);
        if (closest.distanceTo(pe) < 1.4) hurtPlayer(30 * this.dmgMul * dt, gp, true);
        if (L.t > L.tele + L.dur) { this.laser = null; this.beam.material.opacity = 0; }
      }
    }
  }
}

class BulwarkBoss extends BossBase {
  constructor(p, cycle) {
    super(BOSSES[2], cycle);
    this.body = { pos: p.clone(), vel: new V3(), radius: 3.1, height: 3.8, onGround: true };
    this.pos = this.body.pos; this.centerY = 2;
    this.shieldMax = Math.round(BOSSES[2].shield * (1 + 0.6 * cycle) * DIFFICULTY[run.diff].hp); this.shieldHp = this.shieldMax; this.shieldDown = 0; this.shieldGone = false;
    const G = this.group, hull = this.mat(0x4a5238), dark = this.mat(0x1e2226), plate = this.mat(0x6a7258);
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    this.chassis = new THREE.Group(); G.add(this.chassis);
    for (const s of [-1, 1]) {
      const tread = this.mark(new THREE.Mesh(B(1.2, 1.4, 6.6), dark), 'limb'); tread.position.set(s * 2.2, 0.7, 0); this.chassis.add(tread);
      for (let i = 0; i < 5; i++) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.25, 12), hull); wh.rotation.z = Math.PI / 2; wh.position.set(s * 2.2, 0.6, -2.6 + i * 1.3); this.chassis.add(wh); }
    }
    const base = this.mark(new THREE.Mesh(B(3.4, 1.2, 6), hull), 'body'); base.position.y = 1.5; this.chassis.add(base);
    const deck = this.mark(new THREE.Mesh(B(3.8, 0.4, 4.4), plate), 'body'); deck.position.set(0, 2.2, -0.3); this.chassis.add(deck);
    this.vents = [];
    for (const s of [-1, 1]) { const v = this.mark(new THREE.Mesh(B(0.9, 0.6, 0.2), new THREE.MeshBasicMaterial({ color: 0xff7a2e })), 'weak'); v.position.set(s * 0.9, 1.6, -3.05); this.chassis.add(v); this.vents.push(v); }
    this.turret = new THREE.Group(); this.turret.position.y = 2.4; G.add(this.turret);
    const tb = this.mark(new THREE.Mesh(B(2.6, 1.2, 2.9), plate), 'body'); tb.position.y = 0.6; this.turret.add(tb);
    const cannon = this.mark(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 3.6, 14), dark), 'body'); cannon.rotation.x = Math.PI / 2; cannon.position.set(0, 0.7, 3.2); this.turret.add(cannon);
    this.muzzle = new THREE.Object3D(); this.muzzle.position.set(0, 0.7, 5.1); this.turret.add(this.muzzle);
    const coax = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8), dark); coax.rotation.x = Math.PI / 2; coax.position.set(0.8, 0.9, 2.2); this.turret.add(coax);
    this.coax = new THREE.Object3D(); this.coax.position.set(0.8, 0.9, 3); this.turret.add(this.coax);
    const sensor = this.mark(new THREE.Mesh(B(0.8, 0.5, 0.8), dark), 'head'); sensor.position.set(-0.6, 1.45, 0.3); this.turret.add(sensor);
    const eye = new THREE.Mesh(B(0.5, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: 0x7cc8ff })); eye.position.set(-0.6, 1.47, 0.72); this.turret.add(eye);
    const gen = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), new THREE.MeshBasicMaterial({ color: 0x7cc8ff })); gen.position.set(0, 1.5, -1.6); this.chassis.add(gen); this.gen = gen;
    this.domeMat = new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 }, a: { value: 1 }, hit: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float t, a, hit; varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); float hex = step(0.92, fract(vP.y * 3.0 + t * 0.5)) * 0.35 + step(0.94, fract(atan(vP.z, vP.x) * 5.0)) * 0.25; vec3 c = vec3(0.45, 0.78, 1.0); gl_FragColor = vec4(c * (f * 1.2 + hex * 0.4 + 0.05 + hit), (f * 0.9 + hex * 0.25 + 0.06 + hit) * a); }'
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(5.2, 32, 18), this.domeMat); this.dome.position.y = 1.4; G.add(this.dome);
    this.dome.userData.enemy = this; this.dome.userData.part = 'shield'; this.hitMeshes.push(this.dome);
    this.group.traverse(o => { if (o.isMesh && o !== this.dome) o.castShadow = true; });
    this.yaw = 0; this.turretYaw = 0; this.cannonT = 3; this.mgT = 2; this.mgN = 0; this.mortarT = 6; this.ram = null; this.ramT = 4;
  }
  phaseText(n) { return n === 2 ? 'Mortars incoming · watch for red rings' : 'Shield generator destroyed · it will ram you'; }
  shieldUp() { return !this.shieldGone && this.shieldDown <= 0; }
  absorb(amount, info) {
    if (info.part !== 'shield') return null;
    if (!this.shieldUp()) return { dealt: 0, killed: false, pass: true };
    const mult = info.source === 'explosion' || info.source === 'airstrike' ? 3 : 1;
    this.shieldHp -= amount * mult; this.domeMat.uniforms.hit.value = 0.6;
    SFX.blocked(info.point || this.pos);
    if (this.shieldHp <= 0) this.breakShield();
    return { dealt: 0, killed: false, blocked: true, shield: amount * mult };
  }
  breakShield() {
    this.shieldHp = 0; this.shieldDown = 8; SFX.stun(this.pos); SFX.roar(this.pos);
    for (let i = 0; i < 80; i++) { randDir(tv, rand(5, 15)); FX.spawn(tv2.copy(this.pos).setY(this.pos.y + 1.4).addScaledVector(tv, 0.35), tv, rand(0.4, 0.9), 0.4, 0.05, COL.elec, COL.elecEnd, { drag: 2 }); }
    ui.toast('Shield down', 'Hit the glowing rear vents for bonus damage', 'drop');
  }
  onPhase(n) { if (n === 3) { this.shieldGone = true; if (this.shieldHp > 0) this.breakShield(); } }
  update(dt) {
    this.t += dt; this.spawnT = Math.min(1, this.spawnT + dt * 0.8); this.stunT = Math.max(0, this.stunT - dt); this.flash(dt);
    const up = this.shieldUp();
    if (!this.shieldGone && this.shieldDown > 0) { this.shieldDown -= dt; if (this.shieldDown <= 0) { this.shieldHp = this.shieldMax; SFX.charge(this.pos, true); } }
    this.domeMat.uniforms.t.value = this.t; this.domeMat.uniforms.hit.value = Math.max(0, this.domeMat.uniforms.hit.value - dt * 3);
    this.domeMat.uniforms.a.value = damp(this.domeMat.uniforms.a.value, up ? 1 : 0, 6, dt);
    this.dome.visible = this.domeMat.uniforms.a.value > 0.02; this.gen.visible = !this.shieldGone;
    this.vents.forEach(v => v.material.color.setHex(up ? 0xa04a1a : 0xff7a2e));
    const b = this.body, dx = player.pos.x - b.pos.x, dz = player.pos.z - b.pos.z, dist = Math.hypot(dx, dz) || 0.01;
    let speed = 3, want = null;
    if (this.stunT <= 0) {
      if (this.ram) {
        this.ram.t -= dt;
        if (this.ram.t > 0 && this.ram.phase === 'charge') { want = Math.atan2(dx, dz); speed = 0; FX.spawn(tv.copy(b.pos).add(tv2.set(rand(-1, 1), 1.6, 0).applyAxisAngle(tv3.set(0, 1, 0), this.yaw).add(tv4.set(-Math.sin(this.yaw) * 3.2, 0, -Math.cos(this.yaw) * 3.2))), tv2.set(0, 2, 0), 0.4, 0.6, 0.1, COL.fire, COL.fireEnd, {}); }
        else if (this.ram.phase === 'charge') { this.ram.phase = 'go'; this.ram.t = 2.4; SFX.roar(b.pos); }
        else if (this.ram.t > 0) { speed = 9; want = this.yaw; if (dist < 3.8 && !this.ram.hit && Math.abs(player.pos.y - b.pos.y) < 2) { this.ram.hit = true; hurtPlayer(30 * this.dmgMul, b.pos); tv.set(dx, 0, dz).normalize(); player.vel.addScaledVector(tv, 14); player.vel.y += 5; shake += 0.6; } if (b.blocked) this.ram.t = 0; }
        else { this.ram = null; this.ramT = 3.5; }
      } else if (dist > 20) want = Math.atan2(dx, dz);
      else if (dist < 12) { want = Math.atan2(dx, dz); speed = -2; }
    }
    if (want != null) { let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += clamp(d, -dt * 0.9, dt * 0.9); }
    const moving = want != null && (!this.ram || this.ram.phase === 'go');
    const fwd = want != null ? Math.cos(Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw))) : 0;
    const v = moving ? speed * (this.ram ? 1 : Math.max(0, fwd)) : 0;
    b.vel.x = damp(b.vel.x, Math.sin(this.yaw) * v, 3, dt); b.vel.z = damp(b.vel.z, Math.cos(this.yaw) * v, 3, dt);
    b.blocked = false; moveBody(b, dt, 0.6);
    this.group.position.copy(b.pos); this.chassis.rotation.y = this.yaw;
    let d = Math.atan2(dx, dz) - this.turretYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.turretYaw += clamp(d, -dt * 1.6, dt * 1.6); this.turret.rotation.y = this.turretYaw;
    if (!player.alive || this.spawnT < 1 || this.stunT > 0) return;
    this.group.updateMatrixWorld(true);
    this.cannonT -= dt;
    if (this.cannonT <= 0) { this.cannonT = this.phase === 3 ? 2.2 : 3.2; this.muzzle.getWorldPosition(tv); spawnOrb(tv, tv3.subVectors(playerAim(tv2, 0.5), tv).normalize(), 30, 26 * this.dmgMul, 4, 0xffa040); SFX.boom(tv, 0.35); flashLight(tv, 0xffa040, 5, 12); }
    this.mgT -= dt;
    if (this.mgT <= 0 && this.mgN === 0) { this.mgN = 6; this.mgShotT = 0; this.mgT = 2.5; }
    if (this.mgN > 0) { this.mgShotT -= dt; if (this.mgShotT <= 0) { this.coax.getWorldPosition(tv); const dd = tv3.subVectors(playerAim(tv2), tv).normalize(); dd.x += rand(-0.03, 0.03); dd.y += rand(-0.02, 0.02); dd.z += rand(-0.03, 0.03); spawnBolt(tv, dd.normalize(), 6 * this.dmgMul, { speed: 50, color: 0xffc040, core: 0xfff0c0, size: 0.7 }); SFX.turret(tv); this.mgN--; this.mgShotT = 0.1; } }
    if (this.phase >= 2) {
      this.mortarT -= dt;
      if (this.mortarT <= 0) { this.mortarT = this.phase === 3 ? 5.5 : 7; for (let i = 0; i < 4; i++) { const tgt = new V3(player.pos.x + rand(-5, 5), 0, player.pos.z + rand(-5, 5)); tgt.y = groundAt(tgt.x, tgt.z, player.pos.y + 1); spawnArc(tv.copy(b.pos).setY(b.pos.y + 4), tgt, 1.8 + i * 0.15, 22 * this.dmgMul, 4, 0xffa040); } SFX.boom(b.pos, 0.3); }
    }
    if (this.phase === 3 && !this.ram) { this.ramT -= dt; if (this.ramT <= 0 && dist < 35) { this.ram = { phase: 'charge', t: 0.9, hit: false }; SFX.charge(b.pos, true); } }
  }
}
function spawnBoss(wave) {
  const idx = (wave / 5 - 1) % 3, cycle = Math.floor((wave / 5 - 1) / 3);
  const far = world.spawnPoints.slice().sort((a, b) => b.distanceTo(player.pos) - a.distanceTo(player.pos));
  const p = (far[0] || new V3(0, 0, -world.half * 0.6)).clone();
  p.multiplyScalar(0.8); p.y = 0;
  const cls = [TitanBoss, HiveBoss, BulwarkBoss][idx];
  if (idx !== 1) { for (let tries = 0; tries < 20 && !pointFree(p.x, p.z, 3.5, 0, 6); tries++) p.set(rand(-1, 1) * world.half * 0.6, 0, rand(-1, 1) * world.half * 0.6); }
  boss = new cls(p, cycle);
  enemies.push(boss);
  for (let i = 0; i < 60; i++) FX.spawn(tv.copy(p).add(tv2.set(rand(-3, 3), rand(0, 8), rand(-3, 3))), tv2.set(0, rand(3, 9), 0), rand(.5, 1.2), .4, .05, COL.red, COL.redEnd, {});
  SFX.bossAlarm(); SFX.roar(p);
  return boss;
}
