'use strict';
// Player controller, weapon handling, wave director, game states, input and the main loop.

let state = 'menu', time = 0, shake = 0, deathT = 0, heartT = 0, locked = false, expectUnlock = false, lookGrace = 0;
const player = { pos: new V3(0, 0, 20), vel: new V3(), radius: 0.4, height: 1.8, onGround: true, landV: 0, yaw: 0, pitch: 0, hp: 100, armor: 50, lastHurt: -99, crouch: 0, stepDist: 0, frags: 3, stuns: 2, alive: true, stunT: 0, slideT: 0, slideCd: 0, jumpHeld: false, streakWarned: false };
const G = { cur: 0, prev: 1, cooldown: 0, reloading: false, reloadT: 0, switchT: 0, switchTo: -1, ads: 0, bloom: 0, fireQueued: false, recoilPitch: 0, pumpT: 1, nadeT: 0, flashT: 0, burstLeft: 0, burstT: 0, dryClicked: false };
const VMS = { kick: 0, kickRot: 0, swayX: 0, swayY: 0, bob: 0, sprint: 0, land: 0, nade: 0, slide: 0, slideTilt: 0 };
const waves = { active: false, queue: [], spawnT: 0, inter: 0, bossPending: 0, boss: false };
let loadout = [profile.loadout.primary, profile.loadout.secondary];
let ammo = [{ mag: 0, reserve: 0 }, { mag: 0, reserve: 0 }];
const keys = {}; const look = { dx: 0, dy: 0 };
let mouseL = false, mouseR = false;
const mapsAtStart = [];

// ---------------- derived stats ----------------
let rtCache = null, rtFrame = -1, frameNo = 0;
function weaponRuntime() {
  if (rtFrame === frameNo && rtCache && rtCache.id === loadout[G.cur]) return rtCache;
  const s = weaponStats(loadout[G.cur]), mods = buffMods();
  s.rpm *= mods.rate; if (s.burstDelay) s.burstDelay /= mods.rate;
  s.reload *= mods.reload; s.mag = Math.max(1, Math.round(s.mag * mods.mag));
  rtCache = s; rtFrame = frameNo; return s;
}
function magCap(id) { const s = weaponStats(id); return Math.max(1, Math.round(s.mag * buffMods().mag)); }
function reserveCap(id) { return Math.round(WEAPON_BY_ID[id].reserve * 1.5); }
function currentWeapon() { return WEAPON_BY_ID[loadout[G.cur]]; }
function currentAmmo() { return ammo[G.cur]; }
function eyeHeight() { return lerp(1.65, 1.05, player.crouch); }
function maxHp() { return buffMods().maxHp; }
function refillAmmo(frac, fromPickup) {
  loadout.forEach((id, i) => {
    const w = WEAPON_BY_ID[id], cap = reserveCap(id);
    ammo[i].reserve = Math.min(cap, ammo[i].reserve + Math.ceil((fromPickup ? w.mag * (w.id === 'pistol' ? 1.5 : 1) * 1.2 : cap) * frac));
  });
  if (fromPickup && Math.random() < 0.35) player.frags = Math.min(5, player.frags + 1);
}
function setupLoadout(full) {
  const prev = loadout.slice(), prevAmmo = ammo.map(a => Object.assign({}, a));
  loadout = [profile.loadout.primary, profile.loadout.secondary];
  ammo = loadout.map((id, i) => {
    const keep = full ? -1 : prev.indexOf(id);
    if (keep >= 0) return { mag: Math.min(prevAmmo[keep].mag, magCap(id)), reserve: prevAmmo[keep].reserve };
    return { mag: magCap(id), reserve: WEAPON_BY_ID[id].reserve };
  });
  WEAPONS.forEach(w => { GUNS[w.id].g.visible = false; refreshViewmodel(w.id); });
  G.cur = 0; G.prev = 1; G.switchTo = -1; G.switchT = 0; G.reloading = false;
  GUNS[loadout[0]].g.visible = true;
}
function loadoutChanged() { if (run.active) setupLoadout(false); ui.renderProfile(); }

// ---------------- player damage ----------------
function hurtPlayer(amount, from, explosive) {
  if (!player.alive || state !== 'playing') return;
  amount *= buffMods().armorMul;
  const absorbed = Math.min(player.armor, amount * 0.6); player.armor -= absorbed; player.hp -= amount - absorbed;
  run.dmgThisWave += amount; if (boss && !boss.dead) boss.tookDamage = true;
  player.lastHurt = time; shake = Math.min(1, shake + 0.2 + amount * 0.01);
  SFX.hurt(); ui.hurt(); if (from && !explosive) ui.dmgIndicator(from);
  if (player.hp < maxHp() * 0.35 && run.killstreak > 0) { if (run.killstreak >= 3) ui.toast('Killstreak lost', 'Integrity dropped below 35%'); run.killstreak = 0; }
  if (player.hp <= 0) die();
}
function die() {
  player.hp = 0; player.alive = false; deathT = 0; state = 'dead'; SFX.death();
  if (document.exitPointerLock && locked) { expectUnlock = true; document.exitPointerLock(); }
}

