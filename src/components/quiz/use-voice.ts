"use client";

import { useEffect, useState } from "react";

import { loadVoices } from "@/lib/voice/speak";
import { pickVoice } from "@/lib/voice/voices";

/** Whether this device has a Japanese voice: null while the browser is still listing its voices. */
export function useHasJapaneseVoice(): boolean | null {
  const [has, setHas] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void loadVoices().then((voices) => {
      if (live) setHas(pickVoice(voices, null) !== null);
    });
    return () => {
      live = false;
    };
  }, []);
  return has;
}

/** The Android steps from decision 3, said the same way everywhere. */
export const INSTALL_VOICE = "Android Settings → Text-to-speech → Speech Services by Google → Install voice data → Japanese";
