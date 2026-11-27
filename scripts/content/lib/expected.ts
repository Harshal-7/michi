/** The counts the content must hit. The build and the tests both check them. */
export const EXPECTED = {
  kana: { hiragana: 104, katakana: 124 },
  kanji: { N5: 80, N4: 166, N3: 367 },
  kanjiInfo: 2136,
  /**
   * The decks list 718 / 668 / 2,140. Four entries repeat a word from a lower level and stay there
   * only: N4 そう (N5 そう), N3 在る; 有る (N5 在る, 有る), N3 運転 (N4 運転する) and N3 河 (N5 川; 河).
   */
  words: { N5: 718, N4: 667, N3: 2137 },
  dictionary: 22661,
  grammar: { N5: 84, N4: 132, N3: 182 },
  prompts: { N5: 40, N4: 40 },
  /** Shadowing sets of 8–10 sentences each. */
  shadowing: { N5: 10 },
  /** About 45 resource links. */
  resources: { min: 40, max: 50 },
} as const;
