import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LessonView } from "@/components/learn/lesson";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { pointsFor } from "@/lib/learn/cached";
import { loadLesson, pointCounts, READ_THROUGH_LEVEL } from "@/lib/learn/grammar";
import { loadMine } from "@/lib/learn/sentences";

export const metadata: Metadata = { title: "Grammar point" };

/** One grammar lesson (RF_GrammarLesson; on a laptop, RF_GrammarLessonWeb's two columns). */
export default async function GrammarPointPage({ params }: PageProps<"/grammar/[id]">) {
  await requireSignedIn();
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const db = getDb();
  const [settings, lesson, mine] = await Promise.all([getSettings(db), loadLesson(db, id), loadMine(db, id)]);
  if (!lesson) notFound();
  const counts = pointCounts(await pointsFor(lesson.level));
  const progress = lesson.level === READ_THROUGH_LEVEL && counts.read < counts.total ? { read: counts.read, total: counts.total } : null;

  return <LessonView lesson={lesson} furigana={settings.furigana} voice={settings.voice} progress={progress} mine={mine} />;
}
