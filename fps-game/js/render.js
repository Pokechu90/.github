'use strict';
// Renderer, scenes, procedural textures, particles, tracers, decals, collision and damage numbers.

if (typeof THREE === 'undefined') { document.body.innerHTML = '<p style="padding:24px;color:#eee">Could not load the 3D engine. Check your connection and reload.</p>'; throw new Error('three missing'); }

const renderer = new THREE.WebGLRenderer({ antialias: QUALITY[settings.quality].aa, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY[settings.quality].pixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = QUALITY[settings.quality].shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;
$('#game').appendChild(renderer.domElement);
const maxAniso = renderer.capabilities.getMaxAnisotropy();

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x3b3440, 45, 210);
const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 700);
camera.rotation.order = 'YXZ';
const vmScene = new THREE.Scene();
const vmCamera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.01, 10);

// ---------------- textures ----------------
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rx = 1, ry = rx, srgb = true) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = maxAniso; if (srgb) t.encoding = THREE.sRGBEncoding; return t; }
function wrap9(w, h, fn) { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) fn(i * w, j * h); }
function speckle(g, w, h, n, cols, sz, amax = 0.35) { for (let i = 0; i < n; i++) { g.globalAlpha = Math.random() * amax; g.fillStyle = cols[(Math.random() * cols.length) | 0]; const s = Math.random() * sz + 0.5; g.fillRect(Math.random() * w, Math.random() * h, s, s); } g.globalAlpha = 1; }
function stains(g, w, h, n, col, rmin, rmax) { for (let i = 0; i < n; i++) { const x = Math.random() * w, y = Math.random() * h, r = rand(rmin, rmax); wrap9(w, h, (ox, oy) => { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); }); } }
function cracks(g, n, col, len = 22) { g.strokeStyle = col; g.lineWidth = 1; for (let k = 0; k < n; k++) { let x = Math.random() * 512, y = Math.random() * 512; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < len; s++) { x += rand(-9, 9); y += rand(-9, 9); g.lineTo(x, y); } g.stroke(); } }

