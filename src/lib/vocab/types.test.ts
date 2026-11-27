import { describe, expect, it } from "vitest";

import { buildSet, filterCounts, shuffled, type VocabWord } from "./types";

const word = (id: number, ja_en: VocabWord["progress"]["ja_en"] = null): VocabWord => ({
  id,
  term: `語${id}`,
  reading: `ご${id}`,
  meanings: [`word ${id}`],
  pos: ["noun"],
  usuallyKana: false,
  example: null,
  forms: [],
  others: [],
  progress: { ja_en, en_ja: null },
});

const words = [
  word(1),
  word(2, { right: 2, wrong: 0, lastRight: true }),
  word(3, { right: 0, wrong: 1, lastRight: false }),
  word(4, { right: 1, wrong: 2, lastRight: false }),
];

describe("building a set", () => {
  it("takes all words, the ones not typed right yet, or the ones missed last time", () => {
    const ids = (filter: "all" | "not_right" | "missed") =>
      buildSet(words, { direction: "ja_en", filter, order: "list", seed: 1 }).map((w) => w.id);
    expect(ids("all")).toEqual([1, 2, 3, 4]);
    expect(ids("not_right")).toEqual([1, 3]);
    expect(ids("missed")).toEqual([3, 4]);
    expect(filterCounts(words, "ja_en")).toEqual({ all: 4, not_right: 2, missed: 2 });
  });

  it("keeps each direction's progress apart", () => {
    expect(filterCounts(words, "en_ja")).toEqual({ all: 4, not_right: 4, missed: 0 });
  });

  it("shuffles the same way for the same seed, keeping every word", () => {
    const list = Array.from({ length: 50 }, (_, i) => i);
    const a = shuffled(list, 42);
    expect(a).toEqual(shuffled(list, 42));
    expect(a).not.toEqual(list);
    expect([...a].sort((x, y) => x - y)).toEqual(list);
    expect(buildSet(words, { direction: "ja_en", filter: "all", order: "shuffled", seed: 7 }).map((w) => w.id).sort()).toEqual([1, 2, 3, 4]);
  });
});
