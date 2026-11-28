"use client";

import { Chip } from "@/components/ui/chip";
import { Ruby } from "@/components/ui/ruby";
import { SpeakButton } from "@/components/ui/speak-button";
import type { StudyCard } from "@/lib/srs/types";
import { spoken } from "@/lib/voice/spoken";

import { Rule } from "./notebook";

/**
 * The front and back of every card (RF_ReviewFront, RF_ReviewBack): the Japanese in Klee One, the
 * textbook pencil hand, on B's ruled notebook card. Every card can be heard.
 */

type FaceProps = { card: StudyCard; furigana: boolean };

// ---------------------------------------------------------------------------
// Reading the item's data (src/lib/items/data.ts); items you added yourself may lack fields.

type MiniWord = { term: string; reading: string; meaning: string };
type Example = { ja: string; en: string; tatoebaId: number | null };

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown): string => (typeof v === "string" ? v : "");
const strings = (v: unknown): string[] => list(v).filter((s): s is string => typeof s === "string" && s !== "");

function miniWord(v: unknown): MiniWord | null {
  const o = (v ?? {}) as Record<string, unknown>;
  return text(o.term) ? { term: text(o.term), reading: text(o.reading), meaning: text(o.meaning) } : null;
}

function example(v: unknown): Example | null {
  const o = (v ?? {}) as Record<string, unknown>;
  if (!text(o.ja)) return null;
  const tatoeba = (o.tatoeba ?? {}) as Record<string, unknown>;
  return { ja: text(o.ja), en: text(o.en), tatoebaId: o.source === "tatoeba" && typeof tatoeba.ja === "number" ? tatoeba.ja : null };
}


/** The grammar example this review shows: the next one each time. */
export function grammarExample(card: StudyCard): { ja: string; en: string } | null {
  const examples = list(card.item.data.examples).map(example).filter((e): e is Example => e !== null);
  return examples.length ? examples[card.reps % examples.length] : null;
}

const POS_LABELS: Record<string, string> = {
  noun: "noun",
  pronoun: "pronoun",
  "verb-ichidan": "る verb",
  "verb-godan": "う verb",
  "verb-suru": "する verb",
  "verb-kuru": "くる verb",
  "verb-other": "verb",
  "i-adj": "い adjective",
  "na-adj": "な adjective",
  "no-adj": "の adjective",
  adverb: "adverb",
  particle: "particle",
  conjunction: "conjunction",
  counter: "counter",
  numeric: "number",
  prefix: "prefix",
  suffix: "suffix",
  auxiliary: "auxiliary",
  expression: "expression",
  interjection: "interjection",
};

const hasKanji = (s: string) => /[一-鿿々]/.test(s);

// ---------------------------------------------------------------------------
// Shared pieces

/** "Word · N5 · seen 4 times", the line at the top of a card. */
export function cardLabel(card: StudyCard): string {
  const { item } = card;
  const kind =
    item.kind === "kana"
      ? text(item.data.script) === "katakana"
        ? "Katakana"
        : "Hiragana"
      : item.kind === "kanji"
        ? "Kanji"
        : item.kind === "grammar"
          ? "Grammar"
          : item.kind === "phrase"
            ? "Phrase"
            : card.cardType === "production"
              ? "Word · meaning first"
              : "Word";
  const seen = card.reps === 0 ? "new" : card.reps === 1 ? "seen once" : `seen ${card.reps} times`;
  return [kind, item.level, seen].filter(Boolean).join(" · ");
}


/** The card's chip: "Word · N5", "Kanji · N5", "Hiragana". */
export function cardKind(card: StudyCard): string {
  return cardLabel(card).split(" · ").filter((p) => !/^(new|seen )/.test(p)).join(" · ");
}

/** "new", "seen once", "seen 4 times". */
export function cardSeen(card: StudyCard): string {
  return card.reps === 0 ? "new" : card.reps === 1 ? "seen once" : `seen ${card.reps} times`;
}

/** The big Japanese on a front: 72 for a short word, 40 for a long one. */
function bigSize(term: string): string {
  return [...term].length <= 4 ? "text-kana tracking-wide" : "text-display tracking-wide";
}

/** "い adjective" with the kana marked Japanese. */
function PosLabel({ text: label }: { text: string }) {
  const m = /^(\S+) (.+)$/.exec(label);
  if (!m || /^[\x00-\x7f]+$/.test(m[1])) return <>{label}</>;
  return (
    <>
      <span lang="ja">{m[1]}</span>&nbsp;{m[2]}
    </>
  );
}

