import type { Metadata } from "next";
import Link from "next/link";

import { Mixed } from "@/components/ruby";
import { ICONS } from "@/components/shell/nav";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page";
import { getDb } from "@/db/client";
import { requireSignedIn } from "@/lib/auth/session";
import { formatLong, studyDate } from "@/lib/day";
import { pointsFor } from "@/lib/learn/cached";
import { nextUnread, pointCounts, READ_THROUGH_LEVEL } from "@/lib/learn/grammar";
import { kanaCounts, loadKana } from "@/lib/learn/kana";
import { ROUTES } from "@/lib/planner/day-plan";

export const metadata: Metadata = { title: "Learn" };

/** Learn: the kana charts, verb forms and the grammar lessons, with the N5 read-through up top while it's going. */
export default async function LearnPage() {
  await requireSignedIn();
  const db = getDb();
  const [hiragana, katakana, n5] = await Promise.all([loadKana(db, "hiragana"), loadKana(db, "katakana"), pointsFor(READ_THROUGH_LEVEL)]);
  const grammar = pointCounts(n5);
  const next = nextUnread(n5);
  const kanaNote = (rows: typeof hiragana) => {
    const c = kanaCounts(rows);
    return `${rows.length} characters · ${c.review} in your reviews`;
  };
  const rows = [
    { href: "/learn/kana/hiragana", label: "Hiragana", note: kanaNote(hiragana), glyph: "あ" },
    { href: "/learn/kana/katakana", label: "Katakana", note: kanaNote(katakana), glyph: "ア" },
    { href: ROUTES.kanaGame, label: "Kana game", note: "read a kana and type it, or hear it and find it", glyph: "か" },
    { href: "/learn/verbs", label: "Verb forms", note: "the 3 groups; ます, ない, て and た", glyph: "て" },
    { href: ROUTES.vocab, label: "Vocabulary", note: "type the meaning or the word · N5 to N3", glyph: "語" },
    { href: ROUTES.grammar, label: "Grammar", note: `N5 · ${grammar.total} points · ${grammar.confident} confident · ${grammar.learning} learning`, glyph: "文" },
  ];

  return (
    <>
      <PageHeader kicker={formatLong(studyDate())} title="Learn" />
      {next && (
        <section className="flex flex-col gap-2 rounded-card bg-surface px-4 py-3.5 shadow-hero">
          <p className="m-0 text-xs font-semibold text-ink2">N5 grammar read-through</p>
          <h2 className="m-0 text-[17px] font-bold">
            {grammar.read === 0 ? "Read each lesson once" : `${grammar.read} of ${grammar.total} lessons read`}
          </h2>
          <p className="m-0 text-[13px] leading-[1.6] text-ink2">
            At the end of each lesson, pick &ldquo;I know this&rdquo; or &ldquo;Learn it&rdquo;. What you know comes back in reviews
            in a few weeks; the rest goes to the front of your new cards.
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-track" aria-hidden="true">
            <div className="h-full bg-good" style={{ width: `${grammar.total ? (grammar.read / grammar.total) * 100 : 0}%` }} />
          </div>
          <p className="m-0 text-[13px]">
            <span className="text-ink2">Next: </span>
            <span className="font-card text-base font-semibold">
              <Mixed text={next.pattern} />
            </span>
            <span className="text-ink2"> · {next.gloss}</span>
          </p>
          <Link
            href={`/grammar/${next.id}`}
            className="flex min-h-[50px] items-center justify-center rounded-btn bg-accent px-4 text-[15px] font-bold text-on-accent no-underline"
          >
            {grammar.read === 0 ? "Start the read-through" : "Continue"}
          </Link>
        </section>
      )}
      <nav aria-label="Learn" className="flex flex-col rounded-card bg-surface px-3.5 py-1 shadow-card">
        {rows.map((r, i) => (
          <Link key={r.href} href={r.href} className={`flex min-h-[60px] items-center gap-3.5 py-2 no-underline ${i > 0 ? "border-t border-line" : ""}`}>
            <span lang="ja" aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface2 font-card text-xl font-semibold">
              {r.glyph}
            </span>
            <span className="flex min-w-0 flex-auto flex-col gap-px">
              <span className="text-[15px] font-semibold">{r.label}</span>
              <span className="text-[12.5px] text-ink2">{r.note}</span>
            </span>
            <Icon d={ICONS.chevronRight} size={18} stroke={1.8} className="shrink-0 text-ink2" />
          </Link>
        ))}
      </nav>
    </>
  );
}
