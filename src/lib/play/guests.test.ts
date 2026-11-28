import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/db/client";
import { players } from "@/db/schema";
import { createTestDb } from "@/db/test/test-db";

import { checkGuest, makeGuest, MAX_NEW_PER_ADDRESS, MAX_WRONG_PER_ADDRESS, NO_MATCH, WAIT_MESSAGE } from "./guests";

let db: Db;
let drop: () => Promise<void>;
beforeAll(async () => ({ db, drop } = await createTestDb()));
afterAll(() => drop?.());
beforeEach(() => db.execute(sql`truncate sign_in_attempts; delete from players where not is_owner`));

const minutes = (n: number) => new Date(new Date("2026-12-03T14:00:00Z").getTime() + n * 60_000);

describe("guests", () => {
  it("makes a guest with a scrambled PIN and signs them in by name and PIN", async () => {
    const made = await makeGuest(db, "Aki", "0420", "1.1.1.1", minutes(0));
    expect(made).toMatchObject({ player: { name: "Aki", isOwner: false } });
    const [row] = await db.select().from(players).where(sql`${players.nameKey} = 'aki'`);
    expect(row.pinHash).toMatch(/^scrypt:/);
    expect(row.pinHash).not.toContain("0420");
    expect(await checkGuest(db, "aki", "０４２０", "1.1.1.1", minutes(1))).toMatchObject({ player: { name: "Aki" } });
    expect(await checkGuest(db, "Aki", "0421", "1.1.1.1", minutes(1))).toEqual({ error: NO_MATCH });
    expect(await checkGuest(db, "Nobody", "0420", "1.1.1.1", minutes(1))).toEqual({ error: NO_MATCH });
  });

  it("keeps names unique and the owner's name for the owner", async () => {
    await makeGuest(db, "Aki", "0420", "1.1.1.1", minutes(0));
    expect(await makeGuest(db, "ＡＫＩ", "1111", "1.1.1.1", minutes(0))).toMatchObject({ error: expect.stringMatching(/taken/) });
    expect(await makeGuest(db, "Harshal", "1111", "1.1.1.1", minutes(0))).toMatchObject({ error: expect.stringMatching(/available/) });
    expect(await makeGuest(db, "Aki", "12", "1.1.1.1", minutes(0))).toEqual({ error: "The PIN is 4 digits." });
    // The owner has no PIN to guess.
    expect(await checkGuest(db, "Harshal", "0000", "1.1.1.1", minutes(0))).toEqual({ error: NO_MATCH });
  });

  it("waits 15 minutes after 5 wrong PINs on a name, from any address", async () => {
    await makeGuest(db, "Aki", "0420", "1.1.1.1", minutes(0));
    for (let i = 0; i < 5; i++) expect(await checkGuest(db, "Aki", `000${i}`, `9.9.9.${i}`, minutes(i))).toEqual({ error: NO_MATCH });
    // Even the right PIN waits now.
    expect(await checkGuest(db, "Aki", "0420", "1.1.1.1", minutes(6))).toEqual({ error: WAIT_MESSAGE });
    // Another name isn't affected.
    await makeGuest(db, "Mei", "5555", "1.1.1.1", minutes(6));
    expect(await checkGuest(db, "Mei", "5555", "1.1.1.1", minutes(7))).toMatchObject({ player: { name: "Mei" } });
    // 15 minutes after the first wrong try, it counts 4 again.
    expect(await checkGuest(db, "Aki", "0420", "1.1.1.1", minutes(15.01))).toMatchObject({ player: { name: "Aki" } });
  });

  it("slows down one address guessing across many names", async () => {
    for (let i = 0; i < MAX_WRONG_PER_ADDRESS; i++) await checkGuest(db, `name${i}`, "1234", "6.6.6.6", minutes(0));
    expect(await checkGuest(db, "fresh", "1234", "6.6.6.6", minutes(1))).toEqual({ error: WAIT_MESSAGE });
    expect(await checkGuest(db, "fresh", "1234", "7.7.7.7", minutes(1))).toEqual({ error: NO_MATCH });
    // 22 scrypt checks: about 4 seconds alone, more on a busy machine.
  }, 20_000);

  it("lets one address make only so many names", async () => {
    for (let i = 0; i < MAX_NEW_PER_ADDRESS; i++) expect(await makeGuest(db, `guest${i}`, "1234", "8.8.8.8", minutes(0))).toHaveProperty("player");
    expect(await makeGuest(db, "onemore", "1234", "8.8.8.8", minutes(1))).toEqual({ error: WAIT_MESSAGE });
  });
});
