"use client";

import { type ReactNode, useState } from "react";

import { Card } from "@/components/ui/card";
import { Ruby } from "@/components/ui/ruby";
import { SpeakButton } from "@/components/ui/speak-button";
import { useSpeak, VoiceProvider } from "@/components/ui/voice";
import type { ChartSection, KanaCell, KanaStatus } from "@/lib/learn/kana";
import type { VoicePrefs } from "@/lib/voice/voices";

const STATUS_LABEL: Record<KanaStatus, string> = { review: "In your reviews", learning: "Learning", new: "Not started" };
const DOT: Record<KanaStatus, string> = { review: "bg-good", learning: "bg-accent", new: "" };
const hasKanji = (s: string) => /[一-鿿々]/.test(s);

/**
 * A kana chart (RF_KanaChart): tap a character to hear it; the card above the table shows its example
 * word and look-alikes. The card sticks to the top while the table scrolls. On a laptop the card and
 * `footer` (the next step) sit in a column on the right that stays in view; on a wide screen the
 * tables also sit side by side.
 */
export function KanaChart({
  sections,
  voice,
  furigana,
  footer,
}: {
  sections: ChartSection[];
  voice: VoicePrefs;
  furigana: boolean;
  footer: ReactNode;
}) {
  return (
    <VoiceProvider prefs={voice}>
      <Chart sections={sections} furigana={furigana} footer={footer} />
    </VoiceProvider>
  );
}

function Legend() {
  const dot = "size-2.25 shrink-0 rounded-full";
  return (
    <p className="m-0 flex flex-wrap gap-x-3.5 gap-y-1.5 text-meta text-ink2">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className={`${dot} bg-good`} />
        In your reviews
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className={`${dot} bg-accent`} />
        Learning
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className={`${dot} border-[1.5px] border-ink3`} />
        Not started
      </span>
    </p>
  );
}

