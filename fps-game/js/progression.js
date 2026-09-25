'use strict';
// XP and levels, level rewards, quests, run buffs, coins and unlock grants.

// ---------------- run state (reset every deploy) ----------------
const run = {
  active: false, wave: 0, score: 0, kills: 0, heads: 0, shots: 0, hits: 0, time: 0,
  coins: 0, xp: 0, buffs: {}, questsDone: [], levelsGained: 0, dmgThisWave: 0, bossDmgTaken: 0, streak: 0, killstreak: 0,
  airstrikes: 0, turrets: 0, multiT: 0, multi: 0, diff: 'normal', map: 'yard', drops: [],
};
function resetRun() {
  Object.assign(run, { active: true, wave: 0, score: 0, kills: 0, heads: 0, shots: 0, hits: 0, time: 0, coins: 0, xp: 0, buffs: {}, questsDone: [], levelsGained: 0, dmgThisWave: 0, bossDmgTaken: 0, streak: 0, killstreak: 0, airstrikes: 0, turrets: 0, multiT: 0, multi: 0, drops: [] });
  run.diff = profile.difficulty; run.map = profile.map;
}

// ---------------- levels ----------------
function xpForLevel(L) { return Math.round(500 + 250 * (L - 1) + 40 * (L - 1) * (L - 1)); }
const LEVEL_REWARDS = {
  2: { coins: 150 }, 3: { weapon: 'shotgun' }, 4: { skin: 'desert' }, 5: { weapon: 'burst' }, 6: { coins: 400, att: ['pistol', 'reddot'] },
  7: { weapon: 'sniper' }, 8: { coins: 500 }, 10: { weapon: 'lmg' }, 12: { coins: 1000 }, 14: { weapon: 'plasma' }, 16: { coins: 1500 }, 20: { skin: 'gold' },
};
function rewardText(r) {
  const out = [];
  if (r.coins) out.push(`${fmt(r.coins)} coins`);
  if (r.weapon) out.push(WEAPON_BY_ID[r.weapon].name);
  if (r.skin) out.push(`${SKINS[r.skin].name} skin`);
  if (r.att) out.push(`${ATTACHMENTS[r.att[1]].name} (${WEAPON_BY_ID[r.att[0]].short})`);
  if (r.atts) out.push(r.atts.map(a => `${ATTACHMENTS[a[1]].short} ${WEAPON_BY_ID[a[0]].short}`).join(', '));
  if (r.xp) out.push(`${fmt(r.xp)} XP`);
  return out.join(' · ');
}
function grantReward(r, silent) {
  if (r.coins) addCoins(r.coins, null, { raw: true, silent: true });
  if (r.weapon && !profile.weapons[r.weapon]) profile.weapons[r.weapon] = true;
  if (r.skin) profile.skins[r.skin] = true;
  if (r.att) grantAtt(r.att[0], r.att[1]);
  if (r.atts) r.atts.forEach(a => grantAtt(a[0], a[1]));
  if (r.xp) addXp(r.xp, { raw: true });
  saveProfile();
  void silent;
}
function addXp(n, o = {}) {
  n = Math.round(n * (o.raw ? 1 : DIFFICULTY[run.diff].reward));
  if (n <= 0) return;
  profile.xp += n; if (run.active) run.xp += n;
  while (profile.xp >= xpForLevel(profile.level)) {
    profile.xp -= xpForLevel(profile.level); profile.level++;
    if (run.active) run.levelsGained++;
    const r = Object.assign({ coins: 100 }, LEVEL_REWARDS[profile.level] || {});
    if (LEVEL_REWARDS[profile.level] && LEVEL_REWARDS[profile.level].coins) r.coins = LEVEL_REWARDS[profile.level].coins + 100;
    grantReward(r);
    const unlockedMaps = MAPS.filter(m => m.unlock && m.unlock.level === profile.level && profile.stats.bestWave < m.unlock.wave).map(m => m.name);
    bus.emit('levelup', { level: profile.level, text: rewardText(r) + (unlockedMaps.length ? ` · map: ${unlockedMaps.join(', ')}` : '') });
  }
  saveProfile();
}

