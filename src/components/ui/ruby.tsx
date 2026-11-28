import { blanks, parseRuby, toPlain } from "@content/schema";

/** The "this word" mark (RF_QuizQuestion): a 2px underline set 6px below. */
const MARK = "font-bold underline decoration-2 underline-offset-6";
/** The grammar point inside a lesson's example (F_GrammarPoint). */
const ACCENT = "font-bold text-accent";
/** Runs of Japanese inside English: kana, kanji, 〜 and Japanese punctuation. */
const JA_RUN = /([　-ヿ㐀-䶿一-鿿＀-￯]+)/u;

type Props = {
  /** Japanese with ruby markup: "{食|た}べる". May carry one [[answer]] blank. */
  text: string;
  /** Show furigana. Off renders the plain kanji (the furigana setting, round 1). */
  furigana?: boolean;
  /**
   * A [[blank]]: "fill" shows the answer underlined, "accent" in the accent colour (a lesson's
   * examples, F_GrammarPoint), "hide" a marked gap of about its length.
   */
  blank?: "fill" | "accent" | "hide";
  className?: string;
};

/**
 * The one way Japanese with furigana is shown. Always lang="ja", so kanji take Japanese shapes.
 * <rt> styling (half size, at least 11px, --ink2) lives in globals.css. Lines with furigana want
 * `leading-ja` for room above them.
 */
export function Ruby({ text, furigana = true, blank = "fill", className }: Props) {
  const [answer] = blanks(text);
  if (answer === undefined) {
    return (
      <span lang="ja" className={className}>
        <Segments text={text} furigana={furigana} />
      </span>
    );
  }
  const [before, after] = text.split(`[[${answer}]]`);
  return (
    <span lang="ja" className={className}>
      <Segments text={before} furigana={furigana} />
      {blank !== "hide" ? (
        <span className={blank === "accent" ? ACCENT : MARK}>
          <Segments text={answer} furigana={furigana} />
        </span>
      ) : (
        <>
          <span aria-hidden="true" className={MARK}>
            {"　".repeat(Math.max(2, [...toPlain(answer)].length))}
          </span>
          <span className="sr-only">(blank)</span>
        </>
      )}
      <Segments text={after} furigana={furigana} />
    </span>
  );
}

/**
 * English with Japanese in it, such as a grammar point's "verb て-form + ください": every Japanese
 * run gets lang="ja", and ruby markup shows furigana.
 */
export function Mixed({ text, furigana = true }: { text: string; furigana?: boolean }) {
  return parseRuby(text).map((s, i) =>
    s.reading !== undefined ? (
      <span key={i} lang="ja">
        {furigana ? (
          <ruby>
            {s.text}
            <rt>{s.reading}</rt>
          </ruby>
        ) : (
          s.text
        )}
      </span>
    ) : (
      s.text.split(JA_RUN).map((part, j) =>
        j % 2 === 1 ? (
          <span key={`${i}-${j}`} lang="ja">
            {part}
          </span>
        ) : (
          part
        ),
      )
    ),
  );
}

function Segments({ text, furigana }: { text: string; furigana: boolean }) {
  return parseRuby(text).map((s, i) =>
    s.reading && furigana ? (
      <ruby key={i}>
        {s.text}
        <rt>{s.reading}</rt>
      </ruby>
    ) : (
      s.text
    ),
  );
}
