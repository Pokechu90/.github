/**
 * Plugs the civilisation systems (work, technology, economy, governance,
 * migration) into the world's extension points.
 */
import type { World } from '../world';
import { civDaily, civJobDemand, doCivWork, techName, tryCivTask } from './work';
import { practice } from './tech';
import { doTradeWork, payWage, spendDaily, traderDemand, tryTradeTask, updatePricesDaily } from './economy';
import { governanceDaily } from './governance';
import { canMigrate, exile, immigrationDaily, migrationDaily, requestMigration } from './migration';

export function installCivilization(world: World): void {
  const h = world.hooks;
  h.tryTask = tryCivTask;
  h.doWork = doCivWork;
  h.jobDemand = civJobDemand;
  h.techName = techName;
  h.onPractice = practice;
  h.tryTradeTask = tryTradeTask;
  h.doTradeWork = (w, n) => doTradeWork(w, n);
  h.traderDemand = traderDemand;
  h.onDelivered = payWage;
  h.canMigrate = canMigrate;
  h.requestMigration = requestMigration;
  h.exile = exile;
  h.daily!.push(
    civDaily,
    (w) => {
      for (const s of w.state.settlements) {
        if (s.abandoned) continue;
        updatePricesDaily(w, s);
        spendDaily(w, s);
      }
    },
    governanceDaily,
    migrationDaily,
    immigrationDaily,
  );
}
