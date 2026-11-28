"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceChips } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";

import { addMinutes, type MinutesState } from "./actions";
import { DEFAULT_SKILL, KIND_LABELS, type LoggableKind, LOGGABLE_KINDS, SKILL_LABELS } from "./kinds";

/** Minutes by kind and skill. The skill follows the kind until you change it. */
export function MinutesForm({ initialKind, days }: { initialKind: LoggableKind; days: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState<MinutesState, FormData>(addMinutes, {});
  const [kind, setKind] = useState<LoggableKind>(initialKind);
  const [skill, setSkill] = useState<string>(DEFAULT_SKILL[initialKind]);
  const [formKey, setFormKey] = useState(0);
  const [lastSaved, setLastSaved] = useState(state.saved);
  // A fresh form after each save (the kind and skill stay).
  if (state.saved !== lastSaved) {
    setLastSaved(state.saved);
    if (state.saved) setFormKey((k) => k + 1);
  }

  return (
    <Card as="div" className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        <fieldset className="m-0 flex flex-col gap-1.5 border-none p-0">
          <legend className="mb-1.5 p-0 text-meta font-bold">What you did</legend>
          <ChoiceChips
            label="What you did"
            name="kind"
            options={LOGGABLE_KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))}
            value={kind}
            onChange={(k) => {
              setKind(k);
              setSkill(DEFAULT_SKILL[k]);
            }}
          />
        </fieldset>
        <div key={formKey} className="grid grid-cols-2 gap-3">
          <Field label="Minutes" type="number" name="minutes" inputMode="numeric" min={1} max={600} required placeholder="15" />
          <Field as="select" label="Counts towards" name="skill" value={skill} onChange={(e) => setSkill(e.target.value)}>
            {Object.entries(SKILL_LABELS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </Field>
          <Field as="select" label="Day" name="date" defaultValue={days[0].value}>
            {days.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Field>
          <Field label="Note" type="text" name="note" maxLength={200} placeholder="optional" />
        </div>
        {state.error && (
          <p role="alert" className="m-0 text-meta font-bold text-again">
            {state.error}
          </p>
        )}
        {state.saved && !state.error && (
          <p role="status" className="m-0 text-meta font-bold text-good">
            Saved {state.saved.minutes} min of {KIND_LABELS[state.saved.label as LoggableKind].toLowerCase()}.
          </p>
        )}
        <Button type="submit" size="lg" full loading={pending} disabled={pending}>
          {pending ? "Saving…" : "Save minutes"}
        </Button>
      </form>
    </Card>
  );
}
