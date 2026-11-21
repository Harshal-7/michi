/**
 * `pnpm content:links`: builds and checks the link tables the content build reads.
 *
 * 1. Reads JLPT Sensei's N5, N4 and N3 grammar list pages and keeps each point's title and link.
 *    Only titles and links are kept; the site's explanations are never copied.
 * 2. Reads Bunpro's grammar index and adds a Bunpro link where its title matches exactly.
 * 3. Opens every grammar link and every resource link, one at a time, and keeps only the ones that
 *    load as the real page (guessed URLs return 202 captcha pages, so status alone isn't enough).
 *
 * Writes content/source/grammar-links.json and content/source/resource-links.json. The content
 * build never touches the network for these; it reads the committed tables.
 *
 * Flags: --skip-check reuses the previous check results for links already in the tables;
 * --pause <ms> sets the pause between requests (default 1200).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { LEVELS, type Level } from "../../content/schema";
import { EXPECTED } from "./lib/expected";
import { decodeEntities, getPage, pageTitle, sleep } from "./lib/http";
import { SOURCE } from "./lib/paths";
import { GrammarLinkTable, ResourceLinkTable, type GrammarPointLinks, ResourcesSource } from "./lib/source-types";
import { writePretty } from "./lib/write";

/** Pause between requests; `--pause <ms>` slows down further when a site starts refusing. */
const pauseArg = process.argv.indexOf("--pause");
const PAUSE_MS = pauseArg > 0 ? Number(process.argv[pauseArg + 1]) : 1200;
const today = new Date().toISOString().slice(0, 10);

type Row = { level: Level; n: number; romaji: string; title: string; url: string };

function parseListPage(html: string, level: Level): Row[] {
  return html
    .split("<tr class=jl-row>")
    .slice(1)
    .map((row) => {
      const n = Number(row.match(/jl-td-num[^>]*>(\d+)/)?.[1]);
      const links = [...row.matchAll(/<a [^>]*href=([^ >]+)[^>]*>([^<]*)<\/a>/g)];
      if (!n || links.length < 2) throw new Error(`Unexpected JLPT Sensei row on the ${level} list`);
      return {
        level,
        n,
        url: links[0][1].replace(/^"|"$/g, ""),
        romaji: decodeEntities(links[0][2]).trim(),
        title: decodeEntities(links[1][2]).trim(),
      };
    });
}

async function readJlptSenseiLists(): Promise<Row[]> {
  const rows: Row[] = [];
  for (const level of LEVELS) {
    const base = `https://jlptsensei.com/jlpt-${level.toLowerCase()}-grammar-list/`;
    for (let page = 1; page < 20; page++) {
      const url = page === 1 ? base : `${base}page/${page}/`;
      const res = await getPage(url);
      await sleep(PAUSE_MS);
      const found = res.status === 200 ? parseListPage(res.body, level) : [];
      if (found.length === 0) break;
      rows.push(...found);
      console.log(`  ${level} page ${page}: ${found.length} points`);
    }
  }
  return rows;
}

