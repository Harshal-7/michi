/**
 * One example sentence per word. Fresh sentences written for Michi win; otherwise the best checked
 * Tatoeba sentence that uses the word: marked as a good example, short, mostly words at the word's
 * level or below, and not already used for another word. Furigana comes from the sentence's B-line.
 */
import { type Example, LEVELS, type Level } from "../../content/schema";
import { hasKanji, toHiragana } from "./lib/jp";
import { type JmIndex, type JmWord, kanaFor } from "./lib/jmdict";
import type { KanjiReadings } from "./lib/ruby";
import { type BToken, headReading, type IndexedSentence, loadIndices, loadSentences, type Sentence, sentenceRuby } from "./lib/tatoeba";
import type { MatchedWord } from "./words";

/** Topics a study app shouldn't surprise anyone with. Checked on both sides of the pair. */
const BLOCK_EN =
  /\b(sex\w*|naked|nude|porn\w*|rape\w*|kill\w*|murder\w*|suicide|guns?|shoot\w*|bomb\w*|terror\w*|drugs?|cocaine|heroin|marijuana|hell|damn\w*|fuck\w*|shit\w*|bitch\w*|bastard|ass(hole)?|dick|penis|vagina|breasts?|condoms?|prostitut\w*|whore|slut|nigg\w*|fag\w*|hitler|nazi\w*|blood\w*|corpse|torture\w*|abort\w*|weapon\w*)\b/i;
const BLOCK_JA = /殺|死ね|自殺|中出|セックス|エッチ|裸|麻薬|覚醒剤|強姦|レイプ|売春|爆弾|銃|糞|ちんこ|まんこ|おっぱい|やくざ|ヤクザ|死体|拷問|血|乳首|性的|処女|童貞|ばか|馬鹿|バカ|アホ/;

