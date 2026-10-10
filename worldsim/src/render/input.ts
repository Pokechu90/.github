/**
 * Mouse, touch and keyboard controls for the camera. Renderer-agnostic: it
 * only moves the Camera and reports clicks/hovers in screen coordinates.
 */
import type { Camera } from './camera';

export interface InputCallbacks {
  onClick(sx: number, sy: number): void;
  onHover(sx: number, sy: number): void;
}

export function attachInput(el: HTMLElement, camera: Camera, cb: InputCallbacks): () => void {
  let dragging = false;
  let moved = 0;
  let lastX = 0;
  let lastY = 0;
  const keys = new Set<string>();

  const local = (e: PointerEvent | WheelEvent) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    moved = 0;
    lastX = e.clientX;
    lastY = e.clientY;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    const p = local(e);
    cb.onHover(p.x, p.y);
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    camera.panPixels(dx, dy);
    lastX = e.clientX;
    lastY = e.clientY;
  });
  el.addEventListener('pointerup', (e) => {
    dragging = false;
    if (moved < 5) {
      const p = local(e);
      cb.onClick(p.x, p.y);
    }
  });
  el.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const p = local(e);
      camera.zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
    },
    { passive: false },
  );

  const isTyping = () => document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
  window.addEventListener('keydown', (e) => {
    if (isTyping()) return;
    keys.add(e.key.toLowerCase());
    if (e.key === '+' || e.key === '=') camera.zoomAt(1.25, camera.width / 2, camera.height / 2);
    if (e.key === '-' || e.key === '_') camera.zoomAt(0.8, camera.width / 2, camera.height / 2);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  // Smooth keyboard panning (WASD / arrow keys).
  let last = performance.now();
  let raf = 0;
  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const speed = 700 * dt; // screen pixels per second
    let dx = 0;
    let dy = 0;
    if (keys.has('a') || keys.has('arrowleft')) dx += speed;
    if (keys.has('d') || keys.has('arrowright')) dx -= speed;
    if (keys.has('w') || keys.has('arrowup')) dy += speed;
    if (keys.has('s') || keys.has('arrowdown')) dy -= speed;
    if (dx || dy) camera.panPixels(dx, dy);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}
