"use client";

import { toPlain } from "@content/schema";

import { Ruby } from "@/components/ruby";
import type { StudyCard } from "@/lib/srs/types";

import { PlayPill, PlayRound } from "./voice";

/**
 * The front and back of every card (the plan's Screens 2; boards F_ReviewFront, F_ReviewBack and
 * F_ReviewWeb). The big Japanese uses --font-card; every card can be heard.
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

/** Japanese with ruby markup, said with its readings so the voice can't misread a kanji. */
const spoken = (ja: string) => toPlain(ja.replace(/\{([^{}|]+)\|([^{}|]+)\}/g, "$2"));

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

function bigSize(term: string): string {
  const n = [...term].length;
  return n <= 2 ? "text-[96px]" : n <= 4 ? "text-[72px]" : n <= 6 ? "text-[56px]" : "text-[40px]";
}

function Divider() {
  return <div className="h-px w-full shrink-0 bg-line" />;
}

function Meaning({ children }: { children: string }) {
  return <p className="m-0 text-center font-head text-[26px] leading-tight laptop:text-[28px]">{children}</p>;
}

function Hint({ children }: { children: string }) {
  return <p className="m-0 text-center text-sm text-ink2">{children}</p>;
}

/** An example sentence with its translation and credit (F_ReviewBack). */
function ExampleBlock({ ex, furigana }: { ex: Example | { ja: string; en: string }; furigana: boolean }) {
  const tatoebaId = "tatoebaId" in ex ? ex.tatoebaId : null;
  return (
    <div className="flex w-full flex-col gap-1.5">
      <p className="m-0 font-card text-[22px] leading-[1.9] laptop:text-2xl">
        <Ruby text={ex.ja} furigana={furigana} />
      </p>
      {ex.en && <p className="m-0 text-sm text-ink2 laptop:text-[15px]">{ex.en}</p>}
      {tatoebaId && (
        <p className="m-0 text-[11.5px] text-ink2 laptop:text-xs">
          Example from{" "}
          <a href={`https://tatoeba.org/en/sentences/show/${tatoebaId}`} target="_blank" rel="noreferrer">
            Tatoeba
          </a>{" "}
          (CC BY 2.0 FR)
        </p>
      )}
    </div>
  );
}

