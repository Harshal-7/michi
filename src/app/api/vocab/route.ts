import { getDb } from "@/db/client";
import { currentSession, unauthorized } from "@/lib/auth/session";
import { saveVocabResults, VocabResultsRequest } from "@/lib/vocab/words";

/**
 * Saves typed vocabulary answers from the browser's queue (src/lib/vocab/queue.ts), up to 50 at a
 * time. A fixed address rather than a Server Action, so a tab left open across a deploy keeps
 * saving. Practice counts only; the review schedule is never touched.
 */
export async function POST(request: Request) {
  if (!(await currentSession())) return unauthorized();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400 });
  }
  const parsed = VocabResultsRequest.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Send between 1 and 50 results." }, { status: 400 });
  const saved = await saveVocabResults(getDb(), parsed.data.results);
  return Response.json({ saved });
}
