'use strict';
// Gunsmith kit: the shapes, surfaces and small details the weapon models are built from.
// - Parts are bevelled boxes and turned (lathe) profiles with texture coordinates in real-world size, so
//   brushed metal, stippled polymer, wood grain and skin patterns keep the same scale on every part.
// - A small reflection environment makes metal and polymer read like real finishes.
// - Each gun's static parts are merged per material at the end, so a detailed gun still costs a handful
//   of draw calls.

const GP_TILE = 0.06; // metres covered by one repeat of a surface texture

// ---------------- materials shared by every gun ----------------
const GP_MAT = {
  dark: new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 0.9, metalness: 0.2 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.28, metalness: 1 }),
  blued: new THREE.MeshStandardMaterial({ color: 0x23272d, roughness: 0.3, metalness: 1 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95, metalness: 0 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xd2a447, roughness: 0.25, metalness: 1 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xb8683a, roughness: 0.3, metalness: 1 }),
  shell: new THREE.MeshStandardMaterial({ color: 0xa8161c, roughness: 0.55, metalness: 0.05 }),
  smoke: new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.2, metalness: 0, transparent: true, opacity: 0.55, depthWrite: false }),
  white: new THREE.MeshStandardMaterial({ color: 0xd8d6d0, roughness: 0.6, metalness: 0 }),
  tritium: new THREE.MeshBasicMaterial({ color: 0x7dff6a }),
  amber: new THREE.MeshBasicMaterial({ color: 0xffa020 }),
};
Object.values(GP_MAT).forEach(m => m.color.convertSRGBToLinear());

// ---------------- procedural surface textures (grey maps for roughness and bump) ----------------
const GP_TEX = (() => {
  const brushed = (() => {
    const [c, g] = cv(256, 256); g.fillStyle = '#b8b8b8'; g.fillRect(0, 0, 256, 256);
    // fine machining streaks along the length of each part, with a little tooling noise
    for (let i = 0; i < 900; i++) { const y = Math.random() * 256, a = Math.random() * 0.12; g.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; g.fillRect(0, y, 256, Math.random() < 0.8 ? 0.6 : 1.4); }
    speckle(g, 256, 256, 2500, ['#000', '#fff'], 1.2, 0.18);
    return tex(c, 1, 1, false);
  })();
  const stipple = (() => {
    const [c, g] = cv(256, 256); g.fillStyle = '#c4c4c4'; g.fillRect(0, 0, 256, 256);
    // moulded polymer texture: dense round stipples
    for (let i = 0; i < 4200; i++) { const x = Math.random() * 256, y = Math.random() * 256, r = 0.6 + Math.random() * 1.5; wrap9(256, 256, (ox, oy) => { if (x + ox < -3 || x + ox > 259 || y + oy < -3 || y + oy > 259) return; g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(x + ox, y + oy, r, 0, 7); g.fill(); }); }
    return tex(c, 1, 1, false);
  })();
  const knurl = (() => {
    const [c, g] = cv(64, 64); g.fillStyle = '#808080'; g.fillRect(0, 0, 64, 64); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.5;
    for (let i = -64; i < 128; i += 6) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); g.beginPath(); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); }
    return tex(c, 1, 1, false);
  })();
  return { brushed, stipple, knurl };
})();
// knurled steel for grips of knobs, turrets and muzzle devices
GP_MAT.knurl = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.5, metalness: 0.9, bumpMap: GP_TEX.knurl, bumpScale: 0.01 });
GP_MAT.knurl.color.convertSRGBToLinear();
GP_MAT.steel.roughnessMap = GP_TEX.brushed; GP_MAT.blued.roughnessMap = GP_TEX.brushed;
GP_MAT.rubber.bumpMap = GP_TEX.stipple; GP_MAT.rubber.bumpScale = 0.006;

// apply the base surface detail to a gun's skinnable materials
function gunSurfaces(mats) {
  mats.metal.roughnessMap = GP_TEX.brushed; mats.metal.bumpMap = GP_TEX.brushed; mats.metal.bumpScale = 0.0006;
  for (const k of ['poly', 'alt']) { mats[k].roughnessMap = GP_TEX.stipple; mats[k].bumpMap = GP_TEX.stipple; mats[k].bumpScale = 0.0025; }
  mats.accent.roughnessMap = GP_TEX.stipple;
}

