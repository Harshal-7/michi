import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, useId } from "react";

import { Icon } from "./icon";

const CONTROL =
  "block w-full rounded-btn border-[1.5px] border-line-strong bg-surface px-4 text-ink outline-none transition-[border-color,box-shadow] duration-120 placeholder:text-ink3 focus:border-accent focus:shadow-field aria-invalid:border-again disabled:border-line disabled:bg-surface2 disabled:text-ink3";

type Common = {
  /** The visible label above (14/700). */
  label: ReactNode;
  /** A quiet line under the control. */
  hint?: ReactNode;
  /** What's wrong, in the again colour with an alert icon; also sets aria-invalid. */
  error?: ReactNode;
  /** Japanese values: Klee One at 22px with lang="ja". */
  ja?: boolean;
  /** Classes for the wrapper. */
  className?: string;
};

type FieldProps = Common &
  (
    | ({ as?: "input" } & InputHTMLAttributes<HTMLInputElement>)
    | ({ as: "textarea" } & TextareaHTMLAttributes<HTMLTextAreaElement>)
    | ({ as: "select"; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>)
  );

/**
 * A labelled input, textarea or select: label 14/700 above, a 52-tall box (radius 14, 16px text,
 * 1.5px line-strong edge), the hint or error under it. Focus = accent edge + a soft ring. Every other
 * prop (name, defaultValue, required, onChange, ref …) goes to the control itself, so uncontrolled
 * form fields keep working.
 *
 * @example <Field label="Meaning" name="meaning" placeholder="e.g. warm" />
 * <Field label="Word" name="term" ja error={problem} />
 * <Field as="select" label="Deck" name="deck">{options}</Field>
 */
export function Field(props: FieldProps) {
  const { label, hint, error, ja, className, as = "input", ...rest } = props as Common & { as?: string; id?: string } & Record<string, unknown>;
  const auto = useId();
  const id = (rest.id as string | undefined) ?? auto;
  const note = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const size = ja ? "font-ja text-title" : "text-body";
  const shared = {
    ...rest,
    id,
    lang: ja ? "ja" : (rest.lang as string | undefined),
    "aria-invalid": error ? true : (rest["aria-invalid"] as boolean | undefined),
    "aria-describedby": [note, rest["aria-describedby"]].filter(Boolean).join(" ") || undefined,
  };
  return (
    <div className={`flex w-full flex-col ${className ?? ""}`}>
      <label htmlFor={id} className={`mb-1.5 text-meta font-bold ${rest.disabled ? "text-ink3" : "text-ink"}`}>
        {label}
      </label>
      {as === "textarea" ? (
        <textarea {...(shared as TextareaHTMLAttributes<HTMLTextAreaElement>)} className={`${CONTROL} min-h-28 py-3.5 ${size}`} />
      ) : as === "select" ? (
        <select {...(shared as SelectHTMLAttributes<HTMLSelectElement>)} className={`${CONTROL} h-13 ${size}`} />
      ) : (
        <input {...(shared as InputHTMLAttributes<HTMLInputElement>)} className={`${CONTROL} h-13 ${size}`} />
      )}
      {error ? (
        <p id={note} className="m-0 mt-1.5 flex items-center gap-1.5 text-meta font-bold text-again">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={note} className="m-0 mt-1.5 text-meta text-ink2">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The big typed-answer box of a quiz or the kana game: 64 tall, centred 22px text, a 2px edge that turns
 * good or again after checking. Pass every input prop through (ref, name, onKeyDown, autoComplete …);
 * give it an aria-label or a <label>.
 *
 * @example <AnswerInput ref={box} aria-label="Type how it sounds" state={feedback} ja={false} />
 */
export function AnswerInput({
  state = "idle",
  ja,
  className,
  ...rest
}: {
  /** idle · right (good edge) · wrong (again edge, aria-invalid). */
  state?: "idle" | "right" | "wrong";
  /** Japanese answers: Klee One with lang="ja". */
  ja?: boolean;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const edge = { idle: "border-line-strong focus:border-accent focus:shadow-field", right: "border-good", wrong: "border-again" }[state];
  return (
    <input
      lang={ja ? "ja" : undefined}
      aria-invalid={state === "wrong" || undefined}
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      {...rest}
      className={`block h-16 w-full rounded-btn-lg border-2 bg-surface px-4 text-center text-title font-bold text-ink outline-none transition-[border-color,box-shadow] duration-120 placeholder:font-medium placeholder:text-ink3 ${
        ja ? "font-ja" : ""
      } ${edge} ${className ?? ""}`}
    />
  );
}
