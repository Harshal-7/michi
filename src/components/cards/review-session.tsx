"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { getOutbox, useOutbox } from "@/lib/srs/outbox";
import {
  type FsrsSettings,
  formatInterval,
  GRADE_NAMES,
  type Grade,
  GRADES,
  gradeCard,
  previewGrades,
  type Scheduler,
  schedulerFor,
} from "@/lib/srs/scheduler";
import type { StudyCard, UpNext } from "@/lib/srs/types";
import type { VoicePrefs } from "@/lib/voice/voices";

import { CardBack, CardFront, cardLabel } from "./faces";
import { FlagEditPanel } from "./flag-edit";
import { SaveNotes, SaveState, WaitingChip } from "./status";
import { SessionDone } from "./session-done";
import { VoiceProvider } from "./voice";

/** Coming back to the tab after this long reloads the queue. */
const RELOAD_AFTER_MS = 5 * 60_000;
/** With nothing else left, a learning card due this soon is shown now rather than waited for. */
const LEARN_AHEAD_MS = 2 * 60_000;
/** A card missed this many times is a trouble card. */
export const TROUBLE_LAPSES = 4;

const RATING_COLOR: Record<Grade, string> = { 1: "text-again", 2: "text-ink", 3: "text-good", 4: "text-easy" };
const X_ICON = "M6 6l12 12 M18 6L6 18";
const FLAG_ICON = "M5 21V4 M5 4h11l-2 4 2 4H5";

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

/**
 * A review or new-item session (F_ReviewFront, F_ReviewBack, F_ReviewWeb), then its summary
 * (F_ReviewDone). FSRS runs here for the button labels and the next card; every grade goes to
 * the outbox, and the server re-runs FSRS when it arrives. Full screen on a phone.
 */
