"use client";

import { useCallback, useEffect, useState } from "react";

import { SessionLoading, useInBrowser } from "@/components/cards/loading";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { ROUTES } from "@/lib/planner/day-plan";
import { getVocabQueue } from "@/lib/vocab/queue";
import {
  buildSet,
  type Direction,
  type Filter,
  filterCounts,
  type Level,
  type Order,
  type Progress,
  VOCAB_LEVELS,
  type VocabWord,
} from "@/lib/vocab/types";
import type { VoicePrefs } from "@/lib/voice/voices";

import { BackLink, LinkTabs } from "./tabs";
import { DIRECTION_LABELS, WaitingLine } from "./vocab-parts";
import { type Answer, VocabSession } from "./vocab-session";

/** The choices kept on this device, so the page opens the way you left it. */
const CHOICES_KEY = "michi.vocab-choices.v1";
type Choices = { direction: Direction; filter: Filter; order: Order };
const DEFAULT_CHOICES: Choices = { direction: "ja_en", filter: "not_right", order: "list" };

function readChoices(): Choices {
  try {
    const saved = JSON.parse(localStorage.getItem(CHOICES_KEY) ?? "{}") as Partial<Choices>;
    return {
      direction: saved.direction === "en_ja" ? "en_ja" : "ja_en",
      filter: saved.filter === "all" || saved.filter === "missed" ? saved.filter : DEFAULT_CHOICES.filter,
      order: saved.order === "shuffled" ? "shuffled" : "list",
    };
  } catch {
    return DEFAULT_CHOICES;
  }
}

type Props = {
  level: Level;
  words: VocabWord[];
  /** Words typed right at least once in each level, from the server (this level's is worked out here). */
  counts: Record<Level, { total: number; ja_en: number; en_ja: number }>;
  furigana: boolean;
  voice: VoicePrefs;
};

/** Typed vocabulary practice: pick the level, direction, words and order, then go. */
/** A new key and shuffle seed for each run. */
let runs = 0;
const newRun = () => ({ key: ++runs, seed: Date.now() + runs });

export function VocabPractice(props: Props) {
  return useInBrowser() ? <Practice {...props} /> : <SessionLoading />;
}

