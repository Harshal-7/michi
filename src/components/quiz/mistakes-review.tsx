"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { logListeningAction, retryMistakeAction } from "@/app/(app)/practice/quiz-actions";
import { VoiceProvider } from "@/components/cards/voice";
import { Icon } from "@/components/ui/icon";
import type { Asked } from "@/lib/quiz/types";
import type { VoicePrefs } from "@/lib/voice/voices";

import { QuestionView } from "./question-view";
import { Dots, FlagQuestion } from "./quiz-runner";
import { INSTALL_VOICE, useHasJapaneseVoice } from "./use-voice";

const X_ICON = "M6 6l12 12 M18 6L6 18";

type Item = { id: number | null; asked: Asked };

function Header({ title, index, total, marks, leave }: { title: string; index: number; total: number; marks: ("good" | "again" | "now" | "")[]; leave: string }) {
  return (
    <header className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <Link href="/practice" aria-label={leave} className="inline-flex size-11 items-center justify-center rounded-btn text-ink2">
          <Icon d={X_ICON} size={22} stroke={1.8} />
        </Link>
        <p className="m-0 text-[15px] font-bold">{title}</p>
        <p className="m-0 min-w-11 text-right text-[13px] text-ink2">
          {Math.min(index + 1, total)} / {total}
        </p>
      </div>
      <div className="mx-1.5">
        <Dots marks={marks} label={`Question ${Math.min(index + 1, total)} of ${total}`} />
      </div>
    </header>
  );
}

/**
 * Asking a list of questions in order, answers shown at once. Used by the mistakes review (a right
 * answer clears the mistake) and the listen drill (nothing saved but its minutes).
 */
function Drill({
  title,
  items,
  furigana,
  onAnswer,
  done,
  leave,
}: {
  title: string;
  items: Item[];
  furigana: boolean;
  onAnswer: (item: Item, choice: number) => void;
  done: (right: number) => React.ReactNode;
  leave: string;
}) {
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<(number | null)[]>(() => items.map(() => null));
  const finished = index >= items.length;
  const right = chosen.filter((c, i) => c !== null && c === items[i].asked.answer).length;
  const marks = items.map((it, i) => {
    const c = chosen[i];
    if (c !== null) return c === it.asked.answer ? "good" : "again";
    return i === index ? "now" : "";
  }) as ("good" | "again" | "now" | "")[];

  const item = items[index];
  const pick = finished ? null : chosen[index];
  const choose = useCallback(
    (i: number) => {
      if (finished || chosen[index] !== null) return;
      setChosen((c) => c.map((v, j) => (j === index ? i : v)));
      onAnswer(items[index], i);
    },
    [chosen, finished, index, items, onAnswer],
  );
  const next = useCallback(() => {
    setIndex((i) => i + 1);
    window.scrollTo({ top: 0 });
  }, []);
  // Keys 1–4 answer and Enter moves on, as in the quiz.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (finished || e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[1-4]$/.test(e.key)) choose(Number(e.key) - 1);
      else if (e.key === "Enter" && pick !== null) next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choose, finished, next, pick]);

  if (finished) return <>{done(right)}</>;
  return (
    <div className="flex flex-col gap-3.5">
      <Header title={title} index={index} total={items.length} marks={marks} leave={leave} />
      <QuestionView
        key={`${index}-${item.id}`}
        asked={item.asked}
        chosen={pick}
        furigana={furigana}
        onChoose={choose}
      />
      <div className="mt-2 flex flex-col gap-1.5">
        <button
          type="button"
          disabled={pick === null}
          onClick={next}
          className="min-h-[54px] w-full rounded-btn border-none bg-accent text-base font-bold text-on-accent disabled:opacity-50"
        >
          {index === items.length - 1 ? "Finish" : "Next question"}
        </button>
        {item.id !== null && <FlagQuestion key={item.id} questionId={item.id} />}
      </div>
    </div>
  );
}

