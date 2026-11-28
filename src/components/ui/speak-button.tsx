"use client";

import type { ReactNode } from "react";

import { Icon } from "./icon";
import { useSpeak } from "./voice";

/**
 * Plays Japanese aloud (inside a VoiceProvider, with the voice from Settings). One part for every play
 * button: `round` 56 on a card's front, `round-sm` 52 on its back, `icon` 44 beside an example line, and
 * `pill` with a label ("Word", "Sentence", "Sound").
 *
 * @example <SpeakButton text={card.reading} label="Play the word" />
 * <SpeakButton variant="pill" text={ex.ja}>Sentence</SpeakButton>
 */
export function SpeakButton({
  text,
  label,
  variant = "round",
  lang,
  children,
}: {
  /** What to say (kana or kanji). */
  text: string;
  /** The button's name for screen readers; the pill's visible text names it otherwise. */
  label?: string;
  /** round 56 · round-sm 52 · icon 44 · pill (with children as its label). */
  variant?: "round" | "round-sm" | "icon" | "pill";
  /** The pill label's language ("ja" when the label is Japanese). */
  lang?: string;
  /** The pill's label. */
  children?: ReactNode;
}) {
  const say = useSpeak();
  if (variant === "pill") {
    return (
      <button
        type="button"
        aria-label={label}
        onClick={() => say(text)}
        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-pill bg-accent-soft pr-4 pl-3 text-meta font-bold text-accent transition-colors duration-120 hover:bg-cover-blue hover:text-on-cover"
      >
        <Icon name="speaker" size={18} />
        <span lang={lang}>{children}</span>
      </button>
    );
  }
  const size = { round: "size-14", "round-sm": "size-13", icon: "size-11" }[variant];
  return (
    <button
      type="button"
      aria-label={label ?? "Play"}
      title={label}
      onClick={() => say(text)}
      className={`inline-grid shrink-0 place-items-center rounded-full bg-accent-soft text-accent transition-colors duration-120 hover:bg-cover-blue hover:text-on-cover ${size}`}
    >
      <Icon name="speaker" size={variant === "icon" ? 20 : 26} />
    </button>
  );
}
