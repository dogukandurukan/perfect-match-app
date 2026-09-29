// Photo grid geometry + drag target (P07 R2). Pure; also runs as a Reanimated
// worklet (the 'worklet' directives) so the drag uses the exact code the
// logic checks exercise.
export const GRID_GAP = 10;
export const TILE_RATIO = 1.25; // 4:5 portrait
const GUTTER = 24; // obSpacing.gutter

export type Geometry = { cols: number; tileW: number; tileH: number };

/** 3 columns while a tile stays a usable size and text isn't enlarged;
 * otherwise 2 (narrow phones, accessibility text sizes). */
export function gridGeometry(windowWidth: number, fontScale: number): Geometry {
  const inner = windowWidth - GUTTER * 2;
  const cols = inner >= 300 && fontScale < 1.35 ? 3 : 2;
  const tileW = Math.floor((inner - GRID_GAP * (cols - 1)) / cols);
  return { cols, tileW, tileH: Math.round(tileW * TILE_RATIO) };
}

export function slotXY(i: number, g: Geometry): { x: number; y: number } {
  'worklet';
  return { x: (i % g.cols) * (g.tileW + GRID_GAP), y: Math.floor(i / g.cols) * (g.tileH + GRID_GAP) };
}

export function gridHeight(slots: number, g: Geometry): number {
  const rows = Math.ceil(slots / g.cols);
  return rows * g.tileH + (rows - 1) * GRID_GAP;
}

/** Slot under the dragged tile's centre, clamped to the filled photos. */
export function dragTargetIndex(from: number, dx: number, dy: number, g: Geometry, count: number): number {
  'worklet';
  const o = slotXY(from, g);
  const cx = o.x + g.tileW / 2 + dx;
  const cy = o.y + g.tileH / 2 + dy;
  const col = Math.max(0, Math.min(g.cols - 1, Math.floor(cx / (g.tileW + GRID_GAP))));
  const row = Math.max(0, Math.floor(cy / (g.tileH + GRID_GAP)));
  return Math.max(0, Math.min(count - 1, row * g.cols + col));
}
