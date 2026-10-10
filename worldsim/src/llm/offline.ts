/**
 * Offline fallback: simple rule-based replies used when no LLM is available.
 * They still use the NPC's personality, mood, needs, family and memories, so
 * conversations stay in character (just far less clever).
 */
import type { ChatRequest, ChatResult } from '../shared/llm';

function pick<T>(xs: T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}

export function offlineReply(req: ChatRequest): ChatResult {
  const n = req.npc;
  const m = req.message.toLowerCase();
  const first = n.name.split(' ')[0];
  const t = n.traitNumbers;
  const grumpy = (t.agreeableness ?? 0.5) < 0.35 || n.mood === 'miserable' || n.feelings.includes('starving');
  const shy = (t.extraversion ?? 0.5) < 0.3;
  const anxious = (t.neuroticism ?? 0.5) > 0.7;
  const likes = n.playerRelation.affinity > 0.2;
  const stranger = n.playerRelation.familiarity < 0.05;

  let reply: string;
  let emotion: ChatResult['emotion'] = grumpy ? 'annoyed' : likes ? 'happy' : 'neutral';
  let affinity = 0.02;

  const say = (polite: string, rude: string, quiet?: string) => (grumpy ? rude : shy && quiet ? quiet : polite);

  if (/\b(hi|hello|hey|greetings|good (morning|evening|day))\b/.test(m)) {
    reply = stranger
      ? say(`Oh! Hello, stranger. I'm ${first}. I haven't seen you around ${n.settlement} before.`, `Hm. Who are you? I'm busy.`, `...Hello. I'm ${first}.`)
      : say(`Hello again! Good to see you.`, `You again.`, `Oh... hi.`);
  } else if (/name|who are you/.test(m)) {
    reply = say(`I'm ${n.name}, ${n.job.toLowerCase()} here in ${n.settlement}.`, `${first}. What's it to you?`, `${first}...`);
  } else if (/how are you|how do you feel|you ok|feeling/.test(m)) {
    const f = n.feelings.length ? n.feelings.join(' and ') : n.mood;
    reply = n.health.startsWith('sick')
      ? `Not well. I'm ${n.health}. ${anxious ? 'I hope it isn\'t serious...' : 'It\'ll pass.'}`
      : say(`I'm ${f}, thanks for asking.`, `I'm ${f}. Happy now?`, `I'm... ${f}.`);
    if (n.feelings.length === 0) emotion = 'happy';
  } else if (/family|wife|husband|child|kids|son|daughter|mother|father/.test(m)) {
    reply = n.family.length ? say(`My family? ${n.family.slice(0, 3).join(', ')}.`, `Leave my family out of this.`, `I have ${n.family[0]}.`) : `I have no family left.`;
  } else if (/job|work|do you do/.test(m)) {
    reply = say(`I'm a ${n.job.toLowerCase()}. Right now I'm ${n.doing}.`, `I'm ${n.doing}. Obviously.`);
  } else if (/news|happen|gossip|heard/.test(m)) {
    const news = n.world.localNews[n.world.localNews.length - 1] ?? n.memories[n.memories.length - 1];
    reply = news ? say(`Have you heard? ${news.replace(/^[^:]*: /, '')}`, `Nothing that concerns you.`) : `Nothing much happens here.`;
    emotion = 'surprised';
  } else if (/food|hungry|eat/.test(m)) {
    reply = n.feelings.includes('starving') || n.feelings.includes('hungry') ? `Don't talk to me about food, I'm so hungry.` : `We get by: fruit, fish, a bit of meat.`;
  } else if (/weather|rain|snow|cold|hot/.test(m)) {
    reply = `It's ${n.world.weather} today. ${n.world.season === 'winter' ? 'Winter is hard on us.' : 'Could be worse.'}`;
  } else if (/bye|farewell|see you|goodbye/.test(m)) {
    reply = say(`Farewell, traveller.`, `Finally.`, `Bye...`);
  } else if (/help|need/.test(m)) {
    reply = likes ? `What can I do for you?` : say(`Help with what?`, `Help yourself.`);
  } else if (/love|like you|beautiful|handsome/.test(m)) {
    reply = likes ? `*blushes* You're kind.` : `*steps back* We barely know each other.`;
    emotion = likes ? 'affectionate' : 'suspicious';
    affinity = likes ? 0.05 : -0.05;
  } else if (/stupid|idiot|hate|ugly/.test(m)) {
    reply = `How dare you!`;
    emotion = 'angry';
    affinity = -0.2;
  } else {
    reply = pick([
      say(`Hm, I'm not sure what you mean.`, `I don't have time for riddles.`, `...I don't understand.`),
      say(`Interesting. Tell me more about yourself, stranger.`, `Is that so.`),
      say(`*thinks* I'll have to think about that.`, `*shrugs*`),
    ]);
  }
  return {
    reply,
    emotion,
    affinity_change: affinity,
    remember: stranger ? 'I met a strange traveller who wanted to talk.' : '',
    importance: 0.3,
    intent: 'none',
    new_goal: '',
    lied: false,
    source: 'offline',
  };
}
