/**
 * Speaking Japanese with the browser's speech synthesis (Chrome on Android and the Mac).
 * Browser only. Chrome fills its voice list a moment after the page loads, so `loadVoices`
 * waits for it.
 */
import { pickVoice, type VoicePrefs } from "./voices";

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** The device's voices, once the browser has listed them (or after `timeoutMs`). */
export function loadVoices(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
  if (!canSpeak()) return Promise.resolve([]);
  const now = speechSynthesis.getVoices();
  if (now.length > 0) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      speechSynthesis.removeEventListener("voiceschanged", done);
      resolve(speechSynthesis.getVoices());
    };
    const timer = setTimeout(done, timeoutMs);
    speechSynthesis.addEventListener("voiceschanged", done);
  });
}

/** Says `text` in Japanese, cutting off anything still being said. False if it can't. */
export async function speak(text: string, prefs: VoicePrefs): Promise<boolean> {
  if (!canSpeak() || !text.trim()) return false;
  const voice = pickVoice(await loadVoices(), prefs.name);
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang ?? "ja-JP";
  if (voice) utterance.voice = voice;
  utterance.rate = prefs.rate;
  speechSynthesis.speak(utterance);
  return true;
}