// ---------------- movement ----------------
function updatePlayer(dt) {
  const s = weaponRuntime(), mods = buffMods();
  const zoomSens = lerp(1, s.zoom, G.ads);
  player.yaw -= look.dx * 0.0022 * settings.sens * zoomSens;
  player.pitch -= look.dy * 0.0022 * settings.sens * zoomSens * (settings.invert ? -1 : 1);
  VMS.swayX = damp(VMS.swayX, clamp(look.dx * 0.0006, -0.05, 0.05), 10, dt); VMS.swayY = damp(VMS.swayY, clamp(look.dy * 0.0006, -0.05, 0.05), 10, dt);
  look.dx = look.dy = 0;
  const rec = G.recoilPitch * Math.min(1, dt * 7); G.recoilPitch -= rec; player.pitch -= rec * 0.7;
  player.pitch = clamp(player.pitch, -1.5, 1.5);
  player.stunT = Math.max(0, player.stunT - dt); player.slideCd = Math.max(0, player.slideCd - dt);
  const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), st = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const sprinting = keys.ShiftLeft && f > 0 && !keys.KeyC && G.ads < 0.3 && !G.reloading && player.slideT <= 0;
  const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
  if (player.slideT > 0) {
    player.slideT -= dt;
    player.vel.x = damp(player.vel.x, 0, 1.2, dt); player.vel.z = damp(player.vel.z, 0, 1.2, dt);
    if (player.slideT <= 0 || Math.hypot(player.vel.x, player.vel.z) < 3) { player.slideT = 0; player.slideCd = 0.6; }
  } else {
    const crouching = !!keys.KeyC;
    const speed = (crouching ? 3.2 : sprinting ? 9.6 : lerp(6.3, 3.9, G.ads)) * mods.speed * s.move * (player.stunT > 0 ? 0.5 : 1);
    let wx = -sy * f + cy * st, wz = -cy * f - sy * st; const wl = Math.hypot(wx, wz); if (wl > 0) { wx /= wl; wz /= wl; }
    const accel = player.onGround ? 14 : 2.5;
    player.vel.x = damp(player.vel.x, wx * speed, accel, dt); player.vel.z = damp(player.vel.z, wz * speed, accel, dt);
  }
  const wantCrouch = keys.KeyC || player.slideT > 0;
  player.crouch = damp(player.crouch, wantCrouch ? 1 : 0, 12, dt);
  player.height = lerp(1.8, 1.2, player.crouch);
  if (keys.Space && player.onGround && !player.jumpHeld) { player.vel.y = 8; player.onGround = false; player.jumpHeld = true; if (player.slideT > 0) { player.slideT = 0; player.slideCd = 0.6; } SFX.land(0.4); }
  if (!keys.Space) player.jumpHeld = false;
  moveBody(player, dt);
  if (player.landV > 6) { SFX.land(Math.min(1.5, player.landV / 10)); VMS.land = Math.min(1, player.landV / 14); shake += player.landV * 0.01; }
  const hs = Math.hypot(player.vel.x, player.vel.z);
  VMS.sprint = damp(VMS.sprint, sprinting && hs > 4 ? 1 : 0, 8, dt);
  VMS.slideTilt = damp(VMS.slideTilt, player.slideT > 0 ? 1 : 0, 10, dt);
  if (player.onGround && hs > 1 && player.slideT <= 0) { player.stepDist += hs * dt; VMS.bob += hs * dt * 1.35; const stride = sprinting ? 2.7 : 2.1; if (player.stepDist > stride) { player.stepDist = 0; SFX.step(sprinting); } }
  if (player.slideT > 0 && Math.random() < 0.5) SMOKE.spawn(tv.copy(player.pos).add(tv2.set(rand(-.3, .3), 0.1, rand(-.3, .3))), tv2.set(rand(-.5, .5), 0.5, rand(-.5, .5)), 0.6, 0.2, 0.7, COL.dust, COL.dustEnd, { alpha: 0.4 });
  // regen
  const mh = maxHp();
  if (mods.regen && player.hp < mh) player.hp = Math.min(mh, player.hp + mods.regen * dt);
  if (time - player.lastHurt > 5 && player.hp < mh) player.hp = Math.min(mh, player.hp + 6 * dt);
  if (player.hp > mh) player.hp = mh;
  if (player.hp < mh * 0.3) { heartT -= dt; if (heartT <= 0) { heartT = 0.95; SFX.heartbeat(); } }
}
function trySlide() {
  const hs = Math.hypot(player.vel.x, player.vel.z);
  if (player.onGround && player.slideT <= 0 && player.slideCd <= 0 && keys.ShiftLeft && hs > 6) {
    player.slideT = 0.8; const k = 13.5 / hs; player.vel.x *= k; player.vel.z *= k; SFX.slide(); shake += 0.05;
  }
}
function updateCamera(dt) {
  shake = Math.max(0, shake - dt * 1.6);
  const sk = shake * shake * (reduceMotion ? 0.3 : 1);
  const s = weaponRuntime();
  const bobA = player.onGround && player.slideT <= 0 ? Math.min(1, Math.hypot(player.vel.x, player.vel.z) / 6) * (1 - G.ads * 0.85) : 0;
  VMS.land = damp(VMS.land, 0, 6, dt);
  camera.position.set(player.pos.x, player.pos.y + eyeHeight() + Math.sin(VMS.bob * 2) * 0.035 * bobA - VMS.land * 0.18, player.pos.z);
  camera.position.x += (Math.random() - .5) * sk * 0.25; camera.position.y += (Math.random() - .5) * sk * 0.25;
  camera.rotation.set(player.pitch + (Math.random() - .5) * sk * 0.04, player.yaw + (Math.random() - .5) * sk * 0.04, Math.sin(VMS.bob) * 0.006 * bobA - VMS.slideTilt * 0.06);
  const targetFov = settings.fov * lerp(1, s.zoom, smooth(G.ads)) * (1 + VMS.sprint * 0.06 + VMS.slideTilt * 0.08) * (powerups.speed > 0 ? 1.04 : 1);
  camera.fov = damp(camera.fov, targetFov, 18, dt); camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  sky.position.copy(camera.position);
  SFX.L.pos.copy(camera.position); SFX.L.right.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  sun.position.copy(camera.position).addScaledVector(sunDir, 120); sun.target.position.copy(camera.position); sun.position.y = sunDir.y * 120 + camera.position.y;
}

