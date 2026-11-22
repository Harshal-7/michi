import { describe, expect, it } from "vitest";

import { addDays, daysBetween, type StudyDate } from "@/lib/day";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";

import { makeCalendar } from "./calendar";
import {
  deckDeadline,
  type DeckState,
  formulaQuota,
  n3EarlyStartOn,
  paceQuotas,
  scaleToMinutes,
  trackDecks,
  trackFor,
} from "./pace";
import { plan } from "./plan";
import { deck, planInput, starterDecks } from "./testing";

const cal = (exceptions: { date: StudyDate; kind: "rest" | "no_class" | "exam" }[] = []) =>
  makeCalendar(DEFAULT_SETTINGS, exceptions);

/** Runs a deck day by day, introducing whatever paceQuotas gives it, skipping `missed` days. */
function simulate(start: StudyDate, until: StudyDate, d: DeckState, missed: ReadonlySet<StudyDate> = new Set()) {
  const c = cal();
  let current = { ...d, startedByDay: {} as Record<StudyDate, number> };
  const quotas: Record<StudyDate, number> = {};
  let lastStart: StudyDate | null = null;
  for (let day = start; daysBetween(day, until) >= 0; day = addDays(day, 1)) {
    const [q] = paceQuotas({ cal: c, date: day, decks: [current], quickCheckDone: true, newItemsAllowed: true });
    quotas[day] = q?.quota ?? 0;
    if (missed.has(day) || !q || q.quota === 0) continue;
    current = {
      ...current,
      notStarted: current.notStarted - q.quota,
      startedByDay: { ...current.startedByDay, [day]: q.quota },
      paceStart: current.paceStart ?? day,
    };
    lastStart = day;
  }
  return { left: current.notStarted, quotas, lastStart, deck: current };
}

