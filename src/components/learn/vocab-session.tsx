"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { bind, unbind } from "wanakana";

import { CardBack } from "@/components/cards/faces";
import { VoiceProvider } from "@/components/ui/voice";
import { SpeakButton } from "@/components/ui/speak-button";
import { Ruby } from "@/components/ui/ruby";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DoneScreen } from "@/components/ui/done-screen";
import { AnswerInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { SessionHeader } from "@/components/ui/session-header";
import { StatGrid, StatTile } from "@/components/ui/stat";
import type { StudyCard } from "@/lib/srs/types";
import { checkJapanese, checkMeaning, type JaWord } from "@/lib/vocab/match";
import type { Direction, Level, VocabWord } from "@/lib/vocab/types";
import type { VoicePrefs } from "@/lib/voice/voices";

import { DIRECTION_LABELS, WaitingLine } from "./vocab-parts";

/** One checked answer. `right` already includes "Count it as right". */
export type Answer = {
  typed: string;
  right: boolean;
  /** Right with a small typo; the meaning it was taken as. */
  typo: string | null;
  /** Wrong but close (a few letters, a shared word, one kana off): said as "Close". */
  near: boolean;
  counted: boolean;
  /** English → Japanese: right as another word with the same meaning. */
  other: (JaWord & { meaning: string }) | null;
  at: string;
};

type Props = {
  level: Level;
  set: VocabWord[];
  direction: Direction;
  furigana: boolean;
  voice: VoicePrefs;
  onAnswer: (word: VocabWord, direction: Direction, answer: Answer, kind: "answer" | "fix") => void;
  /** Go again with these words (the ones missed). */
  onAgain: (set: VocabWord[]) => void;
  onClose: () => void;
};

const hasKanji = (s: string) => /[一-鿿々]/.test(s);

/** The review card's back (faces.tsx) reads a StudyCard; this is a word dressed as one. Practice has no card. */
function asCard(word: VocabWord, level: Level): StudyCard {
  return {
    id: word.id,
    cardType: "recognition",
    state: "new",
    fsrs: null,
    lastReviewId: null,
    reps: 0,
    lapses: 0,
    dueAt: null,
    item: {
      id: word.id,
      kind: "word",
      level,
      term: word.term,
      reading: word.reading,
      meaning: word.meanings.join("; "),
      source: "starter",
      data: { meanings: word.meanings, pos: word.pos, example: word.example },
      context: null,
    },
  };
}

function check(word: VocabWord, direction: Direction, input: string): Answer {
  const at = new Date().toISOString();
  if (direction === "ja_en") {
    const r = checkMeaning(input, word.meanings);
    return { typed: input.trim(), right: r.right, typo: r.typo ? r.matched : null, near: r.near, counted: false, other: null, at };
  }
  const r = checkJapanese(input, word);
  return { typed: r.typed, right: r.right, typo: null, near: r.near, counted: false, other: r.other, at };
}

function progressNote(word: VocabWord, direction: Direction): string {
  const p = word.progress[direction];
  if (!p || p.right + p.wrong === 0) return "new";
  return [p.right && `right ${p.right}×`, p.wrong && `missed ${p.wrong}×`].filter(Boolean).join(" · ");
}

/**
 * One run through a set of words (no board of its own: built from F_ReviewFront/F_ReviewBack and
 * the quick check's typed answer). Type the answer, Enter checks it, Enter again goes on. Full
 * screen on a phone, like a review.
 */
export function VocabSession({ level, set, direction, furigana, voice, onAnswer, onAgain, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<number, Answer>>(new Map());
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [done, setDone] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const word = set[index];
  const answer = answers.get(index) ?? null;
  const ja = direction === "en_ja";

  // Romaji turns into kana as you type (wanakana); a Japanese keyboard works as it is.
  useEffect(() => {
    const el = input.current;
    if (!ja || !el) return;
    bind(el, { IMEMode: true });
    return () => unbind(el);
  }, [ja, done]);

  // Each word starts with the box showing what was typed for it (empty if nothing yet), ready to type.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.value = answers.get(index)?.typed ?? "";
    el.focus({ preventScroll: true });
    // Only when the word changes, not on every answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, done]);

  const go = (to: number) => {
    if (to >= set.length) setDone(true);
    else setIndex(Math.max(0, to));
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (answer) return go(index + 1);
    const typed = input.current?.value ?? "";
    if (!typed.trim()) return;
    record(check(word, direction, typed));
  };

  const record = (a: Answer) => {
    setAnswers((m) => new Map(m).set(index, a));
    setSkipped((s) => {
      const next = new Set(s);
      next.delete(index);
      return next;
    });
    onAnswer(word, direction, a, "answer");
    if (input.current) {
      input.current.value = a.typed;
      // After "I don't know" too, so Enter goes on.
      input.current.focus({ preventScroll: true });
    }
  };

  const dontKnow = () => record({ typed: "", right: false, typo: null, near: false, counted: false, other: null, at: new Date().toISOString() });

  const countIt = () => {
    if (!answer || answer.right) return;
    const fixed = { ...answer, right: true, counted: true, near: false };
    setAnswers((m) => new Map(m).set(index, fixed));
    onAnswer(word, direction, answer, "fix");
    input.current?.focus({ preventScroll: true });
  };

  const skip = () => {
    setSkipped((s) => new Set(s).add(index));
    go(index + 1);
  };

  if (done) {
    return (
      <Summary
        level={level}
        direction={direction}
        set={set}
        answers={answers}
        skipped={skipped.size}
        onAgain={onAgain}
        onClose={onClose}
      />
    );
  }

  const handled = answers.size + skipped.size;
  const ruby = hasKanji(word.term) && word.reading !== word.term;
  const big = [...word.term].length;
  const note = progressNote(word, direction);
  const inputState = !answer ? "idle" : answer.right ? "right" : "wrong";

  return (
    <VoiceProvider prefs={voice}>
      <div className="mx-auto flex w-full max-w-160 flex-col gap-4">
        <SessionHeader
          title={`Vocabulary · ${level}`}
          count={`${index + 1} / ${set.length}`}
          close={{ label: "Stop and see how it went", onClick: () => setDone(true) }}
          progress={{ value: handled, max: set.length, label: `${handled} of ${set.length} done` }}
        />
        <WaitingLine />

        <div className="relative mt-2">
          <div aria-hidden="true" className="absolute inset-x-2.5 top-3 -bottom-3 rotate-2 rounded-card bg-cover-butter" />
          <div aria-hidden="true" className="absolute inset-x-1.5 top-1.75 -bottom-1.75 -rotate-1 rounded-card bg-cover-pink" />
          <article
            aria-label={answer ? `${word.term}, answer` : "The word"}
            className="relative flex flex-col gap-3 rounded-card border-[1.5px] border-line-strong bg-surface px-6 pt-5.5 pb-6 shadow-card"
          >
            <div className="flex flex-wrap justify-end gap-1.5">
              <Chip cover="blue" size="lg">
                {DIRECTION_LABELS[direction]}
              </Chip>
              <Chip cover={note.includes("missed") ? "pink" : "mint"} size="lg">
                {note}
              </Chip>
            </div>
            {answer ? (
              <CardBack card={asCard(word, level)} furigana={furigana} />
            ) : ja ? (
              <div className="flex min-h-45 w-full flex-col items-center justify-center gap-3">
                <p className="m-0 text-center text-headline font-black">{word.meanings.join("; ")}</p>
                <p className="m-0 text-center text-meta text-ink2">Type it in Japanese: kana, kanji or romaji.</p>
              </div>
            ) : (
              <div className="flex min-h-45 w-full flex-col items-center justify-center gap-4">
                <p className={`m-0 text-center font-ja leading-snug font-semibold ${big <= 4 ? "text-kana" : big <= 7 ? "text-display" : "text-headline"}`}>
                  <Ruby text={ruby ? `{${word.term}|${word.reading}}` : word.term} furigana={furigana} />
                </p>
                <SpeakButton text={word.reading} label="Play it" />
              </div>
            )}
          </article>
        </div>

        <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
          <label htmlFor="vocab-answer" className="text-meta font-bold">
            {ja ? "Type the word" : "Type the meaning"}
          </label>
          <AnswerInput
            // AnswerInput passes every prop to its <input>, ref included (React 19); its type just doesn't list ref yet.
            {...({ ref: input } as object)}
            id="vocab-answer"
            key={direction}
            type="text"
            lang={ja ? "ja" : "en"}
            ja={ja}
            state={inputState}
            readOnly={!!answer}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint={answer ? "next" : "done"}
            aria-describedby="vocab-result"
          />
          <div id="vocab-result" role="status" className="flex flex-col gap-1 empty:hidden">
            {answer && <Result word={word} answer={answer} ja={ja} />}
          </div>
          {/*
            Japanese → English: under any typed answer, since English has synonyms no list holds ("autumn"
            for "fall"). English → Japanese already takes every form and same-meaning word: near misses only.
          */}
          {answer && !answer.right && answer.typed && (!ja || answer.near) && (
            <Button variant="secondary" size="sm" onClick={countIt} className="self-start">
              Count it as right
            </Button>
          )}
          <Button type="submit" size="lg" full iconEnd={answer ? "arrow-right" : undefined} className="mt-1">
            {answer ? (index + 1 < set.length ? "Next" : "Finish") : "Check"}
          </Button>
        </form>

        <div className="grid grid-cols-3 items-center gap-2">
          <Button variant="text" size="sm" icon="chevron-left" onClick={() => go(index - 1)} disabled={index === 0} className="justify-self-start">
            Back
          </Button>
          {answer ? (
            <span />
          ) : (
            <Button variant="secondary" size="sm" onClick={dontKnow}>
              I don&apos;t know
            </Button>
          )}
          {answer ? (
            <span />
          ) : (
            <Button variant="text" size="sm" iconEnd="chevron-right" onClick={skip} className="justify-self-end">
              Skip
            </Button>
          )}
        </div>
        <p className="m-0 text-center text-meta text-ink2 max-laptop:hidden">Enter checks your answer · Enter again goes to the next word</p>
        <p className="m-0 text-center text-meta text-ink2 laptop:hidden">Practice keeps its own counts. It doesn&apos;t change your reviews.</p>
      </div>
    </VoiceProvider>
  );
}

function Mark({ right }: { right: boolean }) {
  return <Icon name={right ? "check" : "close"} size={20} stroke={2.4} />;
}

/** Right or wrong, with the right answer. */
function Result({ word, answer, ja }: { word: VocabWord; answer: Answer; ja: boolean }) {
  const written = word.term !== word.reading ? `${word.term} (${word.reading})` : word.term;
  if (answer.right) {
    return (
      <>
        <p className="m-0 flex items-center gap-1.5 text-body font-bold text-good">
          <Mark right />
          {answer.counted ? "Counted as right" : answer.typo ? "Right, with a small typo" : "Right"}
        </p>
        {answer.typo && (
          <p className="m-0 text-meta text-ink2">
            It&apos;s spelled &ldquo;{answer.typo}&rdquo;.
          </p>
        )}
        {answer.other && (
          <p className="m-0 text-meta text-ink2">
            <span lang="ja" className="font-bold text-ink">
              {answer.other.term !== answer.other.reading ? `${answer.other.term} (${answer.other.reading})` : answer.other.term}
            </span>{" "}
            means {answer.other.meaning} too. This card&apos;s word is{" "}
            <span lang="ja" className="font-bold text-ink">
              {written}
            </span>
            .
          </p>
        )}
      </>
    );
  }
  return (
    <>
      <p className="m-0 flex items-center gap-1.5 text-body font-bold text-again">
        <Mark right={false} />
        {!answer.typed ? "Here it is" : answer.near ? "Close, but not quite" : "Not this time"}
      </p>
      <p className="m-0 text-body">
        {ja ? (
          <>
            It&apos;s{" "}
            <span lang="ja" className="font-bold">
              {written}
            </span>
            .
          </>
        ) : (
          <>It means {word.meanings.join("; ")}.</>
        )}
      </p>
    </>
  );
}

function Summary({
  level,
  direction,
  set,
  answers,
  skipped,
  onAgain,
  onClose,
}: {
  level: Level;
  direction: Direction;
  set: VocabWord[];
  answers: Map<number, Answer>;
  skipped: number;
  onAgain: (set: VocabWord[]) => void;
  onClose: () => void;
}) {
  const missed = [...answers].filter(([, a]) => !a.right).map(([i]) => set[i]);
  const right = answers.size - missed.length;
  return (
    <div className="mx-auto flex w-full max-w-160 flex-col gap-2">
      <SessionHeader title={`Vocabulary · ${level}`} count={DIRECTION_LABELS[direction]} close={{ label: "Pick another set", onClick: onClose }} />
      <DoneScreen
        title={answers.size === 0 ? "Nothing answered" : `${answers.size} of ${set.length} ${set.length === 1 ? "word" : "words"} typed`}
        stats={
          <StatGrid cols={3}>
            <StatTile value={right} label="right" tone="good" size="lg" />
            <StatTile value={missed.length} label="missed" tone="again" size="lg" />
            <StatTile value={skipped} label="skipped" size="lg" />
          </StatGrid>
        }
        actions={
          <>
            {missed.length > 0 && (
              <Button size="lg" full onClick={() => onAgain(missed)}>
                Go again with the {missed.length} missed
              </Button>
            )}
            <Button variant={missed.length > 0 ? "secondary" : "primary"} size="lg" full onClick={onClose}>
              Pick another set
            </Button>
          </>
        }
      >
        Practice keeps its own counts. It doesn&apos;t change your reviews.
      </DoneScreen>
      {missed.length > 0 && (
        <section aria-labelledby="vocab-missed" className="flex flex-col gap-2">
          <h2 id="vocab-missed" className="m-0 text-lead font-bold">
            Missed
          </h2>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {missed.map((w) => (
              <li key={w.id} className="inline-flex items-baseline gap-1.5 rounded-pill border-[1.5px] border-line bg-surface px-3 py-1.5 text-meta">
                <span lang="ja" className="font-ja text-body font-semibold">
                  {w.term}
                </span>
                <span className="text-ink2">{w.meanings[0]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <WaitingLine />
    </div>
  );
}