const T = {};
{ const [c, g] = cv(512, 512); g.fillStyle = '#6f7274'; g.fillRect(0, 0, 512, 512); stains(g, 512, 512, 30, 'rgba(35,32,30,.22)', 30, 110); stains(g, 512, 512, 12, 'rgba(160,160,150,.12)', 40, 90); speckle(g, 512, 512, 14000, ['#55585a', '#8d9092', '#474a4c', '#9a9c9a'], 2.2); cracks(g, 7, 'rgba(25,25,25,.45)'); g.fillStyle = 'rgba(20,20,20,.55)'; g.fillRect(0, 0, 512, 3); g.fillRect(0, 0, 3, 512); T.concrete = c; }
{ const [c, g] = cv(512, 512); g.fillStyle = '#48525a'; g.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 128) { const gr = g.createLinearGradient(x, 0, x + 128, 0); gr.addColorStop(0, 'rgba(255,255,255,.07)'); gr.addColorStop(.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.18)'); g.fillStyle = gr; g.fillRect(x, 0, 128, 512); g.fillStyle = 'rgba(10,12,14,.8)'; g.fillRect(x, 0, 3, 512); }
  g.fillStyle = 'rgba(10,12,14,.8)'; g.fillRect(0, 254, 512, 4); g.fillRect(0, 0, 512, 3);
  for (let x = 0; x < 512; x += 128) for (let y = 14; y < 512; y += 42) { g.fillStyle = '#2a3035'; g.beginPath(); g.arc(x + 10, y, 3, 0, 7); g.fill(); if (Math.random() < .25) { const gr = g.createLinearGradient(0, y, 0, y + rand(40, 140)); gr.addColorStop(0, 'rgba(120,60,25,.5)'); gr.addColorStop(1, 'rgba(120,60,25,0)'); g.fillStyle = gr; g.fillRect(x + 8, y, rand(3, 7), 140); } }
  speckle(g, 512, 512, 5000, ['#3a4248', '#5b666e', '#6b4a33'], 2); stains(g, 512, 512, 10, 'rgba(20,20,20,.2)', 40, 120); T.wall = c; }
{ const [c, g] = cv(256, 256); g.fillStyle = '#56603f'; g.fillRect(0, 0, 256, 256); speckle(g, 256, 256, 3000, ['#46502f', '#6a7550', '#3a4226'], 2); g.strokeStyle = '#3b4328'; g.lineWidth = 18; g.strokeRect(9, 9, 238, 238); g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2; g.strokeRect(2, 2, 252, 252); g.strokeRect(19, 19, 218, 218); g.lineWidth = 12; g.strokeStyle = '#4a5334'; g.beginPath(); g.moveTo(20, 20); g.lineTo(236, 236); g.stroke(); g.fillStyle = 'rgba(15,15,10,.6)'; g.font = 'bold 34px monospace'; g.textAlign = 'center'; g.fillText('FB-07', 128, 118); g.font = 'bold 16px monospace'; g.fillText('SECTOR 9 · 480 KG', 128, 150); T.crate = c; }
{ const [c, g] = cv(512, 256); g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 512, 256); for (let x = 0; x < 512; x += 24) { const gr = g.createLinearGradient(x, 0, x + 24, 0); gr.addColorStop(0, '#f2f2f2'); gr.addColorStop(.45, '#c9c9c9'); gr.addColorStop(.55, '#9a9a9a'); gr.addColorStop(1, '#e0e0e0'); g.fillStyle = gr; g.fillRect(x, 12, 24, 232); } g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, 512, 12); g.fillRect(0, 244, 512, 12); speckle(g, 512, 256, 3500, ['#6b5040', '#8a6a55', '#555'], 3, 0.4); stains(g, 512, 256, 8, 'rgba(90,55,35,.35)', 15, 60); g.fillStyle = 'rgba(255,255,255,.75)'; g.font = 'bold 22px monospace'; g.fillText('FBXU 204917 3', 26, 52); g.font = '14px monospace'; g.fillText('MAX GROSS 30,480 KG', 26, 74); T.container = c; }
{ const [c, g] = cv(256, 256); g.fillStyle = '#a3281c'; g.fillRect(0, 0, 256, 256); speckle(g, 256, 256, 2000, ['#7a1c12', '#c04030', '#3a2a20'], 2); g.fillStyle = '#6e1a12'; g.fillRect(0, 40, 256, 8); g.fillRect(0, 208, 256, 8);
  for (let x = -40; x < 300; x += 28) { g.fillStyle = '#e2ad1e'; g.beginPath(); g.moveTo(x, 104); g.lineTo(x + 14, 104); g.lineTo(x + 34, 152); g.lineTo(x + 20, 152); g.fill(); }
  g.fillStyle = '#16140f'; for (let x = -26; x < 300; x += 28) { g.beginPath(); g.moveTo(x, 104); g.lineTo(x + 14, 104); g.lineTo(x + 34, 152); g.lineTo(x + 20, 152); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,.85)'; g.font = 'bold 20px monospace'; g.textAlign = 'center'; g.fillText('FLAMMABLE', 64, 188); g.fillText('FLAMMABLE', 192, 188); T.drum = c; }
{ const [c, g] = cv(256, 64); g.fillStyle = '#e0a91c'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#18160f'; for (let x = -64; x < 320; x += 48) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 24, 64); g.lineTo(x + 88, 0); g.lineTo(x + 64, 0); g.fill(); } speckle(g, 256, 64, 800, ['#000', '#fff'], 2, .2); T.hazard = c; }
{ const [c, g] = cv(256, 512); g.fillStyle = '#0a0d12'; g.fillRect(0, 0, 256, 512); for (let y = 6; y < 512; y += 16) for (let x = 6; x < 256; x += 14) { const r = Math.random(); if (r < .28) { g.fillStyle = r < .05 ? '#9fd0ff' : (r < .2 ? '#ffc56a' : '#e08a3a'); g.globalAlpha = rand(.5, 1); g.fillRect(x, y, 8, 9); } } g.globalAlpha = 1; T.windows = c; }
{ const [c, g] = cv(256, 256); g.fillStyle = '#5d6469'; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 12) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y, 256, 2); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, y + 2, 256, 2); } speckle(g, 256, 256, 1200, ['#3a3f42', '#7a6040'], 2); T.door = c; }
{ const [c, g] = cv(512, 512); g.fillStyle = '#c9a877'; g.fillRect(0, 0, 512, 512); stains(g, 512, 512, 40, 'rgba(150,110,60,.25)', 30, 120); stains(g, 512, 512, 30, 'rgba(240,215,170,.22)', 30, 100); speckle(g, 512, 512, 16000, ['#b08e5c', '#dcc093', '#8f7048', '#e8d2a8'], 1.8); g.strokeStyle = 'rgba(120,90,50,.12)'; g.lineWidth = 3; for (let i = 0; i < 16; i++) { g.beginPath(); const y = rand(0, 512); g.moveTo(0, y); for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x / 50 + i) * 8); g.stroke(); } T.sand = c; }
{ const [c, g] = cv(512, 512); g.fillStyle = '#5b5a57'; g.fillRect(0, 0, 512, 512); speckle(g, 512, 512, 30000, ['#3f3e3b', '#7c7a75', '#8e8b84', '#2f2e2c'], 3, 0.6); stains(g, 512, 512, 14, 'rgba(20,20,20,.25)', 30, 90); T.gravel = c; }
{ const [c, g] = cv(256, 256); g.fillStyle = '#c9ced2'; g.fillRect(0, 0, 256, 256); for (let i = 0; i <= 256; i += 64) { g.fillStyle = '#8e969c'; g.fillRect(i - 1, 0, 2, 256); g.fillRect(0, i - 1, 256, 2); } speckle(g, 256, 256, 2500, ['#b4babe', '#dfe3e6'], 2, .3); stains(g, 256, 256, 5, 'rgba(60,70,80,.12)', 20, 60); T.tile = c; }
{ const [c, g] = cv(512, 512); g.fillStyle = '#6a4636'; g.fillRect(0, 0, 512, 512); stains(g, 512, 512, 50, 'rgba(150,70,30,.35)', 20, 90); stains(g, 512, 512, 20, 'rgba(40,30,25,.4)', 30, 120); speckle(g, 512, 512, 12000, ['#8a5a3a', '#4a3024', '#a8703f', '#2f2622'], 2.4, .5); for (let x = 0; x < 512; x += 64) { g.fillStyle = 'rgba(20,14,10,.55)'; g.fillRect(x, 0, 3, 512); } T.rust = c; }
{ const [c, g] = cv(512, 512); g.fillStyle = '#d7dde0'; g.fillRect(0, 0, 512, 512); for (let x = 0; x < 512; x += 128) { g.fillStyle = '#a9b2b8'; g.fillRect(x, 0, 2, 512); } g.fillRect(0, 0, 512, 2); g.fillRect(0, 300, 512, 2); g.fillStyle = '#2a8f9a'; g.fillRect(0, 300, 512, 14); g.fillStyle = 'rgba(20,30,35,.7)'; g.font = 'bold 26px monospace'; g.fillText('SUBLEVEL 4', 30, 350); speckle(g, 512, 512, 3000, ['#bfc7cc', '#eef2f4'], 2, .3); T.labwall = c; }
{ const [c, g] = cv(128, 256); g.fillStyle = '#12161b'; g.fillRect(0, 0, 128, 256); for (let y = 8; y < 256; y += 16) { g.fillStyle = '#1d242b'; g.fillRect(6, y, 116, 12); for (let x = 12; x < 100; x += 8) if (Math.random() < .5) { g.fillStyle = pick(['#39ff9a', '#2ad0ff', '#ffb13b', '#39ff9a']); g.fillRect(x, y + 4, 3, 3); } } T.rack = c; }
{ const [c, g] = cv(256, 256); g.fillStyle = '#2f3a2a'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 90; i++) { g.fillStyle = pick(['#46553a', '#3b4a30', '#5b6b45', '#262f21']); g.beginPath(); g.ellipse(rand(0, 256), rand(0, 256), rand(8, 26), rand(5, 14), rand(0, 3), 0, 7); g.fill(); } T.camo = c; }
{ const [c, g] = cv(512, 256); g.fillStyle = '#0c0e18'; g.fillRect(0, 0, 512, 256); const grd = g.createLinearGradient(0, 0, 512, 0); grd.addColorStop(0, '#ff2e88'); grd.addColorStop(1, '#2ee6ff'); g.fillStyle = grd; g.font = 'bold 72px sans-serif'; g.textAlign = 'center'; g.fillText('NOVA COLA', 256, 120); g.font = '28px sans-serif'; g.fillStyle = '#fff'; g.fillText('Taste the voltage', 256, 180); T.billboard = c; }
{ const [c, g] = cv(64, 64); let gr = g.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(0,0,0,.95)'); gr.addColorStop(.18, 'rgba(10,10,10,.9)'); gr.addColorStop(.3, 'rgba(40,40,40,.5)'); gr.addColorStop(1, 'rgba(40,40,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); g.strokeStyle = 'rgba(0,0,0,.5)'; for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28; g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + Math.cos(a) * rand(10, 22), 32 + Math.sin(a) * rand(10, 22)); g.stroke(); } T.hole = c; }
{ const [c, g] = cv(128, 128); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.85)'); gr.addColorStop(.5, 'rgba(10,8,6,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); T.scorch = c; }
{ const [c, g] = cv(64, 64); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); T.spark = c; }
{ const [c, g] = cv(64, 64); for (let i = 0; i < 14; i++) { const x = 32 + rand(-9, 9), y = 32 + rand(-9, 9), r = rand(10, 22); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); } T.smoke = c; }
{ const [c, g] = cv(128, 128); g.translate(64, 64); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) { g.rotate(Math.PI * 2 / 7 + rand(-.2, .2)); const len = rand(40, 62); const gr = g.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(.4, 'rgba(255,170,60,.8)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, -5); g.lineTo(len, 0); g.lineTo(0, 5); g.fill(); }
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 30); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(.5, 'rgba(255,190,90,.7)'); gr.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 30, 0, 7); g.fill(); T.flash = c; }
{ const [c, g] = cv(64, 64); g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(32, 32, 26, 0, 7); g.stroke(); g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 14, 0, 7); g.stroke(); T.ring = c; }

