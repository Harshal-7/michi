"use client";

import { type ChangeEvent, useState, useTransition } from "react";

import { addMySentence, checkMySentence, deleteMySentence, editMySentence, saveNotes } from "@/app/(app)/grammar/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { SectionTitle } from "@/components/ui/page-header";
import { Ruby } from "@/components/ui/ruby";
import { defaultPart, type MySentence, splitPart } from "@/lib/learn/sentence-parts";

const OFFLINE = "That didn't save. Check your signal and try again.";

/**
 * "My sentences" on a lesson (RF_GrammarLessonWeb): your own sentences with the point, each with its
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
    <Card aria-labelledby="my-sentences" padding="none" className="flex flex-col gap-2 px-5.5 pt-2.5 pb-4">
      <SectionTitle id="my-sentences" meta={sentences.length ? `${sentences.length}` : "none yet"}>
        My sentences
      </SectionTitle>
      {sentences.length === 0 && editing !== "new" && (
        <p className="m-0 text-meta text-ink2">Write one with this point, then mark it checked once your teacher or a dictionary agrees.</p>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {sentences.map((s, i) => (
          <li key={s.id} className="border-b-[1.5px] border-line py-1.5 last:border-b-0">
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
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <div className="flex min-w-0 flex-auto basis-48 flex-col">
                  <p className="m-0 font-ja text-lead leading-ja font-semibold">
                    <Ruby text={s.ja} furigana={furigana} blank="accent" />
                  </p>
                  {s.en && <p className="m-0 text-meta text-ink2">{s.en}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {s.checked ? (
                    <span className="inline-flex items-center gap-1 text-meta font-bold text-good">
                      <Icon name="check" size={16} stroke={2.4} />
                      Checked
                    </span>
                  ) : (
                    <Button variant="secondary" size="sm" disabled={pending} onClick={() => toggle(s.id, true)}>
                      Mark as checked
                    </Button>
                  )}
                  <Button variant="text" size="sm" onClick={() => setEditing(s.id)} aria-label={`Edit sentence ${i + 1}`} className="px-2.5">
                    Edit
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {editing === "new" ? (
        <div className={sentences.length ? "border-t-[1.5px] border-line pt-1.5" : ""}>
          <SentenceForm
            initial={{ sentence: "", part: defaultPart(pattern), en: "" }}
            checked={false}
            onSave={(input) => addMySentence(itemId, input)}
            onDone={() => setEditing(null)}
          />
        </div>
      ) : (
        <Button variant="secondary" icon="plus" onClick={() => setEditing("new")} className="self-start">
          Add a sentence
        </Button>
      )}
      <p className="m-0 text-caption text-ink2">Unchecked sentences are never used as quiz answers.</p>
    </Card>
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
      className="flex flex-col gap-3 py-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => onSave(input));
      }}
    >
      <Field label="Sentence" ja required value={input.sentence} onChange={set("sentence")} autoFocus />
      <Field label="Grammar part" ja required value={input.part} onChange={set("part")} hint="It becomes the gap you fill on the card." />
      <Field label="English (optional)" value={input.en} onChange={set("en")} />
      {checked && <p className="m-0 text-meta text-ink2">Changing the Japanese takes the check off, so you can check it again.</p>}
      {error && (
        <p role="alert" className="m-0 text-meta font-bold text-again">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="submit" variant="secondary" size="sm" loading={pending} disabled={pending}>
          Save
        </Button>
        <Button variant="text" size="sm" disabled={pending} onClick={onDone} className="px-2.5">
          Cancel
        </Button>
        <span className="flex-auto" />
        {checked && onUncheck && (
          <Button variant="text" size="sm" disabled={pending} onClick={() => run(onUncheck)} className="px-2.5">
            Take the check off
          </Button>
        )}
        {onDelete && (
          <Button variant="danger" size="sm" icon="trash" disabled={pending} onClick={() => run(onDelete)}>
            Delete
          </Button>
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
    <div className="flex flex-col gap-1">
      <Field
        as="textarea"
        label="Notes"
        rows={2}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setStatus(null);
        }}
        onBlur={save}
        placeholder="What your teacher said, a tip, a mix-up to watch for"
      />
      <p aria-live="polite" className="m-0 min-h-5 text-meta text-ink2">
        {status}
      </p>
    </div>
  );
}
