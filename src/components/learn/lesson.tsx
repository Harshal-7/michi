// design-lint: legacy
import Link from "next/link";

import { SpeakButton } from "@/components/ui/speak-button";
import { VoiceProvider } from "@/components/ui/voice";
import { Mixed, Ruby } from "@/components/ui/ruby";
import type { Lesson } from "@/lib/learn/grammar";
import type { Mine } from "@/lib/learn/sentences";
import { spoken } from "@/lib/voice/spoken";
import type { VoicePrefs } from "@/lib/voice/voices";

import { LessonCheck, StatusChips } from "./lesson-parts";
import { LessonNotes, MySentences } from "./my-sentences";
import { BackLink } from "@/components/ui/back-link";

const card = "flex flex-col gap-2 rounded-card bg-surface px-3.5 py-3 shadow-card laptop:gap-1 laptop:px-6 laptop:py-5";
const SITE = { jlptsensei: "JLPT Sensei", bunpro: "Bunpro" } as const;
const OUT = "M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5";
const same = (a: string, b: string) => a.replace(/[\s〜()（）]/g, "").toLowerCase() === b.replace(/[\s〜()（）]/g, "").toLowerCase();

/**
 * A grammar lesson (F_GrammarPoint): the pattern, its short meaning and how it's made, the
 * explanation, examples you can hear, look-alikes, links, your own sentences and notes, then the
 * check and "I know this" / "Learn it".
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
  const kicker = [lesson.level, lesson.topic, progress && `${progress.read} of ${progress.total} read`].filter(Boolean).join(" · ");
  return (
    <VoiceProvider prefs={voice}>
      <div className="laptop:hidden">
        <BackLink href="/grammar">Grammar</BackLink>
      </div>
      <header className="flex flex-col gap-[3px] laptop:gap-1">
        <p className="m-0 text-[12.5px] text-ink2">{kicker}</p>
        <h1 className="m-0 font-card text-[36px] leading-[1.25] font-semibold laptop:text-[40px]">
          <Mixed text={lesson.pattern} />
        </h1>
        <p className="m-0 text-[15px] font-semibold">{lesson.gloss}</p>
        {lesson.formation && !same(lesson.formation, lesson.pattern) && (
          <p className="m-0 text-[12.5px] text-ink2">
            How it&apos;s made: <Mixed text={lesson.formation} furigana={furigana} />
          </p>
        )}
      </header>
      <p className="m-0 text-[14.5px] leading-[1.7] laptop:max-w-[64ch] laptop:text-[15.5px] laptop:leading-[1.75]">
        <Mixed text={lesson.meaning} />
      </p>
      <StatusChips itemId={lesson.id} status={lesson.status} />

      {lesson.examples.length > 0 && (
        <section className={card}>
          <h2 className="m-0 text-[13px] font-bold laptop:mb-1">Examples</h2>
          {lesson.examples.map((ex, i) => (
            <div key={ex.ja} className={`flex items-center gap-2 laptop:gap-4 laptop:py-2.5 ${i ? "laptop:border-t laptop:border-line" : ""}`}>
              <div className="flex min-w-0 flex-auto flex-col gap-px">
                <p className="m-0 font-card text-lg leading-[1.85] laptop:text-[20px]">
                  <Ruby text={ex.ja} furigana={furigana} blank="accent" />
                </p>
                <p className="m-0 text-[13px] text-ink2 laptop:text-[13.5px]">{ex.en}</p>
              </div>
              <SpeakButton variant="icon" text={spoken(ex.ja)} label={`Play example ${i + 1}`} />
            </div>
          ))}
        </section>
      )}

      <div className="flex flex-col gap-3 wide:grid wide:grid-cols-[minmax(0,1fr)_220px] wide:items-start wide:gap-4">
      {lesson.confusables.length > 0 && (
        <section className={card}>
          <h2 className="m-0 text-[13px] font-bold">Don&apos;t mix up with</h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {lesson.confusables.map((c, i) => (
              <li key={c.id} className={i ? "border-t border-line" : ""}>
                <Link href={`/grammar/${c.id}`} className="flex min-h-11 items-baseline gap-2 py-1.5 no-underline">
                  <span className="font-card text-base font-semibold">
                    <Mixed text={c.pattern} />
                  </span>
                  <span className="text-[13px] text-ink2">{c.gloss}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {lesson.links.length > 0 && (
        <div className="grid grid-cols-2 gap-2 wide:col-start-2 wide:grid-cols-1">
          {lesson.links.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center justify-between gap-1.5 rounded-btn border border-line bg-surface px-3.5 text-[13.5px] font-semibold no-underline"
            >
              {SITE[l.site]}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={OUT} />
              </svg>
            </a>
          ))}
        </div>
      )}
      </div>

      <MySentences key={`s${lesson.id}`} itemId={lesson.id} pattern={lesson.pattern} sentences={mine.sentences} furigana={furigana} />
      <LessonNotes key={`n${lesson.id}`} itemId={lesson.id} notes={mine.notes} />

      <LessonCheck
        key={lesson.id}
        lesson={{ id: lesson.id, questions: lesson.questions, status: lesson.status, read: lesson.read, verdict: lesson.verdict }}
        furigana={furigana}
      />
    </VoiceProvider>
  );
}
