/**
 * Speaking a sentence and waiting until the voice has finished, for shadowing's repeats and the
 * pause between them. Browser only. Uses the same voice choice as speak() (src/lib/voice/speak.ts).
 */
import { canSpeak, loadVoices } from "./speak";
import { pickVoice, type VoicePrefs } from "./voices";

/** A rough length for Japanese said at `rate`: about 0.12 s a character at normal speed. */
export function estimateMs(text: string, rate = 1): number {
  return Math.round(([...text.trim()].length * 120) / (rate || 1));
}

/**
 * Says `text` in Japanese and resolves once it's finished (or was cut off), with how long it
 * took. `ok` is false when it couldn't speak at all. Chrome sometimes never fires `end` on a long
 * utterance, so it gives up waiting after about three times the estimated length.
 */
export async function speakAndWait(text: string, prefs: VoicePrefs): Promise<{ ok: boolean; ms: number }> {
  if (!canSpeak() || !text.trim()) return { ok: false, ms: 0 };
  const voice = pickVoice(await loadVoices(), prefs.name);
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang ?? "ja-JP";
  if (voice) utterance.voice = voice;
  utterance.rate = prefs.rate;
  const started = performance.now();
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ ok, ms: Math.round(performance.now() - started) });
    };
    const timer = setTimeout(() => finish(true), estimateMs(text, prefs.rate) * 3 + 3000);
    utterance.onend = () => finish(true);
    utterance.onerror = (e) => finish(e.error === "interrupted" || e.error === "canceled");
    speechSynthesis.speak(utterance);
  });
}

/** Stops whatever is being said; a pending speakAndWait resolves. */
export function stopSpeaking(): void {
  if (canSpeak()) speechSynthesis.cancel();
}
