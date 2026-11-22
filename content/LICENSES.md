# Data licences and credits

Michi's starter content is built from open data, plus content written for Michi. This page lists
every source, what it's used for and its licence. The app's About page shows the same credits.

## Sources

| Source | Used for | Licence |
|---|---|---|
| [KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project), © Electronic Dictionary Research and Development Group (EDRDG) | Kanji meanings, readings, stroke counts and grades in `kanji.json` and `kanji-info.json` | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| [kanji-data](https://github.com/davidluzgouveia/kanji-data) by David Gouveia (commit `00fd707`) | The KANJIDIC2 and JLPT fields above, in one file. Its WaniKani fields are dropped and never used | [MIT](https://github.com/davidluzgouveia/kanji-data/blob/master/LICENSE) |
| [JLPT lists](http://www.tanos.co.uk/jlpt/) by Jonathan Waller | The JLPT level of each kanji and word | [CC BY](https://creativecommons.org/licenses/by/4.0/) |
| [open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks) by Jamie Sinclair (commit `1ad6673`), from Waller's lists | The N5, N4 and N3 words and their meanings in `words.json` | [MIT](https://github.com/jamsinclair/open-anki-jlpt-decks/blob/main/LICENSE) |
| [JMdict](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project), © EDRDG, through [jmdict-simplified](https://github.com/scriptin/jmdict-simplified) 3.6.2 (release `3.6.2+20261116213322`) | `dictionary.json`; the JMdict id and part of speech of each word; readings for furigana | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| [Tatoeba](https://tatoeba.org) (snapshot of 21 Nov 2026) | Example sentences marked `"source": "tatoeba"` in `words.json` | [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/), credited per sentence (below) |
| [JLPT Sensei](https://jlptsensei.com) and [Bunpro](https://bunpro.jp) | Links from each grammar point, and the list of which points belong to which level | Links only. Titles of grammar points are listed; nothing else is copied |
| Written for Michi | Grammar meanings, N5 grammar examples and quiz questions, speaking prompts, example sentences marked `"source": "michi"`, kanji look-alike groups and resource notes | The Michi project's own |

## Tatoeba credits

Every Tatoeba example keeps its sentence ids and authors:

```json
"tatoeba": { "ja": 4707, "en": 1282, "author": "…", "enAuthor": "…" }
```

The card links each sentence to `https://tatoeba.org/en/sentences/show/<id>`, which names its
author and licence (a few Tatoeba sentences are CC0). Furigana is added when the content is built,
using the sentence's index from the Tatoeba Japanese indices.

## Share-alike

`kanji.json`, `kanji-info.json` and `dictionary.json` are adapted from KANJIDIC2 and JMdict, and
so are the JMdict ids and parts of speech in `words.json`. Those files are shared under the same
licence, CC BY-SA 4.0, with credit to the EDRDG.

## What Michi never uses

Official JLPT questions are never copied or adapted. Tae Kim's guide and WaniKani data aren't used.
JLPT Sensei's and Bunpro's explanations aren't copied; every meaning in `grammar.json` was written
fresh.
