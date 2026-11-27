import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "@/db/client";
import { activityLogs, prompts, shadowingSets } from "@/db/schema";
import { createTestDb } from "@/db/test/test-db";
import { addDays } from "@/lib/day";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";

import { getPrompt, getShadowingSet, listShadowingSets, logPracticeMinutes, practiceMinutesOn, promptOfTheDay } from "./practice";

let db: Db;
let drop: () => Promise<void>;
beforeAll(async () => ({ db, drop } = await createTestDb()));
afterAll(() => drop?.());
beforeEach(() => db.execute(sql`truncate prompts, shadowing_sets, activity_logs restart identity cascade`));

const prompt = (slug: string, level: "N5" | "N4" | "work") => ({
  seedSlug: slug,
  level,
  prompt: `Say ${slug}.`,
  hints: ["〜です"],
  model: "はじめまして。",
  modelEn: "Nice to meet you.",
});

// The N5 phase runs from 21 Nov to 31 Dec 2026 in the default settings, N4 from 1 Jan 2027.
const n5Day = "2026-12-03";
const n4Day = "2027-01-04";

describe("promptOfTheDay", () => {
  it("picks the same prompt all day and the next one the day after, at the phase's level", async () => {
    await db.insert(prompts).values([prompt("a", "N5"), prompt("b", "N5"), prompt("c", "N5"), prompt("d", "N4"), prompt("w", "work")]);
    const today = await promptOfTheDay(db, n5Day, DEFAULT_SETTINGS);
    expect(await promptOfTheDay(db, n5Day, DEFAULT_SETTINGS)).toEqual(today);
    const days = await Promise.all([0, 1, 2, 3].map((d) => promptOfTheDay(db, addDays(n5Day, d), DEFAULT_SETTINGS)));
    const slugs = days.map((p) => p?.prompt);
    expect(new Set(slugs.slice(0, 3)).size).toBe(3);
    expect(slugs[3]).toBe(slugs[0]);
    expect(slugs.every((s) => ["Say a.", "Say b.", "Say c."].includes(s ?? ""))).toBe(true);

    expect((await promptOfTheDay(db, n4Day, DEFAULT_SETTINGS))?.prompt).toBe("Say d.");
  });

  it("falls back to N5 when the phase's level has none, and is null with no prompts", async () => {
    expect(await promptOfTheDay(db, n4Day, DEFAULT_SETTINGS)).toBeNull();
    await db.insert(prompts).values(prompt("a", "N5"));
    const p = await promptOfTheDay(db, n4Day, DEFAULT_SETTINGS);
    expect(p).toMatchObject({ prompt: "Say a.", hints: ["〜です"], model: "はじめまして。", modelEn: "Nice to meet you." });
    expect(await getPrompt(db, p!.id)).toEqual(p);
    expect(await getPrompt(db, 999)).toBeNull();
  });
});

describe("shadowing sets", () => {
  it("lists them in order and finds one", async () => {
    const sentences = [{ ja: "{毎朝|まいあさ}", en: "every morning" }];
    await db.insert(shadowingSets).values([
      { seedSlug: "shadow:n5:a", level: "N5", title: "A", sentences },
      { seedSlug: "shadow:n5:b", level: "N5", title: "B", sentences },
    ]);
    const sets = await listShadowingSets(db);
    expect(sets.map((s) => [s.slug, s.title])).toEqual([
      ["shadow:n5:a", "A"],
      ["shadow:n5:b", "B"],
    ]);
    expect(await getShadowingSet(db, sets[1].id)).toEqual(sets[1]);
    expect(await getShadowingSet(db, 999)).toBeNull();
  });
});

describe("practice minutes", () => {
  it("logs held to 1–30 minutes as automatic speaking, and adds up a day's", async () => {
    expect(await logPracticeMinutes(db, { kind: "speaking", minutes: 12, date: n5Day })).toBe(12);
    expect(await logPracticeMinutes(db, { kind: "shadowing", minutes: 90, date: n5Day })).toBe(30);
    expect(await logPracticeMinutes(db, { kind: "shadowing", minutes: 0, date: n5Day })).toBe(1);
    await logPracticeMinutes(db, { kind: "shadowing", minutes: 5, date: addDays(n5Day, 1) });
    // Typed in by hand: not counted as logged by itself.
    await db.insert(activityLogs).values({ studyDate: n5Day, kind: "speaking", skill: "speaking", minutes: 20 });

    const rows = await db.select().from(activityLogs);
    expect(rows.filter((r) => r.auto).every((r) => r.skill === "speaking")).toBe(true);
    expect(await practiceMinutesOn(db, n5Day)).toEqual({ speaking: 12, shadowing: 31, total: 43 });
    expect(await practiceMinutesOn(db, "2026-12-10")).toEqual({ speaking: 0, shadowing: 0, total: 0 });
  });
});
