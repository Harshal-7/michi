/**
 * Question builders, one per type in the plan's "Quiz and test questions". Each takes the item
 * asked about and the bank of content the wrong options come from, and returns the question as
 * it will be asked (types.ts), or null when this item can't make a fair question of that type.
 *
 * Every question has 4 different options with the answer among them, and no wrong option that
 * could also be right: meanings never share a gloss word with the answer, a word never sounds
 * the same as the one you heard, a spelling's homophones only count when their meaning differs.
 * Pure: the randomness comes in as an argument.
 */
import { blanks, parseRuby, toPlain } from "@content/schema";
import { shortMeaning } from "@/lib/srs/quick-check-rules";

import { readingVariants, romajiRow, romajiVowel, toHiragana } from "./kana-text";
import { placeAnswer, type Random, shuffle } from "./random";
import type { Asked } from "./types";

export type Sentence = { ja: string; en: string };

export type QWord = {
  id: number;
  level: string | null;
  term: string;
  reading: string;
  meaning: string;
  pos: string[];
  usuallyKana: boolean;
  example: Sentence | null;
};
export type QKanji = {
  id: number;
  level: string | null;
  char: string;
  meanings: string[];
  /** Every reading as the hiragana it starts a word with: ライ → らい, く.る → く. */
  readings: string[];
  lookalikes: string[];
};
export type QKana = {
  id: number;
  kana: string;
  romaji: string;
  accept: string[];
  script: string;
  group: string;
  lookalikes: string[];
};
export type QGrammar = {
  id: number;
  level: string | null;
  /** The lesson's title: "〜てください". */
  pattern: string;
  gloss: string;
  examples: Sentence[];
  /** The content's hand-written questions (`gq:`), each with three wrong options. */
  questions: { ja: string; en: string; wrong: string[]; explain?: string }[];
  /** The titles of the points easy to mix up with this one. */
  confusables: string[];
  /** Your own sentences marked checked. Unchecked ones never get here. */
  sentences: Sentence[];
};

export type Bank = {
  words: readonly QWord[];
  kanji: readonly QKanji[];
  kana: readonly QKana[];
  grammar: readonly QGrammar[];
};

const KANJI = /[一-鿿々〆]/;
export const hasKanji = (s: string) => KANJI.test(s);
/** "〜匹", "〜月": a counter or suffix, fine to ask the meaning of but not to read, spell or hear alone. */
const isAffix = (w: QWord) => /[〜～]/.test(w.term + w.reading);
const plainOf = (ja: string) => toPlain(ja);

