/**
 * The day's plan is frozen when the day's first page loads, so every page and both devices see
 * the same list. It's rebuilt only when a class log is saved, the settings change or a calendar
 * exception is set, and tasks already finished stay finished.
 */
import { eq } from "drizzle-orm";

import type { Db, DbOrTx } from "@/db/client";
import { dayPlans } from "@/db/schema";
import type { StudyDate } from "@/lib/day";

import { DayPlan, type DayTask } from "./day-plan";
import { type DayStatus, evaluate } from "./evaluate";
import { DISPLAY_ORDER, plan } from "./plan";
import { loadActivity, loadMarks, loadPlan, loadPlanInput } from "./store";

/** The day's plan: the stored one, or a new one built and stored now. */
export async function ensureDayPlan(db: DbOrTx, date: StudyDate): Promise<DayPlan> {
  const stored = await loadPlan(db, date);
  if (stored) return stored;
  const fresh = plan(await loadPlanInput(db, date));
  // Two devices loading at once: the first insert wins and both read it back. A stored plan
  // that no longer reads as a plan (the contract changed) is replaced.
  const [row] = await db
    .insert(dayPlans)
    .values({ studyDate: date, plan: fresh })
    .onConflictDoNothing()
    .returning({ plan: dayPlans.plan });
  if (row) return fresh;
  const winner = await loadPlan(db, date);
  if (winner) return winner;
  await db.update(dayPlans).set({ plan: fresh, rebuiltAt: new Date() }).where(eq(dayPlans.studyDate, date));
  return fresh;
}

/**
 * Builds the day's plan again from the current settings and calendar. Tasks already done or
 * skipped are kept as they were, with their new-item quotas and quick-check target.
 */
export async function rebuildDayPlan(db: Db, date: StudyDate): Promise<DayPlan> {
  return db.transaction(async (tx) => {
    await tx.select({ d: dayPlans.studyDate }).from(dayPlans).where(eq(dayPlans.studyDate, date)).for("update");
    const old = await loadPlan(tx, date);
    const fresh = plan(await loadPlanInput(tx, date));
    const merged = old ? keepFinished(old, fresh, evaluate(old, await loadActivity(tx, old), await loadMarks(tx, date))) : fresh;
    await tx
      .insert(dayPlans)
      .values({ studyDate: date, plan: merged, rebuiltAt: new Date() })
      .onConflictDoUpdate({ target: dayPlans.studyDate, set: { plan: merged, rebuiltAt: new Date() } });
    return merged;
  });
}

/** The fresh plan with the old plan's finished tasks put back in place of their new versions. */
export function keepFinished(old: DayPlan, fresh: DayPlan, status: DayStatus): DayPlan {
  const finished = new Map<string, DayTask>();
  for (const t of status.tasks) if (t.state !== "todo") finished.set(t.task.key, t.task);
  const tasks = fresh.tasks.map((t) => finished.get(t.key) ?? t);
  for (const [key, t] of finished) if (!tasks.some((x) => x.key === key)) tasks.push(t);
  tasks.sort((a, b) => DISPLAY_ORDER.indexOf(a.kind) - DISPLAY_ORDER.indexOf(b.kind));
  const isFinished = (key: string) => finished.has(key);
  return DayPlan.parse({
    ...fresh,
    tasks,
    newQuota: isFinished("new_items") ? old.newQuota : fresh.newQuota,
    quickCheckTarget: isFinished("quick_check") ? old.quickCheckTarget : fresh.quickCheckTarget,
  });
}
