'use strict';
// Halloween event: the Night of Terror mode, its monsters, Dracula, candy corn, the Trick-or-Treat quests,
// the Reaper's Contract quest line and the map dressing (jack-o'-lanterns, graves, dead trees, mist, blood moon).

// The event runs from 1 October to 7 November. Add ?halloween to the URL to force it on (or =off to hide it).
function halloweenActive() {
  const q = location.search;
  if (/halloween=off/.test(q)) return false;
  if (/halloween/.test(q)) return true;
  const d = new Date(), m = d.getMonth() + 1, day = d.getDate();
  return m === 10 || (m === 11 && day <= 7);
}
function nightMode() { return run.mode === 'halloween'; }
if (halloweenActive()) document.documentElement.classList.add('halloween');

const HW = { skin: 0x7a9a68, rot: 0x5f7a52, bone: 0xe6dcc0, cloth: 0x3a4a6a, robe: 0x1a1420, wood: 0x4a3020, pumpkin: 0xe8761c };
const FACTION_HALLOWEEN = { id: 'halloween', name: 'Night of Terror', desc: 'Skeleton archers, zombies, witches, pumpkin bombers and vampire bats. Dracula rises every fifth wave.', bosses: ['dracula'] };
FACTIONS.push(FACTION_HALLOWEEN);

// ---------------- monsters ----------------
Object.assign(ENEMY_TYPES, {
  h_skeleton: { faction: 'halloween', role: 'grunt', name: 'Skeleton Archer', hp: 85, speed: 4.4, radius: 0.4, height: 1.85, scale: 0.98, color: HW.bone, glow: 0xff8a20, pref: [10, 26], rate: [1.5, 2.4], dmg: 8, acc: 0.028, boltSpeed: 34, proj: 'bonearrow', coins: 10, xp: 20, score: 100, from: 1, weight: 10, map: '#e6dcc0', fx: 'bone', look: 'skeleton' },
  h_zombie: { faction: 'halloween', role: 'runner', name: 'Zombie', hp: 95, speed: 5.6, radius: 0.42, height: 1.8, scale: 0.98, color: HW.skin, glow: 0xd8ff6a, dmg: 12, meleeRate: 1.1, coins: 9, xp: 18, score: 110, from: 1, weight: 9, map: '#9adf5a', fx: 'flesh', look: 'zombie', zombie: true },
  h_bat: { faction: 'halloween', role: 'drone', name: 'Vampire Bat', hp: 40, speed: 8, radius: 0.5, height: 0.5, color: 0x1a1216, glow: 0xff2a3a, rate: [1.0, 1.6], dmg: 6, acc: 0.05, boltSpeed: 30, proj: 'blood', coins: 12, xp: 22, score: 120, from: 2, weight: 5, map: '#ff2a3a', flying: true, fx: 'blood', look: 'bat' },
  h_ghost: { faction: 'halloween', role: 'drone', name: 'Ghost', hp: 50, speed: 6, radius: 0.5, height: 0.5, color: 0xdff4ff, glow: 0x5dffd8, rate: [1.3, 2.0], dmg: 7, acc: 0.04, boltSpeed: 26, proj: 'spirit', coins: 12, xp: 22, score: 120, from: 4, weight: 3, map: '#cfefff', flying: true, fx: 'ghost', look: 'ghost' },
  h_witch: { faction: 'halloween', role: 'sniper', name: 'Witch', hp: 80, speed: 3.8, radius: 0.4, height: 1.8, scale: 0.95, color: 0x6a9a4a, glow: 0x8aff3a, pref: [26, 55], dmg: 22, proj: 'hexbolt', beam: 0x8aff3a, coins: 15, xp: 28, score: 150, from: 3, weight: 3, map: '#8aff3a', fx: 'flesh', look: 'witch' },
  h_pumpkin: { faction: 'halloween', role: 'exploder', name: 'Pumpkin Bomber', hp: 50, speed: 7, radius: 0.42, height: 1.7, scale: 0.92, color: 0x5a4a30, glow: 0xffa020, dmg: 40, boom: 0xff8a20, coins: 10, xp: 20, score: 120, from: 5, weight: 4, map: '#ff8a20', fx: 'pumpkin', look: 'pumpkin' },
  h_brute: { faction: 'halloween', role: 'tank', name: 'Graveyard Brute', hp: 650, speed: 2.4, radius: 0.75, height: 2.9, scale: 1.5, color: 0x6e8a62, glow: 0x7aff4a, pref: [10, 28], rate: [2.6, 3.4], dmg: 18, acc: 0.03, boltSpeed: 24, coins: 35, xp: 70, score: 400, from: 6, weight: 1.4, map: '#7aff4a', fx: 'flesh', look: 'brute' },
  h_keeper: { faction: 'halloween', role: 'shield', name: 'Gravekeeper', hp: 200, speed: 3.6, radius: 0.5, height: 1.9, scale: 1, color: 0x8a8070, glow: 0xffb040, pref: [6, 16], rate: [1.8, 2.8], dmg: 9, acc: 0.03, boltSpeed: 28, proj: 'spirit', coins: 20, xp: 35, score: 200, from: 7, weight: 3, map: '#ffb040', fx: 'flesh', look: 'keeper' },
  h_thrall: { faction: 'halloween', role: 'grunt', name: 'Blood Thrall', hp: 150, speed: 3.6, radius: 0.4, height: 1.8, scale: 0.95, color: 0xd8c8c0, glow: 0xff2a3a, pref: [12, 24], rate: [2, 3], dmg: 9, acc: 0.03, boltSpeed: 26, proj: 'blood', healer: true, healColor: 0xff2a3a, coins: 25, xp: 40, score: 250, from: 99, weight: 0, map: '#ff2a3a', fx: 'blood', look: 'thrall' },
});
const H_SKIN_COUNT = Object.values(SKINS).filter(s => s.event === 'halloween').length;
for (const k of Object.keys(ENEMY_TYPES)) if (ENEMY_TYPES[k].faction === 'halloween') ENEMY_TYPES[k].build = ENEMY_TYPES[k].flying ? buildSpookFlyer : buildSpook;
Object.assign(PROJ, {
  blood: { speed: 30, color: 0xff2030, core: 0xffc0c8, size: 1.1, trailCol: COL.red, sfx: p => SFX.spit(p) },
  hexbolt: { speed: 90, color: 0x8aff3a, core: 0xeaffd0, size: 0.9, trailCol: COL.green, sfx: p => SFX.wail(p) },
});

