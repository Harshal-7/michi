"use client";

import { useState, useTransition } from "react";

import { type EditedItem, editItem, flagItem } from "@/lib/srs/item-actions";
import type { StudyCard } from "@/lib/srs/types";

const INPUT =
  "min-h-11 w-full box-border rounded-xl border-2 border-line bg-page px-3 text-[15px] font-medium outline-none focus:border-accent";
const LABEL = "flex flex-col gap-1.5 text-[12.5px] font-bold";

/**
 * Flag a card that reads wrong, or fix the item yourself. Shown in place of the card's face, built
 * from the chips, inputs and buttons on F_Parts.
 */
export function FlagEditPanel({
  card,
  onClose,
  onEdited,
}: {
  card: StudyCard;
  onClose: (message?: string) => void;
  onEdited: (itemId: number, item: EditedItem) => void;
}) {
  const [mode, setMode] = useState<"flag" | "edit">("flag");
  const [note, setNote] = useState("");
  const [term, setTerm] = useState(card.item.term);
  const [reading, setReading] = useState(card.item.reading ?? "");
  const [meaning, setMeaning] = useState(card.item.meaning);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const isKana = card.item.kind === "kana";

  const submit = () =>
    start(async () => {
      setError(null);
      try {
        if (mode === "flag") {
          const shown = { term: card.item.term, reading: card.item.reading, meaning: card.item.meaning, cardType: card.cardType };
          const result = await flagItem({ itemId: card.item.id, cardId: card.id, note, shown });
          if ("error" in result) setError(result.error);
          else onClose("Flagged. It's on your list in Settings → Flagged items.");
        } else {
          const result = await editItem({ itemId: card.item.id, term, reading, meaning });
          if ("error" in result) setError(result.error);
          else {
            onEdited(card.item.id, result.item);
            onClose("Saved. Your edit stays, even when the content is updated.");
          }
        }
      } catch {
        setError("That didn't save. Check your signal and try again.");
      }
    });

  return (
    <form
      className="flex w-full flex-auto flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div role="radiogroup" aria-label="Flag or edit" className="flex gap-1.5">
        {(["flag", "edit"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`min-h-11 rounded-btn px-4 text-[13px] ${
              mode === m ? "bg-ink font-bold text-page" : "border border-line"
            }`}
          >
            {m === "flag" ? "Flag this card" : "Edit it"}
          </button>
        ))}
      </div>
      {mode === "flag" ? (
        <label className={LABEL}>
          What reads wrong?
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="The reading, the meaning, the example…"
            className={`${INPUT} py-2.5`}
          />
        </label>
      ) : (
        <>
          <label className={LABEL}>
            {card.item.kind === "grammar" ? "Pattern" : card.item.kind === "kana" ? "Kana" : "Term"}
            <input lang="ja" value={term} onChange={(e) => setTerm(e.target.value)} className={INPUT} />
          </label>
          {card.item.kind !== "grammar" && (
            <label className={LABEL}>
              {isKana ? "Romaji" : "Reading"}
              <input lang={isKana ? undefined : "ja"} value={reading} onChange={(e) => setReading(e.target.value)} className={INPUT} />
            </label>
          )}
          {!isKana && (
            <label className={LABEL}>
              Meaning
              <input value={meaning} onChange={(e) => setMeaning(e.target.value)} className={INPUT} />
            </label>
          )}
          <p className="m-0 text-[12.5px] text-ink2">Your edit is kept when the starter content is updated.</p>
        </>
      )}
      {error && (
        <p role="alert" className="m-0 text-[13px] font-semibold text-again">
          {error}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onClose()}
          className="min-h-11 rounded-btn border border-line bg-surface px-4 text-sm font-semibold"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || (mode === "flag" && note.trim() === "")}
          className="min-h-11 rounded-btn bg-accent px-[18px] text-sm font-bold text-on-accent disabled:opacity-60"
        >
          {pending ? "Saving…" : mode === "flag" ? "Flag it" : "Save the edit"}
        </button>
      </div>
    </form>
  );
}
