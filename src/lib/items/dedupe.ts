/**
 * The key that stops the same thing being added twice (unique per kind in `items`).
 * Width and composition are normalised (NFKC), so full-width and half-width forms match.
 * Round 3 adds the "maybe the same word" check (こと vs 事) on top; this is the exact match.
 */

import type { ItemKind } from "./data";

const norm = (s: string) => s.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

export function dedupeKey(kind: ItemKind, term: string, reading?: string | null): string {
  switch (kind) {
    case "word":
      return `${norm(term)}|${norm(reading ?? "")}`;
    case "grammar":
      // "〜てもいいです" and "てもいいです" are the same point.
      return norm(term).replace(/^[〜~]+/, "");
    default:
      return norm(term);
  }
}
