/**
 * The fixed source versions the content is built from.
 *
 * Every download is checked against its SHA-256, so a build only ever sees the bytes listed here.
 * GitHub sources are pinned to a commit or release. Tatoeba publishes only a weekly snapshot, so
 * its hashes pin the snapshot of the date shown; once that snapshot is gone, download the current
 * one with `pnpm content:build --update-sources`, review the diff of content/generated, and commit
 * the new hashes printed by the build.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { CACHE } from "./paths";

type Source = {
  url: string;
  /** Where the download is kept, under the cache. */
  file: string;
  sha256: string;
  /** How to get the usable file out of the download. Only the named member is extracted. */
  extract?: { kind: "tgz" | "tbz" | "bz2"; member?: string; to: string };
};

const KANJI_DATA = "https://raw.githubusercontent.com/davidluzgouveia/kanji-data/00fd7079c3890f430759536f91aa5e854ec0ca4f";
const ANKI_DECKS = "https://raw.githubusercontent.com/jamsinclair/open-anki-jlpt-decks/1ad66734417aca9dbcca6b2d5ee440cb13ab3ba0";
const JMDICT = "https://github.com/scriptin/jmdict-simplified/releases/download/3.6.2%2B20261116213322";
export const JMDICT_RELEASE = "3.6.2+20261116213322";
export const TATOEBA_SNAPSHOT = "2026-11-21";

export const SOURCES = {
  kanjiData: {
    url: `${KANJI_DATA}/kanji.json`,
    file: "kanji-data/kanji.json",
    sha256: "561b72ea9df703c58fae0c68585812e172aaa7611d2fcee6719d55fd2dfd4fa4",
  },
  wordsN5: {
    url: `${ANKI_DECKS}/src/n5.csv`,
    file: "open-anki-jlpt-decks/n5.csv",
    sha256: "f89abc86b391c4f2b551bbf8910b0de6cd600973b3a9f8d98347513921929ebe",
  },
  wordsN4: {
    url: `${ANKI_DECKS}/src/n4.csv`,
    file: "open-anki-jlpt-decks/n4.csv",
    sha256: "0e835f40a8d2a1f191d7aa499076002756fa099b95634758376f43c73793e9f6",
  },
  wordsN3: {
    url: `${ANKI_DECKS}/src/n3.csv`,
    file: "open-anki-jlpt-decks/n3.csv",
    sha256: "ba071571d344e60b0e1fd11cd2e98a6aaa04515361653ca45147129460531297",
  },
  jmdictCommon: {
    url: `${JMDICT}/jmdict-eng-common-${JMDICT_RELEASE}.json.tgz`,
    file: `jmdict/jmdict-eng-common-${JMDICT_RELEASE}.json.tgz`,
    sha256: "bc8ffa4f1350686e519051e7bac4520f05f375d2b52b1549bcba2e1a08193002",
    extract: { kind: "tgz", member: "jmdict-eng-common-3.6.2.json", to: "jmdict/jmdict-eng-common.json" },
  },
  /** The full dictionary, used only to match words and to look up readings for furigana. */
  jmdictFull: {
    url: `${JMDICT}/jmdict-eng-${JMDICT_RELEASE}.json.tgz`,
    file: `jmdict/jmdict-eng-${JMDICT_RELEASE}.json.tgz`,
    sha256: "956a1cbd6478b86bc351d26bb33c74deedc8737ebfccc396a95e313199ccbfce",
    extract: { kind: "tgz", member: "jmdict-eng-3.6.2.json", to: "jmdict/jmdict-eng.json" },
  },
  tatoebaIndices: {
    url: "https://downloads.tatoeba.org/exports/jpn_indices.tar.bz2",
    file: "tatoeba/jpn_indices.tar.bz2",
    sha256: "bbb7efdb574ef737b49d07cce699029596ba1c2f21fc27abb593da97010b8dd0",
    extract: { kind: "tbz", member: "jpn_indices.csv", to: "tatoeba/jpn_indices.csv" },
  },
  tatoebaJpn: {
    url: "https://downloads.tatoeba.org/exports/per_language/jpn/jpn_sentences_detailed.tsv.bz2",
    file: "tatoeba/jpn_sentences_detailed.tsv.bz2",
    sha256: "7725f5e04795db081c20d615a66a79780e77df1577c088074bfe72a477dab543",
    extract: { kind: "bz2", to: "tatoeba/jpn_sentences_detailed.tsv" },
  },
  tatoebaEng: {
    url: "https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences_detailed.tsv.bz2",
    file: "tatoeba/eng_sentences_detailed.tsv.bz2",
    sha256: "3a0e7a2fdd7cbad76f226de4c28371a15a2fc4d115001617288b16a35c6293db",
    extract: { kind: "bz2", to: "tatoeba/eng_sentences_detailed.tsv" },
  },
} satisfies Record<string, Source>;
export type SourceName = keyof typeof SOURCES;

async function sha256(file: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(file), hash);
  return hash.digest("hex");
}

const updating = () => process.argv.includes("--update-sources");

/**
 * Makes sure a source is in the cache, checked and extracted, and returns the path of the usable
 * file. Downloads are data only: they are hashed, unpacked by the system tools and parsed, never run.
 */
export async function ensureSource(name: SourceName): Promise<string> {
  const src: Source = SOURCES[name];
  const download = path.join(CACHE, src.file);
  mkdirSync(path.dirname(download), { recursive: true });

  if (!existsSync(download) || (await sha256(download)) !== src.sha256) {
    console.log(`  downloading ${name}…`);
    const res = await fetch(src.url);
    if (!res.ok || !res.body) throw new Error(`Download failed for ${name}: ${res.status} ${src.url}`);
    const tmp = `${download}.part`;
    await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
    const got = await sha256(tmp);
    if (got !== src.sha256) {
      if (!updating()) {
        rmSync(tmp);
        throw new Error(
          `${name} changed upstream (sha256 ${got}). Run with --update-sources to accept it, then commit the new hash in scripts/content/lib/sources.ts.`,
        );
      }
      console.log(`  ${name}: new sha256 ${got}; put it in scripts/content/lib/sources.ts`);
    }
    renameSync(tmp, download);
    if (src.extract) rmSync(path.join(CACHE, src.extract.to), { force: true });
  }

  if (!src.extract) return download;
  const out = path.join(CACHE, src.extract.to);
  if (!existsSync(out)) {
    const dir = path.dirname(out);
    mkdirSync(dir, { recursive: true });
    const { kind, member } = src.extract;
    if (kind === "bz2") {
      execFileSync("sh", ["-c", 'bunzip2 -c -- "$1" > "$2.part" && mv -- "$2.part" "$2"', "sh", download, out]);
    } else {
      // Extract only the one expected member into a fresh folder, then move it into place.
      const tmpDir = path.join(dir, `.extract-${name}`);
      rmSync(tmpDir, { recursive: true, force: true });
      mkdirSync(tmpDir);
      execFileSync("tar", [kind === "tgz" ? "-xzf" : "-xjf", download, "-C", tmpDir, "--", member!]);
      renameSync(path.join(tmpDir, member!), out);
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }
  return out;
}
