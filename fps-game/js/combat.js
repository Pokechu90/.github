'use strict';
// Projectiles, explosions, grenades, pickups, power-ups, coins, kill rewards and killstreaks.

const debris = [], grenades = [], pickups = [], turrets = [];
const powerups = { damage: 0, speed: 0, ammo: 0 };
const POWERUPS = {
  damage: { name: 'Double damage', color: 0xff4a3d, css: '#ff4a3d' },
  speed: { name: 'Speed boost', color: 0x6db4ff, css: '#6db4ff' },
  ammo: { name: 'Infinite ammo', color: 0xf5a524, css: '#f5a524' },
};

// ---------------- damage pipeline ----------------
function damageEnemy(e, base, info) {
  if (e.dead) return { killed: false, dealt: 0 };
  const mods = buffMods();
  let amount = base;
  const direct = info.source === 'bullet' || info.source === 'plasma';
  if (direct) amount *= partMult(info.part, (info.headMult || 2) + mods.head) * mods.damage;
  else if (info.source === 'explosion' || info.source === 'airstrike') amount *= mods.damage * (info.weapon === 'frag' ? mods.blast : 1);
  const r = e.damage(amount, info);
  const pt = info.point || e.center(tv4);
  if (r.blocked) { damageNumber(pt, r.shield ? `−${Math.round(r.shield)}` : 'BLOCKED', 'block'); return Object.assign(r, { head: false }); }
  if (r.pass) return r;
  if (r.dealt > 0) {
    if (e.isBoss && info.source !== 'turret') e.lastHitBy = info.weapon;
    const cls = info.part === 'head' && direct ? 'head' : info.part === 'weak' ? 'weak' : '';
    damageNumber(tv4.copy(pt).add(tv3.set(rand(-.2, .2), 0.2, rand(-.2, .2))), Math.round(amount) + (cls === 'head' ? '!' : ''), cls);
    if (mods.leech && direct && player.alive) { const heal = r.dealt * mods.leech; player.hp = Math.min(maxHp(), player.hp + heal); }
  }
  r.head = info.part === 'head' && direct;
  return r;
}