/** "Where I met it": the class or immersion sentence the item came from. */
function Context({ card, furigana }: FaceProps) {
  const ctx = card.item.context;
  if (!ctx) return null;
  return (
    <div className="flex w-full flex-col gap-1 rounded-[14px] bg-surface2 px-3 py-2.5">
      <p className="m-0 text-xs font-semibold text-ink2">Where you met it</p>
      <p className="m-0 font-card text-lg leading-[1.8]">
        <Ruby text={ctx.ja} furigana={furigana} />
      </p>
      {ctx.en && <p className="m-0 text-[13px] text-ink2">{ctx.en}</p>}
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
      <div className="flex w-full flex-auto flex-col items-center justify-center gap-5">
        {ex ? (
          <>
            <p className="m-0 text-center font-card text-[26px] leading-[1.9] laptop:text-[28px]">
              <Ruby text={ex.ja} furigana={furigana} blank="hide" />
            </p>
            <p className="m-0 text-center text-[15px] text-ink2">{ex.en}</p>
          </>
        ) : (
          <p lang="ja" className="m-0 text-center font-head text-[26px]">
            {item.term}
          </p>
        )}
        <Hint>Say the missing part, then show the answer.</Hint>
      </div>
    );
  }
  if (card.cardType === "production") {
    return (
      <div className="flex w-full flex-auto flex-col items-center justify-center gap-5">
        <Meaning>{item.meaning}</Meaning>
        <Hint>Say it in Japanese, then show the answer.</Hint>
      </div>
    );
  }
  const hint =
    item.kind === "kana"
      ? "Say its sound, then show the answer."
      : item.kind === "kanji"
        ? "Say what it means, then show the answer."
        : "Say the reading and meaning, then show the answer.";
  return (
    <div className="flex w-full flex-auto flex-col items-center justify-center gap-[22px]">
      <p lang="ja" className={`m-0 text-center font-card font-semibold leading-[1.1] ${bigSize(item.term)}`}>
        {item.term}
      </p>
      {item.kind !== "kanji" && (
        <PlayRound text={item.kind === "kana" ? item.term : item.reading || item.term} label="Play it" />
      )}
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
    <div className="flex w-full flex-col items-center gap-3">
      <p lang="ja" className="m-0 mt-1.5 font-card text-[72px] font-semibold leading-[1.15]">
        {item.term}
      </p>
      <Meaning>{item.reading ?? ""}</Meaning>
      <PlayPill text={item.term}>Sound</PlayPill>
      {ex && (
        <>
          <Divider />
          <div className="flex w-full flex-col items-center gap-1.5">
            <p className="m-0 font-card text-[26px] leading-[1.8]">
              <Ruby text={hasKanji(ex.term) ? `{${ex.term}|${ex.reading}}` : ex.term} furigana={furigana} />
            </p>
            <p className="m-0 text-sm text-ink2">{ex.meaning}</p>
            <PlayPill text={ex.reading || ex.term}>Word</PlayPill>
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
    <div className="flex w-full flex-col items-center gap-3">
      <p lang="ja" className="m-0 mt-1.5 font-card text-[72px] font-semibold leading-[1.15]">
        {item.term}
      </p>
      <Meaning>{item.meaning}</Meaning>
      <dl className="m-0 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 text-sm">
        {on.length > 0 && (
          <>
            <dt className="text-xs font-semibold text-ink2">On</dt>
            <dd lang="ja" className="m-0 text-base">
              {on.join("・")}
            </dd>
          </>
        )}
        {kun.length > 0 && (
          <>
            <dt className="text-xs font-semibold text-ink2">Kun</dt>
            <dd lang="ja" className="m-0 text-base">
              {kun.join("・")}
            </dd>
          </>
        )}
        {strokes && (
          <>
            <dt className="text-xs font-semibold text-ink2">Strokes</dt>
            <dd className="m-0">{strokes}</dd>
          </>
        )}
      </dl>
      {examples.length > 0 && (
        <>
          <Divider />
          <ul className="m-0 flex w-full list-none flex-col gap-2 p-0">
            {examples.map((w) => (
              <li key={w.term} className="flex items-center gap-3">
                <span className="flex min-w-0 flex-auto flex-col">
                  <span className="font-card text-[22px] leading-[1.8]">
                    <Ruby text={`{${w.term}|${w.reading}}`} />
                  </span>
                  <span className="text-sm text-ink2">{w.meaning}</span>
                </span>
                <PlayPill text={w.reading} lang="ja">
                  {w.term}
                </PlayPill>
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
  const ruby = reading && hasKanji(item.term) && reading !== item.term;
  const pos = strings(item.data.pos)
    .map((p) => POS_LABELS[p])
    .filter(Boolean);
  const ex = example(item.data.example);
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <p className={`m-0 mt-1.5 text-center font-card font-semibold leading-[1.25] ${[...item.term].length > 4 ? "text-5xl" : "text-[64px] laptop:text-[72px]"}`}>
        <Ruby text={ruby ? `{${item.term}|${reading}}` : item.term} furigana={furigana} />
      </p>
      {ruby && !furigana && (
        <p lang="ja" className="m-0 text-xl text-ink2">
          {reading}
        </p>
      )}
      <Meaning>{item.meaning}</Meaning>
      {pos.length > 0 && (
        <p lang="ja" className="m-0 text-center text-[13px] text-ink2 laptop:text-sm">
          {pos.join(" · ")}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <PlayPill text={reading || item.term}>Word</PlayPill>
        {ex && <PlayPill text={spoken(ex.ja)}>Sentence</PlayPill>}
      </div>
      {ex && (
        <>
          <Divider />
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
    <div className="flex w-full flex-col items-center gap-3">
      <p lang="ja" className="m-0 mt-1.5 text-center font-head text-[26px] leading-tight laptop:text-[28px]">
        {item.term}
      </p>
      <p className="m-0 text-center text-[15px]">{item.meaning}</p>
      {ex && (
        <>
          <Divider />
          <ExampleBlock ex={ex} furigana={furigana} />
          <PlayPill text={spoken(ex.ja)}>Sentence</PlayPill>
        </>
      )}
      <Context card={card} furigana={furigana} />
    </div>
  );
}
