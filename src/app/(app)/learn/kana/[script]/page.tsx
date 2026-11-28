import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { KanaChart } from "@/components/learn/kana-chart";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { LinkTabs } from "@/components/ui/link-tabs";
import { PageHeader } from "@/components/ui/page-header";
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

/** A kana chart (RF_KanaChart): the whole script in its table; tap to hear, see the example and look-alikes. */
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
    <Button href={ROUTES.quickCheck} size="lg" full iconEnd="arrow-right">
      Check yourself in the quick check
    </Button>
  ) : (
    deckId && (
      <Button href={`${ROUTES.review}?deck=${deckId}`} size="lg" full iconEnd="arrow-right">
        Review {NAMES[script].toLowerCase()}
      </Button>
    )
  );

  return (
    <div data-wide className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-3 laptop:flex-row laptop:items-end laptop:justify-between laptop:gap-6">
        <header className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <BackLink href={ROUTES.learn}>Learn</BackLink>
            <Button variant="quiet" href={`${ROUTES.kanaGame}?script=${script}`} className="laptop:hidden">
              Kana game
            </Button>
          </div>
          <PageHeader
            title={NAMES[script]}
            sub={`${counts.review} in your reviews · ${counts.learning} learning · ${counts.new} not started`}
          />
        </header>
        <div className="laptop:w-80 laptop:shrink-0">
          <LinkTabs label="Script" tabs={SCRIPTS.map((s) => ({ href: `/learn/kana/${s}`, label: NAMES[s], current: s === script }))} />
        </div>
      </div>
      <KanaChart
        sections={kanaChart(rows)}
        voice={settings.voice}
        furigana={settings.furigana}
        footer={
          <>
            {next}
            <Button variant="secondary" href={`${ROUTES.kanaGame}?script=${script}`} full className="max-laptop:hidden">
              Play the kana game
            </Button>
          </>
        }
      />
    </div>
  );
}