// ---------------- enemy projectiles ----------------
const boltGeo = new THREE.CylinderGeometry(0.045, 0.045, 1.2, 6); boltGeo.rotateX(Math.PI / 2);
const boltPool = [], bolts = [];
function spawnBolt(p, dir, dmg, style = {}) {
  let bo = boltPool.find(x => !x.alive);
  if (!bo) {
    const g = new THREE.Group(); const core = new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); g.add(core);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); g.add(glow);
    scene.add(g); bo = { g, core, glow, pos: new V3(), vel: new V3(), alive: false, t: 0, dmg: 0, whizzed: false, col: new THREE.Color() }; boltPool.push(bo);
  }
  const col = style.color ?? 0xff5030, size = style.size ?? 1;
  bo.core.material.color.setHex(style.core ?? 0xffc0a0); bo.glow.material.color.setHex(col); bo.col.setHex(col);
  bo.glow.scale.set(1.3 * size, 1.3 * size, 1); bo.core.scale.set(size, size, size);
  bo.alive = true; bo.g.visible = true; bo.pos.copy(p); bo.vel.copy(dir).multiplyScalar(style.speed ?? 42); bo.t = 0; bo.dmg = dmg; bo.whizzed = false;
  bo.g.position.copy(p); bo.g.lookAt(tv.copy(p).add(bo.vel)); bolts.push(bo);
}
function hitsPlayer(p, r = 0.5) {
  if (!player.alive) return false;
  const top = player.pos.y + player.height - 0.1, cy = clamp(p.y, player.pos.y + 0.2, top);
  return Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < r && Math.abs(p.y - cy) < 0.45;
}
function updateBolts(dt) {
  const eye = tv3.copy(player.pos).setY(player.pos.y + eyeHeight());
  for (let i = bolts.length - 1; i >= 0; i--) {
    const bo = bolts[i]; bo.t += dt; let dead = bo.t > 3.5;
    for (let s = 1; s <= 3 && !dead; s++) {
      tv.copy(bo.pos).addScaledVector(bo.vel, dt * s / 3);
      if (hitsPlayer(tv)) { hurtPlayer(bo.dmg, bo.pos); dead = true; sparks(tv, 8, null, 4, COL.red, COL.redEnd); break; }
      const c = pointInCollider(tv);
      if (c || tv.y < (world.floor || 0) || tv.y > world.ceiling) {
        dead = true; const n = c && tv.y > 0.05 ? colliderNormal(c, tv, tv2) : tv2.set(0, 1, 0);
        sparks(tv, 10, n, 5, bo.col, COL.redEnd); puff(tv, 2, n, COL.smoke, 0.3, 0.6); SFX.zap(tv);
        if (c && c.mesh && c.mesh.userData.barrel) damageBarrel(c.mesh.userData.barrel, bo.dmg);
        break;
      }
    }
    if (!dead) {
      bo.pos.addScaledVector(bo.vel, dt); bo.g.position.copy(bo.pos);
      if (Math.random() < 0.6) FX.spawn(bo.pos, tv.set(0, 0, 0), 0.18, 0.22, 0.02, bo.col, COL.redEnd, {});
      if (!bo.whizzed && player.alive && bo.pos.distanceTo(eye) < 2.2) { bo.whizzed = true; SFX.whiz(); }
    }
    if (dead) { bo.alive = false; bo.g.visible = false; bolts.splice(i, 1); }
  }
}
// slow explosive orbs (tank shells)
const orbs = [];
function spawnOrb(p, dir, speed, dmg, radius, color) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); glow.scale.set(2.4, 2.4, 1); m.add(glow);
  m.position.copy(p); scene.add(m);
  orbs.push({ m, pos: p.clone(), vel: dir.clone().multiplyScalar(speed), dmg, radius, color: new THREE.Color(color), hex: color, t: 0 });
}
function updateOrbs(dt) {
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i]; o.t += dt;
    o.vel.y -= 3 * dt; o.pos.addScaledVector(o.vel, dt); o.m.position.copy(o.pos);
    FX.spawn(o.pos, tv.set(rand(-.5, .5), rand(-.5, .5), rand(-.5, .5)), 0.4, 0.5, 0.05, o.color, COL.fireEnd, {});
    const hit = hitsPlayer(o.pos, 0.8) || pointInCollider(o.pos) || o.pos.y < 0.1 || o.t > 5;
    if (hit) { scene.remove(o.m); orbs.splice(i, 1); explosion(o.pos, o.radius, o.dmg, { owner: 'enemy', color: o.hex }); }
  }
}
// arcing missiles / mortars with a warning ring at the target
const ringTex = tex(T.ring, 1, 1, false);
const arcs = [];
function spawnArc(from, target, T, dmg, radius, color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0x30343a, metalness: 0.7, roughness: 0.4 }));
  m.geometry.rotateX(Math.PI / 2); scene.add(m);
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), new THREE.MeshBasicMaterial({ map: ringTex, color: 0xff2a1a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  ring.rotation.x = -Math.PI / 2; ring.position.copy(target).setY(target.y + 0.06); scene.add(ring);
  const g = 16, v0 = new V3().subVectors(target, from).addScaledVector(new V3(0, -g, 0), -0.5 * T * T).divideScalar(T);
  arcs.push({ m, ring, from: from.clone(), target: target.clone(), T, t: 0, v0, g, dmg, radius, color, prev: from.clone() });
}
function updateArcs(dt) {
  for (let i = arcs.length - 1; i >= 0; i--) {
    const a = arcs[i]; a.t += dt;
    const t = Math.min(a.t, a.T);
    tv.copy(a.from).addScaledVector(a.v0, t); tv.y -= 0.5 * a.g * t * t;
    a.m.position.copy(tv); a.m.lookAt(tv2.copy(tv).add(tv3.subVectors(tv, a.prev))); a.prev.copy(tv);
    FX.spawn(tv, tv2.set(0, 0, 0), 0.5, 0.35, 0.8, COL.fire, COL.smoke, {});
    a.ring.material.opacity = 0.5 + Math.sin(a.t * 18) * 0.35; a.ring.scale.setScalar(0.6 + 0.4 * (a.t / a.T));
    if (a.t >= a.T) { scene.remove(a.m); scene.remove(a.ring); arcs.splice(i, 1); explosion(a.target.clone().setY(a.target.y + 0.4), a.radius, a.dmg, { owner: 'enemy', color: a.color }); }
  }
}
function clearProjectiles() {
  bolts.forEach(b => { b.alive = false; b.g.visible = false; }); bolts.length = 0;
  orbs.forEach(o => scene.remove(o.m)); orbs.length = 0;
  arcs.forEach(a => { scene.remove(a.m); scene.remove(a.ring); }); arcs.length = 0;
  plasmaShots.forEach(p => { p.alive = false; p.g.visible = false; }); plasmaShots.length = 0;
}

// ---------------- player plasma projectiles ----------------
const plasmaPool = [], plasmaShots = [];
const plasmaRay = new THREE.Raycaster();
function spawnPlasma(p, dir, stats) {
  let s = plasmaPool.find(x => !x.alive);
  if (!s) {
    const g = new THREE.Group(); const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xe0ffff })); g.add(core);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x6cf6ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); glow.scale.set(1.1, 1.1, 1); g.add(glow);
    scene.add(g); s = { g, pos: new V3(), vel: new V3(), alive: false }; plasmaPool.push(s);
  }
  s.alive = true; s.g.visible = true; s.pos.copy(p); s.vel.copy(dir).multiplyScalar(stats.projSpeed); s.t = 0; s.stats = stats;
  plasmaShots.push(s);
}
function updatePlasma(dt) {
  if (!plasmaShots.length) return;
  const targets = hitTargets();
  for (let i = plasmaShots.length - 1; i >= 0; i--) {
    const s = plasmaShots[i]; s.t += dt;
    const step = s.vel.length() * dt;
    plasmaRay.set(s.pos, tv.copy(s.vel).normalize()); plasmaRay.far = step;
    const h = plasmaRay.intersectObjects(targets, false)[0];
    if (h || s.t > 2.5) {
      const p = h ? h.point : s.pos;
      const en = h && h.object.userData.enemy, st = s.stats;
      let hit = false;
      if (en) { const r = damageEnemy(en, st.dmg, { part: h.object.userData.part, point: p, dir: tv2.copy(s.vel).normalize(), source: 'plasma', weapon: 'plasma', headMult: st.head }); ui.hitmarker(r.killed, r.head); SFX.hit(r.head); if (r.killed) SFX.kill(); hit = !r.blocked; }
      else if (h && h.object.userData.barrel) damageBarrel(h.object.userData.barrel, st.dmg);
      // splash
      for (const e of enemies.slice()) { if (e === en || e.dead) continue; const d = e.center(tv3).distanceTo(p); if (d < st.splash + (e.isBoss ? 2 : 0)) { const r = damageEnemy(e, st.dmg * 0.5 * (1 - d / (st.splash + 2)), { part: 'torso', point: e.center(tv4), dir: tv2.copy(s.vel).normalize(), source: 'explosion', weapon: 'plasma' }); if (r.dealt > 0) hit = true; } }
      if (hit) run.hits++;
      for (let k = 0; k < 18; k++) { randDir(tv3, rand(2, 7)); FX.spawn(p, tv3, rand(0.2, 0.45), 0.25, 0.02, COL.plasma, COL.plasmaEnd, { drag: 3 }); }
      flashLight(p, 0x6cf6ff, 4, 8); SFX.zap(p);
      if (h && !en && h.face) decal(p, tv2.copy(h.face.normal).transformDirection(h.object.matrixWorld), 0.35, true);
      s.alive = false; s.g.visible = false; plasmaShots.splice(i, 1); continue;
    }
    s.pos.addScaledVector(s.vel, dt); s.g.position.copy(s.pos);
    FX.spawn(s.pos, tv.set(0, 0, 0), 0.15, 0.25, 0.02, COL.plasma, COL.plasmaEnd, {});
  }
}
function hitTargets() {
  const t = world.levelMeshes.slice();
  for (const e of enemies) for (const h of e.hitMeshes) if (h.visible !== false) t.push(h);
  for (const b of world.barrels) if (!b.dead) t.push(b.mesh);
  return t;
}