function Practice({ level, words, counts, furigana, voice }: Props) {
  const [choices, setChoices] = useState<Choices>(readChoices);
  const [progress, setProgress] = useState(() => new Map(words.map((w) => [w.id, w.progress])));
  const [run, setRun] = useState<{ set: VocabWord[]; direction: Direction; key: number } | null>(null);

  // Answers left waiting on an earlier visit go now.
  useEffect(() => void getVocabQueue().flush(), []);

  const choose = (patch: Partial<Choices>) => {
    const next = { ...choices, ...patch };
    setChoices(next);
    try {
      localStorage.setItem(CHOICES_KEY, JSON.stringify(next));
    } catch {
      // Not kept for next time; nothing else needs it.
    }
  };

  const current = words.map((w) => ({ ...w, progress: progress.get(w.id) ?? w.progress }));
  const filtered = filterCounts(current, choices.direction);
  const typedRight = (d: Direction) => current.filter((w) => (w.progress[d]?.right ?? 0) > 0).length;

  const onAnswer = useCallback((word: VocabWord, direction: Direction, answer: Answer, kind: "answer" | "fix") => {
    const right = kind === "fix" || answer.right;
    getVocabQueue().add({ itemId: word.id, direction, kind, right, at: answer.at });
    setProgress((map) => {
      const before: Progress = map.get(word.id)?.[direction] ?? { right: 0, wrong: 0, lastRight: false };
      const after: Progress =
        kind === "fix"
          ? { right: before.right + 1, wrong: Math.max(0, before.wrong - 1), lastRight: true }
          : { right: before.right + (right ? 1 : 0), wrong: before.wrong + (right ? 0 : 1), lastRight: right };
      const next = new Map(map);
      next.set(word.id, { ...(map.get(word.id) ?? { ja_en: null, en_ja: null }), [direction]: after });
      return next;
    });
  }, []);

  if (run) {
    return (
      <VocabSession
        key={run.key}
        level={level}
        set={run.set}
        direction={run.direction}
        furigana={furigana}
        voice={voice}
        onAnswer={onAnswer}
        onAgain={(set) => setRun({ set, direction: run.direction, key: newRun().key })}
        onClose={() => {
          setRun(null);
          window.scrollTo(0, 0);
        }}
      />
    );
  }

  const start = () => {
    const { key, seed } = newRun();
    const set = buildSet(current, { ...choices, seed });
    if (set.length) setRun({ set, direction: choices.direction, key });
  };
  const size = filtered[choices.filter];

  return (
    <>
      <BackLink href={ROUTES.learn}>Learn</BackLink>
      <PageHeader title="Vocabulary" sub="Type the meaning, or type the word, for the JLPT word lists" />
      <LinkTabs
        label="Level"
        tabs={VOCAB_LEVELS.map((l) => ({
          href: `${ROUTES.vocab}?level=${l}`,
          label: l,
          note: `${(l === level ? current.length : counts[l].total).toLocaleString("en")} words`,
          current: l === level,
        }))}
      />

      <section aria-label={`${level} progress`} className="flex flex-col gap-3 rounded-card bg-surface px-4 py-3.5 shadow-card">
        {(["ja_en", "en_ja"] as const).map((d) => {
          const n = typedRight(d);
          return (
            <div key={d} className="flex flex-col gap-1.5">
              <p className="m-0 flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
                <span className="font-semibold">{DIRECTION_LABELS[d]}</span>
                <span className="text-ink2">
                  {n.toLocaleString("en")} of {current.length.toLocaleString("en")} typed right
                </span>
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-track" aria-hidden="true">
                <div className="h-full bg-good" style={{ width: `${current.length ? (n / current.length) * 100 : 0}%` }} />
              </div>
            </div>
          );
        })}
      </section>

      <section aria-label="Choose a set" className="flex flex-col gap-3.5 rounded-card bg-surface px-4 py-3.5 shadow-card">
        <Segmented
          name="Direction"
          value={choices.direction}
          onChoose={(direction) => choose({ direction })}
          options={[
            { value: "ja_en", label: "Japanese → English", note: "type the meaning" },
            { value: "en_ja", label: "English → Japanese", note: "type the word" },
          ]}
        />
        <Segmented
          name="Words"
          value={choices.filter}
          onChoose={(filter) => choose({ filter })}
          options={[
            { value: "all", label: "All", note: filtered.all.toLocaleString("en") },
            { value: "not_right", label: "Not right yet", note: filtered.not_right.toLocaleString("en") },
            { value: "missed", label: "Missed", note: `${filtered.missed.toLocaleString("en")} last time` },
          ]}
        />
        <Segmented
          name="Order"
          value={choices.order}
          onChoose={(order) => choose({ order })}
          options={[
            { value: "list", label: "List order" },
            { value: "shuffled", label: "Shuffled" },
          ]}
        />
      </section>

      {size > 0 ? (
        <button type="button" onClick={start} className="min-h-[54px] rounded-btn bg-accent text-base font-bold text-on-accent">
          Start · {size.toLocaleString("en")} {size === 1 ? "word" : "words"}
        </button>
      ) : (
        <EmptyState>
          {choices.filter === "missed"
            ? `Nothing missed last time in ${level}, ${DIRECTION_LABELS[choices.direction]}.`
            : `Every ${level} word has been typed right this way. Pick “All” to go through them again.`}
        </EmptyState>
      )}
      <p className="m-0 text-center text-[12.5px] leading-normal text-ink2">
        Practice keeps its own counts on this list. It doesn&apos;t change your reviews.
      </p>
      <WaitingLine />
    </>
  );
}

/** Settings' segmented control: equal segments in a --surface2 track, the chosen one raised. */
function Segmented<T extends string>({
  name,
  value,
  options,
  onChoose,
}: {
  name: string;
  value: T;
  options: { value: T; label: string; note?: string }[];
  onChoose: (value: T) => void;
}) {
  return (
    <fieldset className="m-0 flex flex-col gap-1.5 border-none p-0">
      <legend className="mb-1.5 p-0 text-xs font-semibold text-ink2">{name}</legend>
      <div className="grid gap-1 rounded-btn bg-surface2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <label
            key={o.value}
            className="relative flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-btn px-2 py-1 text-center text-[13.5px] leading-[1.2] font-medium text-ink2 has-[:checked]:bg-surface has-[:checked]:font-bold has-[:checked]:text-ink has-[:checked]:shadow-card has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
          >
            <input type="radio" name={name} value={o.value} checked={o.value === value} onChange={() => onChoose(o.value)} className="sr-only" />
            <span>{o.label}</span>
            {o.note && <span className="text-[11px] font-medium text-ink2">{o.note}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
