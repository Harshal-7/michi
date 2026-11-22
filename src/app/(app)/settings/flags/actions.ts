"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";

import { getDb } from "@/db/client";
import { flags } from "@/db/schema";
import { requireSession } from "@/lib/auth/session";

export async function resolveFlag(id: number, resolved: boolean): Promise<void> {
  await requireSession();
  await getDb()
    .update(flags)
    .set(resolved ? { status: "resolved", resolvedAt: new Date() } : { status: "open", resolvedAt: null })
    .where(eq(flags.id, z.int().positive().parse(id)));
  refresh();
}
