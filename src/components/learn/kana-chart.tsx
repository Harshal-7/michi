"use client";

import { useState } from "react";

import { PlayPill, useSpeak, VoiceProvider } from "@/components/cards/voice";
import { Ruby } from "@/components/ruby";
import type { ChartSection, KanaCell, KanaStatus } from "@/lib/learn/kana";
import type { VoicePrefs } from "@/lib/voice/voices";

const STATUS_LABEL: Record<KanaStatus, string> = { review: "In your reviews", learning: "Learning", new: "Not started" };
const DOT: Record<KanaStatus, string> = { review: "bg-good", learning: "bg-accent", new: "" };
const hasKanji = (s: string) => /[一-鿿々]/.test(s);

/**
 * A kana chart: tap a character to hear it; the card above the table shows its example word,
 * look-alikes and where its card has got. The card sticks to the top while the table scrolls.
 */
export function KanaChart({ sections, voice, furigana }: { sections: ChartSection[]; voice: VoicePrefs; furigana: boolean }) {
  return (
    <VoiceProvider prefs={voice}>
      <Chart sections={sections} furigana={furigana} />
    </VoiceProvider>
  );
}

function Chart({ sections, furigana }: { sections: ChartSection[]; furigana: boolean }) {
  const say = useSpeak();
  const all = sections.flatMap((s) => s.rows.flat()).filter((c): c is KanaCell => c !== null);
  const [selected, setSelected] = useState<KanaCell | null>(null);
  const pick = (cell: KanaCell) => {
    setSelected(cell);
    say(cell.kana);
  };
  const byKana = new Map(all.map((c) => [c.kana, c]));

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 bg-page px-4 pt-1 pb-2 laptop:mx-0 laptop:px-0">
        <Detail cell={selected} furigana={furigana} onPick={pick} byKana={byKana} />
      </div>
      {sections.map((section) => (
        <section key={section.group} aria-label={section.title} className="flex flex-col gap-2 rounded-card bg-surface p-3 shadow-card">
          <h2 className="m-0 text-[13px] font-bold">{section.title}</h2>
          <div className={`grid gap-1.5 ${section.cols === 3 ? "grid-cols-3" : "grid-cols-5"}`}>
            {section.rows.flat().map((cell, i) =>
              cell ? (
                <button
                  key={cell.id}
                  type="button"
                  aria-pressed={selected?.id === cell.id}
                  aria-label={`${cell.kana}, ${cell.romaji}, ${STATUS_LABEL[cell.status].toLowerCase()}`}
                  onClick={() => pick(cell)}
                  className={`relative flex min-h-14 flex-col items-center justify-center rounded-[14px] border ${
                    selected?.id === cell.id ? "border-accent bg-accent-soft" : "border-transparent bg-surface2"
                  }`}
                >
                  <span lang="ja" className="font-card text-[24px] leading-[1.2] font-semibold">
                    {cell.kana}
                  </span>
                  <span className="text-[11px] text-ink2">{cell.romaji}</span>
                  {cell.status !== "new" && (
                    <span aria-hidden="true" className={`absolute top-1.5 right-1.5 size-1.5 rounded-full ${DOT[cell.status]}`} />
                  )}
                </button>
              ) : (
                <span key={`gap-${i}`} aria-hidden="true" />
              ),
            )}
          </div>
        </section>
      ))}
    </>
  );
}

function Detail({
  cell,
  furigana,
  onPick,
  byKana,
}: {
  cell: KanaCell | null;
  furigana: boolean;
  onPick: (c: KanaCell) => void;
  byKana: Map<string, KanaCell>;
}) {
  if (!cell) {
    return (
      <div className="flex min-h-[92px] items-center rounded-card bg-surface px-4 shadow-card">
        <p className="m-0 text-[13px] text-ink2">Tap a character to hear it and see an example word.</p>
      </div>
    );
  }
  const ex = cell.example;
  const looks = cell.lookalikes.map((k) => byKana.get(k)).filter((c): c is KanaCell => c !== undefined);
  return (
    <div aria-live="polite" className="flex min-h-[92px] items-center gap-4 rounded-card bg-surface px-4 py-2.5 shadow-card">
      <div className="flex w-16 shrink-0 flex-col items-center">
        <span lang="ja" className="font-card text-[44px] leading-[1.15] font-semibold">
          {cell.kana}
        </span>
        <span className="text-[13px] font-semibold">{cell.romaji}</span>
      </div>
      <div className="flex min-w-0 flex-auto flex-col gap-1">
        {ex && (
          <p className="m-0 flex flex-wrap items-baseline gap-x-2">
            <span className="font-card text-[19px] leading-[1.7]">
              <Ruby text={hasKanji(ex.term) && ex.reading ? `{${ex.term}|${ex.reading}}` : ex.term} furigana={furigana} />
            </span>
            <span className="text-[13px] text-ink2">{ex.meaning}</span>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <PlayPill text={cell.kana}>Sound</PlayPill>
          {ex && <PlayPill text={ex.reading || ex.term}>Word</PlayPill>}
        </div>
        <p className="m-0 flex flex-wrap items-center gap-x-2 text-xs text-ink2">
          <span>{STATUS_LABEL[cell.status]}</span>
          {looks.length > 0 && (
            <span className="inline-flex flex-wrap items-center gap-1">
              · Don&apos;t mix up with
              {looks.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => onPick(l)}
                  className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-btn border border-line bg-surface px-2 font-card text-[15px] text-ink"
                >
                  <span lang="ja">{l.kana}</span>
                </button>
              ))}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
