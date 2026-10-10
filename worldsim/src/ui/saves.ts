/**
 * The 💾 menu: autosave to the browser (IndexedDB) every few minutes, manual
 * save/load, and export/import of the world as a JSON file.
 */
import type { SimClient } from '../bridge/simClient';
import { getSave, putSave, type SaveSlot } from './storage';

const AUTOSAVE_MS = 3 * 60 * 1000;

export function setupSaves(sim: SimClient, actions: HTMLElement, onLoaded: () => void): { offerContinue(): Promise<void> } {
  const button = document.createElement('button');
  button.textContent = '💾 Save';
  button.title = 'Save, load, export or import the world';
  actions.appendChild(button);
  const dialog = document.getElementById('saves') as HTMLDialogElement;
  let lastSaved = 0;

  const snapshot = async (): Promise<SaveSlot> => {
    const r = await sim.request({ type: 'save', requestId: 0 }, 'saveData');
    const seed = Number(new URLSearchParams(location.search).get('seed')) || 0;
    return { data: r.data, year: r.year, seed, savedAt: Date.now() };
  };

  const describe = (s: SaveSlot | null) => (s ? `Year ${s.year}, saved ${new Date(s.savedAt).toLocaleString()}` : 'empty');

  const load = (data: string) => {
    sim.send({ type: 'load', data });
    onLoaded();
    dialog.close();
  };

  const render = async () => {
    const [auto, manual] = await Promise.all([getSave('autosave'), getSave('manual')]);
    dialog.innerHTML = `
      <form method="dialog">
        <h3>💾 Save &amp; load</h3>
        <p class="muted">The world autosaves in this browser every 3 minutes.</p>
        <div class="save-row"><span>Autosave: ${describe(auto)}</span><button type="button" data-act="load-auto" ${auto ? '' : 'disabled'}>Load</button></div>
        <div class="save-row"><span>Manual save: ${describe(manual)}</span><button type="button" data-act="load-manual" ${manual ? '' : 'disabled'}>Load</button></div>
        <div class="buttons">
          <button type="button" data-act="save">Save now</button>
          <button type="button" data-act="export">⬇ Export file</button>
          <button type="button" data-act="import">⬆ Import file</button>
          <input type="file" accept=".json,application/json" hidden />
        </div>
        <p id="save-status" class="muted"></p>
        <div class="buttons"><button value="close">Close</button></div>
      </form>`;
    const status = dialog.querySelector('#save-status')!;
    const file = dialog.querySelector<HTMLInputElement>('input[type=file]')!;
    dialog.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) =>
      b.addEventListener('click', async () => {
        const act = b.dataset.act;
        if (act === 'save') {
          status.textContent = 'Saving…';
          await putSave('manual', await snapshot());
          status.textContent = 'Saved.';
          void render();
        } else if (act === 'load-auto' && auto) load(auto.data);
        else if (act === 'load-manual' && manual) load(manual.data);
        else if (act === 'export') {
          status.textContent = 'Preparing file…';
          const s = await snapshot();
          const filename = `worldsim-seed${s.seed}-year${s.year}.json`;
          const blob = new Blob([s.data], { type: 'application/json' });
          // Inside claude.ai the page must ask the viewer to save files; elsewhere use a normal download.
          const host = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude;
          const downloads = host?.use ? ((await host.use('downloads')) as { save(r: { filename: string; data: Blob }): Promise<unknown> } | null) : null;
          if (downloads) {
            try {
              await downloads.save({ filename, data: blob });
              status.textContent = `Exported (${(s.data.length / 1e6).toFixed(1)} MB).`;
            } catch (err) {
              const code = (err as { code?: string }).code;
              status.textContent = code === 'declined' ? 'Export cancelled.' : 'Saving files is not available here.';
            }
          } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            status.textContent = `Exported (${(s.data.length / 1e6).toFixed(1)} MB).`;
          }
        } else if (act === 'import') file.click();
      }),
    );
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (f) load(await f.text());
    });
  };

  button.addEventListener('click', async () => {
    await render();
    dialog.showModal();
  });

  // Autosave.
  setInterval(async () => {
    if (Date.now() - lastSaved < AUTOSAVE_MS - 1000) return;
    try {
      await putSave('autosave', await snapshot());
      lastSaved = Date.now();
      button.textContent = '💾 Saved';
      setTimeout(() => (button.textContent = '💾 Save'), 2500);
    } catch (err) {
      console.warn('Autosave failed', err);
    }
  }, AUTOSAVE_MS);

  return {
    /** On startup: if there's an autosave, offer to continue it. */
    async offerContinue() {
      if (new URLSearchParams(location.search).has('fresh')) return;
      const auto = await getSave('autosave');
      if (!auto) return;
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = `Continue your saved world? <b>Year ${auto.year}</b> <button data-c>Continue</button> <button data-n>No, new world</button>`;
      document.body.appendChild(toast);
      toast.querySelector('[data-c]')!.addEventListener('click', () => {
        load(auto.data);
        toast.remove();
      });
      toast.querySelector('[data-n]')!.addEventListener('click', () => toast.remove());
      setTimeout(() => toast.remove(), 20000);
    },
  };
}