// ---------------- coins ----------------
function addCoins(n, pos, o = {}) {
  if (!o.raw) n = n * DIFFICULTY[run.diff].reward * (1 + 0.15 * (run.buffs.prospector || 0));
  n = Math.round(n);
  if (n <= 0) return 0;
  profile.coins += n; if (run.active && !o.noRun) run.coins += n;
  saveProfile();
  if (!o.silent) bus.emit('coins', { n, pos });
  return n;
}
function spendCoins(n) {
  if (profile.coins < n) return false;
  profile.coins -= n; profile.stats.spent += n; saveProfile();
  questEvent('spent', n);
  return true;
}

// ---------------- quests ----------------
const QUESTS = [
  { id: 'first', name: 'First contact', desc: 'Destroy 50 robots.', goal: 50, ev: 'kill', reward: { coins: 250 } },
  { id: 'headhunter', name: 'Headhunter', desc: 'Land 25 headshot kills.', goal: 25, ev: 'headshot', reward: { att: ['rifle', 'reddot'], coins: 150 } },
  { id: 'wasp', name: 'Wasp swarm', desc: 'Destroy 100 robots with the Wasp MX.', goal: 100, ev: 'kill', weapon: 'smg', reward: { atts: [['smg', 'reddot'], ['smg', 'extmag']] } },
  { id: 'holdout', name: 'Holdout', desc: 'Survive to wave 10.', goal: 10, ev: 'wave', max: true, reward: { coins: 600, xp: 500 } },
  { id: 'untouchable', name: 'Untouchable', desc: 'Defeat a boss without taking damage during its fight.', goal: 1, ev: 'bossFlawless', reward: { skin: 'gold', coins: 500 } },
  { id: 'slayer', name: 'Giant slayer', desc: 'Defeat 3 bosses.', goal: 3, ev: 'boss', reward: { weapon: 'plasma' } },
  { id: 'demo', name: 'Demolition', desc: 'Destroy 30 robots with explosives.', goal: 30, ev: 'explosiveKill', reward: { coins: 400 } },
  { id: 'marksman', name: 'Marksman', desc: 'Destroy 50 robots with the Longreach R2.', goal: 50, ev: 'kill', weapon: 'sniper', reward: { atts: [['sniper', 'reddot'], ['sniper', 'silencer']] } },
  { id: 'pump', name: 'Close quarters', desc: 'Destroy 75 robots with the Breaker 12.', goal: 75, ev: 'kill', weapon: 'shotgun', reward: { atts: [['shotgun', 'reddot'], ['shotgun', 'grip']] } },
  { id: 'sharp', name: 'Sharpshooter', desc: 'Land 150 headshot kills.', goal: 150, ev: 'headshot', reward: { skin: 'circuit', coins: 500 } },
  { id: 'flawless', name: 'Clean sweep', desc: 'Clear 5 waves without taking damage.', goal: 5, ev: 'flawless', reward: { coins: 500 } },
  { id: 'streaker', name: 'Air support', desc: 'Earn an airstrike killstreak.', goal: 1, ev: 'airstrike', reward: { coins: 300 } },
  { id: 'veteran', name: 'Veteran', desc: 'Survive to wave 20.', goal: 20, ev: 'wave', max: true, reward: { skin: 'crimson', coins: 1500 } },
  { id: 'spender', name: 'Big spender', desc: 'Spend 5,000 coins.', goal: 5000, ev: 'spent', reward: { skin: 'arctic' } },
  { id: 'rifleman', name: 'Rifleman', desc: 'Destroy 150 robots with the Vanguard KR7.', goal: 150, ev: 'kill', weapon: 'rifle', reward: { atts: [['rifle', 'grip'], ['rifle', 'extmag']] } },
  { id: 'hardcore', name: 'Hard target', desc: 'Reach wave 10 on Hard.', goal: 10, ev: 'wave', max: true, diff: 'hard', reward: { coins: 2000, skin: 'scorch' } },
];
function questState(id) { return profile.quests[id] || (profile.quests[id] = { p: 0, done: false }); }
function questEvent(ev, amount = 1, extra = {}) {
  for (const q of QUESTS) {
    if (q.ev !== ev) continue;
    const st = questState(q.id); if (st.done) continue;
    if (q.weapon && q.weapon !== extra.weapon) continue;
    if (q.diff && q.diff !== run.diff) continue;
    st.p = q.max ? Math.max(st.p, amount) : st.p + amount;
    if (st.p >= q.goal) {
      st.p = q.goal; st.done = true;
      grantReward(q.reward);
      if (run.active) run.questsDone.push(q.name);
      bus.emit('quest', { q, text: rewardText(q.reward) });
    }
  }
  saveProfile();
}
function questsDoneCount() { return QUESTS.filter(q => questState(q.id).done).length; }