// ---------------- reflections ----------------
// A soft studio: dim walls, a warm floor bounce and three softboxes, prefiltered for rough reflections.
function makeGunEnv(r) {
  const s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(5, 32, 16), col = [];
  const P = geo.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const y = P.getY(i) / 5, t = Math.max(0, y);
    const c = y > 0 ? new THREE.Color(0x3a3e46).lerp(new THREE.Color(0x8a8e98), t) : new THREE.Color(0x3a3e46).lerp(new THREE.Color(0x2a2016), Math.min(1, -y * 2));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const box = (w, h, x, y, z, c, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
  box(3, 1.2, -2, 3.5, 1.5, 0xfff4e6, 6);   // key softbox overhead
  box(0.8, 3, 3.6, 0.8, -1, 0xd8e4ff, 3.5); // cool strip on the right
  box(2, 1, 0, 0.5, -3.8, 0xffe0c0, 2.2);   // warm card in front
  const pm = new THREE.PMREMGenerator(r);
  const t = pm.fromScene(s, 0.03).texture;
  pm.dispose();
  return t;
}

// ---------------- geometry ----------------
const _gpGeo = new Map();
const gpKey = (...a) => a.map(v => typeof v === 'number' ? v.toFixed(4) : v).join(',');
// box with every edge bevelled by r; texture coordinates follow the part's real size
function roundedBoxGeo(w, h, d, r) {
  const mn = Math.min(w, h, d);
  if (r == null) r = Math.min(0.0035, mn * 0.22);
  r = Math.max(0, Math.min(r, mn * 0.45));
  const key = gpKey('b', w, h, d, r);
  if (_gpGeo.has(key)) return _gpGeo.get(key);
  const geo = new THREE.BoxGeometry(1, 1, 1, 3, 3, 3);
  const P = geo.attributes.position.array, N = geo.attributes.normal.array, U = geo.attributes.uv.array;
  const half = [w / 2, h / 2, d / 2], inner = half.map(x => Math.max(1e-5, x - r));
  const v = [0, 0, 0], c = [0, 0, 0];
  for (let i = 0; i < P.length / 3; i++) {
    const ax = Math.abs(N[i * 3]) > 0.5 ? 0 : Math.abs(N[i * 3 + 1]) > 0.5 ? 1 : 2;
    for (let a = 0; a < 3; a++) {
      const p = P[i * 3 + a], s = Math.sign(p);
      v[a] = Math.abs(p) > 0.4 ? s * half[a] : s * inner[a];
      c[a] = Math.max(-inner[a], Math.min(inner[a], v[a]));
    }
    let ox = v[0] - c[0], oy = v[1] - c[1], oz = v[2] - c[2];
    const L = Math.hypot(ox, oy, oz);
    if (L > 1e-9) { ox /= L; oy /= L; oz /= L; P[i * 3] = c[0] + ox * r; P[i * 3 + 1] = c[1] + oy * r; P[i * 3 + 2] = c[2] + oz * r; N[i * 3] = ox; N[i * 3 + 1] = oy; N[i * 3 + 2] = oz; }
    // sides and top map their u along the gun's length so grain and streaks run fore and aft
    const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
    const uu = ax === 2 ? px : pz, vv = ax === 0 ? py : ax === 1 ? px : py;
    U[i * 2] = uu / GP_TILE + 0.5; U[i * 2 + 1] = vv / GP_TILE + 0.5;
  }
  geo.computeBoundingSphere();
  _gpGeo.set(key, geo);
  return geo;
}
function scaleUv(geo, su, sv) { const U = geo.attributes.uv.array; for (let i = 0; i < U.length; i += 2) { U[i] *= su; U[i + 1] *= sv; } return geo; }
function cylGeo(r, r2, len, seg) {
  const key = gpKey('c', r, r2, len, seg);
  if (_gpGeo.has(key)) return _gpGeo.get(key);
  const geo = scaleUv(new THREE.CylinderGeometry(r, r2, len, seg), Math.PI * 2 * Math.max(r, r2) / GP_TILE, len / GP_TILE);
  _gpGeo.set(key, geo);
  return geo;
}

// ---------------- primitives (all positions in metres; x right, y up, -z toward the muzzle) ----------------
function rb(p, w, h, d, mat, x, y, z, r) { const m = new THREE.Mesh(roundedBoxGeo(w, h, d, r), mat); m.position.set(x, y, z); p.add(m); return m; }
function cyl(p, r, len, mat, x, y, z, r2 = r, seg = 20) { const m = new THREE.Mesh(cylGeo(r, r2, len, seg), mat); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); p.add(m); return m; }
// cylinder standing upright (turrets, shells, pins seen from above)
function cylY(p, r, len, mat, x, y, z, seg = 16) { const m = new THREE.Mesh(cylGeo(r, r, len, seg), mat); m.position.set(x, y, z); p.add(m); return m; }
// cylinder across the gun (pins, cross-bolts, windage turrets)
function cylX(p, r, len, mat, x, y, z, seg = 14) { const m = new THREE.Mesh(cylGeo(r, r, len, seg), mat); m.rotation.z = Math.PI / 2; m.position.set(x, y, z); p.add(m); return m; }
// turned part from a profile of [radius, z] pairs (z runs along the barrel axis)
function lathe(p, prof, mat, x, y, z, seg = 24) {
  const key = gpKey('l', seg, ...prof.flat());
  let geo = _gpGeo.get(key);
  if (!geo) {
    const rmax = Math.max(...prof.map(q => q[0])), len = Math.abs(prof[prof.length - 1][1] - prof[0][1]) || 0.01;
    geo = scaleUv(new THREE.LatheGeometry(prof.map(([r, zz]) => new THREE.Vector2(r, zz)), seg), Math.PI * 2 * rmax / GP_TILE, len / GP_TILE);
    _gpGeo.set(key, geo);
  }
  const m = new THREE.Mesh(geo, mat); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); p.add(m); return m;
}
function rot(m, x = 0, y = 0, z = 0) { m.rotation.set(x, y, z); return m; }
function grp(p, x = 0, y = 0, z = 0, rx = 0) { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.x = rx; p.add(g); return g; }
// dark disc showing the bore at a muzzle
function bore(p, r, x, y, z) { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 16), GP_MAT.dark); m.position.set(x, y, z - 0.0005); m.rotation.y = Math.PI; p.add(m); return m; }

