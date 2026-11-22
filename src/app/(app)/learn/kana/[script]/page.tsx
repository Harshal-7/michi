import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { KanaChart } from "@/components/learn/kana-chart";
import { BackLink, LinkTabs } from "@/components/learn/tabs";
import { PageHeader } from "@/components/ui/page";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { studyDate } from "@/lib/day";
import { isScript, kanaChart, kanaCounts, kanaDeckId, loadKana, SCRIPTS } from "@/lib/learn/kana";
import { ROUTES } from "@/lib/planner/day-plan";
import { quickCheckProgress } from "@/lib/srs/quick-check";

const NAMES = { hiragana: "Hiragana", katakana: "Katakana" } as const;

export async function generateMetadata({ params }: PageProps<"/learn/kana/[script]">): Promise<Metadata> {
  const { script } = await params;
  return { title: isScript(script) ? NAMES[script] : "Kana" };
}

/** A kana chart (Learn): the whole script in its table; tap to hear, see the example and look-alikes. */
export default async function KanaPage({ params }: PageProps<"/learn/kana/[script]">) {
  await requireSignedIn();
  const { script } = await params;
  if (!isScript(script)) notFound();
  const db = getDb();
  const [settings, rows, deckId, check] = await Promise.all([
    getSettings(db),
    loadKana(db, script),
    kanaDeckId(db, script),
    quickCheckProgress(db, studyDate()),
  ]);
  const counts = kanaCounts(rows);
  const checkLeft = check.total - check.checked > 0 && counts.new > 0;

  const next = checkLeft ? (
    <Link
      href={ROUTES.quickCheck}
      className="flex min-h-[50px] items-center justify-center rounded-btn bg-accent text-[15px] font-bold text-on-accent no-underline"
    >
      Check yourself in the quick check
    </Link>
  ) : (
    deckId && (
      <Link
        href={`${ROUTES.review}?deck=${deckId}`}
        className="flex min-h-[50px] items-center justify-center rounded-btn bg-accent text-[15px] font-bold text-on-accent no-underline"
      >
        Review {NAMES[script].toLowerCase()}
      </Link>
    )
  );

  return (
    <div data-wide className="mx-auto flex w-full max-w-[720px] flex-col gap-3 laptop:max-w-none">
      <div className="flex flex-col gap-3 laptop:flex-row laptop:items-end laptop:justify-between laptop:gap-6">
        <div className="flex flex-col gap-3">
          <BackLink href={ROUTES.learn}>Learn</BackLink>
          <PageHeader
            title={NAMES[script]}
            sub={`${rows.length} characters · ${counts.review} in your reviews · ${counts.learning} learning · ${counts.new} not started`}
          />
        </div>
        <div className="laptop:w-[280px] laptop:shrink-0 wide:w-[320px]">
          <LinkTabs
            label="Script"
            tabs={SCRIPTS.map((s) => ({ href: `/learn/kana/${s}`, label: NAMES[s], current: s === script }))}
          />
        </div>
      </div>
      <KanaChart
        sections={kanaChart(rows)}
        voice={settings.voice}
        furigana={settings.furigana}
        footer={
          <>
            <p className="m-0 flex flex-wrap gap-3 text-xs text-ink2">
              <Legend dot="bg-good">In your reviews</Legend>
              <Legend dot="bg-accent">Learning</Legend>
              <Legend dot="bg-track border border-line">Not started</Legend>
            </p>
            {next}
          </>
        }
      />
    </div>
  );
}

function Legend({ dot, children }: { dot: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-[5px]">
      <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />
      {children}
    </span>
  );
}
