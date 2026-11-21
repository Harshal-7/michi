/** Reads content/generated/*.json through the contract in content/schema.ts. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { CONTENT_FILES, CONTENT_KEYS, contentPath, type ContentFile } from "@content/schema";
import type { z } from "zod";

export type Content = { [K in ContentFile]: z.infer<(typeof CONTENT_FILES)[K]> };

export const CONTENT_NAMES = Object.keys(CONTENT_FILES) as ContentFile[];

/** content/generated, from the repo root. */
export const DEFAULT_CONTENT_DIR = dirname(contentPath("kana"));

export class ContentError extends Error {}

/**
 * Loads and checks every content file. Throws a ContentError naming the file and the first
 * problems if a file is missing, doesn't match the schema or repeats a key.
 */
export function loadContent(dir: string = DEFAULT_CONTENT_DIR): { content: Content; hash: string } {
  const hash = createHash("sha256");
  const content = {} as Record<ContentFile, unknown[]>;
  for (const name of CONTENT_NAMES) {
    const file = join(dir, `${name}.json`);
    let raw: string;
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      throw new ContentError(`${file} is missing.`);
    }
    hash.update(`${name}\n${raw}\n`);
    const parsed = CONTENT_FILES[name].safeParse(JSON.parse(raw));
    if (!parsed.success) {
      const issues = parsed.error.issues
        .slice(0, 5)
        .map((i) => `  ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new ContentError(`${file} doesn't match content/schema.ts:\n${issues}`);
    }
    const key = CONTENT_KEYS[name];
    const seen = new Set<unknown>();
    for (const record of parsed.data as Record<string, unknown>[]) {
      if (seen.has(record[key])) throw new ContentError(`${file} repeats the ${key} "${String(record[key])}".`);
      seen.add(record[key]);
    }
    content[name] = parsed.data;
  }
  return { content: content as Content, hash: hash.digest("base64url") };
}

/** JSON with object keys sorted, so the same record always gives the same text. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

/** The `seed_hash` of a content record. */
export function recordHash(record: unknown): string {
  return createHash("sha256").update(stableJson(record)).digest("base64url");
}