/** The English meaning, 28/900. */
function Meaning({ children, center = false }: { children: string; center?: boolean }) {
  return <p className={`m-0 text-headline font-black ${center ? "text-center" : ""}`}>{children}</p>;
}

function Hint({ children }: { children: string }) {
  return <p className="m-0 max-w-65 text-center text-body text-ink2">{children}</p>;
}

/** The Japanese headword with its reading under it and the play button on the right (RF_ReviewBack). */
function Head({ term, reading, say, size = "text-display" }: { term: string; reading?: string | null; say: string; size?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p lang="ja" className={`m-0 font-ja tracking-wide ${size}`}>
          {term}
        </p>
        {reading && (
          <p lang="ja" className="m-0 font-ja text-title tracking-wide text-ink2">
            {reading}
          </p>
        )}
      </div>
      <SpeakButton variant="round-sm" text={say} label="Play the word" />
    </div>
  );
}

/** An example sentence with its translation, play button and credit (RF_ReviewBack). */
function ExampleBlock({ ex, furigana }: { ex: Example | { ja: string; en: string }; furigana: boolean }) {
  const tatoebaId = "tatoebaId" in ex ? ex.tatoebaId : null;
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="m-0 font-ja text-title leading-ja">
          <Ruby text={ex.ja} furigana={furigana} />
        </p>
        {ex.en && <p className="m-0 mt-0.5 text-body text-ink2">{ex.en}</p>}
        {tatoebaId && (
          <p className="m-0 mt-1 text-caption text-ink2">
            Example from{" "}
            <a href={`https://tatoeba.org/en/sentences/show/${tatoebaId}`} target="_blank" rel="noreferrer" className="text-ink2 underline">
              Tatoeba
            </a>{" "}
            (CC BY 2.0 FR)
          </p>
        )}
      </div>
      <div className="mt-2.5">
        <SpeakButton variant="icon" text={spoken(ex.ja)} label="Play the example" />
      </div>
    </div>
  );
}

