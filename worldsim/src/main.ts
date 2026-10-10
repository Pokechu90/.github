/**
 * Boots the game: starts the simulation worker, the renderer and the HUD, and
 * wires them together. This is the only file that knows about all three.
 */
import './style.css';
import { SimClient } from './bridge/simClient';
import { PixiRenderer } from './render/pixi/PixiRenderer';
import { attachInput } from './render/input';
import { Hud } from './ui/hud';
import { seedFromString } from './shared/rng';

async function main(): Promise<void> {
  // The seed comes from the URL (?seed=123) so worlds can be shared.
  const params = new URLSearchParams(location.search);
  let seedText = params.get('seed');
  if (!seedText) {
    seedText = String(Math.floor(Math.random() * 1e9));
    params.set('seed', seedText);
    history.replaceState(null, '', `?${params}`);
  }
  const seed = seedFromString(seedText);

  const sim = new SimClient();
  const renderer = new PixiRenderer();
  await renderer.init(document.getElementById('game')!);

  const hud = new Hud(
    seed,
    (speed) => sim.send({ type: 'setSpeed', speed }),
    () => {
      params.set('seed', String(Math.floor(Math.random() * 1e9)));
      location.search = params.toString();
    },
  );

  attachInput(renderer.view, renderer.camera, {
    onClick: (sx, sy) => sim.send({ type: 'select', target: renderer.pick(sx, sy) }),
    onHover: (sx, sy) => hud.showTooltip(renderer.tileAt(sx, sy), sx, sy),
  });
  renderer.view.addEventListener('pointerleave', () => hud.showTooltip(null, 0, 0));

  sim.on('ready', ({ spawn }) => {
    renderer.camera.centerOn(spawn.x + 0.5, spawn.y + 0.5);
    document.getElementById('loading')?.remove();
  });
  sim.on('snapshot', ({ snap }) => {
    renderer.applySnapshot(snap);
    hud.update(snap);
  });

  // Tell the simulation what the camera sees, whenever it changes.
  let lastView = '';
  setInterval(() => {
    const b = renderer.camera.bounds();
    const detail = renderer.wantsDetail();
    const key = `${Math.round(b.x0)},${Math.round(b.y0)},${Math.round(b.x1)},${Math.round(b.y1)},${detail}`;
    if (key === lastView) return;
    lastView = key;
    sim.send({ type: 'viewport', ...b, detail });
  }, 100);

  sim.send({ type: 'init', seed });
  sim.send({ type: 'setSpeed', speed: 1 });

  // Handy for poking at things from the browser console.
  Object.assign(window, { worldsim: { sim, renderer } });
}

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre class="fatal">Failed to start: ${String(err)}</pre>`);
});