// every Night of Terror monster uses the shared rig (hips at 0.95, legs, torso, head, arms)
function buildSpook(kind, k) {
  const g = new THREE.Group(), hit = [];
  const look = k.look;
  const body = new THREE.MeshStandardMaterial({ color: k.color, roughness: 0.7, metalness: 0.05, emissive: 0x000000 });
  const glow = new THREE.MeshBasicMaterial({ color: k.glow });
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85, metalness: 0.05 }, o));
  const cloth = mat(look === 'witch' ? HW.robe : look === 'thrall' ? 0x5a0a12 : look === 'keeper' ? 0x2a2420 : HW.cloth), dark = mat(0x1a1612), wood = mat(HW.wood), metal = mat(0x8a8f94, { roughness: 0.4, metalness: 0.8 });
  const part = (geo, m, x, y, z, parent, name) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); if (name) { o.userData.part = name; hit.push(o); } return o; };
  const B = (w, h, d) => GEOM.box(w, h, d), S = (r, a = 10, b = 8) => GEOM.sphere(r, a, b), Cy = (r1, r2, h, n = 8) => GEOM.cyl(r1, r2, h, n), Co = (r, h, n = 8) => GEOM.cone(r, h, n);
  const skel = look === 'skeleton';
  const limbW = skel ? 0.07 : look === 'brute' ? 0.16 : 0.12;
  const root = new THREE.Group(); root.scale.setScalar(k.scale || 1); g.add(root);
  const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
  const role = k.role;
  let torso;
  if (skel) {
    torso = part(B(0.4, 0.5, 0.24), new THREE.MeshStandardMaterial({ color: 0, transparent: true, opacity: 0 }), 0, 0.36, 0, hips, 'torso'); torso.castShadow = false;
    part(Cy(0.04, 0.04, 0.55), body, 0, 0, -0.06, torso);
    for (let i = 0; i < 4; i++) { const r = part(GEOM.torus(0.17 - i * 0.012, 0.022, 5, 12, Math.PI * 1.4), body, 0, 0.16 - i * 0.1, 0, torso); r.rotation.set(Math.PI / 2, 0, -Math.PI * 0.2); }
    part(B(0.36, 0.08, 0.14), body, 0, -0.3, 0, torso);
  } else if (look === 'pumpkin') {
    torso = part(B(0.4, 0.5, 0.26), mat(0x6a5a34), 0, 0.36, 0, hips, 'torso');
    for (let i = 0; i < 5; i++) part(B(0.03, 0.16, 0.02), mat(0xc8a050), -0.16 + i * 0.08, -0.3, 0.13, torso);
  } else torso = part(B(look === 'brute' ? 0.62 : 0.48, look === 'brute' ? 0.66 : 0.56, look === 'brute' ? 0.4 : 0.3), look === 'zombie' || look === 'brute' ? cloth : (look === 'witch' || look === 'thrall' || look === 'keeper' ? cloth : body), 0, 0.36, 0, hips, 'torso');
  if (look === 'zombie') { part(B(0.2, 0.18, 0.02), body, 0.08, 0.05, 0.155, torso); part(B(0.5, 0.1, 0.32), mat(0x3a2e24), 0, -0.26, 0, torso); }
  if (look === 'witch' || look === 'thrall') { const skirt = part(Co(0.42, 0.9, 10), cloth, 0, -0.5, 0, torso); skirt.rotation.x = Math.PI; }
  if (look === 'keeper') { const coat = part(Co(0.4, 0.8, 10), cloth, 0, -0.4, 0, torso); coat.rotation.x = Math.PI; }
  // head
  let head;
  if (look === 'pumpkin') {
    head = part(S(0.3, 14, 10), mat(HW.pumpkin, { roughness: 0.6 }), 0, 0.58, 0.02, torso, 'head'); head.scale.set(1.15, 0.95, 1.1);
    for (let i = 0; i < 6; i++) { const rib = part(S(0.3, 10, 8), mat(0xc8601a, { roughness: 0.6 }), 0, 0, 0, head); rib.scale.set(0.35, 1.02, 1.02); rib.rotation.y = i / 6 * Math.PI; }
    part(Cy(0.03, 0.04, 0.12, 6), mat(0x4a5a20), 0, 0.31, 0, head);
  } else if (skel) { head = part(S(0.16, 12, 10), body, 0, 0.52, 0, torso, 'head'); head.scale.set(1, 1.15, 1.1); part(B(0.16, 0.07, 0.12), body, 0, -0.13, 0.04, head); }
  else if (look === 'brute') { head = part(B(0.36, 0.42, 0.34), body, 0, 0.58, 0.02, torso, 'head'); part(B(0.38, 0.1, 0.36), dark, 0, 0.24, 0, head); for (const s of [-1, 1]) { const bolt = part(Cy(0.03, 0.03, 0.1, 6), metal, s * 0.22, -0.14, 0, head); bolt.rotation.z = Math.PI / 2; } }
  else head = part(B(0.28, 0.32, 0.28), body, 0, 0.52, 0.01, torso, 'head');
  const eyeY = look === 'pumpkin' ? 0.04 : 0.03, eyeZ = look === 'pumpkin' ? 0.3 : (look === 'brute' ? 0.17 : 0.145);
  for (const s of [-1, 1]) {
    if (skel) part(S(0.045, 6, 5), new THREE.MeshBasicMaterial({ color: 0x050505 }), s * 0.06, eyeY, eyeZ - 0.01, head);
    if (look === 'pumpkin') { const e = part(Co(0.05, 0.07, 3), glow, s * 0.1, 0.05, 0.31, head); e.rotation.x = Math.PI / 2; }
    else part(S(look === 'brute' ? 0.03 : 0.025, 6, 5), glow, s * 0.06, eyeY, eyeZ + 0.005, head);
  }
  if (look === 'witch') { const brim = part(Cy(0.3, 0.3, 0.02, 14), cloth, 0, 0.16, 0, head); void brim; const hat = part(Co(0.16, 0.5, 10), cloth, 0, 0.42, -0.05, head); hat.rotation.x = -0.35; part(Co(0.04, 0.12, 4), body, 0, -0.02, 0.17, head).rotation.x = Math.PI / 2; }
  if (look === 'thrall') { part(B(0.3, 0.12, 0.3), mat(0x1a1010), 0, 0.15, -0.02, head); for (const s of [-1, 1]) part(Co(0.012, 0.05, 4), mat(0xffffff), s * 0.04, -0.12, 0.14, head).rotation.x = Math.PI; }
  if (look === 'keeper') { const hood = part(Co(0.24, 0.36, 8), cloth, 0, 0.14, -0.04, head); hood.rotation.x = -0.25; }
  if (look === 'zombie') { part(B(0.12, 0.04, 0.02), mat(0x2a1010), 0.02, -0.1, 0.145, head); part(B(0.3, 0.06, 0.3), mat(0x2a2218), 0, 0.17, 0, head); }
  // legs and arms
  const legs = [], armsA = [];
  for (const s of [-1, 1]) {
    const lp = new THREE.Group(); lp.position.set(s * 0.15, 0, 0); hips.add(lp); legs.push(lp);
    const legMat = skel ? body : (look === 'zombie' || look === 'brute' ? mat(0x3a2e24) : look === 'pumpkin' ? mat(0x4a3a24) : dark);
    part(B(limbW + 0.03, 0.48, limbW + 0.04), legMat, 0, -0.24, 0, lp, 'limb');
    part(B(limbW, 0.46, limbW + 0.02), legMat, 0, -0.7, 0.02, lp, 'limb');
    part(B(skel ? 0.1 : 0.15, 0.07, 0.26), skel ? body : dark, 0, -0.93, 0.06, lp);
    const ap = new THREE.Group(); ap.position.set(s * (look === 'brute' ? 0.42 : 0.32), 0.56, 0); torso.add(ap); armsA.push(ap);
    const armMat = skel || look === 'zombie' || look === 'brute' ? body : cloth;
    part(S(skel ? 0.06 : 0.09, 8, 6), armMat, 0, 0, 0, ap);
    part(B(limbW, 0.34, limbW + 0.01), armMat, 0, -0.18, 0, ap, 'limb');
    part(B(limbW - 0.01, 0.32, limbW), skel || look === 'pumpkin' ? body : (look === 'zombie' || look === 'brute' ? body : body), 0, -0.48, 0, ap, 'limb');
    part(S(skel ? 0.05 : 0.07, 8, 6), body, 0, -0.66, 0, ap);
  }
  let gunTip = null, tipMat = null; const extra = {};
  const rArm = armsA[1], lArm = armsA[0];
  if (role === 'runner') {
    // zombies reach forward with ragged nails
    armsA.forEach(a => { for (let i = -1; i <= 1; i++) { const c = part(Co(0.015, 0.08, 4), mat(0x2a2a1a), i * 0.03, -0.73, 0.02, a); c.rotation.x = Math.PI; } });
  } else if (role === 'exploder') {
    const coreMat = new THREE.MeshBasicMaterial({ color: k.glow });
    // the carved grin glows from inside: shoot it to set the pumpkin off early
    extra.core = part(B(0.3, 0.09, 0.05), coreMat, 0, -0.1, 0.3, head, 'weak');
    for (let i = 0; i < 4; i++) part(B(0.05, 0.05, 0.051), mat(HW.pumpkin), -0.105 + i * 0.07, -0.06, 0.3, head);
    extra.coreMat = coreMat;
  } else {
    rArm.rotation.x = -1.35; lArm.rotation.x = -1.1; lArm.rotation.z = -0.5;
    tipMat = new THREE.MeshBasicMaterial({ color: k.glow, transparent: true, opacity: 0.3 });
    if (look === 'skeleton') {
      const bow = new THREE.Group(); bow.position.set(0, -0.7, 0); rArm.add(bow);
      part(B(0.035, 0.035, 0.16), mat(0x3a2618), 0, 0, 0, bow);
      for (const s of [-1, 1]) { const limb = part(B(0.025, 0.025, 0.42), body, 0, -0.07, s * 0.28, bow); limb.rotation.x = s * 0.45; }
      part(B(0.006, 0.006, 0.86), mat(0xe8e0d0), 0, 0.12, 0, bow);
      part(B(0.012, 0.6, 0.012), body, 0, -0.12, 0, bow);
      gunTip = part(S(0.03, 6, 5), tipMat, 0, -0.44, 0, bow);
      const quiver = part(Cy(0.07, 0.06, 0.42, 8), mat(0x3a2618), 0.1, 0.05, -0.2, torso); quiver.rotation.z = 0.4;
    } else if (look === 'witch' || look === 'thrall') {
      // a wand (witch) or a blood chalice staff (thrall)
      const wand = part(Cy(0.012, 0.018, look === 'witch' ? 0.5 : 1.2, 6), look === 'witch' ? dark : mat(0x2a1010), 0, look === 'witch' ? -0.85 : -0.6, 0, rArm); void wand;
      gunTip = part(S(0.06, 8, 6), tipMat, 0, look === 'witch' ? -1.1 : -1.22, 0, rArm);
      part(S(0.035, 6, 5), glow, 0, look === 'witch' ? -1.1 : -1.22, 0, rArm);
      if (look === 'witch') { const broom = part(Cy(0.02, 0.02, 1.2, 6), wood, 0.12, 0.1, -0.22, torso); broom.rotation.z = 0.5; const bristle = part(Co(0.1, 0.3, 8), mat(0xb08a40), 0.42, -0.42, -0.22, torso); bristle.rotation.z = 0.5 + Math.PI; }
    } else if (role === 'tank') {
      // gravestone in the left hand to throw, a stitched back with a glowing battery
      gunTip = part(B(0.3, 0.42, 0.1), tipMat, 0, -0.75, 0.1, lArm);
      part(B(0.32, 0.44, 0.12), mat(0x707470), 0, -0.75, 0.1, lArm);
      part(B(0.3, 0.26, 0.12), glow, 0, 0.06, -0.21, torso, 'weak');
      for (const x of [-0.1, 0.1]) part(Cy(0.03, 0.03, 0.14, 6), metal, x, 0.22, -0.21, torso);
    } else {
      // gravekeeper: lantern-glow in the left hand, coffin lid shield on the right
      gunTip = part(S(0.05, 6, 5), tipMat, 0, -0.7, 0, lArm);
      const lantern = part(B(0.12, 0.16, 0.12), metal, 0, -0.78, 0.04, lArm); void lantern;
    }
    if (role === 'shield') {
      const sh = new THREE.Group(); sh.position.set(0, -0.05, 0.5); torso.add(sh);
      // coffin lid: wider at the shoulders, narrow at the feet
      part(B(0.8, 0.5, 0.07), wood, 0, 0.05, 0, sh, 'shield');
      part(B(0.62, 0.8, 0.07), wood, 0, -0.55, 0, sh, 'shield');
      part(B(0.06, 0.5, 0.02), metal, 0, -0.15, 0.045, sh); part(B(0.3, 0.06, 0.02), metal, 0, -0.05, 0.045, sh);
      part(B(0.2, 0.24, 0.1), glow, 0, -0.02, -0.2, torso, 'weak');
      extra.shield = sh;
    }
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = meshVolume(o) > 0.012; });
  return Object.assign({ g, root, hips, torso, head, legs, arms: armsA, hit, body, glow, gunTip, tipMat }, extra);
}

