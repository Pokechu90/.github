/**
 * The contract between the game and the LLM "brain" server, plus the prompts.
 *
 * Lives in shared/ so both the Node server and the browser can build exactly
 * the same prompts (the browser needs them when it talks to an LLM directly,
 * e.g. when hosted somewhere without our server).
 */

/** Everything an NPC plausibly knows, packed for the LLM. */
export interface NpcPromptContext {
  id: number;
  name: string;
  age: number;
  sex: string;
  job: string;
  settlement: string;
  settlementSize: string;
  personality: string[];
  traitNumbers: Record<string, number>;
  values: string[];
  mood: string;
  feelings: string[];
  health: string;
  doing: string;
  thought: string;
  goal: string | null;
  family: string[];
  relationships: string[];
  memories: string[];
  memoriesOfPlayer: string[];
  playerRelation: { affinity: number; familiarity: number; label: string };
  world: { date: string; timeOfDay: string; season: string; weather: string; technology: string[]; localNews: string[] };
  /** Goals the simulation can act on (for decisions). */
  goalOptions?: string[];
}

export interface ChatTurn {
  from: 'player' | 'npc';
  text: string;
}

export interface ChatRequest {
  npc: NpcPromptContext;
  history: ChatTurn[];
  message: string;
}

export const EMOTIONS = ['happy', 'sad', 'angry', 'afraid', 'surprised', 'neutral', 'amused', 'annoyed', 'suspicious', 'affectionate'] as const;
export const INTENTS = ['none', 'help_player', 'avoid_player', 'tell_others', 'change_goal'] as const;

export interface ChatResult {
  reply: string;
  emotion: (typeof EMOTIONS)[number];
  affinity_change: number;
  remember: string;
  importance: number;
  intent: (typeof INTENTS)[number];
  new_goal: string;
  lied: boolean;
  /** Filled in by the client: where the reply came from. */
  source?: 'llm' | 'offline';
}

export interface DecideRequest {
  npc: NpcPromptContext;
}

export interface DecideResult {
  goal: string;
  target_name: string;
  thought: string;
  hours: number;
}

// ------------------------------------------------------------------ schemas

export const CHAT_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'What the character says out loud (1-4 sentences). May include a short action in *asterisks*.' },
    emotion: { type: 'string', enum: [...EMOTIONS] },
    affinity_change: { type: 'number', description: 'How this exchange changed their feelings about the stranger, from -0.3 to 0.3.' },
    remember: { type: 'string', description: 'One first-person sentence they will remember about this conversation, or empty if forgettable.' },
    importance: { type: 'number', description: '0 to 1: how memorable this conversation is.' },
    intent: { type: 'string', enum: [...INTENTS] },
    new_goal: { type: 'string', description: 'If intent is change_goal: the new goal in a few words, else empty.' },
    lied: { type: 'boolean', description: 'True if the reply was deliberately untruthful.' },
  },
  required: ['reply', 'emotion', 'affinity_change', 'remember', 'importance', 'intent', 'new_goal', 'lied'],
  additionalProperties: false,
} as const;

export const DECIDE_SCHEMA = {
  type: 'object',
  properties: {
    goal: { type: 'string', description: 'One of the listed goal options.' },
    target_name: { type: 'string', description: 'Full name of the person the goal concerns, or empty.' },
    thought: { type: 'string', description: 'Their private first-person thought explaining the choice (one sentence).' },
    hours: { type: 'number', description: 'How many in-game hours to pursue the goal (1-48).' },
  },
  required: ['goal', 'target_name', 'thought', 'hours'],
  additionalProperties: false,
} as const;

// ------------------------------------------------------------------ prompts

/** Stable instructions (identical for every NPC, so they can be cached). */
export const CHAT_SYSTEM = `You are the voice of a person living in a simulated world. You will be given their full character sheet: personality, values, mood, needs, health, family, relationships, memories and what is happening around them.

Stay completely in character:
- Speak as they would, in the first person, in plain words that fit their age, job, mood and the technology of their society. They know nothing about the real world, computers, games or AI unless their world's technology includes it.
- They only know what is in their memories and what they can see. If asked about something they don't know, they say so, guess, or make something up, as their personality would.
- They are a real person with their own interests, not a helpful assistant. They may refuse, change the subject, joke, tease, get annoyed, be suspicious of strangers, or lie when it suits them (for example to protect family, hide shame, or gain an advantage). Kind, honest people rarely lie; stubborn or anxious people might.
- Hunger, tiredness, sickness and grief colour how they talk. A starving person is short-tempered; a grieving one may be distant.
- How they treat the player (a stranger who appeared in their world) depends on their past conversations with them and how they feel about them.
- Keep replies short: 1 to 4 sentences, like real speech. No lists or headings.

Return your answer in the requested JSON format.`;

