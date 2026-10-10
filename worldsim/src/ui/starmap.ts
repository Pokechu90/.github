/**
 * The star map: a zoomable view of the known galaxy. Zoom (or double-click)
 * into a star to see its solar system, click a planet for its details, and
 * open its surface view. Missions in flight are drawn as moving dots.
 */
import type { SimClient } from '../bridge/simClient';
import type { SpaceViewData } from '../shared/protocol';
import { describeHabitability, planetById, planetsOf, starById, type Planet, type Star } from '../shared/galaxy';
import { DAYS_PER_YEAR } from '../shared/time';
import { esc } from './hud';
import { drawSurface, planetSummary } from './surface';

const MISSION_COLORS = { probe: '#9ecbff', crewed: '#ffd36b', interstellar: '#c49bff', colony: '#7CFC9A' };

export function setupStarmap(sim: SimClient, actions: HTMLElement): void {
  const button = document.createElement('button');
  button.textContent = '🪐 Space';
  button.title = 'Star map: the known universe';
  actions.appendChild(button);

  const root = document.getElementById('starmap')!;
  root.innerHTML = `
    <header><strong id="sm-title">Star map</strong><span id="sm-sub" class="muted"></span>
      <button id="sm-back" hidden>⬅ Galaxy</button><button id="sm-close">✕ Close</button></header>
    <canvas id="sm-canvas"></canvas>
    <aside id="sm-info"></aside>
    <div id="sm-help" class="muted">Drag to pan · wheel to zoom · double-click a star to enter its system · click planets for details</div>`;
  const canvas = root.querySelector<HTMLCanvasElement>('#sm-canvas')!;
  const g = canvas.getContext('2d')!;
  const info = root.querySelector<HTMLElement>('#sm-info')!;

  let data: SpaceViewData | null = null;
  let open = false;
  let mode: 'galaxy' | 'system' = 'galaxy';
  let systemStar: Star | null = null;
  let selected: { kind: 'star'; star: Star } | { kind: 'planet'; planet: Planet } | null = null;
  // Galaxy camera (light-years) and system camera (log-scaled AU).
  const cam = { x: 0, y: 0, scale: 14 };
  let sysScale = 1;
  let anim = 0; // 0..1 zoom-in transition into a system
  /** Surface images already drawn, and which planet's surface is showing. */
  const surfaces = new Map<string, HTMLCanvasElement>();
  let surfaceOpen: string | null = null;
  const backdrop = Array.from({ length: 300 }, () => [Math.random(), Math.random(), Math.random()]);

  const refresh = async () => {
    if (!open) return;
    data = (await sim.request({ type: 'spaceState', requestId: 0 }, 'spaceState')).data;
    root.querySelector('#sm-sub')!.textContent =
      ` · ${data.knownStars.length} stars known · ${data.explored.filter((x) => !x.endsWith('/-')).length} planets explored · ${data.colonies.length} colonies · ${data.launches} launches`;
    renderInfo();
  };
  setInterval(refresh, 2000);

  button.addEventListener('click', () => {
    open = true;
    root.hidden = false;
    resize();
    void refresh();
    requestAnimationFrame(frame);
  });
  root.querySelector('#sm-close')!.addEventListener('click', () => {
    open = false;
    root.hidden = true;
  });
  root.querySelector('#sm-back')!.addEventListener('click', () => leaveSystem());
  window.addEventListener('resize', resize);
  function resize() {
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
  }

  // ------------------------------------------------------------ helpers
  const stars = (): Star[] => (data ? data.knownStars.map((id) => starById(data!.seed, id)).filter((s): s is Star => !!s) : []);
  const W = () => canvas.width;
  const H = () => canvas.height;
  const galaxyToScreen = (x: number, y: number) => [W() / 2 + (x - cam.x) * cam.scale * devicePixelRatio, H() / 2 + (y - cam.y) * cam.scale * devicePixelRatio];
  const orbitRadius = (au: number) => (50 + Math.log2(1 + au) * 70) * sysScale * devicePixelRatio;
  const planetPos = (p: Planet, day: number) => {
    const period = Math.pow(p.orbitAU, 1.5) * DAYS_PER_YEAR;
    const a = (day / period) * Math.PI * 2 + p.index * 1.7;
    const r = orbitRadius(p.orbitAU);
    return [W() / 2 + Math.cos(a) * r, H() / 2 + Math.sin(a) * r * 0.85];
  };
  const isExplored = (id: string) => !!data?.explored.includes(id);
  const isCharted = (id: string) => !!data && (data.charted.includes(id) || data.explored.includes(id));

  function enterSystem(star: Star) {
    mode = 'system';
    systemStar = star;
    anim = 0;
    sysScale = 1;
    selected = { kind: 'star', star };
    root.querySelector<HTMLButtonElement>('#sm-back')!.hidden = false;
    root.querySelector('#sm-title')!.textContent = `${star.name} system`;
    renderInfo();
  }
  function leaveSystem() {
    mode = 'galaxy';
    if (systemStar) {
      cam.x = systemStar.x;
      cam.y = systemStar.y;
    }
    systemStar = null;
    root.querySelector<HTMLButtonElement>('#sm-back')!.hidden = true;
    root.querySelector('#sm-title')!.textContent = 'Star map';
    renderInfo();
  }

  // ------------------------------------------------------------ input
  let drag: { x: number; y: number; moved: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => (drag = { x: e.clientX, y: e.clientY, moved: 0 }));
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (mode === 'galaxy') {
      cam.x -= dx / cam.scale;
      cam.y -= dy / cam.scale;
    }
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  canvas.addEventListener('pointerup', (e) => {
    const click = drag && drag.moved < 5;
    drag = null;
    if (click) pick(e, false);
  });
  canvas.addEventListener('dblclick', (e) => pick(e, true));
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const f = Math.exp(-e.deltaY * 0.0015);
    if (mode === 'galaxy') {
      cam.scale = Math.max(1.5, Math.min(120, cam.scale * f));
      // Zooming far into a star enters its system.
      if (cam.scale > 110) {
        const s = nearestStar(W() / 2, H() / 2);
        if (s) {
          cam.scale = 40;
          enterSystem(s.star);
        }
      }
    } else {
      sysScale = Math.max(0.3, Math.min(4, sysScale * f));
      if (sysScale <= 0.3 && e.deltaY > 0) leaveSystem();
    }
  }, { passive: false });

  function nearestStar(px: number, py: number) {
    let best: { star: Star; d: number } | null = null;
    for (const s of stars()) {
      const [x, y] = galaxyToScreen(s.x, s.y);
      const d = Math.hypot(x - px, y - py);
      if (d < 24 * devicePixelRatio && (!best || d < best.d)) best = { star: s, d };
    }
    return best;
  }

  function pick(e: MouseEvent, enter: boolean) {
    const r = canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) * devicePixelRatio;
    const py = (e.clientY - r.top) * devicePixelRatio;
    if (mode === 'galaxy') {
      const hit = nearestStar(px, py);
      if (!hit) return;
      if (enter) enterSystem(hit.star);
      else selected = { kind: 'star', star: hit.star };
    } else if (systemStar && data) {
      for (const p of planetsOf(data.seed, systemStar)) {
        if (!isCharted(p.id) && !p.home && !isExplored(`${systemStar.id}/-`)) continue;
        const [x, y] = planetPos(p, data.day);
        if (Math.hypot(x - px, y - py) < 16 * devicePixelRatio) selected = { kind: 'planet', planet: p };
      }
    }
    renderInfo();
  }

  // ------------------------------------------------------------ drawing
  function frame() {
    if (!open) return;
    draw();
    requestAnimationFrame(frame);
  }

  function draw() {
    const w = W();
    const h = H();
    g.fillStyle = '#03050c';
    g.fillRect(0, 0, w, h);
    for (const [x, y, b] of backdrop) {
      g.fillStyle = `rgba(255,255,255,${0.15 + b * 0.35})`;
      g.fillRect(x * w, y * h, 1.2, 1.2);
    }
    if (!data) return;
    if (mode === 'galaxy') drawGalaxy();
    else drawSystem();
  }

  function drawGalaxy() {
    const d = data!;
    const dpr = devicePixelRatio;
    // Missions in flight.
    for (const m of d.missions) {
      if (m.status !== 'travelling' || m.fromStar === m.targetStar) continue;
      const a = starById(d.seed, m.fromStar);
      const b = starById(d.seed, m.targetStar);
      if (!a || !b) continue;
      const [x0, y0] = galaxyToScreen(a.x, a.y);
      const [x1, y1] = galaxyToScreen(b.x, b.y);
      const t = Math.max(0, Math.min(1, (d.day - m.launchDay) / Math.max(1, m.arriveDay - m.launchDay)));
      g.strokeStyle = MISSION_COLORS[m.kind] + '55';
      g.setLineDash([4 * dpr, 4 * dpr]);
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = MISSION_COLORS[m.kind];
      g.beginPath();
      g.arc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 3 * dpr, 0, Math.PI * 2);
      g.fill();
    }
    g.font = `${11 * dpr}px system-ui, sans-serif`;
    for (const s of stars()) {
      const [x, y] = galaxyToScreen(s.x, s.y);
      if (x < -50 || y < -50 || x > W() + 50 || y > H() + 50) continue;
      const r = (2 + Math.log10(1 + s.luminosity * 10) * 2.5) * dpr;
      const glow = g.createRadialGradient(x, y, 0, x, y, r * 4);
      glow.addColorStop(0, s.color);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(x, y, r * 4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = s.color;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      const colonies = d.colonies.filter((c) => c.planetId.startsWith(`${s.id}/`));
      if (isExplored(`${s.id}/-`) || s.home) {
        g.strokeStyle = colonies.length ? '#7CFC9A' : '#6b7c99';
        g.lineWidth = 1.5 * dpr;
        g.beginPath();
        g.arc(x, y, r + 5 * dpr, 0, Math.PI * 2);
        g.stroke();
      }
      if (selected?.kind === 'star' && selected.star.id === s.id) {
        g.strokeStyle = '#ffd36b';
        g.beginPath();
        g.arc(x, y, r + 9 * dpr, 0, Math.PI * 2);
        g.stroke();
      }
      if (cam.scale > 6 || s.home || colonies.length) {
        g.fillStyle = s.home ? '#ffd36b' : colonies.length ? '#7CFC9A' : '#c8d0e0';
        g.fillText(s.home ? `${s.name} (home)` : s.name, x + r + 6 * dpr, y + 4 * dpr);
      }
    }
    // Scale bar.
    g.fillStyle = '#8b949e';
    g.fillRect(20 * dpr, H() - 30 * dpr, cam.scale * 5 * dpr, 2 * dpr);
    g.fillText('5 light-years', 20 * dpr, H() - 38 * dpr);
  }

  function drawSystem() {
    const d = data!;
    const s = systemStar!;
    const dpr = devicePixelRatio;
    anim = Math.min(1, anim + 0.06);
    const ease = 1 - Math.pow(1 - anim, 3);
    g.save();
    g.translate(W() / 2, H() / 2);
    g.scale(0.3 + ease * 0.7, 0.3 + ease * 0.7);
    g.translate(-W() / 2, -H() / 2);
    g.globalAlpha = ease;
    // The star.
    const glow = g.createRadialGradient(W() / 2, H() / 2, 0, W() / 2, H() / 2, 60 * dpr);
    glow.addColorStop(0, s.color);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow;
    g.beginPath();
    g.arc(W() / 2, H() / 2, 60 * dpr, 0, Math.PI * 2);
    g.fill();
    g.font = `${11 * dpr}px system-ui, sans-serif`;
    const systemExplored = isExplored(`${s.id}/-`);
    for (const p of planetsOf(d.seed, s)) {
      const charted = isCharted(p.id) || p.home || systemExplored;
      if (!charted) continue;
      const explored = isExplored(p.id) || p.home;
      const r = orbitRadius(p.orbitAU);
      g.strokeStyle = 'rgba(140,160,200,0.25)';
      g.lineWidth = dpr;
      g.beginPath();
      g.ellipse(W() / 2, H() / 2, r, r * 0.85, 0, 0, Math.PI * 2);
      g.stroke();
      const [x, y] = planetPos(p, d.day);
      const size = Math.max(3, Math.min(14, 3 + Math.sqrt(p.radiusEarths) * 3)) * dpr;
      g.fillStyle = !explored ? '#556070' : p.home ? '#4f9be0' : p.kind === 'gas giant' ? '#d6b07c' : p.kind === 'ice giant' ? '#8cc4e8'
        : p.atmosphere === 'breathable' ? '#6fbf73' : p.atmosphere === 'toxic' ? '#c9c26a' : p.atmosphere === 'thick' ? '#d98b4f' : '#a08b7d';
      g.beginPath();
      g.arc(x, y, size, 0, Math.PI * 2);
      g.fill();
      const colony = d.colonies.find((c) => c.planetId === p.id);
      if (colony || p.home) {
        g.strokeStyle = '#7CFC9A';
        g.lineWidth = 2 * dpr;
        g.beginPath();
        g.arc(x, y, size + 4 * dpr, 0, Math.PI * 2);
        g.stroke();
      }
      if (selected?.kind === 'planet' && selected.planet.id === p.id) {
        g.strokeStyle = '#ffd36b';
        g.beginPath();
        g.arc(x, y, size + 8 * dpr, 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = '#c8d0e0';
      g.fillText(explored ? p.name : `${p.name} ?`, x + size + 5 * dpr, y + 4 * dpr);
    }
    // Probes and crews heading to planets here.
    for (const m of d.missions) {
      if (m.status !== 'travelling' || !m.targetPlanet || m.targetStar !== s.id) continue;
      const p = planetById(d.seed, m.targetPlanet);
      if (!p) continue;
      const [x1, y1] = planetPos(p, d.day);
      const home = planetsOf(d.seed, s).find((q) => q.home);
      const [x0, y0] = home ? planetPos(home, d.day) : [W() / 2, H() / 2];
      const t = Math.max(0, Math.min(1, (d.day - m.launchDay) / Math.max(1, m.arriveDay - m.launchDay)));
      g.fillStyle = MISSION_COLORS[m.kind];
      g.beginPath();
      g.arc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 3 * dpr, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  // ------------------------------------------------------------ info panel
  function renderInfo() {
    if (!data) {
      info.innerHTML = '<p class="muted">Loading…</p>';
      return;
    }
    const d = data;
    let html = '';
    if (!selected) {
      html = `<h3>The known universe</h3>
        <p class="muted">${d.knownStars.length <= 1 ? 'People only know their own sun so far. Astronomy (mathematics), telescopes (printing) and rockets will reveal more.' : 'Click a star to learn about it; double-click to visit its system.'}</p>`;
    } else if (selected.kind === 'star') {
      const s = selected.star;
      const planets = planetsOf(d.seed, s);
      const explored = isExplored(`${s.id}/-`) || s.home;
      html = `<h3>${esc(s.name)}${s.home ? ' (our sun)' : ''}</h3>
        <p>Type ${s.type} star · ${s.luminosity.toFixed(2)}× the sun's brightness · ${Math.hypot(s.x, s.y).toFixed(1)} light-years from home</p>
        <p>${explored ? `${planets.length} planets` : 'Planets unknown: send a probe!'}</p>
        ${mode === 'galaxy' ? '<button id="sm-enter">Visit system ➜</button>' : ''}`;
    } else {
      const p = selected.planet;
      const explored = isExplored(p.id) || p.home || isExplored(`${p.starId}/-`);
      const colony = d.colonies.find((c) => c.planetId === p.id);
      html = `<h3>${esc(p.name)}</h3>
        ${explored
          ? `<p>${esc(planetSummary(p))}</p>
             <p>Orbit ${p.orbitAU} AU · mass ${p.massEarths}× Earth · radius ${p.radiusEarths}×</p>
             <div class="need"><span>Habitable</span><div class="bar"><i style="width:${Math.round(p.habitability * 100)}%;background:#46a758"></i></div></div>
             <p class="muted">${describeHabitability(p.habitability)}</p>
             ${colony ? `<h4>Colony</h4><p><b>${esc(colony.name)}</b>: ${colony.population} people, founded by settlers from ${esc(colony.parent)}${colony.founders.length ? ` (led by ${esc(colony.founders[0])})` : ''}.</p>` : ''}
             ${p.home ? `<p>${d.settlements.length} settlements, ${d.settlements.reduce((a, s) => a + s.population, 0)} people.</p>` : ''}
             <button id="sm-surface">🌍 ${surfaceOpen === p.id ? 'Hide' : 'View'} surface</button>
             <div id="sm-surface-slot"></div>`
          : '<p class="muted">Charted from afar, but nobody knows what it\'s really like. A probe would tell us.</p>'}`;
    }
    const flights = d.missions.filter((m) => m.status === 'travelling');
    html += `<h4>Missions in flight (${flights.length})</h4><ul class="links">${flights
      .slice(0, 12)
      .map((m) => {
        const target = m.targetPlanet ? planetById(d.seed, m.targetPlanet)?.name : starById(d.seed, m.targetStar)?.name;
        const left = Math.max(0, m.arriveDay - d.day);
        return `<li><span style="color:${MISSION_COLORS[m.kind]}">●</span> ${m.kind} from ${esc(m.from)} → ${esc(target ?? '?')} <span class="muted">(${left > DAYS_PER_YEAR ? `${(left / DAYS_PER_YEAR).toFixed(1)} yrs` : `${left} days`})</span></li>`;
      })
      .join('') || '<li class="muted">None yet.</li>'}</ul>`;
    if (d.colonies.length) {
      html += `<h4>Colonies</h4><ul class="links">${d.colonies.map((c) => `<li>🪐 ${esc(c.name)} on ${esc(planetById(d.seed, c.planetId)?.name ?? '?')}: ${c.population}</li>`).join('')}</ul>`;
    }
    info.innerHTML = html;
    info.querySelector('#sm-enter')?.addEventListener('click', () => selected?.kind === 'star' && enterSystem(selected.star));
    const showSurface = () => {
      if (selected?.kind !== 'planet') return;
      const p = selected.planet;
      let c = surfaces.get(p.id);
      if (!c) {
        c = document.createElement('canvas');
        const colony = d.colonies.find((x) => x.planetId === p.id);
        drawSurface(c, p, { settlements: d.settlements, colony: colony ? { name: colony.name, population: colony.population } : null });
        surfaces.set(p.id, c);
      }
      info.querySelector('#sm-surface-slot')?.replaceChildren(c);
    };
    if (selected?.kind === 'planet' && surfaceOpen === selected.planet.id) showSurface();
    info.querySelector('#sm-surface')?.addEventListener('click', () => {
      if (selected?.kind !== 'planet') return;
      surfaceOpen = surfaceOpen === selected.planet.id ? null : selected.planet.id;
      // Colonies change; redraw their surface each time it's opened.
      if (surfaceOpen && !selected.planet.home) surfaces.delete(selected.planet.id);
      renderInfo();
    });
  }
}