// ---------------- explosions ----------------
function explosion(p, radius, dmg, o = {}) {
  const owner = o.owner || 'player';
  SFX.boom(p, radius / 7);
  flashLight(tv.copy(p).setY(p.y + 1), o.color || 0xff8a30, 12, radius * 4.5);
  blast(p, radius, o.color || 0xffa040);
  const n = QUALITY[settings.quality].particles < 1 ? 45 : 70;
  for (let i = 0; i < n; i++) { randDir(tv, rand(2, 9)); tv.y = Math.abs(tv.y) * 1.2; FX.spawn(p, tv, rand(0.35, 0.8), rand(0.6, 1.4), 0.1, COL.fire, COL.fireEnd, { drag: 4, grav: -2 }); }
  sparks(p, 50, tv2.set(0, 1, 0), 18);
  for (let i = 0; i < 22; i++) { randDir(tv, rand(1, 4)); tv.y = Math.abs(tv.y) + 1; SMOKE.spawn(tv2.copy(p).addScaledVector(tv, 0.3), tv, rand(2, 4), 1.2, rand(3, 5), COL.smoke, COL.smokeEnd, { drag: 1.8, grav: -0.6, alpha: 0.7 }); }
  if (!o.silentDecal) decal(tv.set(p.x, groundAt(p.x, p.z, p.y) + 0.01, p.z), tv2.set(0, 1, 0), radius * 0.9, true);
  const enemyDmg = o.enemyDamage ?? (owner === 'player' ? dmg : 0);
  if (enemyDmg > 0) {
    for (const e of enemies.slice()) {
      if (e.dead) continue;
      const c = e.center(tv3); const reach = radius + (e.isBoss ? 3 : e.body ? e.body.radius : 0.5);
      const d = c.distanceTo(p); if (d > reach) continue;
      const f = 1 - d / reach; const dir = tv4.subVectors(c, p).setY(0.5).normalize();
      if (e.body && !e.isBoss) { e.body.vel.addScaledVector(dir, 10 * f); e.body.vel.y += 4 * f; }
      let part = 'torso';
      if (e.shieldUp && e.shieldUp() && p.distanceTo(tv.copy(e.pos).setY(e.pos.y + 1.4)) > 5) part = 'shield';
      const r = damageEnemy(e, enemyDmg * (0.35 + 0.65 * f), { part, point: c.clone(), dir: dir.clone(), source: o.source || 'explosion', weapon: o.weapon || 'explosion', owner });
      if (owner === 'player' && r.dealt > 0) ui.hitmarker(r.killed, false);
    }
  }
  for (const b of world.barrels) { if (!b.dead && b.pos.distanceTo(p) < radius * 0.9 && b.pos.distanceTo(p) > 0.1) b.fuse = b.fuse || rand(0.12, 0.3); }
  const pd = tv.copy(player.pos).setY(player.pos.y + 1).distanceTo(p);
  if (o.hurtsPlayer !== false && dmg > 0 && pd < radius * 1.1) {
    const f = 1 - pd / (radius * 1.1);
    hurtPlayer(dmg * (owner === 'player' ? 0.5 : 1) * f, p, true);
    tv.subVectors(player.pos, p).setY(0).normalize(); player.vel.addScaledVector(tv, 12 * f); player.vel.y += 5 * f;
  }
  shake = Math.min(1.2, shake + Math.max(0, 1 - pd / 35) * 0.9);
  if (pd < 25) ui.flash(0.35 * (1 - pd / 25));
}

