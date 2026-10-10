/**
 * What any renderer must provide. PixiRenderer implements it today; a future
 * ThreeRenderer (3D) would implement the same interface, and nothing else in
 * the game would need to change.
 */
import type { SelectTarget, Snapshot } from '../shared/protocol';
import type { Camera } from './camera';

export interface TileInfo {
  x: number;
  y: number;
  biome: number;
  tempC: number;
}

export interface WorldRenderer {
  readonly camera: Camera;
  /** The element that receives mouse/touch input. */
  readonly view: HTMLElement;
  init(host: HTMLElement): Promise<void>;
  applySnapshot(snap: Snapshot): void;
  /** Should plants and animals be drawn at the current zoom? */
  wantsDetail(): boolean;
  pick(screenX: number, screenY: number): SelectTarget | null;
  tileAt(screenX: number, screenY: number): TileInfo | null;
}
