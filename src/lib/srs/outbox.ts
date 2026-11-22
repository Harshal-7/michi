/**
 * The browser's outbox for grades (the plan's "Reviews on a patchy phone connection", step 3).
 *
 * Every grade, undo and quick-check verdict goes into localStorage first, so nothing is lost on
 * bad signal or a closed tab. The outbox sends up to 20 at a time to /api/reviews, in order,
 * retries with backoff, and sends what it can when the page is hidden or closed. Browser only.
 */
import { useSyncExternalStore } from "react";

import { MAX_OPS_PER_REQUEST, type Op, type OpResult, type OpsResponse } from "./ops";

const KEY = "michi.outbox.v1";
const ENDPOINT = "/api/reviews";
const MAX_BACKOFF_MS = 60_000;
/** A save normally takes well under a second; only one still waiting after this is worth showing. */
const STUCK_AFTER_MS = 4000;

export type OutboxState = {
  /** Ops not yet saved, including one on its way right now. */
  waiting: number;
  /**
   * Grades are held up: a send failed, or one has waited longer than a save normally takes. The
   * "N grades waiting to save" note shows only then, so it doesn't flash up after every answer.
   */
  stuck: boolean;
  /** The last send failed, or the browser says it's offline. */
  offline: boolean;
  /** The server said the session is gone. */
  signedOut: boolean;
  /** Grades the server dropped because the card was reviewed elsewhere. */
  stale: number;
  /** The deploy the server is running, from the last reply. */
  serverVersion: string | null;
};

const SERVER_STATE: OutboxState = {
  waiting: 0,
  stuck: false,
  offline: false,
  signedOut: false,
  stale: 0,
  serverVersion: null,
};

class Outbox {
  private memory: Op[] = [];
  private inFlight = new Set<string>();
  private sending = false;
  private failures = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stuckTimer: ReturnType<typeof setTimeout> | null = null;
  /** When this page first saw each op waiting (ops left from an earlier visit: when it loaded). */
  private seenAt = new Map<string, number>();
  private listeners = new Set<() => void>();
  private state: OutboxState = { ...SERVER_STATE };