function buildSpookFlyer(kind, k) {
  const g = new THREE.Group(), hit = [];
  const body = new THREE.MeshStandardMaterial({ color: k.color, roughness: 0.8, metalness: 0.05, emissive: 0x000000, transparent: k.look === 'ghost', opacity: k.look === 'ghost' ? 0.82 : 1 });
  const glow = new THREE.MeshBasicMaterial({ color: k.glow });
  const add = (geo, m, x, y, z, name, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); if (name) { o.userData.part = name; hit.push(o); } return o; };
  const tipMat = new THREE.MeshBasicMaterial({ color: k.glow, transparent: true, opacity: 0.3 });
  const wings = []; let eye;
  if (k.look === 'bat') {
    add(GEOM.sphere(0.22, 12, 10), body, 0, 0, 0, 'torso');
    eye = add(GEOM.sphere(0.14, 10, 8), body, 0, 0.06, 0.22, 'head');
    for (const s of [-1, 1]) {
      add(GEOM.sphere(0.03, 6, 5), glow, s * 0.055, 0.1, 0.34);
      add(GEOM.cone(0.05, 0.16, 4), body, s * 0.08, 0.2, 0.2).rotation.z = -s * 0.3;
      const wg = new THREE.Group(); wg.position.set(s * 0.18, 0.04, 0); g.add(wg); wings.push(wg);
      add(GEOM.box(0.8, 0.02, 0.44), new THREE.MeshStandardMaterial({ color: 0x2a1418, roughness: 0.9, side: THREE.DoubleSide }), s * 0.4, 0, -0.04, 'limb', wg);
      add(GEOM.box(0.82, 0.03, 0.03), body, s * 0.4, 0.01, 0.18, null, wg);
      add(GEOM.cone(0.012, 0.06, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), s * 0.03, -0.04, 0.34).rotation.x = Math.PI;
    }
  } else {
    // ghost: a draped sheet with a wavy hem and hollow eyes
    const sheet = add(GEOM.sphere(0.36, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), body, 0, 0.1, 0, 'torso');
    void sheet;
    add(GEOM.cyl(0.36, 0.42, 0.55, 14, 1, true), body, 0, -0.17, 0);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(GEOM.cone(0.08, 0.18, 5), body, Math.cos(a) * 0.36, -0.52, Math.sin(a) * 0.36).rotation.x = Math.PI; }
    eye = add(GEOM.sphere(0.16, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }), 0, 0.22, 0.24, 'head');
    for (const s of [-1, 1]) add(GEOM.sphere(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0x080810 }), s * 0.11, 0.2, 0.31);
    add(GEOM.sphere(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0x080810 }), 0, 0.05, 0.34).scale.set(1, 1.4, 0.6);
    for (const s of [-1, 1]) { const wg = new THREE.Group(); wg.position.set(s * 0.36, 0.05, 0); g.add(wg); wings.push(wg); add(GEOM.cone(0.08, 0.36, 6), body, s * 0.1, -0.1, 0.06, 'limb', wg).rotation.z = s * 1.9; }
  }
  const gunTip = add(GEOM.sphere(0.05, 8, 6), tipMat, 0, 0, 0.42);
  g.traverse(o => { if (o.isMesh) o.castShadow = o.userData.part === 'torso'; });
  return { g, hit, body, glow, gunTip, tipMat, rotors: [], eye, wings };
}

