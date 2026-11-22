/**
 * The kana charts in Learn: hiragana and katakana laid out in their usual table, each character
 * with its example word, look-alikes and how far its card has got.
 */
import { and, asc, eq, sql } from "drizzle-orm";

import type { DbOrTx } from "@/db/client";
import { cards, decks, items } from "@/db/schema";

export const SCRIPTS = ["hiragana", "katakana"] as const;
export type Script = (typeof SCRIPTS)[number];
export const isScript = (s: string): s is Script => (SCRIPTS as readonly string[]).includes(s);

/** Where a character's card is: graduated to reviews, in its learning steps, or not started. */
export type KanaStatus = "review" | "learning" | "new";

export type KanaCell = {
  id: number;
  kana: string;
  romaji: string;
  example: { term: string; reading: string; meaning: string } | null;
  lookalikes: string[];
  status: KanaStatus;
};

type Group = "basic" | "dakuten" | "combo" | "extended";
export type KanaRow = KanaCell & { group: Group };

export type ChartSection = { group: Group; title: string; cols: 3 | 5; rows: (KanaCell | null)[][] };

const TITLES: Record<Group, string> = {
  basic: "Basic",
  dakuten: "Dakuten and handakuten",
  combo: "Combinations",
  extended: "Extended sounds",
};
const GROUPS: Group[] = ["basic", "dakuten", "combo", "extended"];

/**
 * Lays a script's characters out in the gojūon table: columns by vowel (a i u e o; a u o for the
 * combinations), a new row whenever the vowel doesn't move right, so や ゆ よ and わ を keep their
 * gaps and ん sits on a row of its own. Extended sounds just flow, five to a row.
 */
export function kanaChart(rows: readonly KanaRow[]): ChartSection[] {
  return GROUPS.flatMap((group): ChartSection[] => {
    const cells = rows.filter((r) => r.group === group);
    if (cells.length === 0) return [];
    const cols = group === "combo" ? 3 : 5;
    if (group === "extended") {
      const out: (KanaCell | null)[][] = [];
      for (let i = 0; i < cells.length; i += cols) out.push(pad(cells.slice(i, i + cols), cols));
      return [{ group, title: TITLES[group], cols, rows: out }];
    }
    const vowels = cols === 3 ? "auo" : "aiueo";
    const out: (KanaCell | null)[][] = [];
    let row: (KanaCell | null)[] = [];
    let last = -1;
    for (const cell of cells) {
      const col = vowels.indexOf(cell.romaji.at(-1) ?? "");
      if (col < 0) {
        // ん: its own row, first column.
        if (row.length) out.push(pad(row, cols));
        out.push(pad([cell], cols));
        row = [];
        last = -1;
        continue;
      }
      if (col <= last) {
        out.push(pad(row, cols));
        row = [];
      }
      while (row.length < col) row.push(null);
      row.push(cell);
      last = col;
    }
    if (row.length) out.push(pad(row, cols));
    return [{ group, title: TITLES[group], cols, rows: out }];
  });
}

function pad(row: (KanaCell | null)[], cols: number): (KanaCell | null)[] {
  return [...row, ...Array<null>(Math.max(0, cols - row.length)).fill(null)];
}

/** Counts per status, for the hub and the chart's legend. */
export function kanaCounts(rows: readonly { status: KanaStatus }[]): Record<KanaStatus, number> {
  const out: Record<KanaStatus, number> = { review: 0, learning: 0, new: 0 };
  for (const r of rows) out[r.status] += 1;
  return out;
}

function statusOf(state: string | null): KanaStatus {
  if (state === "review") return "review";
  if (state === "learning" || state === "relearning") return "learning";
  return "new";
}

/** Every kana of one script with its recognition card's state, in content order. */
export async function loadKana(db: DbOrTx, script: Script): Promise<KanaRow[]> {
  const rows = await db
    .select({ id: items.id, kana: items.term, romaji: items.reading, data: items.data, state: cards.state })
    .from(items)
    .leftJoin(cards, and(eq(cards.itemId, items.id), eq(cards.cardType, "recognition")))
    .where(and(eq(items.kind, "kana"), sql`${items.data}->>'script' = ${script}`))
    .orderBy(asc(items.id));
  return rows.map((r) => {
    const data = r.data as { group?: string; lookalikes?: unknown; example?: Record<string, unknown> };
    const ex = data.example;
    return {
      id: r.id,
      kana: r.kana,
      romaji: r.romaji ?? "",
      group: (GROUPS as string[]).includes(data.group ?? "") ? (data.group as Group) : "extended",
      lookalikes: Array.isArray(data.lookalikes) ? data.lookalikes.filter((l): l is string => typeof l === "string") : [],
      example:
        ex && typeof ex.term === "string"
          ? { term: ex.term, reading: typeof ex.reading === "string" ? ex.reading : "", meaning: typeof ex.meaning === "string" ? ex.meaning : "" }
          : null,
      status: statusOf(r.state),
    };
  });
}

/** The script's deck, for "Review hiragana". */
export async function kanaDeckId(db: DbOrTx, script: Script): Promise<number | null> {
  const [deck] = await db.select({ id: decks.id }).from(decks).where(eq(decks.slug, script));
  return deck?.id ?? null;
}