// ---------------- details ----------------
// Picatinny rail: a base strip with cross-slotted teeth every 1 cm. y is the bottom; the top sits 8 mm higher.
function rail(p, mat, len, x, y, z, w = 0.021) {
  rb(p, w, 0.005, len, mat, x, y + 0.0025, z, 0.0012);
  const n = Math.max(2, Math.floor(len / 0.01)), step = (len - 0.0052) / (n - 1);
  for (let i = 0; i < n; i++) rb(p, w + 0.002, 0.0032, 0.0052, mat, x, y + 0.0064, z - len / 2 + 0.0026 + i * step, 0.0008);
}
// trigger guard hanging under a receiver whose underside is at y, with the trigger at z
function trigger(p, mats, y, z, len = 0.07) {
  rb(p, 0.011, 0.005, len, mats.poly, 0, y - 0.036, z + 0.005, 0.002);           // bottom bow
  rb(p, 0.011, 0.034, 0.006, mats.poly, 0, y - 0.019, z - len / 2 + 0.008, 0.002); // front
  const t = grp(p, 0, y - 0.004, z);
  for (let i = 0; i < 5; i++) rot(rb(t, 0.0055, 0.0085, 0.0045, GP_MAT.blued, 0, -0.003 - i * 0.0052, 0.002 - Math.pow(i, 1.5) * 0.0022, 0.0018), -0.2 - i * 0.16);
}
// screw or pin head on the side of a part, facing ±x
function screw(p, x, y, z, r = 0.0032, mat = GP_MAT.blued) {
  const s = Math.sign(x) || 1;
  cylX(p, r, 0.002, mat, x, y, z, 12);
  rb(p, 0.0012, r * 1.6, 0.0008, GP_MAT.dark, x + s * 0.0008, y, z, 0.0002);
}
// row of dark grooves (serrations, M-LOK slots, cooling vents); boxes are slightly wider than the part
function grooves(p, n, w, h, d, x, y, z0, dz) { for (let i = 0; i < n; i++) rb(p, w, h, d, GP_MAT.dark, x, y, z0 + i * dz, Math.min(h, d) * 0.3); }
// iron sights: a protected front post and a rear aperture; `top` is the sight-line height
function frontPost(p, mat, top, z, baseY) {
  const h = top - baseY;
  rb(p, 0.018, 0.006, 0.016, mat, 0, baseY + 0.003, z, 0.0015);
  for (const s of [-1, 1]) rb(p, 0.003, h + 0.002, 0.009, mat, s * 0.008, baseY + h / 2 + 0.002, z, 0.001);
  rb(p, 0.0022, h - 0.004, 0.0022, mat, 0, baseY + 0.004 + (h - 0.004) / 2, z, 0.0006);
}
function rearAperture(p, mat, top, z, baseY) {
  rb(p, 0.022, 0.007, 0.018, mat, 0, baseY + 0.0035, z, 0.0015);
  for (const s of [-1, 1]) rb(p, 0.0035, top - baseY + 0.004, 0.01, mat, s * 0.0085, (top + baseY) / 2 + 0.002, z, 0.001);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0034, 0.0014, 8, 18), mat); ring.position.set(0, top, z); p.add(ring);
  rb(p, 0.004, top - baseY - 0.004, 0.004, mat, 0, (top + baseY) / 2 - 0.002, z, 0.0008);
}
// a loaded round lying along the barrel axis (bullet toward -z)
function cartridge(p, x, y, z, s = 1) {
  cyl(p, 0.0045 * s, 0.03 * s, GP_MAT.brass, x, y, z, 0.0045 * s, 0.0045 * s, 12);
  cyl(p, 0.003 * s, 0.006 * s, GP_MAT.brass, x, y, z - 0.018 * s, 0.0045 * s, 12);
  cyl(p, 0.0006 * s, 0.014 * s, GP_MAT.copper, x, y, z - 0.028 * s, 0.003 * s, 12);
}
// muzzle device: turned body with ports cut through it; ends at z
function muzzleBrake(p, mat, r, len, y, z, ports = 3) {
  lathe(p, [[r * 0.75, 0], [r, -0.003], [r, -len + 0.003], [r * 0.85, -len]], mat, 0, y, z + len);
  for (let i = 0; i < ports; i++) rb(p, r * 2.3, r * 0.55, len / (ports * 2 + 1), GP_MAT.dark, 0, y, z + len - (i * 2 + 1.5) * len / (ports * 2 + 1), 0.0008);
  bore(p, r * 0.45, 0, y, z);
}
// birdcage flash hider: slots all the way round
function flashHider(p, mat, r, len, y, z) {
  lathe(p, [[r * 0.8, 0], [r, -0.004], [r, -len]], mat, 0, y, z + len);
  for (let i = 0; i < 3; i++) rot(rb(p, r * 2.15, r * 0.36, len * 0.7, GP_MAT.dark, 0, y, z + len * 0.42, 0.0006), 0, 0, i * Math.PI / 3);
  bore(p, r * 0.5, 0, y, z);
}

