/**
 * Kana tools for wrong options: the small changes the plan lists for a kanji reading (dakuten,
 * long vowel, small っ, yōon) and katakana to hiragana.
 */

/** Katakana to hiragana; everything else unchanged. */
export function toHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** A kanji reading from the content ("く.る", "-じ") as the kana it starts a word with: "く", "じ". */
export function readingStem(reading: string): string {
  return toHiragana(reading.replace(/^[-.]+|[-.]+$/g, "").split(".")[0] ?? "");
}

const DAKUTEN: Record<string, string> = {};
const PAIRS = [
  "かが", "きぎ", "くぐ", "けげ", "こご", "さざ", "しじ", "すず", "せぜ", "そぞ",
  "ただ", "ちぢ", "つづ", "てで", "とど", "はば", "ひび", "ふぶ", "へべ", "ほぼ",
];
for (const [plain, voiced] of PAIRS.map((p) => [...p])) {
  DAKUTEN[plain] = voiced;
  DAKUTEN[voiced] = plain;
}
/** は-row also has handakuten: ぱぴぷぺぽ. */
const HANDAKUTEN: Record<string, string> = { は: "ぱ", ひ: "ぴ", ふ: "ぷ", へ: "ぺ", ほ: "ぽ", ぱ: "は", ぴ: "ひ", ぷ: "ふ", ぺ: "へ", ぽ: "ほ" };

const O_ROW = new Set([..."おこごそぞとどのほぼぽもよろょ"]);
const U_ROW = new Set([..."うくぐすずつづぬふぶぷむゆるゅ"]);
const E_ROW = new Set([..."えけげせぜてでねへべぺめれ"]);
/** Kana a small っ can come before. */
const GEMINATES = new Set([..."かきくけこさしすせそたちつてとぱぴぷぺぽ"]);
const YOON_BASE = new Set([..."きぎしじちにひびぴみり"]);
const SMALL_Y = { ゃ: "や", ゅ: "ゆ", ょ: "よ" } as const;

/**
 * Readings one small change away from `reading` (hiragana): dakuten on or off, a long vowel
 * added or dropped, a small っ added or dropped, a small ゃゅょ added or dropped. Never the
 * reading itself; may include words that don't exist, which is the point.
 */
export function readingVariants(reading: string): string[] {
  const chars = [...reading];
  const out = new Set<string>();
  const put = (next: string[]) => {
    const s = next.join("");
    if (s && s !== reading) out.add(s);
  };
  chars.forEach((c, i) => {
    const swap = (to: string) => put([...chars.slice(0, i), to, ...chars.slice(i + 1)]);
    if (DAKUTEN[c]) swap(DAKUTEN[c]);
    if (HANDAKUTEN[c]) swap(HANDAKUTEN[c]);
    const next = chars[i + 1];
    // Long vowels: おう / うう / えい. Drop one that's there, or add one after a kana that can take it.
    if ((c === "う" && i > 0 && (O_ROW.has(chars[i - 1]) || U_ROW.has(chars[i - 1]))) || (c === "い" && i > 0 && E_ROW.has(chars[i - 1]))) {
      put([...chars.slice(0, i), ...chars.slice(i + 1)]);
    } else if (next !== "う" && next !== "い" && next !== "ー") {
      if (O_ROW.has(c) || U_ROW.has(c)) put([...chars.slice(0, i + 1), "う", ...chars.slice(i + 1)]);
    }
    // Small っ.
    if (c === "っ") put([...chars.slice(0, i), ...chars.slice(i + 1)]);
    else if (i > 0 && GEMINATES.has(c) && chars[i - 1] !== "っ" && chars[i - 1] !== "ん") put([...chars.slice(0, i), "っ", ...chars.slice(i)]);
    // Yōon: しゅ ↔ し, and し → しゅ / しょ.
    if (c in SMALL_Y) put([...chars.slice(0, i), ...chars.slice(i + 1)]);
    else if (YOON_BASE.has(c) && !(next && next in SMALL_Y)) {
      put([...chars.slice(0, i + 1), "ゅ", ...chars.slice(i + 1)]);
      put([...chars.slice(0, i + 1), "ょ", ...chars.slice(i + 1)]);
    }
  });
  return [...out];
}

/** The consonant row of a kana's romaji, for "kana from the same row": shi → s, chi → t, fu → h, ji → z. */
export function romajiRow(romaji: string): string {
  const r = romaji.toLowerCase();
  if (r === "n") return "n";
  if (/^[aiueo]/.test(r)) return "vowel";
  if (r.startsWith("sh")) return "s";
  if (r.startsWith("ch") || r.startsWith("ts")) return "t";
  if (r.startsWith("f")) return "h";
  if (r.startsWith("j")) return "z";
  return r[0];
}

/** The vowel a kana's romaji ends in. */
export function romajiVowel(romaji: string): string {
  return /[aiueo]$/.exec(romaji.toLowerCase())?.[0] ?? "";
}