// ---------------- barrels ----------------
function damageBarrel(b, dmg) { if (b.dead) return; b.hp -= dmg; if (b.hp <= 0 && !b.fuse) b.fuse = 0.05; else if (b.hp < 20) b.leak = true; }
function updateBarrels(dt) {
  for (const b of world.barrels) {
    if (b.dead) continue;
    if (b.leak && Math.random() < 0.4) FX.spawn(tv.copy(b.pos).setY(b.pos.y + 0.6), tv2.set(rand(-.3, .3), rand(1, 2), rand(-.3, .3)), 0.5, 0.3, 0.05, COL.fire, COL.fireEnd, {});
    if (b.fuse > 0) {
      b.fuse -= dt;
      if (b.fuse <= 0) {
        b.dead = true; b.mesh.visible = false; const ci = world.colliders.indexOf(b.col); if (ci >= 0) world.colliders.splice(ci, 1);
        explosion(b.pos.clone().setY(b.pos.y + 0.2), 6.5, 130, { owner: 'player', source: 'explosion', weapon: 'drum' });
        for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(rand(.1, .3), rand(.1, .4), .03), M.drum); m.position.copy(b.pos); scene.add(m); debris.push({ m, v: randDir(new V3(), rand(5, 11)).setY(rand(5, 10)), w: new V3(rand(-12, 12), rand(-12, 12), rand(-12, 12)), t: 4 }); }
      }
    }
  }
}
function resetBarrels() { for (const b of world.barrels) { if (b.dead && !world.colliders.includes(b.col)) world.colliders.push(b.col); b.dead = false; b.mesh.visible = true; b.hp = 30; b.fuse = 0; b.leak = false; } }

// ---------------- debris ----------------
function updateDebris(dt) {
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i]; d.t -= dt; d.v.y -= 20 * dt; d.m.position.addScaledVector(d.v, dt);
    d.m.rotation.x += d.w.x * dt; d.m.rotation.y += d.w.y * dt; d.m.rotation.z += d.w.z * dt;
    const gy = (world.floor || 0) + 0.12;
    if (d.m.position.y < gy) { d.m.position.y = gy; d.v.y *= -0.3; d.v.x *= 0.6; d.v.z *= 0.6; d.w.multiplyScalar(0.6); }
    const c = pointInCollider(d.m.position); if (c && d.v.y < 0 && d.m.position.y < c.max.y + 0.1) { d.m.position.y = c.max.y + 0.05; d.v.y *= -0.2; d.v.x *= 0.5; d.v.z *= 0.5; }
    if (d.spark && Math.random() < 0.12) sparks(d.m.position, 2, null, 3, COL.elec, COL.elecEnd);
    if (d.spark && Math.random() < 0.06) SMOKE.spawn(d.m.position, tv.set(0, 1, 0), 1.5, 0.3, 1.2, COL.smoke, COL.smokeEnd, { alpha: 0.45, drag: 1 });
    if (d.t < 0.6) d.m.scale.setScalar(Math.max(0.01, d.t / 0.6));
    if (d.t <= 0) { scene.remove(d.m); debris.splice(i, 1); }
  }
}