/** A URL-safe slug from the romaji title: "cha ikenai / ja ikenai" → "cha-ikenai-ja-ikenai". */
function slugify(romaji: string): string {
  return romaji
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type BunproPoint = { url: string; title: string; level: string };

function parseBunproIndex(html: string): BunproPoint[] {
  const out: BunproPoint[] = [];
  const re = /href="\/grammar_points\/([^"#?]+)"[\s\S]*?<h4[^>]*>([\s\S]*?)<\/h4>[\s\S]*?<span>(N\d|Non-JLPT)<\/span>/g;
  for (const m of html.matchAll(re)) {
    out.push({
      url: `https://bunpro.jp/grammar_points/${m[1]}`,
      title: decodeEntities(m[2].replace(/<[^>]+>/g, "")).trim(),
      level: m[3],
    });
  }
  return out;
}

/** Title forms that should compare equal: no 〜, no spaces, full-width brackets dropped. */
const normTitle = (s: string) => s.replace(/[〜～~\s()（）]/g, "").normalize("NFKC");

function matchBunpro(rows: Row[], bunpro: BunproPoint[]): Map<Row, BunproPoint> {
  const byTitle = new Map<string, BunproPoint[]>();
  for (const b of bunpro) {
    const k = normTitle(b.title);
    byTitle.set(k, [...(byTitle.get(k) ?? []), b]);
  }
  // The whole title must match one Bunpro point at the same JLPT level. The same title can name
  // different grammar at different levels (じゃない at N5 and N3), so a level mismatch is no match.
  const hits = new Map<Row, BunproPoint>();
  for (const row of rows) {
    const same = (byTitle.get(normTitle(row.title)) ?? []).filter((b) => b.level === row.level);
    if (same.length === 1) hits.set(row, same[0]);
  }
  // A Bunpro page may back one point only (two N4 "そうだ" points are different grammar).
  const uses = new Map<string, number>();
  for (const b of hits.values()) uses.set(b.url, (uses.get(b.url) ?? 0) + 1);
  for (const [row, b] of hits) if ((uses.get(b.url) ?? 0) > 1) hits.delete(row);
  return hits;
}

type Check = { ok: boolean; status: number; note: string };

async function checkJlptSensei(url: string): Promise<Check> {
  const res = await getPage(url);
  const canonical = res.body.match(/<link rel=["']?canonical["']? href=["']?([^"' >]+)/)?.[1] ?? "";
  const same = (a: string) => decodeURI(a).toLowerCase();
  // A real grammar page names itself as the canonical URL and has a JLPT Sensei grammar title.
  const ok = res.status === 200 && same(canonical) === same(url) && /Grammar|JLPT/.test(pageTitle(res.body));
  return { ok, status: res.status, note: ok ? "" : `title "${pageTitle(res.body).slice(0, 60)}"` };
}

async function checkBunpro(url: string, title: string): Promise<Check> {
  const res = await getPage(url);
  const t = pageTitle(res.body);
  const ok = res.status === 200 && t.endsWith("| Bunpro") && normTitle(t).startsWith(normTitle(title));
  return { ok, status: res.status, note: ok ? "" : `title "${t.slice(0, 60)}"` };
}

async function checkResource(url: string): Promise<Check> {
  const res = await getPage(url);
  // Some sites answer bots with a challenge page; those count as failures until checked by hand.
  const ok = res.status >= 200 && res.status < 300 && res.status !== 202 && res.body.length > 500;
  return { ok, status: res.status, note: ok ? pageTitle(res.body).slice(0, 80) : `status ${res.status}` };
}

const readJson = (file: string): unknown => {
  try {
    return JSON.parse(readFileSync(path.join(SOURCE, file), "utf8"));
  } catch {
    return undefined;
  }
};

async function main() {
  const skipCheck = process.argv.includes("--skip-check");
  const previous = GrammarLinkTable.safeParse(readJson("grammar-links.json"));
  const previouslyOk = new Set(previous.success ? previous.data.points.flatMap((p) => p.links.map((l) => l.url)) : []);

  console.log("Reading the JLPT Sensei grammar lists…");
  const rows = await readJlptSenseiLists();
  // A site that refuses a request mid-run must never shrink the committed table.
  for (const level of LEVELS) {
    const got = rows.filter((r) => r.level === level).length;
    if (got !== EXPECTED.grammar[level]) throw new Error(`Read ${got} ${level} points, expected ${EXPECTED.grammar[level]}; nothing written.`);
  }

  console.log("Reading the Bunpro grammar index…");
  const index = await getPage("https://bunpro.jp/grammar_points");
  const bunpro = index.status === 200 ? parseBunproIndex(index.body) : [];
  console.log(`  ${bunpro.length} Bunpro points`);
  const bunproFor = matchBunpro(rows, bunpro);

  const slugs = new Set<string>();
  const points: GrammarPointLinks[] = [];
  const failed: { slug: string; url: string; status: number; note: string }[] = [];
  for (const row of rows) {
    let slug = `grammar:${row.level.toLowerCase()}:${slugify(row.romaji)}`;
    for (let i = 2; slugs.has(slug); i++) slug = `grammar:${row.level.toLowerCase()}:${slugify(row.romaji)}-${i}`;
    slugs.add(slug);

    const links: GrammarPointLinks["links"] = [];
    const candidates: { site: "jlptsensei" | "bunpro"; url: string; check: () => Promise<Check> }[] = [
      { site: "jlptsensei", url: row.url, check: () => checkJlptSensei(row.url) },
    ];
    const b = bunproFor.get(row);
    if (b) candidates.push({ site: "bunpro", url: b.url, check: () => checkBunpro(b.url, b.title) });

    for (const c of candidates) {
      if (skipCheck && previouslyOk.has(c.url)) {
        links.push({ site: c.site, url: c.url });
        continue;
      }
      const result = await c.check();
      await sleep(PAUSE_MS);
      if (result.ok) links.push({ site: c.site, url: c.url });
      else failed.push({ slug, url: c.url, status: result.status, note: result.note });
    }
    points.push({ slug, level: row.level, n: row.n, title: row.title, romaji: row.romaji, links });
    process.stdout.write(`\r  checked ${points.length}/${rows.length}`);
  }
  process.stdout.write("\n");

  const linked = new Set(points.flatMap((p) => p.links.map((l) => l.url)));
  const browserChecked = (previous.success ? previous.data.browserChecked : []).filter((u) => linked.has(u));
  writePretty(path.join(SOURCE, "grammar-links.json"), GrammarLinkTable.parse({ checkedOn: today, points, failed, browserChecked }));

  console.log("Checking resource links…");
  const resources = ResourcesSource.parse(readJson("resources.json") ?? []);
  const prevRes = ResourceLinkTable.safeParse(readJson("resource-links.json"));
  const prevByUrl = new Map(prevRes.success ? prevRes.data.links.map((l) => [l.url, l]) : []);
  const links: ResourceLinkTable["links"] = [];
  for (const r of resources) {
    const prev = prevByUrl.get(r.url);
    if (skipCheck && prev?.ok) {
      links.push(prev);
      continue;
    }
    const result = await checkResource(r.url);
    await sleep(PAUSE_MS);
    links.push({ url: r.url, ok: result.ok, status: result.status, checkedOn: today, note: result.note });
    if (!result.ok) console.log(`  failed: ${r.url} (${result.note})`);
  }
  writePretty(path.join(SOURCE, "resource-links.json"), ResourceLinkTable.parse({ links }));

  const counts = LEVELS.map((l) => `${l} ${points.filter((p) => p.level === l).length}`).join(" / ");
  console.log(`Grammar points: ${counts}; Bunpro links: ${points.filter((p) => p.links.some((l) => l.site === "bunpro")).length}`);
  console.log(`Failed grammar links: ${failed.length}; failed resource links: ${links.filter((l) => !l.ok).length}`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