// ---------------- Dracula ----------------
BOSSES.push({ id: 'dracula', name: 'Dracula', title: 'Lord of the Night of Terror', hp: 4800, faction: 'halloween' });
class DraculaBoss extends WarlordBase {
  constructor(p, cycle) {
    super(BOSSES.find(b => b.id === 'dracula'), cycle);
    this.faction = 'halloween'; this.mapColor = '#ff2a3a';
    this.body = { pos: p.clone(), vel: new V3(), radius: 0.7, height: 2.8, onGround: true };
    this.pos = this.body.pos; this.centerY = 1.7; this.yaw = 0; this.rings = [];
    const G = this.group, suit = this.mat(0x101014, { roughness: 0.6, metalness: 0.1 }), skin = this.mat(0xe8dcd8, { roughness: 0.55, metalness: 0 }), capeOut = this.mat(0x0a0a0e, { roughness: 0.8, metalness: 0, side: THREE.DoubleSide }), capeIn = this.mat(0x7a0a14, { roughness: 0.6, metalness: 0, side: THREE.DoubleSide }), gold = this.mat(0xc8a040, { roughness: 0.3, metalness: 0.9 }), hair = this.mat(0x08080a, { roughness: 0.5, metalness: 0.2 }), shirt = this.mat(0xe8e4dc, { roughness: 0.7, metalness: 0 });
    const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
    const add = (geo, m, x, y, z, parent, part) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); if (part) this.mark(o, part); else o.castShadow = true; return o; };
    this.hips = new THREE.Group(); this.hips.position.y = 1.15; G.add(this.hips);
    this.legs = [];
    for (const s of [-1, 1]) { const l = new THREE.Group(); l.position.set(s * 0.17, 0, 0); this.hips.add(l); add(B(0.18, 0.6, 0.2), suit, 0, -0.3, 0, l, 'limb'); add(B(0.16, 0.55, 0.18), suit, 0, -0.85, 0.01, l, 'limb'); add(B(0.17, 0.08, 0.32), hair, 0, -1.12, 0.06, l); this.legs.push(l); }
    this.torso = new THREE.Group(); this.torso.position.y = 0.05; this.hips.add(this.torso);
    add(B(0.62, 0.8, 0.34), suit, 0, 0.42, 0, this.torso, 'body');
    add(B(0.22, 0.6, 0.02), shirt, 0, 0.5, 0.175, this.torso);
    add(B(0.66, 0.06, 0.36), this.mat(0x5a0a12), 0, 0.12, 0, this.torso);
    // blood medallion: the weak point
    this.gem = add(new THREE.OctahedronGeometry(0.1), new THREE.MeshBasicMaterial({ color: 0xff2a3a }), 0, 0.6, 0.2, this.torso, 'weak');
    add(new THREE.TorusGeometry(0.12, 0.018, 6, 16), gold, 0, 0.6, 0.19, this.torso);
    // high collar
    for (const s of [-1, 1]) { const col = add(B(0.3, 0.42, 0.03), capeIn, s * 0.2, 0.98, -0.08, this.torso); col.rotation.set(-0.3, s * 0.5, s * 0.25); }
    // cape: black outside, crimson inside, flaring as he moves
    this.cape = new THREE.Group(); this.cape.position.set(0, 0.82, -0.17); this.torso.add(this.cape);
    add(B(0.9, 1.9, 0.02), capeOut, 0, -0.9, -0.02, this.cape); add(B(0.86, 1.86, 0.02), capeIn, 0, -0.9, 0.0, this.cape);
    this.head = add(B(0.3, 0.36, 0.3), skin, 0, 1.08, 0.02, this.torso, 'head');
    add(B(0.32, 0.12, 0.32), hair, 0, 0.16, -0.01, this.head); add(new THREE.ConeGeometry(0.05, 0.12, 4), hair, 0, 0.08, 0.15, this.head).rotation.x = Math.PI;
    for (const s of [-1, 1]) { add(new THREE.SphereGeometry(0.025, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff1a2a }), s * 0.07, 0.04, 0.155, this.head); add(new THREE.ConeGeometry(0.01, 0.05, 4), shirt, s * 0.035, -0.12, 0.15, this.head).rotation.x = Math.PI; add(new THREE.ConeGeometry(0.05, 0.14, 4), skin, s * 0.17, 0.04, -0.02, this.head).rotation.z = -s * 1.2; }
    this.arms = [];
    this.clawMat = new THREE.MeshBasicMaterial({ color: 0xff2a3a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const s of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(s * 0.4, 0.78, 0); this.torso.add(a); this.arms.push(a);
      add(B(0.15, 0.5, 0.15), suit, 0, -0.25, 0, a, 'limb'); add(B(0.13, 0.45, 0.13), suit, 0, -0.7, 0.02, a, 'limb');
      add(B(0.1, 0.14, 0.12), skin, 0, -0.98, 0.03, a);
      for (let i = -1; i <= 1; i++) add(new THREE.ConeGeometry(0.012, 0.12, 4), shirt, i * 0.03, -1.1, 0.05, a).rotation.x = Math.PI;
      add(B(0.12, 0.5, 0.02), this.clawMat, 0, -1.05, 0.08, a).castShadow = false;
    }
    this.group.traverse(o => { if (o.isMesh && o.material !== this.clawMat) o.castShadow = true; });
    this.group.position.copy(this.pos);
    // a visible bat swarm for his mist form
    this.bats = [];
    for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(GEOM.box(0.4, 0.02, 0.16), new THREE.MeshBasicMaterial({ color: 0x08080c })); b.visible = false; scene.add(b); this.bats.push({ m: b, a: rand(0, 6.28), r: rand(0.6, 1.8), y: rand(0.5, 2.5), s: rand(4, 8) }); }
    this.beam = new THREE.Mesh(GEOM.box(0.12, 0.12, 1), new THREE.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(this.beam);
    this.state = 'walk'; this.stateT = 0; this.boltT = 2; this.mistT = 6; this.slashT = 1.5; this.summonT = 1; this.drainT = 7; this.rainT = 5; this.walkPh = 0;
    this.minionKinds = ['h_bat', 'h_bat', 'h_zombie'];
  }
  phaseText(n) { return n === 2 ? 'Life drain: break line of sight when the red beam locks on' : 'Blood moon: blood rains around you and his children swarm'; }
  onPhase(n) { this.summonT = 0.5; if (n === 3) this.minionKinds = ['h_bat', 'h_zombie', 'h_zombie', 'h_pumpkin']; }
  // in bat form he can't be hurt
  absorb(amount, info) { if (this.state === 'mist') { SFX.blocked(info.point || this.pos); return { dealt: 0, killed: false, blocked: true }; } return null; }
  extraCleanup() { this.bats.forEach(b => scene.remove(b.m)); scene.remove(this.beam); }
  center(out) { return out.copy(this.pos).setY(this.pos.y + this.centerY); }
  update(dt) {
    this.t += dt; this.spawnT = Math.min(1, this.spawnT + dt * 0.9); this.stunT = Math.max(0, this.stunT - dt); this.flash(dt); this.updateRings(dt);
    const b = this.body;
    this.gem.rotation.y += dt * 2; this.gem.scale.setScalar(1 + Math.sin(this.t * 4) * 0.12 + (this.healedT > 0 ? 0.25 : 0));
    this.healedT = Math.max(0, (this.healedT || 0) - dt);
    this.clawMat.opacity = Math.max(0, this.clawMat.opacity - dt * 2.5);
    for (const bt of this.bats) { if (!bt.m.visible) continue; bt.a += dt * bt.s; bt.m.position.set(this.pos.x + Math.cos(bt.a) * bt.r, this.pos.y + bt.y + Math.sin(this.t * 9 + bt.a) * 0.2, this.pos.z + Math.sin(bt.a) * bt.r); bt.m.rotation.y = -bt.a; bt.m.scale.x = 0.6 + Math.abs(Math.sin(this.t * 22 + bt.a)) * 0.8; }
    if (this.spawnT < 1 || this.stunT > 0 || !player.alive) { b.vel.x *= 0.8; b.vel.z *= 0.8; moveBody(b, dt, 0.6); this.group.position.copy(b.pos); this.beam.material.opacity = 0; return; }
    const enraged = this.phase === 3;
    this.stateT -= dt;
    let dist = Math.hypot(player.pos.x - b.pos.x, player.pos.z - b.pos.z);
    // his children: bats and zombies, plus a Blood Thrall who feeds him
    this.summonT -= dt;
    if (this.summonT <= 0) {
      this.summonT = this.phase === 1 ? 12 : 9;
      const room = 4 + this.phase * 2 + this.cycle - this.minionCount();
      if (room > 0) { const n = this.summonRing(this.minionKinds, Math.min(room, 2 + this.phase), 7); if (n) { SFX.wail(this.pos); ui.toast('Dracula calls his children', `${n} creatures of the night answer`, 'drop'); } }
      if (!enemies.some(e => e.k && e.k.healer && !e.dead)) this.summonRing(['h_thrall'], 1, 9);
    }
    if (this.state === 'walk') {
      dist = this.walkToward(dt, enraged ? 4.8 : 3.6, 2.4);
      this.face(dt);
      this.boltT -= dt; this.mistT -= dt; this.slashT -= dt; this.drainT -= dt; this.rainT -= dt;
      if (dist < 3 && this.slashT <= 0) { this.state = 'windup'; this.stateT = enraged ? 0.28 : 0.38; this.combo = 2; this.clawMat.opacity = 0.9; SFX.whoosh(this.pos); }
      else if (this.mistT <= 0 && (dist > 14 || dist < 5)) { this.state = 'mist'; this.stateT = 1.3; this.group.visible = false; this.bats.forEach(x => x.m.visible = true); SFX.wail(this.pos); SFX.whoosh(this.pos); for (let i = 0; i < 40; i++) FX.spawn(tv.copy(b.pos).setY(b.pos.y + rand(0.5, 2.5)), randDir(tv2, rand(1, 4)), rand(.4, .9), .3, .02, COL.red, COL.redEnd, { drag: 2 }); }
      else if (this.phase >= 2 && this.drainT <= 0 && dist < 26 && !segBlocked(this.center(tv), playerAim(tv2))) { this.state = 'drainAim'; this.stateT = 0.8; SFX.charge(this.pos, true); }
      else if (this.boltT <= 0 && dist > 4) {
        this.boltT = enraged ? 1.5 : 2.2;
        this.arms[1].getWorldPosition(tv); tv.y += 0.4;
        const n = enraged ? 7 : 5;
        for (let i = 0; i < n; i++) { const t2 = playerAim(new V3(), 0.25); const side = tv4.set(-(t2.z - tv.z), 0, t2.x - tv.x).normalize(); t2.addScaledVector(side, (i - (n - 1) / 2) * 1.1); fireProjectile(tv.clone(), t2, 8 * this.dmgMul, 'blood', 32); }
        this.cast = 0.4;
      }
      if (enraged && this.rainT <= 0) {
        this.rainT = 6;
        for (let i = 0; i < 6; i++) { const tgt = new V3(player.pos.x + rand(-6, 6), 0, player.pos.z + rand(-6, 6)); tgt.y = groundAt(tgt.x, tgt.z, player.pos.y + 1); setTimeout(() => { if (!this.dead && run.active) spawnArc(tv3.copy(this.pos).setY(this.pos.y + 6), tgt, 1.4 + i * 0.1, 20 * this.dmgMul, 3, 0xff2030); }, i * 140); }
        SFX.wail(this.pos);
      }
    } else if (this.state === 'windup') {
      b.vel.multiplyScalar(0.8); moveBody(b, dt, 0.6); this.face(dt, 10);
      if (this.stateT <= 0) {
        this.swing = { arm: this.combo % 2, t: 0.22 }; SFX.slash(this.pos);
        const reach = Math.hypot(player.pos.x - b.pos.x, player.pos.z - b.pos.z);
        const ang = Math.atan2(player.pos.x - b.pos.x, player.pos.z - b.pos.z) - this.yaw;
        if (reach < 3.3 && Math.cos(ang) > 0.2 && Math.abs(player.pos.y - b.pos.y) < 2) { const dmg = 17 * this.dmgMul; hurtPlayer(dmg, b.pos); this.hp = Math.min(this.hpMax, this.hp + dmg * 1.5); this.healedT = 0.4; }
        this.combo--;
        if (this.combo > 0) { this.stateT = 0.28; this.clawMat.opacity = 0.9; } else { this.state = 'walk'; this.slashT = enraged ? 1 : 1.6; }
      }
    } else if (this.state === 'mist') {
      // the swarm flies to a spot behind you, then he reforms and strikes
      if (!this.mistTo) { const back = tv.set(Math.sin(player.yaw), 0, Math.cos(player.yaw)); let to = player.pos.clone().addScaledVector(back, 3.5); if (!pointFree(to.x, to.z, 0.8, to.y + 0.1, to.y + 2.5)) to = player.pos.clone().addScaledVector(back, -4); this.mistTo = to; this.mistFrom = b.pos.clone(); }
      const u = 1 - Math.max(0, this.stateT) / 1.3;
      b.pos.lerpVectors(this.mistFrom, this.mistTo, smooth(u)); b.pos.y = Math.max(groundAt(b.pos.x, b.pos.z, b.pos.y + 3), lerp(this.mistFrom.y, this.mistTo.y, u)); b.vel.set(0, 0, 0);
      if (this.stateT <= 0) {
        this.mistTo = null; this.group.visible = true; this.bats.forEach(x => x.m.visible = false);
        this.state = 'windup'; this.stateT = 0.3; this.combo = 1; this.clawMat.opacity = 0.9; this.mistT = enraged ? 5 : 7.5;
        for (let i = 0; i < 30; i++) FX.spawn(tv.copy(b.pos).setY(b.pos.y + rand(0.5, 2.5)), randDir(tv2, rand(1, 3)), rand(.3, .6), .3, .02, COL.red, COL.redEnd, { drag: 2 });
        SFX.whoosh(b.pos);
      }
    } else if (this.state === 'drainAim' || this.state === 'drain') {
      b.vel.multiplyScalar(0.8); moveBody(b, dt, 0.6); this.face(dt, 8);
      this.center(tv); tv.y += 0.4; const to = playerAim(tv2);
      const blocked = segBlocked(tv, to);
      const d = tv.distanceTo(to);
      this.beam.position.lerpVectors(tv, to, 0.5); this.beam.lookAt(to); this.beam.scale.set(this.state === 'drain' ? 1 : 0.25, this.state === 'drain' ? 1 : 0.25, d);
      this.beam.material.opacity = blocked ? 0.1 : (this.state === 'drain' ? 0.75 + Math.sin(time * 30) * 0.15 : 0.35 + Math.sin(time * 20) * 0.25);
      this.arms[0].rotation.x = damp(this.arms[0].rotation.x, -1.6, 10, dt);
      if (this.state === 'drain' && !blocked) { const dmg = 13 * this.dmgMul * dt; hurtPlayer(dmg, b.pos, true); this.hp = Math.min(this.hpMax, this.hp + dmg * 1.2); this.healedT = 0.2; if (Math.random() < 0.5) FX.spawn(tv4.lerpVectors(to, tv, Math.random()), tv3.set(0, 0, 0), 0.3, 0.25, 0.02, COL.red, COL.redEnd, {}); }
      if (this.stateT <= 0) {
        if (this.state === 'drainAim') { this.state = 'drain'; this.stateT = 2; SFX.wail(this.pos); }
        else { this.state = 'walk'; this.drainT = enraged ? 6 : 8; this.beam.material.opacity = 0; }
      }
      if (blocked && this.state === 'drain' && this.stateT < 1.6) { this.state = 'walk'; this.drainT = 4; this.beam.material.opacity = 0; }
    }
    this.group.position.copy(b.pos);
    // animation
    const sp = Math.hypot(b.vel.x, b.vel.z);
    this.walkPh += dt * sp * 2;
    const sw = Math.sin(this.walkPh) * Math.min(1, sp / 2) * 0.45;
    this.legs[0].rotation.x = sw; this.legs[1].rotation.x = -sw;
    this.cape.rotation.x = damp(this.cape.rotation.x, 0.15 + Math.min(0.7, sp * 0.12) + Math.sin(this.t * 3) * 0.05, 6, dt);
    let a0 = -0.15 + sw * 0.4, a1 = -0.15 - sw * 0.4;
    if (this.state === 'windup') { a0 = -2.2; a1 = -2.2; }
    if (this.cast > 0) { a1 = -1.5; this.cast -= dt; }
    if (this.swing) { this.swing.t -= dt; const k = Math.max(0, this.swing.t / 0.22); if (this.swing.arm === 0) a0 = -2.2 + (1 - k) * 2.4; else a1 = -2.2 + (1 - k) * 2.4; if (this.swing.t <= 0) this.swing = null; }
    if (this.state !== 'drain' && this.state !== 'drainAim') this.arms[0].rotation.x = damp(this.arms[0].rotation.x, a0, 18, dt);
    this.arms[1].rotation.x = damp(this.arms[1].rotation.x, a1, 18, dt);
  }
}
BOSS_CLASSES.dracula = DraculaBoss;

