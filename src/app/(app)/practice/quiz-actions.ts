"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db/client";
import { activityLogs, flags, questions } from "@/db/schema";
import { getSettings } from "@/db/settings";
import { requireSession } from "@/lib/auth/session";
import { studyDate } from "@/lib/day";
import { answerQuestion, type AnswerResult, retryMistake, startQuiz, submitQuiz } from "@/lib/quiz/store";
import { eq } from "drizzle-orm";

const Start = z.object({ kind: z.enum(["daily", "weekly"]), hasVoice: z.boolean() });

/** Starts today's daily quiz or this week's test (or finds the one already started). */
export async function startQuizAction(input: z.input<typeof Start>): Promise<{ ok: true } | { error: string }> {
  await requireSession();
  const parsed = Start.safeParse(input);
  if (!parsed.success) return { error: "That didn't start. Reload the page and try again." };
  const db = getDb();
  const result = await startQuiz(db, { ...parsed.data, date: studyDate(), settings: await getSettings(db) });
  if ("error" in result) return result;
  refresh();
  return { ok: true };
}

const Answer = z.object({ questionId: z.int().positive(), choice: z.int().min(0).max(3) });

export async function answerAction(input: z.input<typeof Answer>): Promise<AnswerResult> {
  await requireSession();
  const parsed = Answer.safeParse(input);
  if (!parsed.success) return { error: "That answer didn't save." };
  return answerQuestion(getDb(), parsed.data);
}

export async function submitAction(assessmentId: number): Promise<{ ok: true } | { error: string }> {
  await requireSession();
  if (!Number.isSafeInteger(assessmentId) || assessmentId <= 0) return { error: "That quiz isn't there any more." };
  const result = await submitQuiz(getDb(), assessmentId);
  refresh();
  return result;
}

/** The mistakes review: a right answer clears the mistake. */
export async function retryMistakeAction(input: z.input<typeof Answer>): Promise<AnswerResult> {
  await requireSession();
  const parsed = Answer.safeParse(input);
  if (!parsed.success) return { error: "That answer didn't save." };
  return retryMistake(getDb(), parsed.data.questionId, parsed.data.choice);
}

const Flag = z.object({ questionId: z.int().positive(), note: z.string().trim().max(1000) });

/** "Flag this question" (decision 16): saved with the question as it was asked. */
export async function flagQuestionAction(input: z.input<typeof Flag>): Promise<{ ok: true } | { error: string }> {
  await requireSession();
  const parsed = Flag.safeParse(input);
  if (!parsed.success) return { error: "That flag didn't save." };
  const db = getDb();
  const [q] = await db.select({ itemId: questions.itemId, asked: questions.asked }).from(questions).where(eq(questions.id, parsed.data.questionId));
  if (!q) return { error: "That question isn't there any more." };
  await db.insert(flags).values({ itemId: q.itemId, questionId: parsed.data.questionId, note: parsed.data.note, target: { question: q.asked } });
  return { ok: true };
}

/** The listen drill logs its own minutes, from start to done, at most 30. */
export async function logListeningAction(minutes: number): Promise<{ ok: true } | { error: string }> {
  await requireSession();
  const m = Math.min(30, Math.max(1, Math.round(Number(minutes) || 0)));
  await getDb().insert(activityLogs).values({ studyDate: studyDate(), kind: "listening", skill: "listening", minutes: m, auto: true, note: "Listen and choose" });
  return { ok: true };
}
