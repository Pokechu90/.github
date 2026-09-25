'use strict';
// Map definitions and builders. Each map owns its layout, cover, spawn points, lighting and unlock rule.

function worldUV(geo, w, h, d, s) {
  const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / s, uv.getY(k) * dims[f][1] / s); }
}
function addCollider(minX, minY, minZ, maxX, maxY, maxZ, mesh, extra) {
  const c = Object.assign({ min: new V3(minX, minY, minZ), max: new V3(maxX, maxY, maxZ), mesh }, extra || {});
  world.colliders.push(c); return c;
}
function block(x, y, z, w, h, d, mat, o = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (o.uv) worldUV(geo, w, h, d, o.uv);
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y + h / 2, z);
  if (o.rotY) m.rotation.y = o.rotY;
  m.castShadow = o.cast !== false; m.receiveShadow = true; world.group.add(m);
  if (o.ray !== false) world.levelMeshes.push(m);
  if (o.collide !== false) addCollider(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, m, o.noSight ? { noSight: true } : null);
  return m;
}
function deco(mesh, ray = false) { world.group.add(mesh); if (ray) world.levelMeshes.push(mesh); return mesh; }
function cylinder(x, y, z, r, h, mat, o = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(o.r2 ?? r, r, h, o.seg || 20), mat); m.position.set(x, y + h / 2, z);
  m.castShadow = o.cast !== false; m.receiveShadow = true; world.group.add(m);
  if (o.ray !== false) world.levelMeshes.push(m);
  if (o.collide !== false) { const cr = Math.max(r, o.r2 ?? r) * 0.9; addCollider(x - cr, y, z - cr, x + cr, y + h, z + cr, m); }
  return m;
}
function addBarrel(x, z, y = 0) {
  if (!pointFree(x, z, 0.5, y, y + 1)) return;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.2, 18), M.drum); m.position.set(x, y + 0.6, z); m.castShadow = m.receiveShadow = true; world.group.add(m);
  const col = addCollider(x - 0.42, y, z - 0.42, x + 0.42, y + 1.2, z + 0.42, m);
  const b = { mesh: m, col, hp: 30, dead: false, pos: new V3(x, y + 0.6, z), fuse: 0, leak: false }; m.userData.barrel = b; world.barrels.push(b);
}
function lamp(x, z, color = 0xffa860, h = 8, intensity = 1.6, dist = 26) {
  block(x, 0, z, 0.35, h, 0.35, M.steel);
  block(x, h - 0.3, z + 0.8, 0.25, 0.25, 1.8, M.steel, { collide: false });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.5), new THREE.MeshBasicMaterial({ color })); head.position.set(x, h - 0.4, z + 1.5); deco(head);
  pointLamp(x, h - 0.8, z + 1.5, color, intensity, dist);
}
function pointLamp(x, y, z, color, intensity = 1.6, dist = 26, glowSize = 4) {
  const l = new THREE.PointLight(color, intensity, dist, 1.6); l.position.set(x, y, z); deco(l);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })); sp.position.copy(l.position); sp.scale.set(glowSize, glowSize, 1); deco(sp);
  return l;
}
function perimeter(half, h, mat, { hazard = true, cap = true, uv = 8 } = {}) {
  const L = half * 2 + 4;
  [[0, -half, L, 2], [0, half, L, 2], [-half, 0, 2, L], [half, 0, 2, L]].forEach(([x, z, w, d]) => {
    block(x, 0, z, w, h, d, mat, { uv });
    if (hazard) block(x, 0, z, w + (w > d ? 0 : 0.3), 0.9, d + (d > w ? 0 : 0.3), M.hazard, { uv: 4, collide: false, cast: false, ray: false });
    if (cap) block(x, h, z, w + 0.4, 0.4, d + 0.4, M.dark, { collide: false });
  });
}
function stairs(x, z, dir, width, steps, stepH, stepD, mat) { // dir: direction the stairs rise toward
  for (let i = 1; i <= steps; i++) {
    const off = (steps - i) * stepD + stepD / 2;
    if (dir === 'z-') block(x, 0, z + off, width, stepH * i, stepD, mat, { uv: 3 });
    else if (dir === 'z+') block(x, 0, z - off, width, stepH * i, stepD, mat, { uv: 3 });
    else if (dir === 'x-') block(x + off, 0, z, stepD, stepH * i, width, mat, { uv: 3 });
    else block(x - off, 0, z, stepD, stepH * i, width, mat, { uv: 3 });
  }
}
function crateCluster(ax, az, n = 3, mat = M.crate) {
  for (let i = 0; i < n; i++) {
    const x = ax + rand(-2.5, 2.5), z = az + rand(-2.5, 2.5), s = 1.3;
    if (!pointFree(x, z, s / 2 + 0.3, 0, 1)) continue;
    block(x, 0, z, s, s, s, mat, { uv: s });
    if (Math.random() < .45) block(x + rand(-.15, .15), s, z + rand(-.15, .15), s, s, s, mat, { uv: s });
  }
}
function skyline(n, rmin, rmax, hmin, hmax, baseY = 0) {
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + rand(-.05, .05), r = rand(rmin, rmax), w = rand(14, 30), d = rand(14, 30), h = rand(hmin, hmax);
    const geo = new THREE.BoxGeometry(w, h, d); worldUV(geo, w, h, d, 60);
    const m = new THREE.Mesh(geo, M.city); m.position.set(Math.cos(a) * r, baseY + h / 2, Math.sin(a) * r); m.rotation.y = rand(0, 1); deco(m);
    if (Math.random() < .4) { const b = new THREE.Mesh(new THREE.BoxGeometry(.6, .6, .6), M.redGlow); b.position.set(m.position.x, baseY + h + 1, m.position.z); deco(b); }
  }
}
function groundPlane(size, mat) { const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat); g.rotation.x = -Math.PI / 2; g.receiveShadow = true; deco(g, true); return g; }
function paintLines(lines, color = 0xd8a42a) {
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.7, transparent: true, opacity: 0.75 });
  lines.forEach(([x, z, w, d]) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), paint); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.012, z); p.receiveShadow = true; deco(p); });
}
function emitter(pos, rate, fn) { world.emitters.push({ pos, rate, fn, acc: 0 }); }

