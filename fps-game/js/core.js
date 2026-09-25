'use strict';
// Shared helpers, settings, difficulty, saved profile and a tiny event bus.
// All game scripts are classic scripts that share one global scope, loaded in order from index.html.

const $ = s => document.querySelector(s);
const V3 = THREE.Vector3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const smooth = t => t * t * (3 - 2 * t);
const pick = arr => arr[(Math.random() * arr.length) | 0];
const fmt = n => Math.round(n).toLocaleString('en-US');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const tv = new V3(), tv2 = new V3(), tv3 = new V3(), tv4 = new V3();
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

// ---------------- event bus ----------------
const bus = {
  map: {},
  on(ev, fn) { (this.map[ev] || (this.map[ev] = [])).push(fn); },
  emit(ev, data) { const l = this.map[ev]; if (l) for (const fn of l) fn(data); }
};

// ---------------- settings ----------------
const QUALITY = {
  low: { pixelRatio: 0.85, shadows: false, shadowSize: 1024, particles: 0.5, aa: false },
  medium: { pixelRatio: 1.25, shadows: true, shadowSize: 1024, particles: 0.8, aa: true },
  high: { pixelRatio: 1.75, shadows: true, shadowSize: 2048, particles: 1, aa: true },
};
const settings = Object.assign({ sens: 1, fov: 82, vol: 0.8, music: 0.45, quality: 'high', invert: false, dmgNumbers: true }, store.get('fb2-settings', {}));
if (!QUALITY[settings.quality]) settings.quality = 'high';
function saveSettings() { store.set('fb2-settings', settings); }

// ---------------- difficulty ----------------
const DIFFICULTY = {
  easy: { label: 'Easy', desc: 'Bots hit softer and come in smaller numbers. 0.8× coins and XP.', hp: 0.75, dmg: 0.6, count: 0.85, speed: 0.95, reward: 0.8 },
  normal: { label: 'Normal', desc: 'The intended fight. Standard coins and XP.', hp: 1, dmg: 1, count: 1, speed: 1, reward: 1 },
  hard: { label: 'Hard', desc: 'Tougher, faster, meaner bots. 1.3× coins and XP.', hp: 1.3, dmg: 1.2, count: 1.2, speed: 1.06, reward: 1.3 },
};

// ---------------- profile (saved progress) ----------------
const PROFILE_KEY = 'fb2-profile';
function defaultProfile() {
  return {
    v: 1, xp: 0, level: 1, coins: 0,
    weapons: { pistol: true, smg: true, rifle: true },
    attachments: {},          // weaponId -> { reddot:true, ... } owned
    equipped: {},             // weaponId -> { reddot:true, ... } fitted
    skin: {},                 // weaponId -> skinId
    upgrades: {},             // weaponId -> { damage:0..5, ... }
    skins: { stock: true },
    loadout: { primary: 'rifle', secondary: 'pistol' },
    quests: {},               // questId -> { p: number, done: bool }
    stats: { kills: 0, headshots: 0, bestWave: 0, bestScore: 0, bosses: 0, runs: 0, spent: 0, flawless: 0, explosiveKills: 0, weaponKills: {} },
    difficulty: 'normal', map: 'yard',
  };
}
function loadProfile() {
  const p = store.get(PROFILE_KEY, null);
  const d = defaultProfile();
  if (!p || typeof p !== 'object') return d;
  const out = Object.assign(d, p);
  out.stats = Object.assign(defaultProfile().stats, p.stats || {});
  out.stats.weaponKills = Object.assign({}, (p.stats && p.stats.weaponKills) || {});
  for (const k of ['weapons', 'attachments', 'equipped', 'skin', 'upgrades', 'skins', 'quests']) out[k] = Object.assign({}, d[k], p[k] || {});
  out.loadout = Object.assign(defaultProfile().loadout, p.loadout || {});
  return out;
}
let profile = loadProfile();
let profileDirty = false;
function saveProfile(now) {
  profileDirty = true;
  if (now) flushProfile();
}
function flushProfile() { if (!profileDirty) return; profileDirty = false; store.set(PROFILE_KEY, profile); }
setInterval(flushProfile, 2000);
addEventListener('visibilitychange', () => { if (document.hidden) flushProfile(); });
addEventListener('pagehide', flushProfile);
