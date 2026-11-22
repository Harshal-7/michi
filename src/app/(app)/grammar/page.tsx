import type { Metadata } from "next";

import { GrammarScreen, levelParam } from "@/components/learn/grammar-screen";
import { LessonView } from "@/components/learn/lesson";
import { EmptyState } from "@/components/ui/page";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { pointsFor } from "@/lib/learn/cached";
import { loadLesson, nextUnread, pointCounts, READ_THROUGH_LEVEL } from "@/lib/learn/grammar";

export const metadata: Metadata = { title: "Grammar" };

/** The grammar list (F_Grammar). On a laptop the read-through's next lesson sits beside it. */
export default async function GrammarPage({ searchParams }: PageProps<"/grammar">) {
  await requireSignedIn();
  const level = levelParam((await searchParams).level);
  const db = getDb();
  const [settings, points] = await Promise.all([getSettings(db), pointsFor(level)]);
  const first = (level === READ_THROUGH_LEVEL ? nextUnread(points) : null) ?? points[0];
  const lesson = first ? await loadLesson(db, first.id) : null;
  const counts = pointCounts(points);
  const progress = level === READ_THROUGH_LEVEL && counts.read < counts.total ? { read: counts.read, total: counts.total } : null;

  return (
    <GrammarScreen
      level={level}
      selectedId={null}
      lesson={
        lesson ? (
          <LessonView lesson={lesson} furigana={settings.furigana} voice={settings.voice} progress={progress} />
        ) : (
          <EmptyState>No grammar points at this level yet.</EmptyState>
        )
      }
    />
  );
}
