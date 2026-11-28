import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Rabbit } from "@/components/ui/art/rabbit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type Cover, COVER_BG } from "@/components/ui/chip";
import { List, ListRow } from "@/components/ui/list-row";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { Mixed } from "@/components/ui/ruby";
import { StatGrid, StatTile } from "@/components/ui/stat";
import { getDb } from "@/db/client";
import { requireSignedIn } from "@/lib/auth/session";
import { formatLong, studyDate } from "@/lib/day";
import { pointsFor } from "@/lib/learn/cached";
import { nextUnread, pointCounts, READ_THROUGH_LEVEL } from "@/lib/learn/grammar";
import { kanaCounts, loadKana } from "@/lib/learn/kana";
import { ROUTES } from "@/lib/planner/day-plan";

export const metadata: Metadata = { title: "Learn" };

/** Each cover's deeper tone, for the big glyph on a laptop tile (static strings so Tailwind sees them). */
const COVER_TONE_TEXT: Record<Cover, string> = {
  blue: "text-tone-blue",
  mint: "text-tone-mint",
  butter: "text-tone-butter",
  pink: "text-tone-pink",
  lilac: "text-tone-lilac",
  aqua: "text-tone-aqua",
  peri: "text-tone-peri",
};

/**
 * RF_LearnHub: the N5 read-through up top while it's going, then the kana charts, verb forms, vocabulary and grammar.
 * Phone: the read-through card, then the six areas as list rows. Laptop: the read-through card with an
 * "N5 at a glance" panel (under it, beside it from 1280px), then the six areas as cover tiles with big
 * glyphs, three across.
 */
export default async function LearnPage() {
  await requireSignedIn();
  const db = getDb();
  const [hiragana, katakana, n5] = await Promise.all([loadKana(db, "hiragana"), loadKana(db, "katakana"), pointsFor(READ_THROUGH_LEVEL)]);
  const grammar = pointCounts(n5);
  const next = nextUnread(n5);
  const kanaNote = (rows: typeof hiragana) => `${rows.length} characters · ${kanaCounts(rows).review} in your reviews`;
  const kanaInReviews = kanaCounts(hiragana).review + kanaCounts(katakana).review;
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
    <div data-wide className="flex w-full flex-col gap-4 laptop:gap-6">
      <PageHeader title="Learn" sub={formatLong(studyDate())} />
      <div className={next ? "flex flex-col gap-4 laptop:gap-5 wide:grid wide:grid-cols-5 wide:items-stretch wide:gap-6" : "hidden laptop:flex laptop:flex-col"}>
        {next && (
          <Card aria-labelledby="read-through" className="relative mt-1.5 laptop:mt-0 laptop:flex laptop:flex-col laptop:p-6 wide:col-span-3">
            <Rabbit pose="reading" size={96} className="absolute -top-1.5 right-3 laptop:top-2 laptop:right-5" />
            <h2 id="read-through" className="m-0 pr-24 text-title font-black laptop:text-headline">
              {grammar.read === 0 ? "Read each lesson once" : `${grammar.read} of ${grammar.total} lessons read`}
            </h2>
            <p className="m-0 mt-0.5 text-meta text-ink2 laptop:text-body">N5 grammar read-through</p>
            {grammar.read === 0 && (
              <p className="m-0 mt-2 pr-4 text-meta text-ink2">
                At the end of each lesson, pick &ldquo;I know this&rdquo; or &ldquo;Learn it&rdquo;. What you know comes back in reviews in a few
                weeks; the rest goes to the front of your new cards.
              </p>
            )}
            <ProgressBar value={grammar.read} max={grammar.total} label={`${grammar.read} of ${grammar.total} lessons read`} className="mt-3.5 laptop:mt-5" />
            {grammar.read < grammar.total && (
              <p className="m-0 mt-2 hidden text-meta text-ink2 laptop:block">
                {grammar.total - grammar.read} {grammar.total - grammar.read === 1 ? "lesson" : "lessons"} to go
              </p>
            )}
            <p className="m-0 mt-3 flex flex-wrap items-baseline gap-x-2 text-meta text-ink2 wide:mt-auto wide:pt-4">
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
        <Card aria-labelledby="at-a-glance" className={`hidden laptop:flex laptop:flex-col laptop:gap-4 laptop:p-6 ${next ? "wide:col-span-2" : ""}`}>
          <SectionTitle id="at-a-glance" link={{ href: "/progress", label: "Progress" }}>
            N5 at a glance
          </SectionTitle>
          <StatGrid cols={4} className={`gap-y-5 ${next ? "wide:grid-cols-2" : ""}`}>
            <StatTile value={`${grammar.read} of ${grammar.total}`} label="lessons read" />
            <StatTile value={grammar.confident} label="lessons confident" tone="good" />
            <StatTile value={grammar.learning} label="lessons learning" tone="accent" />
            <StatTile value={kanaInReviews} label="kana in reviews" />
          </StatGrid>
          <p className="m-0 mt-auto border-t-[1.5px] border-line pt-3.5 text-meta text-ink2">
            Hiragana {kanaCounts(hiragana).review} of {hiragana.length} · Katakana {kanaCounts(katakana).review} of {katakana.length} in your reviews
          </p>
        </Card>
      </div>
      <nav aria-label="Learn">
        <List className="laptop:hidden">
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
        <ul className="m-0 hidden list-none grid-cols-3 gap-4 p-0 laptop:mt-2 laptop:grid wide:gap-5">
          {rows.map((r) => (
            <li key={r.href}>
              <Link
                href={r.href}
                className={`group relative flex h-44 flex-col justify-end overflow-hidden rounded-l-box rounded-r-btn-lg px-5 pb-4.5 text-on-cover no-underline transition-shadow duration-200 hover:shadow-raised wide:h-48 ${COVER_BG[r.cover]}`}
              >
                <span
                  aria-hidden="true"
                  lang="ja"
                  className={`absolute top-2 right-4 font-ja text-kana leading-none font-semibold transition-transform duration-200 ease-calm group-hover:-rotate-6 ${COVER_TONE_TEXT[r.cover]}`}
                >
                  {r.glyph}
                </span>
                <span className="relative border-b-[1.5px] border-ink/25 pb-1.5 text-lead font-black">{r.label}</span>
                <span className="relative mt-1.5 text-meta text-on-cover2">{r.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