const glowTex = tex(T.spark, 1, 1, false);
const M = {
  ground: new THREE.MeshStandardMaterial({ map: tex(T.concrete, 60), roughness: 0.92, metalness: 0.02 }),
  concrete: new THREE.MeshStandardMaterial({ map: tex(T.concrete, 1), roughness: 0.9 }),
  wall: new THREE.MeshStandardMaterial({ map: tex(T.wall, 1), roughness: 0.62, metalness: 0.45 }),
  crate: new THREE.MeshStandardMaterial({ map: tex(T.crate, 1), roughness: 0.8 }),
  hazard: new THREE.MeshStandardMaterial({ map: tex(T.hazard, 1), roughness: 0.6 }),
  door: new THREE.MeshStandardMaterial({ map: tex(T.door, 1), roughness: 0.55, metalness: 0.5 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x1d2226, roughness: 0.7, metalness: 0.5 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x5e676e, roughness: 0.4, metalness: 0.8 }),
  drum: new THREE.MeshStandardMaterial({ map: tex(T.drum, 1), roughness: 0.45, metalness: 0.4 }),
  city: new THREE.MeshStandardMaterial({ color: 0x151a22, roughness: 1, emissive: 0xffffff, emissiveMap: tex(T.windows, 1), emissiveIntensity: 0.9 }),
  sand: new THREE.MeshStandardMaterial({ map: tex(T.sand, 50), roughness: 1 }),
  sandBlock: new THREE.MeshStandardMaterial({ map: tex(T.sand, 1), roughness: 1, color: 0xd8c29a }),
  gravel: new THREE.MeshStandardMaterial({ map: tex(T.gravel, 30), roughness: 1 }),
  tile: new THREE.MeshStandardMaterial({ map: tex(T.tile, 40), roughness: 0.35, metalness: 0.1 }),
  rust: new THREE.MeshStandardMaterial({ map: tex(T.rust, 1), roughness: 0.8, metalness: 0.55 }),
  labwall: new THREE.MeshStandardMaterial({ map: tex(T.labwall, 1), roughness: 0.5, metalness: 0.1 }),
  rack: new THREE.MeshStandardMaterial({ map: tex(T.rack, 1), roughness: 0.5, metalness: 0.6, emissive: 0xffffff, emissiveMap: tex(T.rack, 1), emissiveIntensity: 0.9 }),
  camo: new THREE.MeshStandardMaterial({ map: tex(T.camo, 1), roughness: 1, side: THREE.DoubleSide }),
  billboard: new THREE.MeshBasicMaterial({ map: tex(T.billboard, 1, 1) }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false }),
  lampGlow: new THREE.MeshBasicMaterial({ color: 0xffd08a }),
  stripGlow: new THREE.MeshBasicMaterial({ color: 0xffa648 }),
  redGlow: new THREE.MeshBasicMaterial({ color: 0xff3020 }),
  cyanGlow: new THREE.MeshBasicMaterial({ color: 0x5ff2ff }),
  greenGlow: new THREE.MeshBasicMaterial({ color: 0x5dff9a, transparent: true, opacity: 0.55 }),
  whiteGlow: new THREE.MeshBasicMaterial({ color: 0xeaf6ff }),
  magentaGlow: new THREE.MeshBasicMaterial({ color: 0xff3ea5 }),
};
const containerColors = [0x9a3a28, 0x2d5f86, 0x2f7362, 0xc0692a, 0x6b6f75, 0x7a2f4a];
const containerMats = containerColors.map(c => new THREE.MeshStandardMaterial({ map: tex(T.container, 1), color: c, roughness: 0.55, metalness: 0.5 }));