// ---------------- grenades ----------------
const nadeGeo = new THREE.SphereGeometry(0.09, 12, 10);
const nadeMats = { frag: new THREE.MeshStandardMaterial({ color: 0x3f4a30, roughness: 0.6, metalness: 0.4 }), stun: new THREE.MeshStandardMaterial({ color: 0x2a4a6a, roughness: 0.4, metalness: 0.6, emissive: 0x1a4a8a, emissiveIntensity: 0.4 }) };
function throwGrenade(type) {
  const key = type === 'stun' ? 'stuns' : 'frags';
  if (player[key] <= 0 || G.nadeT > 0 || G.switchT > 0) { if (player[key] <= 0) SFX.deny(); return; }
  player[key]--; G.nadeT = 0.9; VMS.nade = 1; SFX.throwN();
  const m = new THREE.Mesh(nadeGeo, nadeMats[type]); m.castShadow = true;
  const blink = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: type === 'stun' ? 0x6db4ff : 0xff3020, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); blink.scale.set(0.5, 0.5, 1); m.add(blink);
  camera.getWorldDirection(tv);
  const p = camera.position.clone().addScaledVector(tv, 0.6); p.y -= 0.15;
  m.position.copy(p); scene.add(m);
  grenades.push({ type, m, blink, pos: p, vel: tv.clone().multiplyScalar(19).add(new V3(0, 4, 0)).addScaledVector(player.vel, 0.6), fuse: type === 'stun' ? 1.6 : 2.2, spin: new V3(rand(-9, 9), rand(-9, 9), rand(-9, 9)) });
}
function updateGrenades(dt) {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const n = grenades[i]; n.fuse -= dt;
    n.vel.y -= 22 * dt;
    const next = tv.copy(n.pos).addScaledVector(n.vel, dt);
    let bounced = false;
    const floor = (world.floor || 0) + 0.09;
    if (next.y < floor) { next.y = floor; if (Math.abs(n.vel.y) > 1.5) bounced = true; n.vel.y *= -0.4; n.vel.x *= 0.7; n.vel.z *= 0.7; }
    if (next.y > world.ceiling - 0.1) { next.y = world.ceiling - 0.1; n.vel.y = -Math.abs(n.vel.y) * 0.4; }
    const c = pointInCollider(next);
    if (c) {
      const pen = [Math.min(next.x - c.min.x, c.max.x - next.x), Math.min(next.y - c.min.y, c.max.y - next.y), Math.min(next.z - c.min.z, c.max.z - next.z)];
      const ax = pen.indexOf(Math.min(...pen));
      if (ax === 0) { n.vel.x *= -0.45; next.x = n.pos.x; } else if (ax === 1) { if (n.vel.y < 0) next.y = c.max.y + 0.09; n.vel.y *= -0.4; n.vel.x *= 0.7; n.vel.z *= 0.7; } else { n.vel.z *= -0.45; next.z = n.pos.z; }
      bounced = n.vel.length() > 1.5;
    }
    if (bounced) SFX.bounce(next);
    n.pos.copy(next); n.m.position.copy(n.pos);
    n.m.rotation.x += n.spin.x * dt; n.m.rotation.y += n.spin.y * dt; n.spin.multiplyScalar(Math.exp(-dt));
    n.blink.visible = (n.fuse * (n.fuse < 0.8 ? 12 : 5)) % 2 < 1;
    if (n.fuse <= 0) {
      scene.remove(n.m); grenades.splice(i, 1);
      const p = n.pos.clone().setY(Math.max(n.pos.y, 0.3));
      if (n.type === 'stun') stunBurst(p, 9);
      else explosion(p, 7, 140 * buffMods().blast, { owner: 'player', weapon: 'frag', enemyDamage: 140 });
    }
  }
}
function stunBurst(p, r) {
  SFX.stun(p); flashLight(p, 0x6db4ff, 14, r * 4);
  blast(p, r, 0x6db4ff, 0xa0d8ff);
  for (let i = 0; i < 90; i++) { randDir(tv, rand(4, 14)); FX.spawn(p, tv, rand(0.3, 0.7), rand(0.2, 0.5), 0.02, COL.elec, COL.elecEnd, { drag: 3 }); }
  for (const e of enemies.slice()) {
    const d = e.center(tv3).distanceTo(p); if (d > r + (e.isBoss ? 3 : 0)) continue;
    e.stun(3.5); damageEnemy(e, 10, { part: 'torso', point: e.center(tv4).clone(), dir: tv2.set(0, 1, 0), source: 'explosion', weapon: 'stun' });
  }
  const pd = tv.copy(player.pos).setY(player.pos.y + 1).distanceTo(p);
  if (pd < 5) { player.stunT = 1.2; }
  if (pd < 20) ui.flash(0.25 * (1 - pd / 20));
}

