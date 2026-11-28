"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { GradeButtons } from "@/components/ui/grade-buttons";
import { IconButton } from "@/components/ui/icon-button";
import { SessionHeader } from "@/components/ui/session-header";
import { VoiceProvider } from "@/components/ui/voice";
import { getOutbox, useOutbox } from "@/lib/srs/outbox";
import {
  type FsrsSettings,
  formatInterval,
  type Grade,
  GRADES,
  gradeCard,
  previewGrades,
  type Scheduler,
  schedulerFor,
} from "@/lib/srs/scheduler";
import type { StudyCard, UpNext } from "@/lib/srs/types";
import type { VoicePrefs } from "@/lib/voice/voices";

import { CardBack, CardFront, cardKind, cardSeen } from "./faces";
import { FlagEditPanel } from "./flag-edit";
import { SessionLoading, useInBrowser } from "./loading";
import { NotebookCard } from "./notebook";
import { SessionDone } from "./session-done";
import { SaveNotes, SaveState, WaitingChip } from "./status";

/** Coming back to the tab after this long reloads the queue. */
const RELOAD_AFTER_MS = 5 * 60_000;
/** With nothing else left, a learning card due this soon is shown now rather than waited for. */
const LEARN_AHEAD_MS = 2 * 60_000;
/** A card missed this many times is a trouble card. */
export const TROUBLE_LAPSES = 4;


type Session = {
  current: StudyCard | null;
  queue: StudyCard[];
  /** Learning cards that come back once they're due. */
  waiting: StudyCard[];
  /** New cards show their back first. */
  revealed: boolean;
  shownAt: number;
  /** Each card's first grade this session, for the summary. */
  first: Record<number, Grade>;
  trouble: string[];
  graded: number;
  startedAt: number;
  endedAt: number | null;
};

const dueMs = (c: StudyCard) => (c.dueAt ? Date.parse(c.dueAt) : 0);
const isLearning = (c: StudyCard) => c.state === "learning" || c.state === "relearning";

/** The next card: a learning card that's due, else the queue, else a learning card due very soon. */
function advance(queue: StudyCard[], waiting: StudyCard[], now: number) {
  const byDue = [...waiting].sort((a, b) => dueMs(a) - dueMs(b));
  const soon = byDue[0];
  if (soon && (dueMs(soon) <= now || (queue.length === 0 && dueMs(soon) <= now + LEARN_AHEAD_MS))) {
    return { current: soon, queue, waiting: byDue.slice(1) };
  }
  return { current: queue[0] ?? null, queue: queue.slice(1), waiting };
}

function start(cards: StudyCard[], now: number): Session {
  const next = advance(cards, [], now);
  return {
    ...next,
    revealed: next.current?.state === "new",
    shownAt: now,
    first: {},
    trouble: [],
    graded: 0,
    startedAt: now,
    endedAt: next.current ? null : now,
  };
}

export type SessionProps = {
  mode: "review" | "new";
  cards: StudyCard[];
  fsrs: FsrsSettings;
  voice: VoicePrefs;
  furigana: boolean;
  /** The chip: a deck's name, "All due" or "New items". */
  label: string;
  /** The line over the summary's title: "Review · all decks". */
  scope: string;
  upNext: UpNext | null;
};

/** Runs in the browser only: the session starts from the outbox and the device's clock. */
export function ReviewSession(props: SessionProps) {
  return useInBrowser() ? <Session {...props} /> : <SessionLoading />;
}

/**
 * Cards graded on an earlier visit whose grades are still waiting to save: the server doesn't
 * know yet, so it sent them again. They're left out rather than asked twice.
 */
function withoutWaiting(cards: StudyCard[]): StudyCard[] {
  const waiting = getOutbox().pending().cards;
  return waiting.size ? cards.filter((c) => !waiting.has(c.id)) : cards;
}

/**
 * A review or new-item session (F_ReviewFront, F_ReviewBack, F_ReviewWeb), then its summary
 * (F_ReviewDone). FSRS runs here for the button labels and the next card; every grade goes to
 * the outbox, and the server re-runs FSRS when it arrives. Full screen on a phone.
 */