// ---------------- candy corn ----------------
function addCandy(n, pos) {
  n = Math.round(n); if (n <= 0) return 0;
  profile.candy = (profile.candy || 0) + n; if (run.active) run.candy = (run.candy || 0) + n;
  saveProfile(); bus.emit('candy', { n, pos }); return n;
}
function spendCandy(n) { if ((profile.candy || 0) < n) return false; profile.candy -= n; saveProfile(); return true; }
function candyForKill(e, head) {
  if (!halloweenActive()) return 0;
  if (nightMode()) return e.isBoss ? 80 + 30 * (e.cycle || 0) : Math.max(1, Math.round((e.k.coins || 10) / 10)) + (head ? 1 : 0);
  return Math.random() < 0.1 ? 1 : 0;
}

// ---------------- Halloween quests ----------------
// Trick-or-Treat quests pay candy corn. The Reaper's Contract is a longer quest line that awards Reaper's Eye.
const H_QUESTS = [
  { id: 'hz', name: 'Zombie walk', desc: 'Destroy 120 zombies.', goal: 120, kind: 'h_zombie', candy: 150 },
  { id: 'hs', name: 'Bag of bones', desc: 'Destroy 100 skeleton archers.', goal: 100, kind: 'h_skeleton', candy: 150 },
  { id: 'hp', name: 'Smash the patch', desc: 'Destroy 40 pumpkin bombers.', goal: 40, kind: 'h_pumpkin', candy: 120 },
  { id: 'hw', name: 'Witch hunt', desc: 'Destroy 30 witches.', goal: 30, kind: 'h_witch', candy: 150 },
  { id: 'hb', name: 'Bat swatter', desc: 'Destroy 60 vampire bats or ghosts.', goal: 60, kinds: ['h_bat', 'h_ghost'], candy: 120 },
  { id: 'hd', name: 'Stake through the heart', desc: 'Defeat Dracula 3 times.', goal: 3, ev: 'dracula', candy: 400 },
  { id: 'hn', name: 'Night shift', desc: 'Reach wave 15 in Night of Terror.', goal: 15, ev: 'nightWave', max: true, candy: 300 },
];
const REAPER_STEPS = [
  { id: 'souls', name: 'Harvest 350 souls', desc: 'Destroy monsters in Night of Terror.', goal: 350 },
  { id: 'heads', name: 'Take 50 heads', desc: 'Headshot kills in Night of Terror.', goal: 50 },
  { id: 'wave', name: 'Outlast the night', desc: 'Reach wave 10 in Night of Terror.', goal: 10, max: true },
  { id: 'dracula', name: 'Face the Count', desc: 'Defeat Dracula once.', goal: 1 },
];
function hqState(id) { const q = profile.hq || (profile.hq = {}); return q[id] || (q[id] = { p: 0, done: false }); }
function contract() { return profile.contract || (profile.contract = { souls: 0, heads: 0, wave: 0, dracula: 0, done: false }); }
function contractProgress() { const c = contract(); return REAPER_STEPS.reduce((s, st) => s + Math.min(1, c[st.id] / st.goal), 0) / REAPER_STEPS.length; }
function bumpContract(step, amount, max) {
  const c = contract(); if (c.done) return;
  const st = REAPER_STEPS.find(s => s.id === step);
  const before = c[step];
  c[step] = max ? Math.max(c[step], amount) : c[step] + amount;
  if (before < st.goal && c[step] >= st.goal) ui.toast("Reaper's Contract", `Step complete: ${st.name}`, 'quest');
  if (REAPER_STEPS.every(s => c[s.id] >= s.goal)) {
    c.done = true; profile.weapons.reaper = true; saveProfile();
    SFX.levelUp(); ui.banner("Reaper's Eye unlocked", 'The contract is sealed. Equip it in your loadout.', 3.5, true);
    ui.toast("Reaper's Eye", 'Halloween sniper with Fever and a built-in scope', 'drop');
  }
}
// called from questEvent for every progress event while the event is running
function halloweenEvent(ev, amount, extra) {
  if (!halloweenActive()) return;
  const night = nightMode();
  for (const q of H_QUESTS) {
    const st = hqState(q.id); if (st.done) continue;
    let add = 0;
    if (q.kind || q.kinds) { if (ev === 'killType' && night && (q.kind === extra.kind || (q.kinds && q.kinds.includes(extra.kind)))) add = amount; }
    else if (q.ev === ev) add = amount;
    if (!add) continue;
    st.p = q.max ? Math.max(st.p, add) : st.p + add;
    if (st.p >= q.goal) { st.p = q.goal; st.done = true; addCandy(q.candy); bus.emit('quest', { q: { name: `Trick or treat: ${q.name}` }, text: `${q.candy} candy corn` }); }
  }
  if (!night) return;
  if (ev === 'kill') bumpContract('souls', amount);
  else if (ev === 'headshot') bumpContract('heads', amount);
  else if (ev === 'nightWave') bumpContract('wave', amount, true);
  else if (ev === 'dracula') bumpContract('dracula', amount);
}

