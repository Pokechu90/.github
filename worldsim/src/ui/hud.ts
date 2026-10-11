/**
 * The HTML interface around the map: clock and speed controls, and a tabbed
 * side panel (Inspect, People, World, History). Plain DOM, no framework.
 *
 * Clicks inside the panel are handled by "event delegation": any element with
 * data-npc="123" selects that person, so the panel can be redrawn freely.
 */
import { BIOMES, type Biome } from '../shared/terrain';
import { MINUTES_PER_YEAR, formatClock, formatDate } from '../shared/time';
import type { GiftOption, SelectTarget, SelectedInfo, Snapshot, WarInfo, WeatherView, WorldEvent } from '../shared/protocol';
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
  onGift(gift: string, target: SelectTarget): void;
  onScheme(action: 'rumours' | 'incite' | 'arm' | 'peace', a: number, b: number, cause: string): void;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const EVENT_ICONS: Record<string, string> = {
  birth: '👶', death: '🕯️', social: '💞', build: '🏠', disease: '🦠', settlement: '🏕️', world: '🌍',
  nature: '🦌', tech: '💡', economy: '💰', conflict: '⚔️', migration: '🧭', space: '🚀', law: '📜', gift: '🎁', battle: '🗡️',
};

export class Hud {
  private speedIndex = 1;
  private lastSpeedIndex = 1;
  private tab = 'inspect';
  private following: number | null = null;
  private lastPanelDraw = 0;
  private lastSnap: Snapshot | null = null;
  private people: Snapshot['people'] = [];
  private chronicle: WorldEvent[] = [];
  private historyFilter = 'all';
  /** Whether the gift list is open in the Inspect tab. */
  private giftsOpen = false;
  /** Whether the "stir up trouble" tools are open, and the cause picked for an incited war. */
  private warOpen = false;
  private warCause = 'auto';
  /** Mouse button held down inside the panel: don't redraw under the cursor or the click is lost. */
  private pressing = false;
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

    $('panel').addEventListener('pointerdown', () => (this.pressing = true));
    window.addEventListener('pointerup', () => setTimeout(() => (this.pressing = false), 0));

