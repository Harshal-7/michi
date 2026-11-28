"use client";
// design-lint: legacy

import { useActionState, useState } from "react";

import { addMinutes, type MinutesState } from "./actions";
import { DEFAULT_SKILL, KIND_LABELS, type LoggableKind, LOGGABLE_KINDS, SKILL_LABELS } from "./kinds";

const field = "min-h-11 w-full rounded-xl border border-line bg-page px-3 text-[15px] font-normal focus-visible:border-accent";
const label = "flex flex-col gap-1.5 text-[12.5px] font-bold";

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
    <form action={action} className="flex flex-col gap-3.5 rounded-card bg-surface p-4 shadow-card">
      <fieldset className="m-0 flex flex-col gap-1.5 border-none p-0">
        <legend className="mb-1.5 p-0 text-[12.5px] font-bold">What you did</legend>
        <div className="flex flex-wrap gap-1.5">
          {LOGGABLE_KINDS.map((k) => (
            <label
              key={k}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-full px-3.5 text-[13px] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                kind === k ? "bg-ink font-bold text-page" : "border border-line"
              }`}
            >
              <input
                type="radio"
                name="kind"
                value={k}
                checked={kind === k}
                onChange={() => {
                  setKind(k);
                  setSkill(DEFAULT_SKILL[k]);
                }}
                className="sr-only"
              />
              {KIND_LABELS[k]}
            </label>
          ))}
        </div>
      </fieldset>
      <div key={formKey} className="grid grid-cols-2 gap-3">
        <label className={label}>
          Minutes
          <input type="number" name="minutes" inputMode="numeric" min={1} max={600} required placeholder="15" className={field} />
        </label>
        <label className={label}>
          Counts towards
          <select name="skill" value={skill} onChange={(e) => setSkill(e.target.value)} className={field}>
            {Object.entries(SKILL_LABELS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Day
          <select name="date" defaultValue={days[0].value} className={field}>
            {days.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Note <span className="sr-only">(optional)</span>
          <input type="text" name="note" maxLength={200} placeholder="optional" className={field} />
        </label>
      </div>
      {state.error && (
        <p role="alert" className="m-0 text-[13px] font-semibold text-again">
          {state.error}
        </p>
      )}
      {state.saved && !state.error && (
        <p role="status" className="m-0 text-[13px] font-semibold text-good">
          Saved {state.saved.minutes} min of {KIND_LABELS[state.saved.label as LoggableKind].toLowerCase()}.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-[50px] rounded-btn border-none bg-accent text-base font-bold text-on-accent disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save minutes"}
      </button>
    </form>
  );
}
