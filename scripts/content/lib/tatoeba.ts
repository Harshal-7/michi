/**
 * Tatoeba's Japanese indices (the checked sentences that link Japanese to English) and furigana for
 * them, built from each sentence's B-line: `headword(reading)[sense]{form in sentence}~`.
 */
import { createReadStream, readFileSync } from "node:fs";
import { createInterface } from "node:readline";

import { hasKanji, isKanjiChar, splitRuns, toHiragana } from "./jp";
import { isShownForm, type JmIndex, kanaFor } from "./jmdict";
import { charReadings, type KanjiReadings, runReadings } from "./ruby";
import { ensureSource } from "./sources";

export type BToken = {
  head: string;
  reading?: string;
  /** The form as it appears in the sentence, when it differs from the headword. */
  surface?: string;
  /** Marked "~": a checked, good example sentence for this word. */
  good: boolean;
};

export type IndexedSentence = { jaId: number; enId: number; tokens: BToken[] };

const TOKEN = /^([^()[\]{}~]+)(?:\(([^()]+)\))?(?:\[\d+\])?(?:\{([^{}]+)\})?(~)?$/;

export function parseBLine(line: string): BToken[] | null {
  const out: BToken[] = [];
  for (const raw of line.trim().split(/\s+/)) {
    const m = raw.match(TOKEN);
    if (!m) return null;
    out.push({ head: m[1], reading: m[2] ? toHiragana(m[2]) : undefined, surface: m[3], good: m[4] === "~" });
  }
  return out;
}

export async function loadIndices(): Promise<IndexedSentence[]> {
  const out: IndexedSentence[] = [];
  for (const line of readFileSync(await ensureSource("tatoebaIndices"), "utf8").split("\n")) {
    if (!line) continue;
    const [ja, en, bline] = line.split("\t");
    const tokens = parseBLine(bline ?? "");
    const jaId = Number(ja);
    const enId = Number(en);
    if (tokens && jaId > 0 && enId > 0) out.push({ jaId, enId, tokens });
  }
  return out;
}

export type Sentence = { text: string; author?: string };

