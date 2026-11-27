/**
 * The game's own soft tones, made with Web Audio: a rising pair for right, one low note for a
 * miss, three notes at the end. Switched off from the start screen.
 */

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  context ??= new AudioContext();
  // Browsers start it suspended until a tap; Start is one.
  if (context.state === "suspended") void context.resume();
  return context;
}

function note(ctx: AudioContext, freq: number, start: number, length: number, type: OscillatorType = "sine", volume = 0.07) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = ctx.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

export type Tone = "right" | "miss" | "done";

export function playTone(tone: Tone) {
  const ctx = audio();
  if (!ctx) return;
  if (tone === "right") {
    note(ctx, 660, 0, 0.09);
    note(ctx, 880, 0.06, 0.14);
  } else if (tone === "miss") {
    note(ctx, 196, 0, 0.22, "triangle", 0.09);
  } else {
    note(ctx, 523, 0, 0.16);
    note(ctx, 659, 0.12, 0.16);
    note(ctx, 784, 0.24, 0.3);
  }
}

/** Called from the Start tap, so the first tone isn't lost to the browser's autoplay rule. */
export const wakeTones = () => void audio();
