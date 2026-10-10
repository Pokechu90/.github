/** The 🧠 AI settings dialog: server address, LLM call limit, NPC thinking. */
import type { BrainClient } from '../llm/brainClient';

export function setupSettings(brain: BrainClient, actions: HTMLElement): void {
  const button = document.createElement('button');
  button.title = 'AI / LLM settings';
  actions.appendChild(button);

  const dialog = document.getElementById('settings') as HTMLDialogElement;
  dialog.innerHTML = `
    <form method="dialog">
      <h3>🧠 NPC minds (LLM)</h3>
      <p id="llm-status" class="muted"></p>
      <label>Brain server address
        <input id="llm-url" placeholder="(same site - leave empty with npm run dev)" />
      </label>
      <label>Max LLM calls per minute: <b id="llm-max-val"></b>
        <input id="llm-max" type="range" min="0" max="60" step="1" />
      </label>
      <label class="row"><input id="llm-think" type="checkbox" /> Let the LLM decide goals for people near the camera</label>
      <p class="muted">Chat always gets priority. At 0 calls per minute everyone uses free offline replies.
        The API key is set in the server's <code>.env</code> file, never here.</p>
      <div class="buttons"><button value="ok">Done</button></div>
    </form>`;
  const url = dialog.querySelector<HTMLInputElement>('#llm-url')!;
  const max = dialog.querySelector<HTMLInputElement>('#llm-max')!;
  const maxVal = dialog.querySelector<HTMLElement>('#llm-max-val')!;
  const think = dialog.querySelector<HTMLInputElement>('#llm-think')!;

  const refresh = () => {
    const s = brain.status;
    button.textContent = s.online ? `🧠 ${s.usedThisMinute}/${brain.settings.maxCallsPerMinute}` : '🧠 offline';
    button.classList.toggle('active', s.online);
    dialog.querySelector('#llm-status')!.textContent = s.message;
    maxVal.textContent = String(max.value);
  };

  button.addEventListener('click', () => {
    url.value = brain.settings.serverUrl;
    max.value = String(brain.settings.maxCallsPerMinute);
    think.checked = brain.settings.npcThinking;
    refresh();
    dialog.showModal();
  });
  max.addEventListener('input', refresh);
  dialog.addEventListener('close', () => {
    brain.updateSettings({ serverUrl: url.value.trim(), maxCallsPerMinute: Number(max.value), npcThinking: think.checked });
  });
  brain.onChange(refresh);
  setInterval(() => {
    brain.budget();
    refresh();
  }, 2000);
  refresh();
}
