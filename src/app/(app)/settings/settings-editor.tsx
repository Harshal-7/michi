"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useState, useTransition } from "react";

import { ICONS } from "@/components/shell/nav";
import { setThemeChoice } from "@/components/theme-sync";
import { Icon } from "@/components/ui/icon";
import { daysBetween, formatDayMonth, formatShort, PHASE_NAMES, phaseFor, type StudyDate } from "@/lib/day";
import type { Settings, SettingsPatch } from "@/lib/settings/schema";
import type { ThemeChoice } from "@/lib/theme";

import { removeException, type SaveResult, saveException, saveSettings } from "./actions";

type Exception = { date: StudyDate; kind: "rest" | "no_class" | "exam"; note: string };

type EditorKey =
  | "phases"
  | "N4"
  | "N3"
  | "registration"
  | "deadlines"
  | "early"
  | "classes"
  | "budgets"
  | "recall"
  | "reminder"
  | "exceptions"
  | "furigana"
  | "theme";

const card = "rounded-card bg-surface shadow-card";
const groupTitle = "m-0 text-xs font-bold uppercase tracking-[0.04em] text-ink2";
const field = "min-h-11 w-full rounded-xl border border-line bg-page px-3 text-[15px] font-normal focus-visible:border-accent";
const label = "flex flex-col gap-1.5 text-[12.5px] font-bold";
const quiet = "inline-flex min-h-11 items-center justify-center rounded-btn border border-line bg-surface px-4 text-sm font-semibold no-underline";
const solid = "inline-flex min-h-11 items-center justify-center rounded-btn border-none bg-accent px-5 text-sm font-bold text-on-accent disabled:opacity-60";

const WEEKDAYS = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
] as const;
const EXCEPTION_NAMES: Record<Exception["kind"], string> = { rest: "Rest day", no_class: "No class", exam: "Exam day" };

