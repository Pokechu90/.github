'use strict';
// Player controller, weapon handling, wave director, game states, input and the main loop.

let state = 'menu', time = 0, shake = 0, deathT = 0, heartT = 0, locked = false, expectUnlock = false, lookGrace = 0, hitStop = 0;
const player = { pos: new V3(0, 0, 20), vel: new V3(), radius: 0.4, height: 1.8, onGround: true, landV: 0, yaw: 0, pitch: 0, hp: 100, armor: 50, lastHurt: -99, crouch: 0, stepDist: 0, frags: 3, stuns: 2, alive: true, stunT: 0, slideT: 0, slideCd: 0, jumpHeld: false, streakWarned: false };
const G = { cur: 0, prev: 1, cooldown: 0, reloading: false, reloadT: 0, reloadDur: 1, sprayN: 0, lastShotT: -9, adsToggled: false, switchT: 0, switchTo: -1, ads: 0, bloom: 0, fireQueued: false, pumpT: 1, nadeT: 0, flashT: 0, burstLeft: 0, burstT: 0, dryClicked: false };
const VMS = { swayX: 0, swayY: 0, bob: 0, sprint: 0, land: 0, nade: 0, slide: 0, slideTilt: 0, inspect: 0, mantle: 0, heat: 0 };
// Gun feel runs on damped springs: a shot is an impulse, so recoil snaps up quickly and settles with a
// little overshoot instead of jumping in fixed steps.
// RC moves where bullets go: most of it springs back, and part is baked into the aim so sprays still climb.
// PUNCH only shakes the camera. VR kicks the viewmodel. SW is the weight of the gun lagging behind your turns.
const RC = { p: 0, pv: 0, y: 0, yv: 0, bakeP: 0, bakeY: 0 };
const PUNCH = { p: 0, pv: 0, r: 0, rv: 0 };
const VR = { z: 0, zv: 0, y: 0, yv: 0, rx: 0, rxv: 0, ry: 0, ryv: 0, rz: 0, rzv: 0 };
const SW = { x: 0, xv: 0, y: 0, yv: 0, r: 0, rv: 0, tilt: 0, lift: 0 };
function springStep(o, key, vkey, target, k, c, dt) {
  const n = dt > 0.012 ? Math.ceil(dt / 0.012) : 1, h = dt / n;
  for (let i = 0; i < n; i++) { o[vkey] += (-k * (o[key] - target) - c * o[vkey]) * h; o[key] += o[vkey] * h; }
}
function resetGunFeel() { for (const o of [RC, PUNCH, VR, SW]) for (const k in o) o[k] = 0; VMS.heat = 0; }
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
  const oc = run.active ? (run.oc[s.id] || 0) : 0;
  if (oc) { s.dmg *= 1 + 0.45 * oc; s.mag = Math.round(s.mag * (1 + 0.25 * oc)); s.reload *= 1 - 0.08 * oc; }
  s.oc = oc;
  rtCache = s; rtFrame = frameNo; return s;
}
function ocTier(id) { return run.active ? (run.oc[id] || 0) : 0; }
function magCap(id) { const s = weaponStats(id); return Math.max(1, Math.round(s.mag * buffMods().mag * (1 + 0.25 * ocTier(id)))); }
function reserveCap(id) { return Math.round(WEAPON_BY_ID[id].reserve * 1.5 * (1 + 0.3 * ocTier(id))); }
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
  if (run.combo > 1 && amount >= 5) { run.combo = Math.floor(run.combo / 2); run.comboT = Math.min(run.comboT, COMBO_WINDOW * 0.6); }
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
  const zoomSens = lerp(1, s.zoom * settings.adsSens, G.ads);
  player.yaw -= look.dx * 0.0022 * settings.sens * zoomSens;
  player.pitch -= look.dy * 0.0022 * settings.sens * zoomSens * (settings.invert ? -1 : 1);
  // the gun trails behind mouse movement (less when aiming down sights)
  const swayK = 1 - G.ads * 0.75;
  SW.xv -= clamp(look.dx, -80, 80) * 0.0035 * swayK; SW.yv += clamp(look.dy, -80, 80) * 0.0035 * swayK * (settings.invert ? -1 : 1); SW.rv -= clamp(look.dx, -80, 80) * 0.012 * swayK;
  look.dx = look.dy = 0;
  springStep(SW, 'x', 'xv', 0, 120, 11, dt); springStep(SW, 'y', 'yv', 0, 120, 11, dt); springStep(SW, 'r', 'rv', 0, 90, 9, dt);
  SW.x = clamp(SW.x, -0.06, 0.06); SW.y = clamp(SW.y, -0.06, 0.06); SW.r = clamp(SW.r, -0.25, 0.25);
  VMS.swayX = SW.x; VMS.swayY = SW.y;
  // recoil: bake the permanent share into the aim over a few frames, spring the rest back
  const bp = RC.bakeP * Math.min(1, dt * 22), by = RC.bakeY * Math.min(1, dt * 22);
  RC.bakeP -= bp; RC.bakeY -= by; player.pitch += bp; player.yaw += by;
  const rk = weaponRuntime().recover || 190;
  springStep(RC, 'p', 'pv', 0, rk, 2 * 0.85 * Math.sqrt(rk), dt); springStep(RC, 'y', 'yv', 0, rk, 2 * 0.85 * Math.sqrt(rk), dt);
  springStep(PUNCH, 'p', 'pv', 0, 420, 17, dt); springStep(PUNCH, 'r', 'rv', 0, 380, 15, dt);
  player.pitch = clamp(player.pitch, -1.5, 1.5);
  player.stunT = Math.max(0, player.stunT - dt); player.slideCd = Math.max(0, player.slideCd - dt);
  if (player.mantle) { updateMantle(dt); return; }
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
  if (keys.Space && !player.jumpHeld && tryMantle()) { player.jumpHeld = true; return; }
  if (!player.onGround && f > 0 && player.vel.y < 2 && tryMantle(1.25)) return;
  if (keys.Space && player.onGround && !player.jumpHeld) { player.vel.y = 8; player.onGround = false; player.jumpHeld = true; if (player.slideT > 0) { player.slideT = 0; player.slideCd = 0.6; } SFX.land(0.4); }
  if (!keys.Space) player.jumpHeld = false;
  moveBody(player, dt);
  if (player.landV > 6) { SFX.land(Math.min(1.5, player.landV / 10)); VMS.land = Math.min(1, player.landV / 14); shake += player.landV * 0.01; SW.yv -= player.landV * 0.04; VR.rxv -= player.landV * 0.08; }
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
// mantle onto ledges up to chest height
function tryMantle(maxRise = 1.75) {
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  for (const reach of [0.75, 1.1]) {
    const px = player.pos.x + fx * reach, pz = player.pos.z + fz * reach;
    const top = topAt(px, pz, 0.25), rise = top - player.pos.y;
    if (rise < 0.6 || rise > maxRise) continue;
    if (!pointFree(px, pz, 0.32, top + 0.05, top + 1.75)) continue;
    if (top > world.ceiling - 1.8) continue;
    player.mantle = { t: 0, dur: 0.18 + rise * 0.14, from: player.pos.clone(), to: new V3(px, top, pz) };
    player.vel.set(0, 0, 0); player.slideT = 0; VMS.mantle = 1; SFX.land(0.5); SFX.slide();
    return true;
  }
  return false;
}
function updateMantle(dt) {
  const m = player.mantle; m.t += dt; const k = Math.min(1, m.t / m.dur);
  const up = smooth(Math.min(1, k * 1.6)), fwd = smooth(Math.max(0, (k - 0.35) / 0.65));
  player.pos.set(lerp(m.from.x, m.to.x, fwd), lerp(m.from.y, m.to.y, up), lerp(m.from.z, m.to.z, fwd));
  if (k >= 1) { player.mantle = null; player.onGround = true; player.vel.set(0, 0, 0); }
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
  const motion = reduceMotion ? 0.4 : 1;
  camera.rotation.set(player.pitch + RC.p + PUNCH.p * motion + (Math.random() - .5) * sk * 0.04, player.yaw + RC.y + (Math.random() - .5) * sk * 0.04, Math.sin(VMS.bob) * 0.006 * bobA - VMS.slideTilt * 0.06 + PUNCH.r * motion - SW.tilt * 0.15);
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
  G.reloading = true; G.reloadT = 0; G.burstLeft = 0; VMS.inspect = 0;
  G.reloadDur = s.shellReload ? s.reload : s.reload * (am.mag > 0 ? 0.8 : 1); // tactical reloads are faster than empty ones
  if (s.shellReload) SFX.click(2200, 0.15);
  else { SFX.click(1600, 0.2, 0.1); SFX.thunk(G.reloadDur * 0.55, 0.3); SFX.click(2800, 0.25, G.reloadDur * 0.85); SFX.click(2000, 0.2, G.reloadDur * 0.9); }
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
  const wantAds = (settings.toggleAds ? G.adsToggled : mouseR || pad.lt) && G.switchT <= 0 && VMS.sprint < 0.5 && player.slideT <= 0 && !(G.reloading && !s.shellReload);
  G.ads = clamp(G.ads + (wantAds ? 1 : -1) * dt * s.adsSpeed, 0, 1);
  if (G.reloading) {
    G.reloadT += dt;
    if (s.shellReload) {
      if (G.reloadT >= s.reload) { G.reloadT = 0; am.mag++; am.reserve--; SFX.thunk(0, 0.25); SFX.click(3000, 0.12, 0.05); VR.zv += 0.6; VR.rxv -= 0.8; if (am.mag >= s.mag || am.reserve <= 0) { G.reloading = false; G.pumpT = 0; SFX.click(1200, 0.3, 0.1); SFX.click(1800, 0.3, 0.25); } }
    } else if (G.reloadT >= G.reloadDur) { const n = Math.min(s.mag - am.mag, am.reserve); am.mag += n; am.reserve -= n; G.reloading = false; }
  }
  // burst in progress
  if (G.burstLeft > 0) {
    G.burstT -= dt;
    if (G.burstT <= 0) {
      if (am.mag > 0 || mods.infinite) { fire(s, am); G.burstLeft--; G.burstT = 60 / s.rpm; if (G.burstLeft === 0) G.cooldown = s.burstDelay; }
      else { G.burstLeft = 0; G.cooldown = 0.25; }
    }
  }
  const want = s.fire === 'auto' ? (mouseL || pad.rt) : G.fireQueued;
  if (want && player.alive && G.switchT <= 0 && G.nadeT < 0.5 && G.cooldown <= 0 && G.burstLeft <= 0) {
    if (G.reloading && s.shellReload && am.mag > 0) G.reloading = false;
    if (!G.reloading) {
      if (am.mag <= 0 && !mods.infinite) { if (G.fireQueued || !G.dryClicked) { SFX.dry(); G.dryClicked = true; } G.cooldown = 0.25; startReload(); }
      else if (s.fire === 'burst') { G.burstLeft = s.burstCount; G.burstT = 0; }
      else fire(s, am);
    }
  }
  if (!mouseL && !pad.rt) G.dryClicked = false;
  G.fireQueued = false;
  if (am.mag <= 0 && !G.reloading && am.reserve > 0 && G.cooldown <= 0 && !mouseL && !mods.infinite) startReload();
  if (G.pumpT < 1) G.pumpT += dt / 0.45;
}
const ray = new THREE.Raycaster();
const camRight = new V3(), camUp = new V3(), camFwd = new V3(), muzzleW = new V3(), aimQ = new THREE.Quaternion(), aimE = new THREE.Euler();
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
  // aim along the recoil-adjusted look direction; camera punch and shake are visual only
  aimQ.setFromEuler(aimE.set(player.pitch + RC.p, player.yaw + RC.y, 0, 'YXZ'));
  camRight.set(1, 0, 0).applyQuaternion(aimQ); camUp.set(0, 1, 0).applyQuaternion(aimQ); camFwd.set(0, 0, -1).applyQuaternion(aimQ);
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
        if (part !== 'shield') enemyHitFx(en, h.point, n, part);
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
  if (time - G.lastShotT > 0.35) G.sprayN = 0;
  G.sprayN++; G.lastShotT = time; VMS.inspect = 0;
  // learnable spray: a per-weapon horizontal pattern plus a little noise; vertical kick climbs over the first shots.
  // 30% of the climb stays (pull down to control it); the rest springs back once you stop.
  const kickP = s.recoil * recoilMul * (1 + Math.min(G.sprayN, 10) * 0.035) * rand(0.95, 1.05);
  const kickY = s.recoil * recoilMul * (recoilPattern(s.id, G.sprayN) * 0.55 + rand(-0.08, 0.08));
  RC.bakeP += kickP * 0.3; RC.bakeY += kickY * 0.6;
  RC.pv += kickP * 0.7 * 40; RC.yv += kickY * 0.4 * 40;
  G.bloom += s.recoil * 0.9;
  // camera punch and viewmodel kick: back, up, and a random twist that settles with overshoot
  const adsK = lerp(1, 0.55, G.ads), heavy = s.kick >= 0.09;
  PUNCH.pv += s.kick * 6 * adsK; PUNCH.rv += rand(-1, 1) * s.kick * (heavy ? 5 : 3);
  VR.zv += s.kick * 26 * lerp(1, 0.7, G.ads); VR.yv += s.kick * 3;
  VR.rxv += s.kick * 30 * lerp(1, 0.45, G.ads); VR.ryv += rand(-1, 1) * s.kick * 9; VR.rzv += rand(-1, 1) * s.kick * 16;
  VMS.slide = 1;
  if (heavy) shake = Math.min(1, shake + s.kick * 0.25);
  VMS.heat = Math.min(1, VMS.heat + s.recoil * 2.2 + (s.pellets > 1 ? 0.2 : 0));
  if (s.pump) { G.pumpT = -0.4; SFX.click(1300, 0.3, 0.3); SFX.click(1900, 0.3, 0.45); }
  if (s.bolt) { G.pumpT = -0.2; SFX.click(1500, 0.25, 0.35); SFX.click(2300, 0.25, 0.75); }
  if (!s.pump && !s.projectile) { ejectShell(s.id); SFX.tink(rand(0.35, 0.55)); }
  if (!s.silenced) for (let i = 0; i < 2; i++) SMOKE.spawn(muzzleW, tv.copy(camFwd).multiplyScalar(rand(0.5, 1.5)).add(tv2.set(0, 0.4, 0)), rand(0.5, 1), 0.05, 0.35, COL.dust, COL.dustEnd, { drag: 2, alpha: 0.25 });
}
const PATTERN_SEED = { pistol: 0.3, smg: 1.7, rifle: 0.9, burst: 2.4, shotgun: 0, lmg: 3.1, sniper: 0, plasma: 4.2 };
function recoilPattern(id, n) { const sd = PATTERN_SEED[id] || 0; return Math.sin(n * 0.62 + sd) * (n < 4 ? 0.35 : 0.9) + (n > 8 ? Math.sin(sd * 3) * 0.4 : 0); }
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
  springStep(VR, 'z', 'zv', 0, 320, 22, dt); springStep(VR, 'y', 'yv', 0, 260, 18, dt);
  springStep(VR, 'rx', 'rxv', 0, 260, 15, dt); springStep(VR, 'ry', 'ryv', 0, 200, 13, dt); springStep(VR, 'rz', 'rzv', 0, 200, 13, dt);
  VMS.slide = damp(VMS.slide, 0, 22, dt);
  // lean into strafes and let the gun float on jumps
  const lat = player.vel.x * Math.cos(player.yaw) - player.vel.z * Math.sin(player.yaw);
  SW.tilt = damp(SW.tilt, clamp(lat * 0.02, -0.14, 0.14) * (1 - G.ads * 0.7), 8, dt);
  SW.lift = damp(SW.lift, player.onGround ? 0 : clamp(-player.vel.y * 0.004, -0.03, 0.03), 6, dt);
  // heat haze: a wisp of smoke from the barrel after a long burst
  VMS.heat = Math.max(0, VMS.heat - dt * 0.35);
  if (VMS.heat > 0.45 && time - G.lastShotT > 0.2 && Math.random() < VMS.heat * 0.5) { vmMuzzleWorld(gun, tv4); SMOKE.spawn(tv4, tv3.set(rand(-.1, .1), rand(0.4, 0.8), rand(-.1, .1)), rand(0.6, 1.1), 0.02, 0.18, COL.dust, COL.dustEnd, { drag: 1.5, alpha: 0.18, grav: -0.4 }); }
  VMS.nade = Math.max(0, VMS.nade - dt * 1.4);
  const a = smooth(G.ads);
  const p = tv.lerpVectors(gun.hip, gun.adsPos, a);
  const bobA = player.onGround && player.slideT <= 0 ? Math.min(1, Math.hypot(player.vel.x, player.vel.z) / 6) * (1 - a * 0.9) : 0;
  const sprintK = VMS.sprint;
  let rx = 0, ry = 0, rz = 0;
  p.x += Math.cos(VMS.bob) * 0.012 * bobA * (1 + sprintK) - VMS.swayX * (1 - a * 0.7);
  p.y += Math.abs(Math.sin(VMS.bob)) * 0.012 * bobA * (1 + sprintK) + VMS.swayY * (1 - a * 0.7) - VMS.land * 0.05;
  p.z += VR.z; p.y += VR.y + SW.lift;
  rx += VR.rx; ry += VR.ry + VMS.swayX * 2; rz += VR.rz + SW.r * (1 - a * 0.6) - SW.tilt; rx += VMS.swayY * 2;
  p.x -= SW.tilt * 0.05;
  p.x += sprintK * 0.04; p.y -= sprintK * 0.04; ry += sprintK * 0.7; rx -= sprintK * 0.25; rz += sprintK * 0.2;
  rz -= VMS.slideTilt * 0.25; p.y -= VMS.slideTilt * 0.03;
  if (G.switchT > 0) { const k = G.switchT > 0.2 ? (0.4 - G.switchT) / 0.2 : G.switchT / 0.2; p.y -= smooth(k) * 0.25; rx -= smooth(k) * 0.6; }
  const mag = gun.parts.mag;
  if (G.reloading && !s.shellReload) {
    const t = G.reloadT / G.reloadDur; const rl = Math.sin(Math.min(1, t) * Math.PI); rz += rl * 0.45; rx += rl * 0.2; p.y -= rl * 0.04;
    if (mag && gun.magY != null) { const drop = t < 0.3 ? smooth(t / 0.3) : t < 0.55 ? 1 : 1 - smooth(Math.min(1, (t - 0.55) / 0.2)); mag.position.y = gun.magY - Math.max(0, drop) * 0.25; mag.visible = !(t > 0.28 && t < 0.4); }
  } else if (mag && gun.magY != null) { mag.position.y = gun.magY; mag.visible = true; }
  if (G.reloading && s.shellReload) { rz += 0.3; rx += 0.1; p.y -= 0.02; }
  if (VMS.nade > 0) { const k = Math.sin(VMS.nade * Math.PI); p.y -= k * 0.2; rx -= k * 0.5; }
  if (VMS.inspect > 0) { VMS.inspect = Math.max(0, VMS.inspect - dt); const u = 1 - VMS.inspect / 2.4, e = Math.sin(Math.min(1, u) * Math.PI); ry += e * 0.9; rz += Math.sin(u * Math.PI * 2) * 0.35 * e; rx += e * 0.25; p.x -= e * 0.06; p.y += e * 0.03; }
  VMS.mantle = Math.max(0, VMS.mantle - dt * 3); if (VMS.mantle > 0) { p.y -= Math.sin(VMS.mantle * Math.PI) * 0.12; rx -= Math.sin(VMS.mantle * Math.PI) * 0.4; }
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
  const mu = (run.mutator && MUTATORS[run.mutator]) || {};
  let count = Math.round((isBoss ? 3 + w * 0.5 : 5 + w * 2) * d.count * (mu.count || 1));
  count = Math.min(count, 44);
  // the current faction's troops, unlocked by how far into its ten-wave era the run is
  const lw = factionLocalWave(w), avail = factionRoster(w).map(k => [k, ENEMY_TYPES[k]]).filter(([, k]) => k.from <= lw);
  const roleCaps = { tank: w >= 6 ? 1 + Math.floor((w - 6) / 4) : 0, sniper: 1 + Math.floor(w / 4), shield: 1 + Math.floor(w / 3), exploder: 2 + Math.floor(w / 3) };
  const caps = {}; for (const [k, t] of avail) if (roleCaps[t.role] != null) caps[k] = roleCaps[t.role];
  const q = [], counts = {};
  // guarantee a newly introduced type shows up on its first wave
  const fresh = avail.find(([k, t]) => (t.from === lw || (w > 10 && t.from >= lw - 2 && t.from > 1)) && !isBoss);
  if (fresh) { q.push(fresh[0]); counts[fresh[0]] = 1; }
  while (q.length < count) {
    let pool = avail.filter(([k]) => caps[k] == null || (counts[k] || 0) < caps[k]);
    if (!pool.length) pool = avail;
    const tot = pool.reduce((s, [, t]) => s + t.weight * (t.from === 1 ? Math.max(0.35, 1 - w * 0.04) : 1), 0);
    let r = Math.random() * tot, pickK = pool[0][0];
    for (const [k, t] of pool) { r -= t.weight * (t.from === 1 ? Math.max(0.35, 1 - w * 0.04) : 1); if (r <= 0) { pickK = k; break; } }
    q.push(pickK); counts[pickK] = (counts[pickK] || 0) + 1;
  }
  return { q: shuffle(q), isBoss };
}
function startWave() {
  run.wave++; run.dmgThisWave = 0;
  run.mutator = rollMutator(run.wave); if (run.mutator) run.lastMutator = run.mutator;
  const { q, isBoss } = composeWave(run.wave);
  applyMutatorFx();
  waves.queue = q; waves.active = true; waves.spawnT = 1.2; waves.boss = isBoss; waves.bossPending = isBoss ? 2.5 : 0;
  const fac = factionForWave(run.wave);
  if (run.wave > 1 && (run.wave - 1) % 10 === 0) { ui.toast(`New enemy faction: ${fac.name}`, fac.desc, 'drop'); }
  if (isBoss) { const def = bossDefForWave(run.wave); ui.banner(def.name, `${def.title} · boss wave ${run.wave}`, 3, true); Music.play('boss'); run.bossDmgTaken = 0; }
  else { const rm = roundMults(), mu = run.mutator && MUTATORS[run.mutator]; ui.banner(`Wave ${run.wave}`, mu ? `${mu.name} · ×${rm.wave.toFixed(1)} wave · ×${mu.reward} risk` : `${q.length} hostiles · ×${rm.wave.toFixed(1)} wave multiplier`); if (mu) ui.toast(`Round modifier: ${mu.name}`, `${mu.desc} Reward ×${mu.reward}${mu.coins ? ', coins ×' + mu.coins : ''}.`, 'drop'); Music.play('combat'); const lw = factionLocalWave(run.wave); const nw = factionRoster(run.wave).map(k => ENEMY_TYPES[k]).find(k => k.from === lw || (run.wave > 10 && k.from >= lw - 2 && k.from > 1)); if (nw && (run.wave - 1) % 10 !== 0) ui.toast(`New threat: ${nw.name}`, enemyTip(nw)); }
  if (run.wave > 1 && (run.wave - 1) % 10 === 0) ui.banner(fac.name, `Wave ${run.wave} · a new enemy faction attacks`, 3.2, true);
  SFX.siren();
}
function applyMutatorFx() {
  const th = world.map.theme;
  if (run.mutator === 'blackout') { scene.fog.near = 6; scene.fog.far = Math.min(th.fog[2], 42); hemi.intensity = th.hemi[2] * 0.45; sun.intensity = th.sun[1] * 0.35; }
  else { scene.fog.near = th.fog[1]; scene.fog.far = th.fog[2]; hemi.intensity = th.hemi[2]; sun.intensity = th.sun[1]; }
}
function enemyTip(k) {
  return ({
    'Goblin Archer': 'Arrows drop over distance; strafe and they miss.', Cutthroat: 'Fast dagger rusher. Shoot it before it closes in.',
    'Fire Bat': 'Erratic flyer that spits fireballs. Its head is the small target.', 'Crossbow Hunter': 'A glowing aim line means a crossbow bolt is coming: break line of sight.',
    'Powder Sapper': 'Carries a lit powder keg. Shoot the fuse to blow it up early.', 'Cave Troll': 'Huge and slow. Throws boulders; the glowing rune on its back is the weak spot.',
    Shieldbearer: 'Its wooden shield stops bullets. Headshot it or hit the pouch on its back.',
    'Bone Archer': 'Skeletal archers. Headshots shatter them.', Ghoul: 'Fast clawing rusher.', Wraith: 'Floating spirit that hurls soul bolts.',
    Deadeye: 'Long-range marksman with a purple aim line.', Bloater: 'Shoot the glowing boils before it bursts next to you.',
    'Bone Colossus': 'Throws soul orbs and bone shards. Weak spot on its back.', 'Death Knight': 'Tower shield in front, soul gem on its back.',
  })[k.name] || { Runner: 'Fast melee rusher. Keep moving and shoot early.', Drone: 'Flies erratically. Small target; the glowing eye is its head.', Marksman: 'Long-range shooter. A red laser means it is about to fire: break line of sight.', Bomber: 'Runs at you and self-destructs. Shoot the glowing core to detonate it early.', Juggernaut: 'Slow and very tough. Fires explosive orbs. Hit the purple back vent.', Bulwark: 'Its energy shield blocks frontal fire. Aim for the head or flank to hit the back cell.' }[k.name] || '';
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
  const w = run.wave, rmw = roundMults();
  const bonus = addCoins(25 * w * rmw.coins, null);
  addXp((60 + 20 * w) * rmw.xp);
  run.mutator = null; applyMutatorFx();
  let flawless = run.dmgThisWave <= 0;
  if (flawless) { const fb = addCoins(50 + 10 * w, null); profile.stats.flawless++; questEvent('flawless'); ui.toast('Flawless wave', `+${fb} coins for taking no damage`, 'drop'); }
  profile.stats.bestWave = Math.max(profile.stats.bestWave, w);
  questEvent('wave', w);
  if (nightMode()) questEvent('nightWave', w);
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
// ---------------- stations: mystery crate and overclock forge ----------------
const CRATE_COST = 950;
function ocCost(tier) { return [1200, 2400, 3600][tier] || 0; }
let rolling = null;
function nearStation() { if (!world.stations) return null; for (const st of world.stations) if (Math.hypot(st.pos.x - player.pos.x, st.pos.z - player.pos.z) < 2.4 && Math.abs(st.pos.y - player.pos.y) < 1.5) return st; return null; }
function stationPrompt() {
  const st = nearStation(); if (!st || rolling) return null;
  if (st.type === 'crate') return `E · Mystery crate · ${CRATE_COST} coins · random weapon for this run`;
  const id = loadout[G.cur], tier = ocTier(id);
  if (tier >= 3) return `${WEAPON_BY_ID[id].name} is fully overclocked`;
  return `E · Overclock ${WEAPON_BY_ID[id].name} to tier ${tier + 1} · ${fmt(ocCost(tier))} coins`;
}
function interact() {
  const st = nearStation(); if (!st || rolling || G.switchT > 0) return;
  if (st.type === 'crate') {
    if (!spendCoins(CRATE_COST)) { SFX.deny(); ui.prompt(`Need ${fmt(CRATE_COST - profile.coins)} more coins`, true, 1.4); return; }
    const pool = WEAPONS.filter(w => !w.event && !loadout.includes(w.id)).flatMap(w => w.id === 'plasma' ? [w.id] : [w.id, w.id]);
    rolling = { st, t: 0, dur: 2.4, result: pick(pool), tick: 0 }; run.boxRolls++; questEvent('box');
    SFX.charge(st.pos, true);
  } else {
    const id = loadout[G.cur], tier = ocTier(id); if (tier >= 3) return;
    const cost = ocCost(tier);
    if (!spendCoins(cost)) { SFX.deny(); ui.prompt(`Need ${fmt(cost - profile.coins)} more coins`, true, 1.4); return; }
    run.oc[id] = tier + 1; applyOcGlow(id);
    ammo[G.cur].mag = magCap(id); ammo[G.cur].reserve = reserveCap(id);
    SFX.powerup(); SFX.boom(st.pos, 0.2); flashLight(tv.copy(st.pos).setY(1.5), 0xff7a2e, 8, 10);
    for (let i = 0; i < 50; i++) FX.spawn(tv.copy(st.pos).setY(1.3), randDir(tv2, rand(2, 6)), rand(0.3, 0.7), 0.15, 0.02, COL.fire, COL.fireEnd, { drag: 2 });
    ui.toast(`Overclocked: ${WEAPON_BY_ID[id].name} · tier ${tier + 1}`, `+${45 * (tier + 1)}% damage, +${25 * (tier + 1)}% magazine, full ammo`, 'drop');
  }
}
const OC_GLOW = [0, 0x2affd5, 0xff3ea5, 0xffd24a];
function applyOcGlow(id) { const g = GUNS[id], t = ocTier(id); if (!g) return; if (!t) { applySkin(id); return; } g.mats.accent.emissive.setHex(OC_GLOW[t]); g.mats.accent.emissiveIntensity = 1.4; g.mats.accent.color.setHex(OC_GLOW[t]).convertSRGBToLinear(); }
function updateStations(dt) {
  if (rolling) {
    const r = rolling; r.t += dt; r.tick -= dt;
    if (r.tick <= 0) { r.tick = 0.05 + r.t * 0.06; SFX.click(1800 + Math.random() * 800, 0.12); ui.prompt(`Rolling · ${WEAPON_BY_ID[pick(WEAPONS).id].name}`, false, 0.3); }
    r.st.lid.position.y = 0.97 + Math.min(1, r.t * 2) * 0.35; r.st.beam.material.opacity = 0.25;
    if (r.t >= r.dur) {
      const id = r.result; GUNS[loadout[G.cur]].g.visible = false;
      loadout[G.cur] = id; ammo[G.cur] = { mag: magCap(id), reserve: reserveCap(id) };
      GUNS[id].g.visible = true; G.reloading = false; G.switchT = 0.4; G.switchTo = -1; refreshViewmodel(id); applyOcGlow(id);
      SFX.levelUp(); ui.toast(`Crate weapon: ${WEAPON_BY_ID[id].name}`, 'Replaces your current slot for this run', 'drop');
      r.st.lid.position.y = 0.97; rolling = null;
    }
  }
}
function nextWaveNow() { if (!waves.active && run.active) waves.inter = 0.01; }
function openShop() { if (waves.active || state !== 'playing') return; state = 'shop'; releaseMouse(); ui.openArmory('intermission'); }

// ---------------- states ----------------
const canvas = renderer.domElement;
function requestLock() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
function releaseMouse() { mouseL = mouseR = false; for (const k in keys) keys[k] = false; if (locked && document.exitPointerLock) { expectUnlock = true; document.exitPointerLock(); } }
function resetWorld() {
  clearDelayed(); rolling = null; hitStop = 0;
  if (world.map) { run.mutator = null; applyMutatorFx(); }
  enemies.slice().forEach(e => { if (e.isBoss) e.remove(); else { scene.remove(e.m.g); if (e.beam) scene.remove(e.beam); } }); enemies.length = 0; boss = null;
  clearProjectiles(); clearTurrets(); clearCoins();
  grenades.forEach(n => scene.remove(n.m)); grenades.length = 0;
  pickups.forEach(k => scene.remove(k.g)); pickups.length = 0;
  debris.forEach(d => scene.remove(d.m)); debris.length = 0;
  stuck.forEach(s => scene.remove(s.m)); stuck.length = 0;
  clearDecals(); resetBarrels(); hideDamageNumbers();
  for (const k in powerups) powerups[k] = 0;
}
function startRun() {
  SFX.init();
  if (!mapUnlocked(MAP_BY_ID[profile.map])) profile.map = 'yard';
  if (!world.map || world.map.id !== profile.map || world.mode !== wantedMode()) loadMap(profile.map);
  resetWorld(); resetRun();
  Object.assign(run, { mode: world.mode, candy: 0, fever: 0, feverT: 0 });
  mapsAtStart.length = 0; MAPS.forEach(m => { if (mapUnlocked(m)) mapsAtStart.push(m.id); });
  Object.assign(player, { hp: 100, armor: 50, alive: true, frags: 3, stuns: 2, yaw: 0, pitch: 0, crouch: 0, lastHurt: -99, stunT: 0, slideT: 0, slideCd: 0 });
  player.pos.copy(world.playerSpawn); player.vel.set(0, 0, 0);
  if (!pointFree(player.pos.x, player.pos.z, 0.5, player.pos.y + 0.1, player.pos.y + 1.7)) player.pos.y = topAt(player.pos.x, player.pos.z, 0.4);
  player.yaw = Math.atan2(player.pos.x, player.pos.z) || 0;
  Object.assign(G, { cooldown: 0, reloading: false, switchT: 0, switchTo: -1, ads: 0, bloom: 0, pumpT: 1, nadeT: 0, burstLeft: 0 }); resetGunFeel();
  setupLoadout(true); WEAPONS.forEach(w => applySkin(w.id));
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
  summary.bestCombo = run.bestCombo; summary.mapId = world.map.id; summary.diffId = run.diff;
  summary.candy = run.candy || 0; summary.mode = run.mode;
  summary.rank = run.score > 0 ? recordScore({ score: run.score, wave: run.wave, kills: run.kills, map: world.map.id, diff: run.diff, mode: run.mode, date: todayKey() }) : -1;
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
  if (e.button === 0) { mouseL = true; G.fireQueued = true; VMS.inspect = 0; } if (e.button === 2) { mouseR = true; G.adsToggled = !G.adsToggled; VMS.inspect = 0; }
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
    case 'KeyE': interact(); break;
    case 'KeyI': if (!G.reloading && G.switchT <= 0) VMS.inspect = 2.4; break;
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
bind('#btnStudio', () => studio.open('menu'));
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
$('#mapCards').addEventListener('click', () => { if (world.map && (world.map.id !== profile.map || world.mode !== wantedMode()) && state === 'menu') loadMap(profile.map); });
$('#modeCards').addEventListener('click', () => { if (world.map && world.mode !== wantedMode() && state === 'menu') loadMap(profile.map); });
document.querySelectorAll('.btn').forEach(b => b.addEventListener('mouseenter', () => SFX.ui()));
if (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) $('#touchNote').hidden = false;

// ---------------- main loop ----------------
const clock = new THREE.Clock();
let menuAngle = 0.6;
function tick(dt) {
  pollGamepad(dt);
  if (hitStop > 0 && state === 'playing') { hitStop -= dt; dt *= 0.25; }
  time += dt; frameNo++;
  if (state === 'playing') {
    run.time += dt; run.multiT = Math.max(0, run.multiT - dt);
    if (run.comboT > 0) { run.comboT -= dt; if (run.comboT <= 0) { run.comboT = 0; run.combo = 0; } }
    updatePlayer(dt); updateWeapon(dt); updateStations(dt); updateNav(dt); updateFever(dt);
    for (const e of enemies.slice()) if (!e.dead) e.update(dt);
    updateBolts(dt); updateOrbs(dt); updateArcs(dt); updatePlasma(dt); updateGrenades(dt); updateBarrels(dt); updatePickups(dt); updateTurrets(dt); updateCoins(dt); updateDelayed(dt); updateStuck(dt); updateWaves(dt);
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
  const raw = clock.getDelta(), dt = Math.min(raw, 0.05);
  perfSample(raw);
  try { tick(dt); } catch (err) { console.error(err); }
  render();
}

// ---------------- performance: FPS counter and dynamic resolution ----------------
const perf = { ema: 1 / 60, slowT: 0, fastT: 0, scale: 1, shown: 0, el: null };
function perfSample(raw) {
  if (raw <= 0 || raw > 0.5) return;
  perf.ema = lerp(perf.ema, raw, 0.05);
  if (settings.dynRes && (state === 'playing' || state === 'dead')) {
    if (perf.ema > 1 / 45) { perf.slowT += raw; perf.fastT = 0; } else if (perf.ema < 1 / 58) { perf.fastT += raw; perf.slowT = 0; } else { perf.slowT = perf.fastT = 0; }
    if (perf.slowT > 1.2 && perf.scale > 0.55) { perf.scale = Math.max(0.55, perf.scale - 0.1); perf.slowT = 0; applyRes(); }
    if (perf.fastT > 4 && perf.scale < 1) { perf.scale = Math.min(1, perf.scale + 0.1); perf.fastT = 0; applyRes(); }
  } else if (!settings.dynRes && perf.scale !== 1) { perf.scale = 1; applyRes(); }
  perf.shown -= raw;
  if (settings.fpsCounter && perf.shown <= 0) { perf.shown = 0.4; if (!perf.el) { perf.el = document.createElement('div'); perf.el.style.cssText = 'position:fixed;right:8px;bottom:6px;z-index:30;font:600 11px var(--mono);color:#9fe7c9;background:rgba(0,0,0,.45);padding:2px 6px;pointer-events:none'; document.body.appendChild(perf.el); } perf.el.textContent = `${Math.round(1 / perf.ema)} FPS · ${Math.round(perf.scale * 100)}% res`; perf.el.hidden = false; }
  else if (!settings.fpsCounter && perf.el) perf.el.hidden = true;
}
function applyRes() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY[settings.quality].pixelRatio) * perf.scale); renderer.setSize(innerWidth, innerHeight); }

