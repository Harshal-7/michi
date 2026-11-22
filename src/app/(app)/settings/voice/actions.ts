"use server";

import { z } from "zod";

import { getDb } from "@/db/client";
import { updateSettings } from "@/db/settings";
import { requireSession } from "@/lib/auth/session";

const Voice = z.object({ name: z.string().trim().min(1).max(200).nullable(), rate: z.number().min(0.5).max(1.5) });

export async function saveVoice(input: z.input<typeof Voice>): Promise<{ ok: true } | { error: string }> {
  await requireSession();
  const parsed = Voice.safeParse(input);
  if (!parsed.success) return { error: "Pick a speed between 0.5× and 1.5×." };
  await updateSettings(getDb(), { voice: parsed.data });
  return { ok: true };
}
