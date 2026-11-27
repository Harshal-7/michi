import { z } from "zod";

import { getDb } from "@/db/client";
import { currentSession, unauthorized } from "@/lib/auth/session";
import { studyDate } from "@/lib/day";
import { logPracticeMinutes } from "@/lib/speaking/practice";

const Body = z.object({ kind: z.enum(["speaking", "shadowing"]), minutes: z.number().finite() });

/**
 * Logs a shadowing session left without pressing Done: the player sends it with
 * navigator.sendBeacon as the page goes away, where a Server Action can't run. Minutes are held
 * to 1–30 here too.
 */
export async function POST(request: Request) {
  if (!(await currentSession())) return unauthorized();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Send a kind and minutes." }, { status: 400 });
  const minutes = await logPracticeMinutes(getDb(), { ...parsed.data, date: studyDate() });
  return Response.json({ minutes });
}
