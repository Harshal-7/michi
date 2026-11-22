"use client";

import { createContext, type ReactNode, useCallback, useContext } from "react";

import { Icon } from "@/components/ui/icon";
import { speak } from "@/lib/voice/speak";
import type { VoicePrefs } from "@/lib/voice/voices";

const SPEAKER = "M4 9.5h3.5L12 5.5v13l-4.5-4H4z M15.5 9a4 4 0 0 1 0 6";
const SPEAKER_LOUD = "M4 9.5h3.5L12 5.5v13l-4.5-4H4z M15.5 9a4 4 0 0 1 0 6 M18 6.5a7.5 7.5 0 0 1 0 11";

const VoiceContext = createContext<VoicePrefs>({ name: null, rate: 1 });

/** The voice and speed from Settings, for every play button inside. */
export function VoiceProvider({ prefs, children }: { prefs: VoicePrefs; children: ReactNode }) {
  return <VoiceContext.Provider value={prefs}>{children}</VoiceContext.Provider>;
}

export function useSpeak(): (text: string) => void {
  const prefs = useContext(VoiceContext);
  return useCallback((text: string) => void speak(text, prefs), [prefs]);
}

/** The round play button on a card's front (F_ReviewFront). */
export function PlayRound({ text, label }: { text: string; label: string }) {
  const say = useSpeak();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => say(text)}
      className="inline-flex size-[52px] items-center justify-center rounded-full border border-line bg-surface2 text-ink"
    >
      <Icon d={SPEAKER_LOUD} size={22} stroke={1.7} />
    </button>
  );
}

/** The pill play buttons on a card's back: "Word", "Sentence" (F_ReviewBack). */
export function PlayPill({ text, children, lang }: { text: string; children: ReactNode; lang?: string }) {
  const say = useSpeak();
  return (
    <button
      type="button"
      onClick={() => say(text)}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-btn border border-line bg-surface2 px-3.5 text-[13px] font-semibold text-ink"
    >
      <Icon d={SPEAKER} size={18} stroke={1.7} />
      <span lang={lang}>{children}</span>
    </button>
  );
}
