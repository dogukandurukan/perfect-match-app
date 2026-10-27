// A one-shot message from an editor to the screen it returns to (e.g.
// "Conversation starter saved" after the editor closes). Set only after the
// server confirmed; read once on focus.
let pending: string | null = null;

export function setScreenNotice(text: string): void {
  pending = text;
}

export function takeScreenNotice(): string | null {
  const t = pending;
  pending = null;
  return t;
}
