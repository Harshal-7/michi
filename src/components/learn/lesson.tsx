import Link from "next/link";

import { BackLink } from "@/components/ui/back-link";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { SectionTitle } from "@/components/ui/page-header";
import { Mixed, Ruby } from "@/components/ui/ruby";
import { SpeakButton } from "@/components/ui/speak-button";
import { VoiceProvider } from "@/components/ui/voice";
import type { Lesson } from "@/lib/learn/grammar";
import type { Mine } from "@/lib/learn/sentences";
import { spoken } from "@/lib/voice/spoken";
import type { VoicePrefs } from "@/lib/voice/voices";

import { LessonCheck, StatusChips } from "./lesson-parts";
import { LessonNotes, MySentences } from "./my-sentences";

const SITE = { jlptsensei: "JLPT Sensei", bunpro: "Bunpro" } as const;
const same = (a: string, b: string) => a.replace(/[\s〜()（）]/g, "").toLowerCase() === b.replace(/[\s〜()（）]/g, "").toLowerCase();
/** A card on a laptop, a plain section on a phone (RF_GrammarLesson vs RF_GrammarLessonWeb). */
const LAPTOP_CARD = "laptop:rounded-card laptop:border-[1.5px] laptop:border-line laptop:bg-surface laptop:px-5.5 laptop:pt-2.5 laptop:pb-2 laptop:shadow-card";

type Confusable = Lesson["confusables"][number];

function MixUps({ items }: { items: Confusable[] }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {items.map((c) => (
        <li key={c.id} className="border-b-[1.5px] border-line last:border-b-0">
          <Link href={`/grammar/${c.id}`} className="flex min-h-12 items-center gap-2.5 py-1 text-ink no-underline">
            <span className="font-ja text-lead font-semibold">
              <Mixed text={c.pattern} />
            </span>
            <span className="min-w-0 flex-1 text-meta text-ink2">
              <Mixed text={c.gloss} />
            </span>
            <Icon name="chevron-right" size={20} className="text-ink3" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Links({ links }: { links: Lesson["links"] }) {
  return (
    <div className="grid grid-cols-2 gap-2 laptop:grid-cols-1">
      {links.map((l) => (
        <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "secondary", full: true, className: "justify-between" })}>
          <span>{SITE[l.site]}</span>
          <Icon name="external" size={18} className="text-ink2" />
        </a>
      ))}
    </div>
  );
}

/**
 * A grammar lesson (RF_GrammarLesson, RF_GrammarLessonWeb): the pattern, its short meaning and how it's
 * made, the explanation, examples you can hear, look-alikes, links, your own sentences and notes,
 * then where you are with it, the check and "I know this" / "Learn it". A reader on the phone (no
 * bottom bar); two columns on a laptop.
 */
export function LessonView({
  lesson,
  furigana,
  voice,
  progress,
  mine,
}: {
  lesson: Lesson;
  /** Your sentences and notes on this point. */
  mine: Mine;
  furigana: boolean;
  voice: VoicePrefs;
  /** The read-through so far, while it's going. */
  progress: { read: number; total: number } | null;
}) {
  return (
    <VoiceProvider prefs={voice}>
      <div data-wide data-session="" className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <BackLink href="/grammar">Grammar</BackLink>
          {progress && (
            <span className="text-meta font-bold text-ink2">
              <span className="max-laptop:hidden">{lesson.level} read-through · </span>
              {progress.read} of {progress.total} read
            </span>
          )}
        </div>
        <div className="flex flex-col gap-6 laptop:grid laptop:grid-cols-[minmax(0,1fr)_380px] laptop:items-start laptop:gap-9">
          <div className="flex min-w-0 flex-col gap-3 laptop:gap-5">
            <header className="flex flex-col">
              <h1 className="m-0 font-ja text-display leading-snug font-semibold tracking-wide">
                <Mixed text={lesson.pattern} />
              </h1>
              <p className="m-0 mt-0.5 text-lead font-bold">
                <Mixed text={lesson.gloss} />
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Chip cover="blue">{lesson.level}</Chip>
                {lesson.topic && <Chip cover="lilac"><Mixed text={lesson.topic} /></Chip>}
              </div>
              {lesson.formation && !same(lesson.formation, lesson.pattern) && (
                <p className="m-0 mt-3 text-meta text-ink2">
                  <b className="font-bold text-ink">How it&apos;s made</b> · <Mixed text={lesson.formation} furigana={furigana} />
                </p>
              )}
              <p className="m-0 mt-2 max-w-[60ch] text-body laptop:mt-3">
                <Mixed text={lesson.meaning} />
              </p>
            </header>

            {lesson.examples.length > 0 && (
              <section aria-labelledby="examples" className={LAPTOP_CARD}>
                <SectionTitle id="examples">Examples</SectionTitle>
                <ul className="m-0 flex list-none flex-col p-0">
                  {lesson.examples.map((ex, i) => (
                    <li key={ex.ja} className="flex items-center gap-3 border-b-[1.5px] border-line py-1.5 last:border-b-0 laptop:py-2.5">
                      <div className="flex min-w-0 flex-auto flex-col">
                        <p className="m-0 font-ja text-title leading-ja font-semibold">
                          <Ruby text={ex.ja} furigana={furigana} blank="accent" />
                        </p>
                        <p className="m-0 text-meta text-ink2">{ex.en}</p>
                      </div>
                      <SpeakButton variant="icon" text={spoken(ex.ja)} label={`Play example ${i + 1}`} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {lesson.confusables.length > 0 && (
              <section aria-labelledby="mix-ups-phone" className="laptop:hidden">
                <SectionTitle id="mix-ups-phone">Don&apos;t mix up with</SectionTitle>
                <MixUps items={lesson.confusables} />
              </section>
            )}
            {lesson.links.length > 0 && (
              <div className="laptop:hidden">
                <Links links={lesson.links} />
              </div>
            )}

            <MySentences key={`s${lesson.id}`} itemId={lesson.id} pattern={lesson.pattern} sentences={mine.sentences} furigana={furigana} />
            <LessonNotes key={`n${lesson.id}`} itemId={lesson.id} notes={mine.notes} />
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <StatusChips itemId={lesson.id} status={lesson.status} />
            <LessonCheck
              key={lesson.id}
              lesson={{ id: lesson.id, questions: lesson.questions, status: lesson.status, read: lesson.read, verdict: lesson.verdict }}
              furigana={furigana}
            />
            {lesson.confusables.length > 0 && (
              <Card aria-labelledby="mix-ups" padding="none" className="px-5 pt-2 pb-1.5 max-laptop:hidden">
                <SectionTitle id="mix-ups">Don&apos;t mix up with</SectionTitle>
                <MixUps items={lesson.confusables} />
              </Card>
            )}
            {lesson.links.length > 0 && (
              <div className="max-laptop:hidden">
                <Links links={lesson.links} />
              </div>
            )}
          </div>
        </div>
      </div>
    </VoiceProvider>
  );
}
