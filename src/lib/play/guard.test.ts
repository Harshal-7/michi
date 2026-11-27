/**
 * The public games must not reach Harshal's study data. Starting from every file under the public
 * folders, this follows imports through src/ and checks that:
 * - the only database modules reached are src/db/play.ts (the one way in, not followed further)
 *   and the sign-in's own auth.ts, client.ts and schema.ts;
 * - only those and src/lib/auth/session.ts use the connection or the tables directly.
 * Type-only imports are skipped: they don't run.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = join(dirname(new URL(import.meta.url).pathname), "../../..");
const PUBLIC = ["src/app/(play)", "src/app/api/play", "src/lib/play", "src/lib/games", "src/components/games", "src/components/play"];
const DB_ALLOWED = new Set(["src/db/play.ts", "src/db/auth.ts", "src/db/client.ts", "src/db/schema.ts"]);
const RAW_DB = new Set(["src/db/client.ts", "src/db/schema.ts"]);
const RAW_DB_USERS = new Set(["src/db/auth.ts", "src/db/client.ts", "src/lib/auth/session.ts"]);

function filesUnder(dir: string): string[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(ROOT, path)).isDirectory()) return filesUnder(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const IMPORT = /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^'";]*?\s+from\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;

/** The value imports of a file, as paths from the repo root (src/ only). */
function importsOf(file: string): string[] {
  const text = readFileSync(join(ROOT, file), "utf8");
  const out: string[] = [];
  for (const m of text.matchAll(IMPORT)) {
    if (m[1]) continue;
    const spec = m[2] ?? m[3];
    let base: string | null = null;
    if (spec.startsWith("@/")) base = join("src", spec.slice(2));
    else if (spec.startsWith(".")) base = join(dirname(file), spec);
    if (!base) continue;
    const found = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")].find((p) => existsSync(join(ROOT, p)) && statSync(join(ROOT, p)).isFile());
    if (found) out.push(relative(ROOT, join(ROOT, found)));
  }
  return out;
}

/** What breaks the rule, reached from `roots`. */
export function violations(roots: string[]): string[] {
  const seen = new Set<string>();
  const todo = [...roots];
  const problems: string[] = [];
  while (todo.length) {
    const file = todo.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (file.startsWith("src/db/") && !DB_ALLOWED.has(file)) problems.push(`reaches ${file}`);
    if (file === "src/db/play.ts") continue;
    for (const dep of importsOf(file)) {
      if (RAW_DB.has(dep) && !RAW_DB_USERS.has(file)) problems.push(`${file} uses ${dep} directly`);
      todo.push(dep);
    }
  }
  return problems;
}

describe("the public games", () => {
  it("reach the database only through src/db/play.ts", () => {
    const roots = PUBLIC.flatMap(filesUnder);
    expect(roots.length).toBeGreaterThan(20);
    expect(violations(roots)).toEqual([]);
  });

  it("would notice a private module", () => {
    expect(violations(["src/lib/srs/load.ts"]).length).toBeGreaterThan(0);
    expect(violations(["src/app/(app)/learn/page.tsx"]).length).toBeGreaterThan(0);
  });
});
