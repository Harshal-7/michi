import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ShadowingPlayer } from "@/components/practice/shadowing-player";
import { Ruby } from "@/components/ui/ruby";
import { Spot } from "@/components/ui/art/spots";
import { EmptyState } from "@/components/ui/empty-state";
import { List, ListRow } from "@/components/ui/list-row";
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
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Shadowing"
        sub="Pick a set. Listen to each sentence, then say it along with the voice."
        back={{ href: ROUTES.practice, label: "Practice" }}
      />
      {sets.length === 0 ? (
        <EmptyState art={<Spot kind="notebook" />} title="No shadowing sets yet">
          They arrive with the next content update.
        </EmptyState>
      ) : (
        <List aria-label="Shadowing sets">
          {sets.map((s) => (
            <ListRow
              key={s.id}
              href={`${ROUTES.shadowing}?set=${s.id}`}
              lead={{ icon: "headphones", cover: "aqua" }}
              title={s.title}
              meta={
                <span className="flex min-w-0 flex-col">
                  <span>
                    {s.level} · {s.sentences.length} sentences
                  </span>
                  {s.sentences[0] && (
                    <span className="truncate">
                      <Ruby text={s.sentences[0].ja} furigana={false} />
                    </span>
                  )}
                </span>
              }
            />
          ))}
        </List>
      )}
    </div>
  );
}