// ---------------- the special weapons ----------------
// Fever (Reaper's Eye): kills within 5 s of each other stack damage; Lifesteal and Thirst (Vampire's Fang).
const FEVER_WINDOW = 5, FEVER_MAX = 10, FEVER_PER = 0.12;
function feverActive() { return loadout.includes('reaper'); }
function onFeverKill(weapon) {
  if (!feverActive() || !run.active) return;
  run.fever = Math.min(FEVER_MAX, (run.fever || 0) + 1); run.feverT = FEVER_WINDOW;
  if (weapon === 'reaper') { const i = loadout.indexOf('reaper'), am = ammo[i]; if (am && am.mag < magCap('reaper')) am.mag++; }
  if (run.fever === FEVER_MAX) ui.streak('Fever: maximum');
}
function updateFever(dt) { if (run.feverT > 0) { run.feverT -= dt; if (run.feverT <= 0) { run.feverT = 0; if (run.fever >= 3) ui.toast('Fever faded', 'Five seconds without a kill'); run.fever = 0; } } }
function weaponDamageMul(weapon) {
  let m = 1;
  if (weapon === 'reaper') m *= 1 + FEVER_PER * (run.fever || 0);
  if (weapon === 'fang' && player.hp < maxHp() / 2) m *= 1.25;
  return m;
}
function lifesteal(weapon, dealt) { if (weapon === 'fang' && player.alive && dealt > 0) player.hp = Math.min(maxHp(), player.hp + dealt * 0.12); }
// Dracula has a 1 in 3 chance to drop the Fang, guaranteed by your third win
function draculaDrop() {
  if (weaponOwned('fang')) return null;
  profile.fangPity = (profile.fangPity || 0) + 1;
  if (Math.random() < 0.34 || profile.fangPity >= 3) { profile.weapons.fang = true; saveProfile(); return "Vampire's Fang"; }
  saveProfile(); return null;
}

