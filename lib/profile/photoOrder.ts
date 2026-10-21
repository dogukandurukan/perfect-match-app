// Member photo order (pure). An approved member may only REORDER their own
// existing photos and choose the main one (2026-10-21, narrow D90 exception).
// The draft is a list of photo ids; the first is the main photo.

export type OrderPhoto = { id: string; path: string; position: number };

export function sortByPosition<T extends OrderPhoto>(photos: T[]): T[] {
  return photos.slice().sort((a, b) => a.position - b.position);
}

export function makeMain(ids: string[], id: string): string[] {
  const i = ids.indexOf(id);
  if (i <= 0) return ids;
  return [id, ...ids.slice(0, i), ...ids.slice(i + 1)];
}

export function moveUp(ids: string[], id: string): string[] {
  const i = ids.indexOf(id);
  if (i <= 0) return ids;
  const next = ids.slice();
  [next[i - 1], next[i]] = [next[i], next[i - 1]];
  return next;
}

export function moveDown(ids: string[], id: string): string[] {
  const i = ids.indexOf(id);
  if (i < 0 || i >= ids.length - 1) return ids;
  const next = ids.slice();
  [next[i], next[i + 1]] = [next[i + 1], next[i]];
  return next;
}

export const sameOrder = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Server error → short text. 'changed' means: reload, the photos changed elsewhere. */
export function photoOrderError(message: string | null | undefined): { text: string; changed: boolean } {
  const m = (message ?? '').toLowerCase();
  if (m.includes('photos_changed')) return { text: 'Your photos changed on another screen or device. Reload to see the latest order.', changed: true };
  if (m.includes('photo_set_mismatch')) return { text: 'Your photos don’t match the saved set. Reload and try again.', changed: true };
  if (m.includes('not_member')) return { text: 'Only approved members can reorder photos.', changed: false };
  if (m.includes('could not find the function')) return { text: 'Reordering photos isn’t available on this server yet.', changed: false };
  return { text: 'Couldn’t save the new order. Check your connection and try again.', changed: false };
}