// ---------------- weapons ----------------
function equip(i, instant) {
  if (i < 0 || i >= loadout.length) return;
  if (instant) { WEAPONS.forEach(w => GUNS[w.id].g.visible = false); G.prev = G.cur !== i ? G.cur : G.prev; G.cur = i; G.switchT = 0; GUNS[loadout[i]].g.visible = true; return; }
  if (i === G.cur && G.switchTo < 0) return;
  G.switchTo = i; G.switchT = 0.4; G.reloading = false; G.burstLeft = 0; G.ads = Math.min(G.ads, 0.3); SFX.click(1400, 0.15);
}
function startReload() {
  const s = weaponRuntime(), am = ammo[G.cur];
  if (G.reloading || G.switchT > 0 || am.mag >= s.mag || am.reserve <= 0 || buffMods().infinite) return;
  G.reloading = true; G.reloadT = 0; G.burstLeft = 0;
  if (s.shellReload) SFX.click(2200, 0.15);
  else { SFX.click(1600, 0.2, 0.1); SFX.thunk(s.reload * 0.55, 0.3); SFX.click(2800, 0.25, s.reload * 0.85); SFX.click(2000, 0.2, s.reload * 0.9); }
}
function updateWeapon(dt) {
  let s = weaponRuntime(), am = ammo[G.cur];
  const mods = buffMods();
  G.cooldown = Math.max(0, G.cooldown - dt); G.nadeT = Math.max(0, G.nadeT - dt);
  G.bloom = damp(G.bloom, 0, 5, dt);
  if (am.mag > s.mag) am.mag = s.mag;
  if (G.switchT > 0) {
    const before = G.switchT; G.switchT -= dt;
    if (before > 0.2 && G.switchT <= 0.2 && G.switchTo >= 0) { GUNS[loadout[G.cur]].g.visible = false; G.prev = G.cur; G.cur = G.switchTo; G.switchTo = -1; GUNS[loadout[G.cur]].g.visible = true; SFX.click(2400, 0.12); s = weaponRuntime(); am = ammo[G.cur]; }
    if (G.switchT < 0) G.switchT = 0;
  }
  const wantAds = mouseR && G.switchT <= 0 && VMS.sprint < 0.5 && player.slideT <= 0 && !(G.reloading && !s.shellReload);
  G.ads = clamp(G.ads + (wantAds ? 1 : -1) * dt * s.adsSpeed, 0, 1);
  if (G.reloading) {
    G.reloadT += dt;
    if (s.shellReload) {
      if (G.reloadT >= s.reload) { G.reloadT = 0; am.mag++; am.reserve--; SFX.thunk(0, 0.25); SFX.click(3000, 0.12, 0.05); VMS.kick += 0.02; if (am.mag >= s.mag || am.reserve <= 0) { G.reloading = false; G.pumpT = 0; SFX.click(1200, 0.3, 0.1); SFX.click(1800, 0.3, 0.25); } }
    } else if (G.reloadT >= s.reload) { const n = Math.min(s.mag - am.mag, am.reserve); am.mag += n; am.reserve -= n; G.reloading = false; }
  }
  // burst in progress
  if (G.burstLeft > 0) {
    G.burstT -= dt;
    if (G.burstT <= 0) {
      if (am.mag > 0 || mods.infinite) { fire(s, am); G.burstLeft--; G.burstT = 60 / s.rpm; if (G.burstLeft === 0) G.cooldown = s.burstDelay; }
      else { G.burstLeft = 0; G.cooldown = 0.25; }
    }
  }
  const want = s.fire === 'auto' ? mouseL : G.fireQueued;
  if (want && player.alive && G.switchT <= 0 && G.nadeT < 0.5 && G.cooldown <= 0 && G.burstLeft <= 0) {
    if (G.reloading && s.shellReload && am.mag > 0) G.reloading = false;
    if (!G.reloading) {
      if (am.mag <= 0 && !mods.infinite) { if (G.fireQueued || !G.dryClicked) { SFX.dry(); G.dryClicked = true; } G.cooldown = 0.25; startReload(); }
      else if (s.fire === 'burst') { G.burstLeft = s.burstCount; G.burstT = 0; }
      else fire(s, am);
    }
  }
  if (!mouseL) G.dryClicked = false;
  G.fireQueued = false;
  if (am.mag <= 0 && !G.reloading && am.reserve > 0 && G.cooldown <= 0 && !mouseL && !mods.infinite) startReload();
  if (G.pumpT < 1) G.pumpT += dt / 0.45;
}
const ray = new THREE.Raycaster();
const camRight = new V3(), camUp = new V3(), camFwd = new V3(), muzzleW = new V3();
function currentSpread() {
  const s = weaponRuntime();
  const hs = Math.hypot(player.vel.x, player.vel.z);
  let sp = lerp(s.spread, s.adsSpread, smooth(G.ads)) + G.bloom + hs * 0.0035 * (1 - G.ads * 0.8) + (player.onGround ? 0 : 0.05);
  if (player.crouch > 0.5) sp *= 0.7;
  return sp;
}
function fire(s, am) {
  const mods = buffMods();
  if (!mods.infinite) am.mag--;
  G.cooldown = 60 / s.rpm; run.shots++;
  camera.updateMatrixWorld();
  camRight.setFromMatrixColumn(camera.matrixWorld, 0); camUp.setFromMatrixColumn(camera.matrixWorld, 1); camera.getWorldDirection(camFwd);
  const spread = currentSpread();
  const gun = GUNS[s.id];
  vmMuzzleWorld(gun, muzzleW);
  const dirFor = () => { const r = spread * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2; return new V3().copy(camFwd).addScaledVector(camRight, Math.cos(a) * r).addScaledVector(camUp, Math.sin(a) * r).normalize(); };
  if (s.projectile) {
    const d = dirFor();
    ray.set(camera.position, d); ray.far = 200;
    const aimHit = ray.intersectObjects(hitTargets(), false)[0];
    const aimPt = aimHit ? aimHit.point : tv.copy(camera.position).addScaledVector(d, 200);
    spawnPlasma(muzzleW, tv2.subVectors(aimPt, muzzleW).normalize().clone(), s);
  } else {
    const targets = hitTargets();
    const hitsBy = new Map();
    for (let p = 0; p < s.pellets; p++) {
      const dir = dirFor();
      ray.set(camera.position, dir); ray.far = s.range;
      const hits = ray.intersectObjects(targets, false);
      let h = null;
      for (const x of hits) { const en = x.object.userData.enemy; if (x.object.userData.part === 'shield' && en && en.shieldUp && !en.shieldUp()) continue; h = x; break; }
      const end = h ? h.point : tv2.copy(camera.position).addScaledVector(dir, s.range);
      if (p < 4 || Math.random() < 0.3) tracer(muzzleW, end, s.silenced ? 0xb0a080 : 0xffd9a0, s.silenced ? 0.6 : 1);
      if (!h) continue;
      const n = h.face ? tv3.copy(h.face.normal).transformDirection(h.object.matrixWorld) : tv3.set(0, 1, 0);
      const en = h.object.userData.enemy;
      if (en) {
        let dmg = s.dmg; if (s.falloff) dmg *= clamp(1 - (h.distance - s.falloff[0]) / s.falloff[1], 0.3, 1);
        const part = h.object.userData.part;
        const key = en.id + ':' + part;
        const rec = hitsBy.get(key) || { en, part, dmg: 0, point: h.point.clone(), normal: n.clone(), dir: dir.clone() }; rec.dmg += dmg; hitsBy.set(key, rec);
        if (part !== 'shield') { sparks(h.point, part === 'head' ? 12 : 6, n, 7, COL.elec, COL.elecEnd); sparks(h.point, 3, n, 5); if (Math.random() < 0.4) SMOKE.spawn(h.point, tv2.copy(n).multiplyScalar(1.5), 0.6, 0.1, 0.5, COL.oil, COL.smoke, { grav: 5, alpha: 0.8 }); }
      } else if (h.object.userData.barrel) { damageBarrel(h.object.userData.barrel, s.dmg); sparks(h.point, 8, n, 6); decal(h.point, n, 0.12); SFX.clank(h.point); }
      else { sparks(h.point, 5, n, 7); puff(h.point, 2, n, COL.dust, 0.25, 0.7); decal(h.point, n, rand(0.12, 0.18)); }
    }
    let any = false, killed = false, head = false;
    for (const rec of hitsBy.values()) {
      const r = damageEnemy(rec.en, rec.dmg, { part: rec.part, point: rec.point, normal: rec.normal, dir: rec.dir, source: 'bullet', weapon: s.id, headMult: s.head });
      if (r.dealt > 0) any = true; if (r.killed) killed = true; if (r.head) head = true;
      if (!r.killed && r.dealt > 0) SFX.clank(rec.point);
    }
    if (any) { run.hits++; ui.hitmarker(killed, head); SFX.hit(head); }
    if (killed) SFX.kill();
  }
  // feel
  SFX.gun(s.sound, s.silenced);
  gun.flash.visible = true; gun.flash.material.rotation = Math.random() * 6.28; const fs = s.flash * (s.silenced ? 0.35 : 1); gun.flash.scale.set(fs, fs, 1);
  G.flashT = 0.05; muzzleLight.position.copy(muzzleW); muzzleLight.color.setHex(s.flashColor || 0xffb060); muzzleLight.intensity = s.silenced ? 1.2 : 5; vmFlashLight.intensity = s.silenced ? 1 : 4;
  const recoilMul = (player.crouch > 0.5 ? 0.7 : 1) * lerp(1, 0.6 * s.adsRecoil, G.ads);
  player.pitch += s.recoil * recoilMul * rand(0.8, 1.2); player.yaw += s.recoil * recoilMul * rand(-0.35, 0.35);
  G.recoilPitch += s.recoil * recoilMul;
  G.bloom += s.recoil * 0.9;
  VMS.kick += s.kick; VMS.kickRot += s.kick * 2.2; VMS.slide = 1;
  shake = Math.min(1, shake + s.kick * 0.5);
  if (s.pump) { G.pumpT = -0.4; SFX.click(1300, 0.3, 0.3); SFX.click(1900, 0.3, 0.45); }
  if (s.bolt) { G.pumpT = -0.2; SFX.click(1500, 0.25, 0.35); SFX.click(2300, 0.25, 0.75); }
  if (!s.pump && !s.projectile) { ejectShell(s.id); SFX.tink(rand(0.35, 0.55)); }
  if (!s.silenced) for (let i = 0; i < 2; i++) SMOKE.spawn(muzzleW, tv.copy(camFwd).multiplyScalar(rand(0.5, 1.5)).add(tv2.set(0, 0.4, 0)), rand(0.5, 1), 0.05, 0.35, COL.dust, COL.dustEnd, { drag: 2, alpha: 0.25 });
}
function vmMuzzleWorld(gun, out) {
  vmRoot.updateMatrixWorld(true); gun.muzzle.getWorldPosition(out);
  const d = out.length(); vmCamera.updateMatrixWorld(); out.project(vmCamera); out.z = 0.5; out.unproject(camera).sub(camera.position).normalize().multiplyScalar(d * 1.1).add(camera.position);
  return out;
}
const shells = [];
for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.024, 8), VMS_MAT.brass); m.visible = false; vmScene.add(m); shells.push({ m, v: new V3(), t: 0 }); }
let shellI = 0;
function ejectShell(id) {
  const s = shells[shellI++ % shells.length], g = GUNS[id].g; g.updateMatrixWorld(true);
  s.m.position.set(0.03, 0.03, id === 'pistol' ? -0.02 : -0.06); g.localToWorld(s.m.position);
  s.v.set(rand(0.8, 1.4), rand(0.9, 1.4), rand(-0.1, 0.3)); s.t = 0.8; s.m.visible = true; s.m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
}
// laser sight beam in the world
const laserBeam = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 1), new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(laserBeam);
const laserDot = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); laserDot.scale.set(0.18, 0.18, 1); scene.add(laserDot);
const laserRay = new THREE.Raycaster();
function updateLaser(s) {
  const on = s.laser && player.alive && G.ads < 0.6 && G.switchT <= 0 && VMS.sprint < 0.5;
  laserBeam.visible = laserDot.visible = !!on; if (!on) return;
  const gun = GUNS[s.id];
  const start = vmMuzzleWorld(gun, tv4);
  camera.getWorldDirection(tv);
  laserRay.set(camera.position, tv); laserRay.far = 120;
  const h = laserRay.intersectObjects(hitTargets(), false)[0];
  const end = h ? tv2.copy(h.point) : tv2.copy(camera.position).addScaledVector(tv, 120);
  laserBeam.position.lerpVectors(start, end, 0.5); laserBeam.lookAt(end); laserBeam.scale.set(1, 1, start.distanceTo(end));
  laserDot.position.copy(end); laserDot.visible = !!h;
}