const quiet = "flex min-h-11 items-center justify-center rounded-btn border border-line text-sm font-semibold text-ink no-underline";
const solid = "flex min-h-[50px] items-center justify-center rounded-btn bg-accent text-[15px] font-bold text-on-accent no-underline";

/** The mistakes review: each waiting mistake asked again. Right clears it; wrong keeps it waiting. */
export function MistakesReview({ items, furigana, voice }: { items: { id: number; asked: Asked }[]; furigana: boolean; voice: VoicePrefs }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  return (
    <VoiceProvider prefs={voice}>
      <Drill
        title="Mistakes review"
        leave="Leave the mistakes review"
        items={items}
        furigana={furigana}
        onAnswer={(item, choice) => {
          void retryMistakeAction({ questionId: item.id!, choice }).then((r) => {
            if ("error" in r) setFailed(true);
          });
        }}
        done={(right) => (
          <section className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card">
            <h1 className="m-0 font-head text-[24px]">Mistakes review done</h1>
            <p className="m-0 text-sm text-ink2">
              {right} of {items.length} right this time.{" "}
              {right < items.length ? `The ${items.length - right === 1 ? "one" : items.length - right} you missed will wait here for next time.` : "Nothing is waiting now."}
              {failed && " Some answers didn't save; they'll come up again."}
            </p>
            {right < items.length && (
              <button type="button" onClick={() => router.refresh()} className={quiet}>
                Try the rest again
              </button>
            )}
            <Link href="/practice" className={solid}>
              Back to Practice
            </Link>
          </section>
        )}
      />
    </VoiceProvider>
  );
}

/** The listen drill: 5 words read aloud. Logs its minutes when it's done; nothing else is saved. */
export function ListenDrill({ items, furigana, voice }: { items: Asked[]; furigana: boolean; voice: VoicePrefs }) {
  const hasVoice = useHasJapaneseVoice();
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    if (hasVoice) startedAt.current ??= Date.now();
  }, [hasVoice]);

  if (hasVoice === null) return <p className="m-0 text-sm text-ink2">Looking for a Japanese voice…</p>;
  if (!hasVoice)
    return (
      <section className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-card">
        <h1 className="m-0 font-head text-[24px]">Listen and choose</h1>
        <p className="m-0 text-sm">This device has no Japanese voice yet, so there&apos;s nothing to listen to.</p>
        <p className="m-0 text-sm text-ink2">On an Android phone: {INSTALL_VOICE}. Then come back here.</p>
        <Link href="/settings/voice" className={quiet}>
          Japanese voice settings
        </Link>
      </section>
    );
  return (
    <VoiceProvider prefs={voice}>
      <Drill
        title="Listen and choose"
        leave="Leave the listen drill"
        items={items.map((asked) => ({ id: null, asked }))}
        furigana={furigana}
        onAnswer={() => {}}
        done={(right) => <ListenDone right={right} total={items.length} startedAt={startedAt.current} />}
      />
    </VoiceProvider>
  );
}

/** The end of the listen drill: logs the minutes from start to done (at most 30) once. */
function ListenDone({ right, total, startedAt }: { right: number; total: number; startedAt: number | null }) {
  const router = useRouter();
  const [logged, setLogged] = useState<number | null>(null);
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || startedAt === null) return;
    sent.current = true;
    const minutes = Math.min(30, Math.max(1, Math.round((Date.now() - startedAt) / 60000)));
    void logListeningAction(minutes).then((r) => {
      if ("ok" in r) setLogged(minutes);
    });
  }, [startedAt]);
  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card">
      <h1 className="m-0 font-head text-[24px]">Listen and choose</h1>
      <p className="m-0 text-sm text-ink2">
        {right} of {total} right.{logged !== null ? ` ${logged} min of listening logged.` : ""}
      </p>
      <button type="button" onClick={() => router.refresh()} className={quiet}>
        Five more
      </button>
      <Link href="/practice" className={solid}>
        Back to Practice
      </Link>
    </section>
  );
}
