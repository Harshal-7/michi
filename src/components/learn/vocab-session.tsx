"use client";
// design-lint: legacy

import { type FormEvent, useEffect, useRef, useState } from "react";
import { bind, unbind } from "wanakana";

import { CardBack } from "@/components/cards/faces";
import { VoiceProvider } from "@/components/ui/voice";
import { SpeakButton } from "@/components/ui/speak-button";
import { Ruby } from "@/components/ui/ruby";
import { Icon } from "@/components/ui/icon";
import type { StudyCard } from "@/lib/srs/types";
import { checkJapanese, checkMeaning, type JaWord } from "@/lib/vocab/match";
import type { Direction, Level, VocabWord } from "@/lib/vocab/types";
import type { VoicePrefs } from "@/lib/voice/voices";

import { DIRECTION_LABELS, WaitingLine } from "./vocab-parts";

const X_ICON = "M6 6l12 12 M18 6L6 18";
const CHECK = "M5 12.5l4.5 4.5L19 7.5";
const CROSS = "M7 7l10 10 M17 7L7 17";

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

  return (
    <VoiceProvider prefs={voice}>
      <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-page laptop:static laptop:z-auto laptop:overflow-visible laptop:bg-transparent">
        <header className="flex shrink-0 flex-col gap-2.5 px-3 pt-[max(12px,env(safe-area-inset-top))] pb-2 laptop:px-0 laptop:pt-0">
          <div className="flex items-center justify-between gap-2">
            <button type="button" aria-label="Stop and see how it went" onClick={() => setDone(true)} className="inline-flex size-11 items-center justify-center rounded-btn text-ink2">
              <Icon d={X_ICON} size={22} stroke={1.8} />
            </button>
            <p className="m-0 truncate text-[15px] font-bold">
              Vocabulary · {level} · {ja ? "EN → JA" : "JA → EN"}
            </p>
            <p className="m-0 min-w-11 text-right text-[13px] text-ink2">
              {index + 1} / {set.length}
            </p>
          </div>
          <div role="img" aria-label={`${handled} of ${set.length} done`} className="mx-1.5 h-1 overflow-hidden rounded-full bg-track">
            <div className="h-full bg-accent" style={{ width: `${(handled / set.length) * 100}%` }} />
          </div>
          <WaitingLine />
        </header>

        <div className="mx-auto flex w-full max-w-[640px] flex-auto flex-col gap-3.5 px-4 pt-1 pb-[max(18px,env(safe-area-inset-bottom))] laptop:px-0">
          <article className="flex shrink-0 flex-col items-center gap-3 rounded-card bg-surface p-[18px] shadow-card laptop:px-7 laptop:py-6">
            <p className="m-0 self-start text-xs font-semibold text-ink2 laptop:text-[12.5px]">
              {DIRECTION_LABELS[direction]} · {level} · {progressNote(word, direction)}
            </p>
            {answer ? (
              <CardBack card={asCard(word, level)} furigana={furigana} />
            ) : ja ? (
              <div className="flex min-h-[180px] w-full flex-col items-center justify-center gap-3">
                <p className="m-0 text-center font-head text-[26px] leading-tight laptop:text-[28px]">{word.meanings.join("; ")}</p>
                <p className="m-0 text-center text-sm text-ink2">Type it in Japanese: kana, kanji or romaji.</p>
              </div>
            ) : (
              <div className="flex min-h-[180px] w-full flex-col items-center justify-center gap-4">
                <p className={`m-0 text-center font-card font-semibold leading-[1.25] ${big <= 2 ? "text-[72px]" : big <= 4 ? "text-[60px]" : big <= 6 ? "text-[48px]" : "text-[36px]"}`}>
                  <Ruby text={ruby ? `{${word.term}|${word.reading}}` : word.term} furigana={furigana} />
                </p>
                <SpeakButton text={word.reading} label="Play it" />
              </div>
            )}
          </article>

          <form onSubmit={submit} className="flex flex-col gap-2">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink2">
              {ja ? "Type the word" : "Type the meaning"}
              <input
                ref={input}
                key={direction}
                type="text"
                lang={ja ? "ja" : "en"}
                readOnly={!!answer}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint={answer ? "next" : "done"}
                aria-describedby="vocab-result"
                className={`box-border min-h-[54px] rounded-btn border-2 bg-surface px-4 text-[20px] font-bold text-ink outline-none ${
                  !answer ? "border-accent" : answer.right ? "border-good" : "border-again"
                }`}
              />
            </label>
            <div id="vocab-result" role="status" className="flex flex-col gap-2 empty:hidden">
              {answer && <Result word={word} answer={answer} ja={ja} />}
            </div>
            {/*
              Japanese → English: under any typed answer, since English has synonyms no list holds ("autumn"
              for "fall"). English → Japanese already takes every form and same-meaning word: near misses only.
            */}
            {answer && !answer.right && answer.typed && (!ja || answer.near) && (
              <button type="button" onClick={countIt} className="min-h-11 self-start rounded-btn border border-line bg-surface px-4 text-[13.5px] font-semibold">
                Count it as right
              </button>
            )}
            <button type="submit" className="mt-1 min-h-[54px] rounded-btn bg-accent text-base font-bold text-on-accent">
              {answer ? (index + 1 < set.length ? "Next" : "Finish") : "Check"}
            </button>
          </form>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              className="inline-flex min-h-11 items-center justify-center gap-1 rounded-btn text-[14px] font-semibold text-ink2 disabled:opacity-40"
            >
              <Icon d="M15 5l-7 7 7 7" size={16} stroke={2} />
              Back
            </button>
            {answer ? (
              <span />
            ) : (
              <button type="button" onClick={dontKnow} className="min-h-11 rounded-btn border border-line bg-surface text-[14px] font-semibold">
                I don&apos;t know
              </button>
            )}
            {answer ? (
              <span />
            ) : (
              <button type="button" onClick={skip} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-btn text-[14px] font-semibold text-ink2">
                Skip
                <Icon d="M9 6l6 6-6 6" size={16} stroke={2} />
              </button>
            )}
          </div>
          <p className="m-0 mt-auto hidden text-center text-[12.5px] text-ink2 laptop:block">Enter checks your answer · Enter again goes to the next word</p>
        </div>
      </div>
    </VoiceProvider>
  );
}

