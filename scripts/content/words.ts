/** N5 / N4 / N3 words from open-anki-jlpt-decks, matched to JMdict for the id and part of speech. */
import { LEVELS, POS, type Pos, type Word } from "../../content/schema";
import { hasKanji, toHiragana } from "./lib/jp";
import { type JmIndex, type JmWord, kanaFor, posOf, sensesFor } from "./lib/jmdict";
import type { DeckWord } from "./lib/load";

/** Splits "to meet, to see; to date" into glosses, keeping commas inside brackets and numbers. */
export function splitMeanings(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  const chars = [...s];
  chars.forEach((c, i) => {
    if (c === "(" || c === "[") depth++;
    if (c === ")" || c === "]") depth = Math.max(0, depth - 1);
    const numberComma = c === "," && /\d/.test(chars[i - 1] ?? "") && /\d/.test(chars[i + 1] ?? "");
    if ((c === ";" || c === ",") && depth === 0 && !numberComma) {
      out.push(cur);
      cur = "";
    } else cur += c;
  });
  out.push(cur);
  return [...new Set(out.map((m) => m.trim().replace(/\s+/g, " ")).filter(Boolean))];
}

const normGloss = (s: string) =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9 ']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const stripTilde = (s: string) => s.replace(/〜/g, "");

export type MatchedWord = { word: Word; deck: DeckWord; entry?: JmWord; kanjiForm: string | null };

type Hit = { entry: JmWord; kanjiForm: string | null; kana: string };

/** The JMdict entry for a listed word: same written form and reading, best gloss overlap, common first. */
function matchEntry(deck: DeckWord, dict: JmIndex): Hit | undefined {
  const glosses = new Set(splitMeanings(deck.meaning).map(normGloss));
  const reading = toHiragana(stripTilde(deck.reading));
  // "コピーする" is the noun コピー in JMdict, with する as a part of speech.
  const tries = deck.forms.flatMap((f) => {
    const form = stripTilde(f);
    const pairs = [{ form, reading, first: f === deck.forms[0] }];
    if (form.endsWith("する") && form.length > 2 && reading.endsWith("する"))
      pairs.push({ form: form.slice(0, -2), reading: reading.slice(0, -2), first: f === deck.forms[0] });
    return pairs;
  });
  let best: (Hit & { score: number }) | undefined;
  for (const t of tries) {
    const kanjiForm = hasKanji(t.form) ? t.form : null;
    if (!kanjiForm && toHiragana(t.form) !== t.reading) continue;
    const pool = kanjiForm ? (dict.byKanji.get(t.form) ?? []) : (dict.byKana.get(toHiragana(t.form)) ?? []);
    for (const entry of pool) {
      const kana = kanaFor(entry, kanjiForm).find((k) => toHiragana(k.text) === t.reading);
      if (!kana) continue;
      const k = kanjiForm ? entry.kanji.find((x) => x.text === kanjiForm) : undefined;
      const senses = sensesFor(entry, kanjiForm, kana.text);
      const overlap = senses.some((s) => s.gloss.some((g) => glosses.has(normGloss(g.text))));
      let score = 0;
      if (overlap) score += 8;
      if (k?.common || (!kanjiForm && kana.common)) score += 4;
      if (kana.common) score += 2;
      if (kanjiForm && entry.kanji[0]?.text === kanjiForm) score += 2;
      if (!kanjiForm && (entry.kanji.length === 0 || senses[0]?.misc.includes("uk"))) score += 3;
      if (t.first) score += 1;
      if (!best || score > best.score || (score === best.score && Number(entry.id) < Number(best.entry.id)))
        best = { entry, kanjiForm, kana: kana.text, score };
    }
  }
  return best && { entry: best.entry, kanjiForm: best.kanjiForm, kana: best.kana };
}

/** Parts of speech from the senses that carry the listed meanings, else the first sense. */
function wordPos(deck: DeckWord, hit: Hit): Pos[] {
  const senses = sensesFor(hit.entry, hit.kanjiForm, hit.kana);
  const glosses = new Set(splitMeanings(deck.meaning).map(normGloss));
  const matching = senses.filter((s) => s.gloss.some((g) => glosses.has(normGloss(g.text))));
  const pos = new Set(posOf(matching.length ? matching : senses.slice(0, 1), POS));
  if (deck.suru) pos.add("verb-suru");
  if (deck.interjection) pos.add("interjection");
  return POS.filter((p) => pos.has(p));
}

/** For the few words JMdict doesn't match, a part of speech from the shape of the word. */
function guessPos(deck: DeckWord): Pos[] {
  const term = deck.forms[0];
  if (deck.interjection) return ["interjection"];
  if (deck.suru) return ["noun", "verb-suru"];
  if (term.startsWith("〜")) return ["suffix"];
  if (term.endsWith("〜")) return ["prefix"];
  if (term.endsWith("する")) return ["verb-suru"];
  return ["other"];
}

export function buildWords(decks: DeckWord[], dict: JmIndex): { matched: MatchedWord[]; unmatched: string[]; dropped: string[] } {
  const matched: MatchedWord[] = [];
  const unmatched: string[] = [];
  const dropped: string[] = [];
  const slugs = new Set<string>();
  const seenForms = new Map<string, DeckWord>();
  const order = (w: DeckWord) => LEVELS.indexOf(w.level) * 100000 + w.index;
  for (const deck of [...decks].sort((a, b) => order(a) - order(b))) {
    // A word listed at two levels stays at the lower one: N3 "在る; 有る" is N5 在る / 有る again.
    const keys = deck.forms.map((f) => `${f}|${deck.reading}`);
    const earlier = keys.map((k) => seenForms.get(k)).find((w) => w && w.level !== deck.level);
    if (earlier) {
      dropped.push(`${deck.level} ${deck.forms.join("; ")} (${deck.reading}), already ${earlier.level} ${earlier.forms.join("; ")}`);
      continue;
    }
    for (const k of keys) if (!seenForms.has(k)) seenForms.set(k, deck);
    const term = deck.forms[0];
    let slug = `word:${term}:${deck.reading}`;
    // Two listed words can share a form and reading (キロ for kilogram and for kilometre).
    if (decks.some((d) => d !== deck && d.level === deck.level && d.forms[0] === term && d.reading === deck.reading))
      slug += `:${deck.forms[1] ?? deck.index}`;
    if (slugs.has(slug)) throw new Error(`Duplicate word ${slug}`);
    slugs.add(slug);
    const hit = matchEntry(deck, dict);
    if (!hit) unmatched.push(`${deck.level} ${term} (${deck.reading})`);
    const pos = hit ? wordPos(deck, hit) : [];
    const word: Word = {
      slug,
      level: deck.level,
      term,
      reading: deck.reading,
      meanings: splitMeanings(deck.meaning),
      pos: pos.length ? pos : guessPos(deck),
      usuallyKana: !hasKanji(term),
      ...(hit ? { jmdictId: hit.entry.id } : {}),
    };
    matched.push({ word, deck, entry: hit?.entry, kanjiForm: hit?.kanjiForm ?? null });
  }
  return { matched, unmatched, dropped };
}
