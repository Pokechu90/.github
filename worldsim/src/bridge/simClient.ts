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

  private nextRequest = 1;

  /** Sends a request and waits for the matching reply (by requestId). */
  request<T extends 'npcContext' | 'focusContexts'>(
    msg: ToSim & { requestId: number },
    replyType: T,
  ): Promise<Extract<FromSim, { type: T }>> {
    const requestId = this.nextRequest++;
    return new Promise((resolve) => {
      const handler = (e: MessageEvent<FromSim>) => {
        const d = e.data as FromSim & { requestId?: number };
        if (d.type === replyType && d.requestId === requestId) {
          this.worker.removeEventListener('message', handler);
          resolve(d as Extract<FromSim, { type: T }>);
        }
      };
      this.worker.addEventListener('message', handler);
      this.worker.postMessage({ ...msg, requestId });
    });
  }

  on<T extends FromSim['type']>(type: T, handler: Handler<T>): void {
    ((this.handlers[type] ??= []) as Handler<T>[]).push(handler);
  }
}