// ---------------- run buffs ----------------
const BUFFS = {
  reload: { name: 'Quick hands', desc: 'Reload 15% faster.', max: 4, icon: 'M4 12a8 8 0 1 0 3-6.2M4 4v4h4', color: '#6db4ff' },
  rate: { name: 'Hair trigger', desc: 'Fire 10% faster.', max: 4, icon: 'M5 19 19 5M9 5h10v10', color: '#f5a524' },
  damage: { name: 'Hollow points', desc: 'Deal 10% more damage.', max: 6, icon: 'M12 3l3 6 6 .8-4.5 4.3 1 6.4L12 17l-5.5 3.5 1-6.4L3 9.8 9 9z', color: '#ff4a3d' },
  health: { name: 'Reinforced frame', desc: '+20 max integrity and heal 20.', max: 5, icon: 'M12 5v14M5 12h14', color: '#39d0b0' },
  speed: { name: 'Servo legs', desc: 'Move 8% faster.', max: 4, icon: 'M4 17h6l3-10 3 10h4', color: '#b48cff' },
  mag: { name: 'Deep mags', desc: '+20% magazine size.', max: 4, icon: 'M8 3h8v18H8zM8 9h8M8 15h8', color: '#ffd24a' },
  regen: { name: 'Nanite repair', desc: 'Regenerate 2 integrity per second, always.', max: 4, icon: 'M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z', color: '#39d0b0' },
  head: { name: 'Headhunter', desc: '+0.3× headshot damage multiplier.', max: 4, icon: 'M12 3a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM12 9v.01M3 21h18', color: '#ffb13b' },
  leech: { name: 'Leech rounds', desc: 'Heal for 3% of the damage you deal.', max: 4, icon: 'M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z', color: '#ff7a9a' },
  prospector: { name: 'Prospector', desc: 'Earn 15% more coins.', max: 5, icon: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7v10M9 9.5c0-1 1.3-1.5 3-1.5s3 .7 3 1.8-6 1.4-6 3.2c0 1 1.3 1.8 3 1.8s3-.6 3-1.6', color: '#ffd24a' },
  blast: { name: 'Blast kit', desc: '+25% explosive damage and +1 frag.', max: 4, icon: 'M12 8a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM14 8l3-4M17 4h3', color: '#ff7a2e' },
  plating: { name: 'Ablative plating', desc: '+30 armor now and 10% less damage taken.', max: 3, icon: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z', color: '#6db4ff' },
};
function rollBuffs(n = 3) {
  const pool = Object.keys(BUFFS).filter(k => (run.buffs[k] || 0) < BUFFS[k].max);
  return shuffle(pool).slice(0, n);
}
function buffIcon(k, size = 20) { const b = BUFFS[k]; return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${b.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${b.icon}"/></svg>`; }
// combined multipliers for the current run
function buffMods() {
  const b = run.buffs, pu = typeof powerups !== 'undefined' ? powerups : {};
  return {
    reload: Math.pow(0.85, b.reload || 0), rate: 1 + 0.1 * (b.rate || 0), damage: (1 + 0.1 * (b.damage || 0)) * (pu.damage > 0 ? 2 : 1),
    maxHp: 100 + 20 * (b.health || 0), speed: (1 + 0.08 * (b.speed || 0)) * (pu.speed > 0 ? 1.35 : 1), mag: 1 + 0.2 * (b.mag || 0),
    regen: 2 * (b.regen || 0), head: 0.3 * (b.head || 0), leech: 0.03 * (b.leech || 0), blast: 1 + 0.25 * (b.blast || 0),
    armorMul: Math.pow(0.9, b.plating || 0), infinite: pu.ammo > 0,
  };
}