// ---------------- pickups ----------------
const PK = {
  health: { col: 0x39d0b0, label: '+40 integrity' },
  ammo: { col: 0xf5a524, label: 'Ammo resupply' },
  armor: { col: 0x6db4ff, label: '+25 armor' },
  pu_damage: { col: 0xff4a3d, label: 'Double damage · 10s', power: 'damage' },
  pu_speed: { col: 0x6db4ff, label: 'Speed boost · 10s', power: 'speed' },
  pu_ammo: { col: 0xf5a524, label: 'Infinite ammo · 10s', power: 'ammo' },
};
function spawnPickup(type, p) {
  const g = new THREE.Group(); const def = PK[type];
  const glow = new THREE.MeshStandardMaterial({ color: def.col, emissive: def.col, emissiveIntensity: 0.9, roughness: 0.4 });
  const add = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); g.add(m); return m; };
  if (def.power) {
    const oct = new THREE.Mesh(new THREE.OctahedronGeometry(0.34), new THREE.MeshStandardMaterial({ color: def.col, emissive: def.col, emissiveIntensity: 1.2, metalness: 0.5, roughness: 0.2 })); g.add(oct);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 5, 12, 1, true), new THREE.MeshBasicMaterial({ color: def.col, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); col.position.y = 2; g.add(col);
  } else {
    add(0.5, 0.34, 0.36, botDark, 0, 0, 0);
    if (type === 'health') { add(0.26, 0.08, 0.37, glow, 0, 0, 0); add(0.08, 0.26, 0.37, glow, 0, 0, 0); }
    else if (type === 'ammo') { for (let i = -1; i <= 1; i++) add(0.06, 0.14, 0.06, glow, i * 0.12, 0.22, 0); add(0.52, 0.05, 0.37, glow, 0, 0, 0); }
    else add(0.3, 0.3, 0.37, glow, 0, 0, 0);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: def.col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 })); sp.scale.set(1.6, 1.6, 1); g.add(sp);
  const base = groundAt(p.x, p.z, p.y + 0.5) + 0.6;
  g.position.set(p.x, base, p.z); scene.add(g);
  pickups.push({ type, g, base, t: def.power ? 15 : 25, def });
}
function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const k = pickups[i]; k.t -= dt;
    k.g.rotation.y += dt * 1.8; k.g.position.y = k.base + Math.sin(time * 3 + i) * 0.12;
    k.g.visible = k.t > 5 || (k.t * 6 | 0) % 2 === 0;
    const d = Math.hypot(k.g.position.x - player.pos.x, k.g.position.z - player.pos.z);
    let take = player.alive && d < 1.5 && Math.abs(k.g.position.y - (player.pos.y + 0.8)) < 1.6;
    if (take) {
      if (k.type === 'health') { if (player.hp >= maxHp()) take = false; else { player.hp = Math.min(maxHp(), player.hp + 40); damageNumber(tv.copy(player.pos).setY(player.pos.y + 1.2).addScaledVector(camFwdFlat(tv2), 1.5), '+40', 'heal'); } }
      else if (k.type === 'armor') { if (player.armor >= 100) take = false; else player.armor = Math.min(100, player.armor + 25); }
      else if (k.type === 'ammo') refillAmmo(0.5, true);
      else { powerups[k.def.power] = 10; SFX.powerup(); ui.toast(POWERUPS[k.def.power].name, '10 seconds', 'drop'); }
    }
    if (take) { SFX.pickup(); ui.prompt(k.def.label, false, 1.2); sparks(k.g.position, 16, null, 3, new THREE.Color(k.def.col), COL.black); }
    if (take || k.t <= 0) { scene.remove(k.g); pickups.splice(i, 1); }
  }
  for (const key in powerups) if (powerups[key] > 0) powerups[key] = Math.max(0, powerups[key] - dt);
}
function camFwdFlat(out) { return out.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw)); }

// ---------------- coins (visual only; the balance is credited on kill) ----------------
const coinGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.025, 14); coinGeo.rotateX(Math.PI / 2);
const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc83a, emissive: 0x6a4a00, metalness: 1, roughness: 0.25 });
const coinFx = [];
function spawnCoinBurst(p, n) {
  n = Math.min(n, 12);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(coinGeo, coinMat); m.position.copy(p); scene.add(m);
    coinFx.push({ m, v: new V3(rand(-3, 3), rand(4, 7), rand(-3, 3)), t: 0, delay: rand(0.35, 0.7) });
  }
}
function updateCoins(dt) {
  const target = tv3.copy(player.pos).setY(player.pos.y + 1.1);
  for (let i = coinFx.length - 1; i >= 0; i--) {
    const c = coinFx[i]; c.t += dt; c.m.rotation.y += dt * 12;
    if (c.t < c.delay) { c.v.y -= 16 * dt; c.m.position.addScaledVector(c.v, dt); const g = groundAt(c.m.position.x, c.m.position.z, c.m.position.y) + 0.1; if (c.m.position.y < g) { c.m.position.y = g; c.v.y *= -0.4; c.v.x *= 0.6; c.v.z *= 0.6; } }
    else {
      const sp = 8 + (c.t - c.delay) * 30;
      tv.subVectors(target, c.m.position); const d = tv.length();
      if (d < 0.6 || c.t > 4) { scene.remove(c.m); coinFx.splice(i, 1); SFX.coin(); continue; }
      c.m.position.addScaledVector(tv.normalize(), Math.min(d, sp * dt));
    }
  }
}
function clearCoins() { coinFx.forEach(c => scene.remove(c.m)); coinFx.length = 0; }

