/**
 * The game's side of the LLM connection.
 *
 * - Talks to the brain server (which holds the API key).
 * - Enforces the player's "max LLM calls per minute" setting, with chat
 *   always taking priority over background NPC thinking.
 * - Falls back to offline replies when the server or LLM isn't available.
 */
import { CHAT_SYSTEM, EMOTIONS, INTENTS, chatUserPrompt, sanitizeChat, type ChatRequest, type ChatResult, type DecideRequest, type DecideResult } from '../shared/llm';
import { loadSettings, saveSettings, type LlmSettings } from './settings';
import { offlineReply } from './offline';

export interface BrainStatus {
  online: boolean;
  provider: string;
  model: string;
  message: string;
  usedThisMinute: number;
}

/**
 * When the game is opened as a claude.ai artifact, the page can ask Claude
 * directly on the viewer's own account (they're asked for permission on the
 * first chat). No server or API key needed. Typed loosely: it only exists there.
 */
type SampleFn = { json: (input: string, opts?: object) => Promise<unknown> };
interface ClaudeHost {
  use(name: string): Promise<unknown>;
}

export class BrainClient {
  settings: LlmSettings = loadSettings();
  /** Claude via the claude.ai artifact runtime, if available. */
  private sample: SampleFn | null = null;
  /** Which brain answers: our server, Claude through claude.ai, or nobody (offline). */
  mode: 'server' | 'claude.ai' | 'offline' = 'offline';
  status: BrainStatus = { online: false, provider: '', model: '', message: 'Checking…', usedThisMinute: 0 };
  private calls: number[] = [];
  private listeners: Array<() => void> = [];

  constructor() {
    void this.detectSample();
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

  private async detectSample(): Promise<void> {
    const host = (window as unknown as { claude?: ClaudeHost }).claude;
    if (!host?.use) return;
    try {
      const s = (await host.use('sample')) as SampleFn | null;
      if (s) {
        this.sample = s;
        void this.checkHealth();
      }
    } catch {
      /* not available here */
    }
  }

  private useSampleStatus(): void {
    this.mode = 'claude.ai';
    this.status = {
      ...this.status,
      online: true,
      provider: 'claude.ai',
      model: 'your Claude account',
      message: 'NPCs talk using Claude through your claude.ai account (you will be asked to allow it on your first chat). Background NPC thinking needs the brain server.',
    };
  }

  async checkHealth(): Promise<void> {
    // Hosted as a claude.ai artifact without a custom server: use Claude directly.
    if (this.sample && !this.settings.serverUrl) {
      this.useSampleStatus();
      this.emit();
      return;
    }
    try {
      const res = await fetch(this.url('/api/health'), { signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error(String(res.status));
      const h = (await res.json()) as { provider: string; model: string; configured: boolean };
      this.mode = h.configured ? 'server' : 'offline';
      this.status = {
        ...this.status,
        online: h.configured,
        provider: h.provider,
        model: h.model,
        message: h.configured ? `Connected: ${h.provider} / ${h.model}` : 'Brain server is running but has no LLM configured (add a key to .env). Using offline replies.',
      };
    } catch {
      if (this.sample) this.useSampleStatus();
      else {
        this.mode = 'offline';
        this.status = { ...this.status, online: false, provider: '', model: '', message: 'No brain server found. NPCs use simple offline replies. (Run "npm run dev" with an API key in .env.)' };
      }
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
    if (this.mode === 'claude.ai' && this.sample) return this.chatViaClaudeAi(req);
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

  private async chatViaClaudeAi(req: ChatRequest): Promise<ChatResult> {
    const prompt = `${CHAT_SYSTEM}\n\n${chatUserPrompt(req)}\n\nReply with only a JSON object with exactly these fields: ` +
      `"reply" (string, what they say), "emotion" (one of ${EMOTIONS.join(', ')}), "affinity_change" (number from -0.3 to 0.3), ` +
      `"remember" (one first-person sentence to remember, or ""), "importance" (0 to 1), "intent" (one of ${INTENTS.join(', ')}), ` +
      `"new_goal" (string, or ""), "lied" (boolean).`;
    try {
      const raw = await this.sample!.json(prompt, { modelTier: 'quick', cache: false });
      return { ...sanitizeChat((raw ?? {}) as Partial<ChatResult>), source: 'llm' };
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared' || code === 'capability_disabled') {
        // The viewer said no (or it's unavailable): stay offline for this visit.
        this.sample = null;
        void this.checkHealth();
      }
      return offlineReply(req);
    }
  }

  /** Background thinking: only with our own server, when enabled and there's spare budget (keeps 2 calls for chat). */
  canThink(): boolean {
    return this.mode === 'server' && this.status.online && this.settings.npcThinking && this.budget() > 2;
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