// ---------------- map dressing ----------------
const HALLOWEEN_THEME = { fog: [0x1a0e1c, 26, 150], sky: [0x05030a, 0x2a0e24, 0x8a2a14], sunCol: 0xff6a2a, sunDir: [-0.4, 0.42, -0.8], sun: [0xb0a0ff, 0.9], hemi: [0x6a5a9a, 0x1a0e10, 0.55], fill: 0.25, exposure: 1.15, stars: 1 };
const HM = {
  pumpkin: new THREE.MeshStandardMaterial({ color: 0xe8761c, roughness: 0.55, emissive: 0x401400, emissiveIntensity: 0.6 }),
  rib: new THREE.MeshStandardMaterial({ color: 0xc85e14, roughness: 0.6, emissive: 0x2a0c00, emissiveIntensity: 0.5 }),
  stem: new THREE.MeshStandardMaterial({ color: 0x4a5a20, roughness: 0.9 }),
  face: new THREE.MeshBasicMaterial({ color: 0xffb030 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x6a6c70, roughness: 0.95 }),
  moss: new THREE.MeshStandardMaterial({ color: 0x3a4a2a, roughness: 1 }),
  bark: new THREE.MeshStandardMaterial({ color: 0x2a1e18, roughness: 1 }),
  candle: new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.8 }),
  flame: new THREE.MeshBasicMaterial({ color: 0xffc060 }),
  web: null,
};
{ const [c, g] = cv(256, 256); g.strokeStyle = 'rgba(235,235,245,.8)'; g.lineWidth = 1.4; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 256, Math.sin(a) * 256); g.stroke(); } for (let r = 20; r < 256; r += 22) { g.beginPath(); for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI / 2, rr = r + (i % 2) * 4; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.stroke(); }
  const t = tex(c, 1, 1); HM.web = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.75 }); }