// ---------------- maps ----------------
const MAPS = [
  {
    id: 'yard', name: 'Yard 9', desc: 'Dusk at the freight terminal. Containers, drums and a raised platform.', unlock: null,
    swatch: 'linear-gradient(160deg,#0a1424,#3d3452 55%,#d36f38)',
    theme: { fog: [0x3b3440, 45, 210], sky: [0x0a1424, 0x3d3452, 0xd36f38], sunCol: 0xff8c3a, sunDir: [-0.55, 0.32, -0.77], sun: [0xffb27a, 2.1], hemi: [0x7d8fb5, 0x2a2018, 0.62], fill: 0.35, exposure: 1.1, stars: 1 },
    half: 72, playerSpawn: [0, 3, 0],
    spawns: [[-64, -64], [64, -64], [-64, 64], [64, 64], [0, -64], [0, 64], [-64, 0], [64, 0], [-30, -64], [30, 64], [64, 30], [-64, -30]],
    build() {
      groundPlane(420, M.ground);
      paintLines([[0, -36, 0.35, 44], [0, 36, 0.35, 44], [-36, 0, 44, 0.35], [36, 0, 44, 0.35], [-24, -60, 0.3, 14], [24, 60, 0.3, 14]]);
      perimeter(72, 9, M.wall);
      [[-44, -44, 24, 11, 18], [46, -40, 18, 13, 26], [-46, 42, 20, 10, 22], [42, 46, 26, 11, 16]].forEach(([x, z, w, h, d]) => {
        block(x, 0, z, w, h, d, M.wall, { uv: 8 }); block(x, h, z, w + 1, 0.6, d + 1, M.dark, { collide: false });
        const facesX = Math.abs(x) > Math.abs(z);
        if (!facesX) { const sz = -Math.sign(z), fz = z + sz * (d / 2 + 0.06); const door = new THREE.Mesh(new THREE.PlaneGeometry(7, 6), M.door); door.position.set(x, 3, fz); door.rotation.y = sz > 0 ? 0 : Math.PI; deco(door, true); const strip = new THREE.Mesh(new THREE.BoxGeometry(8, 0.18, 0.1), M.stripGlow); strip.position.set(x, 6.6, fz); deco(strip); }
        else { const sx = -Math.sign(x), fx = x + sx * (w / 2 + 0.06); const door = new THREE.Mesh(new THREE.PlaneGeometry(7, 6), M.door); door.position.set(fx, 3, z); door.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2; deco(door, true); const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 8), M.stripGlow); strip.position.set(fx, 6.6, z); deco(strip); }
        for (let i = 0; i < 3; i++) block(x + rand(-w / 3, w / 3), h + 0.6, z + rand(-d / 3, d / 3), 1.6, 1.2, 1.6, M.steel, { collide: false });
      });
      const P = 7, H = 3;
      block(0, 0, 0, P * 2, H, P * 2, M.concrete, { uv: 4 });
      [[0, P - 0.25, P * 2, 0.5], [0, -(P - 0.25), P * 2, 0.5], [P - 0.25, 0, 0.5, P * 2], [-(P - 0.25), 0, 0.5, P * 2]].forEach(([x, z, w, d]) => block(x, H, z, w, 0.03, d, M.hazard, { uv: 2, collide: false, cast: false, ray: false }));
      for (const s of [1, -1]) {
        stairs(0, s * P, s > 0 ? 'z-' : 'z+', 4.4, 5, 0.5, 0.8, M.concrete);
        block(s * (P - 0.15), H, 0, 0.3, 1.1, P * 2, M.steel); block(s * 4.6, H, P - 0.15, 4.8, 1.1, 0.3, M.steel); block(s * 4.6, H, -(P - 0.15), 4.8, 1.1, 0.3, M.steel);
      }
      block(-3, H, 2.5, 2.2, 0.9, 0.8, M.crate, { uv: 1.2 }); block(3, H, -2.5, 2.2, 0.9, 0.8, M.crate, { uv: 1.2 });
      const CW = 6.1, CH = 2.6, CD = 2.45;
      [[-20, -12, 0, 0, 2], [22, 14, 1, 1, 1], [18, -22, 0, 2, 1], [-14, 24, 1, 3, 1], [-30, 5, 1, 4, 2], [30, -5, 1, 0, 1], [5, -32, 0, 5, 1], [-6, 34, 0, 1, 2], [55, 10, 1, 2, 1], [-56, -8, 1, 3, 1], [12, 52, 0, 4, 1], [-10, -54, 0, 0, 1], [-24, -30, 1, 1, 1], [26, 30, 0, 5, 1]]
        .forEach(([x, z, rot, ci, stack]) => { const w = rot ? CD : CW, d = rot ? CW : CD; for (let s = 0; s < stack; s++) block(x, s * CH, z, w, CH, d, containerMats[(ci + s * 2) % containerMats.length]); });
      [[-26, -20], [28, 22], [-8, -18], [10, 20], [34, -20], [-34, 20], [0, -46], [0, 46], [-58, 24], [58, -22], [-40, -12], [40, 8], [14, -12], [-14, 12]].forEach(([x, z]) => crateCluster(x, z, 2 + randi(0, 2)));
      [[-12, -2, 0], [12, 2, 0], [-2, 18, 1], [2, -18, 1], [-36, -36, 1], [36, 36, 1], [-50, -26, 0], [50, 26, 0], [36, -58, 0], [-36, 58, 0]].forEach(([x, z, r]) => { if (pointFree(x, z, 1.8, 0, 1)) block(x, 0, z, r ? 0.7 : 3.2, 1.1, r ? 3.2 : 0.7, M.concrete, { uv: 2 }); });
      [[-22, -22], [22, 22], [22, -22], [-22, 22]].forEach(([x, z]) => lamp(x, z));
      [[-17, -6], [-16.2, -5.2], [24, 6], [8, -24], [-24, 30], [30, -30], [-40, -24], [40, 24], [14, 40], [-12, -40], [52, -8], [-52, 8], [9, 9], [-9, -9]].forEach(([x, z]) => addBarrel(x, z));
      skyline(46, 120, 190, 18, 90);
      [[-86, -96], [-62, -104], [96, -70]].forEach(([x, z]) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 48, 16), M.wall); m.position.set(x, 24, z); deco(m);
        const l = new THREE.Mesh(new THREE.BoxGeometry(.8, .8, .8), M.redGlow); l.position.set(x, 49, z); deco(l);
        emitter(new V3(x, 49, z), 6, p => SMOKE.spawn(tv.copy(p).add(tv2.set(rand(-1, 1), 0, rand(-1, 1))), tv2.set(rand(0.5, 1.5), rand(2, 3.5), rand(-.5, .5)), rand(7, 11), 4, 16, COL.smoke, C(0x2a2528), { alpha: 0.35, drag: 0.1 }));
      });
    }
  },
  {
    id: 'factory', name: 'Kessler Works', desc: 'An abandoned foundry. Presses, conveyor lines and a furnace that never went cold.', unlock: { level: 3, wave: 8 },
    swatch: 'linear-gradient(160deg,#1a1410,#4a3020 50%,#ff8a30)',
    theme: { fog: [0x2a2320, 22, 120], sky: [0x1a2030, 0x4a3a30, 0x9a6030], sunCol: 0xffa050, sunDir: [-0.35, 0.85, -0.3], sun: [0xffc48a, 1.7], hemi: [0x6a5a50, 0x1a1410, 0.5], fill: 0.25, exposure: 1.1, stars: 0 },
    half: 50, playerSpawn: [0, 0, 0],
    spawns: [[-45, -42], [45, -42], [-45, 42], [45, 42], [0, -45], [0, 45], [-45, 0], [45, 6], [-25, -45], [25, 45]],
    build() {
      const floor = new THREE.MeshStandardMaterial({ map: tex(T.concrete, 25), roughness: 0.95, color: 0x9a8f86 });
      groundPlane(220, floor);
      paintLines([[0, -8, 70, 0.3], [0, 8, 70, 0.3], [-30, 0, 0.3, 12], [30, 0, 0.3, 12]], 0xd8a42a);
      perimeter(50, 14, M.rust, { hazard: true, uv: 10 });
      // roof with gaps so light pours in
      for (let x = -45; x <= 45; x += 10) for (let z = -45; z <= 45; z += 10) {
        if (Math.random() < 0.35) continue;
        block(x, 14, z, 10, 0.3, 10, M.rust, { collide: false, uv: 10 });
      }
      for (let x = -40; x <= 40; x += 10) block(x, 13.2, 0, 0.5, 0.8, 100, M.steel, { collide: false });
      // columns
      for (const x of [-30, -10, 10, 30]) for (const z of [-30, 30]) block(x, 0, z, 0.9, 14, 0.9, M.steel);
      // conveyor lines with moving parcels
      for (const z of [-18, 18]) {
        for (const [x0, x1] of [[-38, -2.5], [2.5, 38]]) {
          const w = x1 - x0, cx = (x0 + x1) / 2;
          block(cx, 0, z, w, 1.0, 2.2, M.dark);
          block(cx, 1.0, z - 1.05, w, 0.25, 0.1, M.hazard, { collide: false, uv: 4 }); block(cx, 1.0, z + 1.05, w, 0.25, 0.1, M.hazard, { collide: false, uv: 4 });
          const belt = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 1.9), new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 })); belt.position.set(cx, 1.02, z); deco(belt);
          const parcels = [];
          for (let i = 0; i < Math.floor(w / 6); i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(rand(0.7, 1.1), rand(0.5, 0.8), rand(0.7, 1.1)), M.crate); p.castShadow = true; p.userData.x0 = x0; p.userData.w = w; p.userData.o = i * 6 + rand(0, 3); p.position.set(0, 1.05 + p.geometry.parameters.height / 2, z); deco(p); parcels.push(p); }
          const dir = z > 0 ? 1 : -1;
          world.anim.push((dt, t) => { for (const p of parcels) { const u = ((p.userData.o + t * 1.6 * dir) % p.userData.w + p.userData.w) % p.userData.w; p.position.x = p.userData.x0 + u; } });
        }
      }
      // hydraulic presses
      for (const [x, z] of [[-24, 0], [24, 0], [0, -32], [0, 32]]) {
        block(x, 0, z, 5, 1.6, 5, M.rust, { uv: 3 });
        block(x - 2.2, 1.6, z - 2.2, 0.6, 7, 0.6, M.steel); block(x + 2.2, 1.6, z - 2.2, 0.6, 7, 0.6, M.steel);
        block(x - 2.2, 1.6, z + 2.2, 0.6, 7, 0.6, M.steel); block(x + 2.2, 1.6, z + 2.2, 0.6, 7, 0.6, M.steel);
        block(x, 8.6, z, 5.2, 1.2, 5.2, M.rust, { collide: false });
        const head = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.4, 3.6), M.steel); head.castShadow = true; deco(head);
        const ph = rand(0, 6);
        world.anim.push((dt, t) => { const k = Math.max(0, Math.sin(t * 0.9 + ph)); head.position.set(x, 2.3 + (1 - Math.pow(k, 4)) * 5.4, z); });
        block(x, 1.6, z, 3.4, 0.25, 3.4, M.hazard, { collide: false, uv: 2 });
      }
      // furnace
      block(-42, 0, -2, 8, 10, 14, M.rust, { uv: 6 });
      const mouth = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.4), new THREE.MeshBasicMaterial({ color: 0xff7a20 })); mouth.position.set(-37.94, 2.2, -2); mouth.rotation.y = Math.PI / 2; deco(mouth);
      pointLamp(-35.5, 2.2, -2, 0xff6a20, 3, 22, 7);
      emitter(new V3(-37.5, 2, -2), 14, p => FX.spawn(tv.copy(p).add(tv2.set(rand(0, 1), rand(-1, 1.5), rand(-2.2, 2.2))), tv2.set(rand(0.5, 2), rand(1, 3), rand(-.5, .5)), rand(1.5, 3), 0.08, 0.02, COL.fire, COL.fireEnd, { grav: -0.2 }));
      for (let i = 0; i < 2; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 8, 14), M.rust); st.position.set(-44, 14, -6 + i * 8); deco(st); }
      // mezzanine
      block(36, 0, 0, 10, 3.2, 18, M.rust, { uv: 4 });
      stairs(31, 0, 'x+', 4, 6, 0.53, 0.8, M.steel);
      block(36, 3.2, 8.85, 10, 1.1, 0.25, M.steel); block(36, 3.2, -8.85, 10, 1.1, 0.25, M.steel); block(40.85, 3.2, 0, 0.25, 1.1, 18, M.steel);
      block(31.15, 3.2, 5.5, 0.25, 1.1, 7, M.steel); block(31.15, 3.2, -5.5, 0.25, 1.1, 7, M.steel);
      crateCluster(37, -4, 2); crateCluster(37, 5, 2);
      // pallets, crates, drums
      [[-12, -8], [12, 8], [-15, 28], [15, -28], [-30, 40], [30, -40], [-8, 42], [8, -42], [20, 40], [-20, -40]].forEach(([x, z]) => crateCluster(x, z, 3));
      [[-5, -12], [5, 12], [-28, 10], [28, -10], [-40, 30], [42, -30], [16, -4], [-16, 4], [-2, 26], [2, -26]].forEach(([x, z]) => addBarrel(x, z));
      // hanging sodium lamps
      for (const [x, z] of [[-20, -10], [20, 10], [-20, 20], [20, -20], [0, 0]]) {
        const cord = new THREE.Mesh(new THREE.BoxGeometry(0.05, 3, 0.05), M.dark); cord.position.set(x, 12.5, z); deco(cord);
        const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.8, 0.5, 12), M.dark); shade.position.set(x, 10.8, z); deco(shade);
        pointLamp(x, 10.4, z, 0xffa048, 1.8, 30, 3);
      }
      emitter(new V3(0, 6, 0), 3, p => SMOKE.spawn(tv.set(rand(-45, 45), rand(1, 12), rand(-45, 45)), tv2.set(rand(-.2, .2), rand(-.05, .1), rand(-.2, .2)), 8, 0.05, 0.08, COL.amber, COL.dust, { alpha: 0.5 }));
    }
  },
  {
    id: 'rooftops', name: 'Skyline Rooftops', desc: 'Forty storeys up at night. A helipad, water tower and a sea of neon below.', unlock: { level: 6, wave: 12 },
    swatch: 'linear-gradient(160deg,#050814,#1a1f3d 50%,#ff3ea5)',
    theme: { fog: [0x141a2e, 50, 190], sky: [0x050814, 0x1a1f3d, 0x5a2a60], sunCol: 0x6a5aff, sunDir: [0.4, 0.6, 0.5], sun: [0x9fb4ff, 1.0], hemi: [0x5a6aa0, 0x201830, 0.6], fill: 0.35, exposure: 1.2, stars: 1 },
    half: 48, playerSpawn: [0, 2.5, 0],
    spawns: [[-43, -43], [43, -43], [-43, 43], [43, 43], [0, -43], [0, 43], [-43, 0], [43, 0], [-20, 43], [20, -43]],
    build() {
      const roof = groundPlane(100, M.gravel);
      // parapet
      [[0, -49, 100, 2], [0, 49, 100, 2], [-49, 0, 2, 100], [49, 0, 2, 100]].forEach(([x, z, w, d]) => { block(x, 0, z, w, 1.4, d, M.concrete, { uv: 3 }); block(x, 1.4, z, w + 0.2, 0.15, d + 0.2, M.steel, { collide: false }); });
      // the building below and the city around it
      const tower = new THREE.Mesh(new THREE.BoxGeometry(100, 120, 100), M.city); tower.position.set(0, -60.05, 0); deco(tower);
      skyline(40, 90, 200, 60, 180, -120);
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = rand(75, 95), w = rand(20, 40), h = rand(-12, 6); const geo = new THREE.BoxGeometry(w, 120, w); worldUV(geo, w, 120, w, 60); const b = new THREE.Mesh(geo, M.city); b.position.set(Math.cos(a) * r, h - 60, Math.sin(a) * r); deco(b); const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, w), M.dark); top.position.set(b.position.x, h, b.position.z); deco(top); }
      // helipad
      block(0, 0, 0, 16, 2, 16, M.concrete, { uv: 4 });
      stairs(0, 8, 'z-', 4, 4, 0.5, 0.8, M.steel); stairs(0, -8, 'z+', 4, 4, 0.5, 0.8, M.steel);
      { const [c, g] = cv(256, 256); g.fillStyle = '#2b2f36'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#e8e8e8'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 100, 0, 7); g.stroke(); g.fillStyle = '#e8e8e8'; g.fillRect(80, 60, 22, 136); g.fillRect(154, 60, 22, 136); g.fillRect(80, 117, 96, 22); const pad = new THREE.Mesh(new THREE.PlaneGeometry(15.6, 15.6), new THREE.MeshStandardMaterial({ map: tex(c, 1), roughness: 0.8 })); pad.rotation.x = -Math.PI / 2; pad.position.set(0, 2.012, 0); pad.receiveShadow = true; deco(pad); }
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), M.cyanGlow); l.position.set(Math.cos(a) * 7.4, 2.08, Math.sin(a) * 7.4); deco(l); }
      // stairwell housings with neon
      for (const [x, z, col] of [[-30, -26, M.magentaGlow], [28, 30, M.cyanGlow], [-32, 30, M.cyanGlow]]) {
        block(x, 0, z, 5, 3.6, 4, M.concrete, { uv: 3 }); block(x, 3.6, z, 5.4, 0.3, 4.4, M.dark, { collide: false });
        const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.4), M.door); door.position.set(x, 1.2, z + 2.01); deco(door, true);
        const n = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.12, 0.12), col); n.position.set(x, 3.3, z + 2.05); deco(n);
      }
      // AC units
      [[-18, -10], [-14, -14], [18, 12], [22, 8], [-8, 22], [10, -22], [34, -8], [-36, 8], [6, 34], [-24, 40], [38, 40], [-40, -40]].forEach(([x, z]) => {
        if (!pointFree(x, z, 1.6, 0, 1)) return;
        block(x, 0, z, 2.2, 1.6, 2.2, M.steel, { uv: 2 });
        const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.08, 16), M.dark); fan.position.set(x, 1.64, z); deco(fan);
      });
      // water tower
      for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) block(32 + dx, 0, -30 + dz, 0.4, 5, 0.4, M.steel);
      cylinder(32, 5, -30, 3, 4.2, new THREE.MeshStandardMaterial({ color: 0x6a4a36, roughness: 0.8 }));
      const cone = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.5, 20), M.dark); cone.position.set(32, 9.95, -30); deco(cone);
      // billboard
      block(-44, 0, 12, 0.4, 10, 0.4, M.steel); block(-44, 0, 24, 0.4, 10, 0.4, M.steel);
      const bb = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), M.billboard); bb.position.set(-43.7, 7.5, 18); bb.rotation.y = Math.PI / 2; deco(bb, true);
      pointLamp(-40, 6, 18, 0xff3ea5, 1.5, 22, 5);
      // solar rows
      for (let i = 0; i < 4; i++) block(22, 0, -4 + i * 3.2 - 6, 8, 0.9, 1.8, new THREE.MeshStandardMaterial({ color: 0x1b2a4a, roughness: 0.2, metalness: 0.6 }));
      // antenna mast with a blinking beacon
      block(40, 0, -44, 0.35, 16, 0.35, M.steel);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), M.redGlow.clone()); beacon.position.set(40, 16.3, -44); deco(beacon);
      world.anim.push((dt, t) => { beacon.visible = (t % 1.2) < 0.4; });
      crateCluster(-20, 14, 3); crateCluster(14, -38, 3); crateCluster(-6, -36, 2);
      [[-12, 8], [12, -8], [-26, -4], [26, 4], [0, 40], [0, -40]].forEach(([x, z]) => addBarrel(x, z));
      pointLamp(-20, 5, -20, 0x2ee6ff, 1.6, 28); pointLamp(20, 5, 20, 0xff3ea5, 1.6, 28); pointLamp(20, 5, -20, 0x9fb4ff, 1.2, 26); pointLamp(-20, 5, 20, 0xffc070, 1.2, 26);
    }
  },
  {
    id: 'desert', name: 'Outpost Kharon', desc: 'A sun-bleached military base. Hangars, sandbag nests and watchtowers.', unlock: { level: 9, wave: 15 },
    swatch: 'linear-gradient(160deg,#3f78c0,#86b3dd 45%,#e6d2ad)',
    theme: { fog: [0xd9c4a0, 70, 260], sky: [0x3f78c0, 0x86b3dd, 0xe6d2ad], sunCol: 0xfff0c0, sunDir: [0.3, 0.85, 0.35], sun: [0xfff1d6, 2.8], hemi: [0xbcd4ff, 0x8a6a40, 0.7], fill: 0.25, exposure: 0.95, stars: 0 },
    half: 70, playerSpawn: [0, 0, 6],
    spawns: [[-64, -60], [64, -60], [-64, 60], [64, 60], [0, -64], [0, 64], [-64, 0], [64, 0], [-34, 64], [34, -64], [64, 34], [-64, -34]],
    build() {
      groundPlane(520, M.sand);
      const tWall = new THREE.MeshStandardMaterial({ map: tex(T.concrete, 1), color: 0xd9ccb4, roughness: 0.95 });
      perimeter(70, 4.5, tWall, { hazard: false, cap: false, uv: 4 });
      for (let i = 0; i < 14; i++) { const a = rand(0, 6.28), r = rand(95, 200), s = rand(18, 45); const d = new THREE.Mesh(new THREE.SphereGeometry(s, 16, 10), M.sandBlock); d.scale.y = rand(0.15, 0.3); d.position.set(Math.cos(a) * r, -s * 0.05, Math.sin(a) * r); deco(d); }
      // hangars
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x7c7f6a, roughness: 0.7, metalness: 0.4, side: THREE.DoubleSide });
      for (const [x, z] of [[-42, -38], [42, -38], [-42, 38]]) {
        block(x, 0, z, 18, 6, 13, new THREE.MeshStandardMaterial({ map: tex(T.wall, 1), color: 0xc9b99a, roughness: 0.8 }), { uv: 6 });
        const r = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 6.8, 18.4, 24, 1, true, 0, Math.PI), roofMat); r.rotation.z = Math.PI / 2; r.rotation.y = 0; r.position.set(x, 6, z); r.castShadow = true; deco(r);
        addCollider(x - 9, 6, z - 6.5, x + 9, 12, z + 6.5, r);
        const door = new THREE.Mesh(new THREE.PlaneGeometry(9, 5.5), M.door); door.position.set(x, 2.75, z - Math.sign(z) * 6.52); door.rotation.y = z > 0 ? Math.PI : 0; deco(door, true);
      }
      // command building
      block(42, 0, 40, 14, 5, 10, new THREE.MeshStandardMaterial({ map: tex(T.concrete, 1), color: 0xcdbfa4 }), { uv: 5 });
      block(42, 5, 40, 3, 6, 3, M.steel);
      const dish = new THREE.Mesh(new THREE.SphereGeometry(3, 18, 10, 0, Math.PI * 2, 0, Math.PI / 3), new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.5, side: THREE.DoubleSide })); dish.position.set(42, 12, 40); dish.rotation.x = Math.PI * 0.8; deco(dish);
      world.anim.push((dt, t) => { dish.rotation.z = t * 0.4; });
      // watchtowers
      for (const [x, z] of [[-58, -58], [58, -58], [-58, 58], [58, 58]]) {
        for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) block(x + dx, 0, z + dz, 0.35, 6, 0.35, new THREE.MeshStandardMaterial({ color: 0x6b5a40 }));
        block(x, 6, z, 4.2, 0.3, 4.2, M.dark); block(x, 6.3, z, 4.2, 1.2, 4.2, M.sandBlock, { uv: 2 }); block(x, 9, z, 4.8, 0.2, 4.8, M.camo, { collide: false });
        block(x - 2, 7.5, z - 2, 0.2, 1.5, 0.2, M.dark, { collide: false }); block(x + 2, 7.5, z + 2, 0.2, 1.5, 0.2, M.dark, { collide: false });
      }
      // sandbag nests (U shapes)
      const nest = (x, z, rot) => { const s = Math.sign(rot) || 1; if (rot === 0 || rot === 2) { block(x, 0, z + (rot ? 1.6 : -1.6), 4, 1.1, 0.8, M.sandBlock, { uv: 1 }); block(x - 1.6, 0, z, 0.8, 1.1, 2.6, M.sandBlock, { uv: 1 }); block(x + 1.6, 0, z, 0.8, 1.1, 2.6, M.sandBlock, { uv: 1 }); } else { block(x + (rot === 1 ? 1.6 : -1.6), 0, z, 0.8, 1.1, 4, M.sandBlock, { uv: 1 }); block(x, 0, z - 1.6, 2.6, 1.1, 0.8, M.sandBlock, { uv: 1 }); block(x, 0, z + 1.6, 2.6, 1.1, 0.8, M.sandBlock, { uv: 1 }); } void s; };
      nest(0, -18, 0); nest(0, 22, 2); nest(-20, 0, 3); nest(20, 0, 1); nest(-18, -52, 0); nest(18, 54, 2);
      // camo nets over some nests
      for (const [x, z] of [[0, -18], [0, 22]]) { block(x, 3, z, 7, 0.08, 6, M.camo, { collide: false }); for (const [dx, dz] of [[-3.2, -2.8], [3.2, 2.8], [-3.2, 2.8], [3.2, -2.8]]) block(x + dx, 0, z + dz, 0.15, 3, 0.15, M.dark, { collide: false }); }
      // HESCO rows
      const hesco = new THREE.MeshStandardMaterial({ map: tex(T.sand, 1), color: 0xb9a57c, roughness: 1 });
      for (const [x, z, n, dir] of [[-30, -12, 5, 'x'], [24, 14, 5, 'x'], [-10, 36, 4, 'z'], [10, -40, 4, 'z'], [52, 0, 5, 'z'], [-54, 16, 5, 'z']]) for (let i = 0; i < n; i++) block(dir === 'x' ? x + i * 1.35 : x, 0, dir === 'z' ? z + i * 1.35 : z, 1.3, 1.4, 1.3, hesco, { uv: 1.3 });
      // fuel tanks
      const tankMat = new THREE.MeshStandardMaterial({ color: 0xe3ddd0, roughness: 0.5, metalness: 0.4 });
      cylinder(30, 0, -12, 2.8, 5, tankMat); cylinder(37, 0, -12, 2.8, 5, tankMat);
      // trucks
      for (const [x, z, r] of [[-14, 50, 0], [18, -54, 1]]) {
        const w = r ? 2.4 : 7, d = r ? 7 : 2.4;
        block(x, 0.7, z, w, 1.6, d, M.camo, { uv: 3 }); block(x + (r ? 0 : 2.6), 2.3, z + (r ? 2.6 : 0), r ? 2.4 : 1.8, 1.4, r ? 1.8 : 2.4, M.camo, { uv: 2 });
        addCollider(x - w / 2, 0, z - d / 2, x + w / 2, 0.7, z + d / 2, null);
        for (const s of [-1, 1]) for (const o of [-2.4, 0, 2.4]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 14), M.dark); if (r) { wh.rotation.z = Math.PI / 2; wh.position.set(x + s * 1.25, 0.55, z + o); } else { wh.rotation.x = Math.PI / 2; wh.position.set(x + o, 0.55, z + s * 1.25); } deco(wh); }
      }
      const tan = [0xa38a5c, 0x8a7a58, 0x6b6f5a];
      [[8, 12, 0], [-24, -24, 1], [26, 34, 1], [-38, 8, 0]].forEach(([x, z, r], i) => { const m = new THREE.MeshStandardMaterial({ map: tex(T.container, 1), color: tan[i % 3], roughness: 0.6, metalness: 0.4 }); block(x, 0, z, r ? 2.45 : 6.1, 2.6, r ? 6.1 : 2.45, m); });
      [[-6, -6], [6, 8], [30, -20], [-44, -20], [44, 20], [-8, 40], [12, -24], [-30, 28]].forEach(([x, z]) => crateCluster(x, z, 3));
      [[-2, -8], [4, 6], [34, -18], [-40, 22], [-26, -40], [26, 44], [48, -6], [-14, 10]].forEach(([x, z]) => addBarrel(x, z));
      emitter(new V3(0, 0, 0), 6, () => SMOKE.spawn(tv.set(rand(-70, 70), rand(0.2, 1.5), rand(-70, 70)), tv2.set(rand(2, 5), rand(0, .4), rand(-1, 1)), 3, 1, 4, C(0xd8c49a), C(0xc9b28a), { alpha: 0.18 }));
    }
  },
  {
    id: 'lab', name: 'Sublevel 4', desc: 'An underground research lab. Tight lanes, server rows and a live reactor core.', unlock: { level: 12, wave: 20 },
    swatch: 'linear-gradient(160deg,#05080a,#0b3a42 50%,#5ff2ff)',
    theme: { fog: [0x0b1a1f, 18, 85], sky: null, background: 0x05080a, sunCol: 0xffffff, sunDir: [0.25, 1, 0.15], sun: [0xd8f4ff, 0.55], hemi: [0xcfefff, 0x203038, 0.95], fill: 0.2, exposure: 1.15, stars: 0 },
    half: 38, ceiling: 7, playerSpawn: [0, 0, 22],
    spawns: [[-34, -30], [34, -30], [-34, 30], [34, 30], [0, -34], [-34, 0], [34, 0], [-18, -34], [18, -34]],
    build() {
      groundPlane(80, M.tile);
      perimeter(38, 7, M.labwall, { hazard: false, cap: false, uv: 7 });
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x1a2328, roughness: 0.8, side: THREE.DoubleSide })); ceil.rotation.x = Math.PI / 2; ceil.position.y = 7; deco(ceil);
      for (let x = -30; x <= 30; x += 10) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 64), M.whiteGlow); s.position.set(x, 6.95, 0); deco(s); }
      // reactor
      block(0, 0, 0, 7, 0.6, 7, M.steel, { uv: 2 });
      cylinder(0, 0.6, 0, 1.4, 6.4, M.cyanGlow, { collide: false });
      cylinder(0, 0.6, 0, 2.6, 6.4, M.glass, { cast: false });
      const rings = [];
      for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(3, 0.12, 8, 40), M.steel); r.position.set(0, 1.8 + i * 1.8, 0); r.rotation.x = Math.PI / 2; deco(r); rings.push(r); }
      world.anim.push((dt, t) => { rings.forEach((r, i) => { r.rotation.y = Math.sin(t * 0.8 + i) * 0.4; r.rotation.z = t * (0.5 + i * 0.3); }); });
      pointLamp(0, 3.5, 0, 0x5ff2ff, 2.2, 24, 5);
      // containment tanks
      for (const [x, z] of [[-14, -14], [-14, 14], [14, -14], [14, 14], [-22, 0], [22, 0]]) {
        cylinder(x, 0, z, 1.3, 0.5, M.steel, { collide: false });
        cylinder(x, 0.5, z, 1.1, 3.6, M.greenGlow, { collide: false, cast: false });
        cylinder(x, 0.5, z, 1.3, 3.6, M.glass, { cast: false });
        cylinder(x, 4.1, z, 1.35, 0.4, M.steel, { collide: false });
        const spec = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.35), M.dark); spec.position.set(x, 2.3, z); deco(spec);
        const ph = rand(0, 6); world.anim.push((dt, t) => { spec.position.y = 2.3 + Math.sin(t + ph) * 0.15; spec.rotation.y = t * 0.3 + ph; });
      }
      // server rows
      for (const x of [-30, 30]) for (const z of [-24, -8, 8, 24]) { block(x, 0, z, 1.2, 2.6, 6, M.rack, { uv: 2.6 }); block(x + (x > 0 ? -3 : 3), 0, z, 1.2, 2.6, 6, M.rack, { uv: 2.6 }); }
      // benches
      for (const [x, z, r] of [[-6, 12, 0], [6, -12, 0], [-8, -20, 1], [8, 20, 1], [0, 30, 0], [0, -30, 0]]) {
        block(x, 0, z, r ? 1.2 : 3.4, 1, r ? 3.4 : 1.2, M.steel, { uv: 2 });
        const mon = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.05), M.cyanGlow); mon.position.set(x, 1.35, z); if (r) mon.rotation.y = Math.PI / 2; deco(mon);
      }
      // glass partitions and pillars
      for (const [x, z, w, d] of [[-10, 0, 0.2, 8], [10, 0, 0.2, 8], [0, -10, 8, 0.2], [0, 10, 8, 0.2]]) { const g = block(x, 0, z, w, 3, d, M.glass, { cast: false }); g.renderOrder = 3; block(x, 3, z, w + 0.1, 0.12, d + 0.1, M.steel, { collide: false }); }
      for (const x of [-20, 20]) for (const z of [-28, 28]) block(x, 0, z, 1, 7, 1, M.labwall, { uv: 2 });
      // alarm lights
      const alarms = [];
      for (const [x, z, ry] of [[-37.9, -15, Math.PI / 2], [37.9, 15, -Math.PI / 2], [15, -37.9, 0], [-15, 37.9, Math.PI]]) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.2), M.redGlow.clone()); a.position.set(x, 5.2, z); a.rotation.y = ry; deco(a); alarms.push(a); }
      world.anim.push((dt, t) => { const on = (t % 1.4) < 0.7; alarms.forEach(a => a.visible = on); });
      [[-26, -32], [26, 32], [-4, 34], [4, -34], [-26, 16], [26, -16]].forEach(([x, z]) => addBarrel(x, z));
      [[-18, 32], [18, -32], [-32, -34], [32, 34]].forEach(([x, z]) => crateCluster(x, z, 2));
      pointLamp(-20, 6, -20, 0xd8f4ff, 1.2, 26, 3); pointLamp(20, 6, 20, 0xd8f4ff, 1.2, 26, 3); pointLamp(-20, 6, 20, 0x5ff2ff, 1, 22, 3); pointLamp(20, 6, -20, 0x5ff2ff, 1, 22, 3);
    }
  },
];
const MAP_BY_ID = Object.fromEntries(MAPS.map(m => [m.id, m]));
function mapUnlocked(m) { return !m.unlock || profile.level >= m.unlock.level || profile.stats.bestWave >= m.unlock.wave; }
function mapUnlockText(m) { return m.unlock ? `Reach level ${m.unlock.level} or survive to wave ${m.unlock.wave}` : ''; }