describe("pace", () => {
  it("finishes each list by its deadline", () => {
    const decks = starterDecks();
    const byslug = (slug: string) => decks.find((x) => x.slug === slug)!;
    for (const [slug, start] of [
      ["n5-words", "2026-12-03"],
      ["n5-grammar", "2026-11-22"],
      ["n4-kanji", "2027-01-01"],
      ["n4-words", "2027-01-01"],
      ["n4-grammar", "2027-01-01"],
      ["n3-words", "2027-07-05"],
    ] as const) {
      const d = byslug(slug);
      const deadline = DEFAULT_SETTINGS.listDeadlines[d.level!];
      // N5 words after the quick check: about 450 left (all 718 wouldn't fit under the 25-a-day cap).
      const left = slug === "n5-words" ? 450 : d.notStarted;
      const run = simulate(start, deadline, { ...d, notStarted: left, active: true });
      expect(run.left, slug).toBe(0);
      expect(daysBetween(run.lastStart!, deadline), slug).toBeGreaterThanOrEqual(0);
    }
  });

  it("spreads missed days over the days left instead of piling them up", () => {
    const words = deck({ kind: "word", level: "N4", total: 667, active: true });
    const missed = new Set(["2027-02-01", "2027-02-02", "2027-02-03"]);
    const run = simulate("2027-01-01", "2027-06-12", words, missed);
    expect(run.left).toBe(0);
    // About 4 a day before; after three days off the next day asks for one more, not three days' worth.
    expect(run.quotas["2027-01-29"]).toBe(4);
    expect(run.quotas["2027-02-04"]).toBeGreaterThanOrEqual(4);
    expect(run.quotas["2027-02-04"]).toBeLessThanOrEqual(5);
  });

  it("weights weekends at 1.2 and gives exam-prep and rest days nothing", () => {
    // Mon 4 – Sun 10 Jan: 5 weekdays and a weekend, 7.4 in all.
    const words = deck({ kind: "word", level: "N4", notStarted: 74, deadline: "2027-01-10" });
    expect(formulaQuota(cal(), "2027-01-04", words)).toBe(10); // Monday: 74 × 1 ÷ 7.4
    expect(formulaQuota(cal(), "2027-01-09", { ...words, notStarted: 24 })).toBe(12); // Saturday: 24 × 1.2 ÷ 2.4
    // A rest day takes nothing, and the days around it take its share.
    const c = cal([{ date: "2027-01-06", kind: "rest" }]);
    expect(formulaQuota(c, "2027-01-06", words)).toBe(0);
    expect(formulaQuota(c, "2027-01-04", words)).toBe(12); // 74 ÷ 6.4
    expect(formulaQuota(c, "2027-06-20", { ...words, deadline: "2027-06-30" })).toBe(0); // N4 exam prep
  });

  it("uses a deck's own deadline and a per-day pace", () => {
    const words = deck({ kind: "word", level: "N4", notStarted: 300 });
    expect(deckDeadline(words, "2027-01-04", cal()).deadline).toBe("2027-06-12");
    expect(deckDeadline({ ...words, deadline: "2027-03-01" }, "2027-01-04", cal()).deadline).toBe("2027-03-01");
    expect(formulaQuota(cal(), "2027-01-04", { ...words, paceMode: "per_day", pacePerDay: 7 })).toBe(7);
  });

  it("caps words, kanji and grammar, and puts class items first outside the caps", () => {
    const decks = [
      deck({ kind: "word", level: "N4", notStarted: 500, deadline: "2027-01-10" }),
      deck({ kind: "kanji", level: "N4", notStarted: 100, deadline: "2027-01-10" }),
      deck({ kind: "grammar", level: "N4", notStarted: 40, deadline: "2027-01-10" }),
      deck({ kind: null, level: null, source: "class", notStarted: 30 }),
    ];
    const q = paceQuotas({ cal: cal(), date: "2027-01-04", decks, quickCheckDone: true, newItemsAllowed: true });
    const by = (kind: string | null) => q.find((x) => x.deck.kind === kind)!.quota;
    expect([by("word"), by("kanji"), by("grammar"), by(null)]).toEqual([25, 6, 3, 15]);
    expect(q[0].priority).toBe("class");
  });

  it("gives the N5 kana, kanji and word decks nothing until the quick check is done", () => {
    const decks = starterDecks();
    const before = paceQuotas({ cal: cal(), date: "2026-12-03", decks, quickCheckDone: false, newItemsAllowed: true });
    const quota = (qs: typeof before, slug: string) => qs.find((q) => q.deck.slug === slug)?.quota;
    expect(quota(before, "n5-words")).toBe(0);
    expect(quota(before, "hiragana")).toBe(0);
    expect(quota(before, "n5-grammar")).toBeGreaterThan(0);
    const after = paceQuotas({ cal: cal(), date: "2026-12-03", decks, quickCheckDone: true, newItemsAllowed: true });
    expect(quota(after, "n5-words")).toBeGreaterThan(0);
    // Projections still see the pace the list would have.
    expect(before.find((q) => q.deck.slug === "n5-words")!.capped).toBe(quota(after, "n5-words"));
  });

  it("holds leftover N5 items for the review week, then gives them 3 weeks from 1 Jan", () => {
    const words = deck({ kind: "word", level: "N5", notStarted: 60 });
    expect(deckDeadline(words, "2026-12-28", cal())).toEqual({ deadline: "2026-12-26", state: "waiting" });
    expect(formulaQuota(cal(), "2026-12-28", words)).toBe(0);
    expect(deckDeadline(words, "2027-01-01", cal())).toEqual({ deadline: "2027-01-21", state: "leftover" });
    expect(formulaQuota(cal(), "2027-01-01", words)).toBeGreaterThan(0);
    const decks = [words, deck({ kind: "word", level: "N4", notStarted: 667, unlockOn: "2027-01-01", active: false })];
    const q = paceQuotas({ cal: cal(), date: "2027-01-04", decks, quickCheckDone: true, newItemsAllowed: true });
    expect(q[0].deck.level).toBe("N5");
    expect(q[0].priority).toBe("leftover");
  });

  it("starts N3 early at a third of the pace only while N4 is well ahead", () => {
    const decks = starterDecks();
    const n4 = decks.filter((d) => d.level === "N4");
    // Well ahead: most of N4 already started, and a brisk recent pace.
    const ahead = decks.map((d) =>
      d.level === "N5"
        ? { ...d, notStarted: 0 }
        : d.level === "N4"
        ? {
            ...d,
            notStarted: Math.round(d.total * 0.2),
            paceStart: "2027-03-22",
            startedByDay: Object.fromEntries(
              Array.from({ length: 13 }, (_, i) => [addDays("2027-03-22", i), Math.ceil(d.total / 40)]),
            ),
          }
        : d,
    );
    expect(n3EarlyStartOn(cal(), "2027-04-05", ahead)).toBe(true);
    const q = paceQuotas({ cal: cal(), date: "2027-04-05", decks: ahead, quickCheckDone: true, newItemsAllowed: true });
    const n3 = q.filter((x) => x.priority === "early");
    expect(n3.map((x) => x.deck.slug).sort()).toEqual(["n3-kanji", "n3-words"]);
    const words = n3.find((x) => x.deck.kind === "word")!;
    const full = formulaQuota(cal(), "2027-04-05", words.deck);
    expect(words.quota).toBe(Math.ceil(full / 3));
    // Not before 1 April, not with N4 merely on schedule, and never in N4 exam prep.
    expect(n3EarlyStartOn(cal(), "2027-03-29", ahead)).toBe(false);
    const onSchedule = ahead.map((d) => (d.level === "N4" ? { ...d, notStarted: Math.round(d.total * 0.45), startedByDay: {} } : d));
    expect(n3EarlyStartOn(cal(), "2027-04-05", onSchedule)).toBe(false);
    expect(n4.length).toBe(3);
    const prep = paceQuotas({ cal: cal(), date: "2027-06-21", decks: ahead, quickCheckDone: true, newItemsAllowed: true });
    expect(prep.filter((x) => x.priority === "early").every((x) => x.quota === 0)).toBe(true);
  });

  it("stops new items on recovery, re-entry and exam-prep days", () => {
    const normal = plan(planInput("2027-01-05"));
    expect(Object.keys(normal.newQuota).length).toBeGreaterThan(0);
    const recovery = plan(planInput("2027-01-05", { reviews: { due: 400, learningDue: 10 } }));
    const reEntry = plan(planInput("2027-01-05", { lastActiveDate: "2027-01-01" }));
    const prep = plan(planInput("2027-06-15"));
    for (const p of [recovery, reEntry, prep]) {
      expect(p.newQuota).toEqual({});
      expect(p.tasks.some((t) => t.kind === "new_items")).toBe(false);
    }
    expect([recovery.mode, reEntry.mode, prep.mode]).toEqual(["recovery", "re_entry", "exam_prep"]);
  });
});

