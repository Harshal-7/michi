/**
 * Picking a Japanese voice for the browser's speech synthesis. Kept apart from the speaking
 * itself so it can be tested without a browser.
 */

/** The voice fields Michi uses (SpeechSynthesisVoice has them all). */
export type VoiceInfo = { name: string; lang: string; localService: boolean; default?: boolean };

export type VoicePrefs = { name: string | null; rate: number };

const isJapanese = (v: VoiceInfo) => /^ja([-_]|$)/i.test(v.lang);

/** Japanese voices, Google's first (the clearest on Android and in Chrome), then on-device ones. */
export function japaneseVoices<V extends VoiceInfo>(voices: readonly V[]): V[] {
  const score = (v: VoiceInfo) => (/google/i.test(v.name) ? 0 : 2) + (v.localService ? 0 : 1);
  return voices.filter(isJapanese).sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
}

/** The voice to speak with: the one picked in Settings if this device has it, else the best Japanese one. */
export function pickVoice<V extends VoiceInfo>(voices: readonly V[], name: string | null): V | null {
  const ja = japaneseVoices(voices);
  return (name && ja.find((v) => v.name === name)) || ja[0] || null;
}
