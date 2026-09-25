'use strict';
// Every sound is synthesized with the Web Audio API. Music is a small step sequencer.

const SFX = (() => {
  let ctx = null, master, sfxBus, musicBus, verbIn, noise;
  const L = { pos: new V3(), right: new V3(1, 0, 0) };
  let lastPlay = {};

  function impulse(dur, decay) {
    const len = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = settings.vol; master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = settings.music * 0.55; musicBus.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const verb = ctx.createConvolver(); verb.buffer = impulse(2.2, 3);
    verbIn = ctx.createGain(); verbIn.gain.value = 0.55; verbIn.connect(verb); verb.connect(sfxBus);
    Music.attach(ctx, musicBus, noise);
  }
  const now = () => ctx.currentTime;
  // limit how often one sound can retrigger (prevents stacking 20 identical sounds in one frame)
  function gate(key, gap) { const t = performance.now(); if (lastPlay[key] && t - lastPlay[key] < gap) return false; lastPlay[key] = t; return true; }
  function bus(pos, wet = 0.2, vol = 1) {
    const g = ctx.createGain(); let gain = vol, pan = 0;
    if (pos) {
      const dx = pos.x - L.pos.x, dy = pos.y - L.pos.y, dz = pos.z - L.pos.z, dist = Math.hypot(dx, dy, dz);
      gain *= 1 / (1 + dist * 0.06 + dist * dist * 0.0007);
      if (dist > 0.01) pan = clamp((dx * L.right.x + dz * L.right.z) / dist, -1, 1) * 0.85;
      wet = Math.min(0.9, wet + dist * 0.008);
    }
    g.gain.value = gain;
    let out = g;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
    out.connect(sfxBus);
    if (wet > 0) { const s = ctx.createGain(); s.gain.value = wet; out.connect(s); s.connect(verbIn); }
    return g;
  }
  function env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur); }
  function nz({ t = now(), dur = 0.2, type = 'lowpass', f = 1000, f2 = 0, q = 0.7, peak = 0.5, a = 0.002, dest }) {
    const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q;
    const g = ctx.createGain(); env(g, t, a, peak, dur);
    s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + a + dur + 0.05);
  }
  function tone({ t = now(), type = 'sine', f = 440, f2 = 0, dur = 0.2, peak = 0.3, a = 0.003, dest }) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain(); env(g, t, a, peak, dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + a + dur + 0.05);
  }
  const GUN = {
    pistol: { crack: 5200, body: 2600, dur: 0.16, thump: 150, peak: 0.85, tail: 0.35 },
    smg: { crack: 6400, body: 3200, dur: 0.1, thump: 190, peak: 0.6, tail: 0.25 },
    rifle: { crack: 4600, body: 2100, dur: 0.2, thump: 105, peak: 0.8, tail: 0.4 },
    burst: { crack: 5000, body: 2500, dur: 0.15, thump: 125, peak: 0.72, tail: 0.35 },
    shotgun: { crack: 3200, body: 1400, dur: 0.42, thump: 70, peak: 1.15, tail: 0.6 },
    lmg: { crack: 4000, body: 1700, dur: 0.26, thump: 85, peak: 0.9, tail: 0.45 },
    sniper: { crack: 6500, body: 2300, dur: 0.6, thump: 52, peak: 1.25, tail: 0.85 },
  };
  const api = {
    init, L, on: () => !!ctx,
    get ctx() { return ctx; },
    setVolumes() { if (!ctx) return; master.gain.setTargetAtTime(settings.vol, now(), 0.05); musicBus.gain.setTargetAtTime(settings.music * 0.55, now(), 0.05); },
    gun(kind, silenced) {
      if (!ctx) return;
      const t = now();
      if (kind === 'plasma') {
        const d = bus(null, 0.35, 0.9);
        tone({ t, type: 'sawtooth', f: 1800, f2: 220, dur: 0.16, peak: 0.28, dest: d });
        tone({ t, type: 'square', f: 420, f2: 90, dur: 0.12, peak: 0.18, dest: d });
        nz({ t, dur: 0.12, type: 'bandpass', f: 3000, f2: 600, q: 3, peak: 0.3, dest: d });
        tone({ t, f: 110, f2: 40, dur: 0.12, peak: 0.5, dest: d });
        return;
      }
      const p = GUN[kind] || GUN.rifle;
      if (silenced) {
        const d = bus(null, 0.08, 0.8);
        nz({ t, dur: 0.07, type: 'bandpass', f: 1500, q: 1.5, peak: p.peak * 0.45, dest: d });
        nz({ t, dur: 0.05, type: 'lowpass', f: 700, peak: p.peak * 0.4, dest: d });
        tone({ t, f: p.thump * 1.4, f2: 60, dur: 0.06, peak: p.peak * 0.35, dest: d });
        nz({ t: t + 0.02, dur: 0.03, type: 'bandpass', f: 3500, q: 5, peak: 0.12, dest: d });
        return;
      }
      const d = bus(null, p.tail, 1);
      nz({ t, dur: 0.035, type: 'highpass', f: p.crack, peak: p.peak * 0.7, dest: d });
      nz({ t, dur: p.dur, type: 'lowpass', f: p.body, f2: 260, q: 1.1, peak: p.peak, dest: d });
      tone({ t, f: p.thump, f2: 32, dur: 0.16, peak: p.peak, dest: d });
      tone({ t, type: 'triangle', f: p.thump * 2.3, f2: p.thump, dur: 0.06, peak: p.peak * 0.3, dest: d });
      nz({ t: t + 0.025, dur: 0.03, type: 'bandpass', f: 3100, q: 5, peak: 0.12, dest: d });
    },
    turret(pos) { if (!ctx || !gate('turret', 60)) return; const d = bus(pos, 0.2, 0.6); nz({ dur: 0.05, type: 'highpass', f: 4000, peak: 0.4, dest: d }); tone({ f: 200, f2: 60, dur: 0.06, peak: 0.3, dest: d }); },
    click(f = 2600, g = 0.18, delay = 0) { if (!ctx) return; const d = bus(null, 0.05); nz({ t: now() + delay, dur: 0.025, type: 'bandpass', f, q: 6, peak: g, dest: d }); tone({ t: now() + delay, type: 'square', f: f * 0.5, dur: 0.015, peak: g * 0.2, dest: d }); },
    thunk(delay = 0, g = 0.3) { if (!ctx) return; const d = bus(null, 0.05); const t = now() + delay; nz({ t, dur: 0.05, type: 'bandpass', f: 900, q: 2, peak: g, dest: d }); tone({ t, f: 180, f2: 90, dur: 0.06, peak: g * 0.6, dest: d }); },
    tink(delay) { if (!ctx || !gate('tink', 40)) return; const d = bus(null, 0.15, 0.6), t = now() + delay; tone({ t, f: rand(3800, 5200), dur: 0.09, peak: 0.05, dest: d }); tone({ t: t + rand(0.08, 0.14), f: rand(4200, 6000), dur: 0.06, peak: 0.03, dest: d }); },
    dry() { this.click(1800, 0.25); },
    step(sprint) { if (!ctx) return; const d = bus(null, 0.04); nz({ dur: 0.07, type: 'lowpass', f: rand(500, 800), peak: sprint ? 0.16 : 0.1, dest: d }); nz({ dur: 0.03, type: 'bandpass', f: rand(2500, 4000), q: 2, peak: 0.02, dest: d }); },
    land(g) { if (!ctx) return; const d = bus(null, 0.05); nz({ dur: 0.12, type: 'lowpass', f: 380, peak: 0.25 * g, dest: d }); tone({ f: 90, f2: 40, dur: 0.1, peak: 0.25 * g, dest: d }); },
    slide() { if (!ctx) return; const d = bus(null, 0.05); nz({ dur: 0.55, type: 'bandpass', f: 1200, f2: 300, q: 0.8, peak: 0.25, dest: d }); },
    hit(head) {
      if (!ctx || !gate('hit', 25)) return; const d = bus(null, 0);
      if (head) { tone({ type: 'triangle', f: 2900, dur: 0.07, peak: 0.16, dest: d }); tone({ t: now() + 0.035, f: 4200, dur: 0.18, peak: 0.1, dest: d }); nz({ dur: 0.03, type: 'highpass', f: 6000, peak: 0.1, dest: d }); }
      else tone({ type: 'square', f: 1600, dur: 0.035, peak: 0.07, dest: d });
    },
    blocked(pos) { if (!ctx || !gate('block', 40)) return; const d = bus(pos, 0.2, 0.8); tone({ type: 'sine', f: 2200, f2: 1600, dur: 0.12, peak: 0.12, dest: d }); tone({ type: 'sine', f: 3300, dur: 0.08, peak: 0.06, dest: d }); },
    kill() { if (!ctx) return; const d = bus(null, 0.1); tone({ f: 880, dur: 0.07, peak: 0.12, dest: d }); tone({ t: now() + 0.06, f: 1320, dur: 0.14, peak: 0.12, dest: d }); },
    clank(pos) { if (!ctx || !gate('clank', 30)) return; const d = bus(pos, 0.2, 0.7); [523, 1187, 1873, 2791].forEach(f => tone({ type: 'square', f: f * rand(.97, 1.03), dur: 0.08, peak: 0.035, dest: d })); nz({ dur: 0.05, type: 'highpass', f: 3000, peak: 0.12, dest: d }); },
    laser(pos, kind) {
      if (!ctx || !gate('laser' + kind, 30)) return; const d = bus(pos, 0.3, 0.9);
      if (kind === 'heavy') { tone({ type: 'sawtooth', f: 700, f2: 120, dur: 0.25, peak: 0.22, dest: d }); tone({ f: 90, f2: 40, dur: 0.2, peak: 0.3, dest: d }); }
      else if (kind === 'sniper') { tone({ type: 'sawtooth', f: 3000, f2: 400, dur: 0.22, peak: 0.25, dest: d }); nz({ dur: 0.05, type: 'highpass', f: 5000, peak: 0.3, dest: d }); }
      else if (kind === 'drone') { tone({ type: 'square', f: 2200, f2: 900, dur: 0.08, peak: 0.1, dest: d }); }
      else { tone({ type: 'sawtooth', f: 1500, f2: 260, dur: 0.18, peak: 0.2, dest: d }); tone({ type: 'square', f: 320, f2: 60, dur: 0.12, peak: 0.1, dest: d }); }
    },
    charge(pos, long) { if (!ctx) return; const d = bus(pos, 0.2, 0.6); tone({ type: 'sine', f: 300, f2: long ? 2400 : 1400, dur: long ? 1.1 : 0.35, peak: 0.08, dest: d }); },
    beep(pos, f = 1800) { if (!ctx) return; const d = bus(pos, 0.1, 0.7); tone({ type: 'square', f, dur: 0.05, peak: 0.1, dest: d }); },
    whiz() { if (!ctx || !gate('whiz', 80)) return; const d = bus(null, 0.1); nz({ dur: 0.18, type: 'bandpass', f: 3000, f2: 700, q: 3, peak: 0.25, dest: d }); },
    zap(pos) { if (!ctx || !gate('zap', 30)) return; const d = bus(pos, 0.2, 0.6); nz({ dur: 0.08, type: 'bandpass', f: 5000, q: 1, peak: 0.2, dest: d }); },
    botDie(pos) { if (!ctx || !gate('die', 40)) return; const d = bus(pos, 0.35); tone({ type: 'sawtooth', f: 700, f2: 60, dur: 0.6, peak: 0.18, dest: d }); nz({ dur: 0.35, type: 'lowpass', f: 2400, f2: 200, peak: 0.4, dest: d }); },
    slash(pos) { if (!ctx) return; const d = bus(pos, 0.1); nz({ dur: 0.14, type: 'bandpass', f: 2200, f2: 600, q: 2, peak: 0.4, dest: d }); },
    boom(pos, size = 1) {
      if (!ctx || !gate('boom', 45)) return; const d = bus(pos, 0.7, 1.4 * size);
      nz({ dur: 1.5, type: 'lowpass', f: 1600, f2: 60, q: 0.8, peak: 1.2, dest: d });
      tone({ f: 70, f2: 22, dur: 0.9, peak: 1.1, dest: d });
      nz({ dur: 0.06, type: 'highpass', f: 2500, peak: 0.6, dest: d });
      nz({ t: now() + 0.12, dur: 1.2, type: 'bandpass', f: 800, f2: 200, q: 0.5, peak: 0.25, dest: d });
    },
    stun(pos) { if (!ctx) return; const d = bus(pos, 0.5, 1.1); for (let i = 0; i < 6; i++) nz({ t: now() + i * 0.05, dur: 0.06, type: 'bandpass', f: rand(3000, 7000), q: 2, peak: 0.35, dest: d }); tone({ type: 'square', f: 90, f2: 40, dur: 0.5, peak: 0.25, dest: d }); tone({ f: 3000, f2: 200, dur: 0.6, peak: 0.12, dest: d }); },
    hurt() { if (!ctx || !gate('hurt', 60)) return; const d = bus(null, 0.05); tone({ f: 120, f2: 50, dur: 0.18, peak: 0.45, dest: d }); nz({ dur: 0.12, type: 'lowpass', f: 900, peak: 0.3, dest: d }); },
    heartbeat() { if (!ctx) return; const d = bus(null, 0); tone({ f: 60, f2: 40, dur: 0.12, peak: 0.35, dest: d }); tone({ t: now() + 0.22, f: 55, f2: 38, dur: 0.12, peak: 0.25, dest: d }); },
    pickup() { if (!ctx) return; const d = bus(null, 0.2); [660, 880, 1320].forEach((f, i) => tone({ t: now() + i * 0.06, type: 'triangle', f, dur: 0.12, peak: 0.1, dest: d })); },
    coin() { if (!ctx || !gate('coin', 45)) return; const d = bus(null, 0.15, 0.7); const f = rand(1900, 2300); tone({ type: 'triangle', f, dur: 0.06, peak: 0.07, dest: d }); tone({ t: now() + 0.05, type: 'triangle', f: f * 1.5, dur: 0.12, peak: 0.06, dest: d }); },
    powerup() { if (!ctx) return; const d = bus(null, 0.4); [440, 554, 659, 880, 1108].forEach((f, i) => tone({ t: now() + i * 0.05, type: 'sawtooth', f, dur: 0.15, peak: 0.05, dest: d })); },
    buy() { if (!ctx) return; const d = bus(null, 0.2); tone({ type: 'triangle', f: 1046, dur: 0.08, peak: 0.1, dest: d }); tone({ t: now() + 0.07, type: 'triangle', f: 1568, dur: 0.16, peak: 0.1, dest: d }); nz({ dur: 0.06, type: 'highpass', f: 6000, peak: 0.05, dest: d }); },
    deny() { if (!ctx) return; const d = bus(null, 0); tone({ type: 'square', f: 180, dur: 0.12, peak: 0.08, dest: d }); tone({ t: now() + 0.1, type: 'square', f: 140, dur: 0.14, peak: 0.08, dest: d }); },
    levelUp() { if (!ctx) return; const d = bus(null, 0.5); [523, 659, 784, 1046, 1318].forEach((f, i) => tone({ t: now() + i * 0.08, type: 'triangle', f, dur: 0.4, peak: 0.1, dest: d })); tone({ t: now() + 0.4, type: 'sawtooth', f: 1046, dur: 0.6, peak: 0.04, dest: d }); },
    quest() { if (!ctx) return; const d = bus(null, 0.4); [784, 988, 1175, 1568].forEach((f, i) => tone({ t: now() + i * 0.07, type: 'triangle', f, dur: 0.3, peak: 0.09, dest: d })); },
    siren() { if (!ctx) return; const d = bus(null, 0.6, 0.6); const t = now(); tone({ t, type: 'sawtooth', f: 220, f2: 330, dur: 0.7, peak: 0.12, dest: d }); tone({ t: t + 0.7, type: 'sawtooth', f: 330, f2: 220, dur: 0.8, peak: 0.1, dest: d }); },
    bossAlarm() { if (!ctx) return; const d = bus(null, 0.7, 0.8); for (let i = 0; i < 3; i++) { const t = now() + i * 0.5; tone({ t, type: 'sawtooth', f: 140, f2: 280, dur: 0.4, peak: 0.16, dest: d }); tone({ t, type: 'square', f: 70, dur: 0.4, peak: 0.1, dest: d }); } },
    roar(pos) { if (!ctx) return; const d = bus(pos, 0.7, 1.3); tone({ type: 'sawtooth', f: 90, f2: 45, dur: 1.4, peak: 0.35, dest: d }); tone({ type: 'sawtooth', f: 93, f2: 47, dur: 1.4, peak: 0.3, dest: d }); nz({ dur: 1.2, type: 'bandpass', f: 400, f2: 150, q: 2, peak: 0.3, dest: d }); },
    stomp(pos) { if (!ctx) return; const d = bus(pos, 0.5, 1.4); tone({ f: 55, f2: 25, dur: 0.6, peak: 1, dest: d }); nz({ dur: 0.4, type: 'lowpass', f: 400, peak: 0.8, dest: d }); },
    jet() { if (!ctx) return; const d = bus(null, 0.6, 0.9); nz({ dur: 2.2, type: 'bandpass', f: 400, f2: 3000, q: 0.6, peak: 0.5, a: 0.8, dest: d }); tone({ type: 'sawtooth', f: 180, f2: 90, dur: 2.2, peak: 0.05, a: 0.8, dest: d }); },
    clear() { if (!ctx) return; const d = bus(null, 0.4); [523, 659, 784, 1046].forEach((f, i) => tone({ t: now() + i * 0.09, type: 'triangle', f, dur: 0.35, peak: 0.09, dest: d })); },
    warp(pos) { if (!ctx || !gate('warp', 60)) return; const d = bus(pos, 0.4, 0.8); tone({ type: 'sine', f: 120, f2: 900, dur: 0.5, peak: 0.12, dest: d }); nz({ dur: 0.5, type: 'bandpass', f: 400, f2: 4000, q: 4, peak: 0.12, dest: d }); },
    throwN() { if (!ctx) return; const d = bus(null, 0.05); this.click(3000, 0.12); nz({ t: now() + 0.08, dur: 0.18, type: 'bandpass', f: 900, f2: 2400, q: 1, peak: 0.2, dest: d }); },
    bounce(pos) { if (!ctx || !gate('bounce', 40)) return; const d = bus(pos, 0.2, 0.7); tone({ f: rand(1400, 2200), dur: 0.05, peak: 0.1, dest: d }); nz({ dur: 0.03, type: 'bandpass', f: 1200, q: 3, peak: 0.12, dest: d }); },
    ui() { if (!ctx || !gate('ui', 40)) return; const d = bus(null, 0); tone({ type: 'triangle', f: 1400, dur: 0.03, peak: 0.05, dest: d }); },
    death() { if (!ctx) return; const d = bus(null, 0.8); tone({ f: 220, f2: 40, dur: 1.6, peak: 0.3, dest: d }); nz({ dur: 1.8, type: 'lowpass', f: 600, f2: 80, peak: 0.25, dest: d }); },
  };
  return api;
})();