/** Reads id → text and author for the wanted ids from a sentences_detailed export. */
export async function loadSentences(source: "tatoebaJpn" | "tatoebaEng", wanted: Set<number>): Promise<Map<number, Sentence>> {
  const out = new Map<number, Sentence>();
  const rl = createInterface({ input: createReadStream(await ensureSource(source)), crlfDelay: Infinity });
  for await (const line of rl) {
    const tab = line.indexOf("\t");
    const id = Number(line.slice(0, tab));
    if (!wanted.has(id)) continue;
    const [, , text, user] = line.split("\t");
    out.set(id, { text, author: user && user !== "\\N" ? user : undefined });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Furigana for a sentence

/** The reading 来 takes before what follows it: 来ます (き), 来ない (こ), 来る (く). */
function kuruReading(after: string): string | null {
  if (/^(る|れば)/.test(after)) return "く";
  if (/^(ない|なかっ|なく|なけれ|よう|い|られ|させ|れる|れな)/.test(after)) return "こ";
  if (/^(ま|た|て|ち|なさ|そう)/.test(after)) return "き";
  return null;
}

/** 何 is なん before だ, で, の, と…, and なに before が, を, も, か… */
function naniReading(after: string): string | null {
  if (/^[だでのとてじど]/.test(after)) return "なん";
  if (/^[がをもかはに、。？！?!]/.test(after)) return "なに";
  return null;
}

/**
 * Default readings for common words that JMdict lists with several readings, where the B-line
 * gives none. Each is the reading these words take in everyday sentences; words whose reading
 * really depends on context (方, 一日, 上手, 描く…) are left out, so their sentences are skipped.
 */
const DEFAULT_READINGS: Record<string, string> = {
  私たち: "わたしたち", 行く: "いく", 言う: "いう", 父: "ちち", 日本: "にほん", 今日: "きょう",
  明日: "あした", 昨日: "きのう", 男: "おとこ", 何か: "なにか", 誰: "だれ", 病気: "びょうき",
  何も: "なにも", 両親: "りょうしん", 難しい: "むずかしい", 本当: "ほんとう", 同じ: "おなじ",
  少女: "しょうじょ", 二人: "ふたり", 本当に: "ほんとうに", 女性: "じょせい", 一人: "ひとり",
  他人: "たにん", 車: "くるま", 夜: "よる", 理由: "りゆう", 寒い: "さむい", 声: "こえ", 皆: "みんな",
  赤ん坊: "あかんぼう", 今朝: "けさ", 弟: "おとうと", 今年: "ことし", 日本人: "にほんじん",
  日本語: "にほんご", 魚: "さかな", 場合: "ばあい", 村: "むら", 一度: "いちど", 若者: "わかもの",
  暖かい: "あたたかい", 壁: "かべ", 買い物: "かいもの", 叔父: "おじ", 髪: "かみ", お前: "おまえ",
  嫌い: "きらい", 風邪: "かぜ", 工場: "こうじょう", 地震: "じしん", 出て行く: "でていく",
  毎朝: "まいあさ", 祖父: "そふ", 田舎: "いなか", 言語: "げんご", 厳しい: "きびしい", 二: "に",
  母: "はは", 兄: "あに", 姉: "あね", 妹: "いもうと", 今: "いま", 人: "ひと", 物: "もの", 事: "こと",
};

/** The headword's reading: from the B-line, its JMdict entry, the defaults, or JMdict if only one. */
export function headReading(tok: BToken, head: string, after: string, dict: JmIndex): string | null {
  const given = hasKanji(tok.head) ? tok.reading : undefined;
  if (given?.startsWith("#")) {
    const entry = dict.byId.get(given.slice(1));
    const kana = entry ? kanaFor(entry, head).filter(isShownForm) : [];
    return kana.length ? toHiragana(kana[0].text) : null;
  }
  if (given) return given;
  if (head === "何") return naniReading(after);
  if (DEFAULT_READINGS[head]) return DEFAULT_READINGS[head];
  const all = dict.readingsOf(head);
  if (all.size === 1) return [...all][0];
  const common = dict.commonReadingsOf(head);
  return common.size === 1 ? [...common][0] : null;
}

const NUMERAL = /[一二三四五六七八九十百千万〇]/;
const DIGIT = /[0-9０-９]/;

/**
 * Ruby for one token as written in the sentence. The written form may be an inflection of the
 * headword (行く → 行きました), use kana for part of it (気付く → 気づいた, 子供 → 子ども), put
 * digits for numerals (一時間 → １時間) or add a polite お/ご (会う → お会い). The headword's
 * readings carry over kanji by kanji. Returns null when unsure.
 */
function tokenRuby(tok: BToken, after: string, dict: JmIndex, kr: KanjiReadings): string | null {
  const surface = tok.surface ?? tok.head;
  if (!hasKanji(surface)) return surface;
  const head = hasKanji(tok.head) ? tok.head : surface;
  const reading = headReading(tok, head, after, dict);
  if (!reading) return null;
  const parts = runReadings(head, reading, kr);
  if (!parts) return null;

  const out: string[] = [];
  let pos = 0;
  if (/^[おご]/.test(surface) && !/^[おご]/.test(head)) {
    out.push(surface[0]);
    pos = 1;
  }
  let i = 0;
  let lastKanji: { text: string; at: number } | null = null;
  const runs = splitRuns(head);
  outer: for (const run of runs) {
    if (pos >= surface.length) break;
    if (!run.kanji) {
      // Okurigana: follow the headword until the inflection starts.
      for (const c of run.text) {
        if (surface[pos] !== c) break outer;
        out.push(c);
        pos++;
      }
      continue;
    }
    const r = parts[i++];
    if (surface.startsWith(run.text, pos)) {
      out.push(`{${run.text}|${r}}`);
      lastKanji = { text: run.text, at: out.length - 1 };
      pos += run.text.length;
      continue;
    }
    if (toHiragana(surface).startsWith(r, pos)) {
      out.push(surface.slice(pos, pos + r.length));
      pos += r.length;
      continue;
    }
    // The run diverges part-way: go kanji by kanji.
    const chars = [...run.text];
    const each = chars.length > 1 ? charReadings(run.text, r, kr) : null;
    if (!each) return null;
    for (let c = 0; c < chars.length; c++) {
      if (pos >= surface.length) break outer;
      if (surface[pos] === chars[c]) {
        out.push(`{${chars[c]}|${each[c]}}`);
        lastKanji = { text: chars[c], at: out.length - 1 };
        pos++;
      } else if (toHiragana(surface).startsWith(each[c], pos)) {
        out.push(surface.slice(pos, pos + each[c].length));
        pos += each[c].length;
      } else if (NUMERAL.test(chars[c]) && DIGIT.test(surface[pos])) {
        while (c + 1 < chars.length && NUMERAL.test(chars[c + 1])) c++;
        while (pos < surface.length && DIGIT.test(surface[pos])) out.push(surface[pos++]);
      } else return null;
    }
  }
  const rest = surface.slice(pos);
  if (hasKanji(rest)) return null;
  if (lastKanji && surface !== head && pos <= surface.length) {
    if (lastKanji.text === "来" && /来る$/.test(head)) {
      const fixed = kuruReading(rest);
      if (!fixed) return null;
      out[lastKanji.at] = `{来|${fixed}}`;
    }
    if (/^(良|好|善)い$/.test(head) && reading === "いい" && lastKanji.text === head[0]) out[lastKanji.at] = `{${head[0]}|よ}`;
  }
  return out.join("") + rest;
}

/** The sentence with ruby on every kanji run, or null if any kanji can't be read with confidence. */
export function sentenceRuby(text: string, tokens: BToken[], dict: JmIndex, kr: KanjiReadings): string | null {
  if (/[{}|[\]]/.test(text)) return null;
  const spans: { start: number; end: number; markup: string }[] = [];
  let cursor = 0;
  for (const tok of tokens) {
    const surface = tok.surface ?? tok.head;
    if (!hasKanji(surface)) continue;
    const at = text.indexOf(surface, cursor);
    if (at < 0) return null;
    const markup = tokenRuby(tok, text.slice(at + surface.length), dict, kr);
    if (!markup) return null;
    spans.push({ start: at, end: at + surface.length, markup });
    cursor = at + surface.length;
  }
  let out = "";
  let pos = 0;
  for (const s of spans) {
    const gap = text.slice(pos, s.start);
    if ([...gap].some(isKanjiChar)) return null;
    out += gap + s.markup;
    pos = s.end;
  }
  const tail = text.slice(pos);
  if ([...tail].some(isKanjiChar)) return null;
  return out + tail;
}