// ---------------- viewmodel ----------------
function updateViewmodel(dt) {
  const s = weaponRuntime(), gun = GUNS[s.id], am = ammo[G.cur];
  VMS.kick = damp(VMS.kick, 0, 16, dt); VMS.kickRot = damp(VMS.kickRot, 0, 12, dt); VMS.slide = damp(VMS.slide, 0, 22, dt);
  VMS.nade = Math.max(0, VMS.nade - dt * 1.4);
  const a = smooth(G.ads);
  const p = tv.lerpVectors(gun.hip, gun.adsPos, a);
  const bobA = player.onGround && player.slideT <= 0 ? Math.min(1, Math.hypot(player.vel.x, player.vel.z) / 6) * (1 - a * 0.9) : 0;
  const sprintK = VMS.sprint;
  let rx = 0, ry = 0, rz = 0;
  p.x += Math.cos(VMS.bob) * 0.012 * bobA * (1 + sprintK) - VMS.swayX * (1 - a * 0.7);
  p.y += Math.abs(Math.sin(VMS.bob)) * 0.012 * bobA * (1 + sprintK) + VMS.swayY * (1 - a * 0.7) - VMS.land * 0.05;
  p.z += VMS.kick * (a > 0.5 ? 0.6 : 1);
  rx += VMS.kickRot * (a > 0.5 ? 0.35 : 1); ry += VMS.swayX * 2; rx += VMS.swayY * 2;
  p.x += sprintK * 0.04; p.y -= sprintK * 0.04; ry += sprintK * 0.7; rx -= sprintK * 0.25; rz += sprintK * 0.2;
  rz -= VMS.slideTilt * 0.25; p.y -= VMS.slideTilt * 0.03;
  if (G.switchT > 0) { const k = G.switchT > 0.2 ? (0.4 - G.switchT) / 0.2 : G.switchT / 0.2; p.y -= smooth(k) * 0.25; rx -= smooth(k) * 0.6; }
  const mag = gun.parts.mag;
  if (G.reloading && !s.shellReload) {
    const t = G.reloadT / s.reload; const rl = Math.sin(Math.min(1, t) * Math.PI); rz += rl * 0.45; rx += rl * 0.2; p.y -= rl * 0.04;
    if (mag && gun.magY != null) { const drop = t < 0.3 ? smooth(t / 0.3) : t < 0.55 ? 1 : 1 - smooth(Math.min(1, (t - 0.55) / 0.2)); mag.position.y = gun.magY - Math.max(0, drop) * 0.25; mag.visible = !(t > 0.28 && t < 0.4); }
  } else if (mag && gun.magY != null) { mag.position.y = gun.magY; mag.visible = true; }
  if (G.reloading && s.shellReload) { rz += 0.3; rx += 0.1; p.y -= 0.02; }
  if (VMS.nade > 0) { const k = Math.sin(VMS.nade * Math.PI); p.y -= k * 0.2; rx -= k * 0.5; }
  if (!player.alive) p.y -= Math.min(1, deathT) * 0.4;
  vmRoot.position.copy(p); vmRoot.rotation.set(rx, ry, rz);
  if (gun.parts.slide) gun.parts.slide.position.z = -0.03 + VMS.slide * 0.045 + (am.mag === 0 ? 0.04 : 0);
  if (gun.parts.pump) { const t = G.pumpT; gun.parts.pump.position.z = -0.34 + (t > 0 && t < 1 ? Math.sin(t * Math.PI) * 0.09 : 0); }
  if (gun.parts.bolt) { const t = G.pumpT; const k = t > 0 && t < 1 ? Math.sin(t * Math.PI) : 0; gun.parts.bolt.rotation.z = k * 1.1; gun.parts.bolt.position.z = 0.1 + k * 0.07; }
  if (gun.coils) gun.coils.forEach((c, i) => { c.rotation.z = time * (3 + i); c.scale.setScalar(1 + (G.cooldown > 0 ? 0.12 : 0) + Math.sin(time * 8 + i) * 0.03); });
  G.flashT -= dt; if (G.flashT <= 0) { gun.flash.visible = false; muzzleLight.intensity = damp(muzzleLight.intensity, 0, 30, dt); vmFlashLight.intensity = damp(vmFlashLight.intensity, 0, 30, dt); }
  for (const sh of shells) { if (!sh.m.visible) continue; sh.t -= dt; sh.v.y -= 6 * dt; sh.m.position.addScaledVector(sh.v, dt); sh.m.rotation.x += dt * 20; sh.m.rotation.z += dt * 14; if (sh.t <= 0) sh.m.visible = false; }
  const scoped = s.scope && G.ads > 0.92;
  vmRoot.visible = !scoped;
  ui.h.scope.style.opacity = scoped ? 1 : 0;
  updateLaser(s);
}