function Mark({ right }: { right: boolean }) {
  return <Icon d={right ? CHECK : CROSS} size={18} stroke={2.2} className="shrink-0" />;
}

/** Right or wrong, with the right answer. */
function Result({ word, answer, ja }: { word: VocabWord; answer: Answer; ja: boolean }) {
  const written = word.term !== word.reading ? `${word.term} (${word.reading})` : word.term;
  if (answer.right) {
    return (
      <>
        <p className="m-0 flex items-center gap-1.5 text-[15px] font-bold text-good">
          <Mark right />
          {answer.counted ? "Counted as right" : answer.typo ? "Right, with a small typo" : "Right"}
        </p>
        {answer.typo && (
          <p className="m-0 text-sm text-ink2">
            It&apos;s spelled &ldquo;{answer.typo}&rdquo;.
          </p>
        )}
        {answer.other && (
          <p className="m-0 text-sm leading-normal text-ink2">
            <span lang="ja" className="font-semibold text-ink">
              {answer.other.term !== answer.other.reading ? `${answer.other.term} (${answer.other.reading})` : answer.other.term}
            </span>{" "}
            means {answer.other.meaning} too. This card&apos;s word is{" "}
            <span lang="ja" className="font-semibold text-ink">
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
      <p className="m-0 flex items-center gap-1.5 text-[15px] font-bold text-again">
        <Mark right={false} />
        {!answer.typed ? "Here it is" : answer.near ? "Close, but not quite" : "Not this time"}
      </p>
      <p className="m-0 text-sm leading-normal">
        {ja ? (
          <>
            It&apos;s{" "}
            <span lang="ja" className="font-semibold">
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
    <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-3 rounded-card bg-surface px-4 py-4 shadow-card">
        <p className="m-0 text-xs font-semibold text-ink2">
          Vocabulary · {level} · {DIRECTION_LABELS[direction]}
        </p>
        <h1 className="m-0 font-head text-[26px] leading-tight">
          {answers.size === 0 ? "Nothing answered" : `${answers.size} of ${set.length} ${set.length === 1 ? "word" : "words"} typed`}
        </h1>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["Right", right, "text-good"],
              ["Missed", missed.length, "text-again"],
              ["Skipped", skipped, "text-ink"],
            ] as const
          ).map(([label, n, color]) => (
            <div key={label} className="flex flex-col items-center gap-0.5 rounded-[14px] bg-surface2 px-2 py-2.5">
              <span className={`text-[22px] font-bold ${color}`}>{n}</span>
              <span className="text-xs text-ink2">{label}</span>
            </div>
          ))}
        </div>
        {missed.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="m-0 text-xs font-semibold text-ink2">Missed</p>
            <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {missed.map((w) => (
                <li key={w.id} className="inline-flex items-baseline gap-1.5 rounded-full border border-line px-2.5 py-[5px] text-[13px]">
                  <span lang="ja" className="font-card text-base font-semibold">
                    {w.term}
                  </span>
                  <span className="text-ink2">{w.meanings[0]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <WaitingLine />
      </section>
      {missed.length > 0 ? (
        <button type="button" onClick={() => onAgain(missed)} className="min-h-[54px] rounded-btn bg-accent text-base font-bold text-on-accent">
          Go again with the {missed.length} missed
        </button>
      ) : null}
      <button
        type="button"
        onClick={onClose}
        className={
          missed.length > 0
            ? "min-h-[50px] rounded-btn border border-line bg-surface text-[15px] font-bold"
            : "min-h-[54px] rounded-btn bg-accent text-base font-bold text-on-accent"
        }
      >
        Pick another set
      </button>
    </div>
  );
}
