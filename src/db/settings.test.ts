import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { studyDate } from "@/lib/day";
import { DEFAULT_SETTINGS, parseStoredSettings } from "@/lib/settings/schema";

import type { Db } from "./client";
import { cards, items, reviewLogs, settings } from "./schema";
import { clearOverride, getSettings, listOverrides, SettingsError, setOverride, updateSettings } from "./settings";
import { createTestDb } from "./test/test-db";

let db: Db;
let drop: () => Promise<void>;
beforeAll(async () => ({ db, drop } = await createTestDb()));
afterAll(() => drop?.());

describe("settings", () => {
  beforeEach(() => db.execute(sql`truncate settings, calendar_overrides`));

  it("has the agreed defaults", async () => {
    const s = await getSettings(db);
    expect(s).toEqual(DEFAULT_SETTINGS);
    expect(s.exams.N4).toEqual({ date: "2027-07-04", confirmed: false });
    expect(s.exams.N3).toEqual({ date: "2027-12-05", confirmed: false });
    expect(s.registration.N4.remindOn).toBe("2027-03-01");
    expect(s.registration.N3.remindOn).toBe("2027-08-01");
    expect(s.classes).toEqual({ days: [6, 0], startsOn: "2027-01-02", minutes: 120 });
    expect(s.budgets).toEqual({ weekdayMinutes: 75, weekendMinutes: 210 });
    expect(s.fsrs).toEqual({ targetRecall: 0.9, learningSteps: ["1m", "10m"] });
    expect([s.furigana, s.theme, s.reminder.time]).toEqual([true, "system", "20:30"]);
  });

  it("saves a change and keeps the rest", async () => {
    await updateSettings(db, { exams: { N4: { date: "2027-07-05", confirmed: true } } });
    await updateSettings(db, { budgets: { weekdayMinutes: 60 } });
    const s = await getSettings(db);
    expect(s.exams.N4).toEqual({ date: "2027-07-05", confirmed: true });
    expect(s.exams.N3).toEqual(DEFAULT_SETTINGS.exams.N3);
    expect(s.budgets).toEqual({ weekdayMinutes: 60, weekendMinutes: 210 });
  });

  it("refuses settings that don't agree with each other", async () => {
    await expect(updateSettings(db, { phases: { n4: { start: "2026-11-01" } } })).rejects.toThrow(SettingsError);
    await expect(updateSettings(db, { exams: { N3: { date: "2027-01-01" } } })).rejects.toThrow(/N4 exam/);
    await expect(updateSettings(db, { reminder: { time: "25:00" } })).rejects.toThrow(SettingsError);
    await expect(updateSettings(db, { classes: { days: [6, 6] } })).rejects.toThrow(/each day once/);
    expect(await getSettings(db)).toEqual(DEFAULT_SETTINGS);
  });

  it("fills in fields added after the row was saved", async () => {
    await db.insert(settings).values({ id: 1, data: { furigana: false, budgets: { weekdayMinutes: 50 } } });
    const s = await getSettings(db);
    expect(s.furigana).toBe(false);
    expect(s.budgets).toEqual({ weekdayMinutes: 50, weekendMinutes: 210 });
    expect(s.exams).toEqual(DEFAULT_SETTINGS.exams);
  });

  it("falls back to the default for a broken section", () => {
    const s = parseStoredSettings({ reminder: { enabled: "yes", time: 8 }, furigana: false });
    expect(s.reminder).toEqual(DEFAULT_SETTINGS.reminder);
    expect(s.furigana).toBe(false);
    expect(parseStoredSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps one override per date", async () => {
    await setOverride(db, { date: "2026-12-25", kind: "rest", note: "Christmas" });
    await setOverride(db, { date: "2027-01-09", kind: "no_class" });
    await setOverride(db, { date: "2026-12-25", kind: "no_class" });
    expect(await listOverrides(db, "2026-12-01", "2027-01-31")).toEqual([
      { date: "2026-12-25", kind: "no_class", note: "" },
      { date: "2027-01-09", kind: "no_class", note: "" },
    ]);
    await clearOverride(db, "2026-12-25");
    expect(await listOverrides(db, "2026-12-01", "2026-12-31")).toEqual([]);
    await expect(setOverride(db, { date: "2026-02-30", kind: "rest" })).rejects.toThrow();
  });
});

describe("review_logs.study_date", () => {
  it("matches studyDate() at the 4 am and midnight edges", async () => {
    const [item] = await db
      .insert(items)
      .values({ kind: "kana", term: "あ", source: "manual", dedupeKey: "あ" })
      .returning();
    const [card] = await db.insert(cards).values({ itemId: item.id, cardType: "recognition" }).returning();
    const instants = [
      "2026-12-02T22:29:59.999Z", // 03:59:59 IST on 3 Dec
      "2026-12-02T22:30:00.000Z", // 04:00 IST
      "2026-12-02T18:30:00.000Z", // midnight IST
      "2026-12-31T22:30:00.000Z", // 4 am on 1 Jan
    ].map((s) => new Date(s));
    const rows = await db
      .insert(reviewLogs)
      .values(
        instants.map((reviewedAt) => ({
          id: crypto.randomUUID(),
          cardId: card.id,
          rating: 3,
          reviewedAt,
          source: "session" as const,
          cardBefore: {},
        })),
      )
      .returning({ reviewedAt: reviewLogs.reviewedAt, studyDate: reviewLogs.studyDate });
    expect(rows.map((r) => r.studyDate)).toEqual(instants.map((i) => studyDate(i)));
    expect(rows.map((r) => r.studyDate)).toEqual(["2026-12-02", "2026-12-03", "2026-12-02", "2027-01-01"]);
  });
});
