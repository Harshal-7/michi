/**
 * Japanese speech recognition with the browser's Web Speech API (Chrome on Android and the Mac).
 * Browser only. What it hears is only shown next to the model answer; it never changes reviews.
 */

type Alternative = { transcript: string };
type Result = { isFinal: boolean; 0: Alternative; length: number };
type ResultEvent = { resultIndex: number; results: { length: number; [i: number]: Result } };
type ErrorEvent = { error: string };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: ResultEvent) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionClass = new () => Recognition;

function recognitionClass(): RecognitionClass | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function canRecognise(): boolean {
  return recognitionClass() !== null;
}

/** Why recognition stopped early, in words for the screen. */
export function recognitionProblem(error: string): string {
  if (error === "audio-capture" || error === "not-allowed" || error === "service-not-allowed")
    return "Speech recognition couldn't run alongside the recording on this device. Your recording is kept.";
  if (error === "no-speech") return "Speech recognition didn't catch anything that time.";
  if (error === "network") return "Speech recognition needs a connection. Your recording is kept.";
  return "Speech recognition stopped early. Your recording is kept.";
}

/**
 * Listens in Japanese until `stop()` is called, passing everything heard so far (final and
 * interim) to `onText`. Chrome ends a session after a pause; while still listening it starts
 * again and keeps what it had. Returns null when the browser can't recognise speech.
 */
export function listen({ onText, onError }: { onText: (text: string) => void; onError: (error: string) => void }): { stop: () => void } | null {
  const Ctor = recognitionClass();
  if (!Ctor) return null;
  let stopped = false;
  let kept = "";
  let current: Recognition;

  const begin = () => {
    const r = new Ctor();
    current = r;
    r.lang = "ja-JP";
    r.continuous = true;
    r.interimResults = true;
    let finals = "";
    r.onresult = (e) => {
      let interim = "";
      finals = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finals += res[0].transcript;
        else interim += res[0].transcript;
      }
      onText(kept + finals + interim);
    };
    r.onerror = (e) => {
      if (e.error === "aborted") return;
      // No speech in a pause is normal while still recording; it starts again on end.
      if (e.error === "no-speech" && !stopped) return;
      stopped = true;
      onError(e.error);
    };
    r.onend = () => {
      kept += finals;
      if (!stopped) {
        try {
          begin();
        } catch {
          stopped = true;
        }
      }
    };
    r.start();
  };

  try {
    begin();
  } catch {
    onError("start");
    return { stop: () => {} };
  }
  return {
    stop: () => {
      stopped = true;
      try {
        current.stop();
      } catch {
        // Already ended.
      }
    },
  };
}