export const DECIDE_SYSTEM = `You decide what a person in a simulated world wants to do next, based on their character sheet: needs, personality, values, relationships, memories and surroundings. Pick the single most plausible goal from the options given, as that specific person would, not what is "optimal". Think like them: a lonely, curious young person may go and court someone they like; a tired, anxious parent may go home; a diligent worker may keep working while hungry. Write their private thought in the first person, in plain words that fit their world.

Return your answer in the requested JSON format.`;

export function describeContext(c: NpcPromptContext): string {
  const lines = [
    `Name: ${c.name} (${c.sex}, age ${c.age}), ${c.job} in ${c.settlement} (${c.settlementSize}).`,
    `Personality: ${c.personality.join(', ') || 'balanced'}. Big Five (0-1): ${Object.entries(c.traitNumbers).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ')}.`,
    `Cares most about: ${c.values.join(', ')}.`,
    `Mood: ${c.mood}. Feeling: ${c.feelings.join(', ') || 'fine'}. Health: ${c.health}.`,
    `Right now: ${c.doing}. Inner thought: "${c.thought}"${c.goal ? ` Current goal: ${c.goal}.` : ''}`,
    `Family: ${c.family.join('; ') || 'none'}.`,
    `Relationships: ${c.relationships.join('; ') || 'none to speak of'}.`,
    `It is ${c.world.timeOfDay}, ${c.world.date} (${c.world.season}). Weather: ${c.world.weather}.`,
    `Their society knows: ${c.world.technology.join(', ') || 'only stone-age skills: foraging, hunting, fishing, fire and simple huts'}.`,
    `Memories, oldest first:\n${c.memories.map((m) => `- ${m}`).join('\n') || '- nothing notable'}`,
  ];
  if (c.world.localNews.length) lines.push(`Recent local news they know:\n${c.world.localNews.map((m) => `- ${m}`).join('\n')}`);
  lines.push(
    `About the stranger (the player): ${c.playerRelation.label}.${c.memoriesOfPlayer.length ? ` What they remember of them:\n${c.memoriesOfPlayer.map((m) => `- ${m}`).join('\n')}` : ' They have never spoken before.'}`,
  );
  return lines.join('\n');
}

export function chatUserPrompt(req: ChatRequest): string {
  const history = req.history.slice(-12).map((t) => `${t.from === 'player' ? 'Stranger' : req.npc.name.split(' ')[0]}: ${t.text}`).join('\n');
  return `CHARACTER SHEET\n${describeContext(req.npc)}\n\nCONVERSATION SO FAR\n${history || '(the stranger just approached)'}\n\nThe stranger says: "${req.message}"\n\nReply as ${req.npc.name.split(' ')[0]}.`;
}

export function decideUserPrompt(req: DecideRequest): string {
  return `CHARACTER SHEET\n${describeContext(req.npc)}\n\nGOAL OPTIONS (pick one exactly as written):\n${(req.npc.goalOptions ?? []).map((g) => `- ${g}`).join('\n')}`;
}

/** Keeps model output inside safe ranges whatever it returns. */
export function sanitizeChat(r: Partial<ChatResult>): ChatResult {
  const clamp = (v: unknown, lo: number, hi: number, d: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
  return {
    reply: String(r.reply ?? '...').slice(0, 800),
    emotion: (EMOTIONS as readonly string[]).includes(r.emotion as string) ? (r.emotion as ChatResult['emotion']) : 'neutral',
    affinity_change: clamp(r.affinity_change, -0.3, 0.3, 0),
    remember: String(r.remember ?? '').slice(0, 240),
    importance: clamp(r.importance, 0, 1, 0.3),
    intent: (INTENTS as readonly string[]).includes(r.intent as string) ? (r.intent as ChatResult['intent']) : 'none',
    new_goal: String(r.new_goal ?? '').slice(0, 80),
    lied: !!r.lied,
  };
}
