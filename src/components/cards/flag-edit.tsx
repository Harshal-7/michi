"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { type EditedItem, editItem, flagItem } from "@/lib/srs/item-actions";
import type { StudyCard } from "@/lib/srs/types";

/**
 * Flag a card that reads wrong, or fix the item yourself. Shown in place of the card's face, built
 * from the shared parts (RF_Parts): a segmented choice, fields and buttons.
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
      className="flex w-full flex-auto flex-col gap-4 pt-4 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Segmented
        label="Flag or edit"
        name="flag-or-edit"
        value={mode}
        onChange={setMode}
        options={[
          { value: "flag", label: "Flag it", icon: "flag" },
          { value: "edit", label: "Edit it", icon: "edit" },
        ]}
      />
      {mode === "flag" ? (
        <Field
          as="textarea"
          label="What reads wrong?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="The reading, the meaning, the example…"
        />
      ) : (
        <>
          <Field
            label={card.item.kind === "grammar" ? "Pattern" : card.item.kind === "kana" ? "Kana" : "Term"}
            ja
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          {card.item.kind !== "grammar" && (
            <Field label={isKana ? "Romaji" : "Reading"} ja={!isKana} value={reading} onChange={(e) => setReading(e.target.value)} />
          )}
          {!isKana && <Field label="Meaning" value={meaning} onChange={(e) => setMeaning(e.target.value)} />}
          <p className="m-0 text-meta text-ink2">Your edit is kept when the starter content is updated.</p>
        </>
      )}
      {error && (
        <p role="alert" className="m-0 text-meta font-bold text-again">
          {error}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-end gap-2">
        <Button variant="text" onClick={() => onClose()}>
          Cancel
        </Button>
        <Button type="submit" loading={pending} disabled={pending || (mode === "flag" && note.trim() === "")}>
          {pending ? "Saving…" : mode === "flag" ? "Flag it" : "Save the edit"}
        </Button>
      </div>
    </form>
  );
}
