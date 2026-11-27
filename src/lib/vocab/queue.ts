/**
 * Typed answers on their way to /api/vocab. Each answer goes into localStorage first and is
 * sent straight away; with no signal it waits on this device and goes once the signal is back,
 * or on the next visit. Browser only. Kept apart from the review outbox (src/lib/srs/outbox.ts),
 * which carries grades for the review schedule; these never touch it.
 */
import type { VocabResult } from "./words";

const KEY = "michi.vocab-queue.v1";
const BATCH = 50;

export type QueueState = { waiting: number; offline: boolean; stuck: boolean };
type Queued = VocabResult & { id: string };

class VocabQueue {
  private state: QueueState = { waiting: 0, offline: false, stuck: false };
  private listeners = new Set<() => void>();
  private sending = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  /** What's waiting; localStorage keeps a copy for the next visit. */
  private list: Queued[] = load();

  constructor() {
    this.state = { waiting: this.list.length, offline: !navigator.onLine, stuck: false };
    window.addEventListener("online", () => {
      this.update({ offline: false });
      void this.flush();
    });
    window.addEventListener("offline", () => this.update({ offline: true }));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void this.flush();
    });
    window.addEventListener("storage", (e) => {
      if (e.key !== KEY) return;
      this.list = load();
      this.update({ waiting: this.list.length });
    });
  }

  getState = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  add(result: VocabResult) {
    this.write([...this.read(), { ...result, id: crypto.randomUUID() }]);
    void this.flush();
  }

  /** Sends what's waiting, a batch at a time, until it's empty or a send fails. */
  async flush(): Promise<void> {
    if (this.sending) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.sending = true;
    try {
      for (;;) {
        const batch = this.read().slice(0, BATCH);
        if (batch.length === 0) break;
        const ok = await this.send(batch);
        if (!ok) {
          this.failures++;
          this.update({ stuck: true });
          // 5 s, 10 s, 20 s… up to a minute.
          this.timer = setTimeout(() => void this.flush(), Math.min(60_000, 5_000 * 2 ** (this.failures - 1)));
          return;
        }
        this.failures = 0;
        const sent = new Set(batch.map((r) => r.id));
        this.write(this.read().filter((r) => !sent.has(r.id)));
      }
      this.update({ stuck: false });
    } finally {
      this.sending = false;
    }
  }

  private async send(batch: Queued[]): Promise<boolean> {
    try {
      const response = await fetch("/api/vocab", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ results: batch.map(({ id: _id, ...r }) => r) }),
      });
      // A batch the server can't read never will be: drop it rather than retry forever.
      if (response.status === 400) return true;
      return response.ok;
    } catch {
      return false;
    }
  }

  private read(): Queued[] {
    return this.list;
  }

  private write(list: Queued[]) {
    this.list = list;
    try {
      if (list.length) localStorage.setItem(KEY, JSON.stringify(list));
      else localStorage.removeItem(KEY);
    } catch {
      // Storage blocked or full: what's waiting is still sent from this page, just not kept for the next visit.
    }
    this.update({ waiting: list.length });
  }

  private update(patch: Partial<QueueState>) {
    const next = { ...this.state, ...patch };
    if (next.waiting === 0) next.stuck = false;
    if (next.waiting === this.state.waiting && next.offline === this.state.offline && next.stuck === this.state.stuck) return;
    this.state = next;
    this.listeners.forEach((l) => l());
  }
}

function load(): Queued[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as Queued[]) : [];
  } catch {
    return [];
  }
}

let queue: VocabQueue | null = null;

export function getVocabQueue(): VocabQueue {
  queue ??= new VocabQueue();
  return queue;
}
