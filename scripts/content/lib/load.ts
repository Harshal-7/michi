/** Loaders for the downloaded sources. Each parses data only; nothing from a download is run. */
import { readFileSync } from "node:fs";

import { LEVELS, type Level } from "../../../content/schema";
import { isKanjiChar, normaliseTilde } from "./jp";
import { ensureSource } from "./sources";

/** RFC 4180 CSV: quoted fields may hold commas, quotes ("") and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// kanji-data (KANJIDIC2 with Waller's JLPT levels)

export type KanjiData = {
  strokes: number;
  grade: number | null;
  freq: number | null;
  jlpt_new: number | null;
  meanings: string[];
  readings_on: string[];
  readings_kun: string[];
};

export async function loadKanjiData(): Promise<Map<string, KanjiData>> {
  const raw = JSON.parse(readFileSync(await ensureSource("kanjiData"), "utf8")) as Record<string, Record<string, unknown>>;
  const out = new Map<string, KanjiData>();
  for (const [kanji, v] of Object.entries(raw)) {
    // Keep only the KANJIDIC2 and JLPT fields; every wk_* (WaniKani) field is dropped here.
    out.set(kanji, {
      strokes: v.strokes as number,
      grade: (v.grade as number | null) ?? null,
      freq: (v.freq as number | null) ?? null,
      jlpt_new: (v.jlpt_new as number | null) ?? null,
      meanings: (v.meanings as string[]) ?? [],
      readings_on: (v.readings_on as string[]) ?? [],
      readings_kun: (v.readings_kun as string[]) ?? [],
    });
  }
  return out;
}

/**
 * Waller's N5 kanji list has 80 kanji; kanji-data leaves 分 without a level, so it is added here.
 * Checked on 21 Nov 2026: with 分, the levels come to 80 / 166 / 367.
 */
const LEVEL_FIXES: Record<string, Level> = { 分: "N5" };

export function kanjiLevel(kanji: string, data: KanjiData): Level | null {
  if (LEVEL_FIXES[kanji]) return LEVEL_FIXES[kanji];
  const n = data.jlpt_new;
  return n === 5 || n === 4 || n === 3 ? (`N${n}` as Level) : null;
}

// ---------------------------------------------------------------------------
// open-anki-jlpt-decks (Waller's word lists)

export type DeckWord = {
  level: Level;
  /** Written forms as listed, first one first: "足; 脚" gives ["足", "脚"]. */
  forms: string[];
  reading: string;
  meaning: string;
  /** Position in the source list. */
  index: number;
};

export async function loadDecks(): Promise<DeckWord[]> {
  const out: DeckWord[] = [];
  for (const level of LEVELS) {
    const file = await ensureSource(`words${level}`);
    const [header, ...rows] = parseCsv(readFileSync(file, "utf8"));
    if (header.join(",") !== "expression,reading,meaning,tags,guid") throw new Error(`Unexpected columns in ${file}`);
    rows.forEach(([expression, reading, meaning], index) => {
      out.push({
        level,
        forms: expression.split(/;\s*/).map((f) => normaliseTilde(f.trim())).filter(Boolean),
        reading: normaliseTilde(reading.trim()),
        meaning: meaning.trim(),
        index,
      });
    });
  }
  return out;
}

/** Kanji that items at each level may use: the level's kanji and below, plus kanji in its words. */
export async function allowedKanjiByLevel(): Promise<Record<Level, Set<string>>> {
  const [kd, decks] = await Promise.all([loadKanjiData(), loadDecks()]);
  const out = {} as Record<Level, Set<string>>;
  const acc = new Set<string>();
  for (const level of LEVELS) {
    for (const [k, v] of kd) if (kanjiLevel(k, v) === level) acc.add(k);
    for (const w of decks) if (w.level === level) for (const f of w.forms) for (const c of f) if (isKanjiChar(c)) acc.add(c);
    out[level] = new Set(acc);
  }
  return out;
}
