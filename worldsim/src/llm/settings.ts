/** Player-adjustable LLM settings, remembered in this browser. */
export interface LlmSettings {
  /** Where the brain server is. Empty = same site (/api), which works with `npm run dev`. */
  serverUrl: string;
  /** Hard cap on LLM requests per minute from this game (chat + NPC thinking). */
  maxCallsPerMinute: number;
  /** Let the LLM choose goals for NPCs near the camera. */
  npcThinking: boolean;
}

const KEY = 'worldsim.llm';
const DEFAULTS: LlmSettings = { serverUrl: '', maxCallsPerMinute: 10, npcThinking: true };

export function loadSettings(): LlmSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: LlmSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode etc. - settings just won't persist */
  }
}
