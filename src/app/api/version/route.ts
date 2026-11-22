import { appVersion } from "@/lib/version";

/** The running deploy, polled by open tabs (src/components/version-banner.tsx). */
export function GET() {
  return Response.json({ version: appVersion() }, { headers: { "Cache-Control": "no-store" } });
}