    // Delegated clicks inside the panel.
    $('panel').addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-npc],[data-action],[data-town]');
      if (!el) return;
      if (el.dataset.npc) {
        cb.onSelect({ kind: 'npc', id: Number(el.dataset.npc) }, true);
        this.showTab('inspect');
      }
      if (el.dataset.town) {
        cb.onSelect({ kind: 'settlement', id: Number(el.dataset.town) }, true);
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
      } else if (action === 'gifts') {
        this.giftsOpen = !this.giftsOpen;
        this.redraw();
      } else if (action === 'war-tools') {
        this.warOpen = !this.warOpen;
        this.redraw();
      } else if (action === 'war-cause') {
        this.warCause = el.dataset.cause!;
        this.redraw();
      } else if (action === 'scheme' && !(el as HTMLButtonElement).disabled) {
        cb.onScheme(el.dataset.scheme as 'rumours' | 'incite' | 'arm' | 'peace', id, Number(el.dataset.b ?? -1), this.warCause);
      } else if (action === 'gift' && !(el as HTMLButtonElement).disabled) {
        const kind = el.dataset.target === 'settlement' ? 'settlement' : 'npc';
        cb.onGift(el.dataset.gift!, { kind, id });
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
    if (s.chronicleReset) this.chronicle = [];
    if (s.chronicle.length) this.chronicle.push(...s.chronicle);
    $('date').textContent = formatDate(s.time);
    $('clock').textContent = formatClock(s.time);
    $('weather').textContent = `${describeWeather(s.weather)} · ${Math.round(s.weather.tempC)}°C`;
    $('lag').hidden = !s.lagging;
    $('popcount').textContent = `👥 ${Math.round(s.stats.humans)} · 🏘 ${s.settlements.length} · 💡 ${s.stats.era}${s.stats.space ? ` · 🪐 ${s.stats.space.planetsKnown}` : ''}`;
    $('influence').textContent = `✨ ${s.stats.influence}`;
    // The panel is redrawn a few times a second, not on every snapshot.
    if (performance.now() - this.lastPanelDraw > 250) this.redraw();
  }

  redraw(): void {
    const s = this.lastSnap;
    if (!s || this.pressing) return;
    this.lastPanelDraw = performance.now();
    if (this.tab === 'inspect') this.renderSelection(s.selected);
    else if (this.tab === 'people') this.renderPeople();
    else if (this.tab === 'world') this.renderWorld(s);
    else if (this.tab === 'history') this.renderHistory(s.events);
    else if (this.tab === 'space') this.extraTabs.space?.(document.getElementById('tab-space')!, s);
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
      setHtml(el, this.npcHtml(sel));
      return;
    }
    if (sel.kind === 'settlement') {
      setHtml(el, this.townHtml(sel));
      return;
    }
    if (sel.kind === 'building') {
      el.innerHTML = `<h3>${esc(sel.title)}</h3><p class="muted"><a data-town="${sel.settlementId}">${esc(sel.settlement)}</a></p>
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
        <button data-action="gifts" class="${this.giftsOpen ? 'active' : ''}">🎁 Give…</button>
      </div>
      ${this.giftsHtml(n.gifts, 'npc', n.id, 'their')}
      <p class="thought">💭 “${esc(n.thought)}”</p>
      <p>Doing: <b>${esc(n.doing)}</b></p>
      ${n.goal ? `<p>Goal: <b>${esc(n.goal)}</b></p>` : ''}
      <p>Mood: ${moodFace} ${n.playerAffinity !== 0 ? `· Feels about you: ${n.playerAffinity > 0.2 ? '👍' : n.playerAffinity < -0.2 ? '👎' : '🤷'}` : ''}</p>
      ${n.needs.map((x) => bar(x.label, x.value, false)).join('')}
      ${bar('Health', n.health, true)}
      ${n.conditions.length ? `<ul>${n.conditions.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
      ${n.items.length ? `<h4>Belongings</h4><ul class="items">${n.items.map((i) => `<li title="${esc(i.description)}">${i.icon} ${esc(i.name)} <span class="muted">· ${esc(i.description)}</span></li>`).join('')}</ul>` : ''}
      <h4>Personality</h4>
      <p>${n.traits.length ? n.traits.join(', ') : 'balanced'} · values ${n.values.join(' & ')}</p>
      ${n.skills.map((s) => bar(s.label, s.value, true)).join('')}
      <h4>Family</h4>${family}
      <h4>Relationships</h4>${rels}
      <h4>Memories</h4>${mems}`;
  }

  private townHtml(t: Extract<SelectedInfo, { kind: 'settlement' }>): string {
    const research = t.researching
      ? `<p>Researching <b>${esc(t.researching.name)}</b>: ${esc(t.researching.description)}</p>${bar('Progress', t.researching.progress, true)}`
      : '<p class="muted">Nothing left to discover here.</p>';
    return `
      <h3>${esc(t.title)}</h3>
      <p class="muted">${esc(t.subtitle)}</p>
      <div class="buttons"><button data-action="gifts" class="${this.giftsOpen ? 'active' : ''}">🎁 Send a gift…</button></div>
      ${this.giftsHtml(t.gifts, 'settlement', t.id, "the town's")}
      ${this.politicsHtml(t)}
      <p>Leader: ${t.leader ? `<a data-npc="${t.leader.id}">${esc(t.leader.name)}</a>` : '<span class="muted">none</span>'}</p>
      <p>Culture: ${esc(t.culture)}</p>
      <h4>Laws</h4>${t.laws.length ? `<ul>${t.laws.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '<p class="muted">No written laws.</p>'}
      <h4>Knowledge</h4><p>${t.tech.map(esc).join(' · ')}</p>${research}
      <h4>Stores${t.treasury !== null ? ` · treasury ${t.treasury} coins` : ''}</h4>
      <table class="stock">${t.stock.map((r) => `<tr><td>${esc(r.name)}</td><td>${r.amount}</td>${r.price !== null ? `<td class="muted">${r.price.toFixed(1)}c</td>` : ''}</tr>`).join('')}</table>
      <h4>Buildings</h4><p>${t.buildings.join(', ')}</p>
      ${t.neighbours.length ? `<h4>Neighbours</h4><ul class="links">${t.neighbours.map((n) => `<li><a data-town="${n.id}">${esc(n.name)}</a> <span class="tag ${n.relation === 'hostile' || n.relation === 'tense' ? 'bad' : 'good'}">${n.relation}</span></li>`).join('')}</ul>` : ''}`;
  }

  /** Realm, wars, and the player's tools for stirring up (or calming) conflict. */
  private politicsHtml(t: Extract<SelectedInfo, { kind: 'settlement' }>): string {
    const influence = this.lastSnap?.stats.influence ?? 0;
    const realm = t.realm
      ? `<p class="realm">👑 ${t.realm.vassal ? `Part of the <a data-town="${t.realm.rootId}">${esc(t.realm.name)}</a>` : `Rules the <b>${esc(t.realm.name)}</b>`} · ${t.realm.members} towns</p>`
      : '';
    const war = (w: WarInfo) => {
      const pct = Math.round((w.score + 1) * 50);
      return `<li class="war ${w.ongoing ? 'on' : ''}">
        <div><b>${esc(w.name)}</b> vs <a data-town="${w.enemyId}">${esc(w.enemy)}</a>${w.instigated ? ' <span class="tag bad">your doing</span>' : ''}</div>
        <div class="muted">${esc(w.cause)} · since ${esc(w.since)} · ${w.battles} battles · dead: ${w.ourDeaths} ours, ${w.theirDeaths} theirs</div>
        ${w.ongoing ? `<div class="front" title="Who is winning"><i style="width:${pct}%"></i><span>${w.score > 0.15 ? 'winning' : w.score < -0.15 ? 'losing' : 'even'}</span></div>` : `<div class="muted">${esc(w.outcome)}</div>`}
      </li>`;
    };
    const onWars = t.wars.filter((w) => w.ongoing);
    const wars = t.wars.length
      ? `<h4>${onWars.length ? '⚔️ At war' : 'Past wars'}</h4><ul class="wars">${t.wars.map(war).join('')}</ul>
         ${onWars.length ? `<div class="buttons"><button data-action="scheme" data-scheme="peace" data-id="${t.id}" ${influence < t.schemeCosts.peace ? 'disabled' : ''}>🕊️ Broker peace ✨${t.schemeCosts.peace}</button></div>` : ''}`
      : '';
    const tools = this.warOpen ? `<div class="schemes">
        <p class="muted">Turn ${esc(t.title)} against another town. Rumours sour relations; inciting starts a war at once (cheaper if they already hate each other). Word may get out that it was you.</p>
        <div class="chips"><span class="muted">Cause:</span>${[['auto', 'Their best reason'], ['resources', 'Resources'], ['territory', 'Territory'], ['revenge', 'Revenge'], ['faith', 'Faith'], ['conquest', 'Conquest']]
          .map(([id, label]) => `<button data-action="war-cause" data-cause="${id}" class="${this.warCause === id ? 'active' : ''}">${label}</button>`).join('')}</div>
        <table class="rivals">${t.rivals.map((r) => `<tr>
          <td><a data-town="${r.id}">${esc(r.name)}</a><br><span class="muted">${r.distance} tiles · </span><span class="tag ${r.relation === 'hostile' || r.relation === 'tense' ? 'bad' : 'good'}">${r.atWar ? 'at war' : r.relation}</span></td>
          <td><button data-action="scheme" data-scheme="rumours" data-id="${t.id}" data-b="${r.id}" title="Spread rumours in ${esc(t.title)} about ${esc(r.name)}" ${influence < t.schemeCosts.rumours ? 'disabled' : ''}>🗣️ ✨${t.schemeCosts.rumours}</button></td>
          <td><button data-action="scheme" data-scheme="incite" data-id="${t.id}" data-b="${r.id}" title="${esc(r.blocked ?? `Start a war against ${r.name}`)}" ${r.blocked || influence < r.warCost ? 'disabled' : ''}>⚔️ ✨${r.warCost}</button></td>
        </tr>`).join('') || '<tr><td class="muted">There are no other towns yet.</td></tr>'}</table>
        <div class="buttons"><button data-action="scheme" data-scheme="arm" data-id="${t.id}" ${influence < t.schemeCosts.arm ? 'disabled' : ''} title="Fighters are 60% stronger for two years">🗡️ Arm them with ${esc(t.weapons)} ✨${t.schemeCosts.arm}</button></div>
      </div>` : '';
    return `${realm}${t.tribute ? `<p class="muted">💰 ${esc(t.tribute)}</p>` : ''}${t.armedDays ? `<p class="muted">🗡️ Armed with ${esc(t.weapons)} (${Math.ceil(t.armedDays / 12) / 10} more years)</p>` : ''}
      ${wars}
      <div class="buttons"><button data-action="war-tools" class="${this.warOpen ? 'active' : ''}">⚔️ Stir up trouble…</button></div>${tools}`;
  }

  /** The gift list: this era's gifts, plus a peek at the next era's (locked). */
  private giftsHtml(gifts: GiftOption[], target: 'npc' | 'settlement', id: number, whose: string): string {
    if (!this.giftsOpen) return '';
    const influence = this.lastSnap?.stats.influence ?? 0;
    const eras = [...new Set(gifts.map((g) => g.era))];
    const button = (g: GiftOption) => {
      const can = !g.locked && g.affordable;
      const why = g.locked ?? (g.affordable ? '' : `Needs ${g.cost} influence`);
      return `<button class="gift${can ? '' : ' off'}" data-action="gift" data-gift="${g.id}" data-target="${target}" data-id="${id}" ${can ? '' : 'disabled'}
        title="${esc(g.description + (why ? ` — ${why}` : ''))}"><span class="gi">${g.icon}</span><span class="gn">${esc(g.name)}</span><span class="gc">✨${g.cost}</span>${why ? `<span class="gw">${esc(why)}</span>` : ''}</button>`;
    };
    return `<div class="gifts">
      <p class="muted">You have ✨ ${influence} influence (it slowly builds up while the world runs). What you can give depends on ${whose} era.</p>
      ${eras.map((e) => `<h5>${esc(e)}</h5><div class="gift-grid">${gifts.filter((g) => g.era === e).map(button).join('')}</div>`).join('')}
    </div>`;
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
      .map((t) => `<tr><td><a data-town="${t.id}">${esc(t.name)}</a> <span class="muted">${t.tier}</span></td><td>${t.population}</td></tr>`)
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

  /** Other modules (e.g. space) can add a tab renderer here. */
  readonly extraTabs: Record<string, (el: HTMLElement, s: Snapshot) => void> = {};

  private renderHistory(events: WorldEvent[]): void {
    const filters: [string, string, string[]][] = [
      ['all', 'All', []], ['people', 'People', ['birth', 'death', 'social']], ['society', 'Society', ['settlement', 'migration', 'law', 'build', 'economy']],
      ['tech', 'Discoveries', ['tech', 'space']], ['conflict', 'Wars', ['conflict', 'battle']], ['disease', 'Disease', ['disease']], ['gift', 'Gifts', ['gift']],
    ];
    const kinds = filters.find((f) => f[0] === this.historyFilter)?.[2] ?? [];
    const match = (e: WorldEvent) => !kinds.length || kinds.includes(e.kind);
    // Skip the kind's icon when the text already starts with its own emoji.
    const icon = (e: WorldEvent) => (/^\p{Extended_Pictographic}/u.test(e.text) ? '' : `${EVENT_ICONS[e.kind] ?? '•'} `);
    const line = (e: WorldEvent) => `<li><span>${formatDate(e.time)}</span>${icon(e)}${e.about >= 0 ? `<a data-npc="${e.about}">${esc(e.text)}</a>` : esc(e.text)}</li>`;
    // The chronicle (important events) grouped by year, newest first; then recent news.
    const byYear = new Map<number, WorldEvent[]>();
    for (const e of this.chronicle.filter(match)) {
      const y = Math.floor(e.time / 1440 / 120) + 1;
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y)!.push(e);
    }
    const years = [...byYear.entries()].sort((a, b) => b[0] - a[0]).slice(0, 80);
    $('tab-history').innerHTML = `
      <div class="chips">${filters.map(([id, label]) => `<button data-filter="${id}" class="${id === this.historyFilter ? 'active' : ''}">${label}</button>`).join('')}</div>
      <h4>Latest news</h4><ul id="events">${events.filter(match).slice(-12).reverse().map(line).join('')}</ul>
      <h4>Chronicle</h4><div id="events">${years.map(([y, es]) => `<h5>Year ${y}</h5><ul>${es.slice().reverse().map(line).join('')}</ul>`).join('') || '<p class="muted">Nothing historic yet.</p>'}</div>`;
    for (const b of document.querySelectorAll<HTMLButtonElement>('#tab-history [data-filter]')) {
      b.addEventListener('click', () => {
        this.historyFilter = b.dataset.filter!;
        this.redraw();
      });
    }
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

/** Replaces an element's HTML only when it changed. */
function setHtml(el: HTMLElement, html: string): void {
  if ((el as HTMLElement & { _html?: string })._html === html) return;
  (el as HTMLElement & { _html?: string })._html = html;
  el.innerHTML = html;
}

/** A short message near the top of the screen (several stack up). */
export function showToast(text: string, ms = 4000): void {
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    document.body.appendChild(box);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = text;
  box.appendChild(toast);
  setTimeout(() => toast.remove(), ms);
}

export function isTyping(): boolean {
  const a = document.activeElement;
  return a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement;
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
