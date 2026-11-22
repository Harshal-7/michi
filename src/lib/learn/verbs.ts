/**
 * Verb forms in Learn: the three verb groups and the N5 forms (ます, ない, て, た and the stem),
 * written fresh for Michi. The table is made by `conjugate`, so the rules and the examples can't
 * disagree; verbs.test.ts checks it against forms written out by hand.
 */

export type VerbGroup = 1 | 2 | 3;
export const FORMS = ["dictionary", "masu", "nai", "te", "ta"] as const;
export type VerbForm = (typeof FORMS)[number];

export type Verb = {
  /** The kanji part, "" for する. */
  base: string;
  /** The kanji part's reading in the dictionary form. */
  baseReading: string;
  /** The kana after the kanji in the dictionary form: く in 書く, べる in 食べる. */
  ending: string;
  meaning: string;
  group: VerbGroup;
  /** Why it's in the table, when it's a trap: "looks like group 2". */
  note?: string;
};

export const VERBS: Verb[] = [
  { base: "買", baseReading: "か", ending: "う", meaning: "buy", group: 1 },
  { base: "待", baseReading: "ま", ending: "つ", meaning: "wait", group: 1 },
  { base: "入", baseReading: "はい", ending: "る", meaning: "enter", group: 1, note: "ends in いる but is group 1" },
  { base: "読", baseReading: "よ", ending: "む", meaning: "read", group: 1 },
  { base: "遊", baseReading: "あそ", ending: "ぶ", meaning: "play", group: 1 },
  { base: "死", baseReading: "し", ending: "ぬ", meaning: "die", group: 1 },
  { base: "書", baseReading: "か", ending: "く", meaning: "write", group: 1 },
  { base: "泳", baseReading: "およ", ending: "ぐ", meaning: "swim", group: 1 },
  { base: "話", baseReading: "はな", ending: "す", meaning: "speak", group: 1 },
  { base: "行", baseReading: "い", ending: "く", meaning: "go", group: 1, note: "て-form {行|い}って, not {行|い}いて" },
  { base: "食", baseReading: "た", ending: "べる", meaning: "eat", group: 2 },
  { base: "見", baseReading: "み", ending: "る", meaning: "see, watch", group: 2 },
  { base: "起", baseReading: "お", ending: "きる", meaning: "get up", group: 2 },
  { base: "", baseReading: "", ending: "する", meaning: "do", group: 3 },
  { base: "来", baseReading: "く", ending: "る", meaning: "come", group: 3 },
];

/** Group 1 endings: the い-row sound (before ます) and the あ-row sound (before ない); う → わ. */
const ROWS: Record<string, [i: string, a: string]> = {
  う: ["い", "わ"],
  く: ["き", "か"],
  ぐ: ["ぎ", "が"],
  す: ["し", "さ"],
  つ: ["ち", "た"],
  ぬ: ["に", "な"],
  ぶ: ["び", "ば"],
  む: ["み", "ま"],
  る: ["り", "ら"],
};

/** Group 1 て-forms by the last sound. */
export const TE_ENDINGS: { from: string[]; te: string }[] = [
  { from: ["う", "つ", "る"], te: "って" },
  { from: ["む", "ぶ", "ぬ"], te: "んで" },
  { from: ["く"], te: "いて" },
  { from: ["ぐ"], te: "いで" },
  { from: ["す"], te: "して" },
];

/** 来る changes its reading: き before ます, て and た; こ before ない. */
const KURU_READING: Record<VerbForm, string> = { dictionary: "く", masu: "き", nai: "こ", te: "き", ta: "き" };

