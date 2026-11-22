/** Hiragana (104) and katakana (124), generated: Hepburn romaji, other typings, look-alikes, an N5 word. */
import type { Kana } from "../../content/schema";
import { toKatakana } from "./lib/jp";

type Row = { kana: string; romaji: string; slug?: string; accept?: string[] };
type RowTuple = [kana: string, romaji: string, accept?: string[], slug?: string];
const rows = (list: RowTuple[]): Row[] => list.map(([kana, romaji, accept, slug]) => ({ kana, romaji, accept, slug }));

const BASIC = rows([
  ["あ", "a"], ["い", "i"], ["う", "u"], ["え", "e"], ["お", "o"],
  ["か", "ka"], ["き", "ki"], ["く", "ku"], ["け", "ke"], ["こ", "ko"],
  ["さ", "sa"], ["し", "shi", ["si"]], ["す", "su"], ["せ", "se"], ["そ", "so"],
  ["た", "ta"], ["ち", "chi", ["ti"]], ["つ", "tsu", ["tu"]], ["て", "te"], ["と", "to"],
  ["な", "na"], ["に", "ni"], ["ぬ", "nu"], ["ね", "ne"], ["の", "no"],
  ["は", "ha"], ["ひ", "hi"], ["ふ", "fu", ["hu"]], ["へ", "he"], ["ほ", "ho"],
  ["ま", "ma"], ["み", "mi"], ["む", "mu"], ["め", "me"], ["も", "mo"],
  ["や", "ya"], ["ゆ", "yu"], ["よ", "yo"],
  ["ら", "ra"], ["り", "ri"], ["る", "ru"], ["れ", "re"], ["ろ", "ro"],
  // を is said "o"; it shows as "wo" so it stays distinct from お, and "o" is accepted.
  ["わ", "wa"], ["を", "wo", ["o"]],
  ["ん", "n", ["nn", "n'"]],
]);

const DAKUTEN = rows([
  ["が", "ga"], ["ぎ", "gi"], ["ぐ", "gu"], ["げ", "ge"], ["ご", "go"],
  ["ざ", "za"], ["じ", "ji", ["zi"]], ["ず", "zu"], ["ぜ", "ze"], ["ぞ", "zo"],
  // ぢ and づ sound like じ and ず; their slugs use the old spellings so every slug is unique.
  ["だ", "da"], ["ぢ", "ji", ["di"], "dji"], ["づ", "zu", ["du"], "dzu"], ["で", "de"], ["ど", "do"],
  ["ば", "ba"], ["び", "bi"], ["ぶ", "bu"], ["べ", "be"], ["ぼ", "bo"],
  ["ぱ", "pa"], ["ぴ", "pi"], ["ぷ", "pu"], ["ぺ", "pe"], ["ぽ", "po"],
]);

const COMBO_BASES: [string, string, string[]?][] = [
  ["き", "ky"], ["し", "sh", ["sy"]], ["ち", "ch", ["ty", "cy"]], ["に", "ny"], ["ひ", "hy"], ["み", "my"],
  ["り", "ry"], ["ぎ", "gy"], ["じ", "j", ["zy", "jy"]], ["び", "by"], ["ぴ", "py"],
];
const COMBO: Row[] = COMBO_BASES.flatMap(([base, cons, alt = []]) =>
  (["ゃ", "ゅ", "ょ"] as const).map((small, i) => {
    const vowel = "auo"[i];
    return { kana: base + small, romaji: cons + vowel, accept: alt.map((a) => a + vowel) };
  }),
);

/** Sounds only katakana spells, for loanwords. Romaji as usually written; IME typings accepted. */
const EXTENDED: Row[] = [
  { kana: "ファ", romaji: "fa" }, { kana: "フィ", romaji: "fi" }, { kana: "フェ", romaji: "fe" }, { kana: "フォ", romaji: "fo" },
  { kana: "ティ", romaji: "ti", accept: ["thi"] }, { kana: "ディ", romaji: "di", accept: ["dhi"] }, { kana: "デュ", romaji: "dyu", accept: ["dhu"] },
  { kana: "トゥ", romaji: "tu", accept: ["twu"] }, { kana: "ドゥ", romaji: "du", accept: ["dwu"] },
  { kana: "ウィ", romaji: "wi", accept: ["whi"] }, { kana: "ウェ", romaji: "we", accept: ["whe"] }, { kana: "ウォ", romaji: "wo", slug: "who", accept: ["who"] },
  { kana: "ヴァ", romaji: "va" }, { kana: "ヴィ", romaji: "vi" }, { kana: "ヴ", romaji: "vu" }, { kana: "ヴェ", romaji: "ve" }, { kana: "ヴォ", romaji: "vo" },
  { kana: "シェ", romaji: "she", accept: ["sye"] }, { kana: "ジェ", romaji: "je", accept: ["zye", "jye"] }, { kana: "チェ", romaji: "che", accept: ["tye", "cye"] },
];

