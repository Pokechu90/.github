/**
 * The chat box: click "Talk" on a person, type freely, and they answer in
 * character (via the LLM, or offline replies). While you talk, they stop and
 * listen. Everything said is remembered by them and can change how they act.
 */
import type { SimClient } from '../bridge/simClient';
import type { BrainClient } from '../llm/brainClient';
import type { ChatTurn } from '../shared/llm';
import { esc } from './hud';

const EMOJI: Record<string, string> = {
  happy: '😊', sad: '😢', angry: '😠', afraid: '😨', surprised: '😮', neutral: '😐',
  amused: '😄', annoyed: '😒', suspicious: '🤨', affectionate: '🥰',
};

export class ChatBox {
  private el: HTMLElement;
  private log: HTMLElement;
  private input: HTMLInputElement;
  private npcId: number | null = null;
  private npcName = '';
  private history: ChatTurn[] = [];
  private busy = false;

  constructor(private sim: SimClient, private brain: BrainClient) {
    this.el = document.getElementById('chat')!;
    this.el.innerHTML = `
      <header><strong id="chat-name"></strong><span id="chat-source"></span><button id="chat-close" title="End conversation (Esc)">✕</button></header>
      <div id="chat-log"></div>
      <form id="chat-form"><input id="chat-input" autocomplete="off" placeholder="Say something…" maxlength="300" /><button>Send</button></form>`;
    this.log = this.el.querySelector('#chat-log')!;
    this.input = this.el.querySelector('#chat-input')!;
    this.el.querySelector('#chat-close')!.addEventListener('click', () => this.close());
    this.el.querySelector('#chat-form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.send();
    });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
      e.stopPropagation(); // don't move the camera while typing
    });
  }

  async open(id: number): Promise<void> {
    if (this.npcId !== null) this.close();
    const { context } = await this.sim.request({ type: 'npcContext', id, requestId: 0 }, 'npcContext');
    if (!context) return;
    this.npcId = id;
    this.npcName = context.name;
    this.history = [];
    this.sim.send({ type: 'chat', id, active: true });
    this.el.hidden = false;
    this.el.querySelector('#chat-name')!.textContent = `Talking with ${context.name}`;
    this.setSource();
    this.log.innerHTML = '';
    const greeting = context.playerRelation.familiarity < 0.05
      ? `${context.name.split(' ')[0]} looks at you curiously. (${context.job}, ${context.age})`
      : `${context.name.split(' ')[0]} recognises you.`;
    this.addLine('system', greeting);
    this.input.value = '';
    this.input.focus();
  }

  close(): void {
    if (this.npcId !== null) this.sim.send({ type: 'chat', id: this.npcId, active: false });
    this.npcId = null;
    this.el.hidden = true;
    this.input.blur();
  }

  get isOpen(): boolean {
    return this.npcId !== null;
  }

  private setSource(): void {
    const s = this.brain.status;
    this.el.querySelector('#chat-source')!.textContent = s.online ? `🧠 ${s.model}` : '📴 offline replies';
  }

  private addLine(kind: 'player' | 'npc' | 'system', text: string, emotion?: string): HTMLElement {
    const div = document.createElement('div');
    div.className = `line ${kind}`;
    const who = kind === 'player' ? 'You' : kind === 'npc' ? this.npcName.split(' ')[0] : '';
    div.innerHTML = kind === 'system'
      ? `<em>${esc(text)}</em>`
      : `<b>${esc(who)}${emotion ? ` ${EMOJI[emotion] ?? ''}` : ''}</b> ${formatSpeech(text)}`;
    this.log.appendChild(div);
    this.log.scrollTop = this.log.scrollHeight;
    return div;
  }

  private async send(): Promise<void> {
    const text = this.input.value.trim();
    if (!text || this.busy || this.npcId === null) return;
    const id = this.npcId;
    this.busy = true;
    this.input.value = '';
    this.addLine('player', text);
    const typing = this.addLine('system', `${this.npcName.split(' ')[0]} is thinking…`);
    try {
      // Fresh context every time: their mood and situation may have changed.
      const { context } = await this.sim.request({ type: 'npcContext', id, requestId: 0 }, 'npcContext');
      if (!context) {
        typing.remove();
        this.addLine('system', 'They are no longer here.');
        return;
      }
      const result = await this.brain.chat({ npc: context, history: this.history, message: text });
      typing.remove();
      if (this.npcId !== id) return;
      this.addLine('npc', result.reply, result.emotion);
      if (result.source === 'offline' && this.brain.status.online) this.addLine('system', '(LLM limit reached this minute: offline reply)');
      this.history.push({ from: 'player', text }, { from: 'npc', text: result.reply });
      this.sim.send({ type: 'chatResult', id, playerText: text, result });
      this.setSource();
    } finally {
      this.busy = false;
      this.input.focus();
    }
  }
}

/** *actions* in italics. */
function formatSpeech(text: string): string {
  return esc(text).replace(/\*([^*]+)\*/g, '<i>$1</i>');
}
