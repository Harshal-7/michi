/**
 * The quick check's rules, shared by the screen and its tests (decision 6).
 */

/** A kana typed right within this long counts as known; slower is unsure. */
export const FAST_MS = 3000;
/** Every this many "Knew it" answers, one gets a multiple-choice spot check. */
export const SPOT_CHECK_EVERY = 5;

const normalise = (s: string) => s.normalize("NFKC").trim().toLowerCase().replace(/[^a-z]/g, "");

/** True when the romaji typed is the kana's answer or one of the accepted spellings (si, tu, hu). */
export function romajiMatches(typed: string, romaji: string, accept: readonly string[]): boolean {
  const t = normalise(typed);
  return t !== "" && [romaji, ...accept].some((a) => normalise(a) === t);
}

/** Right and fast is known; right but slow is unsure; wrong is unknown. */
export function kanaVerdict(right: boolean, elapsedMs: number): "known" | "unsure" | "unknown" {
  if (!right) return "unknown";
  return elapsedMs <= FAST_MS ? "known" : "unsure";
}

/** The first sense of a meaning, short enough for an option: "to eat; to live on" → "to eat". */
export function shortMeaning(meaning: string): string {
  const first = meaning.split(";")[0].trim();
  return first.split(",").slice(0, 2).join(",").trim();
}

/**
 * Four options for "What does 天気 mean?": the answer and three others whose words don't
 * overlap it, in a random order. `random` is Math.random in the app, seeded in tests.
 */
export function spotOptions(
  answer: string,
  pool: readonly string[],
  random: () => number = Math.random,
): { options: string[]; answerIndex: number } {
  const right = shortMeaning(answer);
  const words = new Set(right.toLowerCase().split(/\W+/).filter((w) => w.length > 2));
  const wrong: string[] = [];
  for (const candidate of [...pool].sort(() => random() - 0.5)) {
    const option = shortMeaning(candidate);
    const overlaps = option.toLowerCase().split(/\W+/).some((w) => words.has(w));
    if (option && option !== right && !overlaps && !wrong.includes(option)) wrong.push(option);
    if (wrong.length === 3) break;
  }
  const options = [...wrong];
  const answerIndex = Math.floor(random() * (options.length + 1));
  options.splice(answerIndex, 0, right);
  return { options, answerIndex };
}
