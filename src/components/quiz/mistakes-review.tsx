"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { logListeningAction, retryMistakeAction } from "@/app/(app)/practice/quiz-actions";
import { Rabbit } from "@/components/ui/art/rabbit";
import { Spot } from "@/components/ui/art/spots";
import { Button } from "@/components/ui/button";
import { DoneScreen } from "@/components/ui/done-screen";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonText } from "@/components/ui/skeleton";
import { StatGrid, StatTile } from "@/components/ui/stat";
import { VoiceProvider } from "@/components/ui/voice";
import type { Asked } from "@/lib/quiz/types";
import type { VoicePrefs } from "@/lib/voice/voices";

import { QuestionView } from "./question-view";
import { FlagQuestion, QuizShell } from "./quiz-runner";
import { INSTALL_VOICE, useHasJapaneseVoice } from "./use-voice";

type Item = { id: number | null; asked: Asked };

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
  const [flagging, setFlagging] = useState(false);
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
    setFlagging(false);
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
  const at = Math.min(index + 1, items.length);
  return (
    <QuizShell
      title={title}
      count={`${at} / ${items.length}`}
      close={{ href: "/practice", label: leave }}
      marks={marks}
      marksLabel={`Question ${at} of ${items.length}`}
      flag={item.id !== null ? { open: flagging, toggle: () => setFlagging((f) => !f) } : undefined}
      footer={
        <Button size="lg" full disabled={pick === null} onClick={next}>
          {index === items.length - 1 ? "Finish" : "Next question"}
        </Button>
      }
    >
      <QuestionView key={`${index}-${item.id}`} asked={item.asked} chosen={pick} furigana={furigana} onChoose={choose} />
      {item.id !== null && <FlagQuestion key={item.id} questionId={item.id} open={flagging} onClose={() => setFlagging(false)} />}
    </QuizShell>
  );
}

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
          <DoneScreen
            title="Mistakes review done"
            stats={
              <StatGrid cols={2}>
                <StatTile value={right} label="right this time" tone="good" size="lg" />
                <StatTile value={items.length - right} label="still waiting" size="lg" />
              </StatGrid>
            }
            actions={
              <>
                <Button size="lg" full href="/practice" iconEnd="arrow-right">
                  Back to Practice
                </Button>
                {right < items.length && (
                  <Button variant="secondary" full icon="refresh" onClick={() => router.refresh()}>
                    Try the rest again
                  </Button>
                )}
              </>
            }
          >
            {right < items.length
              ? `The ${items.length - right === 1 ? "one" : items.length - right} you missed will wait here for next time.`
              : "Nothing is waiting now."}
            {failed && " Some answers didn’t save; they’ll come up again."}
          </DoneScreen>
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

  if (hasVoice === null) return <SkeletonText lines={3} label="Looking for a Japanese voice" />;
  if (!hasVoice)
    return (
      <EmptyState
        art={<Spot kind="tea" />}
        title="No Japanese voice on this device yet"
        action={
          <Button variant="secondary" href="/settings/voice">
            Japanese voice settings
          </Button>
        }
      >
        <p className="m-0">There’s nothing to listen to without one.</p>
        <p className="m-0 mt-2">On an Android phone: {INSTALL_VOICE}. Then come back here.</p>
      </EmptyState>
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
    <DoneScreen
      title="Listen and choose"
      art={<Rabbit pose="cheering" size={180} />}
      stats={
        <StatGrid cols={2}>
          <StatTile value={`${right} of ${total}`} label="right" tone="good" size="lg" />
          {logged !== null && <StatTile value={`${logged} min`} label="listening logged" size="lg" />}
        </StatGrid>
      }
      actions={
        <>
          <Button size="lg" full href="/practice" iconEnd="arrow-right">
            Back to Practice
          </Button>
          <Button variant="secondary" full icon="refresh" onClick={() => router.refresh()}>
            Five more
          </Button>
        </>
      }
    />
  );
}