/** The kana ending of one form: 書く → き + ます. */
function ending(v: Verb, form: VerbForm): string {
  if (form === "dictionary") return v.ending;
  if (v.group === 3) {
    if (v.ending === "する") return { masu: "します", nai: "しない", te: "して", ta: "した" }[form];
    return { masu: "ます", nai: "ない", te: "て", ta: "た" }[form];
  }
  if (v.group === 2) {
    const stem = v.ending.slice(0, -1);
    return stem + { masu: "ます", nai: "ない", te: "て", ta: "た" }[form];
  }
  const last = v.ending.slice(-1);
  const before = v.ending.slice(0, -1);
  const row = ROWS[last];
  if (!row) throw new Error(`not a group 1 ending: ${v.ending}`);
  if (form === "masu") return before + row[0] + "ます";
  if (form === "nai") return before + row[1] + "ない";
  const te = v.base === "行" && last === "く" ? "って" : TE_ENDINGS.find((t) => t.from.includes(last))!.te;
  if (form === "te") return before + te;
  return before + te.slice(0, -1) + (te.endsWith("で") ? "だ" : "た");
}

/** One form with ruby markup: {書|か}きます. */
export function conjugate(v: Verb, form: VerbForm): string {
  if (!v.base) return ending(v, form);
  const reading = v.base === "来" ? KURU_READING[form] : v.baseReading;
  return `{${v.base}|${reading}}${ending(v, form)}`;
}

/** The ます-stem (書き), which たい, ましょう, ませんか, 方 and すぎる attach to. */
export function stem(v: Verb): string {
  return conjugate(v, "masu").replace(/ます$/, "");
}

export const GROUP_NOTES: { group: VerbGroup; title: string; body: string }[] = [
  {
    group: 1,
    title: "Group 1 (う-verbs)",
    body: "Most verbs. The dictionary form ends in an う-row sound: う く ぐ す つ ぬ ぶ む る. The last sound changes for each form.",
  },
  {
    group: 2,
    title: "Group 2 (る-verbs)",
    body: "End in いる or える, like {食|た}べる and {見|み}る. Drop る and add the ending. A few verbs that end in いる or える are group 1: {入|はい}る, {帰|かえ}る, {走|はし}る, {知|し}る, {切|き}る.",
  },
  { group: 3, title: "Group 3 (irregular)", body: "Only する and {来|く}る. Learn their forms as they are." },
];

export type FormGuide = { form: VerbForm; title: string; use: string; rules: string[] };

/** How to make each form, in the order they're usually learned. */
export const FORM_GUIDES: FormGuide[] = [
  {
    form: "masu",
    title: "ます-form (polite)",
    use: "Polite present and future. Without ます it's the stem, which たい, ましょう, ませんか, {方|かた} and すぎる join on to.",
    rules: [
      "Group 1: change the last sound to the い-row, add ます: {書|か}く → {書|か}きます.",
      "Group 2: drop る, add ます: {食|た}べる → {食|た}べます.",
      "Group 3: します, {来|き}ます.",
    ],
  },
  {
    form: "nai",
    title: "ない-form (plain negative)",
    use: "Plain 'don't'. ないでください, なくてもいい and ないといけない all start from it.",
    rules: [
      "Group 1: change the last sound to the あ-row, add ない; う becomes わ: {買|か}う → {買|か}わない.",
      "Group 2: drop る, add ない: {見|み}る → {見|み}ない.",
      "Group 3: しない, {来|こ}ない. ある is just ない.",
    ],
  },
  {
    form: "te",
    title: "て-form",
    use: "Joins actions and makes requests: てください, ている, てもいい, てから.",
    rules: [
      "Group 1: depends on the last sound, in the table below. {行|い}く is the one exception: {行|い}って.",
      "Group 2: drop る, add て: {食|た}べる → {食|た}べて.",
      "Group 3: して, {来|き}て.",
    ],
  },
  {
    form: "ta",
    title: "た-form (plain past)",
    use: "Plain past. Make the て-form, then change て to た and で to だ: {読|よ}んで → {読|よ}んだ. Used in たことがある, たり and たほうがいい.",
    rules: [
      "Group 1: {書|か}いた, {泳|およ}いだ, {話|はな}した, {待|ま}った, {読|よ}んだ.",
      "Group 2: {食|た}べた, {見|み}た.",
      "Group 3: した, {来|き}た.",
    ],
  },
];