// ---------------- waves ----------------
function composeWave(w) {
  const d = DIFFICULTY[run.diff];
  const isBoss = w % 5 === 0;
  let count = Math.round((isBoss ? 3 + w * 0.5 : 5 + w * 2) * d.count);
  count = Math.min(count, 44);
  const avail = Object.entries(ENEMY_TYPES).filter(([, k]) => k.from <= w);
  const caps = { tank: w >= 6 ? 1 + Math.floor((w - 6) / 4) : 0, sniper: 1 + Math.floor(w / 4), shield: 1 + Math.floor(w / 3), exploder: 2 + Math.floor(w / 3) };
  const q = [], counts = {};
  // guarantee a newly introduced type shows up on its first wave
  const fresh = avail.find(([k, t]) => t.from === w && !isBoss);
  if (fresh) { q.push(fresh[0]); counts[fresh[0]] = 1; }
  while (q.length < count) {
    const pool = avail.filter(([k]) => caps[k] == null || (counts[k] || 0) < caps[k]);
    const tot = pool.reduce((s, [, t]) => s + t.weight * (t.from === 1 ? Math.max(0.35, 1 - w * 0.04) : 1), 0);
    let r = Math.random() * tot, pickK = pool[0][0];
    for (const [k, t] of pool) { r -= t.weight * (t.from === 1 ? Math.max(0.35, 1 - w * 0.04) : 1); if (r <= 0) { pickK = k; break; } }
    q.push(pickK); counts[pickK] = (counts[pickK] || 0) + 1;
  }
  return { q: shuffle(q), isBoss };
}
function startWave() {
  run.wave++; run.dmgThisWave = 0;
  const { q, isBoss } = composeWave(run.wave);
  waves.queue = q; waves.active = true; waves.spawnT = 1.2; waves.boss = isBoss; waves.bossPending = isBoss ? 2.5 : 0;
  if (isBoss) { const def = BOSSES[(run.wave / 5 - 1) % 3]; ui.banner(def.name, `${def.title} · boss wave ${run.wave}`, 3, true); Music.play('boss'); run.bossDmgTaken = 0; }
  else { ui.banner(`Wave ${run.wave}`, `${q.length} hostiles inbound`); Music.play('combat'); const nw = Object.values(ENEMY_TYPES).find(k => k.from === run.wave); if (nw) ui.toast(`New threat: ${nw.name}`, enemyTip(nw)); }
  SFX.siren();
}
function enemyTip(k) {
  return { Runner: 'Fast melee rusher. Keep moving and shoot early.', Drone: 'Flies erratically. Small target; the glowing eye is its head.', Marksman: 'Long-range shooter. A red laser means it is about to fire: break line of sight.', Bomber: 'Runs at you and self-destructs. Shoot the glowing core to detonate it early.', Juggernaut: 'Slow and very tough. Fires explosive orbs. Hit the purple back vent.', Bulwark: 'Its energy shield blocks frontal fire. Aim for the head or flank to hit the back cell.' }[k.name] || '';
}
function updateWaves(dt) {
  const d = DIFFICULTY[run.diff];
  if (waves.active) {
    if (waves.bossPending > 0) { waves.bossPending -= dt; if (waves.bossPending <= 0) spawnBoss(run.wave); }
    waves.spawnT -= dt;
    const normal = enemies.filter(e => !e.isBoss).length;
    const cap = Math.min(20, Math.round((6 + run.wave) * d.count)) - (waves.boss ? 3 : 0);
    if (waves.queue.length && waves.spawnT <= 0 && normal < cap) { spawnEnemy(waves.queue.shift()); waves.spawnT = rand(0.5, 1.3) * (waves.boss ? 2 : 1); }
    if (!waves.queue.length && !enemies.length && waves.bossPending <= 0) waveCleared();
  } else if (state === 'playing') {
    waves.inter -= dt;
    if (waves.inter <= 0) startWave();
  }
}
function spawnEnemy(kind) {
  const far = world.spawnPoints.filter(p => p.distanceTo(player.pos) > Math.min(30, world.half * 0.6));
  const pool = far.length ? far : world.spawnPoints;
  const base = pick(pool);
  const p = base.clone(); p.x += rand(-3, 3); p.z += rand(-3, 3);
  if (!pointFree(p.x, p.z, 0.8)) p.copy(base);
  p.y = groundAt(p.x, p.z);
  enemies.push(new Enemy(kind, p));
}
function waveCleared() {
  waves.active = false;
  const w = run.wave;
  const bonus = addCoins(25 * w, null);
  addXp(60 + 20 * w);
  let flawless = run.dmgThisWave <= 0;
  if (flawless) { const fb = addCoins(50 + 10 * w, null); profile.stats.flawless++; questEvent('flawless'); ui.toast('Flawless wave', `+${fb} coins for taking no damage`, 'drop'); }
  profile.stats.bestWave = Math.max(profile.stats.bestWave, w);
  questEvent('wave', w);
  run.score += 250 * w;
  player.armor = Math.min(100, player.armor + 15);
  SFX.clear(); Music.play('calm');
  waves.inter = 20;
  const choices = rollBuffs(3);
  if (choices.length) {
    state = 'buff'; releaseMouse();
    ui.openBuffs(choices, `Wave ${w} cleared`, `+${bonus} coins. Pick one upgrade; it lasts for the rest of this run.`);
  } else ui.banner('Wave cleared', `+${bonus} coins`, 2.5);
}
function chooseBuff(k) {
  if (state !== 'buff') return;
  run.buffs[k] = (run.buffs[k] || 0) + 1;
  if (k === 'health') player.hp = Math.min(maxHp(), player.hp + 20);
  if (k === 'blast') player.frags = Math.min(5, player.frags + 1);
  if (k === 'plating') player.armor = Math.min(100, player.armor + 30);
  if (k === 'mag') ammo.forEach((a, i) => { a.mag = Math.min(magCap(loadout[i]), a.mag); });
  SFX.powerup(); ui.toast(BUFFS[k].name, BUFFS[k].desc);
  resumeFromMenu();
  ui.banner('Intermission', 'B · open the shop   Enter · start the next wave', 3);
}
function nextWaveNow() { if (!waves.active && run.active) waves.inter = 0.01; }
function openShop() { if (waves.active || state !== 'playing') return; state = 'shop'; releaseMouse(); ui.openArmory('intermission'); }

