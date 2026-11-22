/** Fixtures for the planner's tests: the starter decks at their real sizes, and a plan input. */
import { daysBetween, type StudyDate } from "@/lib/day";
import { DEFAULT_SETTINGS, mergeSettings, type Settings, type SettingsPatch } from "@/lib/settings/schema";

import type { DeckState } from "./pace";
import type { PlanInput } from "./plan";

let nextId = 1;

export function deck(over: Partial<DeckState> & Pick<DeckState, "kind" | "level">): DeckState {
  const total = over.total ?? over.notStarted ?? 100;
  return {
    id: nextId++,
    slug: null,
    name: "Deck",
    source: "starter",
    track: "jlpt",
    active: true,
    unlockOn: null,
    paceMode: "deadline",
    pacePerDay: null,
    deadline: null,
    items: total,
    total,
    notStarted: total,
    startedByDay: {},
    paceStart: null,
    known: 0,
    learning: 0,
    ...over,
  };
}

/** The starter decks from src/db/seed/starter.ts, nothing started yet. */
export function starterDecks(settings: Settings = DEFAULT_SETTINGS): DeckState[] {
  const level = (lv: "N5" | "N4" | "N3", kanji: number, words: number, grammar: number): DeckState[] => {
    const unlockOn = lv === "N5" ? null : lv === "N4" ? settings.phases.n4.start : settings.phases.n3.start;
    const active = lv === "N5";
    const slug = lv.toLowerCase();
    return [
      deck({ slug: `${slug}-kanji`, name: `${lv} kanji`, kind: "kanji", level: lv, total: kanji, active, unlockOn }),
      deck({ slug: `${slug}-words`, name: `${lv} words`, kind: "word", level: lv, total: words, active, unlockOn }),
      deck({ slug: `${slug}-grammar`, name: `${lv} grammar`, kind: "grammar", level: lv, total: grammar, active, unlockOn }),
    ];
  };
  return [
    deck({ slug: "hiragana", name: "Hiragana", kind: "kana", level: "N5", total: 104 }),
    deck({ slug: "katakana", name: "Katakana", kind: "kana", level: "N5", total: 124 }),
    ...level("N5", 80, 718, 84),
    ...level("N4", 166, 667, 132),
    ...level("N3", 367, 2137, 182),
  ];
}

export function settingsWith(patch: SettingsPatch): Settings {
  return mergeSettings(structuredClone(DEFAULT_SETTINGS), patch);
}

/**
 * The starter decks as they'd be on `date` if every list kept to its pace: the N5 lists after the
 * quick check (most kana and many words known), then each level running down to its deadline.
 */
export function decksOn(date: StudyDate, settings: Settings = DEFAULT_SETTINGS): DeckState[] {
  const afterQuickCheck: Record<string, number> = { hiragana: 5, katakana: 20, "n5-kanji": 40, "n5-words": 350 };
  const starts = { N5: "2026-12-03", N4: settings.phases.n4.start, N3: settings.phases.n3.start };
  return starterDecks(settings).map((d) => {
    const level = d.level!;
    const full = afterQuickCheck[d.slug!] ?? d.total;
    const span = daysBetween(starts[level], settings.listDeadlines[level]);
    const share = Math.min(1, Math.max(0, daysBetween(date, settings.listDeadlines[level]) / span));
    return { ...d, notStarted: Math.round(full * share) };
  });
}

/** A plan input on `date` with the quick check finished and nothing else going on. */
export function planInput(date: StudyDate, over: Partial<PlanInput> = {}): PlanInput {
  return {
    date,
    settings: DEFAULT_SETTINGS,
    exceptions: [],
    reviews: { due: 60, learningDue: 5 },
    lastActiveDate: null,
    decks: decksOn(date, over.settings ?? DEFAULT_SETTINGS),
    quickCheck: { remainingKana: 0, remainingOther: 0, startedOn: null },
    ...over,
  };
}