/** "75 min", "2 h", "3.5 h", as F_Settings writes them. */
const hours = (minutes: number) => (minutes >= 60 && minutes % 30 === 0 ? `${minutes / 60} h` : `${minutes} min`);
const time12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
};
const hostName = (url: string | null) => {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** F_Settings: tiles that open an editor in place, the voice-and-look rows, and data. */
export function SettingsEditor({ settings, exceptions, today }: { settings: Settings; exceptions: Exception[]; today: StudyDate }) {
  const [open, setOpen] = useState<EditorKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toggle = (key: EditorKey) => {
    setOpen(open === key ? null : key);
    setError(null);
    setSaved(null);
  };
  const run = (work: () => Promise<SaveResult>, done: string, close = false) =>
    startTransition(async () => {
      const result = await work();
      if (result.ok) {
        setError(null);
        setSaved(done);
        if (close) setOpen(null);
      } else {
        setError(result.error);
        setSaved(null);
      }
    });
  const save = (patch: SettingsPatch, done = "Saved. Today's plan is up to date.") => run(() => saveSettings(patch), done);

  const phase = phaseFor(today, settings);
  const upcoming = exceptions.filter((e) => daysBetween(today, e.date) >= 0);
  const short = (d: StudyDate) => formatShort(d, today);
  const examLabel = (level: "N4" | "N3") => `JLPT ${level} · ${settings.exams[level].confirmed ? "confirmed" : "expected"}`;

  const status = (
    <>
      {error && (
        <p role="alert" className="m-0 text-[13px] font-semibold text-again">
          {error}
        </p>
      )}
      {saved && !error && (
        <p role="status" className="m-0 text-[13px] font-semibold text-good">
          {saved}
        </p>
      )}
    </>
  );

  const editors: Record<EditorKey, ReactNode> = {
    phases: (
      <Form
        pending={pending}
        onCancel={() => toggle("phases")}
        onSubmit={(f) =>
          save({
            phases: {
              n5: { start: f.get("n5") as string },
              n4: { start: f.get("n4") as string },
              n3: { start: f.get("n3") as string },
              work: { start: f.get("work") as string },
            },
          })
        }
        hint="Each phase runs until the next one starts."
      >
        {(["n5", "n4", "n3", "work"] as const).map((id) => (
          <DateField key={id} name={id} label={`${PHASE_NAMES[id]} starts`} value={settings.phases[id].start} />
        ))}
      </Form>
    ),
    N4: <ExamForm level="N4" settings={settings} pending={pending} onCancel={() => toggle("N4")} save={save} />,
    N3: <ExamForm level="N3" settings={settings} pending={pending} onCancel={() => toggle("N3")} save={save} />,
    registration: (
      <Form
        pending={pending}
        onCancel={() => toggle("registration")}
        onSubmit={(f) =>
          save({
            registration: {
              hostUrl: ((f.get("hostUrl") as string) || "").trim() || null,
              N4: { remindOn: f.get("n4") as string, registered: f.get("n4done") === "on" },
              N3: { remindOn: f.get("n3") as string, registered: f.get("n3done") === "on" },
            },
          })
        }
        hint={
          <>
            Your city&apos;s JLPT host runs registration. Find it on the{" "}
            <a href="https://www.jlpt.jp/e/application/overseas_list.html" target="_blank" rel="noreferrer" className="text-accent">
              official list of test sites
            </a>
            .
          </>
        }
      >
        <label className={`${label} col-span-2`}>
          Host&apos;s website
          <input type="url" name="hostUrl" defaultValue={settings.registration.hostUrl ?? ""} placeholder="https://" className={field} />
        </label>
        <DateField name="n4" label="N4 reminder from" value={settings.registration.N4.remindOn} />
        <DateField name="n3" label="N3 reminder from" value={settings.registration.N3.remindOn} />
        <Check name="n4done" label="Registered for N4" checked={settings.registration.N4.registered} />
        <Check name="n3done" label="Registered for N3" checked={settings.registration.N3.registered} />
      </Form>
    ),
    deadlines: (
      <Form
        pending={pending}
        onCancel={() => toggle("deadlines")}
        onSubmit={(f) => save({ listDeadlines: { N5: f.get("N5") as string, N4: f.get("N4") as string, N3: f.get("N3") as string } })}
        hint="The pace spreads each level's lists over the days left before these. A deck's own deadline wins."
      >
        {(["N5", "N4", "N3"] as const).map((lv) => (
          <DateField key={lv} name={lv} label={`${lv} lists by`} value={settings.listDeadlines[lv]} />
        ))}
      </Form>
    ),
    early: (
      <Form
        pending={pending}
        onCancel={() => toggle("early")}
        onSubmit={(f) => save({ n3EarlyStart: f.get("n3") as string, workUnlock: f.get("work") as string })}
        hint="N3 starts at a light pace from this date, only while N4 is well ahead."
      >
        <DateField name="n3" label="N3 early start" value={settings.n3EarlyStart} />
        <DateField name="work" label="Work Japanese unlocks" value={settings.workUnlock} />
      </Form>
    ),
    classes: (
      <Form
        pending={pending}
        onCancel={() => toggle("classes")}
        onSubmit={(f) =>
          save({
            classes: {
              days: f.getAll("days").map(Number),
              startsOn: f.get("startsOn") as string,
              minutes: Number(f.get("minutes")),
            },
          })
        }
      >
        <fieldset className="col-span-2 m-0 flex flex-col gap-1.5 border-none p-0">
          <legend className="mb-1.5 p-0 text-[12.5px] font-bold">Class days</legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map(([n, name]) => (
              <Chip key={n} name="days" value={String(n)} label={name} checked={settings.classes.days.includes(n)} />
            ))}
          </div>
        </fieldset>
        <DateField name="startsOn" label="First class" value={settings.classes.startsOn} />
        <NumberField name="minutes" label="Minutes per class" value={settings.classes.minutes} min={0} max={600} />
      </Form>
    ),
    budgets: (
      <Form
        pending={pending}
        onCancel={() => toggle("budgets")}
        onSubmit={(f) => save({ budgets: { weekdayMinutes: Number(f.get("weekday")), weekendMinutes: Number(f.get("weekend")) } })}
        hint="Classes count towards the weekend's time."
      >
        <NumberField name="weekday" label="Weekday minutes" value={settings.budgets.weekdayMinutes} min={0} max={600} />
        <NumberField name="weekend" label="Weekend minutes" value={settings.budgets.weekendMinutes} min={0} max={900} />
      </Form>
    ),
    recall: (
      <Form
        pending={pending}
        onCancel={() => toggle("recall")}
        onSubmit={(f) => save({ fsrs: { targetRecall: Number(f.get("recall")) / 100 } })}
        hint="Higher means more reviews, each easier. 90% suits most people."
      >
        <NumberField name="recall" label="Target recall (%)" value={Math.round(settings.fsrs.targetRecall * 100)} min={70} max={99} />
      </Form>
    ),
    reminder: (
      <Form
        pending={pending}
        onCancel={() => toggle("reminder")}
        onSubmit={(f) => save({ reminder: { enabled: f.get("enabled") === "on", time: f.get("time") as string } })}
        hint="Sent in the evening only if Reviews or the daily quiz are still open. The reminder itself arrives in round 4."
      >
        <Check name="enabled" label="Remind me" checked={settings.reminder.enabled} />
        <label className={label}>
          Time
          <input type="time" name="time" required defaultValue={settings.reminder.time} className={field} />
        </label>
      </Form>
    ),
    exceptions: (
      <div className="flex flex-col gap-3">
        {upcoming.length > 0 && (
          <ul className="m-0 flex list-none flex-col p-0">
            {upcoming.map((e) => (
              <li key={e.date} className="flex min-h-11 items-center gap-2 border-b border-line text-sm">
                <span className="w-[92px] shrink-0 font-semibold">{short(e.date)}</span>
                <span className="flex-auto text-ink2">
                  {EXCEPTION_NAMES[e.kind]}
                  {e.note && ` · ${e.note}`}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => removeException(e.date), "Removed. Today's plan is up to date.")}
                  className="min-h-11 border-none bg-transparent px-1 text-[13px] font-semibold text-ink2 underline underline-offset-2"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <Form
          pending={pending}
          onCancel={() => toggle("exceptions")}
          submitLabel="Add"
          onSubmit={(f, form) =>
            run(
              async () => {
                const result = await saveException({ date: f.get("date") as string, kind: f.get("kind") as string, note: (f.get("note") as string) ?? "" });
                if (result.ok) form.reset();
                return result;
              },
              "Added. Today's plan is up to date.",
            )
          }
          hint="A rest day has only a few reviews and no new items; it doesn't count against the pace."
        >
          <DateField name="date" label="Date" value={today} />
          <label className={label}>
            Kind of day
            <select name="kind" defaultValue="rest" className={field}>
              {Object.entries(EXCEPTION_NAMES).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </label>
          <label className={`${label} col-span-2`}>
            Note <span className="sr-only">(optional)</span>
            <input type="text" name="note" maxLength={200} placeholder="optional, like “Diwali”" className={field} />
          </label>
        </Form>
      </div>
    ),
    furigana: (
      <Choice
        name="furigana"
        value={settings.furigana ? "on" : "off"}
        options={[
          ["on", "Above my level"],
          ["off", "Off everywhere"],
        ]}
        pending={pending}
        onChoose={(v) => save({ furigana: v === "on" }, "Saved.")}
      />
    ),
    theme: (
      <Choice
        name="theme"
        value={settings.theme}
        options={[
          ["system", "System"],
          ["light", "Light"],
          ["dark", "Dark"],
        ]}
        pending={pending}
        hint="Changes this device now; other devices keep their own choice."
        onChoose={(v) => {
          setThemeChoice(v as ThemeChoice);
          save({ theme: v as ThemeChoice }, "Saved.");
        }}
      />
    ),
  };

  const groups: { title: string; tiles: { key: EditorKey; label: string; value: string; ask?: boolean; id?: string }[] }[] = [
    {
      title: "Dates",
      tiles: [
        {
          key: "phases",
          label: phase?.end ? `${PHASE_NAMES[phase.id]} ends` : "Phases",
          value: phase?.end ? short(phase.end) : "4 phases",
        },
        { key: "N4", label: examLabel("N4"), value: short(settings.exams.N4.date) },
        { key: "N3", label: examLabel("N3"), value: short(settings.exams.N3.date) },
        {
          key: "registration",
          id: "registration",
          label: "Registration host",
          value: hostName(settings.registration.hostUrl) ?? "Choose your city",
          ask: !settings.registration.hostUrl,
        },
        {
          key: "deadlines",
          label: "List deadlines",
          value: (["N5", "N4", "N3"] as const).map((lv) => formatDayMonth(settings.listDeadlines[lv])).join(" · "),
        },
        { key: "early", label: "N3 early start · Work", value: `${formatDayMonth(settings.n3EarlyStart)} · ${formatDayMonth(settings.workUnlock)}` },
      ],
    },
    {
      title: "Study",
      tiles: [
        {
          key: "classes",
          label: `Classes · from ${formatDayMonth(settings.classes.startsOn)}`,
          value:
            settings.classes.days.length === 0
              ? "None"
              : `${WEEKDAYS.filter(([n]) => settings.classes.days.includes(n))
                  .map(([, name]) => name)
                  .join(" + ")} · ${hours(settings.classes.minutes)}`,
        },
        { key: "budgets", label: "Weekday / weekend", value: `${hours(settings.budgets.weekdayMinutes)} / ${hours(settings.budgets.weekendMinutes)}` },
        { key: "recall", label: "Target recall", value: `${Math.round(settings.fsrs.targetRecall * 100)}%` },
        { key: "reminder", label: "Reminder · if work is left", value: settings.reminder.enabled ? time12(settings.reminder.time) : "Off" },
        { key: "exceptions", label: "Days off and exceptions", value: upcoming.length ? `${upcoming.length} coming up` : "None set" },
      ],
    },
  ];
  const groupOf = (key: EditorKey) => groups.find((g) => g.tiles.some((t) => t.key === key))?.title;

  return (
    <>
      {groups.map((g) => (
        <section key={g.title} className={`${card} flex flex-col gap-2 px-3 pt-2.5 pb-3`}>
          <h2 className={`${groupTitle} mx-0.5`}>{g.title}</h2>
          <div className="grid grid-cols-2 gap-2">
            {g.tiles.map((t) => (
              <button
                key={t.key}
                id={t.id}
                type="button"
                aria-expanded={open === t.key}
                aria-controls={`edit-${t.key}`}
                onClick={() => toggle(t.key)}
                className={`flex min-h-[52px] flex-col justify-center gap-0.5 rounded-[14px] border-none px-2.5 py-[7px] text-left ${
                  open === t.key ? "bg-accent-soft" : "bg-surface2"
                }`}
              >
                <span className="text-[11.5px] text-ink2">{t.label}</span>
                <span className={`text-sm font-bold ${t.ask ? "text-accent" : ""}`}>{t.value}</span>
              </button>
            ))}
          </div>
          {open && groupOf(open) === g.title && (
            <div id={`edit-${open}`} className="mt-1 flex flex-col gap-3 border-t border-line pt-3">
              {editors[open]}
              {status}
            </div>
          )}
        </section>
      ))}

      <section className={`${card} flex flex-col px-3.5 pt-2.5 pb-1.5`}>
        <h2 className={`${groupTitle} mb-0.5`}>Voice and look</h2>
        <Link href="/settings/voice" className="flex min-h-11 items-center gap-2.5 no-underline">
          <span className="flex min-w-0 flex-auto flex-col">
            <span className="text-sm font-semibold">Japanese voice</span>
            <span className="text-xs text-ink2">
              {settings.voice.name ? <span lang="ja">{settings.voice.name}</span> : "Device default"} · {settings.voice.rate.toFixed(1)}×
            </span>
          </span>
          <Icon d={ICONS.chevronRight} size={16} stroke={1.8} className="text-ink2" />
        </Link>
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 border-t border-line">
          <span className="flex-auto text-sm font-semibold">Speech recognition</span>
          <span className="relative h-7 w-[46px] shrink-0">
            <input
              type="checkbox"
              role="switch"
              defaultChecked={settings.speechRecognition}
              disabled={pending}
              onChange={(e) => save({ speechRecognition: e.target.checked }, "Saved.")}
              className="peer absolute inset-0 m-0 size-full cursor-pointer opacity-0"
            />
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full bg-track transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent" />
            <span aria-hidden="true" className="pointer-events-none absolute top-[3px] left-[3px] size-[22px] rounded-full bg-surface shadow-card transition-transform peer-checked:translate-x-[18px]" />
          </span>
        </label>
        {(
          [
            ["furigana", "Furigana", settings.furigana ? "Above my level" : "Off"],
            ["theme", "Theme", { system: "System", light: "Light", dark: "Dark" }[settings.theme]],
          ] as const
        ).map(([key, name, value]) => (
          <div key={key} className="border-t border-line">
            <button
              type="button"
              aria-expanded={open === key}
              aria-controls={`edit-${key}`}
              onClick={() => toggle(key)}
              className="flex min-h-11 w-full items-center gap-2.5 border-none bg-transparent p-0 text-left"
            >
              <span className="flex-auto text-sm font-semibold">{name}</span>
              <span className="text-[13px] text-ink2">{value}</span>
              <Icon d={ICONS.chevronRight} size={16} stroke={1.8} className={`text-ink2 transition-transform ${open === key ? "rotate-90" : ""}`} />
            </button>
            {open === key && (
              <div id={`edit-${key}`} className="flex flex-col gap-2 pb-3">
                {editors[key]}
                {status}
              </div>
            )}
          </div>
        ))}
      </section>

      <section className={`${card} flex flex-col gap-1.5 px-3.5 pt-2.5 pb-1.5`}>
        <h2 className={groupTitle}>Data</h2>
        <div className="grid grid-cols-2 gap-2">
          {["Export everything", "Import a backup"].map((t) => (
            <button key={t} type="button" disabled className="flex min-h-11 flex-col items-center justify-center rounded-btn border border-line bg-surface2 text-[13px] font-semibold opacity-70">
              {t}
              <span className="text-[11px] font-medium text-ink2">coming in round 3</span>
            </button>
          ))}
        </div>
        <Link href="/settings/flags" className="flex min-h-11 items-center gap-2.5 border-t border-line no-underline">
          <span className="flex-auto text-sm font-semibold">Flagged items</span>
          <Icon d={ICONS.chevronRight} size={16} stroke={1.8} className="text-ink2" />
        </Link>
        <div className="flex min-h-11 items-center gap-2.5 border-t border-line">
          <span className="flex-auto text-sm font-semibold">About and credits</span>
          <span className="text-[13px] text-ink2">coming in round 3</span>
        </div>
      </section>
    </>
  );
}

function Form({
  children,
  onSubmit,
  onCancel,
  pending,
  hint,
  submitLabel = "Save",
}: {
  children: ReactNode;
  onSubmit: (data: FormData, form: HTMLFormElement) => void;
  onCancel: () => void;
  pending: boolean;
  hint?: ReactNode;
  submitLabel?: string;
}) {
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(new FormData(e.currentTarget), e.currentTarget);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">{children}</div>
      {hint && <p className="m-0 text-[12.5px] leading-normal text-ink2">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className={solid}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className={quiet}>
          Close
        </button>
      </div>
    </form>
  );
}

function DateField({ name, label: text, value }: { name: string; label: string; value: string }) {
  return (
    <label className={label}>
      {text}
      <input type="date" name={name} required defaultValue={value} className={field} />
    </label>
  );
}

function NumberField({ name, label: text, value, min, max }: { name: string; label: string; value: number; min: number; max: number }) {
  return (
    <label className={label}>
      {text}
      <input type="number" name={name} inputMode="numeric" required min={min} max={max} defaultValue={value} className={field} />
    </label>
  );
}

function Check({ name, label: text, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-2.5 text-[13.5px] font-semibold">
      <input type="checkbox" name={name} defaultChecked={checked} className="size-[22px] accent-[var(--accent)]" />
      {text}
    </label>
  );
}

/** A chip that's a checkbox (F_Parts chips: picked is ink on page). */
function Chip({ name, value, label: text, checked }: { name: string; value: string; label: string; checked: boolean }) {
  return (
    <label className="relative inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line px-3.5 text-[13px] has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:font-bold has-[:checked]:text-page has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="sr-only" />
      {text}
    </label>
  );
}

function Choice({
  name,
  value,
  options,
  onChoose,
  pending,
  hint,
}: {
  name: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChoose: (value: string) => void;
  pending: boolean;
  hint?: string;
}) {
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-none p-0" disabled={pending}>
      <legend className="sr-only">{name}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([v, text]) => (
          <label
            key={v}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line px-3.5 text-[13px] has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:font-bold has-[:checked]:text-page has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
          >
            <input type="radio" name={name} value={v} defaultChecked={v === value} onChange={() => onChoose(v)} className="sr-only" />
            {text}
          </label>
        ))}
      </div>
      {hint && <p className="m-0 text-[12.5px] text-ink2">{hint}</p>}
    </fieldset>
  );
}

function ExamForm({
  level,
  settings,
  pending,
  onCancel,
  save,
}: {
  level: "N4" | "N3";
  settings: Settings;
  pending: boolean;
  onCancel: () => void;
  save: (patch: SettingsPatch) => void;
}) {
  return (
    <Form
      pending={pending}
      onCancel={onCancel}
      onSubmit={(f) => save({ exams: { [level]: { date: f.get("date") as string, confirmed: f.get("confirmed") === "on" } } })}
      hint="JLPT is always early July and early December. Tick confirmed once jlpt.jp publishes the date."
    >
      <DateField name="date" label={`JLPT ${level}`} value={settings.exams[level].date} />
      <Check name="confirmed" label="Confirmed by JLPT" checked={settings.exams[level].confirmed} />
    </Form>
  );
}