// ---------------- states ----------------
const canvas = renderer.domElement;
function requestLock() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
function releaseMouse() { mouseL = mouseR = false; for (const k in keys) keys[k] = false; if (locked && document.exitPointerLock) { expectUnlock = true; document.exitPointerLock(); } }
function resetWorld() {
  enemies.slice().forEach(e => { if (e.isBoss) e.remove(); else { scene.remove(e.m.g); if (e.beam) scene.remove(e.beam); } }); enemies.length = 0; boss = null;
  clearProjectiles(); clearTurrets(); clearCoins();
  grenades.forEach(n => scene.remove(n.m)); grenades.length = 0;
  pickups.forEach(k => scene.remove(k.g)); pickups.length = 0;
  debris.forEach(d => scene.remove(d.m)); debris.length = 0;
  clearDecals(); resetBarrels(); hideDamageNumbers();
  for (const k in powerups) powerups[k] = 0;
}
function startRun() {
  SFX.init();
  if (!mapUnlocked(MAP_BY_ID[profile.map])) profile.map = 'yard';
  if (!world.map || world.map.id !== profile.map) loadMap(profile.map);
  resetWorld(); resetRun();
  mapsAtStart.length = 0; MAPS.forEach(m => { if (mapUnlocked(m)) mapsAtStart.push(m.id); });
  Object.assign(player, { hp: 100, armor: 50, alive: true, frags: 3, stuns: 2, yaw: 0, pitch: 0, crouch: 0, lastHurt: -99, stunT: 0, slideT: 0, slideCd: 0 });
  player.pos.copy(world.playerSpawn); player.vel.set(0, 0, 0);
  if (!pointFree(player.pos.x, player.pos.z, 0.5, player.pos.y + 0.1, player.pos.y + 1.7)) player.pos.y = topAt(player.pos.x, player.pos.z, 0.4);
  player.yaw = Math.atan2(player.pos.x, player.pos.z) || 0;
  Object.assign(G, { cooldown: 0, reloading: false, switchT: 0, switchTo: -1, ads: 0, bloom: 0, recoilPitch: 0, pumpT: 1, nadeT: 0, burstLeft: 0 });
  setupLoadout(true);
  waves.active = false; waves.queue = []; waves.inter = 3.5; waves.bossPending = 0;
  profile.stats.runs++; saveProfile();
  ui.h.feed.innerHTML = ''; ui.h.mapLbl.textContent = world.map.name;
  ui.hideAll(); ui.h.root.hidden = false; state = 'playing'; look.dx = look.dy = 0; lookGrace = performance.now() + 150;
  camera.fov = settings.fov; camera.updateProjectionMatrix();
  ui.banner(world.map.name, `${DIFFICULTY[run.diff].label} · first wave in 3 seconds`, 2.6);
  Music.play('calm');
  requestLock();
}
function pauseGame() {
  if (state !== 'playing') return; state = 'paused'; mouseL = mouseR = false;
  $('#pauseSub').textContent = `${world.map.name} · wave ${run.wave} · ${run.kills} kills · ${fmt(run.coins)} coins earned`;
  ui.show('pause'); if (locked && document.exitPointerLock) { expectUnlock = true; document.exitPointerLock(); }
}
function resumeFromMenu() { ui.hideAll(); state = 'playing'; look.dx = look.dy = 0; lookGrace = performance.now() + 150; requestLock(); }
function toMenu() { state = 'menu'; ui.h.root.hidden = true; resetWorld(); run.active = false; ui.show('menu'); ui.renderProfile(); Music.play('menu'); flushProfile(); }
function gameOver(quit) {
  const d = DIFFICULTY[run.diff];
  const summary = { quit, wave: run.wave, score: run.score, kills: run.kills, heads: run.heads, acc: run.shots ? Math.round(run.hits / run.shots * 100) : 0, coins: run.coins, xp: run.xp, time: run.time, levels: run.levelsGained, quests: run.questsDone.slice(), drops: run.drops.slice(), map: world.map.name, diff: d.label, mapsBefore: mapsAtStart.slice() };
  summary.newBest = run.wave > 0 && run.wave >= profile.stats.bestWave && !quit;
  profile.stats.bestWave = Math.max(profile.stats.bestWave, quit ? run.wave - (waves.active ? 1 : 0) : run.wave);
  profile.stats.bestScore = Math.max(profile.stats.bestScore, run.score);
  run.active = false; saveProfile(true);
  state = 'over'; ui.h.root.hidden = true; releaseMouse();
  laserBeam.visible = laserDot.visible = false;
  Music.play('menu');
  ui.showOver(summary);
}

