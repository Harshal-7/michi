/**
 * Design lint (.claude/skills/michi-design): every .tsx under src uses tokens and shared parts, not
 * one-off values. It fails on
 *   text-size     arbitrary text sizes (text-[13px])           → the type scale (text-body, text-meta …)
 *   radius        arbitrary radii (rounded-[20px])             → rounded-chip / btn / card / sheet …
 *   shadow        arbitrary shadows (shadow-[…])               → shadow-card / raised / btn …
 *   hex           hex colours                                  → colour tokens (art colours live in ui/art/*.ts)
 *   default-size  Tailwind's own sizes (text-sm, rounded-xl, shadow-md)
 *   palette       Tailwind's own palette (bg-red-500, text-white)
 *   z-index       raw z-index (z-10, z-[60])                    → z-nav / chip / session / sheet / banner
 *   var-in-class  var() in a class (bg-[var(--x)], bg-(--x))   → a token class
 *   data-look     the old look attribute
 *   accent-button bg-accent + text-on-accent outside ui/        → use Button
 *   unknown-colour a colour class that isn't a token (catches typos: text-ink4, bg-surface3)
 *
 * Class rules read only class strings (string literals whose words are all class-shaped), never copy.
 * Files not yet restyled carry `// design-lint: legacy` and are skipped, but a marked file with no
 * violations fails, so the list only shrinks. A real exception takes
 * `// design-lint-ignore-next-line <rule>: <reason>` (or the same in a JSX comment) on the line above.
 * The last redesign PR sets LEGACY_ALLOWED = false.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/** While true, files marked `// design-lint: legacy` are skipped. */
export const LEGACY_ALLOWED = true;

export const LEGACY_MARKER = "// design-lint: legacy";

const css = readFileSync("src/app/globals.css", "utf8");
/** Colour tokens Tailwind knows (bg-<name>, text-<name> …). */
const COLOURS = new Set([...css.matchAll(/--color-([a-z0-9-]+):/g)].map((m) => m[1]));
/** The type scale (text-<name>). */
const TEXT_SIZES = new Set([...css.matchAll(/--text-([a-z]+):/g)].map((m) => m[1]));

const PALETTE = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOUR_PREFIXES = "bg|text|border|ring|outline|fill|stroke|decoration|divide|caret|placeholder";

/** Values that aren't colours, per prefix. */
const NOT_COLOUR: Record<string, RegExp> = {
  text: /^(left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|xs|sm|base|lg|xl|[2-9]xl)$/,
  bg: /^(fixed|local|scroll|clip-.*|origin-.*|bottom|center|left|left-bottom|left-top|right|right-bottom|right-top|top|repeat.*|no-repeat|auto|cover|contain|none|linear.*|radial.*|conic.*|blend-.*|gradient-.*)$/,
  border: /^(\d+(\.\d+)?|solid|dashed|dotted|double|hidden|none|collapse|separate|spacing.*)$/,
  ring: /^(\d+|inset|offset-.*)$/,
  outline: /^(\d+|none|solid|dashed|dotted|double|hidden|offset-.*)$/,
  fill: /^none$/,
  stroke: /^(\d+(\.\d+)?|none)$/,
  decoration: /^(\d+|solid|double|dotted|dashed|wavy|auto|from-font|clone|slice)$/,
  divide: /^(x|y|x-reverse|y-reverse|\d+|x-\d+|y-\d+|solid|dashed|dotted|double|none)$/,
  caret: /^$/,
  placeholder: /^$/,
};
const KEYWORDS = new Set(["transparent", "current", "inherit", "none"]);

export type Violation = { line: number; rule: string; text: string };

function colourClass(prefix: string, value: string): boolean {
  let v = value.replace(/\/\d+$/, "");
  if (prefix === "border" || prefix === "divide") v = v.replace(/^(x|y|t|r|b|l|s|e)-/, "");
  if (v.startsWith("[") || v.startsWith("(")) return true; // arbitrary: other rules judge it
  if (/^[xytrblse]$/.test(v)) return true; // border-t, border-x alone
  if (NOT_COLOUR[prefix]?.test(v)) return true;
  if (prefix === "text" && TEXT_SIZES.has(v)) return true;
  if (KEYWORDS.has(v)) return true;
  if (/^\d/.test(v)) return true;
  if (new RegExp(`^(${PALETTE})-\\d{2,3}$|^(white|black)$`).test(v)) return true; // palette rule reports it
  return COLOURS.has(v);
}

/** Single-word Tailwind utilities (most class tokens carry a -, :, [, / or digit). */
const UTILITY_WORDS = new Set(
  "flex grid inline block hidden contents absolute relative fixed sticky static isolate truncate underline overline uppercase lowercase capitalize italic peer group grow shrink border rounded shadow outline ring transition transform container table invisible visible collapse antialiased".split(" "),
);