function jackOLantern(x, y, z, s, rotY, light) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; g.scale.setScalar(s);
  const body = new THREE.Mesh(GEOM.sphere(0.4, 16, 12), HM.pumpkin); body.scale.set(1.15, 0.85, 1.1); body.position.y = 0.34; body.castShadow = true; g.add(body);
  for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(GEOM.sphere(0.4, 12, 10), HM.rib); r.scale.set(0.4, 0.86, 1.12); r.rotation.y = i / 6 * Math.PI; r.position.y = 0.34; g.add(r); }
  const stem = new THREE.Mesh(GEOM.cyl(0.04, 0.06, 0.16, 6), HM.stem); stem.position.y = 0.72; stem.rotation.z = 0.2; g.add(stem);
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(GEOM.cone(0.07, 0.11, 3), HM.face); e.rotation.x = Math.PI / 2; e.position.set(sx * 0.14, 0.42, 0.42); g.add(e); }
  const mouth = new THREE.Mesh(GEOM.box(0.34, 0.08, 0.02), HM.face); mouth.position.set(0, 0.24, 0.43); g.add(mouth);
  for (let i = 0; i < 3; i++) { const tooth = new THREE.Mesh(GEOM.box(0.05, 0.05, 0.03), HM.pumpkin); tooth.position.set(-0.1 + i * 0.1, 0.27, 0.43); g.add(tooth); }
  world.group.add(g);
  if (light) { const l = pointLamp(x, y + 0.5 * s, z, 0xff8a2a, 1.4, 12, 2.2); world.anim.push((dt, t) => { l.intensity = 1.2 + Math.sin(t * 9 + x) * 0.15 + Math.sin(t * 23 + z) * 0.1; }); }
}
function gravestone(x, z, rotY) {
  const y = groundAt(x, z, 0.5);
  const w = rand(0.7, 0.95), h = rand(0.9, 1.3);
  block(x, y, z, w, h * 0.75, 0.22, HM.stone, { rotY, collide: true });
  // a half-disc cap: turn the cylinder's axis to face forward, then swing the arc upward
  const topGeo = new THREE.CylinderGeometry(w / 2, w / 2, 0.22, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2);
  const top = new THREE.Mesh(topGeo, HM.stone); top.position.set(x, y + h * 0.75, z); top.rotation.y = rotY; top.castShadow = true; world.group.add(top);
  const moss = new THREE.Mesh(GEOM.box(w * 0.9, 0.06, 0.3), HM.moss); moss.position.set(x, y + 0.03, z); moss.rotation.y = rotY; world.group.add(moss);
  if (Math.random() < 0.45) { const c = new THREE.Mesh(GEOM.cyl(0.035, 0.035, 0.16, 8), HM.candle); c.position.set(x + Math.cos(rotY) * 0.25, y + 0.08, z - Math.sin(rotY) * 0.25 + 0.2); world.group.add(c); const f = new THREE.Mesh(GEOM.cone(0.02, 0.06, 6), HM.flame); f.position.copy(c.position).setY(y + 0.2); world.group.add(f); world.anim.push((dt, t) => { f.scale.y = 0.8 + Math.sin(t * 17 + x) * 0.25; }); }
}
function deadTree(x, z) {
  const y = groundAt(x, z, 0.5), h = rand(4, 6.5);
  cylinder(x, y, z, 0.22, h, HM.bark, { r2: 0.1, seg: 7 });
  for (let i = 0; i < 5; i++) {
    const br = new THREE.Mesh(GEOM.cyl(0.03, 0.08, rand(1.2, 2.2), 5), HM.bark); const a = rand(0, Math.PI * 2), hy = y + h * rand(0.45, 0.95);
    br.position.set(x + Math.cos(a) * 0.5, hy, z + Math.sin(a) * 0.5); br.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); br.castShadow = true; world.group.add(br);
  }
}
function decorateHalloween(m) {
  const half = world.half, floor = world.floor || 0, ps = m.playerSpawn || [0, 0, 0];
  const spots = (n, minR, maxR, clear) => { const out = []; for (let i = 0; i < n * 12 && out.length < n; i++) { const a = rand(0, Math.PI * 2), r = rand(minR, maxR), x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.abs(x) > half - 3 || Math.abs(z) > half - 3) continue; if (!pointFree(x, z, clear, floor + 0.05, floor + 2.5) || groundAt(x, z, 1) !== floor) continue; if (Math.hypot(x - ps[0], z - ps[2]) < 5) continue; out.push([x, z]); } return out; };
  const scale = half / 60;
  // jack-o'-lanterns: a few light the ground, the rest just glow
  spots(Math.round(16 * scale) + 6, 4, half - 4, 0.6).forEach(([x, z], i) => jackOLantern(x, floor, z, rand(0.8, 1.3), Math.atan2(-x, -z) + rand(-0.4, 0.4), i < 4));
  // graveyard rows
  for (const [cx, cz] of spots(3, half * 0.3, half * 0.8, 3.5)) for (let i = 0; i < 6; i++) { const x = cx + (i % 3 - 1) * 1.8 + rand(-0.2, 0.2), z = cz + (Math.floor(i / 3) - 0.5) * 2.2; if (pointFree(x, z, 0.6, floor + 0.05, floor + 1.5)) gravestone(x, z, rand(-0.25, 0.25)); }
  spots(Math.round(5 * scale) + 3, half * 0.35, half - 4, 1.6).forEach(([x, z]) => deadTree(x, z));
  // cobwebs in the corners of the perimeter walls
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const wbm = new THREE.Mesh(GEOM.plane(4, 4), HM.web); wbm.position.set(sx * (half - 2.5), floor + 3.2, sz * (half - 2.5)); wbm.rotation.y = Math.atan2(-sx, -sz) + Math.PI; wbm.rotation.x = -0.3; world.group.add(wbm); }
  // ground mist and ambient bats under the blood moon
  for (const [x, z] of spots(10, 0, half - 4, 0.5)) emitter(new V3(x, floor + 0.1, z), 0.8, p => SMOKE.spawn(p, tv.set(rand(-0.4, 0.4), 0.05, rand(-0.4, 0.4)), rand(4, 7), rand(1.5, 2.5), rand(4, 6), COL.purple, COL.smokeEnd, { drag: 0.5, alpha: 0.12, grav: 0 }));
  const flock = [];
  for (let i = 0; i < 10; i++) { const b = new THREE.Mesh(GEOM.box(0.5, 0.02, 0.18), new THREE.MeshBasicMaterial({ color: 0x050307 })); world.group.add(b); flock.push({ m: b, a: rand(0, 6.28), r: rand(8, half * 0.7), y: rand(10, 18), s: rand(0.3, 0.6) * (Math.random() < 0.5 ? 1 : -1) }); }
  world.anim.push((dt, t) => { for (const f of flock) { f.a += dt * f.s; f.m.position.set(Math.cos(f.a) * f.r, f.y + Math.sin(t * 2 + f.r) * 0.6, Math.sin(f.a) * f.r); f.m.rotation.y = -f.a; f.m.scale.x = 0.5 + Math.abs(Math.sin(t * 16 + f.r)) * 0.9; } });
}
