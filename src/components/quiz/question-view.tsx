"use client";
// design-lint: legacy

import { toPlain } from "@content/schema";
import { useEffect } from "react";

import { useSpeak } from "@/components/ui/voice";
import { SpeakButton } from "@/components/ui/speak-button";
import { Mixed, Ruby } from "@/components/ui/ruby";
import { Icon } from "@/components/ui/icon";
import { type Asked, TYPE_LABEL, UNDERLINE } from "@/lib/quiz/types";

const CHECK = "M5 12.5l4.5 4.5L19 7.5";
const CROSS = "M6 6l12 12 M18 6L6 18";
const MARK = "font-semibold underline decoration-2 underline-offset-[6px]";

/** Japanese with the quiz's marks: ⟨word⟩ underlined without furigana, [[blank]] as a gap. */
export function AskedJa({ ja, furigana, filled = false }: { ja: string; furigana: boolean; filled?: boolean }) {
  const m = UNDERLINE.exec(ja);
  if (!m) return <Ruby text={ja} furigana={furigana} blank={filled ? "fill" : "hide"} />;
  const [before, after] = [ja.slice(0, m.index), ja.slice(m.index + m[0].length)];
  return (
    <span lang="ja">
      <Ruby text={before} furigana={furigana} />
      <span className={MARK}>{m[1]}</span>
      <Ruby text={after} furigana={furigana} />
    </span>
  );
}

/** The ★ line of a sentence-order question: the sentence's start, four slots, its end. */
function OrderLine({ asked, furigana, filled }: { asked: Asked; furigana: boolean; filled: boolean }) {
  const order = asked.order!;
  const right = asked.options[asked.answer];
  return (
    <p className="m-0 font-card text-[22px] leading-[2]">
      {order.before && <Ruby text={order.before} furigana={furigana} />}
      {[0, 1, 2, 3].map((i) => (
        <span key={i} lang="ja" className="mx-1 inline-block min-w-[2.6em] border-b-2 border-ink2 text-center text-ink2">
          {i === order.star ? (filled ? <Ruby text={right} furigana={furigana} className="font-semibold text-ink" /> : "★") : "　"}
        </span>
      ))}
      {order.after && <Ruby text={order.after} furigana={furigana} />}
    </p>
  );
}

/**
 * One question (F_QuizQuestion): the type chip, the card, four options and, once answered, which
 * was right and why. `chosen` is the option picked, or null.
 */
export function QuestionView({
  asked,
  chosen,
  onChoose,
  furigana,
  disabled = false,
}: {
  asked: Asked;
  chosen: number | null;
  onChoose: (index: number) => void;
  furigana: boolean;
  disabled?: boolean;
}) {
  const say = useSpeak();
  const answered = chosen !== null;
  const right = asked.answer;

  // Listening plays as it appears.
  useEffect(() => {
    if (asked.say) say(asked.say);
  }, [asked.say, say]);

  return (
    <>
      <p className="m-0 self-start rounded-btn bg-accent-soft px-3 py-1 text-[12.5px] font-bold">{TYPE_LABEL[asked.type]}</p>

      <section className="flex flex-col gap-3.5 rounded-card bg-surface px-[18px] py-[22px] shadow-card">
        {asked.say && (
          <div className="flex items-center gap-3">
            <SpeakButton text={asked.say} label="Play again" />
            <span className="text-[13px] text-ink2">Tap to hear it again</span>
          </div>
        )}
        {asked.ja && (
          <p className={`m-0 font-card leading-[1.6] ${asked.big ? "text-[40px] font-semibold" : "text-[26px]"}`}>
            <AskedJa ja={asked.ja} furigana={furigana} filled={answered} />
          </p>
        )}
        {asked.order && <OrderLine asked={asked} furigana={furigana} filled={answered} />}
        {asked.en && (
          <p className={`m-0 ${asked.big && !asked.ja ? "font-head text-[26px] leading-[1.3]" : "text-[15px] text-ink2"}`}>
            {asked.type === "kana" ? <span className="font-bold">{asked.en}</span> : asked.en}
          </p>
        )}
        <p className="m-0 text-[15px] text-ink2">{asked.instruction}</p>
      </section>

      <div className="flex flex-col gap-2" role="group" aria-label="Options">
        {asked.options.map((option, i) => {
          const isRight = answered && i === right;
          const isWrongPick = answered && i === chosen && i !== right;
          return (
            <button
              key={`${i}-${option}`}
              type="button"
              aria-pressed={chosen === i}
              disabled={answered || disabled}
              onClick={() => onChoose(i)}
              className={`flex min-h-14 items-center justify-between gap-2.5 rounded-btn bg-surface px-4 text-left text-ink disabled:cursor-default ${
                isRight ? "border-2 border-good" : isWrongPick ? "border-2 border-again" : "border border-line"
              }`}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="text-[13px] font-bold text-ink2">{i + 1}</span>
                {asked.optionsLang === "ja" ? (
                  <Ruby text={option} furigana={furigana} className="text-[19px] font-semibold" />
                ) : (
                  <span className="text-[16px] font-semibold">{option}</span>
                )}
              </span>
              {isRight && (
                <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-good">
                  <Icon d={CHECK} size={18} stroke={2.2} />
                  Right
                </span>
              )}
              {isWrongPick && (
                <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-again">
                  <Icon d={CROSS} size={18} stroke={2.2} />
                  Yours
                </span>
              )}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="flex flex-col gap-1" aria-live="polite">
          <p className="m-0 text-sm text-ink2">
            <span className={`font-bold ${chosen === right ? "text-good" : "text-again"}`}>{chosen === right ? "Right." : "Not quite."}</span>{" "}
            {asked.explain && <Mixed text={asked.explain} furigana={furigana} />}
          </p>
          {asked.full && (
            <p className="m-0 text-sm text-ink2">
              <Ruby text={asked.full.ja} furigana={furigana} className="text-[15px] text-ink" /> {asked.full.en}
            </p>
          )}
        </div>
      )}
    </>
  );
}

/** Plain text of an option, for labels. */
export const optionText = (asked: Asked, i: number) => toPlain(asked.options[i] ?? "");
