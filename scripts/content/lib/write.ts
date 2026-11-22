import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/** One record per line, so diffs of the big files stay readable. */
export function writeLines(file: string, records: readonly unknown[]): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const body = records.length === 0 ? "[]\n" : `[\n${records.map((r) => JSON.stringify(r)).join(",\n")}\n]\n`;
  writeFileSync(file, body);
}

/** Indented JSON for small files that people read and edit. */
export function writePretty(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

/** Sorts by the keys in order, comparing by code point, so the order never depends on locale. */
export function stableSort<T>(items: readonly T[], ...keys: ((t: T) => string | number)[]): T[] {
  return [...items].sort((a, b) => {
    for (const key of keys) {
      const x = key(a);
      const y = key(b);
      if (x < y) return -1;
      if (x > y) return 1;
    }
    return 0;
  });
}
