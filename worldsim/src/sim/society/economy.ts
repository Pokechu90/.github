/**
 * Economy: supply and demand set prices in each settlement; with currency,
 * workers earn wages for what they bring in and spend money on goods.
 * Traders carry surplus to where it's scarce and bring back what's cheap,
 * spreading knowledge (and sometimes disease) along the way.
 */
import { RESOURCES } from '../../shared/people';
import type { Npc, ResourceType, Settlement } from '../state';
import type { World } from '../world';
import { deliver, walkTo } from '../npc/actions';
import { fullName } from '../npc/people';
import { remember } from '../npc/memory';
import { infect } from '../npc/health';
import { hasTech, shareKnowledge } from './tech';
import { population } from './work';

const BASE_PRICE: Record<ResourceType, number> = {
  fruit: 1, grain: 1.2, meat: 2, fish: 1.5, wood: 1, stone: 1.2, tools: 6, cloth: 4, metal: 10, goods: 8,
};
/** How much of each resource a settlement "wants" in store per person. */
const WANT_PER_PERSON: Record<ResourceType, number> = {
  fruit: 3, grain: 8, meat: 2, fish: 2, wood: 3, stone: 2, tools: 0.6, cloth: 1, metal: 0.3, goods: 1.5,
};
const TRADE_RANGE = 220;
const CARGO = 20;

export function updatePricesDaily(world: World, s: Settlement): void {
  const pop = Math.max(1, population(world, s));
  for (const k of Object.keys(BASE_PRICE) as ResourceType[]) {
    const want = WANT_PER_PERSON[k] * pop + 5;
    const ratio = Math.max(0.25, Math.min(4, want / (s.stock[k] + 1)));
    s.prices[k] = +(BASE_PRICE[k] * Math.pow(ratio, 0.6)).toFixed(2);
  }
}

export function price(s: Settlement, k: ResourceType): number {
  return s.prices[k] ?? BASE_PRICE[k];
}

/** Wages: when someone brings goods to the stores, they earn a share of the value. */
export function payWage(world: World, n: Npc, k: ResourceType, amount: number): void {
  const s = world.settlement(n.settlementId);
  if (!s || !hasTech(s, 'currency')) return;
  const value = amount * price(s, k);
  const tax = s.laws.includes('Trade tax') ? 0.2 : 0.1;
  n.wealth += value * 0.25 * (1 - tax);
  s.treasury += value * 0.25 * tax;
}

/** Once a day, people with money buy goods (small luxuries), which lifts their mood. */
export function spendDaily(world: World, s: Settlement): void {
  if (!hasTech(s, 'currency')) return;
  const p = price(s, 'goods');
  for (const n of world.residentsOf(s.id)) {
    if (n.wealth > p * 2 && s.stock.goods >= 0.2) {
      n.wealth -= p * 0.2;
      s.treasury += p * 0.2;
      s.stock.goods -= 0.2;
      n.needs.purpose = Math.max(0, n.needs.purpose - 0.05);
    }
  }
}

function partners(world: World, s: Settlement): Settlement[] {
  return world.state.settlements.filter(
    (o) => o !== s && !o.abandoned && Math.hypot(o.x - s.x, o.y - s.y) < TRADE_RANGE && (s.diplomacy[o.id] ?? 0) > -0.3,
  );
}

export function traderDemand(world: World, s: Settlement, workers: number): number {
  if (!partners(world, s).length || workers < 8) return 0;
  return Math.max(1, Math.round(workers * (hasTech(s, 'currency') ? 0.06 : 0.03)));
}

/** Best deal: export what's cheap here and dear there. */
function bestDeal(world: World, home: Settlement): { to: Settlement; out: ResourceType; amount: number } | null {
  let best: { to: Settlement; out: ResourceType; amount: number; gain: number } | null = null;
  const pop = Math.max(1, population(world, home));
  for (const to of partners(world, home)) {
    for (const k of Object.keys(BASE_PRICE) as ResourceType[]) {
      const surplus = home.stock[k] - WANT_PER_PERSON[k] * pop;
      if (surplus < 5) continue;
      const gain = price(to, k) / price(home, k);
      if (gain > 1.15 && (!best || gain > best.gain)) best = { to, out: k, amount: Math.min(CARGO * (hasTech(home, 'currency') ? 1.5 : 1), surplus), gain };
    }
  }
  return best;
}

