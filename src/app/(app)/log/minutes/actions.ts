"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db/client";
import { requireSession } from "@/lib/auth/session";
import { studyDate } from "@/lib/day";

import { addMinutesEntry, datable, deleteMinutesEntry, MinutesEntry } from "./data";

export type MinutesState = { error?: string; saved?: { minutes: number; label: string } };

export async function addMinutes(_prev: MinutesState, form: FormData): Promise<MinutesState> {
  await requireSession();
  const parsed = MinutesEntry.safeParse({
    date: form.get("date"),
    kind: form.get("kind"),
    skill: form.get("skill"),
    minutes: form.get("minutes"),
    note: form.get("note") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "That didn't check out." };
  if (!datable(parsed.data.date, studyDate())) return { error: "Pick today or a day in the last week." };
  await addMinutesEntry(getDb(), parsed.data);
  refresh();
  return { saved: { minutes: parsed.data.minutes, label: parsed.data.kind } };
}

export async function deleteMinutes(id: number): Promise<void> {
  await requireSession();
  await deleteMinutesEntry(getDb(), z.int().positive().parse(id));
  refresh();
}
