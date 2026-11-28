import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Rabbit } from "@/components/ui/art/rabbit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type Cover, COVER_BG } from "@/components/ui/chip";
import { List, ListRow } from "@/components/ui/list-row";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { Mixed } from "@/components/ui/ruby";
import { getDb } from "@/db/client";
import { requireSignedIn } from "@/lib/auth/session";
import { formatLong, studyDate } from "@/lib/day";
import { pointsFor } from "@/lib/learn/cached";
import { nextUnread, pointCounts, READ_THROUGH_LEVEL } from "@/lib/learn/grammar";
import { kanaCounts, loadKana } from "@/lib/learn/kana";
import { ROUTES } from "@/lib/planner/day-plan";

export const metadata: Metadata = { title: "Learn" };

/** RF_LearnHub: the N5 read-through up top while it's going, then the kana charts, verb forms, vocabulary and grammar. */
export default async function LearnPage() {
  await requireSignedIn();
  const db = getDb();
  const [hiragana, katakana, n5] = await Promise.all([loadKana(db, "hiragana"), loadKana(db, "katakana"), pointsFor(READ_THROUGH_LEVEL)]);
  const grammar = pointCounts(n5);
  const next = nextUnread(n5);
  const kanaNote = (rows: typeof hiragana) => `${rows.length} characters · ${kanaCounts(rows).review} in your reviews`;
  const rows: { href: string; label: string; note: ReactNode; glyph: string; cover: Cover }[] = [
    { href: "/learn/kana/hiragana", label: "Hiragana", note: kanaNote(hiragana), glyph: "あ", cover: "blue" },
    { href: "/learn/kana/katakana", label: "Katakana", note: kanaNote(katakana), glyph: "ア", cover: "peri" },
    { href: ROUTES.kanaGame, label: "Kana game", note: "read a kana and type it, or hear it and find it", glyph: "か", cover: "butter" },
    { href: "/learn/verbs", label: "Verb forms", note: <Mixed text="the 3 groups; ます, ない, て and た" />, glyph: "て", cover: "mint" },
    { href: ROUTES.vocab, label: "Vocabulary", note: "type the meaning or the word · N5 to N3", glyph: "語", cover: "pink" },
    {
      href: ROUTES.grammar,
      label: "Grammar",
      note: `N5 · ${grammar.total} lessons · ${grammar.confident} confident · ${grammar.learning} learning`,
      glyph: "文",
      cover: "lilac",
    },
  ];

  return (
    <>
      <PageHeader title="Learn" sub={formatLong(studyDate())} />
      {next && (
        <Card aria-labelledby="read-through" className="relative mt-1.5">
          <Rabbit pose="reading" size={96} className="absolute -top-1.5 right-3" />
          <h2 id="read-through" className="m-0 pr-24 text-title font-black">
            {grammar.read === 0 ? "Read each lesson once" : `${grammar.read} of ${grammar.total} lessons read`}
          </h2>
          <p className="m-0 mt-0.5 text-meta text-ink2">N5 grammar read-through</p>
          {grammar.read === 0 && (
            <p className="m-0 mt-2 pr-4 text-meta text-ink2">
              At the end of each lesson, pick &ldquo;I know this&rdquo; or &ldquo;Learn it&rdquo;. What you know comes back in reviews in a few
              weeks; the rest goes to the front of your new cards.
            </p>
          )}
          <ProgressBar value={grammar.read} max={grammar.total} label={`${grammar.read} of ${grammar.total} lessons read`} className="mt-3.5" />
          <p className="m-0 mt-3 flex flex-wrap items-baseline gap-x-2 text-meta text-ink2">
            <span>Next</span>
            <span className="font-ja text-title font-semibold text-ink">
              <Mixed text={next.pattern} />
            </span>
            <span>· {next.gloss}</span>
          </p>
          <Button href={`/grammar/${next.id}`} size="lg" full iconEnd="arrow-right" className="mt-3">
            {grammar.read === 0 ? "Start the read-through" : "Continue"}
          </Button>
        </Card>
      )}
      <nav aria-label="Learn">
        <List>
          {rows.map((r) => (
            <ListRow
              key={r.href}
              href={r.href}
              lead={{
                node: (
                  <span
                    aria-hidden="true"
                    lang="ja"
                    className={`grid size-11 shrink-0 place-items-center rounded-pill font-ja text-title leading-none font-semibold text-on-cover ${COVER_BG[r.cover]}`}
                  >
                    {r.glyph}
                  </span>
                ),
              }}
              title={r.label}
              meta={r.note}
            />
          ))}
        </List>
      </nav>
    </>
  );
}
