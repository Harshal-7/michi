import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Db } from "@/db/client";
import { activitySkill } from "@/db/schema";
import { createTestDb } from "@/db/test/test-db";

import { addMinutesEntry, datable, deleteMinutesEntry, listMinutes, MinutesEntry } from "./data";
import { SKILLS } from "./kinds";

let db: Db;
let drop: () => Promise<void>;
beforeAll(async () => ({ db, drop } = await createTestDb()));
afterAll(() => drop?.());

describe("the minutes log", () => {
  it("keeps its skills in step with the database", () => {
    expect([...SKILLS]).toEqual(activitySkill.enumValues);
  });

  it("checks an entry", () => {
    const ok = MinutesEntry.safeParse({ date: "2026-12-08", kind: "listening", skill: "listening", minutes: "15", note: " anime " });
    expect(ok.success && ok.data).toEqual({ date: "2026-12-08", kind: "listening", skill: "listening", minutes: 15, note: "anime" });
    expect(MinutesEntry.safeParse({ date: "2026-12-08", kind: "class", skill: "listening", minutes: 15 }).success).toBe(false);
    expect(MinutesEntry.safeParse({ date: "2026-12-08", kind: "reading", skill: "reading", minutes: 0 }).success).toBe(false);
    expect(datable("2026-12-08", "2026-12-08")).toBe(true);
    expect(datable("2026-12-02", "2026-12-08")).toBe(true);
    expect(datable("2026-12-01", "2026-12-08")).toBe(false);
    expect(datable("2026-12-09", "2026-12-08")).toBe(false);
  });

  it("adds, lists the week's entries and deletes one", async () => {
    await db.execute(sql`truncate activity_logs restart identity`);
    const a = await addMinutesEntry(db, { date: "2026-12-07", kind: "listening", skill: "listening", minutes: 15, note: "" });
    await addMinutesEntry(db, { date: "2026-12-08", kind: "shadowing", skill: "speaking", minutes: 8, note: "" });
    await addMinutesEntry(db, { date: "2026-11-30", kind: "reading", skill: "reading", minutes: 12, note: "NHK Easy" });
    const week = await listMinutes(db, "2026-12-07", "2026-12-13");
    expect(week.map((e) => [e.date, e.kind, e.minutes])).toEqual([
      ["2026-12-08", "shadowing", 8],
      ["2026-12-07", "listening", 15],
    ]);
    await deleteMinutesEntry(db, a);
    expect(await listMinutes(db, "2026-12-07", "2026-12-13")).toHaveLength(1);
  });
});