  constructor() {
    this.state = { ...this.state, offline: !navigator.onLine };
    this.track(this.read().length);
    window.addEventListener("online", () => {
      this.update({ offline: false });
      void this.flush();
    });
    window.addEventListener("offline", () => this.update({ offline: true }));
    // Phones often never fire pagehide; hidden is the last reliable moment.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.sendOnLeave();
      else void this.flush();
    });
    window.addEventListener("pagehide", () => this.sendOnLeave());
    // Another tab added or saved ops.
    window.addEventListener("storage", (e) => {
      if (e.key === KEY) this.track(this.read().length);
    });
  }

  getState = () => this.state;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  add(op: Op) {
    this.write([...this.read(), op]);
    void this.flush();
  }

  /** Takes an op back out if it hasn't been sent yet. */
  cancel(id: string): boolean {
    if (this.inFlight.has(id)) return false;
    const ops = this.read();
    const next = ops.filter((op) => op.id !== id);
    if (next.length === ops.length) return false;
    this.write(next);
    return true;
  }

  /** Undoes a grade: drops it if it's still waiting, otherwise asks the server to. */
  undoGrade(reviewId: string) {
    if (!this.cancel(reviewId)) this.add({ kind: "undo", id: crypto.randomUUID(), reviewId });
  }

  /** Cards and items with a grade or verdict not saved yet: a session loaded now shouldn't ask them again. */
  pending(): { cards: Set<number>; items: Set<number> } {
    const ops = this.read();
    return {
      cards: new Set(ops.flatMap((op) => (op.kind === "grade" ? [op.cardId] : []))),
      items: new Set(ops.flatMap((op) => (op.kind === "check" ? [op.itemId] : []))),
    };
  }

  clearStale() {
    this.update({ stale: 0 });
  }

  /** Sends what's waiting, a batch at a time, until it's empty or a send fails. */
  async flush(): Promise<void> {
    if (this.sending || this.state.signedOut) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.sending = true;
    try {
      for (;;) {
        const batch = this.read().slice(0, MAX_OPS_PER_REQUEST);
        if (batch.length === 0) break;
        batch.forEach((op) => this.inFlight.add(op.id));
        const outcome = await this.send(batch).finally(() => this.inFlight.clear());
        if (outcome === "retry") {
          this.failures++;
          const wait = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (this.failures - 1));
          this.timer = setTimeout(() => void this.flush(), wait);
          break;
        }
        this.failures = 0;
        if (outcome === "stop") break;
      }
    } finally {
      this.sending = false;
    }
  }

  private async send(batch: Op[]): Promise<"ok" | "retry" | "stop"> {
    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops: batch }),
      });
    } catch {
      this.update({ offline: true, stuck: true });
      return "retry";
    }
    if (response.status === 401) {
      this.update({ signedOut: true, offline: false, stuck: true });
      return "stop";
    }
    if (response.status === 400) {
      // The batch itself didn't check out; retrying won't change that.
      this.done(batch.map((op) => ({ id: op.id, status: "invalid" })));
      return "ok";
    }
    if (!response.ok) {
      this.update({ offline: false, stuck: true });
      return "retry";
    }
    const body = (await response.json()) as OpsResponse;
    this.update({ offline: false, serverVersion: body.version });
    this.done(body.results);
    return "ok";
  }

  private done(results: OpResult[]) {
    const finished = new Set(results.map((r) => r.id));
    this.write(this.read().filter((op) => !finished.has(op.id)));
    const stale = results.filter((r) => r.status === "stale").length;
    if (stale) this.update({ stale: this.state.stale + stale });
  }

  /** The page is going away: hand the first batch to the browser to finish sending. */
  private sendOnLeave() {
    const batch = this.read()
      .filter((op) => !this.inFlight.has(op.id))
      .slice(0, MAX_OPS_PER_REQUEST);
    if (batch.length === 0) return;
    try {
      void fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ops: batch }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Too large for keepalive or the page is already gone: the next visit sends them.
    }
  }

  private read(): Op[] {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Op[]) : [];
    } catch {
      return this.memory;
    }
  }

  private write(ops: Op[]) {
    this.memory = ops;
    try {
      localStorage.setItem(KEY, JSON.stringify(ops));
    } catch {
      // Private windows can refuse storage; the ops stay in memory for this page.
    }
    this.track(ops.length);
  }

  /** Counts what's waiting, and starts or stops the clock that decides it's stuck. */
  private track(waiting: number) {
    if (waiting === 0) {
      if (this.stuckTimer) clearTimeout(this.stuckTimer);
      this.stuckTimer = null;
      this.seenAt.clear();
      this.update({ waiting, stuck: false });
      return;
    }
    this.update({ waiting });
    this.checkStuck();
  }

  /** Stuck once the oldest op still waiting has waited longer than a save normally takes. */
  private checkStuck() {
    if (this.stuckTimer) return;
    const now = Date.now();
    const ops = this.read();
    if (ops.length === 0) return;
    const oldest = Math.min(...ops.map((op) => this.seenAt.get(op.id) ?? this.seen(op.id, now)));
    const wait = oldest + STUCK_AFTER_MS - now;
    if (wait <= 0) {
      this.update({ stuck: true });
      return;
    }
    this.stuckTimer = setTimeout(() => {
      this.stuckTimer = null;
      this.checkStuck();
    }, wait);
  }

  private seen(id: string, at: number): number {
    this.seenAt.set(id, at);
    return at;
  }

  private update(patch: Partial<OutboxState>) {
    const next = { ...this.state, ...patch };
    if ((Object.keys(patch) as (keyof OutboxState)[]).every((k) => next[k] === this.state[k])) return;
    this.state = next;
    this.listeners.forEach((l) => l());
  }
}

let outbox: Outbox | null = null;

/** The page's outbox. Browser only. */
export function getOutbox(): Outbox {
  outbox ??= new Outbox();
  return outbox;
}

const subscribe = (listener: () => void) => getOutbox().subscribe(listener);
const snapshot = () => getOutbox().getState();
const serverSnapshot = () => SERVER_STATE;

/** The outbox's state for a component; the server render sees an empty outbox. */
export function useOutbox(): OutboxState {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