// ---------------- lighting / sky (configured per map) ----------------
const sunDir = new V3(-0.55, 0.32, -0.77).normalize();
const hemi = new THREE.HemisphereLight(0x7d8fb5, 0x2a2018, 0.62); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffb27a, 2.1);
sun.castShadow = QUALITY[settings.quality].shadows;
sun.shadow.mapSize.set(QUALITY[settings.quality].shadowSize, QUALITY[settings.quality].shadowSize);
Object.assign(sun.shadow.camera, { left: -85, right: 85, top: 85, bottom: -85, near: 10, far: 320 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
scene.add(sun); scene.add(sun.target);
const fill = new THREE.DirectionalLight(0x6a86c8, 0.35); fill.position.set(60, 40, 80); scene.add(fill);
const skyUniforms = { top: { value: new THREE.Color(0x0a1424) }, mid: { value: new THREE.Color(0x3d3452) }, hor: { value: new THREE.Color(0xd36f38) }, sd: { value: sunDir }, sunCol: { value: new THREE.Color(0xff8c3a) }, stars: { value: 1 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top, mid, hor, sd, sunCol; uniform float stars; varying vec3 vD;
    float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){ float h = vD.y; vec3 c = mix(hor, mid, smoothstep(0.0, 0.16, h)); c = mix(c, top, smoothstep(0.12, 0.65, h));
      c = mix(c, hor * 0.25, smoothstep(0.0, -0.15, h));
      float s = max(dot(vD, sd), 0.0); c += sunCol * pow(s, 18.0) * 0.8 + vec3(1.0,0.9,0.75) * pow(s, 1200.0) * 5.0;
      vec2 g = floor(vD.xz / (vD.y + 0.3) * 260.0); float st = step(0.9975, h21(g)) * smoothstep(0.25, 0.6, h) * stars; c += vec3(st) * 0.8;
      gl_FragColor = vec4(c, 1.0); }`
}));
scene.add(sky);

function applyQuality() {
  const q = QUALITY[settings.quality];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
  renderer.setSize(innerWidth, innerHeight);
  const wasShadows = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = q.shadows; sun.castShadow = q.shadows && !!(world.map && world.map.sunShadows !== false);
  if (sun.shadow.mapSize.x !== q.shadowSize) { sun.shadow.mapSize.set(q.shadowSize, q.shadowSize); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  if (wasShadows !== q.shadows) scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
}

// ---------------- world state (filled by maps.js) ----------------
const world = { colliders: [], levelMeshes: [], barrels: [], group: null, map: null, half: 72, ceiling: Infinity, spawnPoints: [], playerSpawn: new V3(0, 0, 20), anim: [], emitters: [] };

// ---------------- particles ----------------
class Particles {
  constructor(max, blending, texCanvas) {
    this.max = max; this.i = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max); this.a0 = new Float32Array(max);
    this.c0 = new Float32Array(max * 3); this.c1 = new Float32Array(max * 3); this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.bounce = new Uint8Array(max);
    const A = (arr, n) => { const a = new THREE.BufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    g.setAttribute('position', A(this.pos, 3)); g.setAttribute('pcolor', A(this.col, 3)); g.setAttribute('psize', A(this.size, 1)); g.setAttribute('palpha', A(this.alpha, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex(texCanvas, 1, 1, false) }, uScale: { value: innerHeight * 0.5 } },
      vertexShader: `attribute vec3 pcolor; attribute float psize; attribute float palpha; uniform float uScale; varying vec3 vC; varying float vA;
        void main(){ vC = pcolor; vA = palpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = psize * projectionMatrix[1][1] * uScale / max(-mv.z, 0.1); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * t.rgb, t.a * vA); if(gl_FragColor.a < 0.003) discard; }`,
      transparent: true, depthWrite: false, blending
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.geo = g; scene.add(this.pts);
    this.active = 0;
  }
  spawn(p, v, life, s0, s1, c0, c1, o = {}) {
    if (Math.random() > QUALITY[settings.quality].particles && !o.force) return;
    const i = this.i; this.i = (this.i + 1) % this.max;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.life[i] = life; this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = o.alpha ?? 1;
    this.c0[i * 3] = c0.r; this.c0[i * 3 + 1] = c0.g; this.c0[i * 3 + 2] = c0.b;
    this.c1[i * 3] = c1.r; this.c1[i * 3 + 1] = c1.g; this.c1[i * 3 + 2] = c1.b;
    this.grav[i] = o.grav ?? 0; this.drag[i] = o.drag ?? 0; this.bounce[i] = o.bounce ? 1 : 0;
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { if (this.alpha[i] !== 0) { this.alpha[i] = 0; this.size[i] = 0; } continue; }
      this.life[i] -= dt; const t = 1 - Math.max(this.life[i], 0) / this.maxLife[i];
      const k = Math.exp(-this.drag[i] * dt), j = i * 3;
      this.vel[j] *= k; this.vel[j + 1] = this.vel[j + 1] * k - this.grav[i] * dt; this.vel[j + 2] *= k;
      this.pos[j] += this.vel[j] * dt; this.pos[j + 1] += this.vel[j + 1] * dt; this.pos[j + 2] += this.vel[j + 2] * dt;
      if (this.bounce[i] && this.pos[j + 1] < 0.02) { this.pos[j + 1] = 0.02; this.vel[j + 1] *= -0.35; this.vel[j] *= 0.6; this.vel[j + 2] *= 0.6; }
      this.size[i] = lerp(this.s0[i], this.s1[i], t);
      this.alpha[i] = this.a0[i] * (t < 0.1 ? t / 0.1 * 0.5 + 0.5 : 1 - (t - 0.1) / 0.9);
      this.col[j] = lerp(this.c0[j], this.c1[j], t); this.col[j + 1] = lerp(this.c0[j + 1], this.c1[j + 1], t); this.col[j + 2] = lerp(this.c0[j + 2], this.c1[j + 2], t);
    }
    const a = this.geo.attributes; a.position.needsUpdate = a.pcolor.needsUpdate = a.psize.needsUpdate = a.palpha.needsUpdate = true;
  }
}
const FX = new Particles(3500, THREE.AdditiveBlending, T.spark);
const SMOKE = new Particles(1000, THREE.NormalBlending, T.smoke);
SMOKE.pts.renderOrder = 1; FX.pts.renderOrder = 2;
const C = h => new THREE.Color(h);
const COL = { spark: C(0xffd27a), sparkEnd: C(0xff5a10), white: C(0xffffff), fire: C(0xffb040), fireEnd: C(0x802000), dust: C(0x8a8580), dustEnd: C(0x5a5652), smoke: C(0x3a3634), smokeEnd: C(0x6a6460), elec: C(0x9fdcff), elecEnd: C(0x2060ff), oil: C(0x151515), red: C(0xff4020), redEnd: C(0x600000), teal: C(0x40ffd0), amber: C(0xffa030), black: C(0x000000), coin: C(0xffd24a), purple: C(0xc060ff), plasma: C(0x6cf6ff), plasmaEnd: C(0x2040ff), green: C(0x5dff9a) };
function randDir(out, spread = 1) { out.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)); if (out.lengthSq() < 1e-4) out.set(0, 1, 0); return out.normalize().multiplyScalar(spread); }
function sparks(p, n, normal, speed = 8, col0 = COL.spark, col1 = COL.sparkEnd) {
  for (let i = 0; i < n; i++) { randDir(tv); if (normal) tv.addScaledVector(normal, 1.2).normalize(); tv.multiplyScalar(speed * rand(0.3, 1)); FX.spawn(p, tv, rand(0.2, 0.5), rand(0.05, 0.1), 0.01, col0, col1, { grav: 16, drag: 1.5, bounce: true }); }
}
function puff(p, n, normal, col = COL.dust, size = 0.5, life = 0.9) {
  for (let i = 0; i < n; i++) { randDir(tv, rand(0.3, 1.2)); if (normal) tv.addScaledVector(normal, 1.4); SMOKE.spawn(p, tv, life * rand(0.7, 1.3), size * 0.5, size * rand(1.5, 2.5), col, COL.dustEnd, { drag: 3, grav: -0.3, alpha: 0.55 }); }
}

// ---------------- tracers, decals, flashes ----------------
const tracers = [];
for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 1), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.visible = false; scene.add(m); tracers.push({ m, s: new V3(), e: new V3(), t: 1, dur: 0.1 }); }
let tracerI = 0;
function tracer(s, e, color = 0xffd9a0, width = 1) { const tr = tracers[tracerI++ % tracers.length]; tr.s.copy(s); tr.e.copy(e); tr.t = 0; tr.dur = Math.min(0.14, s.distanceTo(e) / 500 + 0.03); tr.m.visible = true; tr.m.material.color.setHex(color); tr.w = width; }
function updateTracers(dt) {
  for (const tr of tracers) {
    if (!tr.m.visible) continue; tr.t += dt / tr.dur; if (tr.t >= 1) { tr.m.visible = false; continue; }
    const h = Math.min(1, tr.t * 1.6), tl = Math.max(0, tr.t * 1.6 - 0.6);
    tv.lerpVectors(tr.s, tr.e, h); tv2.lerpVectors(tr.s, tr.e, tl);
    tr.m.position.lerpVectors(tv, tv2, 0.5); tr.m.lookAt(tv); tr.m.scale.set(tr.w, tr.w, Math.max(0.01, tv.distanceTo(tv2)));
    tr.m.material.opacity = 0.9 * (1 - tr.t * 0.6);
  }
}
const decalGeo = new THREE.PlaneGeometry(1, 1);
const holeMat = new THREE.MeshBasicMaterial({ map: tex(T.hole, 1, 1, false), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
const scorchMat = new THREE.MeshBasicMaterial({ map: tex(T.scorch, 1, 1, false), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
const decals = []; let decalI = 0;
for (let i = 0; i < 140; i++) { const m = new THREE.Mesh(decalGeo, holeMat); m.visible = false; scene.add(m); decals.push(m); }
const scorches = []; let scorchI = 0;
for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(decalGeo, scorchMat); m.visible = false; scene.add(m); scorches.push(m); }
function decal(p, n, size = 0.16, scorch = false) {
  const m = scorch ? scorches[scorchI++ % scorches.length] : decals[decalI++ % decals.length];
  m.visible = true; m.position.copy(p).addScaledVector(n, 0.012); m.lookAt(tv.copy(m.position).add(n)); m.rotateZ(Math.random() * 6.28); m.scale.set(size, size, 1);
}
function clearDecals() { decals.forEach(d => d.visible = false); scorches.forEach(d => d.visible = false); }
const muzzleLight = new THREE.PointLight(0xffb060, 0, 14, 2); scene.add(muzzleLight);
const boomLights = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xff8a30, 0, 30, 1.6); scene.add(l); return { l, t: 0, peak: 12 }; });
let boomLightI = 0;
function flashLight(p, color = 0xff8a30, peak = 12, dist = 30) { const L = boomLights[boomLightI++ % boomLights.length]; L.l.position.copy(p); L.l.color.setHex(color); L.l.distance = dist; L.t = 1; L.peak = peak; L.l.intensity = peak; }
const ringGeo = new THREE.RingGeometry(0.85, 1, 48); const ballGeo = new THREE.SphereGeometry(1, 20, 14);
const blasts = [];
for (let i = 0; i < 6; i++) {
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffc080, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
  const ball = new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); ball.visible = false; scene.add(ball);
  blasts.push({ ring, ball, t: 1, r: 1 });
}
let blastI = 0;
function blast(p, r, color = 0xffa040, ringColor = 0xffc080) {
  const bl = blasts[blastI++ % blasts.length]; bl.t = 0; bl.r = r; bl.ring.position.set(p.x, groundAt(p.x, p.z, p.y) + 0.08, p.z); bl.ball.position.copy(p); bl.ring.visible = bl.ball.visible = true;
  bl.ball.material.color.setHex(color); bl.ring.material.color.setHex(ringColor);
}
function updateBlasts(dt) {
  for (const bl of blasts) {
    if (bl.t >= 1) continue; bl.t += dt / 0.55;
    if (bl.t >= 1) { bl.ring.visible = bl.ball.visible = false; continue; }
    const e = 1 - Math.pow(1 - bl.t, 3);
    bl.ring.scale.setScalar(0.5 + e * bl.r * 1.5); bl.ring.material.opacity = (1 - bl.t) * 0.8;
    bl.ball.scale.setScalar(0.4 + Math.min(1, bl.t * 3) * bl.r * 0.45); bl.ball.material.opacity = Math.max(0, 1 - bl.t * 2.6);
  }
  for (const L of boomLights) { if (L.t > 0) { L.t -= dt * 2.2; L.l.intensity = Math.max(0, L.t) * L.peak; } }
}

// ---------------- collision ----------------
function moveBody(b, dt, step = 0.55) {
  b.pos.x += b.vel.x * dt; resolveAxis(b, 0, step);
  b.pos.z += b.vel.z * dt; resolveAxis(b, 2, step);
  const prevY = b.pos.y;
  b.vel.y -= (b.gravity ?? 24) * dt; b.pos.y += b.vel.y * dt;
  let ground = world.floor || 0, ceil = world.ceiling; const r = b.radius * 0.9;
  for (const c of world.colliders) {
    if (b.pos.x + r <= c.min.x || b.pos.x - r >= c.max.x || b.pos.z + r <= c.min.z || b.pos.z - r >= c.max.z) continue;
    if (c.max.y <= prevY + 0.02 && c.max.y > ground) ground = c.max.y;
    if (c.min.y >= prevY + b.height - 0.02 && c.min.y < ceil) ceil = c.min.y;
  }
  const wasGround = b.onGround; b.landV = 0;
  if (b.pos.y <= ground) { if (!wasGround) b.landV = -b.vel.y; b.pos.y = ground; b.vel.y = 0; b.onGround = true; }
  else b.onGround = false;
  if (b.pos.y + b.height > ceil) { b.pos.y = ceil - b.height; if (b.vel.y > 0) b.vel.y = 0; }
  const lim = world.half - 1.2;
  b.pos.x = clamp(b.pos.x, -lim, lim); b.pos.z = clamp(b.pos.z, -lim, lim);
}
function resolveAxis(b, ax, step) {
  const r = b.radius;
  for (const c of world.colliders) {
    if (b.pos.x + r <= c.min.x || b.pos.x - r >= c.max.x || b.pos.z + r <= c.min.z || b.pos.z - r >= c.max.z) continue;
    if (b.pos.y >= c.max.y - 0.001 || b.pos.y + b.height <= c.min.y) continue;
    const climb = c.max.y - b.pos.y;
    if (climb <= step && b.onGround) { b.pos.y = c.max.y; continue; }
    if (ax === 0) { const cx = (c.min.x + c.max.x) / 2; b.pos.x = (b.pos.x < cx) ? c.min.x - r - 1e-4 : c.max.x + r + 1e-4; b.vel.x = 0; }
    else { const cz = (c.min.z + c.max.z) / 2; b.pos.z = (b.pos.z < cz) ? c.min.z - r - 1e-4 : c.max.z + r + 1e-4; b.vel.z = 0; }
    b.blocked = true;
  }
}
function pointInCollider(p) { for (const c of world.colliders) if (p.x > c.min.x && p.x < c.max.x && p.y > c.min.y && p.y < c.max.y && p.z > c.min.z && p.z < c.max.z) return c; return null; }
function pointFree(x, z, r, y0 = 0, y1 = 2) {
  for (const c of world.colliders) { if (x + r > c.min.x && x - r < c.max.x && z + r > c.min.z && z - r < c.max.z && y1 > c.min.y && y0 < c.max.y) return false; }
  return Math.abs(x) < world.half - r && Math.abs(z) < world.half - r;
}
function groundAt(x, z, below = Infinity, r = 0.1) { // highest surface under (x,z) that is at or below `below`
  let g = world.floor || 0;
  for (const c of world.colliders) if (x + r > c.min.x && x - r < c.max.x && z + r > c.min.z && z - r < c.max.z && c.max.y <= below + 0.05 && c.max.y > g) g = c.max.y;
  return g;
}
function topAt(x, z, r = 0.5) { let g = world.floor || 0; for (const c of world.colliders) if (x + r > c.min.x && x - r < c.max.x && z + r > c.min.z && z - r < c.max.z && c.max.y > g) g = c.max.y; return g; }
function segBlocked(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  for (const c of world.colliders) {
    if (c.noSight) continue;
    let t0 = 0, t1 = 1, ok = true;
    for (let k = 0; k < 3 && ok; k++) {
      const o = k === 0 ? a.x : k === 1 ? a.y : a.z, d = k === 0 ? dx : k === 1 ? dy : dz;
      const mn = k === 0 ? c.min.x : k === 1 ? c.min.y : c.min.z, mx = k === 0 ? c.max.x : k === 1 ? c.max.y : c.max.z;
      if (Math.abs(d) < 1e-8) { if (o < mn || o > mx) ok = false; }
      else { let ta = (mn - o) / d, tb = (mx - o) / d; if (ta > tb) { const s = ta; ta = tb; tb = s; } t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) ok = false; }
    }
    if (ok) return true;
  }
  return false;
}
function colliderNormal(c, p, out) {
  const dxm = Math.min(p.x - c.min.x, c.max.x - p.x), dzm = Math.min(p.z - c.min.z, c.max.z - p.z), dym = c.max.y - p.y;
  if (dym < dxm && dym < dzm) return out.set(0, 1, 0);
  if (dxm < dzm) return out.set(p.x - c.min.x < c.max.x - p.x ? -1 : 1, 0, 0);
  return out.set(0, 0, p.z - c.min.z < c.max.z - p.z ? -1 : 1);
}

// ---------------- floating damage numbers ----------------
const dmgNums = [];
{
  const root = $('#dmgNums');
  for (let i = 0; i < 48; i++) { const el = document.createElement('div'); el.className = 'dn'; el.style.opacity = 0; root.appendChild(el); dmgNums.push({ el, pos: new V3(), t: 1, life: 0.9, vx: 0, vy: 0, cls: '' }); }
}
let dmgNumI = 0;
function damageNumber(p, text, cls = '') {
  if (!settings.dmgNumbers && cls !== 'coin' && cls !== 'block') return;
  const d = dmgNums[dmgNumI++ % dmgNums.length];
  d.pos.copy(p); d.t = 0; d.life = cls === 'coin' ? 1.1 : 0.85; d.vx = rand(-0.6, 0.6); d.vy = rand(1.6, 2.4);
  if (d.cls !== cls) { d.el.className = 'dn' + (cls ? ' ' + cls : ''); d.cls = cls; }
  d.el.textContent = text;
}
function updateDamageNumbers(dt) {
  const w = innerWidth, h = innerHeight;
  for (const d of dmgNums) {
    if (d.t >= 1) continue;
    d.t += dt / d.life; d.pos.y += d.vy * dt; d.pos.x += d.vx * dt; d.vy -= 2.5 * dt;
    tv.copy(d.pos).project(camera);
    if (d.t >= 1 || tv.z > 1) { d.el.style.opacity = 0; if (d.t >= 1) continue; else continue; }
    const x = (tv.x * 0.5 + 0.5) * w, y = (-tv.y * 0.5 + 0.5) * h;
    const s = d.t < 0.15 ? 1.35 - d.t / 0.15 * 0.35 : 1;
    d.el.style.transform = `translate(${x | 0}px,${y | 0}px) translate(-50%,-50%) scale(${s.toFixed(2)})`;
    d.el.style.opacity = d.t > 0.6 ? (1 - (d.t - 0.6) / 0.4).toFixed(2) : 1;
  }
}
function hideDamageNumbers() { for (const d of dmgNums) { d.t = 1; d.el.style.opacity = 0; } }