// ---------------- kill rewards ----------------
function onEnemyKilled(e, info) {
  const k = e.isBoss ? null : e.k;
  const p = e.center(new V3());
  const byPlayer = info.owner !== 'enemy' && info.source !== 'self';
  if (!byPlayer) return;
  const direct = info.source === 'bullet' || info.source === 'plasma';
  const head = info.part === 'head' && direct;
  run.kills++; profile.stats.kills++;
  if (head) { run.heads++; profile.stats.headshots++; questEvent('headshot'); }
  const weapon = info.weapon || 'unknown';
  profile.stats.weaponKills[weapon] = (profile.stats.weaponKills[weapon] || 0) + 1;
  questEvent('kill', 1, { weapon });
  if (info.source === 'explosion' || info.source === 'airstrike') { profile.stats.explosiveKills++; questEvent('explosiveKill'); }
  run.multi = run.multiT > 0 ? run.multi + 1 : 1; run.multiT = 1.6;
  // killstreak rewards
  run.killstreak++;
  if (run.killstreak === 10) { run.airstrikes++; ui.toast('Airstrike ready', 'Press Z to mark a target', 'drop'); SFX.powerup(); questEvent('airstrike'); }
  if (run.killstreak >= 20) { run.turrets++; run.killstreak = 0; ui.toast('Auto-turret ready', 'Press X to deploy it', 'drop'); SFX.powerup(); }
  const mult = 1 + Math.min(run.multi - 1, 4) * 0.25;
  if (k) {
    let coins = k.coins + (head ? 5 : 0) + (run.multi >= 2 ? 5 * Math.min(run.multi - 1, 4) : 0);
    const got = addCoins(coins, p);
    spawnCoinBurst(p, Math.ceil(got / 5));
    damageNumber(tv.copy(p).setY(p.y + 0.6), `+${got}`, 'coin');
    addXp(k.xp + (head ? 10 : 0));
    run.score += Math.round((k.score + (head ? 50 : 0)) * mult);
  }
  if (run.multi >= 2) ui.streak(['', '', 'Double kill', 'Triple kill', 'Quad kill'][run.multi] || 'Rampage');
  ui.killfeed(weaponShortName(weapon), e.isBoss ? e.name : `${k.name}-${String(e.id % 100).padStart(2, '0')}`, head);
  if (k && e.kind !== 'exploder') {
    const r = Math.random();
    if (e.kind === 'tank' || r < 0.12) spawnPickup('health', p);
    else if (r < 0.36) spawnPickup('ammo', p);
    else if (r < 0.41) spawnPickup('armor', p);
    else if (r < 0.46) spawnPickup(pick(['pu_damage', 'pu_speed', 'pu_ammo']), p);
  }
}
function weaponShortName(w) { return WEAPON_BY_ID[w] ? WEAPON_BY_ID[w].short : ({ frag: 'FRAG', stun: 'STUN', drum: 'DRUM', turret: 'TURRET', airstrike: 'AIR', explosion: 'BLAST' }[w] || '—'); }
function rollRareDrop() {
  const pool = [];
  for (const w of WEAPONS) if (weaponOwned(w.id)) for (const a of ATT_IDS) if (!attOwned(w.id, a)) pool.push({ att: [w.id, a], weight: 6 });
  for (const s of ['scorch', 'circuit', 'arctic', 'crimson', 'desert']) if (!profile.skins[s]) pool.push({ skin: s, weight: s === 'scorch' ? 6 : 2 });
  for (const w of WEAPONS) if (!weaponOwned(w.id) && w.id !== 'plasma') pool.push({ weapon: w.id, weight: 1.5 });
  if (!pool.length) return { coins: 1000, xp: 800 };
  let tot = pool.reduce((s, x) => s + x.weight, 0), r = Math.random() * tot;
  for (const x of pool) { r -= x.weight; if (r <= 0) { delete x.weight; return x; } }
  const x = pool[0]; delete x.weight; return x;
}
function onBossKilled(b) {
  const p = b.center(new V3());
  const coins = addCoins(400 + 100 * run.wave, p);
  spawnCoinBurst(p, 12);
  damageNumber(tv.copy(p).setY(p.y + 2), `+${coins}`, 'coin');
  addXp(600 + 150 * b.cycle);
  run.score += 2500 + 500 * b.cycle;
  profile.stats.bosses++;
  questEvent('boss');
  if (!b.tookDamage) questEvent('bossFlawless');
  const drop = rollRareDrop(); grantReward(drop);
  const txt = rewardText(drop); run.drops.push(txt);
  ui.toast('Rare drop', txt, 'drop');
  ui.banner(`${b.name} destroyed`, `+${fmt(coins)} coins · ${txt}`, 3.2);
  spawnPickup('health', tv.copy(p).add(tv2.set(2, 0, 0))); spawnPickup('ammo', tv.copy(p).add(tv2.set(-2, 0, 0)));
  Music.play('combat');
}