/** Shapes learners mix up. Pairs listed once; each side gets the other. */
const LOOKALIKES: string[][] = [
  ["あ", "お"], ["い", "り"], ["う", "ら"], ["き", "さ"], ["さ", "ち"], ["ぬ", "め"], ["ね", "れ", "わ"],
  ["は", "ほ"], ["る", "ろ"], ["け", "は"], ["ま", "も"], ["こ", "い"],
  ["シ", "ツ"], ["ソ", "ン"], ["シ", "ン"], ["ツ", "ソ"], ["ク", "ケ", "タ"], ["コ", "ユ"], ["チ", "テ"],
  ["ナ", "メ"], ["ヌ", "ス"], ["ア", "マ"], ["ウ", "ワ", "フ"], ["ノ", "メ"], ["ル", "レ"], ["ク", "ワ"],
];

const DAKU: Record<string, string> = Object.fromEntries(
  [..."かきくけこさしすせそたちつてとはひふへほ"].flatMap((c) => {
    const d = String.fromCharCode(c.charCodeAt(0) + 1);
    return [[c, d], [toKatakana(c), toKatakana(d)]];
  }),
);
const HANDAKU: Record<string, string> = Object.fromEntries(
  [..."はひふへほ"].flatMap((c) => {
    const p = String.fromCharCode(c.charCodeAt(0) + 2);
    return [[c, p], [toKatakana(c), toKatakana(p)]];
  }),
);

function lookalikeMap(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (a === b) return;
    if (!map.has(a)) map.set(a, new Set());
    map.get(a)!.add(b);
  };
  for (const group of LOOKALIKES) for (const a of group) for (const b of group) link(a, b);
  // Dakuten forms inherit their base's look-alikes (ジ/ヅ, ザ/ヂ…), and ば/ぱ pair up.
  for (const [base, voiced] of Object.entries(DAKU)) {
    for (const other of map.get(base) ?? []) if (DAKU[other]) link(voiced, DAKU[other]);
    if (HANDAKU[base]) {
      link(voiced, HANDAKU[base]);
      link(HANDAKU[base], voiced);
    }
  }
  return map;
}

export type ExampleWord = { term: string; reading: string; meaning: string };

/** A word from the N5 list with the kana: at the start of its spelling or reading, else inside. */
function exampleFor(kana: string, script: "hiragana" | "katakana", words: ExampleWord[]): ExampleWord | undefined {
  const inScript = (w: ExampleWord) => (script === "katakana" ? /^[\p{Script=Katakana}ー]+$/u.test(w.term) : true);
  const pool = words.filter(inScript);
  return (
    pool.find((w) => w.term.startsWith(kana)) ??
    pool.find((w) => w.reading.startsWith(kana)) ??
    pool.find((w) => w.term.slice(1).includes(kana)) ??
    pool.find((w) => w.reading.slice(1).includes(kana))
  );
}

export function buildKana(n5Words: ExampleWord[]): Kana[] {
  const looks = lookalikeMap();
  const out: Kana[] = [];
  const add = (script: "hiragana" | "katakana", group: Kana["group"], rows: Row[]) => {
    for (const row of rows) {
      const kana = script === "katakana" && group !== "extended" ? toKatakana(row.kana) : row.kana;
      const example = exampleFor(kana, script, n5Words);
      out.push({
        slug: `kana:${script}:${row.slug ?? row.romaji}`,
        script,
        group,
        kana,
        romaji: row.romaji,
        accept: row.accept ?? [],
        lookalikes: [...(looks.get(kana) ?? [])],
        ...(example ? { example } : {}),
      });
    }
  };
  for (const script of ["hiragana", "katakana"] as const) {
    add(script, "basic", BASIC);
    add(script, "dakuten", DAKUTEN);
    add(script, "combo", COMBO);
  }
  add("katakana", "extended", EXTENDED);
  return out;
}