// ---------------- input ----------------
document.addEventListener('pointerlockchange', () => {
  const was = locked; locked = document.pointerLockElement === canvas;
  if (locked && state !== 'playing') { expectUnlock = true; document.exitPointerLock(); return; }
  if (locked) { lookGrace = performance.now() + 60; look.dx = look.dy = 0; }
  if (was && !locked) { if (expectUnlock) expectUnlock = false; else if (state === 'playing' && player.alive) pauseGame(); }
});
document.addEventListener('mousemove', e => {
  if (state !== 'playing' || !player.alive || performance.now() < lookGrace) return;
  if (!locked && !(e.buttons && e.target === canvas)) return;
  const mx = e.movementX || 0, my = e.movementY || 0;
  if (Math.abs(mx) > 250 || Math.abs(my) > 250) return;
  look.dx += mx; look.dy += my;
});
canvas.addEventListener('mousedown', e => {
  if (state !== 'playing') return;
  if (!locked) requestLock();
  if (e.button === 0) { mouseL = true; G.fireQueued = true; } if (e.button === 2) mouseR = true;
});
document.addEventListener('mouseup', e => { if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; });
document.addEventListener('contextmenu', e => { if (state === 'playing') e.preventDefault(); });
document.addEventListener('wheel', e => { if (state !== 'playing' || !player.alive) return; equip(((G.switchTo >= 0 ? G.switchTo : G.cur) + 1) % loadout.length); }, { passive: true });
document.addEventListener('keydown', e => {
  if (state === 'playing' && ['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (state === 'buff') { const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code); if (n >= 0) ui.buffKey(n); return; }
  if (state === 'shop') { if (e.code === 'Enter') { ui.hideAll(); resumeFromMenu(); nextWaveNow(); } if (e.code === 'Escape' || e.code === 'KeyB') resumeFromMenu(); return; }
  keys[e.code] = true;
  if (state !== 'playing' || !player.alive) return;
  if (e.code === 'Escape' || e.code === 'KeyP') { pauseGame(); return; }
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyR': startReload(); break;
    case 'KeyG': throwGrenade('frag'); break;
    case 'KeyF': throwGrenade('stun'); break;
    case 'KeyQ': equip(G.prev); break;
    case 'Digit1': equip(0); break;
    case 'Digit2': equip(1); break;
    case 'KeyC': trySlide(); break;
    case 'KeyZ': callAirstrike(); break;
    case 'KeyX': deployTurret(); break;
    case 'KeyB': openShop(); break;
    case 'Enter': nextWaveNow(); break;
    case 'KeyT': { const id = loadout[G.cur]; if (attOwned(id, 'reddot')) { setAtt(id, 'reddot', !attOn(id, 'reddot')); ui.prompt(attOn(id, 'reddot') ? 'Red dot fitted' : 'Red dot removed', false, 1); SFX.click(2000, 0.2); } else { ui.prompt('No red dot for this gun yet · shop or quests', true, 1.4); SFX.deny(); } break; }
  }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseL = mouseR = false; });
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight); camera.aspect = vmCamera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); vmCamera.updateProjectionMatrix();
  FX.mat.uniforms.uScale.value = SMOKE.mat.uniforms.uScale.value = innerHeight * 0.5;
});

