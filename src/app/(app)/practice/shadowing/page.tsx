// design-lint: legacy
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/ui/back-link";
import { ShadowingPlayer } from "@/components/practice/shadowing-player";
import { Ruby } from "@/components/ui/ruby";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { studyDate } from "@/lib/day";
import { ROUTES } from "@/lib/planner/day-plan";
import { getPrompt, getShadowingSet, listShadowingSets, practiceMinutesOn } from "@/lib/speaking/practice";

export const metadata: Metadata = { title: "Shadowing" };

const idParam = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

/**
 * Shadowing (F_Shadowing): the sets to pick from, then the player. `?set=<id>` opens a set;
 * `?prompt=<id>` plays a speaking prompt's model answer as a one-sentence set.
 */
export default async function ShadowingPage({ searchParams }: PageProps<"/practice/shadowing">) {
  await requireSignedIn();
  const params = await searchParams;
  const db = getDb();
  const setId = idParam(params.set);
  const promptId = idParam(params.prompt);

  if (setId !== null || promptId !== null) {
    const [settings, minutes, set, prompt] = await Promise.all([
      getSettings(db),
      practiceMinutesOn(db, studyDate()),
      setId !== null ? getShadowingSet(db, setId) : null,
      promptId !== null ? getPrompt(db, promptId) : null,
    ]);
    const playing = set
      ? { key: `set-${set.id}`, label: `${set.level} ${set.title.toLowerCase()}`, sentences: set.sentences, back: ROUTES.shadowing }
      : prompt
        ? { key: `prompt-${prompt.id}`, label: "Model answer", sentences: [{ ja: prompt.model, en: prompt.modelEn }], back: ROUTES.speaking }
        : null;
    if (!playing) notFound();
    return (
      <ShadowingPlayer
        key={playing.key}
        label={playing.label}
        sentences={playing.sentences}
        backHref={playing.back}
        furigana={settings.furigana}
        voice={settings.voice}
        minutesToday={minutes.total}
      />
    );
  }

  const sets = await listShadowingSets(db);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <BackLink href={ROUTES.practice}>Practice</BackLink>
        <PageHeader title="Shadowing" sub="Pick a set. Listen to each sentence, then say it along with the voice." size="md" />
      </div>
      {sets.length === 0 ? (
        <EmptyState>No shadowing sets yet. They arrive with the next content update.</EmptyState>
      ) : (
        <ul className="m-0 flex list-none flex-col rounded-card bg-surface px-4 py-1.5 shadow-card">
          {sets.map((s, i) => (
            <li key={s.id} className={i ? "border-t border-line" : ""}>
              <Link href={`${ROUTES.shadowing}?set=${s.id}`} className="flex min-h-14 flex-col justify-center gap-0.5 py-2 no-underline">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-semibold">{s.title}</span>
                  <span className="shrink-0 text-xs text-ink2">
                    {s.level} · {s.sentences.length} sentences
                  </span>
                </span>
                {s.sentences[0] && (
                  <span className="truncate text-[13px] text-ink2">
                    <Ruby text={s.sentences[0].ja} furigana={false} />
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
