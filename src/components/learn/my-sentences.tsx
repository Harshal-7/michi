"use client";

import { type ChangeEvent, useState, useTransition } from "react";

import { addMySentence, checkMySentence, deleteMySentence, editMySentence, saveNotes } from "@/app/(app)/grammar/actions";
import { Ruby } from "@/components/ruby";
import { Icon } from "@/components/ui/icon";
import { defaultPart, type MySentence, splitPart } from "@/lib/learn/sentence-parts";

const CARD = "flex flex-col gap-1.5 rounded-card bg-surface px-3.5 py-3 shadow-card laptop:px-6 laptop:py-5";
const INPUT = "min-h-11 w-full box-border rounded-xl border-2 border-line bg-page px-3 text-[15px] font-medium outline-none focus:border-accent";
const LABEL = "flex flex-col gap-1.5 text-[12.5px] font-bold";
const QUIET = "inline-flex min-h-11 shrink-0 items-center rounded-btn border border-line bg-surface2 px-3 text-[12.5px] font-semibold text-ink disabled:opacity-60";
const TEXT_BTN = "inline-flex min-h-11 shrink-0 items-center px-2 text-[12.5px] font-semibold text-ink2 disabled:opacity-60";
const CHECK = "M5 12.5l4.5 4.5L19 7";
const OFFLINE = "That didn't save. Check your signal and try again.";

/**
 * "My sentences" on a lesson (F_GrammarPoint): your own sentences with the point, each with its
 * grammar part marked as the fill-in blank. Checked ones join the point's fill-in card and the
 * quiz; unchecked ones never do.
 */
export function MySentences({ itemId, pattern, sentences, furigana }: { itemId: number; pattern: string; sentences: MySentence[]; furigana: boolean }) {
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [pending, start] = useTransition();

  const toggle = (id: number, checked: boolean) =>
    start(async () => {
      await checkMySentence(id, checked);
    });

  return (
    <section className={CARD} aria-labelledby="my-sentences">
      <h2 id="my-sentences" className="m-0 text-[13px] font-bold">
        My sentences
      </h2>
      {sentences.length === 0 && editing !== "new" && (
        <p className="m-0 text-[13px] text-ink2">None yet. Write one with this point, then mark it checked once your teacher or a dictionary agrees.</p>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {sentences.map((s, i) => (
          <li key={s.id} className={i ? "border-t border-line pt-1.5" : ""}>
            {editing === s.id ? (
              <SentenceForm
                initial={{ ...splitPart(s.ja), en: s.en }}
                checked={s.checked}
                onSave={(input) => editMySentence(s.id, input)}
                onDone={() => setEditing(null)}
                onDelete={() => deleteMySentence(s.id)}
                onUncheck={() => checkMySentence(s.id, false)}
              />
            ) : (
              <div className="flex min-h-11 items-center gap-2">
                <div className="flex min-w-0 flex-auto flex-col">
                  <p className="m-0 font-card text-[17px] leading-[1.85]">
                    <Ruby text={s.ja} furigana={furigana} blank="accent" />
                  </p>
                  {s.en && <p className="m-0 text-[13px] text-ink2">{s.en}</p>}
                </div>
                {s.checked ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-good">
                    <Icon d={CHECK} size={14} stroke={2.2} />
                    Checked
                  </span>
                ) : (
                  <button type="button" disabled={pending} onClick={() => toggle(s.id, true)} className={QUIET}>
                    Mark as checked
                  </button>
                )}
                <button type="button" onClick={() => setEditing(s.id)} className={TEXT_BTN} aria-label={`Edit sentence ${i + 1}`}>
                  Edit
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {editing === "new" ? (
        <div className={sentences.length ? "border-t border-line pt-1.5" : ""}>
          <SentenceForm
            initial={{ sentence: "", part: defaultPart(pattern), en: "" }}
            checked={false}
            onSave={(input) => addMySentence(itemId, input)}
            onDone={() => setEditing(null)}
          />
        </div>
      ) : (
        <button type="button" onClick={() => setEditing("new")} className={`${QUIET} self-start`}>
          Add a sentence
        </button>
      )}
      <p className="m-0 text-[11.5px] text-ink2">Unchecked sentences are never used as quiz answers.</p>
    </section>
  );
}

type Input = { sentence: string; part: string; en: string };

function SentenceForm({
  initial,
  checked,
  onSave,
  onDone,
  onDelete,
  onUncheck,
}: {
  initial: Input;
  checked: boolean;
  onSave: (input: Input) => Promise<{ ok: true } | { error: string }>;
  onDone: () => void;
  onDelete?: () => Promise<void>;
  onUncheck?: () => Promise<void>;
}) {
  const [input, setInput] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (key: keyof Input) => (e: ChangeEvent<HTMLInputElement>) => setInput((v) => ({ ...v, [key]: e.target.value }));
  const run = (work: () => Promise<{ ok: true } | { error: string } | void>) =>
    start(async () => {
      setError(null);
      try {
        const result = await work();
        if (result && "error" in result) setError(result.error);
        else onDone();
      } catch {
        setError(OFFLINE);
      }
    });

  return (
    <form
      className="flex flex-col gap-2.5 py-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => onSave(input));
      }}
    >
      <label className={LABEL}>
        Sentence
        <input lang="ja" required value={input.sentence} onChange={set("sentence")} className={INPUT} autoFocus />
      </label>
      <label className={LABEL}>
        Grammar part
        <input lang="ja" required value={input.part} onChange={set("part")} className={INPUT} />
        <span className="text-xs font-normal text-ink2">It becomes the blank on the fill-in card.</span>
      </label>
      <label className={LABEL}>
        English (optional)
        <input value={input.en} onChange={set("en")} className={INPUT} />
      </label>
      {checked && <p className="m-0 text-xs text-ink2">Changing the Japanese takes the check off, so you can check it again.</p>}
      {error && (
        <p role="alert" className="m-0 text-[13px] text-ink">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="submit" disabled={pending} className={QUIET}>
          Save
        </button>
        <button type="button" disabled={pending} onClick={onDone} className={TEXT_BTN}>
          Cancel
        </button>
        <span className="flex-auto" />
        {checked && onUncheck && (
          <button type="button" disabled={pending} onClick={() => run(onUncheck)} className={TEXT_BTN}>
            Take the check off
          </button>
        )}
        {onDelete && (
          <button type="button" disabled={pending} onClick={() => run(onDelete)} className={`${TEXT_BTN} text-again`}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
}

/** The lesson's notes, saved when you leave the box. */
export function LessonNotes({ itemId, notes }: { itemId: number; notes: string }) {
  const [text, setText] = useState(notes);
  const [saved, setSaved] = useState(notes);
  const [status, setStatus] = useState<string | null>(null);
  const [, start] = useTransition();
  const save = () => {
    if (text === saved) return;
    start(async () => {
      try {
        const result = await saveNotes(itemId, text);
        if ("error" in result) setStatus(result.error);
        else {
          setSaved(text);
          setStatus("Saved.");
        }
      } catch {
        setStatus(OFFLINE);
      }
    });
  };
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-ink2">
      <span className="flex items-baseline justify-between gap-2">
        Notes
        <span aria-live="polite" className="font-normal">
          {status}
        </span>
      </span>
      <textarea
        rows={2}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setStatus(null);
        }}
        onBlur={save}
        placeholder="What your teacher said, a tip, a mix-up to watch for"
        className="field-sizing-content min-h-[68px] w-full box-border resize-none rounded-xl border-2 border-line bg-page px-3 py-2 text-[13.5px] leading-normal font-normal text-ink outline-none focus:border-accent"
      />
    </label>
  );
}