// ---------------- menu wiring ----------------
function bind(id, fn) { $(id).addEventListener('click', () => { SFX.init(); SFX.ui(); fn(); }); }
bind('#btnPlay', () => { ui.openPlay(); });
bind('#btnLoadout', () => ui.openArmory('loadout', 'menu'));
bind('#btnShop', () => ui.openArmory('shop', 'menu'));
bind('#btnQuests', () => ui.openQuests('menu'));
bind('#btnSettings', () => ui.openSettings('menu'));
bind('#btnPlayBack', () => { ui.show('menu'); ui.renderProfile(); });
bind('#btnDeploy', () => startRun());
bind('#btnResume', () => resumeFromMenu());
bind('#btnPQuests', () => ui.openQuests('pause'));
bind('#btnPSettings', () => ui.openSettings('pause'));
bind('#btnQuit', () => gameOver(true));
bind('#btnRetry', () => startRun());
bind('#btnOverShop', () => ui.openArmory('shop', 'over'));
bind('#btnOverMenu', () => toMenu());
$('#mapCards').addEventListener('click', () => { if (world.map && world.map.id !== profile.map && state === 'menu') loadMap(profile.map); });
document.querySelectorAll('.btn').forEach(b => b.addEventListener('mouseenter', () => SFX.ui()));
if (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) $('#touchNote').hidden = false;

// ---------------- main loop ----------------
const clock = new THREE.Clock();
let menuAngle = 0.6;
function tick(dt) {
  time += dt; frameNo++;
  if (state === 'playing') {
    run.time += dt; run.multiT = Math.max(0, run.multiT - dt);
    updatePlayer(dt); updateWeapon(dt);
    for (const e of enemies.slice()) if (!e.dead) e.update(dt);
    updateBolts(dt); updateOrbs(dt); updateArcs(dt); updatePlasma(dt); updateGrenades(dt); updateBarrels(dt); updatePickups(dt); updateTurrets(dt); updateCoins(dt); updateWaves(dt);
    updateCamera(dt); updateViewmodel(dt); ui.update(dt);
  } else if (state === 'dead') {
    deathT += dt; player.pitch = damp(player.pitch, -0.3, 3, dt); player.crouch = Math.min(1, player.crouch + dt * 1.5);
    for (const e of enemies.slice()) if (!e.dead) e.update(dt);
    updateBolts(dt); updateOrbs(dt); updateArcs(dt);
    updateCamera(dt); updateViewmodel(dt); ui.update(dt);
    if (deathT > 2.2) gameOver(false);
  } else if (state === 'menu' || state === 'over') {
    menuAngle += dt * 0.05;
    const r = world.half * 0.64, hgt = world.ceiling < 20 ? world.ceiling - 1.5 : world.half * 0.2;
    camera.position.set(Math.sin(menuAngle) * r, hgt + Math.sin(time * 0.3) * 0.8, Math.cos(menuAngle) * r);
    camera.fov = 60; camera.updateProjectionMatrix(); camera.lookAt(0, 2, 0); camera.updateMatrixWorld();
    sky.position.copy(camera.position); sun.target.position.set(0, 0, 0); sun.position.copy(sunDir).multiplyScalar(120);
    SFX.L.pos.copy(camera.position);
  }
  if (state !== 'paused' && state !== 'buff' && state !== 'shop') { updateWorldAnim(dt, time); updateDebris(dt); updateTracers(dt); updateBlasts(dt); FX.update(dt); SMOKE.update(dt); }
  updateDamageNumbers(dt);
}
function render() {
  renderer.clear();
  renderer.render(scene, camera);
  if (state === 'playing' || state === 'paused' || state === 'dead' || state === 'buff' || state === 'shop') { renderer.clearDepth(); renderer.render(vmScene, vmCamera); }
}
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  try { tick(dt); } catch (err) { console.error(err); }
  render();
}

// debug / test hooks
window.FB = { get state() { return state; }, run, player, enemies, waves, profile: () => profile, world, startRun, startWave, spawnEnemy, spawnBoss, chooseBuff, gameOver, toMenu, openShop, loadMap, tick, render, get boss() { return boss; }, damageEnemy, explosion, throwGrenade, callAirstrike, deployTurret, weaponRuntime, equip, setupLoadout, waveCleared, fire: () => fire(weaponRuntime(), ammo[G.cur]), G, ammo: () => ammo, loadout: () => loadout, questEvent, addCoins, addXp };

loadMap(profile.map);
ui.renderProfile();
ui.show('menu');
Music.play('menu');
frame();
