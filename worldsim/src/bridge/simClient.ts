/**
 * The page's handle on the simulation worker. Everything the page wants from
 * the world goes through here as a message; nothing is shared directly.
 */
import type { FromSim, ToSim } from '../shared/protocol';

type Handler<T extends FromSim['type']> = (msg: Extract<FromSim, { type: T }>) => void;

export class SimClient {
  private worker = new Worker(new URL('../sim/worker.ts', import.meta.url), { type: 'module' });
  private handlers: { [K in FromSim['type']]?: Handler<K>[] } = {};

  constructor() {
    this.worker.onmessage = (e: MessageEvent<FromSim>) => {
      const list = this.handlers[e.data.type] as Handler<typeof e.data.type>[] | undefined;
      list?.forEach((h) => h(e.data as never));
    };
    this.worker.onerror = (e) => console.error('Simulation worker error:', e.message);
  }

  send(msg: ToSim): void {
    this.worker.postMessage(msg);
  }

  on<T extends FromSim['type']>(type: T, handler: Handler<T>): void {
    ((this.handlers[type] ??= []) as Handler<T>[]).push(handler);
  }
}
