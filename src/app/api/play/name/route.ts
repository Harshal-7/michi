import { getDb, takenNameKeys } from "@/db/play";
import { cleanName, nameKey, nameProblem, suggestionsFor } from "@/lib/play/names";

/** How many free names the sheet offers when the one typed is taken. */
const SUGGESTIONS = 3;

/**
 * The guest sheet's live check, `?name=sakura22`: why the name can't be used, whether it's free,
 * and when it's taken, a few free ones close to it. Names are public on the boards, so saying
 * one is taken gives nothing away. Never cached: names come and go.
 */
export async function GET(request: Request) {
  const headers = { "cache-control": "private, no-store" };
  const raw = new URL(request.url).searchParams.get("name") ?? "";
  const problem = nameProblem(raw);
  if (problem) return Response.json({ problem, free: false, suggestions: [] }, { headers });
  const name = cleanName(raw);
  const candidates = suggestionsFor(name);
  const taken = await takenNameKeys(getDb(), [nameKey(name), ...candidates.map(nameKey)]);
  const free = !taken.has(nameKey(name));
  const suggestions = free ? [] : candidates.filter((c) => !taken.has(nameKey(c)) && !nameProblem(c)).slice(0, SUGGESTIONS);
  return Response.json({ problem: null, free, suggestions }, { headers });
}
