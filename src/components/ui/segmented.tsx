import type { ReactNode } from "react";

import { Icon, type IconName } from "./icon";

export type SegmentedOption<V extends string> = {
  value: V;
  label: ReactNode;
  /** An icon before the label (Theme: monitor / sun / moon). */
  icon?: IconName;
  /** Marks the label as Japanese (lang="ja"). */
  ja?: boolean;
};

/**
 * A segmented control: a few exclusive choices in one track (Theme: System / Light / Dark; a grammar
 * point's status). Real radio inputs underneath, so it works in a <form> with `name`, with the arrow
 * keys, and uncontrolled (`defaultValue`) or controlled (`value` + `onChange`). The selected segment
 * is raised. For choices that are pages, use LinkTabs.
 *
 * @example
 * <Segmented label="Theme" name="theme" value={choice} onChange={setChoice}
 *   options={[{ value: "system", label: "System", icon: "monitor" }, …]} />
 */
export function Segmented<V extends string>({
  label,
  name,
  options,
  value,
  defaultValue,
  onChange,
  disabled,
  className,
}: {
  /** Names the group for screen readers (shown visually by whatever label sits above it). */
  label: string;
  /** The radio group's name (also the form field's name). */
  name: string;
  options: SegmentedOption<V>[];
  /** The chosen value, when you control it. */
  value?: V;
  /** The first choice, when the form controls it. */
  defaultValue?: V;
  onChange?: (value: V) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      className={`flex gap-1 rounded-track border-[1.5px] border-line bg-surface2 p-1 ${className ?? ""}`}
    >
      {options.map((o) => (
        <label
          key={o.value}
          className="relative flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-seg px-2 text-body leading-none font-bold text-ink2 transition-colors duration-120 hover:text-ink has-checked:bg-raised has-checked:font-black has-checked:text-ink has-checked:shadow-seg has-focus-visible:outline-[2.5px] has-focus-visible:outline-offset-[3px] has-focus-visible:outline-focus has-focus-visible:outline-solid has-disabled:cursor-default"
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            disabled={disabled}
            {...(value !== undefined ? { checked: value === o.value } : { defaultChecked: defaultValue === o.value })}
            onChange={() => onChange?.(o.value)}
            className="sr-only"
          />
          {o.icon && <Icon name={o.icon} size={18} />}
          <span lang={o.ja ? "ja" : undefined} className="truncate leading-normal">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}