function Chart({ sections, furigana, footer }: { sections: ChartSection[]; furigana: boolean; footer: ReactNode }) {
  const say = useSpeak();
  const all = sections.flatMap((s) => s.rows.flat()).filter((c): c is KanaCell => c !== null);
  const [selected, setSelected] = useState<KanaCell | null>(null);
  const pick = (cell: KanaCell) => {
    setSelected(cell);
    say(cell.kana);
  };
  const byKana = new Map(all.map((c) => [c.kana, c]));

  const table = (section: ChartSection, first: boolean) => {
    const cells = section.rows.flat().filter((c): c is KanaCell => c !== null);
    const inReviews = cells.filter((c) => c.status === "review").length;
    return (
      <section key={section.group} aria-labelledby={`kana-${section.group}`} className="flex flex-col gap-2">
        <h2 id={`kana-${section.group}`} className="m-0 mt-1 text-lead font-black">
          {section.title}{" "}
          <span className="text-meta font-medium text-ink2">
            {inReviews} of {cells.length}
            {inReviews === cells.length ? " · all in your reviews" : " in your reviews"}
          </span>
        </h2>
        {first && <Legend />}
        <div className={`mt-1 grid gap-1.5 ${section.cols === 3 ? "grid-cols-3" : "grid-cols-5"}`}>
          {section.rows.flat().map((cell, i) =>
            cell ? (
              <button
                key={cell.id}
                type="button"
                aria-pressed={selected?.id === cell.id}
                aria-label={`${cell.kana}, ${cell.romaji}, ${STATUS_LABEL[cell.status].toLowerCase()}`}
                onClick={() => pick(cell)}
                className={`relative flex h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-btn border-[1.5px] transition-colors duration-120 ${
                  selected?.id === cell.id ? "border-accent bg-accent-soft" : "border-transparent bg-surface2 hover:border-line-strong"
                }`}
              >
                <span lang="ja" className="font-ja text-headline leading-none font-semibold">
                  {cell.kana}
                </span>
                <span className="text-caption leading-none text-ink2">{cell.romaji}</span>
                {cell.status !== "new" && <span aria-hidden="true" className={`absolute top-1.75 right-1.75 size-2 rounded-full ${DOT[cell.status]}`} />}
              </button>
            ) : (
              <span key={`gap-${i}`} aria-hidden="true" />
            ),
          )}
        </div>
      </section>
    );
  };
  const [first, ...rest] = sections;

  return (
    <div className="flex flex-col gap-3 laptop:grid laptop:grid-cols-[minmax(0,1fr)_320px] laptop:items-start laptop:gap-8">
      <div className="sticky top-0 z-chip -mx-5 bg-page px-5 pt-1 pb-2 laptop:top-8 laptop:col-start-2 laptop:row-start-1 laptop:mx-0 laptop:flex laptop:flex-col laptop:gap-3 laptop:bg-transparent laptop:p-0">
        <Detail cell={selected} furigana={furigana} onPick={pick} byKana={byKana} />
        <div className="hidden laptop:flex laptop:flex-col laptop:gap-2">{footer}</div>
      </div>
      {/* Wide: the first table (Basic) on the left, the others stacked beside it. */}
      <div className="flex flex-col gap-5 laptop:col-start-1 laptop:row-start-1 wide:grid wide:grid-cols-2 wide:items-start wide:gap-6">
        {first && <div className="flex flex-col gap-5">{table(first, true)}</div>}
        {rest.length > 0 && <div className="flex flex-col gap-5">{rest.map((s) => table(s, false))}</div>}
      </div>
      <div className="flex flex-col gap-2 laptop:hidden">{footer}</div>
    </div>
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
      <Card padding="none" className="flex min-h-22 items-center px-4 laptop:min-h-56 laptop:justify-center laptop:px-6 laptop:text-center">
        <p className="m-0 text-body text-ink2">Tap a character to hear it and see an example word.</p>
      </Card>
    );
  }
  const ex = cell.example;
  const looks = cell.lookalikes.map((k) => byKana.get(k)).filter((c): c is KanaCell => c !== undefined);
  return (
    <Card
      as="section"
      aria-live="polite"
      aria-label={`${cell.kana}, ${cell.romaji}, ${STATUS_LABEL[cell.status].toLowerCase()}`}
      padding="none"
      className="flex min-h-22 items-center gap-4 py-2.5 pr-3.5 pl-4 laptop:min-h-56 laptop:flex-col laptop:items-stretch laptop:gap-3 laptop:p-5"
    >
      <div className="flex w-13 shrink-0 flex-col items-center laptop:w-auto">
        <span lang="ja" className="font-ja text-display leading-tight font-semibold laptop:text-kana">
          {cell.kana}
        </span>
        <span className="text-meta leading-snug font-bold">{cell.romaji}</span>
      </div>
      <div className="flex min-w-0 flex-auto flex-col laptop:gap-1 laptop:border-t-[1.5px] laptop:border-line laptop:pt-3">
        {ex && (
          <p className="m-0 flex flex-wrap items-center gap-x-2">
            <span className="font-ja text-title leading-ja font-semibold">
              <Ruby text={hasKanji(ex.term) && ex.reading ? `{${ex.term}|${ex.reading}}` : ex.term} furigana={furigana} />
            </span>
            <span className="text-body font-bold">{ex.meaning}</span>
            <SpeakButton variant="icon" text={ex.reading || ex.term} label="Play the word" />
          </p>
        )}
        <p className="m-0 flex flex-wrap items-center gap-x-1.5 text-meta text-ink2">
          <span className="laptop:hidden">{looks.length > 0 ? "Looks like" : STATUS_LABEL[cell.status]}</span>
          <span className="max-laptop:hidden">
            {STATUS_LABEL[cell.status]}
            {looks.length > 0 && " · looks like"}
          </span>
          {looks.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onPick(l)}
              aria-label={`Show ${l.kana}`}
              className="inline-grid size-11 place-items-center rounded-btn font-ja text-lead font-semibold text-ink hover:bg-surface2"
            >
              <span lang="ja">{l.kana}</span>
            </button>
          ))}
        </p>
      </div>
      <div className="laptop:hidden">
        <SpeakButton variant="round-sm" text={cell.kana} label={`Play ${cell.kana}`} />
      </div>
      <div className="max-laptop:hidden">
        <SpeakButton variant="pill" text={cell.kana}>
          Sound
        </SpeakButton>
      </div>
    </Card>
  );
}
