"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Choice, VerdictButtons } from "@/components/quiz/choice";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { AnswerInput } from "@/components/ui/field";
import { TimerBar } from "@/components/ui/progress";
import { Ruby } from "@/components/ui/ruby";
import { SessionHeader } from "@/components/ui/session-header";
import { StatGrid, StatTile } from "@/components/ui/stat";
import { getOutbox, useOutbox } from "@/lib/srs/outbox";
import type { CheckItem } from "@/lib/srs/quick-check";
import { FAST_MS, kanaVerdict, romajiMatches, SPOT_CHECK_EVERY, spotOptions } from "@/lib/srs/quick-check-rules";
import type { UpNext } from "@/lib/srs/types";
import type { VoicePrefs } from "@/lib/voice/voices";

import { SpeakButton } from "@/components/ui/speak-button";
import { VoiceProvider } from "@/components/ui/voice";

import { SessionLoading, useInBrowser } from "./loading";
import { NotebookCard, Rule } from "./notebook";
import { DoneHead, DoneShell, DoneTop, Note, UpNextCard } from "./session-done";
import { NoSignal, SaveNotes, SaveState, WaitingChip } from "./status";

type Verdict = "known" | "unsure" | "unknown";
type Recent = { kana: string; romaji: string; ok: boolean; mark: string };
type Spot = { item: CheckItem; options: string[]; answerIndex: number; chosen: number | null };

/** A held-back "Knew it" is asked this many cards later, so its answer isn't fresh. */
const SPOT_DELAY = 3;


export type QuickCheckProps = {
  items: CheckItem[];
  day: number;
  /** Items left in the whole quick check after this batch. */
  leftAfter: number;
  pool: { kanji: string[]; word: string[] };
  voice: VoicePrefs;
  furigana: boolean;
  upNext: UpNext | null;
};

/**
 * The quick check (decision 6; F_QuickCheckKana, F_QuickCheckWords): a kana sprint first, where
 * typing the romaji fast and right means known, then kanji and words: look, recall, show the
 * answer, then Knew it / Unsure / Forgot. One "Knew it" in five gets a multiple-choice spot check.
 */
export function QuickCheck(props: QuickCheckProps) {
  return useInBrowser() ? <Check {...props} /> : <SessionLoading />;
}

