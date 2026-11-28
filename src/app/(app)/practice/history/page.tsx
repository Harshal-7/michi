import type { Metadata } from "next";
import { TypeChips } from "@/components/quiz/results";
import { Spot } from "@/components/ui/art/spots";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { List, ListRow } from "@/components/ui/list-row";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { getDb } from "@/db/client";
import { requireSignedIn } from "@/lib/auth/session";
import { formatDayMonth, formatShort, studyDate } from "@/lib/day";
import { loadHistory, loadTypeScores } from "@/lib/quiz/store";
import { QUIZ_TITLE, TYPE_SHORT, type QuizType } from "@/lib/quiz/types";

export const metadata: Metadata = { title: "Quiz history" };

/**
 * Past quizzes and tests, newest first, with how each kind of question went over the last 30 days.
 * Built from RF_PracticeHub's rows and RF_QuizResults' chips.
 */
export default async function QuizHistoryPage() {
  await requireSignedIn();
  const db = getDb();
  const today = studyDate();
  const [history, types] = await Promise.all([loadHistory(db), loadTypeScores(db, today)]);
  const merged = new Map<string, { label: string; right: number; asked: number }>();
  for (const t of types) {
    const label = TYPE_SHORT[t.type as QuizType] ?? t.type;
    const s = merged.get(label) ?? { label, right: 0, asked: 0 };
    s.right += t.right;
    s.asked += t.asked;
    merged.set(label, s);
  }

  return (
    <>
      <PageHeader back={{ href: "/practice", label: "Practice" }} title="Quiz history" />

      {history.length === 0 ? (
        <EmptyState art={<Spot kind="notebook" />} title="No finished quizzes yet">
          Your daily quizzes and weekly tests show up here.
        </EmptyState>
      ) : (
        <>
          {merged.size > 0 && (
            <Card aria-labelledby="by-type" className="flex flex-col gap-2 pt-3">
              <SectionTitle id="by-type" as="h2">
                Last 30 days by kind
              </SectionTitle>
              <TypeChips scores={[...merged.values()]} />
            </Card>
          )}
          <section aria-labelledby="past-title">
            <SectionTitle id="past-title">Past quizzes</SectionTitle>
            <List aria-labelledby="past-title">
              {history.map((h) => {
                const pct = h.total ? Math.round((h.score / h.total) * 100) : 0;
                return (
                  <ListRow
                    key={h.id}
                    href={`/practice/history/${h.id}`}
                    title={QUIZ_TITLE[h.kind]}
                    meta={h.kind === "weekly" && h.weekStart ? `Week of ${formatDayMonth(h.weekStart)}` : formatShort(h.studyDate, today)}
                    trailing={
                      <span className="flex flex-col items-end">
                        <span className="text-body font-black tabular-nums">
                          {h.score} / {h.total}
                        </span>
                        <span className="text-meta text-ink2 tabular-nums">{pct}%</span>
                      </span>
                    }
                  />
                );
              })}
            </List>
          </section>
        </>
      )}
    </>
  );
}
