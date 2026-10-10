/**
 * The HTML interface around the map: clock and speed controls, and a tabbed
 * side panel (Inspect, People, World, History). Plain DOM, no framework.
 *
 * Clicks inside the panel are handled by "event delegation": any element with
 * data-npc="123" selects that person, so the panel can be redrawn freely.
 */
import { BIOMES, type Biome } from '../shared/terrain';
import { MINUTES_PER_YEAR, formatClock, formatDate } from '../shared/time';
import type { SelectTarget, SelectedInfo, Snapshot, WeatherView, WorldEvent } from '../shared/protocol';
import type { TileInfo } from '../render/renderer';

export const SPEEDS = [
  { label: '⏸', speed: 0, title: 'Pause (Space)' },
  { label: '1×', speed: 1, title: '1 game minute per second (1)' },
  { label: '10×', speed: 10, title: '10 game minutes per second (2)' },
  { label: '60×', speed: 60, title: '1 game hour per second (3)' },
  { label: '1 yr/min', speed: MINUTES_PER_YEAR / 60, title: 'One game year per real minute (4)' },
  { label: '10 yr/min', speed: (MINUTES_PER_YEAR * 10) / 60, title: 'Ten game years per real minute (5)' },
];

export interface HudCallbacks {
  onSpeed(speed: number): void;
  onNewWorld(): void;
  onSelect(target: SelectTarget | null, focus: boolean): void;
  onFollow(id: number | null): void;
  onTalk(id: number): void;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const EVENT_ICONS: Record<string, string> = {
  birth: '👶', death: '🕯️', social: '💞', build: '🏠', disease: '🦠', settlement: '🏕️', world: '🌍',
  nature: '🦌', tech: '💡', economy: '💰', conflict: '⚔️', migration: '🧭', space: '🚀', law: '📜',
};

export class Hud {
  private speedIndex = 1;
  private lastSpeedIndex = 1;
  private tab = 'inspect';
  private following: number | null = null;
  private lastPanelDraw = 0;
  private lastSnap: Snapshot | null = null;
  private people: Snapshot['people'] = [];
  /** Extra buttons in the top bar (save, settings, star map...) */
  readonly actions: HTMLElement;

