/**
 * LLM providers. Each one takes a system prompt, a user prompt and a JSON
 * schema, and returns the parsed JSON object. Choose one with LLM_PROVIDER
 * in your .env file: "anthropic" (Claude, default), "openai" or "ollama".
 */
import Anthropic from '@anthropic-ai/sdk';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface Provider {
  name: string;
  model: string;
  configured: boolean;
  json(system: string, user: string, schema: Record<string, unknown>, maxTokens: number): Promise<unknown>;
}

export class LlmRefusal extends Error {}

// ----------------------------------------------------------------- Claude

function anthropicProvider(): Provider {
  const model = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
  // The SDK reads ANTHROPIC_API_KEY (or another configured credential) itself.
  const client = new Anthropic();
  return {
    name: 'anthropic',
    model,
    // A key in .env, an auth token, or a saved `ant auth login` profile all work.
    configured: !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE ||
      existsSync(join(homedir(), '.config', 'anthropic'))),
    async json(system, user, schema, maxTokens) {
      const response = await client.beta.messages.create({
        model,
        max_tokens: maxTokens,
        // NPC chat is quick, everyday conversation: low effort keeps it fast and cheap.
        output_config: { effort: 'low', format: { type: 'json_schema', schema } },
        // If a safety classifier declines, retry on Anthropic's recommended fallback model.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        // The system prompt is identical for every NPC, so cache it.
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: user }],
      });
      if (response.stop_reason === 'refusal') throw new LlmRefusal('The model declined to answer.');
      const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text;
      if (!text) throw new Error(`No text in response (stop_reason: ${response.stop_reason})`);
      return JSON.parse(text);
    },
  };
}

// ----------------------------------------------------------------- OpenAI

function openaiProvider(): Provider {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const key = process.env.OPENAI_API_KEY || '';
  const base = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  return {
    name: 'openai',
    model,
    configured: !!key,
    async json(system, user, schema, maxTokens) {
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: { type: 'json_schema', json_schema: { name: 'answer', strict: true, schema } },
        }),
      });
      if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = (await res.json()) as { choices: { message: { content: string } }[] };
      return JSON.parse(data.choices[0].message.content);
    },
  };
}

// ----------------------------------------------------------------- Ollama (local)

function ollamaProvider(): Provider {
  const model = process.env.OLLAMA_MODEL || 'llama3.1';
  const base = process.env.OLLAMA_URL || 'http://localhost:11434';
  return {
    name: 'ollama',
    model,
    configured: true,
    async json(system, user, schema) {
      const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          format: schema,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`Ollama error ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = (await res.json()) as { message: { content: string } };
      return JSON.parse(data.message.content);
    },
  };
}

// ----------------------------------------------------------------- Mock (tests/demos)

function mockProvider(): Provider {
  return {
    name: 'mock',
    model: 'mock',
    configured: true,
    async json(_system, user, schema) {
      await new Promise((r) => setTimeout(r, 150));
      if ('reply' in ((schema as { properties: object }).properties)) {
        const said = user.match(/The stranger says: "([^"]*)"/)?.[1] ?? '';
        return {
          reply: `*squints* You said "${said.slice(0, 40)}"? I'm not sure what to make of you, stranger.`,
          emotion: 'suspicious', affinity_change: 0.02, remember: `A stranger asked me: "${said.slice(0, 60)}"`,
          importance: 0.45, intent: 'tell_others', new_goal: '', lied: false,
        };
      }
      const first = user.match(/GOAL OPTIONS[^\n]*\n- ([^\n]+)/)?.[1] ?? 'rest at home';
      return { goal: first, target_name: '', thought: 'I think that is what I should do now.', hours: 4 };
    },
  };
}

export function createProvider(): Provider {
  switch ((process.env.LLM_PROVIDER || 'anthropic').toLowerCase()) {
    case 'mock':
      return mockProvider();
    case 'openai':
      return openaiProvider();
    case 'ollama':
      return ollamaProvider();
    default:
      return anthropicProvider();
  }
}