// ---------------- killstreaks ----------------
const strikeRay = new THREE.Raycaster();
function callAirstrike() {
  if (run.airstrikes <= 0) { SFX.deny(); return; }
  camera.getWorldDirection(tv);
  strikeRay.set(camera.position, tv); strikeRay.far = 220;
  const h = strikeRay.intersectObjects(world.levelMeshes, false)[0];
  const target = h ? h.point.clone() : camera.position.clone().addScaledVector(tv, 40);
  target.y = groundAt(target.x, target.z, target.y + 0.5);
  if (world.ceiling < 20) { ui.prompt('Airstrikes cannot reach underground', true, 1.6); SFX.deny(); return; }
  run.airstrikes--;
  const dir = camFwdFlat(new V3());
  ui.toast('Airstrike inbound', 'Clear the red smoke', 'drop');
  const marker = setInterval(() => { for (let i = 0; i < 3; i++) SMOKE.spawn(tv.copy(target).add(tv2.set(rand(-.3, .3), 0.2, rand(-.3, .3))), tv2.set(rand(-.3, .3), rand(2, 3.5), rand(-.3, .3)), 2.5, 0.4, 2.4, COL.red, C(0x802020), { alpha: 0.6, drag: 0.5 }); }, 60);
  flashLight(target, 0xff2a1a, 4, 8);
  setTimeout(() => SFX.jet(), 700);
  setTimeout(() => {
    clearInterval(marker);
    if (!run.active) return;
    for (let i = 0; i < 7; i++) setTimeout(() => {
      if (!run.active) return;
      const p = target.clone().addScaledVector(dir, (i - 3) * 3.5); p.x += rand(-1, 1); p.z += rand(-1, 1); p.y = groundAt(p.x, p.z, p.y + 3) + 0.5;
      explosion(p, 6.5, 0, { owner: 'player', source: 'airstrike', weapon: 'airstrike', enemyDamage: 260, hurtsPlayer: false });
    }, i * 110);
  }, 2200);
}
function deployTurret() {
  if (run.turrets <= 0) { SFX.deny(); return; }
  const f = camFwdFlat(new V3());
  const p = player.pos.clone().addScaledVector(f, 2);
  if (!pointFree(p.x, p.z, 0.5, player.pos.y + 0.1, player.pos.y + 1.5)) p.copy(player.pos);
  p.y = groundAt(p.x, p.z, player.pos.y + 0.5);
  run.turrets--;
  const g = new THREE.Group(); g.position.copy(p); scene.add(g);
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a4148, metalness: 0.8, roughness: 0.4 }), acc = new THREE.MeshStandardMaterial({ color: 0xf5a524, roughness: 0.4 });
  for (let i = 0; i < 3; i++) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), mat); const a = i / 3 * Math.PI * 2; leg.position.set(Math.cos(a) * 0.3, 0.4, Math.sin(a) * 0.3); leg.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); g.add(leg); }
  const head = new THREE.Group(); head.position.y = 0.95; g.add(head);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.5), acc); head.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.6, 8), mat); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.03, -0.5); head.add(barrel);
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: 0x5ff2ff })); eye.position.set(0, 0.08, -0.26); head.add(eye);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  turrets.push({ g, head, pos: p.clone().setY(p.y + 1), t: 30, fireT: 0, target: null, retarget: 0 });
  SFX.clear(); ui.toast('Turret deployed', '30 seconds of covering fire', 'drop');
}
function updateTurrets(dt) {
  for (let i = turrets.length - 1; i >= 0; i--) {
    const t = turrets[i]; t.t -= dt; t.retarget -= dt;
    if (t.retarget <= 0) {
      t.retarget = 0.3; t.target = null; let best = 45;
      for (const e of enemies) { if (e.dead) continue; const c = e.center(tv); const d = c.distanceTo(t.pos); if (d < best && !segBlocked(t.pos, c)) { best = d; t.target = e; } }
    }
    if (t.target && !t.target.dead) {
      const c = t.target.center(tv); const yaw = Math.atan2(-(c.x - t.pos.x), -(c.z - t.pos.z));
      t.head.rotation.y = yaw; t.head.rotation.x = Math.atan2(c.y - t.pos.y, Math.hypot(c.x - t.pos.x, c.z - t.pos.z));
      t.fireT -= dt;
      if (t.fireT <= 0) {
        t.fireT = 0.12;
        const m = tv2.copy(t.pos).addScaledVector(tv3.subVectors(c, t.pos).normalize(), 0.8);
        tracer(m, c, 0x9ff6ff); SFX.turret(t.pos); sparks(c, 3, null, 4, COL.elec, COL.elecEnd);
        const r = damageEnemy(t.target, 12, { part: 'torso', point: c.clone(), dir: tv4.subVectors(c, t.pos).normalize().clone(), source: 'turret', weapon: 'turret' });
        if (r.killed) t.target = null;
      }
    }
    if (t.t <= 0) { explosion(t.pos, 2, 0, { hurtsPlayer: false, enemyDamage: 0 }); scene.remove(t.g); turrets.splice(i, 1); }
  }
}
function clearTurrets() { turrets.forEach(t => scene.remove(t.g)); turrets.length = 0; }