// ---------------- music ----------------
const Music = (() => {
  let ctx = null, out = null, noise = null, mode = null, timer = null, step = 0, nextT = 0, bar = 0;
  const N = n => 440 * Math.pow(2, (n - 69) / 12); // midi -> Hz
  const SONGS = {
    menu: { bpm: 76, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bass: null, drums: false },
    calm: { bpm: 84, chords: [[57, 60, 64], [52, 55, 59], [53, 57, 60], [55, 59, 62]], bass: [45, 0, 0, 0, 45, 0, 0, 0, 40, 0, 0, 0, 43, 0, 0, 0], drums: 'soft' },
    combat: { bpm: 118, chords: null, bass: [33, 33, 45, 33, 33, 45, 36, 33, 33, 33, 45, 33, 31, 43, 28, 40], drums: 'full', lead: null },
    boss: { bpm: 134, chords: null, bass: [33, 33, 33, 45, 34, 34, 34, 46, 33, 33, 33, 45, 31, 31, 36, 38], drums: 'heavy', lead: [69, 72, 76, 72, 70, 74, 77, 74, 69, 72, 76, 81, 67, 71, 74, 79] },
  };
  function voice(type, f, t, dur, peak, cutoff, a = 0.005) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cutoff;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    o.connect(fl); fl.connect(g); g.connect(out); o.start(t); o.stop(t + a + dur + 0.05);
  }
  function drum(kind, t, vol = 1) {
    if (kind === 'kick') { const o = ctx.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); const g = ctx.createGain(); g.gain.setValueAtTime(0.9 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3); }
    else {
      const s = ctx.createBufferSource(); s.buffer = noise; const fl = ctx.createBiquadFilter();
      fl.type = kind === 'hat' ? 'highpass' : 'bandpass'; fl.frequency.value = kind === 'hat' ? 7500 : 1800;
      const g = ctx.createGain(); const d = kind === 'hat' ? 0.04 : 0.16; const pk = (kind === 'hat' ? 0.18 : 0.5) * vol;
      g.gain.setValueAtTime(pk, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + d + 0.02);
      if (kind === 'snare') voice('triangle', 190, t, 0.08, 0.25 * vol, 2000, 0.001);
    }
  }
  function schedule() {
    if (!ctx || !mode) return;
    const song = SONGS[mode]; const spb = 60 / song.bpm / 4; // 16th note length
    while (nextT < ctx.currentTime + 0.15) {
      const s = step % 16, t = nextT;
      if (song.chords && s === 0) {
        const ch = song.chords[bar % song.chords.length];
        ch.forEach(n => { voice('sawtooth', N(n), t, spb * 15, 0.045, 900, spb * 4); voice('sawtooth', N(n) * 1.004, t, spb * 15, 0.035, 700, spb * 4); });
        voice('sine', N(ch[0] - 12), t, spb * 14, 0.12, 400, 0.2);
      }
      if (song.bass) { const b = song.bass[s]; if (b) voice('sawtooth', N(b), t, spb * 1.6, mode === 'boss' ? 0.2 : 0.16, mode === 'calm' ? 300 : 520); }
      if (song.lead && s % 2 === 0 && bar % 2 === 1) voice('square', N(song.lead[(s + bar * 4) % 16]), t, spb * 1.6, 0.045, 2200);
      if (song.drums === 'full' || song.drums === 'heavy') {
        if (s % 4 === 0) drum('kick', t);
        if (s === 4 || s === 12) drum('snare', t);
        if (s % 2 === 0) drum('hat', t, s % 4 === 2 ? 1 : 0.6);
        if (song.drums === 'heavy' && (s === 14 || s === 15)) drum('kick', t, 0.7);
      } else if (song.drums === 'soft') {
        if (s === 0 || s === 10) drum('kick', t, 0.5);
        if (s % 4 === 2) drum('hat', t, 0.5);
      }
      nextT += spb; step++; if (step % 16 === 0) bar++;
    }
  }
  return {
    attach(c, o, n) { ctx = c; out = o; noise = n; if (mode) this.play(mode, true); },
    play(m, force) {
      if (m === mode && !force) return; mode = m;
      if (!ctx) return;
      if (!timer) timer = setInterval(schedule, 25);
      step = 0; bar = 0; nextT = ctx.currentTime + 0.08;
    },
    stop() { mode = null; },
    get mode() { return mode; },
  };
})();
