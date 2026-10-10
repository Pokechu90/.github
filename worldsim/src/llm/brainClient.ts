/**
 * The game's side of the LLM connection.
 *
 * - Talks to the brain server (which holds the API key).
 * - Enforces the player's "max LLM calls per minute" setting, with chat
 *   always taking priority over background NPC thinking.
 * - Falls back to offline replies when the server or LLM isn't available.
 */
import type { ChatRequest, ChatResult, DecideRequest, DecideResult } from '../shared/llm';
import { loadSettings, saveSettings, type LlmSettings } from './settings';
import { offlineReply } from './offline';

export interface BrainStatus {
  online: boolean;
  provider: string;
  model: string;
  message: string;
  usedThisMinute: number;
}

export class BrainClient {
  settings: LlmSettings = loadSettings();
  status: BrainStatus = { online: false, provider: '', model: '', message: 'Checking…', usedThisMinute: 0 };
  private calls: number[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    void this.checkHealth();
    setInterval(() => void this.checkHealth(), 30_000);
  }

  onChange(fn: () => void): void {
    this.listeners.push(fn);
  }

  private emit(): void {
    this.listeners.forEach((f) => f());
  }

  updateSettings(s: Partial<LlmSettings>): void {
    this.settings = { ...this.settings, ...s };
    saveSettings(this.settings);
    void this.checkHealth();
  }

  private url(path: string): string {
    const base = this.settings.serverUrl.replace(/\/$/, '');
    return `${base}${path}`;
  }

  async checkHealth(): Promise<void> {
    try {
      const res = await fetch(this.url('/api/health'), { signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error(String(res.status));
      const h = (await res.json()) as { provider: string; model: string; configured: boolean };
      this.status = {
        ...this.status,
        online: h.configured,
        provider: h.provider,
        model: h.model,
        message: h.configured ? `Connected: ${h.provider} / ${h.model}` : 'Brain server is running but has no LLM configured (add a key to .env). Using offline replies.',
      };
    } catch {
      this.status = { ...this.status, online: false, provider: '', model: '', message: 'No brain server found. NPCs use simple offline replies. (Run "npm run dev" with an API key in .env.)' };
    }
    this.emit();
  }

  /** Requests left this minute under the player's limit. */
  budget(): number {
    const cutoff = Date.now() - 60_000;
    this.calls = this.calls.filter((t) => t > cutoff);
    this.status.usedThisMinute = this.calls.length;
    return this.settings.maxCallsPerMinute - this.calls.length;
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    if (!this.status.online || this.budget() <= 0) {
      return offlineReply(req);
    }
    this.calls.push(Date.now());
    this.emit();
    try {
      const res = await fetch(this.url('/api/npc/chat'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return { ...((await res.json()) as ChatResult), source: 'llm' };
    } catch (err) {
      console.warn('LLM chat failed, using offline reply:', err);
      return offlineReply(req);
    }
  }

  /** Background thinking: only when enabled and there's spare budget (keeps 2 calls for chat). */
  canThink(): boolean {
    return this.status.online && this.settings.npcThinking && this.budget() > 2;
  }

  async decide(req: DecideRequest): Promise<DecideResult | null> {
    if (!this.canThink()) return null;
    this.calls.push(Date.now());
    this.emit();
    try {
      const res = await fetch(this.url('/api/npc/decide'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) return null;
      return (await res.json()) as DecideResult;
    } catch {
      return null;
    }
  }
}
