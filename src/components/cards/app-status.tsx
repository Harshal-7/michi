import { VersionBanner } from "@/components/version-banner";
import { appVersion } from "@/lib/version";

import { OutboxSync } from "./outbox-sync";

/** For the app layout: the "new version, reload" banner and the outbox working in the background. */
export function AppStatus() {
  return (
    <>
      <VersionBanner version={appVersion()} />
      <OutboxSync />
    </>
  );
}
