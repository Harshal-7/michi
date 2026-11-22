"use client";

/** The on/off switch from F_Decks and F_Settings: a 46×28 track with a sliding knob. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <span className="relative h-7 w-[46px] shrink-0">
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer absolute inset-0 m-0 size-full cursor-pointer opacity-0 disabled:cursor-default"
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rounded-full peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
          checked ? "bg-accent" : "border border-line bg-track"
        }`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute top-[3px] size-[22px] rounded-full bg-surface shadow-[0_1px_3px_var(--shadow)] transition-[left] ${
          checked ? "left-[21px]" : "left-[3px]"
        }`}
      />
    </span>
  );
}