/** Lower-case words of three letters or more in a gloss, to tell meanings apart. */
function glossWords(meaning: string): Set<string> {
  return new Set(
    meaning
      .toLowerCase()
      .replace(/\(.*?\)/g, " ")
      .split(/[^a-z']+/)
      .filter((w) => w.length > 2 && !["the", "and", "one", "someone", "something", "for", "with"].includes(w)),
  );
}
export function sharesGloss(a: string, b: string): boolean {
  const wa = glossWords(a);
  for (const w of glossWords(b)) if (wa.has(w)) return true;
  return false;
}

/** The first `n` distinct values from `candidates` (in order) that pass `ok`. */
function take(candidates: Iterable<string>, n: number, ok: (s: string) => boolean): string[] {
  const out: string[] = [];
  for (const c of candidates) {
    if (out.length === n) break;
    if (c && ok(c) && !out.includes(c)) out.push(c);
  }
  return out;
}

function fourOptions(answer: string, wrong: string[], random: Random): { options: string[]; answer: number } | null {
  return wrong.length === 3 ? placeAnswer(answer, wrong, random) : null;
}

const sameLevelFirst = <T extends { level: string | null }>(list: readonly T[], level: string | null, random: Random): T[] => {
  const shuffled = shuffle(list, random);
  return [...shuffled.filter((x) => x.level === level), ...shuffled.filter((x) => x.level !== level)];
};

/**
 * Marks `term` inside a sentence with `mark(term)`, dropping the furigana inside it (it would
 * give the answer away). Null when the sentence doesn't contain the term as written.
 */
export function markInSentence(ja: string, term: string, mark: (plain: string) => string): string | null {
  const segments = parseRuby(ja.replace(/\[\[|\]\]/g, ""));
  const plain = segments.map((s) => s.text).join("");
  const at = plain.indexOf(term);
  if (at < 0 || !term) return null;
  const end = at + term.length;
  let pre = "";
  let focus = "";
  let post = "";
  let offset = 0;
  for (const s of segments) {
    const from = offset;
    const to = offset + s.text.length;
    offset = to;
    const markup = s.reading ? `{${s.text}|${s.reading}}` : s.text;
    if (to <= at) pre += markup;
    else if (from >= end) post += markup;
    else {
      pre += s.text.slice(0, Math.max(0, at - from));
      focus += s.text.slice(Math.max(0, at - from), Math.min(s.text.length, end - from));
      post += s.text.slice(Math.min(s.text.length, end - from));
    }
  }
  return `${pre}${mark(focus)}${post}`;
}

// ---------------------------------------------------------------------------
// Kana

/** Kana: "Which one is shi?" among look-alikes and kana from the same row, or the romaji of a kana. */
export function kanaQuestion(item: QKana, bank: Bank, random: Random): Asked | null {
  const sameScript = bank.kana.filter((k) => k.script === item.script && k.kana !== item.kana);
  const row = romajiRow(item.romaji);
  const vowel = romajiVowel(item.romaji);
  const lookalikes = item.lookalikes.filter((l) => sameScript.some((k) => k.kana === l));
  const sameRow = shuffle(sameScript.filter((k) => romajiRow(k.romaji) === row && k.group === item.group), random);
  const sameVowel = shuffle(sameScript.filter((k) => romajiVowel(k.romaji) === vowel && k.group === item.group), random);
  const rest = shuffle(sameScript.filter((k) => k.group === item.group), random);
  const ordered = [...shuffle(lookalikes, random).map((l) => sameScript.find((k) => k.kana === l)!), ...sameRow, ...sameVowel, ...rest];
  const accepted = new Set([item.romaji, ...item.accept].map((r) => r.toLowerCase()));

  if (lookalikes.length > 0) {
    const wrong = take(
      ordered.filter((k) => !accepted.has(k.romaji.toLowerCase())).map((k) => k.kana),
      3,
      (k) => k !== item.kana,
    );
    const placed = fourOptions(item.kana, wrong, random);
    if (!placed) return null;
    return {
      v: 1,
      type: "kana",
      instruction: `Which one is “${item.romaji}”?`,
      en: item.romaji,
      big: true,
      ...placed,
      optionsLang: "ja",
      explain: `${item.kana} is ${item.romaji}.${lookalikes.length ? ` Don't mix it up with ${lookalikes.join(" ")}.` : ""}`,
    };
  }
  const wrong = take(
    ordered.map((k) => k.romaji),
    3,
    (r) => !accepted.has(r.toLowerCase()),
  );
  const placed = fourOptions(item.romaji, wrong, random);
  if (!placed) return null;
  return {
    v: 1,
    type: "kana",
    instruction: "How do you read this?",
    ja: item.kana,
    big: true,
    ...placed,
    optionsLang: "en",
    explain: `${item.kana} is ${item.romaji}.`,
  };
}

// ---------------------------------------------------------------------------
// Words and kanji

/** Readings of the word with its first kanji read another way: 来週 → こしゅう, きしゅう. */
function otherKanjiReadings(word: QWord, bank: Bank): string[] {
  const first = [...word.term][0];
  const kanji = bank.kanji.find((k) => k.char === first);
  if (!kanji) return [];
  const stems = [...new Set(kanji.readings)].filter(Boolean).sort((a, b) => b.length - a.length);
  const used = stems.find((s) => word.reading.startsWith(s));
  if (!used) return [];
  const rest = word.reading.slice(used.length);
  return stems.filter((s) => s !== used).map((s) => s + rest);
}

/** Kanji reading: the word underlined in its example; wrong options are small changes to the reading. */
export function kanjiReadingQuestion(word: QWord, bank: Bank, random: Random): Asked | null {
  if (!hasKanji(word.term) || word.usuallyKana || isAffix(word)) return null;
  const reading = toHiragana(word.reading);
  const others = shuffle(otherKanjiReadings(word, bank), random).slice(0, 1);
  const variants = shuffle(readingVariants(reading), random);
  const sameSound = new Set(bank.words.filter((w) => w.term === word.term).map((w) => toHiragana(w.reading)));
  const wrong = take([...others, ...variants], 3, (r) => r !== reading && !sameSound.has(r) && r.length >= 2);
  const placed = fourOptions(reading, wrong, random);
  if (!placed) return null;
  const inSentence = word.example ? markInSentence(word.example.ja, word.term, (f) => `⟨${f}⟩`) : null;
  return {
    v: 1,
    type: "kanji_reading",
    instruction: "How do you read the underlined word?",
    ja: inSentence ?? `⟨${word.term}⟩`,
    big: inSentence === null,
    ...placed,
    optionsLang: "ja",
    explain: `${word.term} is read ${reading}: “${shortMeaning(word.meaning)}”.`,
    full: inSentence && word.example ? word.example : undefined,
  };
}

/** Spelling: the reading and meaning; wrong options are look-alike kanji and words that sound the same. */
export function spellingQuestion(word: QWord, bank: Bank, random: Random): Asked | null {
  if (!hasKanji(word.term) || word.usuallyKana || isAffix(word)) return null;
  const chars = [...word.term];
  const swaps: string[] = [];
  chars.forEach((c, i) => {
    const kanji = bank.kanji.find((k) => k.char === c);
    for (const l of kanji?.lookalikes ?? []) swaps.push([...chars.slice(0, i), l, ...chars.slice(i + 1)].join(""));
  });
  const reading = toHiragana(word.reading);
  const homophones = bank.words.filter((w) => toHiragana(w.reading) === reading && w.term !== word.term && hasKanji(w.term) && !sharesGloss(w.meaning, word.meaning));
  const sharing = bank.words.filter((w) => w.term !== word.term && hasKanji(w.term) && chars.some((c) => KANJI.test(c) && w.term.includes(c)) && toHiragana(w.reading) !== reading);
  const wrong = take(
    [...shuffle(swaps, random), ...shuffle(homophones, random).map((w) => w.term), ...sameLevelFirst(sharing, word.level, random).map((w) => w.term)],
    3,
    (t) => t !== word.term,
  );
  const placed = fourOptions(word.term, wrong, random);
  if (!placed) return null;
  return {
    v: 1,
    type: "spelling",
    instruction: "Which is the right way to write it?",
    ja: reading,
    big: true,
    en: shortMeaning(word.meaning),
    ...placed,
    optionsLang: "ja",
    explain: `${reading} (“${shortMeaning(word.meaning)}”) is written ${word.term}.`,
  };
}

type Meaningful = { id: number; level: string | null; term: string; meaning: string; pos: string[] };

const kanjiAsMeaningful = (k: QKanji): Meaningful => ({ id: k.id, level: k.level, term: k.char, meaning: k.meanings.slice(0, 2).join(", "), pos: ["kanji"] });
const wordAsMeaningful = (w: QWord): Meaningful => ({ id: w.id, level: w.level, term: w.term, meaning: shortMeaning(w.meaning), pos: w.pos });

/** Others of the same kind for meaning questions: same part of speech and level first, never sharing a gloss word. */
function meaningDistractors(item: Meaningful, others: Meaningful[], random: Random): Meaningful[] {
  const fair = others.filter((o) => o.id !== item.id && o.term !== item.term && o.meaning && !sharesGloss(o.meaning, item.meaning));
  const samePos = fair.filter((o) => o.pos.some((p) => item.pos.includes(p)));
  const ordered = [...sameLevelFirst(samePos, item.level, random), ...sameLevelFirst(fair, item.level, random)];
  const out: Meaningful[] = [];
  for (const o of ordered) {
    if (out.length === 3) break;
    if (out.some((x) => x.term === o.term || x.meaning === o.meaning || sharesGloss(x.meaning, o.meaning))) continue;
    out.push(o);
  }
  return out;
}

function asMeaningful(item: QWord | QKanji, bank: Bank): { me: Meaningful; others: Meaningful[]; noun: string } {
  return "char" in item
    ? { me: kanjiAsMeaningful(item), others: bank.kanji.map(kanjiAsMeaningful), noun: "kanji" }
    : { me: wordAsMeaningful(item), others: bank.words.map(wordAsMeaningful), noun: "word" };
}

/** Meaning: a word or kanji, and four meanings to pick from. */
export function meaningQuestion(item: QWord | QKanji, bank: Bank, random: Random): Asked | null {
  const { me, others } = asMeaningful(item, bank);
  if (!me.meaning) return null;
  const wrong = meaningDistractors(me, others, random).map((o) => o.meaning);
  const placed = fourOptions(me.meaning, wrong, random);
  if (!placed) return null;
  const reading = "char" in item ? null : toHiragana(item.reading);
  return {
    v: 1,
    type: "meaning",
    instruction: "What does it mean?",
    ja: me.term,
    big: true,
    ...placed,
    optionsLang: "en",
    explain: `${me.term}${reading && reading !== me.term ? ` (${reading})` : ""}: “${me.meaning}”.`,
  };
}

/** Meaning the other way: a meaning, and four words or kanji to pick from. */
export function meaningReverseQuestion(item: QWord | QKanji, bank: Bank, random: Random): Asked | null {
  const { me, others, noun } = asMeaningful(item, bank);
  if (!me.meaning) return null;
  const wrong = meaningDistractors(me, others, random).map((o) => o.term);
  const placed = fourOptions(me.term, wrong, random);
  if (!placed) return null;
  return {
    v: 1,
    type: "meaning_reverse",
    instruction: `Which ${noun} means this?`,
    en: me.meaning,
    big: true,
    ...placed,
    optionsLang: "ja",
    explain: `“${me.meaning}” is ${me.term}.`,
  };
}

/** Word in context: the word's example with a gap; wrong options share its part of speech but not its meaning. */
export function wordInContextQuestion(word: QWord, bank: Bank, random: Random): Asked | null {
  if (!word.example || isAffix(word)) return null;
  const ja = markInSentence(word.example.ja, word.term, (f) => `[[${f}]]`);
  if (!ja) return null;
  const me = wordAsMeaningful(word);
  const plain = plainOf(word.example.ja);
  const others = bank.words.map(wordAsMeaningful).filter((o) => !plain.includes(o.term));
  const wrong = meaningDistractors(me, others, random).map((o) => o.term);
  const placed = fourOptions(word.term, wrong, random);
  if (!placed) return null;
  return {
    v: 1,
    type: "word_in_context",
    instruction: "Which word fits the gap?",
    ja,
    ...placed,
    optionsLang: "ja",
    explain: `${word.term} (${toHiragana(word.reading)}): “${me.meaning}”.`,
    full: word.example,
  };
}

/** Listening: the voice says a word; pick how it's written. Nothing that sounds the same is offered. */
export function listeningQuestion(word: QWord, bank: Bank, random: Random): Asked | null {
  const reading = toHiragana(word.reading);
  if (reading.length < 2 || isAffix(word)) return null;
  const first = reading[0];
  const sounds = (w: QWord) => toHiragana(w.reading);
  const fair = bank.words.filter((w) => w.term !== word.term && sounds(w) !== reading && w.reading.length >= 2 && !isAffix(w));
  const close = fair.filter((w) => sounds(w)[0] === first && Math.abs(sounds(w).length - reading.length) <= 1);
  const sharing = fair.filter((w) => [...word.term].some((c) => KANJI.test(c) && w.term.includes(c)));
  const wrong = take(
    [...sameLevelFirst(close, word.level, random), ...sameLevelFirst(sharing, word.level, random), ...sameLevelFirst(fair, word.level, random)].map((w) => w.term),
    3,
    (t) => t !== word.term,
  );
  const placed = fourOptions(word.term, wrong, random);
  if (!placed) return null;
  return {
    v: 1,
    type: "listening",
    instruction: "Listen. Which word did you hear?",
    say: reading,
    ...placed,
    optionsLang: "ja",
    explain: `You heard ${reading}: ${word.term}, “${shortMeaning(word.meaning)}”.`,
  };
}

// ---------------------------------------------------------------------------
// Grammar

const cleanPattern = (p: string) => toPlain(p).replace(/[〜～~]/g, "").replace(/[（(].*?[)）]/g, "").split(/\s*[/／]\s*/)[0].trim();

/**
 * Grammar fill-in: the point's hand-written questions, its examples and your checked sentences,
 * with the blank's wrong options from its questions, its confusable patterns, then the level.
 */
export function grammarFillQuestion(point: QGrammar, bank: Bank, random: Random): Asked | null {
  type Source = { ja: string; en: string; wrong?: string[]; explain?: string };
  const sources: Source[] = [
    ...point.questions.flatMap((q) => [q, q]),
    ...point.sentences,
    ...point.examples,
  ].filter((s) => blanks(s.ja).length === 1);
  if (sources.length === 0) return null;
  const pick = sources[Math.floor(random() * sources.length)];
  const answer = blanks(pick.ja)[0];
  const answerPlain = plainOf(answer);
  const sameLevel = sameLevelFirst(bank.grammar, point.level, random).filter((g) => g.id !== point.id);
  const otherAnswers = sameLevel.flatMap((g) => g.examples.map((e) => blanks(e.ja)[0] ?? ""));
  const candidates = [
    ...(pick.wrong ?? []),
    ...shuffle(point.questions.flatMap((q) => q.wrong), random),
    ...shuffle(point.confusables.map(cleanPattern), random),
    ...shuffle(otherAnswers, random),
  ];
  const seen = new Set([answerPlain]);
  const wrong = take(candidates, 3, (c) => {
    const p = plainOf(c);
    if (!p || seen.has(p)) return false;
    seen.add(p);
    return true;
  });
  const placed = fourOptions(answer, wrong, random);
  if (!placed) return null;
  return {
    v: 1,
    type: "grammar_fill",
    instruction: "Which fits the gap?",
    ja: pick.ja,
    en: pick.en || undefined,
    ...placed,
    optionsLang: "ja",
    explain: pick.explain ?? `${point.pattern}: ${point.gloss}.`,
  };
}

// ---------------------------------------------------------------------------
// Sentence order

type Token = { markup: string; plain: string; kind: "kanji" | "kata" | "hira" | "punct" };

function tokens(ja: string): Token[] {
  const out: Token[] = [];
  for (const s of parseRuby(ja.replace(/\[\[|\]\]/g, ""))) {
    if (s.reading) {
      out.push({ markup: `{${s.text}|${s.reading}}`, plain: s.text, kind: "kanji" });
      continue;
    }
    for (const run of s.text.match(/[一-鿿々〆]+|[ァ-ヿー]+|[ぁ-ゟ]+|[^一-鿿々〆ァ-ヿぁ-ゟ]+/g) ?? []) {
      const kind = KANJI.test(run) ? "kanji" : /^[ァ-ヿー]/.test(run) ? "kata" : /^[ぁ-ゟ]/.test(run) ? "hira" : "punct";
      out.push({ markup: run, plain: run, kind });
    }
  }
  return out;
}

/**
 * Splits a sentence into word-sized chunks: a chunk starts at a kanji or katakana word, and the
 * kana after it (okurigana, particles) stay with it. A comma ends a chunk; the final 。 is kept
 * apart. Returns the chunks (ruby markup) and the closing punctuation.
 */
export function chunkSentence(ja: string): { chunks: string[]; end: string } {
  const list = tokens(ja.trim());
  let end = "";
  while (list.length && list[list.length - 1].kind === "punct") end = list.pop()!.markup + end;
  const chunks: string[] = [];
  let current = "";
  let prev: Token["kind"] | null = null;
  for (const t of list) {
    const startsWord = (t.kind === "kanji" || t.kind === "kata") && prev !== t.kind;
    if (current && (startsWord || prev === "punct")) {
      // The polite お / ご belongs to the word after it: お{兄|にい}さん, ご{飯|はん}.
      const polite = t.kind === "kanji" && prev === "hira" && /[おご]$/.test(current) && current.length > 1 ? current.slice(-1) : "";
      chunks.push(polite ? current.slice(0, -1) : current);
      current = polite;
    }
    current += t.markup;
    prev = t.kind;
  }
  if (current) chunks.push(current);
  return { chunks, end };
}

/**
 * Where the ★ goes among the four chunks. Japanese word order is loose (time, place and object can
 * swap), so the star goes where the order is fixed when it can: on a chunk ending in の, which
 * must come straight before the noun it describes, or on a bare adjective before its noun. Else
 * the third slot, just before the predicate.
 */
export function starSlot(four: readonly string[]): number {
  for (let i = 0; i < 3; i++) {
    const p = plainOf(four[i]);
    if (/の$/.test(p) || (/[いな]$/.test(p) && !/(ない|たい|ましい)$/.test(p) && KANJI.test(p))) return i;
  }
  return 2;
}

/**
 * Sentence order (★, as in the JLPT): the end of a sentence split into four chunks, and which
 * chunk goes in the starred slot (starSlot). The last chunk is the predicate, which stays last.
 */
export function sentenceOrderQuestion(sentence: Sentence, random: Random): Asked | null {
  // One plain sentence only: no quotes, nothing after a full stop but the last.
  if (/[「」『』]|[。？！?!].+$/.test(plainOf(sentence.ja).trim())) return null;
  const { chunks, end } = chunkSentence(sentence.ja);
  if (chunks.length < 4) return null;
  const four = chunks.slice(-4);
  if (new Set(four.map(plainOf)).size < 4) return null;
  const star = starSlot(four);
  const answer = four[star];
  const placed = placeAnswer(answer, four.filter((_, i) => i !== star), random);
  return {
    v: 1,
    type: "sentence_order",
    instruction: "Put the pieces in order. Which one goes in the ★ slot?",
    order: { before: chunks.slice(0, -4).join(""), after: end, star },
    en: sentence.en || undefined,
    ...placed,
    optionsLang: "ja",
    explain: undefined,
    full: { ja: sentence.ja.replace(/\[\[|\]\]/g, ""), en: sentence.en },
  };
}

/** What a listening question becomes on a device with no Japanese voice (decision 3). */
export function listeningFallback(word: QWord, bank: Bank, random: Random): Asked | null {
  return meaningQuestion(word, bank, random);
}
