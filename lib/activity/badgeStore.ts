// Activity tab badge state (pure; the session and the loader are passed in so
// the rules are testable without the app client). The count always belongs to
// one account: a result for another account, or an older request that
// finished after a newer one, is dropped; signing out / switching clears it at
// once. A failed refresh keeps the same account's last count.

export type BadgeDeps = {
  currentUserId: () => Promise<string | null>;
  loadCount: () => Promise<{ ok: true; count: number } | { ok: false }>;
};

export class ActivityBadgeStore {
  private userId: string | null = null;
  private count = 0;
  private seq = 0;
  private readonly listeners = new Set<(n: number) => void>();
  constructor(private readonly deps: BadgeDeps) {}

  get value(): number {
    return this.count;
  }
  subscribe(l: (n: number) => void): () => void {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }
  private set(userId: string | null, n: number): void {
    const changed = n !== this.count; // listeners only need the number
    this.userId = userId;
    this.count = n;
    if (changed) this.listeners.forEach((l) => l(n));
  }
  /** Signed out / another account: forget the previous account's count now. */
  accountChanged(userId: string | null): void {
    if (userId !== this.userId) {
      this.seq += 1; // drop requests still in flight for the old account
      this.set(userId, 0);
    }
  }
  /** A count the caller already computed from fresh server data (no extra fetch). */
  async publish(count: number): Promise<void> {
    const uid = await this.deps.currentUserId();
    if (!uid) return this.set(null, 0);
    this.seq += 1;
    this.set(uid, count);
  }
  async refresh(): Promise<void> {
    const mine = ++this.seq;
    const uid = await this.deps.currentUserId();
    if (!uid) {
      if (mine === this.seq) this.set(null, 0);
      return;
    }
    if (uid !== this.userId) this.set(uid, 0);
    const r = await this.deps.loadCount();
    if (mine !== this.seq) return; // a newer refresh / account change won
    if ((await this.deps.currentUserId()) !== uid) return; // account changed meanwhile
    if (r.ok) this.set(uid, r.count);
  }
}
