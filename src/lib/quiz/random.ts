/** Randomness for building quizzes: Math.random in the app, a seeded one in tests. */
export type Random = () => number;

/** A small seeded generator (mulberry32), so tests get the same quiz every run. */
export function seeded(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Picks up to `n` items without repeats, each with a chance in proportion to its weight. */
export function weightedSample<T>(items: readonly T[], weight: (t: T) => number, n: number, random: Random): T[] {
  const left = items.map((item) => ({ item, w: Math.max(0, weight(item)) })).filter((x) => x.w > 0);
  const out: T[] = [];
  while (out.length < n && left.length > 0) {
    const total = left.reduce((s, x) => s + x.w, 0);
    let r = random() * total;
    let i = 0;
    for (; i < left.length - 1; i++) {
      r -= left[i].w;
      if (r < 0) break;
    }
    out.push(left[i].item);
    left.splice(i, 1);
  }
  return out;
}

/** The answer put among the wrong options at a random place: the options and the answer's index. */
export function placeAnswer(answer: string, wrong: readonly string[], random: Random): { options: string[]; answer: number } {
  const options = shuffle(wrong, random);
  const at = Math.floor(random() * (options.length + 1));
  options.splice(at, 0, answer);
  return { options, answer: at };
}