function Session(props: SessionProps) {
  const { mode, fsrs } = props;
  const router = useRouter();
  const outbox = useOutbox();
  const [session, setSession] = useState<Session>(() => start(withoutWaiting(props.cards), Date.now()));
  const [undo, setUndo] = useState<{ before: Session; reviewId: string } | null>(null);
  const [scheduler, setScheduler] = useState<Scheduler | null>(null);
  const [panel, setPanel] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const total = props.cards.length;

  const steps = fsrs.learningSteps.join(",");
  useEffect(() => {
    let live = true;
    void schedulerFor({ targetRecall: fsrs.targetRecall, learningSteps: steps.split(",") }).then((s) => {
      if (live) setScheduler(s);
    });
    return () => {
      live = false;
    };
  }, [fsrs.targetRecall, steps]);

  // Coming back after 5 minutes: save what's waiting, then load a fresh queue.
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt !== null && Date.now() - hiddenAt >= RELOAD_AFTER_MS) {
        const box = getOutbox();
        void box.flush().then(() => {
          if (box.getState().waiting === 0 && navigator.onLine) router.refresh();
        });
      }
      hiddenAt = null;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [router]);

  const { current, revealed } = session;

  const intervals = useMemo(() => {
    if (!scheduler || !current || !revealed) return null;
    const now = new Date(session.shownAt);
    const preview = previewGrades(scheduler, { cardId: current.id, fsrs: current.fsrs, now });
    return Object.fromEntries(GRADES.map((g) => [g, formatInterval(now, preview[g].dueAt)])) as Record<Grade, string>;
  }, [scheduler, current, revealed, session.shownAt]);

  const reveal = useCallback(() => setSession((s) => (s.current ? { ...s, revealed: true } : s)), []);

  const grade = useCallback(
    (g: Grade) => {
      const s = session;
      const card = s.current;
      if (!scheduler || !card || !s.revealed) return;
      const at = new Date();
      const graded = gradeCard(scheduler, { cardId: card.id, fsrs: card.fsrs, grade: g, at });
      const id = crypto.randomUUID();
      getOutbox().add({
        kind: "grade",
        id,
        cardId: card.id,
        rating: g,
        reviewedAt: at.toISOString(),
        durationMs: Math.min(3_600_000, Math.max(0, at.getTime() - s.shownAt)),
        lastReviewId: card.lastReviewId,
      });
      const updated: StudyCard = {
        ...card,
        fsrs: graded.stored,
        state: graded.columns.state,
        reps: graded.columns.reps,
        lapses: graded.columns.lapses,
        dueAt: graded.card.dueAt.toISOString(),
        lastReviewId: id,
      };
      const waiting = isLearning(updated) ? [...s.waiting, updated] : s.waiting;
      const next = advance(s.queue, waiting, at.getTime());
      const becameTrouble = g === 1 && updated.lapses >= TROUBLE_LAPSES && updated.lapses > card.lapses;
      setUndo({ before: s, reviewId: id });
      setMessage(null);
      setSession({
        ...s,
        ...next,
        revealed: next.current?.state === "new",
        shownAt: at.getTime(),
        first: card.id in s.first ? s.first : { ...s.first, [card.id]: g },
        trouble: becameTrouble ? [...s.trouble, card.item.term] : s.trouble,
        graded: s.graded + 1,
        endedAt: next.current ? null : at.getTime(),
      });
    },
    [scheduler, session],
  );

  const undoLast = useCallback(() => {
    if (!undo) return;
    getOutbox().undoGrade(undo.reviewId);
    const before = undo.before;
    setSession({ ...before, revealed: before.current?.state === "new", shownAt: Date.now(), endedAt: null });
    setUndo(null);
    setMessage(null);
  }, [undo]);

  const end = useCallback(() => setSession((s) => ({ ...s, endedAt: Date.now() })), []);

  const onEdited = useCallback((itemId: number, item: { term: string; reading: string | null; meaning: string }) => {
    const patch = (c: StudyCard | null) => (c && c.item.id === itemId ? { ...c, item: { ...c.item, ...item } } : c);
    const patchAll = (s: Session): Session => ({
      ...s,
      current: patch(s.current),
      queue: s.queue.map((c) => patch(c)!),
      waiting: s.waiting.map((c) => patch(c)!),
    });
    setSession(patchAll);
    setUndo((u) => (u ? { ...u, before: patchAll(u.before) } : u));
  }, []);

  // Laptop keys: space shows the answer, 1–4 grade it, U undoes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (panel || e.metaKey || e.ctrlKey || e.altKey || session.endedAt !== null) return;
      if (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable=true]")) return;
      if (e.key === " " && !revealed) {
        e.preventDefault();
        reveal();
      } else if (["1", "2", "3", "4"].includes(e.key) && revealed) {
        e.preventDefault();
        grade(Number(e.key) as Grade);
      } else if (e.key.toLowerCase() === "u" && undo) {
        e.preventDefault();
        undoLast();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, revealed, reveal, grade, undo, undoLast, session.endedAt]);

  if (session.endedAt !== null || !current) {
    return (
      <SessionDone
        mode={mode}
        scope={props.scope}
        first={session.first}
        graded={session.graded}
        startedAt={session.startedAt}
        endedAt={session.endedAt ?? session.startedAt}
        waiting={session.waiting}
        trouble={session.trouble}
        upNext={props.upNext}
        outbox={outbox}
      />
    );
  }

  // A card counts as done once graded, even if it comes back later as a learning card.
  const done = Object.keys(session.first).length;
  const at = Math.min(done + 1, total);
  const title = mode === "new" ? props.label : props.label === "All due" ? "Reviews" : props.label;
  const side = panel ? "flag or edit" : revealed ? "answer" : "front";

  return (
    <VoiceProvider prefs={props.voice}>
      <div className="fixed inset-0 z-session flex flex-col bg-page laptop:static laptop:z-auto laptop:mx-auto laptop:w-full laptop:max-w-160 laptop:gap-2 laptop:bg-transparent">
        <div className="shrink-0 px-2.5 pt-[max(12px,env(safe-area-inset-top))] laptop:p-0">
          <SessionHeader
            title={title}
            count={`${at} / ${total}`}
            close={{ label: "End the session", onClick: end }}
            progress={{ value: done, max: total, label: `Card ${at} of ${total}` }}
            trailing={<IconButton icon="flag" label="Flag or edit this card" pressed={panel} onClick={() => setPanel((p) => !p)} />}
          />
        </div>
        <div className="flex shrink-0 flex-col gap-2 px-5 pt-2 empty:hidden laptop:px-0">
          <WaitingChip state={outbox} />
          <SaveNotes state={outbox} />
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-5 pt-8 pb-5 laptop:min-h-120 laptop:flex-none laptop:px-0">
          <NotebookCard
            label={`Card ${at} of ${total} (${cardSeen(current)}), ${side}`}
            rules={revealed ? 3 : 4}
            className="flex-1 laptop:min-h-120"
          >
            <div className="flex items-center justify-end">
              <Chip cover="blue" size="lg">
                {cardKind(current)}
              </Chip>
            </div>
            {message && !panel && (
              <p role="status" className="m-0 mt-3 rounded-btn bg-surface2 px-3.5 py-2.5 text-meta">
                {message}
              </p>
            )}
            {panel ? (
              <FlagEditPanel
                key={current.id}
                card={current}
                onEdited={onEdited}
                onClose={(m) => {
                  setPanel(false);
                  setMessage(m ?? null);
                }}
              />
            ) : revealed ? (
              <CardBack card={current} furigana={props.furigana} />
            ) : (
              <CardFront card={current} furigana={props.furigana} />
            )}
          </NotebookCard>
        </div>

        {!panel && (
          <footer className="flex shrink-0 flex-col gap-2 px-5 pb-[max(20px,env(safe-area-inset-bottom))] laptop:px-0 laptop:pb-0">
            {revealed ? (
              <>
                <div className={`flex min-h-6 items-center gap-2 ${undo ? "justify-between" : "justify-center"}`}>
                  <p className="m-0 text-body font-bold text-ink2">
                    {current.state === "new" ? "How well do you know it?" : "How well did you remember it?"}
                  </p>
                  {undo && (
                    <Button variant="text" size="sm" icon="undo" onClick={undoLast} className="-my-2.5" aria-keyshortcuts="U">
                      Undo
                    </Button>
                  )}
                </div>
                <GradeButtons
                  label={current.state === "new" ? "How well do you know it?" : "How well did you remember it?"}
                  intervals={[intervals?.[1] ?? "…", intervals?.[2] ?? "…", intervals?.[3] ?? "…", intervals?.[4] ?? "…"]}
                  onGrade={grade}
                  disabled={!intervals}
                />
              </>
            ) : (
              <>
                {undo && (
                  <Button variant="text" size="sm" icon="undo" onClick={undoLast} className="-my-1 self-center" aria-keyshortcuts="U">
                    Undo last grade
                  </Button>
                )}
                <Button size="lg" full onClick={reveal} aria-keyshortcuts="Space">
                  Show answer
                </Button>
              </>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2.5 text-meta text-ink2 max-laptop:hidden">
              <SaveState state={outbox} />
              <span>Space shows the answer · 1–4 grades it · U undoes</span>
            </div>
          </footer>
        )}
      </div>
    </VoiceProvider>
  );
}