function disposeGroup(g) {
  g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  scene.remove(g);
}
function loadMap(id) {
  const m = MAP_BY_ID[id] || MAPS[0];
  if (world.group) disposeGroup(world.group);
  world.group = new THREE.Group(); scene.add(world.group);
  world.colliders.length = 0; world.levelMeshes.length = 0; world.barrels.length = 0; world.anim.length = 0; world.emitters.length = 0;
  world.map = m; world.half = m.half; world.ceiling = m.ceiling || Infinity;
  const th = m.theme;
  scene.fog.color.setHex(th.fog[0]); scene.fog.near = th.fog[1]; scene.fog.far = th.fog[2];
  if (th.sky) { sky.visible = true; scene.background = null; skyUniforms.top.value.setHex(th.sky[0]); skyUniforms.mid.value.setHex(th.sky[1]); skyUniforms.hor.value.setHex(th.sky[2]); }
  else { sky.visible = false; scene.background = new THREE.Color(th.background); }
  skyUniforms.sunCol.value.setHex(th.sunCol); skyUniforms.stars.value = th.stars;
  sunDir.set(...th.sunDir).normalize();
  sun.color.setHex(th.sun[0]); sun.intensity = th.sun[1];
  hemi.color.setHex(th.hemi[0]); hemi.groundColor.setHex(th.hemi[1]); hemi.intensity = th.hemi[2];
  fill.intensity = th.fill; renderer.toneMappingExposure = th.exposure;
  const b = m.half + 12; Object.assign(sun.shadow.camera, { left: -b, right: b, top: b, bottom: -b }); sun.shadow.camera.updateProjectionMatrix();
  m.build();
  world.spawnPoints = m.spawns.map(([x, z]) => new V3(x, 0, z)).filter(p => pointFree(p.x, p.z, 1));
  world.playerSpawn.set(...m.playerSpawn);
  applyQuality();
  // materials need a recompile when the number of lights changes between maps
  scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(mt => mt.needsUpdate = true); });
  vmScene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
}
function updateWorldAnim(dt, t) {
  for (const f of world.anim) f(dt, t);
  for (const e of world.emitters) { e.acc += dt * e.rate; while (e.acc >= 1) { e.acc -= 1; e.fn(e.pos); } }
}