function Check({ items: loaded, ...props }: QuickCheckProps) {
  const outbox = useOutbox();
  // Items checked on an earlier visit whose verdicts are still waiting to save aren't asked again.
  const [items] = useState(() => {
    const waiting = getOutbox().pending().items;
    return waiting.size ? loaded.filter((i) => !waiting.has(i.itemId)) : loaded;
  });
  const [index, setIndex] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [shown, setShown] = useState(false);
  const [typed, setTyped] = useState("");
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [recent, setRecent] = useState<Recent[]>([]);
  const [tally, setTally] = useState<Record<Verdict, number>>({ known: 0, unsure: 0, unknown: 0 });
  const [knew, setKnew] = useState(0);
  /** Every fifth "Knew it" waits here for its spot check, and is saved once that's answered. */
  const [held, setHeld] = useState<{ item: CheckItem; askAt: number } | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const item = items[index] ?? null;
  const isKana = item?.kind === "kana";

  // The kana timer.
  useEffect(() => {
    if (!isKana || stopped) return;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [isKana, stopped, index]);

  useEffect(() => {
    if (isKana && !spot) input.current?.focus();
  }, [isKana, index, spot]);

  // Time away from the tab (another app, the phone locked) doesn't count against the kana.
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt !== null) {
        const away = Date.now() - hiddenAt;
        hiddenAt = null;
        setStartedAt((t) => t + away);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const record = useCallback((target: CheckItem, verdict: Verdict, verified: boolean | null) => {
    getOutbox().add({
      kind: "check",
      id: crypto.randomUUID(),
      itemId: target.itemId,
      verdict,
      verified,
      checkedAt: new Date().toISOString(),
    });
    // A "Knew it" that failed its spot check is treated as unsure.
    const counted: Verdict = verdict === "known" && verified === false ? "unsure" : verdict;
    setTally((t) => ({ ...t, [counted]: t[counted] + 1 }));
  }, []);

  /** On to the next item, asking a held-back spot check first once it's due. */
  const next = useCallback(
    (holding: { item: CheckItem; askAt: number } | null = held) => {
      const nextIndex = index + 1;
      setIndex(nextIndex);
      setShown(false);
      setTyped("");
      const t = Date.now();
      setStartedAt(t);
      setNow(t);
      if (holding && (nextIndex >= holding.askAt || nextIndex >= items.length)) {
        const pool = holding.item.kind === "kanji" ? props.pool.kanji : props.pool.word;
        const { options, answerIndex } = spotOptions(holding.item.meaning, pool);
        if (options.length === 4) setSpot({ item: holding.item, options, answerIndex, chosen: null });
        else record(holding.item, "known", null);
        setHeld(null);
      } else setHeld(holding);
    },
    [held, index, items.length, props.pool, record],
  );

  const answerKana = useCallback(
    (value: string, submitted: boolean) => {
      if (!item) return;
      setTyped(value);
      const right = romajiMatches(value, item.reading ?? "", item.accept);
      if (!right && !submitted) return;
      const verdict = kanaVerdict(right, Date.now() - startedAt);
      record(item, verdict, null);
      const typedText = value.trim();
      const mark =
        verdict === "known" ? "known" : verdict === "unsure" ? "slow" : typedText ? `you typed ${typedText}` : "not known";
      setRecent((r) => [{ kana: item.term, romaji: item.reading ?? "", ok: verdict === "known", mark }, ...r].slice(0, 4));
      next();
    },
    [item, startedAt, record, next],
  );

  function choose(verdict: Verdict) {
    if (!item) return;
    if (verdict === "known") {
      const count = knew + 1;
      setKnew(count);
      if (count % SPOT_CHECK_EVERY === 0 && !held) {
        next({ item, askAt: index + 1 + SPOT_DELAY });
        return;
      }
    }
    record(item, verdict, null);
    next();
  }

  function answerSpot(i: number) {
    if (!spot || spot.chosen !== null) return;
    setSpot({ ...spot, chosen: i });
    record(spot.item, "known", i === spot.answerIndex);
  }

  function stop() {
    // Anything waiting for its spot check still counts as known.
    if (held) record(held.item, "known", null);
    if (spot && spot.chosen === null) record(spot.item, "known", null);
    setHeld(null);
    setSpot(null);
    setStopped(true);
  }

  if (stopped || (!item && !spot)) {
    return (
      <QuickCheckDone
        tally={tally}
        day={props.day}
        finished={!stopped}
        leftAfter={props.leftAfter + Math.max(0, items.length - index)}
        upNext={props.upNext}
        outbox={outbox}
      />
    );
  }

  const kind = spot ? spot.item.kind : item!.kind;
  const kindTitle = kind === "kana" ? "kana" : kind === "kanji" ? "N5 kanji" : "N5 words";
  const elapsed = Math.max(0, now - startedAt);
  const bigTerm = (term: string) => ([...term].length > 3 ? "text-display" : "text-kana");

  return (
    <VoiceProvider prefs={props.voice}>
      <div className="fixed inset-0 z-session flex flex-col overflow-y-auto bg-page laptop:static laptop:z-auto laptop:mx-auto laptop:w-full laptop:max-w-160 laptop:overflow-visible laptop:bg-transparent">
        <div className="shrink-0 px-2.5 pt-[max(12px,env(safe-area-inset-top))] laptop:p-0">
          <SessionHeader
            title="Quick check"
            count={`${index} / ${items.length}`}
            close={{ label: "Stop the quick check", onClick: stop }}
            progress={{ value: index, max: items.length, label: `${index} of ${items.length} ${kindTitle} checked` }}
          />
        </div>
        <div className="flex shrink-0 flex-col gap-2 px-5 pt-2 empty:hidden laptop:px-0">
          <WaitingChip state={outbox} />
          <SaveNotes state={outbox} />
        </div>

        <div className="flex w-full flex-auto flex-col gap-4 px-5 pt-8 pb-6 laptop:px-0">
          {spot ? (
            <>
              <NotebookCard label="Quick question" sheets={["butter", "blue"]} rules={2} className="min-h-56">
                <div className="flex justify-between">
                  <Chip cover="butter" size="lg">
                    you said you knew it
                  </Chip>
                  <Chip cover="blue" size="lg">
                    {spot.item.kind === "kanji" ? "Kanji · N5" : "Word · N5"}
                  </Chip>
                </div>
                <p lang="ja" className={`m-0 mt-4 text-center font-ja tracking-wide ${bigTerm(spot.item.term)}`}>
                  {spot.item.term}
                </p>
              </NotebookCard>
              <SpotCheck spot={spot} onChoose={answerSpot} onNext={() => setSpot(null)} />
            </>
          ) : isKana && item ? (
            <>
              <NotebookCard label={item.script === "katakana" ? "Katakana" : "Hiragana"} sheets={["butter", "blue"]} rules={2} className="min-h-60">
                <div className="flex justify-between">
                  <Chip cover="butter" size="lg">
                    Day {Math.min(props.day, 3)} of 3 · kana first
                  </Chip>
                  <Chip cover="blue" size="lg">
                    {item.script === "katakana" ? "Katakana" : "Hiragana"}
                  </Chip>
                </div>
                <p lang="ja" className="m-0 mt-2 text-center font-ja text-kana">
                  {item.term}
                </p>
              </NotebookCard>
              <form
                className="mt-2 flex flex-col gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  answerKana(typed, true);
                }}
              >
                <label htmlFor="qc-romaji" className="text-meta font-bold">
                  Type the romaji
                </label>
                <AnswerInput
                  id="qc-romaji"
                  // AnswerInput's props don't list `ref` yet (a note for 3d); it reaches the <input> all the same.
                  {...({ ref: input } as Record<string, unknown>)}
                  type="text"
                  value={typed}
                  onChange={(e) => answerKana(e.target.value, false)}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                />
              </form>
              <div className="flex items-center gap-2.5">
                <TimerBar startedAt={startedAt} durationMs={FAST_MS} running={!stopped} className="flex-auto" />
                <span role="timer" aria-label={`${(elapsed / 1000).toFixed(1)} seconds of 3 used`} className="w-10 text-right text-meta text-ink2 tabular-nums">
                  {(elapsed / 1000).toFixed(1)} s
                </span>
              </div>
              {recent.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="m-0 text-meta font-bold text-ink2">Last few</p>
                  <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                    {recent.map((r, i) => (
                      <li
                        key={`${r.kana}-${i}`}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-chip px-2.5 text-meta text-on-cover ${r.ok ? "bg-good-soft" : "bg-again-soft"}`}
                      >
                        <span lang="ja" className="font-ja text-body">
                          {r.kana}
                        </span>
                        <span>{r.romaji}</span>
                        <b className="font-black">{r.mark}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <Button variant="secondary" onClick={() => answerKana("", true)}>
                  I don’t know
                </Button>
                <Button variant="text" onClick={() => next()}>
                  Skip
                </Button>
              </div>
              <div className="mt-auto">
                <Note icon="info">Right within 3 seconds counts as known. Wrong or slower goes into your new cards.</Note>
              </div>
            </>
          ) : item ? (
            <>
              <NotebookCard
                label={`${item.kind === "kanji" ? "Kanji" : "Word"} ${index + 1} of ${items.length}${shown ? ", answer" : ""}`}
                sheets={["butter", "blue"]}
                rules={2}
                className="min-h-64"
              >
                <div className="flex items-center justify-between">
                  <Chip cover="butter" size="lg">
                    {shown ? "answer shown" : "say it to yourself"}
                  </Chip>
                  <Chip cover="blue" size="lg">
                    {item.kind === "kanji" ? "Kanji · N5" : "Word · N5"}
                  </Chip>
                </div>
                {shown ? (
                  <>
                    <div className="mt-4.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p lang="ja" className="m-0 font-ja text-display tracking-wide">
                          {item.term}
                        </p>
                        {item.kind === "word" && item.reading && item.reading !== item.term && (
                          <p lang="ja" className="m-0 font-ja text-title tracking-wide text-ink2">
                            {item.reading}
                          </p>
                        )}
                      </div>
                      {item.kind === "word" && <SpeakButton variant="round-sm" text={item.reading || item.term} label="Play the word" />}
                    </div>
                    <p className="m-0 mt-3 text-headline font-black">{item.meaning}</p>
                    {item.example && (
                      <>
                        <Rule className="mt-4 mb-2.5" />
                        <p className="m-0 font-ja text-title leading-ja">
                          <Ruby text={item.example.ja} furigana={props.furigana} />
                        </p>
                        <p className="m-0 text-body text-ink2">{item.example.en}</p>
                      </>
                    )}
                  </>
                ) : (
                  <p lang="ja" className={`m-0 mt-8 text-center font-ja tracking-wide ${bigTerm(item.term)}`}>
                    {item.term}
                  </p>
                )}
              </NotebookCard>

              <div className="mt-3 flex flex-col gap-3">
                {!shown ? (
                  <Button size="lg" full onClick={() => setShown(true)}>
                    Show answer
                  </Button>
                ) : (
                  <>
                    <p className="m-0 text-center text-body font-bold text-ink2">Did you know it?</p>
                    <VerdictButtons
                      label="Did you know it?"
                      onChoose={choose}
                      options={[
                        { value: "unknown", label: "Forgot", hint: "new card", fill: "again" },
                        { value: "unsure", label: "Unsure", hint: "goes first", fill: "warn" },
                        { value: "known", label: "Knew it", hint: "long wait", fill: "good" },
                      ]}
                    />
                  </>
                )}
                <p className="m-0 text-center text-meta text-ink2">
                  So far: <b className="font-black text-good">Knew it {tally.known}</b> · <b className="font-black text-ink">Unsure {tally.unsure}</b> ·{" "}
                  <b className="font-black text-again">Forgot {tally.unknown}</b>
                </p>
              </div>
              <div className="mt-auto pt-2">
                <Note icon="info">About 1 in 5 “Knew it” answers gets a quick question to be sure. Known words come back over the next 4 weeks.</Note>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </VoiceProvider>
  );
}

function SpotCheck({
  spot,
  onChoose,
  onNext,
}: {
  spot: Spot;
  onChoose: (i: number) => void;
  onNext: () => void;
}) {
  const answered = spot.chosen !== null;
  return (
    <div className="mt-2 flex flex-col gap-3">
      <p className="m-0 text-center text-body font-bold">
        A quick question: what does{" "}
        <span lang="ja" className="font-ja">
          {spot.item.term}
        </span>{" "}
        mean?
      </p>
      <div role="group" aria-label="Options" className="flex flex-col gap-3">
        {spot.options.map((option, i) => {
          const right = i === spot.answerIndex;
          const state = !answered ? "idle" : right ? "right" : i === spot.chosen ? "wrong" : "quiet";
          return (
            <Choice key={option} n={i + 1} state={state} pressed={spot.chosen === i} disabled={answered} onClick={() => onChoose(i)}>
              <span className="text-lead font-bold">{option}</span>
            </Choice>
          );
        })}
      </div>
      {answered && (
        <>
          <p className="m-0 text-body text-ink2" aria-live="polite">
            {spot.chosen === spot.answerIndex
              ? "Right. It stays known and comes back in a few weeks."
              : `It means “${spot.options[spot.answerIndex]}”, so it goes first in your new cards instead.`}
          </p>
          <Button size="lg" full onClick={onNext} iconEnd="arrow-right">
            Next
          </Button>
        </>
      )}
    </div>
  );
}

function QuickCheckDone(props: {
  tally: Record<Verdict, number>;
  day: number;
  finished: boolean;
  leftAfter: number;
  upNext: UpNext | null;
  outbox: ReturnType<typeof useOutbox>;
}) {
  const { tally } = props;
  const total = tally.known + tally.unsure + tally.unknown;
  return (
    <DoneShell>
      <DoneTop label="Close the quick check" />
      <DoneHead title={props.finished ? "Done for today" : "Stopped for now"} tick={props.finished && total > 0}>
        <p className="m-0 mt-0.5 text-body text-ink2">
          Quick check · day {Math.min(props.day, 3)} of 3 · {total} {total === 1 ? "item" : "items"} checked
        </p>
        {total > 0 && (
          <div className="mt-1">
            <SaveState state={props.outbox} saving />
          </div>
        )}
      </DoneHead>
      <section aria-label="How it went" className="mt-6.5 border-t-[1.5px] border-line pt-5">
        <StatGrid cols={3}>
          <StatTile value={tally.known} label="knew it" tone="good" size="lg" />
          <StatTile value={tally.unsure} label="unsure" size="lg" />
          <StatTile value={tally.unknown} label="forgot" tone="again" size="lg" />
        </StatGrid>
      </section>
      <div className="mt-5">
        <Note icon="info">
          <p className="m-0">What you knew comes back over the next 4 weeks, at most 30 a day. Unsure and forgotten items go first in your new cards.</p>
          {props.leftAfter > 0 && (
            <p className="m-0 text-ink2">
              {props.leftAfter} items are left for {props.day < 3 ? "the next days" : "another day"}.
            </p>
          )}
        </Note>
      </div>
      {props.leftAfter > 0 && (
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" href="/quick-check?more=1" iconEnd="arrow-right">
            Keep going now
          </Button>
        </div>
      )}
      {props.outbox.offline && (
        <div className="mt-4">
          <NoSignal />
        </div>
      )}
      {props.upNext && (
        <div className="mt-6">
          <UpNextCard upNext={props.upNext} offline={props.outbox.offline} />
        </div>
      )}
      <div className="mt-2 flex justify-center">
        <Button variant="quiet" href="/">
          Back to Today
        </Button>
      </div>
    </DoneShell>
  );
}
