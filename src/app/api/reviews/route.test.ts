import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/db/client";
import { createTestDb } from "@/db/test/test-db";
import { addCard, cardRow, resetStudyTables } from "@/lib/srs/test-helpers";

const state = vi.hoisted(() => ({ db: null as unknown as Db, signedIn: true }));

vi.mock(import("@/db/client"), async (importOriginal) => ({ ...(await importOriginal()), getDb: () => state.db }));
vi.mock("@/lib/auth/session", () => ({
  currentSession: async () => (state.signedIn ? { device: "phone" } : null),
  unauthorized: () => Response.json({ error: "Sign in first." }, { status: 401 }),
}));

const { POST } = await import("./route");

let drop: () => Promise<void>;
beforeAll(async () => ({ db: state.db, drop } = await createTestDb()));
afterAll(() => drop?.());
beforeEach(async () => {
  state.signedIn = true;
  await resetStudyTables(state.db);
});

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/reviews", { method: "POST", body: JSON.stringify(body) }));

const grade = (cardId: number, lastReviewId: string | null) => ({
  kind: "grade",
  id: crypto.randomUUID(),
  cardId,
  rating: 3,
  reviewedAt: new Date().toISOString(),
  durationMs: 2500,
  lastReviewId,
});

describe("POST /api/reviews", () => {
  it("checks the session", async () => {
    state.signedIn = false;
    expect((await post({ ops: [grade(1, null)] })).status).toBe(401);
  });

  it("saves a repeated grade once and drops a stale one, with a notice for each", async () => {
    const { cardId } = await addCard(state.db);
    const first = grade(cardId, null);
    const response = await post({ ops: [first, first, grade(cardId, null)] });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { results: { status: string }[]; version: string };
    expect(body.results.map((r) => r.status)).toEqual(["saved", "duplicate", "stale"]);
    expect(body.version).toBe("dev");
    expect((await cardRow(state.db, cardId)).reps).toBe(1);
  });

  it("takes at most 20 ops at a time", async () => {
    const ops = Array.from({ length: 21 }, () => grade(1, null));
    expect((await post({ ops })).status).toBe(400);
    expect((await post({ ops: [] })).status).toBe(400);
    const bad = await POST(new Request("http://localhost/api/reviews", { method: "POST", body: "not json" }));
    expect(bad.status).toBe(400);
  });
});
