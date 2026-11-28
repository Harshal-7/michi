"use client";

/**
 * The on/off switch: a 52 × 32 track (accent when on, a control-edge edge when off, 3:1) with a sliding
 * knob. A real checkbox with role="switch" underneath, covering a 52 × 44 hit area round the track. Controlled (`checked` + `onChange`) or, in a
 * form, uncontrolled (`defaultChecked` + `name`).
 *
 * @example <Switch label="Speech recognition" checked={on} onChange={setOn} />
 */
export function Switch({
  checked,
  defaultChecked,
  onChange,
  label,
  name,
  disabled,
}: {
  /** On or off, when you control it. */
  checked?: boolean;
  /** The first state, when a form controls it. */
  defaultChecked?: boolean;
  onChange?: (on: boolean) => void;
  /** What it switches, read out (the visible label usually sits beside it). */
  label: string;
  /** Form field name. */
  name?: string;
  disabled?: boolean;
}) {
  return (
    <span className="relative inline-block h-11 w-13 shrink-0">
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        name={name}
        {...(checked !== undefined ? { checked } : { defaultChecked })}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="peer absolute inset-0 m-0 size-full cursor-pointer opacity-0 disabled:cursor-default"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1.5 h-8 rounded-full border-[1.5px] border-control-edge bg-track transition-colors duration-200 peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-[2.5px] peer-focus-visible:outline-offset-[3px] peer-focus-visible:outline-focus peer-focus-visible:outline-solid peer-disabled:opacity-60"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-2.5 left-1 size-6 rounded-full bg-snow shadow-btn transition-transform duration-200 ease-calm peer-checked:translate-x-5"
      />
    </span>
  );
}
