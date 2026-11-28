"use client";

import { toPlain } from "@content/schema";
import { type ReactNode, useEffect } from "react";

import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Mixed, Ruby } from "@/components/ui/ruby";
import { SpeakButton } from "@/components/ui/speak-button";
import { useSpeak } from "@/components/ui/voice";
import { type Asked, TYPE_LABEL, UNDERLINE } from "@/lib/quiz/types";

import { Choice } from "./choice";

const MARK = "underline decoration-2 underline-offset-6";

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
    <p className="m-0 font-ja text-title leading-ja">
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
 * One question (RF_QuizQuestion): the type chip, the question on a card, four options and, once
 * answered, which was right and why. `chosen` is the option picked, or null. `aside` sits right of
 * the chip ("2 right · 1 to review").
 */
export function QuestionView({
  asked,
  chosen,
  onChoose,
  furigana,
  disabled = false,
  aside,
}: {
  asked: Asked;
  chosen: number | null;
  onChoose: (index: number) => void;
  furigana: boolean;
  disabled?: boolean;
  aside?: ReactNode;
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
      <div className="flex items-center justify-between gap-3">
        <Chip cover="lilac" size="lg">
          {TYPE_LABEL[asked.type]}
        </Chip>
        {aside && <span className="text-meta text-ink2">{aside}</span>}
      </div>

      <Card className="flex flex-col px-4.5 pt-6 pb-5.5">
        {asked.say && (
          <div className="mb-3 flex items-center gap-3">
            <SpeakButton text={asked.say} label="Play again" />
            <span className="text-meta text-ink2">Tap to hear it again</span>
          </div>
        )}
        {asked.ja && (
          <p className={`m-0 font-ja leading-ja ${asked.big ? "text-display" : "text-title"}`}>
            <AskedJa ja={asked.ja} furigana={furigana} filled={answered} />
          </p>
        )}
        {asked.order && <OrderLine asked={asked} furigana={furigana} filled={answered} />}
        {asked.en && (
          <p className={`m-0 ${asked.big && !asked.ja ? "text-headline font-black" : "mt-1 text-body text-ink2"}`}>
            {asked.type === "kana" ? <span className="font-bold">{asked.en}</span> : asked.en}
          </p>
        )}
        <div aria-hidden="true" className="mt-3.5 mb-3 h-px bg-line" />
        <p className="m-0 text-lead font-bold">{asked.instruction}</p>
      </Card>

      <div className="mt-1 flex flex-col gap-3" role="group" aria-label="Options">
        {asked.options.map((option, i) => {
          const state = !answered ? "idle" : i === right ? "right" : i === chosen ? "wrong" : "quiet";
          return (
            <Choice key={`${i}-${option}`} n={i + 1} state={state} pressed={chosen === i} disabled={answered || disabled} onClick={() => onChoose(i)}>
              {asked.optionsLang === "ja" ? (
                <Ruby text={option} furigana={furigana} className="font-ja text-title" />
              ) : (
                <span className="text-lead font-bold">{option}</span>
              )}
            </Choice>
          );
        })}
      </div>

      {answered ? (
        <div className="flex flex-col gap-1" aria-live="polite">
          <p className="m-0 text-body text-ink2">
            <span className={`font-bold ${chosen === right ? "text-good" : "text-again"}`}>{chosen === right ? "Right." : "Not quite."}</span>{" "}
            {asked.explain && <Mixed text={asked.explain} furigana={furigana} />}
          </p>
          {asked.full && (
            <p className="m-0 text-body text-ink2">
              <Ruby text={asked.full.ja} furigana={furigana} className="font-ja text-ink" /> {asked.full.en}
            </p>
          )}
        </div>
      ) : (
        <p className="m-0 flex items-center justify-center gap-2 text-meta text-ink2 max-laptop:hidden">
          <Icon name="keyboard" size={18} className="text-ink3" />
          Press 1–4 to choose, then Enter
        </p>
      )}
    </>
  );
}

/** Plain text of an option, for labels. */
export const optionText = (asked: Asked, i: number) => toPlain(asked.options[i] ?? "");
