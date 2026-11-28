import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { requireSignedIn } from "@/lib/auth/session";

import { Showcase } from "./showcase";

export const metadata: Metadata = { title: "Design", robots: { index: false, follow: false } };

/**
 * The living parts page (signed in only): tokens, type, every part in its states and all the art,
 * built from the real components, light and dark side by side. The canvas (RF_Tokens, RF_Parts,
 * RF_Illustrations) wins where they differ; fix this page then.
 */
export default async function DesignPage() {
  await requireSignedIn();
  return (
    <div data-wide className="flex flex-col gap-6">
      <PageHeader title="Design" sub="Every part in src/components/ui, light and dark." />
      <div className="grid gap-6 wide:grid-cols-2">
        {(["light", "dark"] as const).map((t) => (
          <div key={t} data-theme={t} className="min-w-0 rounded-card border-[1.5px] border-line bg-page p-5">
            <Showcase theme={t} />
          </div>
        ))}
      </div>
    </div>
  );
}