/** A string reads as a class list when every word is class-shaped; copy ("fill-in cards", "Tap · to …") doesn't. */
export function isClassString(text: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return (
    words.length > 0 &&
    words.every((w) => /^[a-z0-9!@*&[(-]\S*$/.test(w) && !/[.,;?!'"…]$/.test(w) && (/[-:[/\d]/.test(w) || UTILITY_WORDS.has(w)))
  );
}

/**
 * The string-literal text on each line ("…", '…' and the plain parts of `…`, which may span lines), with
 * comments skipped. Class rules only look in here, so English copy in JSX text is never read as a class.
 */
export function stringsByLine(lines: string[]): string[][] {
  const out = lines.map((): string[] => []);
  // Open template literals and the ${ … } expressions inside them, innermost last.
  const stack: ({ kind: "tpl"; buf: string } | { kind: "expr"; depth: number })[] = [];
  let inBlockComment = false;
  lines.forEach((s, i) => {
    let j = 0;
    while (j < s.length) {
      const top = stack[stack.length - 1];
      if (inBlockComment) {
        const end = s.indexOf("*/", j);
        if (end < 0) break;
        inBlockComment = false;
        j = end + 2;
      } else if (top?.kind === "tpl") {
        const c = s[j];
        if (c === "\\") {
          top.buf += s.slice(j, j + 2);
          j += 2;
        } else if (c === "`") {
          out[i].push(top.buf);
          stack.pop();
          j++;
        } else if (c === "$" && s[j + 1] === "{") {
          out[i].push(top.buf);
          top.buf = "";
          stack.push({ kind: "expr", depth: 0 });
          j += 2;
        } else {
          top.buf += c;
          j++;
        }
      } else {
        const c = s[j];
        if (c === "/" && s[j + 1] === "/") break;
        if (c === "/" && s[j + 1] === "*") {
          inBlockComment = true;
          j += 2;
        } else if (c === '"' || c === "'") {
          let k = j + 1;
          let buf = "";
          while (k < s.length && s[k] !== c) {
            buf += s[k] === "\\" ? s.slice(k, k + 2) : s[k];
            k += s[k] === "\\" ? 2 : 1;
          }
          out[i].push(buf);
          j = k + 1;
        } else if (c === "`") {
          stack.push({ kind: "tpl", buf: "" });
          j++;
        } else {
          if (top?.kind === "expr") {
            if (c === "{") top.depth++;
            else if (c === "}" && top.depth-- === 0) stack.pop();
          }
          j++;
        }
      }
    }
    const open = stack[stack.length - 1];
    if (open?.kind === "tpl") {
      out[i].push(open.buf);
      open.buf = "";
    }
  });
  return out;
}

/** Lints one file's source. `inUi` is true for src/components/ui/** (Button lives there). */
export function lint(source: string, inUi = false): Violation[] {
  const lines = source.split("\n");
  const strings = stringsByLine(lines);
  const out: Violation[] = [];
  lines.forEach((raw, i) => {
    const prev = lines[i - 1] ?? "";
    const ignored = /design-lint-ignore-next-line\s+([a-z-]+)\s*:\s*\S/.exec(prev)?.[1];
    const trimmed = raw.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    const line = raw.replace(/\/\*.*?\*\//g, "").replace(/(^|\s)\/\/.*$/, "");
    const add = (rule: string, text: string) => {
      if (rule !== ignored) out.push({ line: i + 1, rule, text });
    };
    // Colour values can sit in any attribute or style, so these two read the whole line.
    for (const m of line.matchAll(/(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6})(?![\w-])/g)) add("hex", m[0]);
    for (const m of line.matchAll(/(?:\[|(?:fill|stroke|stopColor|color|background|backgroundColor|borderColor)\s*[=:]\s*\{?\s*["'`])#[0-9a-fA-F]{3,4}(?![\w-])/g)) add("hex", m[0]);
    if (/data-look/.test(line)) add("data-look", "data-look");
    // The class rules read only class strings.
    const classes = strings[i].filter(isClassString).join(" ");
    if (!classes) return;
    for (const m of classes.matchAll(/(?<![\w-])text-\[\d[^\]]*\]/g)) add("text-size", m[0]);
    for (const m of classes.matchAll(/(?<![\w-])rounded(?:-[a-z]{1,2})?-\[[^\]]*\]/g)) add("radius", m[0]);
    for (const m of classes.matchAll(/(?<![\w-])shadow-\[[^\]]*\]/g)) add("shadow", m[0]);
    for (const m of classes.matchAll(/(?<![\w-])(?:text-(?:xs|sm|base|lg|xl|[2-9]xl)|rounded(?:-[a-z]{1,2})?-(?:xs|sm|md|lg|xl|[2-4]xl)|shadow-(?:2xs|xs|sm|md|lg|xl|2xl))(?![\w-])/g))
      add("default-size", m[0]);
    for (const m of classes.matchAll(new RegExp(`(?<![\\w-])(?:${COLOUR_PREFIXES}|from|via|to|shadow)-(?:(?:${PALETTE})-\\d{2,3}|white|black)(?![\\w-])`, "g")))
      add("palette", m[0]);
    for (const m of classes.matchAll(/(?<![\w-])-?z-(?:\d+|\[[^\]]*\])(?![\w-])/g)) add("z-index", m[0]);
    for (const m of classes.matchAll(/(?<![\w])[a-z][a-z0-9-]*-(?:\[[^\]]*var\(--[^\]]*\]|\(--[a-z0-9-]+\))/g)) add("var-in-class", m[0]);
    if (!inUi && /(?<![\w-])bg-accent(?![\w-])/.test(classes) && /(?<![\w-])text-on-accent(?![\w-])/.test(classes)) add("accent-button", "bg-accent + text-on-accent: use Button");
    for (const m of classes.matchAll(new RegExp(`(?<![\\w[,-])(${COLOUR_PREFIXES})-([a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:/\\d+)?)(?![\\w[(-])`, "g"))) {
      if (!colourClass(m[1], m[2])) add("unknown-colour", m[0]);
    }
  });
  return out;
}

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

describe("design lint", () => {
  it("knows the tokens", () => {
    expect(COLOURS.has("accent")).toBe(true);
    expect(COLOURS.has("cover-butter")).toBe(true);
    expect(TEXT_SIZES.has("body")).toBe(true);
    expect(LEGACY_ALLOWED).toBe(true);
  });

  it("catches each rule and honours ignore-next-line", () => {
    const rules = (src: string, inUi = false) => lint(src, inUi).map((v) => v.rule);
    expect(rules(`<p className="text-[13px] rounded-[20px] shadow-[0_1px_2px_red]" />`)).toEqual(["text-size", "radius", "shadow"]);
    expect(rules(`<rect fill="#b03a22" />`)).toEqual(["hex"]);
    expect(rules(`<rect fill="#fff" />`)).toEqual(["hex"]);
    expect(rules(`<a href="#add" />`)).toEqual([]);
    expect(rules(`<p className="text-sm rounded-xl shadow-md" />`)).toEqual(["default-size", "default-size", "default-size"]);
    expect(rules(`<p className="bg-red-500 text-white" />`)).toEqual(["palette", "palette"]);
    expect(rules(`<p className="z-10 z-[60] z-nav" />`)).toEqual(["z-index", "z-index"]);
    expect(rules(`<p className="bg-[var(--accent)] bg-(--page)" />`)).toEqual(["var-in-class", "var-in-class"]);
    expect(rules(`<html data-look="kumo" />`)).toEqual(["data-look"]);
    expect(rules(`<button className="bg-accent text-on-accent" />`)).toEqual(["accent-button"]);
    expect(rules(`<button className="bg-accent text-on-accent" />`, true)).toEqual([]);
    expect(rules(`<p className="text-ink4 bg-surface3 border-t-line text-body text-center border-2 bg-accent-soft/50" />`)).toEqual([
      "unknown-colour",
      "unknown-colour",
    ]);
    // Only class strings are read: copy in JSX text or a sentence in quotes isn't a class.
    expect(rules(`<p>Use the fill-in card</p>`)).toEqual([]);
    expect(rules(`<Field hint="It becomes the blank on the fill-in card." />`)).toEqual([]);
    expect(rules(`const size = \`\${n} words\${grammar ? " · fill-in cards" : ""}\`;`)).toEqual([]);
    expect(rules(`const tone = ok ? "text-good" : "fill-in";`)).toEqual(["unknown-colour"]);
    expect(rules(`<p className={\`flex \${on ? "text-ink4" : ""} gap-2\`} />`)).toEqual(["unknown-colour"]);
    expect(rules(`<p className={\`flex \${\n  on ? "a" : "b"\n} text-[13px]\`} />`)).toEqual(["text-size"]);
    expect(rules(`// design-lint-ignore-next-line hex: the icon's own colour\n<rect fill="#2a62d8" />`)).toEqual([]);
    expect(rules(`{/* design-lint-ignore-next-line hex: brand */}\n<rect fill="#2a62d8" />`)).toEqual([]);
    // A reason is required, and the rule must match.
    expect(rules(`// design-lint-ignore-next-line hex\n<rect fill="#2a62d8" />`)).toEqual(["hex"]);
    expect(rules(`// design-lint-ignore-next-line radius: wrong rule\n<rect fill="#2a62d8" />`)).toEqual(["hex"]);
  });

  it("passes every restyled file, and keeps the legacy list shrinking", () => {
    const problems: string[] = [];
    const cleanButMarked: string[] = [];
    for (const path of tsxFiles("src")) {
      const source = readFileSync(path, "utf8");
      const file = relative(".", path);
      const found = lint(source, file.startsWith(join("src", "components", "ui")));
      const marked = source.includes(LEGACY_MARKER);
      if (marked && LEGACY_ALLOWED) {
        if (found.length === 0) cleanButMarked.push(file);
        continue;
      }
      if (marked) problems.push(`${file}: still marked "${LEGACY_MARKER}"`);
      for (const v of found) problems.push(`${file}:${v.line} ${v.rule} ${v.text}`);
    }
    expect(problems, "Use tokens and ui parts (or a design-lint-ignore-next-line with a reason)").toEqual([]);
    expect(cleanButMarked, `These pass now: remove "${LEGACY_MARKER}"`).toEqual([]);
  });
});
