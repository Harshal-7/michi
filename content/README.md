# Content

Michi's starter content: kana, kanji, words with example sentences, a dictionary for auto-fill,
grammar points, resources and speaking prompts.

- `schema.ts` is the contract between the content pipeline (`scripts/content/`) and the app's seed
  runner. Both import it. Adding an optional field is safe; renaming or removing one breaks the seed.
- `generated/*.json` is built by the pipeline and committed: one array per file, matched to the
  database by each record's key (`CONTENT_KEYS`). Keys are stable across rebuilds.
- `source/*.json` holds the committed inputs that aren't downloaded: everything written for Michi,
  and the checked link tables.
- `LICENSES.md` lists every source, its licence and how it's credited.

## What's in it

| File | Records | From |
|---|---|---|
| `kana.json` | 104 hiragana, 124 katakana | generated: Hepburn romaji, other accepted typings, look-alikes, an N5 example word |
| `kanji.json` | N5 80, N4 166, N3 367 | KANJIDIC2 through kanji-data, JLPT levels from Waller's lists; 1–2 example words from the word lists, look-alikes from `source/kanji-lookalikes.json` |
| `kanji-info.json` | 2,136 jōyō kanji | KANJIDIC2 through kanji-data |
| `words.json` | N5 718, N4 667, N3 2,137 | open-anki-jlpt-decks, matched to JMdict for `jmdictId` and part of speech; one example sentence each where one fits (every N5 word has one) |
| `dictionary.json` | 22,661 | JMdict common words (jmdict-simplified 3.6.2) |
| `grammar.json` | N5 84, N4 132, N3 182 | JLPT Sensei's level lists, links checked; meanings written fresh; N5 points have 3–4 fill-in examples, 2 quiz questions and confusables |
| `resources.json` | 45 | `source/resources.json`, each link checked |
| `prompts.json` | N5 40, N4 40 | `source/prompts.json` |

The word lists give 668 N4 and 2,140 N3 words. Four of them repeat a word from a lower level and
stay at the lower level only: N4 そう, N3 在る; 有る, N3 運転 and N3 河.

## Commands

```bash
pnpm content:build
```

Downloads the pinned sources into `scripts/content/.cache/` (ignored by git), builds
`generated/*.json`, checks everything with zod and the rules below, and writes the files only when
every check passes. `--force` writes anyway, for work in progress. A full build takes about 20
seconds once the sources are cached.

```bash
pnpm content:links
```

Reads JLPT Sensei's grammar lists and Bunpro's index, opens every grammar and resource link one at
a time, and writes `source/grammar-links.json` and `source/resource-links.json`. It takes about ten
minutes. `--skip-check` reuses earlier results for links that already passed, and `--pause <ms>`
slows it down. It refuses to write a table if a list page comes back short. When a site answers
scripted requests with errors but loads in a browser, links confirmed by opening them in a browser
are listed under `browserChecked` (90 JLPT Sensei pages on 21 Nov 2026).

```bash
pnpm content:check-writing content/source/prompts.json
```

The quick loop while writing Japanese by hand: ruby, blanks, kana readings, the kanji level and
wrong options.

## Rules the build checks

- The counts above, unique keys, and no word at two levels.
- Every word has a reading, a meaning and a part of speech; every N5 word has an example.
- Every N5 grammar point has at least 3 examples and 2 questions, each with exactly one `[[blank]]`,
  and no wrong option equals the answer.
- Ruby on every run of kanji, with kana-only readings. Hand-written Japanese uses only kanji at its
  level (the level's kanji and those in its words, plus 願 for お願いします). Readings that neither
  KANJIDIC2 nor JMdict explains are printed as warnings to look at.
- Every grammar link is in the checked table, and every resource passed the link check.

## Editing content

- **Grammar:** N5 points are in `source/grammar-n5-a.json`, `-b` and `-c` (by list position); N4 and
  N3 patterns and meanings are in `source/grammar-meanings.json`. Slugs come from the link table, so
  run `pnpm content:links` first if JLPT Sensei's lists change.
- **Prompts** and **resources:** `source/prompts.json`, `source/resources.json`. Rerun the link check
  after adding a resource.
- **Example sentences:** `source/word-examples.json` holds sentences written for Michi, keyed by word
  slug. They win over the automatic Tatoeba match, so this is also how to replace a Tatoeba sentence
  that reads badly.
- Write Japanese in ruby markup: `{食|た}べる`, one group per word. Blanks: `[[から]]`.

## How the examples are chosen

Each word gets the best sentence from Tatoeba's Japanese indices (the checked sentences that link
Japanese to English): one where the word is marked as a good example, short, mostly made of words at
the word's level or below, not used for another word, and clear of a list of unsuitable topics.
Furigana comes from the sentence's index line, which gives each word's dictionary form and reading;
where a reading can't be settled with confidence, the sentence is skipped rather than guessed.

## Sources and versions

`scripts/content/lib/sources.ts` pins every download by URL and SHA-256: kanji-data and the word
decks by commit, jmdict-simplified by release, and Tatoeba by the weekly snapshot of 21 Nov 2026.
Tatoeba keeps only its latest snapshot, so a fresh checkout can't fetch that exact one. In that case
run `pnpm content:build --update-sources`, review the changes in `generated/`, and commit the new
hashes it prints.
