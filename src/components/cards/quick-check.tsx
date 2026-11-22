"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Ruby } from "@/components/ruby";
import { Icon } from "@/components/ui/icon";
import { getOutbox, useOutbox } from "@/lib/srs/outbox";
import type { CheckItem } from "@/lib/srs/quick-check";
import { FAST_MS, kanaVerdict, romajiMatches, SPOT_CHECK_EVERY, spotOptions } from "@/lib/srs/quick-check-rules";
import type { UpNext } from "@/lib/srs/types";
import type { VoicePrefs } from "@/lib/voice/voices";

import { UpNextCard } from "./session-done";
import { NoSignal, SaveNotes, SaveState, WaitingChip } from "./status";
import { PlayPill, VoiceProvider } from "./voice";

type Verdict = "known" | "unsure" | "unknown";
type Recent = { kana: string; romaji: string; ok: boolean; mark: string };
type Spot = { item: CheckItem; options: string[]; answerIndex: number; chosen: number | null };

/** A held-back "Knew it" is asked this many cards later, so its answer isn't fresh. */
const SPOT_DELAY = 3;

const X_ICON = "M6 6l12 12 M18 6L6 18";
const CHECK = "M5 12.5l4.5 4.5L19 7.5";

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
  const outbox = useOutbox();
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

  const item = props.items[index] ?? null;
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
      if (holding && (nextIndex >= holding.askAt || nextIndex >= props.items.length)) {
        const pool = holding.item.kind === "kanji" ? props.pool.kanji : props.pool.word;
        const { options, answerIndex } = spotOptions(holding.item.meaning, pool);
        if (options.length === 4) setSpot({ item: holding.item, options, answerIndex, chosen: null });
        else record(holding.item, "known", null);
        setHeld(null);
      } else setHeld(holding);
    },
    [held, index, props.items.length, props.pool, record],
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
        leftAfter={props.leftAfter + Math.max(0, props.items.length - index)}
        upNext={props.upNext}
        outbox={outbox}
      />
    );
  }

  const kind = spot ? spot.item.kind : item!.kind;
  const kindTitle = kind === "kana" ? "kana" : kind === "kanji" ? "N5 kanji" : "N5 words";
  const progress = Math.round((index / props.items.length) * 100);
  const elapsed = Math.max(0, now - startedAt);

  return (
    <VoiceProvider prefs={props.voice}>
      <div className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-page laptop:static laptop:z-auto laptop:overflow-visible laptop:bg-transparent">
        <header className="flex shrink-0 flex-col gap-2.5 px-3 pt-[max(12px,env(safe-area-inset-top))] pb-2 laptop:px-0 laptop:pt-0">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Stop the quick check"
              onClick={stop}
              className="inline-flex size-11 items-center justify-center rounded-btn text-ink2"
            >
              <Icon d={X_ICON} size={22} stroke={1.8} />
            </button>
            <p className="m-0 text-[15px] font-bold">Quick check · {kindTitle}</p>
            <p className="m-0 min-w-11 text-right text-[13px] text-ink2">
              {index} / {props.items.length}
            </p>
          </div>
          <div
            role="img"
            aria-label={`${index} of ${props.items.length} checked`}
            className="mx-1.5 h-1 overflow-hidden rounded-full bg-track"
          >
            <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex flex-col gap-2 empty:hidden">
            <WaitingChip state={outbox} />
            <SaveNotes state={outbox} />
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[640px] flex-auto flex-col gap-4 px-5 pt-2 pb-5 laptop:px-0">
          {spot ? (
            <>
              <article className="flex shrink-0 flex-col items-center gap-2.5 rounded-card bg-surface p-[18px] shadow-card">
                <p className="m-0 self-start text-xs font-semibold text-ink2">
                  {spot.item.kind === "kanji" ? "Kanji" : "Word"} · you said you knew it
                </p>
                <p lang="ja" className={`m-0 mt-2 font-card leading-[1.1] font-semibold ${[...spot.item.term].length > 3 ? "text-[56px]" : "text-[84px]"}`}>
                  {spot.item.term}
                </p>
              </article>
              <SpotCheck spot={spot} onChoose={answerSpot} onNext={() => setSpot(null)} />
            </>
          ) : isKana && item ? (
            <>
              <p className="m-0 self-center rounded-full bg-accent-soft px-3 py-1 text-[12.5px] font-semibold">
                Day {Math.min(props.day, 3)} of 3 · kana first
              </p>
              <section className="flex h-[230px] shrink-0 flex-col items-center justify-center gap-1 rounded-card bg-surface shadow-card">
                <p className="m-0 text-xs font-semibold text-ink2">{item.script === "katakana" ? "Katakana" : "Hiragana"}</p>
                <p lang="ja" className="m-0 font-card text-[124px] leading-[1.1] font-semibold">
                  {item.term}
                </p>
              </section>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  answerKana(typed, true);
                }}
              >
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink2">
                  Type the romaji
                  <input
                    ref={input}
                    type="text"
                    value={typed}
                    onChange={(e) => answerKana(e.target.value, false)}
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="next"
                    className="box-border min-h-[54px] rounded-btn border-2 border-accent bg-surface px-4 text-[22px] font-bold tracking-[0.04em] text-ink outline-none"
                  />
                </label>
              </form>
              <div className="flex items-center gap-2.5">
                <div
                  role="img"
                  aria-label={`${(elapsed / 1000).toFixed(1)} seconds of 3 used`}
                  className="h-1.5 flex-auto overflow-hidden rounded-full bg-track"
                >
                  <div
                    className={`h-full ${elapsed <= FAST_MS ? "bg-good" : "bg-warn"}`}
                    style={{ width: `${Math.min(100, (elapsed / FAST_MS) * 100)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-[12.5px] text-ink2">{(elapsed / 1000).toFixed(1)} s</span>
              </div>
              {recent.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="m-0 text-xs font-semibold text-ink2">Last few</p>
                  <div className="flex flex-wrap gap-1.5">
                    {recent.map((r, i) => (
                      <span
                        key={`${r.kana}-${i}`}
                        className={`inline-flex items-baseline gap-1.5 rounded-full border px-2.5 py-[5px] text-[13px] ${r.ok ? "border-good text-good" : "border-again text-again"}`}
                      >
                        <span lang="ja" className="font-card text-base font-semibold">
                          {r.kana}
                        </span>
                        <span>{r.romaji}</span>
                        <span className="font-bold">{r.mark}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => answerKana("", true)}
                  className="min-h-[50px] rounded-btn border border-line bg-surface text-[15px] font-bold"
                >
                  I don&apos;t know
                </button>
                <button type="button" onClick={() => next()} className="min-h-[50px] rounded-btn text-[15px] font-semibold text-ink2">
                  Skip
                </button>
              </div>
              <p className="m-0 mt-auto text-center text-[12.5px] leading-normal text-ink2">
                Fast and right counts as known. Wrong or slow goes into your new cards.
              </p>
            </>
          ) : item ? (
            <>
              <article className="flex shrink-0 flex-col items-center gap-2.5 rounded-card bg-surface p-[18px] shadow-card">
                <p className="m-0 self-start text-xs font-semibold text-ink2">
                  {item.kind === "kanji" ? "Kanji" : "Word"} · N5 · {shown ? "answer shown" : "say it to yourself"}
                </p>
                <p lang="ja" className={`m-0 mt-2 font-card leading-[1.1] font-semibold ${[...item.term].length > 3 ? "text-[56px]" : "text-[84px]"}`}>
                  {item.term}
                </p>
                {shown && (
                  <>
                    {item.kind === "word" && item.reading && item.reading !== item.term && (
                      <p lang="ja" className="m-0 text-xl text-ink2">
                        {item.reading}
                      </p>
                    )}
                    <p className="m-0 text-center font-head text-[26px] leading-tight">{item.meaning}</p>
                    {item.kind === "word" && <PlayPill text={item.reading || item.term}>Word</PlayPill>}
                    {item.example && (
                      <>
                        <div className="h-px w-full bg-line" />
                        <p className="m-0 text-center font-card text-xl leading-[1.9]">
                          <Ruby text={item.example.ja} furigana={props.furigana} />
                        </p>
                        <p className="m-0 text-center text-sm text-ink2">{item.example.en}</p>
                      </>
                    )}
                  </>
                )}
              </article>

              {!shown ? (
                <button
                  type="button"
                  onClick={() => setShown(true)}
                  className="min-h-14 rounded-btn bg-accent text-[17px] font-bold text-on-accent"
                >
                  Show answer
                </button>
              ) : (
                <>
                  <p className="m-0 text-center text-[15px] font-semibold">Did you know it?</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ["unknown", "Forgot", "new card", "text-again"],
                        ["unsure", "Unsure", "goes first", "text-ink"],
                        ["known", "Knew it", "long wait", "text-good"],
                      ] as const
                    ).map(([verdict, label, hint, color]) => (
                      <button
                        key={verdict}
                        type="button"
                        onClick={() => choose(verdict)}
                        className="flex min-h-[72px] flex-col items-center justify-center gap-0.5 rounded-card border border-line bg-surface px-1 py-2 shadow-card"
                      >
                        <span className={`text-base font-bold ${color}`}>{label}</span>
                        <span className="text-xs text-ink2">{hint}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              <p className="m-0 text-center text-[13.5px]">
                <span className="font-bold text-good">Knew it {tally.known}</span> ·{" "}
                <span className="font-bold">Unsure {tally.unsure}</span> ·{" "}
                <span className="font-bold text-again">Forgot {tally.unknown}</span>
              </p>
              <p className="m-0 mt-auto text-center text-[12.5px] leading-normal text-ink2">
                About 1 in 5 “Knew it” answers gets a quick check question. Known words come back over the next 4 weeks.
              </p>
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
    <div className="flex flex-col gap-2">
      <p className="m-0 text-center text-[15px] font-semibold">
        Quick check: what does{" "}
        <span lang="ja" className="font-card">
          {spot.item.term}
        </span>{" "}
        mean?
      </p>
      {spot.options.map((option, i) => {
        const right = i === spot.answerIndex;
        const style = answered && right ? "border-2 border-good" : answered && i === spot.chosen ? "border-2 border-again" : "border border-line";
        return (
          <button
            key={option}
            type="button"
            aria-pressed={spot.chosen === i}
            disabled={answered}
            onClick={() => onChoose(i)}
            className={`flex min-h-14 items-center justify-between gap-2.5 rounded-btn bg-surface px-4 text-left ${style}`}
          >
            <span className="flex items-center gap-3">
              <span className="text-[13px] font-bold text-ink2">{i + 1}</span>
              <span className="text-base font-semibold">{option}</span>
            </span>
            {answered && right && (
              <span className="inline-flex items-center gap-1 text-[13px] font-bold text-good">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={CHECK} />
                </svg>
                Right
              </span>
            )}
          </button>
        );
      })}
      {answered && (
        <>
          <p className="m-0 text-sm text-ink2">
            {spot.chosen === spot.answerIndex
              ? "Right. It stays known and comes back in a few weeks."
              : `It means “${spot.options[spot.answerIndex]}”, so it goes first in your new cards instead.`}
          </p>
          <button type="button" onClick={onNext} className="min-h-[54px] rounded-btn bg-accent text-base font-bold text-on-accent">
            Next
          </button>
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
    <>
      <header className="flex flex-col gap-0.5">
        <p className="m-0 text-[13px] text-ink2">Quick check · day {props.day} of 3</p>
        <h1 className="m-0 font-head text-[30px] leading-[1.15]">{props.finished ? "Done for today" : "Stopped for now"}</h1>
      </header>
      <section className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <p className="m-0 font-head text-[40px] leading-none">{total}</p>
          <p className="m-0 text-[15px] text-ink2">{total === 1 ? "item" : "items"} checked</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["Knew it", tally.known, "text-good"],
              ["Unsure", tally.unsure, "text-ink"],
              ["Forgot", tally.unknown, "text-again"],
            ] as const
          ).map(([label, n, color]) => (
            <div key={label} className="flex flex-col items-center gap-0.5 rounded-[14px] bg-surface2 px-1.5 py-2.5">
              <span className="text-xl font-bold">{n}</span>
              <span className={`text-[12.5px] font-bold ${color}`}>{label}</span>
            </div>
          ))}
        </div>
        {total > 0 && <SaveState state={props.outbox} />}
      </section>
      <section className="flex flex-col gap-1.5 rounded-card bg-surface px-3.5 py-3 shadow-card">
        <p className="m-0 text-sm">
          What you knew comes back over the next 4 weeks, at most 30 a day. Unsure and forgotten items go first in your new
          cards.
        </p>
        {props.leftAfter > 0 && (
          <p className="m-0 text-sm text-ink2">
            {props.leftAfter} items are left for {props.day < 3 ? "the next days" : "another day"}.{" "}
            <Link href="/quick-check?more=1" className="font-semibold text-ink">
              Keep going now
            </Link>
          </p>
        )}
      </section>
      {props.outbox.offline && <NoSignal />}
      {props.upNext && <UpNextCard upNext={props.upNext} offline={props.outbox.offline} />}
      <Link href="/" className="inline-flex min-h-11 items-center self-center text-sm font-semibold text-ink2">
        Back to Today
      </Link>
    </>
  );
}
