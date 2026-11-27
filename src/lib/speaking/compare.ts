/**
 * Comparing what speech recognition heard with a prompt's model answer, kindly (decision 19):
 * punctuation and spaces don't count, katakana and hiragana are the same, and a word with
 * furigana counts as said whether it was heard in kanji or in kana. Numbers count in digits or
 * kanji (7時 and 七時). It only shows which parts of the model weren't heard; it never grades.
 */
import { parseRuby } from "@content/schema";

/** A run of the model answer (with its ruby markup), and whether it was heard. */
export type HeardSegment = { text: string; said: boolean };
export type Comparison = {
  segments: HeardSegment[];
  /** How much of the model's reading was heard, 0 to 1. */
  said: number;
};

const KANJI_DIGITS = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** 0–9999 as kanji numerals the way they're read: 23 → 二十三, 300 → 三百. */
function kanjiNumber(n: number): string {
  if (n === 0) return "〇";
  let out = "";
  for (const [unit, size] of [
    ["千", 1000],
    ["百", 100],
    ["十", 10],
  ] as const) {
    const d = Math.floor(n / size);
    if (d) out += (d === 1 ? "" : KANJI_DIGITS[d]) + unit;
    n %= size;
  }
  return n ? out + KANJI_DIGITS[n] : out;
}

const isMark = (c: string) => !/[\p{L}\p{N}ー]/u.test(c);

/**
 * Text as it's compared: full-width forms folded, katakana as hiragana, lower case, numbers as
 * kanji, and no punctuation or spaces.
 */
export function normalise(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\d{1,4}/g, (d) => kanjiNumber(Number(d)))
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .split("")
    .filter((c) => !isMark(c))
    .join("");
}

type Unit = {
  /** The model's markup for this piece: "{食|た}" or one plain character. */
  markup: string;
  /** Ways it may have been heard, normalised. Empty for punctuation. */
  forms: string[];
  /** How much it counts towards `said`. */
  weight: number;
};

function units(model: string): Unit[] {
  const out: Unit[] = [];
  for (const seg of parseRuby(model.replace(/\[\[|\]\]/g, ""))) {
    if (seg.reading !== undefined) {
      const forms = [...new Set([normalise(seg.text), normalise(seg.reading)])].filter(Boolean);
      out.push({ markup: `{${seg.text}|${seg.reading}}`, forms, weight: normalise(seg.reading).length || 1 });
      continue;
    }
    // Digits stay together, so "10" is one piece that 十 can match.
    for (const piece of seg.text.match(/\d+|[\s\S]/gu) ?? []) {
      const form = normalise(piece);
      out.push({ markup: piece, forms: form ? [form] : [], weight: form ? form.length : 0 });
    }
  }
  return out;
}

/**
 * Lines the model up with what was heard (a longest-common-subsequence over model pieces, each of
 * which can match in any of its forms) and marks the pieces that weren't heard. Punctuation takes
 * the mark of the piece before it.
 */
export function compareSpoken(model: string, heard: string): Comparison {
  const us = units(model);
  const h = normalise(heard);
  const n = us.length;
  const m = h.length;
  // best[i][j]: the most weight that model pieces i… can match in heard text j….
  const best = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m; j >= 0; j--) {
      let b = Math.max(best[i + 1][j], j < m ? best[i][j + 1] : 0);
      for (const f of us[i].forms) if (h.startsWith(f, j)) b = Math.max(b, us[i].weight + best[i + 1][j + f.length]);
      best[i][j] = b;
    }
  }
  const said: boolean[] = new Array<boolean>(n).fill(false);
  let i = 0;
  let j = 0;
  while (i < n) {
    const form = us[i].forms.find((f) => h.startsWith(f, j) && best[i][j] === us[i].weight + best[i + 1][j + f.length]);
    if (form !== undefined && us[i].weight > 0) {
      said[i] = true;
      j += form.length;
      i++;
    } else if (best[i][j] === best[i + 1][j]) i++;
    else j++;
  }

  // Punctuation follows the piece before it (or after it, at the start).
  for (let k = 0; k < n; k++) {
    if (us[k].forms.length) continue;
    const prev = us.slice(0, k).findLastIndex((u) => u.forms.length > 0);
    const next = us.findIndex((u, x) => x > k && u.forms.length > 0);
    said[k] = prev >= 0 ? said[prev] : next >= 0 ? said[next] : true;
  }

  const segments: HeardSegment[] = [];
  for (let k = 0; k < n; k++) {
    const last = segments.at(-1);
    if (last && last.said === said[k]) last.text += us[k].markup;
    else segments.push({ text: us[k].markup, said: said[k] });
  }
  const total = us.reduce((s, u) => s + u.weight, 0);
  const heardWeight = us.reduce((s, u, k) => s + (said[k] ? u.weight : 0), 0);
  return { segments, said: total ? heardWeight / total : 0 };
}