export function ReviewSession(props: SessionProps) {
  const { mode, fsrs } = props;
  const router = useRouter();
  const outbox = useOutbox();
  const [session, setSession] = useState<Session>(() => start(props.cards, Date.now()));
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
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
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
  const left = Math.max(0, total - done);
  const progress = total ? Math.round((done / total) * 100) : 0;
  const title = mode === "new" ? "New items" : "Review";

  const progressBar = (
    <div role="img" aria-label={`${done} of ${total} cards done`} className="h-1 overflow-hidden rounded-full bg-track">
      <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
    </div>
  );

  return (
    <VoiceProvider prefs={props.voice}>
      <div className="fixed inset-0 z-40 flex flex-col bg-page laptop:static laptop:z-auto laptop:gap-[18px] laptop:bg-transparent">
        {/* Phone header (F_ReviewFront) */}
        <header className="flex shrink-0 flex-col gap-2.5 px-3 pt-[max(12px,env(safe-area-inset-top))] pb-2 laptop:hidden">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="End session"
              onClick={end}
              className="inline-flex size-11 items-center justify-center rounded-btn text-ink2"
            >
              <Icon d={X_ICON} size={22} stroke={1.8} />
            </button>
            <div className="flex min-w-0 items-center gap-2 text-[13px]">
              <span className="truncate rounded-full bg-accent-soft px-2.5 py-1 font-semibold">{props.label}</span>
              <span className="shrink-0 text-ink2">{left} left</span>
            </div>
            <button
              type="button"
              aria-label="Flag or edit this card"
              aria-pressed={panel}
              onClick={() => setPanel((p) => !p)}
              className={`inline-flex size-11 items-center justify-center rounded-btn ${panel ? "bg-accent-soft text-accent" : "text-ink2"}`}
            >
              <Icon d={FLAG_ICON} size={20} stroke={1.7} />
            </button>
          </div>
          <div className="mx-1.5">{progressBar}</div>
          <div className="flex flex-col gap-2 empty:hidden">
            <WaitingChip state={outbox} />
            <SaveNotes state={outbox} />
          </div>
        </header>

        {/* Laptop header (F_ReviewWeb) */}
        <header className="hidden flex-col gap-2.5 laptop:flex">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h1 className="m-0 font-head text-[26px]">{title}</h1>
              <span className="rounded-full bg-accent-soft px-3 py-1 text-[13px] font-bold">{props.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink2">
                {done} / {total}
              </span>
              <button
                type="button"
                onClick={end}
                className="min-h-10 rounded-btn border border-line bg-transparent px-3.5 text-[13px] font-semibold"
              >
                End session
              </button>
            </div>
          </div>
          {progressBar}
          <SaveNotes state={outbox} />
        </header>

        <div className="flex min-h-0 flex-auto flex-col px-4 pt-2 pb-3 laptop:flex-none laptop:p-0">
          <article className="mx-auto box-border flex min-h-0 w-full flex-auto flex-col items-center gap-3.5 overflow-y-auto rounded-card bg-surface p-[18px] shadow-card laptop:min-h-[380px] laptop:max-w-[640px] laptop:flex-none laptop:px-7 laptop:py-6">
            <div className="flex w-full items-center justify-between gap-2 text-xs font-semibold text-ink2 laptop:text-[12.5px]">
              <span>{cardLabel(current)}</span>
              <button
                type="button"
                onClick={() => setPanel((p) => !p)}
                className="hidden font-normal text-ink2 underline laptop:inline"
              >
                {panel ? "Back to the card" : "Flag or edit this card"}
              </button>
            </div>
            {message && !panel && (
              <p role="status" className="m-0 w-full rounded-xl bg-surface2 px-3 py-2 text-[12.5px]">
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
          </article>
        </div>

        {!panel && (
          <footer className="mx-auto flex w-full shrink-0 flex-col gap-2.5 px-4 pb-[max(18px,env(safe-area-inset-bottom))] laptop:max-w-[640px] laptop:p-0">
            {revealed ? (
              <>
                <div className="flex items-center justify-between laptop:hidden">
                  <UndoButton visible={!!undo} onClick={undoLast} label="Undo last grade" />
                  <span className="text-xs text-ink2">
                    {current.state === "new" ? "new: grade how well you know it" : "next review after your grade"}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 laptop:gap-2.5">
                  {GRADES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      disabled={!intervals}
                      onClick={() => grade(g)}
                      className="flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-btn border border-line bg-surface px-1 py-2 disabled:opacity-60 laptop:min-h-[68px] laptop:gap-[3px] laptop:rounded-card"
                    >
                      <span className="flex items-center gap-2">
                        <span className="hidden min-w-5 rounded-md border border-line px-1 text-xs font-bold text-ink2 laptop:inline">
                          {g}
                        </span>
                        <span className={`text-[15px] font-bold laptop:text-base ${RATING_COLOR[g]}`}>{GRADE_NAMES[g]}</span>
                      </span>
                      <span className="text-xs text-ink2 laptop:text-[12.5px]">{intervals?.[g] ?? "…"}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex laptop:hidden">
                  <UndoButton visible={!!undo} onClick={undoLast} label="Undo last grade" />
                </div>
                <button
                  type="button"
                  onClick={reveal}
                  className="min-h-14 rounded-btn bg-accent text-[17px] font-bold text-on-accent"
                >
                  Show answer
                </button>
              </>
            )}
            <div className="hidden flex-wrap items-center justify-between gap-2.5 text-[13px] text-ink2 laptop:flex">
              <SaveState state={outbox} />
              <span>Space shows the answer · 1–4 grades it</span>
              <UndoButton visible={!!undo} onClick={undoLast} label="Undo (U)" />
            </div>
          </footer>
        )}
      </div>
    </VoiceProvider>
  );
}

function UndoButton({ visible, onClick, label }: { visible: boolean; onClick: () => void; label: string }) {
  if (!visible) return <span />;
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-9 rounded-btn border-none bg-transparent px-1.5 text-[13px] font-semibold text-ink2 laptop:min-h-10 laptop:px-3"
    >
      {label}
    </button>
  );
}