export function tryTradeTask(world: World, n: Npc, task: string): boolean {
  if (task !== 'trade') return false;
  const home = world.settlement(n.settlementId);
  if (!home) return false;
  const deal = bestDeal(world, home);
  if (!deal) return false;
  home.stock[deal.out] -= deal.amount;
  n.carrying = { type: deal.out, amount: deal.amount };
  const ok = walkTo(world, n, deal.to.x + 1.5, deal.to.y + 1.5, 'work', { task: 'trade-sell', targetId: deal.to.id });
  if (!ok) {
    home.stock[deal.out] += deal.amount;
    n.carrying = null;
  }
  return ok;
}

export function doTradeWork(world: World, n: Npc): void {
  const a = n.action;
  if (a.task === 'trade-sell') {
    const to = world.settlement(a.targetId ?? -1);
    const home = world.settlement(n.settlementId);
    if (!to || !home || !n.carrying) {
      n.action = { kind: 'idle', timer: 5 };
      return;
    }
    // Sell the cargo...
    const k = n.carrying.type;
    const value = n.carrying.amount * price(to, k);
    to.stock[k] += n.carrying.amount;
    n.carrying = null;
    // ...and buy whatever is cheapest here compared to home, for the same value.
    let buy: ResourceType | null = null;
    let bestGain = 1.1;
    for (const r of Object.keys(BASE_PRICE) as ResourceType[]) {
      const avail = to.stock[r] - WANT_PER_PERSON[r] * population(world, to);
      if (avail < 3) continue;
      const gain = price(home, r) / price(to, r);
      if (gain > bestGain) {
        bestGain = gain;
        buy = r;
      }
    }
    if (buy) {
      const amt = Math.min(CARGO * 1.5, value / price(to, buy), to.stock[buy]);
      to.stock[buy] -= amt;
      n.carrying = { type: buy, amount: amt };
    }
    if (hasTech(home, 'currency')) {
      n.wealth += value * 0.05;
      const tax = to.laws.includes('Trade tax') ? 0.1 : 0.03;
      to.treasury += value * tax;
    }
    // Contact: ideas and relations travel with merchants, and so do germs.
    shareKnowledge(world, to, home, 0.3);
    shareKnowledge(world, home, to, 0.3);
    home.diplomacy[to.id] = Math.min(1, (home.diplomacy[to.id] ?? 0) + 0.04);
    to.diplomacy[home.id] = Math.min(1, (to.diplomacy[home.id] ?? 0) + 0.04);
    const locals = world.residentsOf(to.id);
    const sick = locals.find((p) => p.illness);
    if (sick && world.rand() < 0.15) infect(world, n, sick.illness!.disease, sick);
    if (n.illness && locals.length && world.rand() < 0.15) infect(world, locals[Math.floor(world.rand() * locals.length)], n.illness.disease, n);
    remember(world, n, `I traded ${RESOURCES[k].name.toLowerCase()} in ${to.name}.`, { importance: 0.25, feeling: 0.3, share: `${n.firstName} came back from trading in ${to.name}.` });
    if (world.rand() < 0.02) world.log(`${fullName(n)} of ${home.name} opened a trade route with ${to.name}.`, 'economy', n.id);
    // Head home.
    if (!walkTo(world, n, home.x + 1, home.y + 1, 'work', { task: 'trade-return' })) n.action = { kind: 'idle', timer: 10 };
    return;
  }
  if (a.task === 'trade-return') {
    deliver(world, n);
  }
}

/** A whole trade trip resolved at once (for settlements far from the camera). */
export function abstractTrade(world: World, home: Settlement): void {
  const deal = bestDeal(world, home);
  if (!deal) return;
  const { to, out, amount } = deal;
  home.stock[out] -= amount;
  to.stock[out] += amount;
  const value = amount * price(to, out);
  let buy: ResourceType | null = null;
  let bestGain = 1.1;
  for (const r of Object.keys(BASE_PRICE) as ResourceType[]) {
    const avail = to.stock[r] - WANT_PER_PERSON[r] * population(world, to);
    if (avail < 3) continue;
    const gain = price(home, r) / price(to, r);
    if (gain > bestGain) {
      bestGain = gain;
      buy = r;
    }
  }
  if (buy) {
    const amt = Math.min(CARGO * 1.5, value / price(to, buy), to.stock[buy]);
    to.stock[buy] -= amt;
    home.stock[buy] += amt;
  }
  shareKnowledge(world, to, home, 0.3);
  shareKnowledge(world, home, to, 0.3);
  home.diplomacy[to.id] = Math.min(1, (home.diplomacy[to.id] ?? 0) + 0.04);
  to.diplomacy[home.id] = Math.min(1, (to.diplomacy[home.id] ?? 0) + 0.04);
}
