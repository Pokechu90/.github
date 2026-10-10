/**
 * The HTML interface around the map: clock and speed controls, the side panel
 * (selection, world stats, population graph, recent events) and the tooltip.
 * Plain DOM, no framework, so it's easy to read and change.
 */
import { BIOMES, type Biome } from '../shared/terrain';
import { MINUTES_PER_YEAR, formatClock, formatDate } from '../shared/time';
import type { SelectedInfo, Snapshot, WeatherView } from '../shared/protocol';
import type { TileInfo } from '../render/renderer';

export const SPEEDS = [
  { label: '⏸', speed: 0, title: 'Pause (Space)' },
  { label: '1×', speed: 1, title: 'Real-time-ish: 1 game minute per second (1)' },
  { label: '10×', speed: 10, title: '10 game minutes per second (2)' },
  { label: '60×', speed: 60, title: '1 game hour per second (3)' },
  { label: '1 yr/min', speed: MINUTES_PER_YEAR / 60, title: 'One game year per real minute (4)' },
  { label: '10 yr/min', speed: (MINUTES_PER_YEAR * 10) / 60, title: 'Ten game years per real minute (5)' },
];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export class Hud {
  private speedIndex = 1;
  private lastSpeedIndex = 1;
  private onSpeed: (speed: number) => void;

  constructor(seed: number, onSpeed: (speed: number) => void, onNewWorld: () => void) {
    this.onSpeed = onSpeed;
    $('seed').textContent = String(seed);
    $('new-world').addEventListener('click', onNewWorld);

    const bar = $('speeds');
    SPEEDS.forEach((s, i) => {
      const b = document.createElement('button');
      b.textContent = s.label;
      b.title = s.title;
      b.addEventListener('click', () => this.setSpeed(i));
      bar.appendChild(b);
    });
    this.highlight();

    window.addEventListener('keydown', (e) => {
      if (document.activeElement instanceof HTMLInputElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        this.setSpeed(this.speedIndex === 0 ? this.lastSpeedIndex : 0);
      }
      const n = Number(e.key);
      if (n >= 1 && n <= 5) this.setSpeed(n);
    });
  }

  setSpeed(i: number): void {
    if (this.speedIndex !== 0) this.lastSpeedIndex = this.speedIndex;
    this.speedIndex = i;
    this.onSpeed(SPEEDS[i].speed);
    this.highlight();
  }

  private highlight(): void {
    [...$('speeds').children].forEach((b, i) => b.classList.toggle('active', i === this.speedIndex));
  }

  update(s: Snapshot): void {
    $('date').textContent = formatDate(s.time);
    $('clock').textContent = formatClock(s.time);
    $('weather').textContent = `${describeWeather(s.weather)} · ${Math.round(s.weather.tempC)}°C`;
    $('lag').hidden = !s.lagging;

    this.renderSelection(s.selected);
    this.renderStats(s);
    drawHistory($<HTMLCanvasElement>('history'), s.stats.history);
    $('events').innerHTML = s.events
      .slice()
      .reverse()
      .map((e) => `<li><span>${formatDate(e.time)}</span> ${escapeHtml(e.text)}</li>`)
      .join('');
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

  private renderSelection(sel: SelectedInfo | null): void {
    const el = $('selection');
    if (!sel) {
      el.innerHTML = '<p class="muted">Click an animal or plant to inspect it.</p>';
      return;
    }
    if (sel.kind === 'gone') {
      el.innerHTML = `<p class="muted">${escapeHtml(sel.text)}</p>`;
      return;
    }
    const notes = sel.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('');
    if (sel.kind === 'animal') {
      const bars = sel.needs
        .map((n) => {
          const good = n.label === 'Health';
          const pct = Math.round(n.value * 100);
          const bad = good ? 1 - n.value : n.value;
          const color = bad > 0.75 ? '#e5484d' : bad > 0.45 ? '#f5a524' : '#46a758';
          return `<div class="need"><span>${n.label}</span><div class="bar"><i style="width:${pct}%;background:${color}"></i></div></div>`;
        })
        .join('');
      el.innerHTML = `<h3>${escapeHtml(sel.title)}</h3>
        <p>${sel.sex}, ${sel.ageYears.toFixed(1)} years old</p>
        <p>Doing: <b>${escapeHtml(sel.action)}</b></p>${bars}<ul>${notes}</ul>`;
    } else {
      el.innerHTML = `<h3>${escapeHtml(sel.title)}</h3>
        <p>${escapeHtml(sel.stage)}, ${sel.ageYears.toFixed(1)} years old</p><ul>${notes}</ul>`;
    }
  }

  private renderStats(s: Snapshot): void {
    const st = s.stats;
    const rows: [string, string | number][] = [];
    for (const [k, v] of Object.entries(st.population)) rows.push([k, v]);
    if (!Object.keys(st.population).length) rows.push(['Deer', 0]);
    rows.push(['Births', st.births]);
    for (const [k, v] of Object.entries(st.deaths)) rows.push([`Died of ${k}`, v]);
    for (const [k, v] of Object.entries(st.plants).sort((a, b) => b[1] - a[1])) rows.push([k, v]);
    rows.push(['Chunks explored', st.chunksLoaded]);
    rows.push(['Sim time / step', `${s.simMs.toFixed(1)} ms`]);
    $('stats').innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  }
}

function describeWeather(w: WeatherView): string {
  if (w.snowing) return w.rain > 0.5 ? '🌨️ Heavy snow' : '🌨️ Snow';
  if (w.rain > 0.6) return '⛈️ Heavy rain';
  if (w.rain > 0.05) return '🌧️ Rain';
  if (w.cloud > 0.6) return '☁️ Overcast';
  if (w.cloud > 0.25) return '⛅ Partly cloudy';
  return '☀️ Clear';
}

function drawHistory(canvas: HTMLCanvasElement, data: number[]): void {
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
  g.strokeStyle = '#c8a26b';
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
  g.fillText(`max ${max}`, 4, 10);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
