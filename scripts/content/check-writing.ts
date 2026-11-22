/**
 * `pnpm content:check-writing <file.json>…`: checks hand-written Japanese before a build.
 *
 * Looks at every `ja`, `model` and `hints` string: ruby on every kanji run, kana readings, one
 * [[answer]] in grammar examples and questions, wrong options that differ from the answer, and
 * kanji within the item's level (N5 items may use N5 kanji and kanji from N5 words, and so on).
 * The full build runs the same checks; this is the quick loop while writing.
 */
import { readFileSync } from "node:fs";

import { blanks, toPlain, type Level } from "../../content/schema";
import { checkJa } from "./lib/check-ja";
import { allowedKanjiByLevel } from "./lib/load";

const levelOf = (slug: unknown, fallback: Level): Level => {
  const m = typeof slug === "string" ? slug.match(/:(n[345]):/) : null;
  return m ? (m[1].toUpperCase() as Level) : fallback;
};

function walk(node: unknown, level: Level, where: string, out: string[], allowed: Record<Level, Set<string>>) {
  if (Array.isArray(node)) {
    node.forEach((n, i) => walk(n, level, `${where}[${i}]`, out, allowed));
    return;
  }
  if (!node || typeof node !== "object") return;
  const rec = node as Record<string, unknown>;
  const lv = typeof rec.level === "string" && /^N[345]$/.test(rec.level) ? (rec.level as Level) : levelOf(rec.slug ?? rec.word, level);
  const at = typeof rec.slug === "string" ? rec.slug : typeof rec.word === "string" ? rec.word : where;
  const inGrammar = at.startsWith("gq:") || where.includes(".examples[");
  for (const key of ["ja", "model"]) {
    const v = rec[key];
    if (typeof v !== "string") continue;
    const needsBlank = inGrammar && key === "ja";
    for (const p of checkJa(v, { allowedKanji: allowed[lv], needsBlank })) out.push(`${at} ${key}: ${p}  ← ${v}`);
  }
  if (Array.isArray(rec.hints)) {
    for (const h of rec.hints) if (typeof h === "string") for (const p of checkJa(h, { allowedKanji: allowed[lv] })) out.push(`${at} hint: ${p}  ← ${h}`);
  }
  if (Array.isArray(rec.wrong) && typeof rec.ja === "string") {
    const answer = toPlain(blanks(rec.ja)[0] ?? "");
    const wrong = rec.wrong.map((w) => (typeof w === "string" ? toPlain(w) : ""));
    if (wrong.includes(answer)) out.push(`${at}: a wrong option equals the answer "${answer}"`);
    if (new Set(wrong).size !== wrong.length) out.push(`${at}: wrong options repeat`);
    for (const w of rec.wrong) if (typeof w === "string") for (const p of checkJa(w, { allowedKanji: allowed[lv] })) out.push(`${at} wrong: ${p}  ← ${w}`);
  }
  for (const [k, v] of Object.entries(rec)) {
    if (k === "examples" || k === "questions") walk(v, lv, `${at}.${k}`, out, allowed);
    else if (typeof v === "object") walk(v, lv, `${at}.${k}`, out, allowed);
  }
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: pnpm content:check-writing <file.json>…");
  process.exit(2);
}
async function main() {
  const allowed = await allowedKanjiByLevel();
  let total = 0;
  for (const file of files) {
    const problems: string[] = [];
    walk(JSON.parse(readFileSync(file, "utf8")), "N5", file, problems, allowed);
    for (const p of problems) console.log(p);
    console.log(`${file}: ${problems.length} problem(s)`);
    total += problems.length;
  }
  process.exit(total ? 1 : 0);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