/** Shouting, stutters and stretched vowels: fine in a novel, not as a study example. */
const NOISY = /[ぁぃぅぇぉっー]{2,}|[！!？?]{2,}|〜|…|^(.)、\1|[（(]/;

const MAX_JA = 30;
const MAX_EN = 110;

const STOP = new Set(["the", "and", "for", "with", "one", "someone", "something", "thing", "things", "very", "used", "etc", "abbr", "form", "polite", "honorific", "humble", "counter"]);

type Candidate = { s: IndexedSentence; ja: Sentence; en: Sentence; good: boolean };

const levelRank = (l: Level) => LEVELS.indexOf(l);

/** True when a B-line token is this word: same entry, or same headword read the same way. */
function tokenIsWord(tok: BToken, head: string, reading: string, entry: JmWord | undefined, dict: JmIndex): boolean {
  if (tok.reading?.startsWith("#")) return tok.reading.slice(1) === entry?.id;
  if (!hasKanji(head)) return toHiragana(head) === reading;
  if (headReading(tok, head, "", dict) === reading) return true;
  // A rare spelling (如何して for どうして) that belongs to this word's entry and no other.
  const owners = dict.byKanji.get(head) ?? [];
  return !tok.reading && owners.length === 1 && owners[0] === entry && kanaFor(entry, head).some((k) => toHiragana(k.text) === reading);
}

export type ExampleStats = { tatoeba: Record<Level, number>; michi: number; missingN5: string[] };

export async function attachExamples(
  words: MatchedWord[],
  dict: JmIndex,
  kr: KanjiReadings,
  michi: Map<string, { ja: string; en: string }>,
): Promise<ExampleStats> {
  const indices = await loadIndices();
  const [ja, en] = await Promise.all([
    loadSentences("tatoebaJpn", new Set(indices.map((s) => s.jaId))),
    loadSentences("tatoebaEng", new Set(indices.map((s) => s.enId))),
  ]);

  // Usable sentence pairs only: both sides present, short, clean, and Japanese without Latin letters.
  const usable = indices.filter((s) => {
    const j = ja.get(s.jaId);
    const e = en.get(s.enId);
    if (!j || !e) return false;
    if ([...j.text].length > MAX_JA || e.text.length > MAX_EN) return false;
    if (/[A-Za-zＡ-Ｚａ-ｚ{}|[\]]/.test(j.text) || NOISY.test(j.text)) return false;
    return !BLOCK_EN.test(e.text) && !BLOCK_JA.test(j.text);
  });

  // headword → sentences using it, with the token.
  const byHead = new Map<string, { s: IndexedSentence; tok: BToken }[]>();
  for (const s of usable) for (const tok of s.tokens) {
    const list = byHead.get(tok.head);
    if (list) list.push({ s, tok });
    else byHead.set(tok.head, [{ s, tok }]);
  }

  // The lowest level at which each headword is a listed word, to judge how hard a sentence is.
  const known = new Map<string, number>();
  for (const { word, deck, entry } of words) {
    const heads = new Set([...deck.forms.map((f) => f.replace(/〜/g, "")), word.reading]);
    for (const k of entry?.kanji ?? []) heads.add(k.text);
    for (const k of entry?.kana ?? []) heads.add(k.text);
    for (const h of heads) known.set(h, Math.min(known.get(h) ?? 9, levelRank(word.level)));
  }

  const rubyCache = new Map<number, string | null>();
  const rubyOf = (s: IndexedSentence) => {
    if (!rubyCache.has(s.jaId)) rubyCache.set(s.jaId, sentenceRuby(ja.get(s.jaId)!.text, s.tokens, dict, kr));
    return rubyCache.get(s.jaId)!;
  };

  const used = new Set<number>();
  const stats: ExampleStats = { tatoeba: { N5: 0, N4: 0, N3: 0 }, michi: 0, missingN5: [] };

  for (const m of words) {
    const { word, deck, entry } = m;
    const fresh = michi.get(word.slug);
    if (fresh) {
      word.example = { ja: fresh.ja, en: fresh.en, source: "michi" };
      stats.michi++;
      continue;
    }
    const reading = toHiragana(word.reading.replace(/〜/g, ""));
    const heads = new Set(deck.forms.map((f) => f.replace(/〜/g, "")));
    for (const k of entry?.kanji ?? []) heads.add(k.text);
    for (const k of entry?.kana ?? []) heads.add(k.text);
    if (!hasKanji(word.term)) heads.add(word.term.replace(/〜/g, ""));

    const rank = levelRank(word.level);
    // Prefer sentences whose English uses one of the word's meanings, so the example shows the
    // sense being taught (遊ぶ "play", not the rarer "lie idle").
    const keys = word.meanings
      .flatMap((m) => m.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/^to /, "").split(/[^a-z]+/))
      .filter((k) => k.length >= 3 && !STOP.has(k))
      .map((k) => (k.length > 4 ? k.slice(0, -1) : k));
    const sense = keys.length ? new RegExp(`\\b(${keys.join("|")})`, "i") : null;
    const candidates: (Candidate & { score: number })[] = [];
    const seen = new Set<number>();
    for (const head of heads) {
      for (const { s, tok } of byHead.get(head) ?? []) {
        if (seen.has(s.jaId)) continue;
        if (!tokenIsWord(tok, head, reading, entry, dict)) continue;
        seen.add(s.jaId);
        const jaS = ja.get(s.jaId)!;
        const len = [...jaS.text].length;
        const hard = s.tokens.filter((t) => /[\p{Script=Han}\p{Script=Katakana}]/u.test(t.head) && (known.get(t.head) ?? 9) > rank).length;
        let score = tok.good ? 0 : 3;
        score += hard * 2;
        if (len < 6) score += 6 - len;
        if (len > 18) score += (len - 18) / 2;
        if (used.has(s.jaId)) score += 5;
        if (sense && !sense.test(en.get(s.enId)!.text)) score += 3;
        candidates.push({ s, ja: jaS, en: en.get(s.enId)!, good: tok.good, score });
      }
    }
    candidates.sort((a, b) => a.score - b.score || a.s.jaId - b.s.jaId);
    for (const c of candidates.slice(0, 40)) {
      const ruby = rubyOf(c.s);
      if (!ruby) continue;
      const example: Example = {
        ja: ruby,
        en: c.en.text,
        source: "tatoeba",
        tatoeba: {
          ja: c.s.jaId,
          en: c.s.enId,
          ...(c.ja.author ? { author: c.ja.author } : {}),
          ...(c.en.author ? { enAuthor: c.en.author } : {}),
        },
      };
      word.example = example;
      used.add(c.s.jaId);
      stats.tatoeba[word.level]++;
      break;
    }
    if (!word.example && word.level === "N5") stats.missingN5.push(word.slug);
  }
  return stats;
}
