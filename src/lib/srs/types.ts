/** What a review screen gets for each card: the card's schedule and the item it shows. */
import type { CardState, StoredFsrs } from "./scheduler";

export type ItemKind = "kana" | "kanji" | "word" | "grammar" | "phrase";
export type CardType = "recognition" | "production" | "fill_in";

export type ItemView = {
  id: number;
  kind: ItemKind;
  level: "N5" | "N4" | "N3" | null;
  term: string;
  reading: string | null;
  meaning: string;
  source: "starter" | "class" | "import" | "immersion" | "manual";
  /** The kind's extra fields (src/lib/items/data.ts). */
  data: Record<string, unknown>;
  /** "Where I met it": the latest class or immersion sentence. */
  context: { ja: string; en: string } | null;
};

export type StudyCard = {
  id: number;
  cardType: CardType;
  state: CardState;
  fsrs: StoredFsrs | null;
  lastReviewId: string | null;
  reps: number;
  lapses: number;
  dueAt: string | null;
  item: ItemView;
};

/** The next task after a session: "New items · 2 kanji and 12 words · 15 min" (F_ReviewDone). */
export type UpNext = { title: string; detail: string; href: string };
