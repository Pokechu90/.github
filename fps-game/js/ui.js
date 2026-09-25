'use strict';
// HUD, notifications and every menu screen.

const ui = (() => {
  const E = id => document.getElementById(id);
  const h = {
    root: E('hud'), hpNum: E('hpNum'), hpMax: E('hpMax'), hpFill: E('hpFill'), hpGhost: E('hpGhost'), hpBar: E('hpBar'), arFill: E('arFill'), arNum: E('arNum'), mapLbl: E('mapLbl'),
    hudLvl: E('hudLvl'), hudXp: E('hudXp'), hudXpTxt: E('hudXpTxt'), buffRow: E('buffRow'),
    wName: E('wName'), wMode: E('wMode'), wAtt: E('wAtt'), mag: E('ammoMag'), res: E('ammoRes'), frag: E('fragNum'), stun: E('stunNum'), slots: E('slots'), reloadBar: E('reloadBar'), reloadFill: E('reloadFill'),
    wave: E('waveNum'), host: E('hostNum'), hostLbl: E('hostLbl'), kills: E('killNum'), score: E('scoreNum'), coin: E('coinVal'), coinPop: E('coinPop'), mult: E('mult'),
    cross: E('crosshair'), chL: E('chL'), chR: E('chR'), chT: E('chT'), chB: E('chB'), hit: E('hit'), dmg: E('dmgDirs'), banner: E('banner'), bTitle: E('bannerTitle'), bSub: E('bannerSub'),
    streak: E('streak'), prompt: E('prompt'), vignette: E('vignette'), hurt: E('hurt'), stunFx: E('stunFx'), puFx: E('puFx'), scope: E('scope'), flash: E('flash'), feed: E('killfeed'), map: E('minimap'), lockHint: E('lockHint'),
    toasts: E('toasts'), powerups: E('powerups'), inter: E('interBar'), streakNum: E('streakNum'), streakReady: E('streakReady'), streakFill: E('streakFill'),
    bossBar: E('bossBar'), bossName: E('bossName'), bossPhase: E('bossPhase'), bossFill: E('bossFill'), bossGhost: E('bossGhost'), bossShield: E('bossShield'),
  };
  const screens = { menu: E('menu'), play: E('play'), armory: E('armory'), quests: E('quests'), settings: E('settings'), pause: E('pause'), buffs: E('buffs'), over: E('over') };
  const cache = {};
  const setT = (el, key, v) => { if (cache[key] !== v) { cache[key] = v; el.textContent = v; } };
  const setH = (el, key, v) => { if (cache[key] !== v) { cache[key] = v; el.innerHTML = v; } };
  let hurtA = 0, flashA = 0, promptT = 0, bannerT = 0, coinPopT = 0, coinPopN = 0, promptAuto = false;

  function show(name) { for (const k in screens) screens[k].hidden = k !== name; if (name) { const b = screens[name].querySelector('.btn.primary, .bcard, button'); if (b) setTimeout(() => { try { b.focus({ preventScroll: true }); } catch (e) {} }, 30); } }
  function hideAll() { for (const k in screens) screens[k].hidden = true; }

  // ---------------- transient HUD messages ----------------
  function banner(t, s, dur = 2.6, isBoss = false) { h.bTitle.textContent = t; h.bSub.textContent = s; h.banner.classList.toggle('boss', !!isBoss); h.banner.classList.add('show'); bannerT = dur; }
  function toast(title, sub, cls = '') {
    const el = document.createElement('div'); el.className = 'toast' + (cls ? ' ' + cls : '');
    el.innerHTML = `<b>${escapeHtml(title)}</b><span>${escapeHtml(sub || '')}</span>`;
    h.toasts.appendChild(el); while (h.toasts.children.length > 4) h.toasts.firstChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 4200);
  }
  function prompt(t, warn, dur = 0) { h.prompt.textContent = t; h.prompt.classList.toggle('warn', !!warn); h.prompt.classList.add('show'); promptT = dur; promptAuto = !dur; }
  function streak(t) { h.streak.textContent = t; h.streak.classList.remove('show'); void h.streak.offsetWidth; h.streak.classList.add('show'); }
  function hitmarker(kill, head) { h.hit.classList.remove('show', 'kill', 'head'); void h.hit.offsetWidth; h.hit.classList.add('show'); if (kill) h.hit.classList.add('kill'); if (head) h.hit.classList.add('head'); }
  function dmgIndicator(from) {
    const ang = Math.atan2(from.x - player.pos.x, from.z - player.pos.z);
    const rel = ang - Math.atan2(-Math.sin(player.yaw), -Math.cos(player.yaw));
    const el = document.createElement('div'); el.className = 'dd'; el.style.transform = `rotate(${-rel}rad)`;
    h.dmg.appendChild(el); requestAnimationFrame(() => { el.style.opacity = 0; }); setTimeout(() => el.remove(), 1100);
  }
  function killfeed(w, name, head) {
    const el = document.createElement('div'); el.className = 'kf';
    el.innerHTML = `${escapeHtml(w)} ▸ <em>${escapeHtml(name)}</em>${head ? '<span class="hs">HEADSHOT</span>' : ''}`;
    h.feed.prepend(el); while (h.feed.children.length > 5) h.feed.lastChild.remove();
    setTimeout(() => { el.style.opacity = 0; setTimeout(() => el.remove(), 400); }, 4000);
  }
  bus.on('coins', ({ n }) => { coinPopN += n; coinPopT = 1.2; h.coinPop.textContent = `+${coinPopN}`; h.coinPop.style.opacity = 1; });
  bus.on('levelup', ({ level, text }) => { toast(`Level ${level}`, text, 'level'); SFX.levelUp(); });
  bus.on('quest', ({ q, text }) => { toast(`Quest complete: ${q.name}`, text, 'quest'); SFX.quest(); });

  // ---------------- minimap ----------------
  const mctx = h.map.getContext('2d');
  { const dpr = Math.min(2, window.devicePixelRatio || 1); h.map.width = 168 * dpr; h.map.height = 168 * dpr; mctx.scale(dpr, dpr); }
  function drawMap() {
    const g = mctx, S = 168, sc = 95 / world.half;
    g.clearRect(0, 0, S, S); g.save(); g.translate(S / 2, S / 2); g.rotate(player.yaw); g.scale(sc, sc); g.translate(-player.pos.x, -player.pos.z);
    g.fillStyle = 'rgba(160,185,195,.22)';
    for (const c of world.colliders) g.fillRect(c.min.x, c.min.z, c.max.x - c.min.x, c.max.z - c.min.z);
    g.strokeStyle = 'rgba(245,165,36,.5)'; g.lineWidth = 1 / sc; g.strokeRect(-world.half, -world.half, world.half * 2, world.half * 2);
    for (const k of pickups) { g.fillStyle = '#' + k.def.col.toString(16).padStart(6, '0'); g.fillRect(k.g.position.x - 1, k.g.position.z - 1, 2, 2); }
    for (const t of turrets) { g.fillStyle = '#5ff2ff'; g.fillRect(t.pos.x - 1.2, t.pos.z - 1.2, 2.4, 2.4); }
    for (const e of enemies) { g.fillStyle = e.mapColor; g.beginPath(); g.arc(e.pos.x, e.pos.z, e.mapSize, 0, 7); g.fill(); if (e.isBoss) { g.strokeStyle = '#fff'; g.lineWidth = 0.6; g.stroke(); } }
    for (const n of grenades) { g.fillStyle = '#fff'; g.fillRect(n.pos.x - .6, n.pos.z - .6, 1.2, 1.2); }
    g.restore();
    g.fillStyle = 'rgba(245,165,36,.12)'; g.beginPath(); g.moveTo(S / 2, S / 2); g.arc(S / 2, S / 2, 60, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); g.fill();
    g.fillStyle = '#f5a524'; g.beginPath(); g.moveTo(S / 2, S / 2 - 6); g.lineTo(S / 2 + 4.5, S / 2 + 5); g.lineTo(S / 2, S / 2 + 2.5); g.lineTo(S / 2 - 4.5, S / 2 + 5); g.fill();
    const nx = S / 2 + Math.sin(-player.yaw) * -70, ny = S / 2 - Math.cos(-player.yaw) * 70;
    g.fillStyle = '#e6ecef'; g.font = '600 10px IBM Plex Mono, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', clamp(nx, 8, S - 8), clamp(ny, 8, S - 8));
  }

  // ---------------- per-frame HUD ----------------
  function update(dt) {
    const W = currentWeapon(), st = currentAmmo(), rt = weaponRuntime(), mods = buffMods();
    const mhp = maxHp();
    setT(h.hpNum, 'hp', String(Math.max(0, Math.ceil(player.hp)))); setT(h.hpMax, 'hpm', `/ ${mhp}`);
    h.hpFill.style.transform = `scaleX(${clamp(player.hp / mhp, 0, 1)})`; h.hpGhost.style.transform = `scaleX(${clamp(player.hp / mhp, 0, 1)})`;
    h.hpBar.classList.toggle('low', player.hp < mhp * 0.3);
    h.arFill.style.transform = `scaleX(${player.armor / 100})`; setT(h.arNum, 'ar', String(Math.ceil(player.armor)));
    const need = xpForLevel(profile.level);
    setT(h.hudLvl, 'lvl', `LV ${profile.level}`); h.hudXp.style.transform = `scaleX(${profile.xp / need})`; setT(h.hudXpTxt, 'xp', `${fmt(profile.xp)} / ${fmt(need)}`);
    setT(h.wName, 'wn', W.name); setT(h.wMode, 'wm', W.mode);
    setT(h.wAtt, 'wa', ATT_IDS.filter(a => attOn(W.id, a)).map(a => ATTACHMENTS[a].short).join(' · '));
    const inf = mods.infinite;
    setT(h.mag, 'mag', String(st.mag)); setT(h.res, 'res', inf ? '/ ∞' : '/ ' + st.reserve);
    h.mag.classList.toggle('low', !inf && st.mag <= Math.ceil(rt.mag * 0.25)); h.mag.classList.toggle('inf', inf);
    setT(h.frag, 'fr', String(player.frags)); setT(h.stun, 'stn', String(player.stuns));
    const slotKey = loadout.map(id => id).join(',') + '|' + (G.switchTo >= 0 ? G.switchTo : G.cur);
    if (cache.slots !== slotKey) { cache.slots = slotKey; h.slots.innerHTML = loadout.map((id, i) => `<div class="${i === (G.switchTo >= 0 ? G.switchTo : G.cur) ? 'on' : ''}">${i + 1} <span>${WEAPON_BY_ID[id].name}</span></div>`).join(''); }
    if (G.reloading) { h.reloadBar.style.opacity = 1; const t = W.shellReload ? st.mag / rt.mag : G.reloadT / rt.reload; h.reloadFill.style.transform = `scaleX(${clamp(t, 0, 1)})`; } else h.reloadBar.style.opacity = 0;
    setT(h.wave, 'wave', String(run.wave));
    if (waves.active) { setT(h.hostLbl, 'hl', 'Hostiles'); setT(h.host, 'hn', String(enemies.length + waves.queue.length)); }
    else { setT(h.hostLbl, 'hl', 'Next wave'); setT(h.host, 'hn', Math.ceil(Math.max(0, waves.inter)) + 's'); }
    setT(h.kills, 'k', String(run.kills)); setT(h.score, 's', fmt(run.score)); setT(h.coin, 'c', fmt(profile.coins));
    setT(h.mult, 'm', run.multiT > 0 && run.multi > 1 ? `×${(1 + Math.min(run.multi - 1, 4) * 0.25).toFixed(2)} multi-kill` : '');
    coinPopT -= dt; if (coinPopT <= 0 && coinPopN) { coinPopN = 0; h.coinPop.style.opacity = 0; }
    // buffs
    const bk = Object.entries(run.buffs).map(([k, n]) => k + n).join();
    if (cache.buffs !== bk) { cache.buffs = bk; h.buffRow.innerHTML = Object.entries(run.buffs).map(([k, n]) => `<div class="bic" title="${escapeHtml(BUFFS[k].name + ': ' + BUFFS[k].desc)}">${buffIcon(k)}${n > 1 ? `<em>${n}</em>` : ''}</div>`).join(''); }
    // powerups
    const pk = Object.entries(powerups).filter(([, v]) => v > 0).map(([k, v]) => `<span class="pu" style="color:${POWERUPS[k].css}">${POWERUPS[k].name} ${Math.ceil(v)}s</span>`).join('');
    setH(h.powerups, 'pu', pk);
    h.puFx.style.opacity = powerups.damage > 0 ? 0.35 : 0;
    // killstreak
    setT(h.streakNum, 'ks', String(run.killstreak));
    h.streakFill.style.width = `${clamp(run.killstreak / 20, 0, 1) * 100}%`;
    const rdy = []; if (run.airstrikes) rdy.push(`<span class="rdy">Z airstrike ×${run.airstrikes}</span>`); if (run.turrets) rdy.push(`<span class="rdy">X turret ×${run.turrets}</span>`);
    setH(h.streakReady, 'kr', rdy.join(' · ') || '10 → airstrike · 20 → turret');
    // intermission
    const interTxt = !waves.active && run.wave > 0 && state === 'playing' ? `Next wave in ${Math.ceil(Math.max(0, waves.inter))}s · <kbd>B</kbd> shop · <kbd>Enter</kbd> ready` : '';
    h.inter.hidden = !interTxt; setH(h.inter, 'inter', interTxt);
    // boss bar
    if (boss && !boss.dead) {
      h.bossBar.hidden = false; setT(h.bossName, 'bn', boss.name);
      const phaseLbl = boss.phase === 1 ? boss.def.title : boss.phase === 2 ? 'Phase two' : 'Final phase';
      setT(h.bossPhase, 'bp', (boss.shieldUp && boss.shieldUp() ? 'Shield up · ' : '') + phaseLbl);
      const f = clamp(boss.hp / boss.hpMax, 0, 1); h.bossFill.style.transform = `scaleX(${f})`; h.bossGhost.style.transform = `scaleX(${f})`;
      h.bossShield.style.transform = `scaleX(${boss.shieldMax ? clamp(boss.shieldHp / boss.shieldMax, 0, 1) * (boss.shieldUp() ? 1 : 0) : 0})`;
    } else h.bossBar.hidden = true;
    // crosshair
    const spread = currentSpread();
    const gap = Math.tan(spread) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * innerHeight / 2 + 4;
    h.chL.style.transform = `translateX(${-gap - 10}px)`; h.chR.style.transform = `translateX(${gap}px)`; h.chT.style.transform = `translateY(${-gap - 10}px)`; h.chB.style.transform = `translateY(${gap}px)`;
    h.cross.style.opacity = (G.ads > 0.5 || VMS.sprint > 0.5 || !player.alive) ? 0 : 1;
    // screen fx
    hurtA = Math.max(0, hurtA - dt * 2.5); h.hurt.style.opacity = hurtA;
    h.vignette.style.opacity = clamp((mhp * 0.45 - player.hp) / (mhp * 0.45), 0, 1) * (0.55 + Math.sin(time * 6) * 0.15);
    h.stunFx.style.opacity = player.stunT > 0 ? Math.min(1, player.stunT) : 0;
    flashA = Math.max(0, flashA - dt * 2); h.flash.style.opacity = flashA;
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) h.banner.classList.remove('show'); }
    if (promptT > 0) { promptT -= dt; if (promptT <= 0) { h.prompt.classList.remove('show'); promptAuto = true; } }
    else if (player.alive) {
      if (st.mag === 0 && st.reserve === 0 && !inf) prompt('Out of ammo · switch weapon or buy ammo', true);
      else if (st.mag <= Math.ceil(rt.mag * 0.25) && !G.reloading && st.reserve > 0) prompt('R · Reload', false);
      else if (promptAuto) h.prompt.classList.remove('show');
    }
    h.lockHint.hidden = locked || !player.alive || state !== 'playing';
    drawMap();
  }

  // ---------------- main menu ----------------
  function renderProfile() {
    const need = xpForLevel(profile.level);
    const pw = WEAPON_BY_ID[profile.loadout.primary], sw = WEAPON_BY_ID[profile.loadout.secondary];
    E('profileCard').innerHTML = `
      <h2>Operator record</h2>
      <div class="lvl-row"><b>Level ${profile.level}</b><span class="note">${fmt(profile.xp)} / ${fmt(need)} XP to level ${profile.level + 1}</span></div>
      <div class="xpbar"><i style="transform:scaleX(${profile.xp / need})"></i></div>
      <div class="pc-stats">
        <div>Coins<b style="color:var(--coin)"><span class="coin"></span>${fmt(profile.coins)}</b></div>
        <div>Best wave<b>${profile.stats.bestWave}</b></div>
        <div>Best score<b>${fmt(profile.stats.bestScore)}</b></div>
        <div>Kills<b>${fmt(profile.stats.kills)}</b></div>
        <div>Headshots<b>${fmt(profile.stats.headshots)}</b></div>
        <div>Bosses<b>${fmt(profile.stats.bosses)}</b></div>
      </div>
      <div class="pc-load">Loadout <b>${escapeHtml(pw.name)}</b> + <b>${escapeHtml(sw.name)}</b> · ${escapeHtml(DIFFICULTY[profile.difficulty].label)} · ${escapeHtml(MAP_BY_ID[profile.map].name)}</div>`;
    E('questCount').textContent = `${questsDoneCount()} / ${QUESTS.length} done`;
  }

  // ---------------- play setup ----------------
  function openPlay() {
    if (!mapUnlocked(MAP_BY_ID[profile.map])) profile.map = 'yard';
    E('mapCards').innerHTML = MAPS.map(m => { const ok = mapUnlocked(m); return `<button class="card${m.id === profile.map ? ' on' : ''}${ok ? '' : ' locked'}" data-map="${m.id}" ${ok ? '' : 'aria-disabled="true"'}><div class="sw" style="background:${m.swatch}"></div><div class="ct"><b>${escapeHtml(m.name)}</b><span>${escapeHtml(ok ? m.desc : mapUnlockText(m))}</span></div></button>`; }).join('');
    E('diffCards').innerHTML = Object.entries(DIFFICULTY).map(([k, d]) => `<button class="card${k === profile.difficulty ? ' on' : ''}" data-diff="${k}"><div class="ct"><b>${d.label}</b><span>${escapeHtml(d.desc)}</span></div></button>`).join('');
    E('deploySub').textContent = `${MAP_BY_ID[profile.map].name} · ${DIFFICULTY[profile.difficulty].label}`;
    show('play');
  }
  E('mapCards').addEventListener('click', e => { const c = e.target.closest('[data-map]'); if (!c) return; const m = MAP_BY_ID[c.dataset.map]; if (!mapUnlocked(m)) { SFX.deny(); return; } SFX.ui(); profile.map = m.id; saveProfile(); openPlay(); });
  E('diffCards').addEventListener('click', e => { const c = e.target.closest('[data-diff]'); if (!c) return; SFX.ui(); profile.difficulty = c.dataset.diff; saveProfile(); openPlay(); });

  // ---------------- armory (loadout + shop) ----------------
  let arm = { mode: 'loadout', tab: 'weapons', sel: profile.loadout.primary, back: 'menu' };
  function openArmory(mode, back = 'menu') {
    arm.mode = mode; arm.back = back; arm.tab = mode === 'intermission' ? 'supplies' : 'weapons';
    if (!WEAPON_BY_ID[arm.sel]) arm.sel = profile.loadout.primary;
    E('armTitle').textContent = mode === 'loadout' ? 'Loadout' : 'Shop';
    E('armSub').textContent = mode === 'intermission' ? `Wave ${run.wave} cleared. Restock, upgrade, then start the next wave when you are ready.` : mode === 'loadout' ? 'Pick your primary and secondary, fit attachments and pick skins. Buy upgrades in the Shop tab.' : 'Unlock weapons, buy attachments and upgrade every gun. Purchases are permanent.';
    renderArmory(); show('armory');
  }
  function supplyItems() {
    const w = Math.max(1, run.wave), s = x => Math.round(x * (1 + w * 0.05) / 5) * 5;
    return [
      { id: 'ammo', name: 'Full ammo restock', desc: 'Refill reserve ammo for both weapons.', price: s(80), ok: () => loadout.some((id, i) => ammo[i].reserve < reserveCap(id)) },
      { id: 'health', name: 'Field repair', desc: 'Restore integrity to full.', price: s(100), ok: () => player.hp < maxHp() },
      { id: 'armor', name: 'Armor plates', desc: '+50 armor (max 100).', price: s(120), ok: () => player.armor < 100 },
      { id: 'frag', name: 'Frag grenade', desc: `Carry up to 5. You have ${player.frags}.`, price: s(60), ok: () => player.frags < 5 },
      { id: 'stun', name: 'Stun grenade', desc: `Stops bots for 3.5 seconds. Carry up to 4. You have ${player.stuns}.`, price: s(60), ok: () => player.stuns < 4 },
      { id: 'airstrike', name: 'Airstrike call-in', desc: 'Adds one airstrike (Z).', price: s(700), ok: () => world.ceiling > 20 },
      { id: 'turret', name: 'Auto-turret crate', desc: 'Adds one turret (X).', price: s(550), ok: () => true },
    ];
  }
  function buySupply(id) {
    const it = supplyItems().find(x => x.id === id); if (!it || !it.ok()) return SFX.deny();
    if (!spendCoins(it.price)) { SFX.deny(); toast('Not enough coins', `${fmt(it.price - profile.coins)} more needed`); return; }
    if (id === 'ammo') refillAmmo(1, false); else if (id === 'health') player.hp = maxHp(); else if (id === 'armor') player.armor = Math.min(100, player.armor + 50);
    else if (id === 'frag') player.frags++; else if (id === 'stun') player.stuns++; else if (id === 'airstrike') run.airstrikes++; else if (id === 'turret') run.turrets++;
    SFX.buy(); renderArmory();
  }
  function statBars(id) {
    const s = weaponStats(id);
    const rows = [
      ['Damage', Math.min(1, s.dmg * s.pellets / 130), Math.round(s.dmg) + (s.pellets > 1 ? `×${s.pellets}` : '')],
      ['Fire rate', Math.min(1, s.rpm / 1000), Math.round(s.rpm) + ' rpm'],
      ['Magazine', Math.min(1, s.mag / 90), s.mag],
      ['Reload', Math.min(1, 1.2 / s.reload * 0.5), s.reload.toFixed(2) + 's'],
      ['Accuracy', Math.max(0.05, 1 - s.spread / 0.08), Math.round((1 - s.spread / 0.08) * 100) + ''],
      ['Recoil', Math.max(0.05, 1 - s.recoil / 0.065), Math.round((1 - s.recoil / 0.065) * 100) + ''],
    ];
    return `<div class="wstats">${rows.map(([l, v, t]) => `<div class="stat">${l}<i style="--v:${(v * 100).toFixed(0)}%"></i><em>${t}</em></div>`).join('')}</div>`;
  }
  function renderArmory() {
    E('armCoins').textContent = fmt(profile.coins);
    const tabs = arm.mode === 'intermission' ? [['supplies', 'Supplies'], ['weapons', 'Weapons'], ['upgrades', 'Upgrades']] : arm.mode === 'loadout' ? [['weapons', 'Loadout'], ['upgrades', 'Shop']] : [['upgrades', 'Upgrades'], ['weapons', 'Loadout']];
    if (!tabs.some(t => t[0] === arm.tab)) arm.tab = tabs[0][0];
    E('armTabs').innerHTML = tabs.map(([k, l]) => `<button class="tab${arm.tab === k ? ' on' : ''}" data-tab="${k}">${l}</button>`).join('');
    const body = E('armBody');
    if (arm.tab === 'supplies') {
      body.innerHTML = `<div class="rows">${supplyItems().map(it => `<div class="row"><div><b>${escapeHtml(it.name)}</b><p>${escapeHtml(it.desc)}</p></div><div class="ctl"><span class="price"><span class="coin"></span>${fmt(it.price)}</span><button class="btn sm${profile.coins >= it.price && it.ok() ? ' primary' : ''}" data-buy-supply="${it.id}" ${it.ok() ? '' : 'disabled'}>${it.ok() ? 'Buy' : 'Full'}</button></div></div>`).join('')}</div>`;
    } else {
      const list = WEAPONS.map(w => {
        const owned = weaponOwned(w.id), eq = profile.loadout.primary === w.id ? 'Primary' : profile.loadout.secondary === w.id ? 'Secondary' : '';
        return `<button class="witem${arm.sel === w.id ? ' on' : ''}" data-sel="${w.id}"><b>${escapeHtml(w.name)}</b><small>${escapeHtml(w.cls)}</small><span class="tag ${eq ? 'eq' : owned ? '' : 'lk'}">${eq || (owned ? 'Owned' : `Lv ${w.level}`)}</span></button>`;
      }).join('');
      body.innerHTML = `<div class="armory"><div class="wlist">${list}</div><div class="wdetail">${arm.tab === 'weapons' ? weaponDetail(arm.sel) : upgradeDetail(arm.sel)}</div></div>`;
    }
    const acts = [];
    if (arm.mode === 'intermission') acts.push(`<button class="btn primary" data-act="ready">Start wave ${run.wave + 1} <small>Enter</small></button>`, `<button class="btn" data-act="close">Back to the field</button>`);
    else acts.push(`<button class="btn primary" data-act="close">Done</button>`);
    E('armActions').innerHTML = acts.join('');
  }
  function weaponDetail(id) {
    const w = WEAPON_BY_ID[id], owned = weaponOwned(id);
    let head = `<div><h3>${escapeHtml(w.name)}</h3><div class="cls">${escapeHtml(w.cls)} · ${w.mode}${w.id === 'sniper' ? ' · 3× headshots' : ''}</div></div>${statBars(id)}`;
    if (!owned) {
      const canBuy = profile.coins >= w.price;
      return head + `<div class="row"><div><b>Locked</b><p>Unlocks free at level ${w.level}, or buy it now.</p></div><div class="ctl"><span class="price"><span class="coin"></span>${fmt(w.price)}</span><button class="btn sm${canBuy ? ' primary' : ''}" data-buy-weapon="${id}">Buy</button></div></div>`;
    }
    const slots = `<div class="slotbtns"><button class="chip${profile.loadout.primary === id ? ' on' : ''}" data-slot="primary" data-w="${id}">Primary · slot 1</button><button class="chip${profile.loadout.secondary === id ? ' on' : ''}" data-slot="secondary" data-w="${id}">Secondary · slot 2</button></div>`;
    const atts = ATT_IDS.map(a => {
      const A = ATTACHMENTS[a], has = attOwned(id, a), on = attOn(id, a);
      const q = QUESTS.find(q => (q.reward.att && q.reward.att[0] === id && q.reward.att[1] === a) || (q.reward.atts || []).some(x => x[0] === id && x[1] === a));
      const how = !has && q ? ` Or earn it: quest “${q.name}”.` : '';
      return `<div class="row"><div><b>${escapeHtml(A.name)}</b><p>${escapeHtml(A.desc + how)}</p></div><div class="ctl">${has ? `<button class="chip${on ? ' on' : ''}" data-toggle="${a}" data-w="${id}">${on ? 'Fitted' : 'Off'}</button>` : `<span class="price"><span class="coin"></span>${fmt(A.price)}</span><button class="btn sm${profile.coins >= A.price ? ' primary' : ''}" data-buy-att="${a}" data-w="${id}">Buy</button>`}</div></div>`;
    }).join('');
    const skins = `<div class="skins">${Object.entries(SKINS).map(([k, s]) => { const has = !!profile.skins[k]; return `<button class="skin${weaponSkin(id) === k ? ' on' : ''}" data-skin="${k}" data-w="${id}" ${has ? '' : 'disabled'} title="${escapeHtml(has ? s.name : s.how)}"><i style="background:linear-gradient(135deg,#${s.poly.toString(16).padStart(6, '0')} 0 45%,#${s.metal.toString(16).padStart(6, '0')} 45% 80%,#${s.accent.toString(16).padStart(6, '0')} 80%)"></i>${escapeHtml(has ? s.name : 'Locked')}</button>`; }).join('')}</div>`;
    return head + slots + `<div class="lbl">Attachments</div><div class="rows">${atts}</div><div class="lbl">Skin</div>${skins}`;
  }
  function upgradeDetail(id) {
    const w = WEAPON_BY_ID[id];
    if (!weaponOwned(id)) return weaponDetail(id);
    const rows = Object.entries(UPGRADES).map(([k, u]) => {
      const lvl = upgradeLevel(id, k), max = lvl >= UP_MAX, cost = upgradeCost(id, k);
      return `<div class="row"><div><b>${u.name}</b><p>${u.desc}</p><div class="pips">${Array.from({ length: UP_MAX }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div></div><div class="ctl">${max ? '<span class="note">Maxed</span>' : `<span class="price"><span class="coin"></span>${fmt(cost)}</span><button class="btn sm${profile.coins >= cost ? ' primary' : ''}" data-up="${k}" data-w="${id}">Upgrade</button>`}</div></div>`;
    }).join('');
    const unowned = ATT_IDS.filter(a => !attOwned(id, a));
    const attRows = unowned.map(a => `<div class="row"><div><b>${escapeHtml(ATTACHMENTS[a].name)}</b><p>${escapeHtml(ATTACHMENTS[a].desc)}</p></div><div class="ctl"><span class="price"><span class="coin"></span>${fmt(ATTACHMENTS[a].price)}</span><button class="btn sm${profile.coins >= ATTACHMENTS[a].price ? ' primary' : ''}" data-buy-att="${a}" data-w="${id}">Buy</button></div></div>`).join('');
    return `<div><h3>${escapeHtml(w.name)}</h3><div class="cls">Upgrade tree</div></div>${statBars(id)}<div class="rows">${rows}</div>${unowned.length ? `<div class="lbl">Attachments for sale</div><div class="rows">${attRows}</div>` : ''}`;
  }
  E('armory').addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    const d = t.dataset;
    if (d.tab) { arm.tab = d.tab; SFX.ui(); return renderArmory(); }
    if (d.sel) { arm.sel = d.sel; SFX.ui(); return renderArmory(); }
    if (d.buySupply) return buySupply(d.buySupply);
    if (d.buyWeapon) { const w = WEAPON_BY_ID[d.buyWeapon]; if (weaponOwned(w.id)) return; if (!spendCoins(w.price)) { SFX.deny(); toast('Not enough coins', `${fmt(w.price - profile.coins)} more needed`); return; } profile.weapons[w.id] = true; saveProfile(); SFX.buy(); toast('Weapon unlocked', w.name, 'drop'); return renderArmory(); }
    if (d.buyAtt) { const A = ATTACHMENTS[d.buyAtt]; if (!spendCoins(A.price)) { SFX.deny(); toast('Not enough coins', `${fmt(A.price - profile.coins)} more needed`); return; } grantAtt(d.w, d.buyAtt); SFX.buy(); loadoutChanged(); return renderArmory(); }
    if (d.toggle) { setAtt(d.w, d.toggle, !attOn(d.w, d.toggle)); SFX.ui(); loadoutChanged(); return renderArmory(); }
    if (d.up) { const cost = upgradeCost(d.w, d.up); if (upgradeLevel(d.w, d.up) >= UP_MAX) return; if (!spendCoins(cost)) { SFX.deny(); toast('Not enough coins', `${fmt(cost - profile.coins)} more needed`); return; } (profile.upgrades[d.w] || (profile.upgrades[d.w] = {}))[d.up] = upgradeLevel(d.w, d.up) + 1; saveProfile(); SFX.buy(); loadoutChanged(); return renderArmory(); }
    if (d.slot) { const other = d.slot === 'primary' ? 'secondary' : 'primary'; if (profile.loadout[other] === d.w) profile.loadout[other] = profile.loadout[d.slot]; profile.loadout[d.slot] = d.w; saveProfile(); SFX.ui(); loadoutChanged(); return renderArmory(); }
    if (d.skin) { profile.skin[d.w] = d.skin; saveProfile(); refreshViewmodel(d.w); SFX.ui(); return renderArmory(); }
    if (d.act === 'ready') { SFX.ui(); closeArmory(); nextWaveNow(); return; }
    if (d.act === 'close') { SFX.ui(); closeArmory(); }
  });
  function closeArmory() { if (arm.mode === 'intermission') resumeFromMenu(); else { show(arm.back); if (arm.back === 'menu') renderProfile(); if (arm.back === 'over') {} } }

  // ---------------- quests ----------------
  let questBack = 'menu';
  function openQuests(back = 'menu') {
    questBack = back;
    E('questList').innerHTML = QUESTS.map(q => { const s = questState(q.id); const p = Math.min(s.p, q.goal); return `<div class="quest${s.done ? ' done' : ''}"><div class="qh"><b>${escapeHtml(q.name)}</b><span class="rw">${escapeHtml(rewardText(q.reward))}</span></div><p>${escapeHtml(q.desc)}</p><div class="qbar"><i style="width:${(p / q.goal * 100).toFixed(1)}%"></i></div><span class="qp">${s.done ? 'Complete' : `${fmt(p)} / ${fmt(q.goal)}`}</span></div>`; }).join('');
    show('quests');
  }
  E('btnQuestBack').addEventListener('click', () => { SFX.ui(); show(questBack); if (questBack === 'menu') renderProfile(); });

  // ---------------- settings ----------------
  let settingsBack = 'menu';
  const sEl = { sens: E('sSens'), fov: E('sFov'), vol: E('sVol'), music: E('sMusic'), dmg: E('sDmg'), invert: E('sInvert') };
  function syncSettings() {
    sEl.sens.value = settings.sens; sEl.fov.value = settings.fov; sEl.vol.value = settings.vol; sEl.music.value = settings.music; sEl.dmg.checked = settings.dmgNumbers; sEl.invert.checked = settings.invert;
    E('oSens').textContent = (+settings.sens).toFixed(2); E('oFov').textContent = settings.fov + '°'; E('oVol').textContent = Math.round(settings.vol * 100) + '%'; E('oMusic').textContent = Math.round(settings.music * 100) + '%';
    E('sQuality').querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.q === settings.quality));
  }
  function applySettingsUI() {
    settings.sens = +sEl.sens.value; settings.fov = +sEl.fov.value; settings.vol = +sEl.vol.value; settings.music = +sEl.music.value; settings.dmgNumbers = sEl.dmg.checked; settings.invert = sEl.invert.checked;
    SFX.setVolumes(); saveSettings(); syncSettings();
    if (!settings.dmgNumbers) hideDamageNumbers();
  }
  Object.values(sEl).forEach(el => el.addEventListener('input', applySettingsUI));
  E('sQuality').addEventListener('click', e => { const c = e.target.closest('[data-q]'); if (!c) return; settings.quality = c.dataset.q; saveSettings(); applyQuality(); syncSettings(); SFX.ui(); });
  function openSettings(back = 'menu') { settingsBack = back; syncSettings(); show('settings'); }
  E('btnSetBack').addEventListener('click', () => { SFX.ui(); show(settingsBack); if (settingsBack === 'menu') renderProfile(); });

  // ---------------- buff choice ----------------
  let buffChoices = [];
  function openBuffs(choices, title, sub) {
    buffChoices = choices;
    E('buffTitle').textContent = title; E('buffSub').textContent = sub;
    E('buffCards').innerHTML = choices.map((k, i) => { const b = BUFFS[k], n = run.buffs[k] || 0; return `<button class="bcard" data-buff="${k}"><span class="ic">${buffIcon(k, 42)}</span><b>${escapeHtml(b.name)}</b><p>${escapeHtml(b.desc)}</p><span class="have">${n ? `Stack ${n} → ${n + 1}` : ''}</span><kbd>${i + 1}</kbd></button>`; }).join('');
    show('buffs');
  }
  E('buffCards').addEventListener('click', e => { const c = e.target.closest('[data-buff]'); if (c) chooseBuff(c.dataset.buff); });
  function buffKey(n) { if (!screens.buffs.hidden && buffChoices[n]) chooseBuff(buffChoices[n]); }

  // ---------------- game over ----------------
  function showOver(s) {
    E('overTitle').textContent = s.quit ? 'Run abandoned' : 'Overrun';
    E('overSub').textContent = s.quit ? `You pulled out on wave ${s.wave} on ${s.map}.` : `The line broke on wave ${s.wave} at ${s.map} (${s.diff}).`;
    E('newBest').hidden = !s.newBest;
    E('oWave').textContent = s.wave; E('oScore').textContent = fmt(s.score); E('oKills').textContent = fmt(s.kills); E('oHeads').textContent = fmt(s.heads);
    E('oAcc').textContent = s.acc + '%'; E('oCoins').textContent = '+' + fmt(s.coins); E('oXp').textContent = '+' + fmt(s.xp);
    const t = Math.floor(s.time); E('oTime').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    const need = xpForLevel(profile.level);
    E('oLvl').textContent = `Level ${profile.level}${s.levels ? ` · +${s.levels} this run` : ''}`; E('oLvlTxt').textContent = `${fmt(profile.xp)} / ${fmt(need)} XP`;
    E('oXpBar').style.transform = 'scaleX(0)'; setTimeout(() => { E('oXpBar').style.transform = `scaleX(${profile.xp / need})`; }, 80);
    const lines = [];
    if (s.quests.length) lines.push(`Quests completed: <b>${s.quests.map(escapeHtml).join(', ')}</b>`);
    if (s.drops.length) lines.push(`Rare drops: <b>${s.drops.map(escapeHtml).join(', ')}</b>`);
    const newMaps = MAPS.filter(m => m.unlock && mapUnlocked(m) && !s.mapsBefore.includes(m.id)).map(m => m.name);
    if (newMaps.length) lines.push(`New map unlocked: <b>${newMaps.map(escapeHtml).join(', ')}</b>`);
    E('overList').innerHTML = lines.join('<br>');
    show('over');
  }

  return { h, show, hideAll, banner, toast, prompt, streak, hitmarker, dmgIndicator, killfeed, update, renderProfile, openPlay, openArmory, renderArmory, openQuests, openSettings, openBuffs, buffKey, showOver,
    flash(a) { flashA = Math.max(flashA, a); }, hurt() { hurtA = 1; }, get armoryOpen() { return !screens.armory.hidden; } };
})();
