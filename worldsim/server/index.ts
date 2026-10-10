/**
 * WorldSim brain server.
 *
 * A tiny Express server that sits between the game and an LLM. The API key
 * lives only here (read from the .env file), never in the browser.
 *
 *   GET  /api/health      -> is an LLM configured? which one?
 *   POST /api/npc/chat    -> an NPC's reply to the player
 *   POST /api/npc/decide  -> an NPC's next goal (for NPCs near the player)
 *
 * Requests are queued (a few at a time) and limited to MAX_LLM_CALLS_PER_MINUTE
 * so costs stay under control. Chat is always served before background thinking.
 */
import './env';
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { createProvider, LlmRefusal } from './providers';
import {
  CHAT_SCHEMA, CHAT_SYSTEM, DECIDE_SCHEMA, DECIDE_SYSTEM, chatUserPrompt, decideUserPrompt, sanitizeChat,
  type ChatRequest, type DecideRequest,
} from '../src/shared/llm';

const PORT = Number(process.env.PORT || 8787);
const MAX_PER_MINUTE = Number(process.env.MAX_LLM_CALLS_PER_MINUTE || 20);
const CONCURRENCY = Number(process.env.LLM_CONCURRENCY || 2);

const provider = createProvider();
const app = express();
app.use(express.json({ limit: '200kb' }));

// Allow the game to be served from another origin (e.g. GitHub Pages) if you
// set ALLOWED_ORIGIN. Locally, Vite proxies /api so this isn't needed.
app.use((req, res, next) => {
  const origin = process.env.ALLOWED_ORIGIN;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
  }
  next();
});

// ---------------------------------------------------------------- queue + rate limit

type Job = { priority: number; run: () => Promise<void> };
const queue: Job[] = [];
let running = 0;
const callTimes: number[] = [];

function callsLastMinute(): number {
  const cutoff = Date.now() - 60_000;
  while (callTimes.length && callTimes[0] < cutoff) callTimes.shift();
  return callTimes.length;
}

function pump(): void {
  while (running < CONCURRENCY && queue.length && callsLastMinute() < MAX_PER_MINUTE) {
    queue.sort((a, b) => a.priority - b.priority);
    const job = queue.shift()!;
    running++;
    callTimes.push(Date.now());
    job.run().finally(() => {
      running--;
      pump();
    });
  }
  if (queue.length) setTimeout(pump, 1000);
}

function enqueue<T>(priority: number, fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    // Background work waits at most a few seconds; if the budget is used up we say so.
    if (priority > 0 && queue.filter((j) => j.priority > 0).length > 10) {
      reject(new Error('busy'));
      return;
    }
    queue.push({ priority, run: () => fn().then(resolve, reject) });
    pump();
  });
}

function sendError(res: express.Response, err: unknown): void {
  if (err instanceof LlmRefusal) {
    res.status(422).json({ error: 'refused' });
  } else if (err instanceof Anthropic.AuthenticationError) {
    res.status(401).json({ error: 'The API key was rejected. Check ANTHROPIC_API_KEY in .env.' });
  } else if (err instanceof Anthropic.RateLimitError) {
    res.status(429).json({ error: 'The LLM provider is rate limiting us; try again shortly.' });
  } else if (err instanceof Anthropic.APIError) {
    res.status(502).json({ error: `LLM API error ${err.status}` });
  } else if (err instanceof Error && err.message === 'busy') {
    res.status(429).json({ error: 'busy' });
  } else {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'unknown error' });
  }
}

// ---------------------------------------------------------------- routes

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    provider: provider.name,
    model: provider.model,
    configured: provider.configured,
    maxPerMinute: MAX_PER_MINUTE,
    usedThisMinute: callsLastMinute(),
    queued: queue.length,
  });
});

app.post('/api/npc/chat', async (req, res) => {
  if (!provider.configured) {
    res.status(503).json({ error: 'No LLM configured on the server.' });
    return;
  }
  const body = req.body as ChatRequest;
  try {
    const raw = await enqueue(0, () => provider.json(CHAT_SYSTEM, chatUserPrompt(body), CHAT_SCHEMA as unknown as Record<string, unknown>, 1500));
    res.json(sanitizeChat(raw as object));
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/npc/decide', async (req, res) => {
  if (!provider.configured) {
    res.status(503).json({ error: 'No LLM configured on the server.' });
    return;
  }
  const body = req.body as DecideRequest;
  try {
    const raw = (await enqueue(1, () =>
      provider.json(DECIDE_SYSTEM, decideUserPrompt(body), DECIDE_SCHEMA as unknown as Record<string, unknown>, 800),
    )) as Record<string, unknown>;
    res.json({
      goal: String(raw.goal ?? ''),
      target_name: String(raw.target_name ?? ''),
      thought: String(raw.thought ?? '').slice(0, 240),
      hours: Math.max(1, Math.min(48, Number(raw.hours) || 6)),
    });
  } catch (err) {
    sendError(res, err);
  }
});

app.listen(PORT, () => {
  console.log(`WorldSim brain server on http://localhost:${PORT}`);
  console.log(`LLM: ${provider.name} / ${provider.model} ${provider.configured ? '(ready)' : '(NOT CONFIGURED - NPCs will use offline replies; see .env.example)'}`);
  console.log(`Limit: ${MAX_PER_MINUTE} LLM calls per minute`);
});
