import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { MAX_WRONG_TRIES, createSession, deleteSession, findSession, recordSignInAttempt, signInAllowed } from "./auth";
import type { Db } from "./client";
import { createTestDb } from "./test/test-db";

let db: Db;
let drop: () => Promise<void>;
beforeAll(async () => ({ db, drop } = await createTestDb()));
afterAll(() => drop?.());
beforeEach(() => db.execute(sql`truncate sign_in_attempts, auth_sessions`));

const minutes = (n: number, from = new Date("2026-12-03T14:00:00Z")) => new Date(from.getTime() + n * 60_000);

describe("sign-in rate limit", () => {
  it("pauses after 5 wrong tries for 15 minutes", async () => {
    for (let i = 0; i < MAX_WRONG_TRIES; i++) {
      expect(await signInAllowed(db, "1.2.3.4", minutes(i))).toBe(true);
      await recordSignInAttempt(db, "1.2.3.4", false, minutes(i));
    }
    expect(await signInAllowed(db, "1.2.3.4", minutes(5))).toBe(false);
    // Another address isn't affected.
    expect(await signInAllowed(db, "5.6.7.8", minutes(5))).toBe(true);
    // 15 minutes after the first wrong try, it counts 4 again.
    expect(await signInAllowed(db, "1.2.3.4", minutes(15.01))).toBe(true);
  });

  it("starts counting again after a right try", async () => {
    for (let i = 0; i < 4; i++) await recordSignInAttempt(db, "1.2.3.4", false, minutes(i));
    await recordSignInAttempt(db, "1.2.3.4", true, minutes(4));
    for (let i = 5; i < 9; i++) await recordSignInAttempt(db, "1.2.3.4", false, minutes(i));
    expect(await signInAllowed(db, "1.2.3.4", minutes(9))).toBe(true);
    await recordSignInAttempt(db, "1.2.3.4", false, minutes(9));
    expect(await signInAllowed(db, "1.2.3.4", minutes(10))).toBe(false);
  });

  it("slows down guesses spread over many addresses", async () => {
    await db.execute(
      sql`insert into sign_in_attempts (key, ok, at) select 'ip-' || g, false, ${minutes(0)} from generate_series(1, 100) g`,
    );
    expect(await signInAllowed(db, "1.2.3.4", minutes(1))).toBe(false);
  });

  it("clears tries older than a day", async () => {
    await recordSignInAttempt(db, "1.2.3.4", false, minutes(0));
    await recordSignInAttempt(db, "1.2.3.4", true, minutes(25 * 60));
    const { rows } = await db.execute(sql`select count(*)::int as n from sign_in_attempts`);
    expect(rows[0]).toEqual({ n: 1 });
  });
});

describe("sessions", () => {
  it("lasts a year and ends on sign-out", async () => {
    await createSession(db, "hash-a", "phone", minutes(0));
    expect(await findSession(db, "hash-a", minutes(60 * 24 * 364))).toMatchObject({ device: "phone" });
    expect(await findSession(db, "hash-a", minutes(60 * 24 * 366))).toBeNull();
    await deleteSession(db, "hash-a");
    expect(await findSession(db, "hash-a", minutes(1))).toBeNull();
  });

  it("keeps each device separate", async () => {
    await createSession(db, "hash-phone", "phone", minutes(0));
    await createSession(db, "hash-laptop", "laptop", minutes(0));
    await deleteSession(db, "hash-laptop");
    expect(await findSession(db, "hash-phone", minutes(1))).not.toBeNull();
  });
});
