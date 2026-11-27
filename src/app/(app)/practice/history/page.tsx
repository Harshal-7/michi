import type { Metadata } from "next";
import Link from "next/link";

import { BackLink } from "@/components/learn/tabs";
import { TypeChips } from "@/components/quiz/results";
import { Icon } from "@/components/ui/icon";
import { ICONS } from "@/components/shell/nav";
import { EmptyState } from "@/components/ui/page";
import { getDb } from "@/db/client";
import { requireSignedIn } from "@/lib/auth/session";
import { formatDayMonth, formatShort, studyDate } from "@/lib/day";
import { loadHistory, loadTypeScores } from "@/lib/quiz/store";
import { QUIZ_TITLE, TYPE_SHORT, type QuizType } from "@/lib/quiz/types";

export const metadata: Metadata = { title: "Quiz history" };

/**
 * Past quizzes and tests, newest first, with how each kind of question went over the last 30 days.
 * No board: built from the Practice cards and the results' chips.
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
      <header className="flex flex-col gap-0.5">
        <BackLink href="/practice">Practice</BackLink>
        <h1 className="m-0 font-head text-[28px] leading-[1.15]">Quiz history</h1>
      </header>

      {history.length === 0 ? (
        <EmptyState>No finished quizzes yet. Your daily quizzes and weekly tests show up here.</EmptyState>
      ) : (
        <>
          {merged.size > 0 && (
            <section className="flex flex-col gap-2 rounded-card bg-surface px-3.5 py-3 shadow-card">
              <h2 className="m-0 text-[13px] font-bold">Last 30 days by kind of question</h2>
              <TypeChips scores={[...merged.values()]} />
            </section>
          )}
          <section className="flex flex-col rounded-card bg-surface px-3.5 py-1.5 shadow-card">
            {history.map((h, i) => {
              const pct = h.total ? Math.round((h.score / h.total) * 100) : 0;
              return (
                <Link
                  key={h.id}
                  href={`/practice/history/${h.id}`}
                  className={`flex min-h-14 items-center gap-3 no-underline ${i ? "border-t border-line" : ""}`}
                >
                  <span className="flex min-w-0 flex-auto flex-col">
                    <span className="text-[15px] font-semibold">{QUIZ_TITLE[h.kind]}</span>
                    <span className="text-[12.5px] text-ink2">
                      {h.kind === "weekly" && h.weekStart ? `Week of ${formatDayMonth(h.weekStart)}` : formatShort(h.studyDate, today)}
                    </span>
                  </span>
                  <span className="text-[15px] font-bold">
                    {h.score} / {h.total}
                  </span>
                  <span className={`w-11 text-right text-[13px] ${pct < 70 ? "text-again" : "text-ink2"}`}>{pct}%</span>
                  <Icon d={ICONS.chevronRight} size={16} stroke={1.8} className="text-ink2" />
                </Link>
              );
            })}
          </section>
        </>
      )}
    </>
  );
}