// ---------------- gamepad ----------------
const pad = { connected: false, prev: [], rt: false, lt: false, menuT: 0, held: {} };
const deadzone = v => Math.abs(v) < 0.12 ? 0 : Math.sign(v) * Math.pow((Math.abs(v) - 0.12) / 0.88, 1.6);
function pollGamepad(dt) {
  const gp = navigator.getGamepads ? Array.from(navigator.getGamepads()).find(g => g && g.connected) : null;
  if (!gp) { if (pad.connected) { pad.connected = false; pad.rt = pad.lt = false; } return; }
  if (!pad.connected) { pad.connected = true; SFX.init(); ui.toast('Controller connected', 'A to select · B to go back'); }
  const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed), down = i => b(i) && !pad.prev[i];
  if (state === 'playing' && player.alive) {
    const mx = deadzone(gp.axes[0] || 0), my = deadzone(gp.axes[1] || 0), lx = deadzone(gp.axes[2] || 0), ly = deadzone(gp.axes[3] || 0);
    const want = { KeyW: my < -0.3, KeyS: my > 0.3, KeyA: mx < -0.3, KeyD: mx > 0.3, ShiftLeft: b(10) || (pad.held.ShiftLeft && my < -0.3), Space: b(0), KeyC: b(1) };
    for (const k in want) { if (want[k]) { if (!keys[k]) pad.held[k] = true; keys[k] = true; } else if (pad.held[k]) { keys[k] = false; pad.held[k] = false; } }
    // aim slowdown when the crosshair is over a bot
    let assist = 1;
    camera.getWorldDirection(tv);
    for (const e of enemies) { const c = e.center(tv2).sub(camera.position); const d = c.length(); if (d < 60 && c.normalize().dot(tv) > Math.cos(Math.atan2(1.0, d))) { assist = 0.5; break; } }
    const s = weaponRuntime(), rate = 3.4 * settings.padSens * assist * lerp(1, s.zoom * settings.adsSens, G.ads);
    player.yaw -= lx * rate * dt; player.pitch -= ly * rate * dt * 0.75 * (settings.invert ? -1 : 1);
    pad.rt = (gp.buttons[7] && gp.buttons[7].value > 0.4) || false; pad.lt = (gp.buttons[6] && gp.buttons[6].value > 0.4) || false;
    if (pad.rt && !pad.prevRt) G.fireQueued = true; pad.prevRt = pad.rt;
    if (down(1)) trySlide();
    if (down(2)) { if (nearStation()) interact(); else startReload(); }
    if (down(3)) equip((G.cur + 1) % loadout.length);
    if (down(5)) throwGrenade('frag'); if (down(4)) throwGrenade('stun');
    if (down(12)) callAirstrike(); if (down(13)) deployTurret();
    if (down(8) && !waves.active) openShop();
    if (down(9)) pauseGame();
  } else if (state !== 'playing') {
    pad.rt = pad.lt = false;
    const scr = [...document.querySelectorAll('.screen')].find(s => !s.hidden);
    if (scr) {
      const items = [...scr.querySelectorAll('button:not([disabled]), input')].filter(el => el.offsetParent !== null);
      const ay = (gp.axes[1] || 0) + (b(13) ? 1 : 0) - (b(12) ? 1 : 0), ax = (gp.axes[0] || 0) + (b(15) ? 1 : 0) - (b(14) ? 1 : 0);
      pad.menuT -= dt;
      if ((Math.abs(ay) > 0.5 || Math.abs(ax) > 0.5) && pad.menuT <= 0 && items.length) {
        pad.menuT = 0.18; let i = items.indexOf(document.activeElement); i = i < 0 ? 0 : clamp(i + (Math.abs(ay) > Math.abs(ax) ? Math.sign(ay) : Math.sign(ax)), 0, items.length - 1); items[i].focus(); SFX.ui();
      }
      if (down(0) && document.activeElement && items.includes(document.activeElement)) document.activeElement.click();
      if (down(1)) { if (state === 'paused') resumeFromMenu(); else if (state === 'shop') resumeFromMenu(); else { const back = [...scr.querySelectorAll('.btn')].find(x => /done|back/i.test(x.textContent)); if (back) back.click(); } }
      if (state === 'buff') { if (down(14)) ui.buffKey(0); if (down(0) && !items.includes(document.activeElement)) ui.buffKey(1); if (down(15)) ui.buffKey(2); }
    }
  }
  pad.prev = gp.buttons.map(x => x.pressed);
}

// debug / test hooks
window.FB = { get state() { return state; }, run, player, enemies, waves, profile: () => profile, world, startRun, startWave, spawnEnemy, spawnBoss, chooseBuff, gameOver, toMenu, openShop, loadMap, tick, render, get boss() { return boss; }, damageEnemy, explosion, throwGrenade, callAirstrike, deployTurret, weaponRuntime, equip, setupLoadout, waveCleared, fire: () => fire(weaponRuntime(), ammo[G.cur]), G, ammo: () => ammo, loadout: () => loadout, questEvent, addCoins, addXp, interact, tryMantle, roundMults, perf, studio, addCandy, get stations() { return world.stations; } };

loadMap(profile.map);
ui.renderProfile();
ui.show('menu');
Music.play('menu');
frame();
