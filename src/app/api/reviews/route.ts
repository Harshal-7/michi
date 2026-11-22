import { getDb } from "@/db/client";
import { currentSession, unauthorized } from "@/lib/auth/session";
import { OpsRequest, type OpsResponse } from "@/lib/srs/ops";
import { saveOps } from "@/lib/srs/save";
import { appVersion } from "@/lib/version";

/**
 * Saves grades, undos and quick-check verdicts from the browser's outbox (src/lib/srs/outbox.ts):
 * up to 20 at a time, in order. A fixed address rather than a Server Action, so a tab left open
 * across a deploy keeps saving. Every op gets a final status back; see src/lib/srs/ops.ts.
 */
export async function POST(request: Request) {
  if (!(await currentSession())) return unauthorized();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400 });
  }
  const parsed = OpsRequest.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Send between 1 and 20 ops." }, { status: 400 });
  const results = await saveOps(getDb(), parsed.data.ops);
  return Response.json({ results, version: appVersion() } satisfies OpsResponse);
}
