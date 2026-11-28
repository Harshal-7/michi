"use client";

import { createContext, type ReactNode, useCallback, useContext } from "react";

import { speak } from "@/lib/voice/speak";
import type { VoicePrefs } from "@/lib/voice/voices";

const VoiceContext = createContext<VoicePrefs>({ name: null, rate: 1 });

/** The voice and speed from Settings, for every SpeakButton (and useSpeak) inside. */
export function VoiceProvider({ prefs, children }: { prefs: VoicePrefs; children: ReactNode }) {
  return <VoiceContext.Provider value={prefs}>{children}</VoiceContext.Provider>;
}

/** Says Japanese text aloud with the device voice chosen in Settings. */
export function useSpeak(): (text: string) => void {
  const prefs = useContext(VoiceContext);
  return useCallback((text: string) => void speak(text, prefs), [prefs]);
}
