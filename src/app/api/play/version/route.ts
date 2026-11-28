import { appVersion } from "@/lib/version";

/** The running deploy, for the games' "new version, reload" banner. Public, unlike /api/version. */
export function GET() {
  return Response.json({ version: appVersion() }, { headers: { "Cache-Control": "no-store" } });
}