// ---------------- hands ----------------
// gloved hands: palm, four curled fingers wrapped round the grip, thumb, cuff and sleeve
function gpHands(g, gripZ, foreZ, foreY = -0.02) {
  const hands = new THREE.Group(); g.add(hands);
  const G = VMS_MAT.glove, S = VMS_MAT.sleeve;
  const hand = (x, y, z, ry, rx, cuffLen) => {
    const h = grp(hands, x, y, z); h.rotation.set(rx, ry, 0);
    rb(h, 0.05, 0.075, 0.07, G, 0.012, 0, 0.012, 0.012);                                 // palm
    for (let i = 0; i < 4; i++) rb(h, 0.016, 0.017, 0.042, G, -0.019, 0.028 - i * 0.019, -0.006, 0.007); // fingers
    rot(rb(h, 0.016, 0.044, 0.016, G, 0.024, 0.03, -0.012, 0.007), 0.3, 0, -0.25);           // thumb
    rb(h, 0.06, 0.05, 0.03, G, 0.012, -0.04, 0.05, 0.01);                                    // cuff
    const sl = rb(h, 0.075, 0.075, cuffLen, S, 0.02, -0.07, 0.05 + cuffLen / 2, 0.02); sl.rotation.x = 0.35;
  };
  hand(0.012, -0.065, gripZ, 0.2, 0.15, 0.3);
  if (foreZ != null) hand(-0.008, foreY - 0.045, foreZ, -0.5, 0.05, 0.36);
  return hands;
}

// ---------------- merging ----------------
// flatten every mesh under a group into one mesh per material (keeps sprites and overlay meshes as they are)
function mergeGroup(group) {
  if (!group) return;
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map(), drop = [];
  group.traverse(o => {
    if (!o.isMesh || o.userData.keep || o.material.depthTest === false) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(m);
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(geo);
    drop.push(o);
  });
  for (const o of drop) o.parent.remove(o);
  for (const [mat, geos] of buckets) {
    const out = new THREE.BufferGeometry();
    const count = geos.reduce((n, gg) => n + gg.attributes.position.count, 0);
    for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2]]) {
      const arr = new Float32Array(count * size); let off = 0;
      for (const gg of geos) { const a = gg.attributes[name]; if (a) arr.set(a.array, off); off += gg.attributes.position.count * size; gg.dispose(); }
      out.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    out.computeBoundingSphere();
    group.add(new THREE.Mesh(out, mat));
  }
}