  constructor(seed: number, private cb: HudCallbacks) {
    $('seed').textContent = String(seed);
    $('new-world').addEventListener('click', () => cb.onNewWorld());
    this.actions = $('actions');

    const bar = $('speeds');
    SPEEDS.forEach((s, i) => {
      const b = document.createElement('button');
      b.textContent = s.label;
      b.title = s.title;
      b.addEventListener('click', () => this.setSpeed(i));
      bar.appendChild(b);
    });
    this.highlight();

    // Tabs
    for (const b of document.querySelectorAll<HTMLButtonElement>('#tabs button')) {
      b.addEventListener('click', () => this.showTab(b.dataset.tab!));
    }
    this.showTab('inspect');

    // Delegated clicks inside the panel.
    $('panel').addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-npc],[data-action]');
      if (!el) return;
      if (el.dataset.npc) {
        cb.onSelect({ kind: 'npc', id: Number(el.dataset.npc) }, true);
        this.showTab('inspect');
      }
      const action = el.dataset.action;
      const id = Number(el.dataset.id);
      if (action === 'follow') {
        this.following = this.following === id ? null : id;
        cb.onFollow(this.following);
        this.redraw();
      } else if (action === 'talk') {
        cb.onTalk(id);
      } else if (action === 'focus') {
        cb.onSelect({ kind: 'npc', id }, true);
      }
    });

    window.addEventListener('keydown', (e) => {
      if (isTyping()) return;
      if (e.code === 'Space') {
        e.preventDefault();
        this.setSpeed(this.speedIndex === 0 ? this.lastSpeedIndex : 0);
      }
      const n = Number(e.key);
      if (n >= 1 && n <= 5) this.setSpeed(n);
      if (e.key === 'Escape') {
        cb.onSelect(null, false);
        this.following = null;
        cb.onFollow(null);
      }
    });
  }

  setSpeed(i: number): void {
    if (this.speedIndex !== 0) this.lastSpeedIndex = this.speedIndex;
    this.speedIndex = i;
    this.cb.onSpeed(SPEEDS[i].speed);
    this.highlight();
  }

  get paused(): boolean {
    return this.speedIndex === 0;
  }

  showTab(tab: string): void {
    this.tab = tab;
    for (const b of document.querySelectorAll<HTMLButtonElement>('#tabs button')) b.classList.toggle('active', b.dataset.tab === tab);
    for (const s of document.querySelectorAll<HTMLElement>('#panel > section')) s.hidden = s.id !== `tab-${tab}`;
    this.redraw();
  }

  private highlight(): void {
    [...$('speeds').children].forEach((b, i) => b.classList.toggle('active', i === this.speedIndex));
  }

  update(s: Snapshot): void {
    this.lastSnap = s;
    if (s.people) this.people = s.people;
    $('date').textContent = formatDate(s.time);
    $('clock').textContent = formatClock(s.time);
    $('weather').textContent = `${describeWeather(s.weather)} · ${Math.round(s.weather.tempC)}°C`;
    $('lag').hidden = !s.lagging;
    $('popcount').textContent = `👥 ${s.stats.humans}`;
    // The panel is redrawn a few times a second, not on every snapshot.
    if (performance.now() - this.lastPanelDraw > 250) this.redraw();
  }

  redraw(): void {
    const s = this.lastSnap;
    if (!s) return;
    this.lastPanelDraw = performance.now();
    if (this.tab === 'inspect') this.renderSelection(s.selected);
    else if (this.tab === 'people') this.renderPeople();
    else if (this.tab === 'world') this.renderWorld(s);
    else if (this.tab === 'history') this.renderHistory(s.events);
  }

  showTooltip(tile: TileInfo | null, sx: number, sy: number): void {
    const el = $('tooltip');
    if (!tile) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.textContent = `${BIOMES[tile.biome as Biome].name} · (${tile.x}, ${tile.y}) · ~${Math.round(tile.tempC)}°C avg`;
    el.style.left = `${sx + 14}px`;
    el.style.top = `${sy + 14}px`;
  }

  // ------------------------------------------------------------- Inspect tab

  private renderSelection(sel: SelectedInfo | null): void {
    const el = $('tab-inspect');
    if (!sel) {
      el.innerHTML = '<p class="muted">Click a person, building, animal or plant to inspect it. Use the People tab to find someone.</p>';
      return;
    }
    if (sel.kind === 'gone') {
      el.innerHTML = `<p class="muted">${esc(sel.text)}</p>`;
      return;
    }
    if (sel.kind === 'npc') {
      el.innerHTML = this.npcHtml(sel);
      return;
    }
    if (sel.kind === 'building') {
      el.innerHTML = `<h3>${esc(sel.title)}</h3><p class="muted">${esc(sel.settlement)}</p>
        ${sel.residents.length ? `<h4>Lives here</h4><ul>${sel.residents.map((r) => `<li><a data-npc="${r.id}">${esc(r.name)}</a></li>`).join('')}</ul>` : ''}
        <ul>${sel.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`;
      return;
    }
    const notes = sel.notes.map((n) => `<li>${esc(n)}</li>`).join('');
    if (sel.kind === 'animal') {
      el.innerHTML = `<h3>${esc(sel.title)}</h3>
        <p>${sel.sex}, ${sel.ageYears.toFixed(1)} years old</p>
        <p>Doing: <b>${esc(sel.action)}</b></p>${sel.needs.map((n) => bar(n.label, n.value, n.label === 'Health')).join('')}<ul>${notes}</ul>`;
    } else {
      el.innerHTML = `<h3>${esc(sel.title)}</h3>
        <p>${esc(sel.stage)}, ${sel.ageYears.toFixed(1)} years old</p><ul>${notes}</ul>`;
    }
  }

  private npcHtml(n: Extract<SelectedInfo, { kind: 'npc' }>): string {
    const following = this.following === n.id;
    const moodFace = n.mood > 0.5 ? '😄' : n.mood > 0.15 ? '🙂' : n.mood > -0.15 ? '😐' : n.mood > -0.5 ? '🙁' : '😢';
    const family = n.family.length
      ? `<ul class="links">${n.family.map((f) => `<li><span class="muted">${f.relation}</span> <a data-npc="${f.id}" class="${f.alive ? '' : 'dead'}">${esc(f.name)}${f.alive ? '' : ' †'}</a></li>`).join('')}</ul>`
      : '<p class="muted">No family.</p>';
    const rels = n.relationships.length
      ? `<ul class="links">${n.relationships.map((r) => `<li><a data-npc="${r.id}">${esc(r.name)}</a> <span class="tag ${r.affinity < 0 ? 'bad' : 'good'}">${r.label}</span></li>`).join('')}</ul>`
      : '<p class="muted">Keeps to themselves.</p>';
    const mems = n.memories.length
      ? `<ul class="memories">${n.memories.map((m) => `<li class="${m.lasting ? 'lasting' : ''}"><span>${m.when}${m.source ? ` · heard from ${esc(m.source)}` : ''}</span>${esc(m.text)}</li>`).join('')}</ul>`
      : '<p class="muted">Nothing yet.</p>';
    return `
      <h3>${esc(n.title)}</h3>
      <p class="muted">${esc(n.subtitle)}</p>
      <div class="buttons">
        <button data-action="talk" data-id="${n.id}">💬 Talk</button>
        <button data-action="follow" data-id="${n.id}" class="${following ? 'active' : ''}">${following ? '📍 Following' : '📍 Follow'}</button>
        <button data-action="focus" data-id="${n.id}">🎯 Find</button>
      </div>
      <p class="thought">💭 “${esc(n.thought)}”</p>
      <p>Doing: <b>${esc(n.doing)}</b></p>
      ${n.goal ? `<p>Goal: <b>${esc(n.goal)}</b></p>` : ''}
      <p>Mood: ${moodFace} ${n.playerAffinity !== 0 ? `· Feels about you: ${n.playerAffinity > 0.2 ? '👍' : n.playerAffinity < -0.2 ? '👎' : '🤷'}` : ''}</p>
      ${n.needs.map((x) => bar(x.label, x.value, false)).join('')}
      ${bar('Health', n.health, true)}
      ${n.conditions.length ? `<ul>${n.conditions.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
      <h4>Personality</h4>
      <p>${n.traits.length ? n.traits.join(', ') : 'balanced'} · values ${n.values.join(' & ')}</p>
      ${n.skills.map((s) => bar(s.label, s.value, true)).join('')}
      <h4>Family</h4>${family}
      <h4>Relationships</h4>${rels}
      <h4>Memories</h4>${mems}`;
  }

  // ------------------------------------------------------------- other tabs

  private renderPeople(): void {
    const list = (this.people ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
    const town = list[0]?.settlement ?? '';
    $('tab-people').innerHTML = list.length
      ? `<p class="muted">${list.length} people in ${esc(town)} (the settlement nearest the camera)</p>
         <ul class="people">${list.map((p) => `<li><a data-npc="${p.id}">${esc(p.name)}</a><span>${p.age} · ${esc(p.job)}</span></li>`).join('')}</ul>`
      : '<p class="muted">Nobody lives near here.</p>';
  }

  private renderWorld(s: Snapshot): void {
    const st = s.stats;
    const rows: [string, string | number][] = [];
    rows.push(['People', st.humans]);
    rows.push(['Settlements', s.settlements.length]);
    rows.push(['Babies born', st.humanBirths]);
    for (const [k, v] of Object.entries(st.humanDeaths).sort((a, b) => b[1] - a[1])) rows.push([`Died of ${k}`, v]);
    for (const [k, v] of Object.entries(st.population)) rows.push([k, v]);
    for (const [k, v] of Object.entries(st.plants).sort((a, b) => b[1] - a[1])) rows.push([k, v]);
    rows.push(['Chunks explored', st.chunksLoaded]);
    rows.push(['Sim time / step', `${s.simMs.toFixed(1)} ms`]);
    const towns = s.settlements
      .slice()
      .sort((a, b) => b.population - a.population)
      .slice(0, 12)
      .map((t) => `<tr><td>${esc(t.name)} <span class="muted">${t.tier}</span></td><td>${t.population}</td></tr>`)
      .join('');
    const el = $('tab-world');
    if (!el.querySelector('canvas')) {
      el.innerHTML = `<h4>Human population</h4><canvas id="pop-history" width="268" height="64"></canvas>
        <h4>Deer population</h4><canvas id="deer-history" width="268" height="48"></canvas>
        <h4>Settlements</h4><table id="towns"></table><h4>Statistics</h4><table id="stats"></table>`;
    }
    $('towns').innerHTML = towns;
    $('stats').innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
    drawHistory($<HTMLCanvasElement>('pop-history'), st.peopleHistory, '#7cc4ff');
    drawHistory($<HTMLCanvasElement>('deer-history'), st.history, '#c8a26b');
  }

  private renderHistory(events: WorldEvent[]): void {
    $('tab-history').innerHTML = `<ul id="events">${events
      .slice()
      .reverse()
      .map((e) => `<li><span>${formatDate(e.time)}</span>${EVENT_ICONS[e.kind] ?? '•'} ${e.about >= 0 ? `<a data-npc="${e.about}">${esc(e.text)}</a>` : esc(e.text)}</li>`)
      .join('')}</ul>`;
  }
}

function bar(label: string, value: number, goodHigh: boolean): string {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const bad = goodHigh ? 1 - value : value;
  const color = goodHigh && label !== 'Health' ? '#4f8fd6' : bad > 0.75 ? '#e5484d' : bad > 0.45 ? '#f5a524' : '#46a758';
  return `<div class="need"><span>${label}</span><div class="bar"><i style="width:${pct}%;background:${color}"></i></div></div>`;
}

function describeWeather(w: WeatherView): string {
  if (w.snowing) return w.rain > 0.5 ? '🌨️ Heavy snow' : '🌨️ Snow';
  if (w.rain > 0.6) return '⛈️ Heavy rain';
  if (w.rain > 0.05) return '🌧️ Rain';
  if (w.cloud > 0.6) return '☁️ Overcast';
  if (w.cloud > 0.25) return '⛅ Partly cloudy';
  return '☀️ Clear';
}

function drawHistory(canvas: HTMLCanvasElement, data: number[], color: string): void {
  const g = canvas.getContext('2d')!;
  const { width, height } = canvas;
  g.clearRect(0, 0, width, height);
  if (data.length < 2) {
    g.fillStyle = '#7d8590';
    g.font = '11px sans-serif';
    g.fillText('Collecting data… (one point per day)', 6, height / 2);
    return;
  }
  const max = Math.max(...data, 1);
  g.strokeStyle = color;
  g.lineWidth = 1.5;
  g.beginPath();
  data.forEach((v, i) => {
    const x = (i / (data.length - 1)) * (width - 2) + 1;
    const y = height - 2 - (v / max) * (height - 14);
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  });
  g.stroke();
  g.fillStyle = '#9aa4b2';
  g.font = '10px sans-serif';
  g.fillText(`max ${max} · now ${data[data.length - 1]}`, 4, 10);
}

export function isTyping(): boolean {
  const a = document.activeElement;
  return a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