describe("projections and the on-track marker", () => {
  const words = deck({ kind: "word", level: "N5", notStarted: 300, paceStart: "2026-12-01" });
  const days = (from: StudyDate, n: number, each: number) =>
    Object.fromEntries(Array.from({ length: n }, (_, i) => [addDays(from, i), each]));

  it("is on track when the recent pace finishes by the deadline", () => {
    const t = trackDecks(cal(), "2026-12-08", [{ ...words, startedByDay: days("2026-12-01", 7, 20) }], { [words.id]: 20 });
    expect(t.tone).toBe("good");
    expect(daysBetween(t.finish!, "2026-12-26")).toBeGreaterThanOrEqual(0);
  });

  it("is amber 1–3 days behind and red after that", () => {
    expect(trackFor(cal(), "2026-12-08", 300, 300 / 21, "2026-12-26").tone).toBe("warn");
    expect(trackFor(cal(), "2026-12-08", 300, 300 / 30, "2026-12-26").tone).toBe("bad");
    expect(trackFor(cal(), "2026-12-08", 0, 0, "2026-12-26")).toMatchObject({ done: true, tone: "good" });
    expect(trackFor(cal(), "2026-12-08", 10, 0, "2026-12-26")).toMatchObject({ finish: null, tone: "bad" });
  });

  it("projects a new list from today's plan rather than from nothing", () => {
    const fresh = { ...words, paceStart: null };
    expect(trackDecks(cal(), "2026-12-03", [fresh], {}, { [fresh.id]: 14 }).tone).toBe("good");
  });
});

describe("fitting new items into the time left", () => {
  it("scales down in proportion and keeps one grammar point", () => {
    const quotas = [
      { deck: { kind: "word" as const }, priority: "current" as const, quota: 20 },
      { deck: { kind: "kanji" as const }, priority: "current" as const, quota: 4 },
      { deck: { kind: "grammar" as const }, priority: "current" as const, quota: 2 },
    ];
    const fits = scaleToMinutes(quotas, 60);
    expect(fits.map((q) => q.scaled)).toEqual([20, 4, 2]);
    const tight = scaleToMinutes(quotas, 6);
    expect(tight.find((q) => q.deck.kind === "grammar")!.scaled).toBe(1);
    expect(tight.find((q) => q.deck.kind === "word")!.scaled).toBeLessThan(20);
  });

  it("keeps class items first", () => {
    const quotas = [
      { deck: { kind: null }, priority: "class" as const, quota: 10 },
      { deck: { kind: "word" as const }, priority: "current" as const, quota: 20 },
    ];
    expect(scaleToMinutes(quotas, 12).map((q) => q.scaled)).toEqual([10, 2]);
  });
});