/** "Where you met it": the class or immersion sentence the item came from. */
function Context({ card, furigana }: FaceProps) {
  const ctx = card.item.context;
  if (!ctx) return null;
  return (
    <div className="mt-4 flex flex-col gap-1 rounded-btn bg-surface2 px-3.5 py-3">
      <p className="m-0 text-caption font-bold text-ink2">Where you met it</p>
      <p className="m-0 font-ja text-lead leading-ja">
        <Ruby text={ctx.ja} furigana={furigana} />
      </p>
      {ctx.en && <p className="m-0 text-meta text-ink2">{ctx.en}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fronts

export function CardFront({ card, furigana }: FaceProps) {
  const { item } = card;
  if (item.kind === "grammar") {
    const ex = grammarExample(card);
    return (
      <div className="flex w-full flex-auto flex-col items-center justify-center gap-5 py-4">
        {ex ? (
          <>
            <p className="m-0 text-center font-ja text-headline leading-ja">
              <Ruby text={ex.ja} furigana={furigana} blank="hide" />
            </p>
            <p className="m-0 text-center text-body text-ink2">{ex.en}</p>
          </>
        ) : (
          <p lang="ja" className="m-0 text-center font-ja text-headline">
            {item.term}
          </p>
        )}
        <Hint>Say the missing part, then show the answer</Hint>
      </div>
    );
  }
  if (card.cardType === "production") {
    return (
      <div className="flex w-full flex-auto flex-col items-center justify-center gap-5 py-4">
        <Meaning center>{item.meaning}</Meaning>
        <Hint>Say it in Japanese, then show the answer</Hint>
      </div>
    );
  }
  const hint =
    item.kind === "kana"
      ? "Say its sound, then show the answer"
      : item.kind === "kanji"
        ? "Say what it means, then show the answer"
        : "Say the reading and the meaning, then show the answer";
  return (
    <div className="flex w-full flex-auto flex-col items-center justify-center gap-6 py-4">
      <p lang="ja" className={`m-0 text-center font-ja ${bigSize(item.term)}`}>
        {item.term}
      </p>
      {item.kind !== "kanji" && <SpeakButton text={item.kind === "kana" ? item.term : item.reading || item.term} label="Play the word" />}
      <Hint>{hint}</Hint>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backs

export function CardBack(props: FaceProps) {
  switch (props.card.item.kind) {
    case "kana":
      return <KanaBack {...props} />;
    case "kanji":
      return <KanjiBack {...props} />;
    case "grammar":
      return <GrammarBack {...props} />;
    default:
      return <WordBack {...props} />;
  }
}

function KanaBack({ card, furigana }: FaceProps) {
  const { item } = card;
  const ex = miniWord(item.data.example);
  return (
    <div className="flex w-full flex-col pt-2">
      <Head term={item.term} say={item.term} size="text-kana" />
      <Rule className="mt-3 mb-4" />
      <Meaning>{item.reading ?? ""}</Meaning>
      {ex && (
        <>
          <Rule className="mt-4.5 mb-3" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 font-ja text-title leading-ja">
                <Ruby text={hasKanji(ex.term) ? `{${ex.term}|${ex.reading}}` : ex.term} furigana={furigana} />
              </p>
              <p className="m-0 text-body text-ink2">{ex.meaning}</p>
            </div>
            <div className="mt-2.5">
              <SpeakButton variant="icon" text={ex.reading || ex.term} label="Play the example word" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function KanjiBack({ card }: FaceProps) {
  const { item } = card;
  const on = strings(item.data.on);
  const kun = strings(item.data.kun).map((k) => k.replace(/^-|-$/g, ""));
  const strokes = typeof item.data.strokes === "number" ? item.data.strokes : null;
  const examples = list(item.data.examples)
    .map(miniWord)
    .filter((w): w is MiniWord => w !== null)
    .slice(0, 2);
  return (
    <div className="flex w-full flex-col pt-2">
      <div className="flex items-end justify-between gap-4">
        <p lang="ja" className="m-0 font-ja text-kana">
          {item.term}
        </p>
        <dl className="m-0 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 pb-2">
          {on.length > 0 && (
            <>
              <dt className="text-caption font-bold text-ink2">On</dt>
              <dd lang="ja" className="m-0 font-ja text-lead">
                {on.join("・")}
              </dd>
            </>
          )}
          {kun.length > 0 && (
            <>
              <dt className="text-caption font-bold text-ink2">Kun</dt>
              <dd lang="ja" className="m-0 font-ja text-lead">
                {kun.join("・")}
              </dd>
            </>
          )}
          {strokes && (
            <>
              <dt className="text-caption font-bold text-ink2">Strokes</dt>
              <dd className="m-0 text-meta">{strokes}</dd>
            </>
          )}
        </dl>
      </div>
      <Rule className="mt-3 mb-4" />
      <Meaning>{item.meaning}</Meaning>
      {examples.length > 0 && (
        <>
          <Rule className="mt-4.5 mb-2" />
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {examples.map((w) => (
              <li key={w.term} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 flex-col">
                  <span className="font-ja text-title leading-ja">
                    <Ruby text={`{${w.term}|${w.reading}}`} />
                  </span>
                  <span className="text-body text-ink2">{w.meaning}</span>
                </span>
                <SpeakButton variant="icon" text={w.reading} label={`Play ${w.reading}`} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function WordBack({ card, furigana }: FaceProps) {
  const { item } = card;
  const reading = item.reading ?? "";
  const showReading = reading && reading !== item.term;
  const pos = strings(item.data.pos)
    .map((p) => POS_LABELS[p])
    .filter(Boolean);
  const ex = example(item.data.example);
  return (
    <div className="flex w-full flex-col pt-2">
      <Head
        term={item.term}
        reading={showReading ? reading : null}
        say={reading || item.term}
        size={[...item.term].length > 5 ? "text-headline" : "text-display"}
      />
      <Rule className="mt-4.5 mb-4" />
      <Meaning>{item.meaning}</Meaning>
      {pos.length > 0 && (
        <p className="m-0 mt-1.5 flex flex-wrap items-center gap-2.5">
          {pos.map((p) => (
            <Chip key={p} cover="mint">
              <PosLabel text={p} />
            </Chip>
          ))}
        </p>
      )}
      {ex && (
        <>
          <Rule className="mt-4.5 mb-3" />
          <ExampleBlock ex={ex} furigana={furigana} />
        </>
      )}
      <Context card={card} furigana={furigana} />
    </div>
  );
}

function GrammarBack({ card, furigana }: FaceProps) {
  const { item } = card;
  const ex = grammarExample(card);
  return (
    <div className="flex w-full flex-col pt-2">
      <p lang="ja" className="m-0 font-ja text-headline">
        {item.term}
      </p>
      <p className="m-0 mt-1 text-lead font-bold">{item.meaning}</p>
      {ex && (
        <>
          <Rule className="mt-4.5 mb-3" />
          <ExampleBlock ex={ex} furigana={furigana} />
        </>
      )}
      <Context card={card} furigana={furigana} />
    </div>
  );
}
