"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useState, useTransition } from "react";

import { Rabbit } from "@/components/ui/art/rabbit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Icon, type IconName } from "@/components/ui/icon";
import { SectionTitle } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { daysBetween, formatDayMonth, formatShort, PHASE_NAMES, phaseFor, type StudyDate } from "@/lib/day";
import type { Settings, SettingsPatch } from "@/lib/settings/schema";
import { DARK_MODE } from "@/lib/theme";

import { removeException, type SaveResult, saveException, saveSettings } from "./actions";
import { ThemeChoice } from "./theme-choice";

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
  | "furigana";

/** A row in "Look and voice" and "Data": the name, its value, and a chevron or a switch. */
const ROW = "flex min-h-13 w-full items-center gap-2.5 border-b-[1.5px] border-line text-left text-ink no-underline";

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

/** The sections, for the index beside them on a wide screen. */
const SECTIONS: { id: string; label: string; note: string; icon: IconName }[] = [
  { id: "settings-look", label: "Look and voice", note: "Theme, furigana, voice", icon: "sun" },
  { id: "settings-study", label: "Study", note: "Classes, time, recall", icon: "clock" },
  { id: "settings-dates", label: "Dates", note: "Exams and deadlines", icon: "calendar" },
  { id: "settings-data", label: "Data", note: "Flagged items", icon: "flag" },
];

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

/** RF_Settings: the look-and-voice rows, then tiles that open an editor in place, and data. */
export function SettingsEditor({
  settings,
  exceptions,
  today,
  footer,
}: {
  settings: Settings;
  exceptions: Exception[];
  today: StudyDate;
  /** Goes under the last section (the right-hand column on a wide screen). */
  footer?: ReactNode;
}) {
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
        <p role="alert" className="m-0 text-meta font-bold text-again">
          {error}
        </p>
      )}
      {saved && !error && (
        <p role="status" className="m-0 text-meta font-bold text-good">
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
            <a href="https://www.jlpt.jp/e/application/overseas_list.html" target="_blank" rel="noreferrer" className="font-bold text-accent">
              official list of test sites
            </a>
            .
          </>
        }
      >
        <Field label="Host's website" type="url" name="hostUrl" defaultValue={settings.registration.hostUrl ?? ""} placeholder="https://" className="col-span-2" />
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
        <fieldset className="col-span-2 m-0 flex flex-col border-none p-0">
          <legend className="mb-1.5 p-0 text-meta font-bold">Class days</legend>
          <div className="flex flex-wrap gap-2">
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
        hint="Meant for evenings when Reviews or the daily quiz are still open. Michi doesn’t send reminders yet; the time is kept for when it does."
      >
        <Check name="enabled" label="Remind me" checked={settings.reminder.enabled} />
        <Field label="Time" type="time" name="time" required defaultValue={settings.reminder.time} />
      </Form>
    ),
    exceptions: (
      <div className="flex flex-col gap-3">
        {upcoming.length > 0 && (
          <ul className="m-0 flex list-none flex-col p-0">
            {upcoming.map((e) => (
              <li key={e.date} className="flex min-h-12 items-center gap-2.5 border-b-[1.5px] border-line text-body">
                <span className="w-24 shrink-0 font-bold">{short(e.date)}</span>
                <span className="flex-auto text-meta text-ink2">
                  {EXCEPTION_NAMES[e.kind]}
                  {e.note && ` · ${e.note}`}
                </span>
                <Button
                  variant="text"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => removeException(e.date), "Removed. Today's plan is up to date.")}
                  className="px-2"
                >
                  Remove
                </Button>
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
          <Field as="select" label="Kind of day" name="kind" defaultValue="rest">
            {Object.entries(EXCEPTION_NAMES).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </Field>
          <Field label="Note (optional)" type="text" name="note" maxLength={200} placeholder="like “Diwali”" className="col-span-2" />
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
  };

  const groups: { title: string; id: string; tiles: { key: EditorKey; label: string; value: string; ask?: boolean; id?: string }[] }[] = [
    {
      title: "Study",
      id: "settings-study",
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
    {
      title: "Dates",
      id: "settings-dates",
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
  ];
  const groupOf = (key: EditorKey) => groups.find((g) => g.tiles.some((t) => t.key === key))?.title;

  return (
    <div className="flex flex-col gap-2 wide:grid wide:grid-cols-[13rem_minmax(0,1fr)] wide:items-start wide:gap-x-12">
      <SectionIndex />
      <div className="flex min-w-0 flex-col gap-2 wide:gap-9">
        <section id="settings-look" aria-labelledby="look-and-voice" className="flex scroll-mt-8 flex-col">
          <SectionTitle id="look-and-voice">Look and voice</SectionTitle>
          <div className="flex flex-col wide:grid wide:grid-cols-2 wide:items-start wide:gap-x-10">
            {/* Hidden if dark mode is ever switched off again (src/lib/theme.ts). */}
            {DARK_MODE && <ThemeChoice saved={settings.theme} pending={pending} onSave={(theme) => save({ theme }, "Saved.")} />}
            <div className="flex flex-col">
              <div className="border-b-[1.5px] border-line">
                <button
                  type="button"
                  aria-expanded={open === "furigana"}
                  aria-controls="edit-furigana"
                  onClick={() => toggle("furigana")}
                  className={`${ROW} border-b-0 bg-transparent p-0`}
                >
                  <span className="flex-auto text-body font-bold">Furigana</span>
                  <span className="text-meta text-ink2">{settings.furigana ? "Above my level" : "Off"}</span>
                  <Icon name="chevron-right" size={20} className={`text-ink3 transition-transform duration-200 ${open === "furigana" ? "rotate-90" : ""}`} />
                </button>
                {open === "furigana" && (
                  <div id="edit-furigana" className="flex flex-col gap-2 pb-3.5">
                    {editors.furigana}
                    {status}
                  </div>
                )}
              </div>
              <Link href="/settings/voice" className={ROW}>
                <span className="flex-auto text-body font-bold">Japanese voice</span>
                <span className="text-meta text-ink2">
                  {settings.voice.name ? <span lang="ja">{settings.voice.name}</span> : "Device default"} · {settings.voice.rate.toFixed(1)}×
                </span>
                <Icon name="chevron-right" size={20} className="text-ink3" />
              </Link>
              <div className={ROW}>
                <span className="flex-auto text-body font-bold">Speech recognition</span>
                <Switch
                  label="Speech recognition"
                  defaultChecked={settings.speechRecognition}
                  disabled={pending}
                  onChange={(on) => save({ speechRecognition: on }, "Saved.")}
                />
              </div>
            </div>
          </div>
          {!open && <div className="pt-2 empty:hidden">{status}</div>}
        </section>

        {groups.map((g) => (
          <section key={g.title} id={g.id} aria-labelledby={`group-${g.title}`} className="mt-3 flex scroll-mt-8 flex-col gap-1 wide:mt-0">
            <SectionTitle id={`group-${g.title}`}>{g.title}</SectionTitle>
            <div className="grid grid-cols-2 gap-2 wide:grid-cols-3 wide:gap-2.5">
              {g.tiles.map((t) => (
                <button
                  key={t.key}
                  id={t.id}
                  type="button"
                  aria-expanded={open === t.key}
                  aria-controls={`edit-${t.key}`}
                  onClick={() => toggle(t.key)}
                  className={`flex min-h-15 min-w-0 flex-col justify-center gap-0.5 rounded-btn border-[1.5px] px-3.5 py-2 text-left transition-colors duration-120 wide:min-h-18 wide:px-4 ${
                    open === t.key ? "border-accent bg-accent-soft" : "border-transparent bg-surface2 hover:border-line-strong"
                  }`}
                >
                  <span className="text-meta text-ink2">{t.label}</span>
                  <span className={`text-body font-bold ${t.ask ? "text-accent" : "text-ink"}`}>{t.value}</span>
                </button>
              ))}
            </div>
            {open && groupOf(open) === g.title && (
              <Card id={`edit-${open}`} className="mt-2 flex flex-col gap-3 wide:p-6">
                {editors[open]}
                {status}
              </Card>
            )}
          </section>
        ))}

        <section id="settings-data" aria-labelledby="data" className="mt-3 flex scroll-mt-8 flex-col wide:mt-0">
          <SectionTitle id="data">Data</SectionTitle>
          <Link href="/settings/flags" className={`${ROW} border-b-0 wide:w-1/2 wide:pr-5`}>
            <span className="flex flex-auto flex-col">
              <span className="text-body font-bold">Flagged items</span>
              <span className="text-meta text-ink2">Cards you flagged as reading wrong</span>
            </span>
            <Icon name="chevron-right" size={20} className="text-ink3" />
          </Link>
        </section>
        {footer && <div className="mt-4 wide:mt-0 wide:flex wide:justify-start">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * The sections as a sticky index on a wide screen (1280px+), with the one you're reading marked; the
 * sitting rabbit under it. Hidden below that, where the sections are one column.
 */
function SectionIndex() {
  const [here, setHere] = useState(SECTIONS[0].id);
  useEffect(() => {
    const seen = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = SECTIONS.find((s) => seen.get(s.id));
        if (first) setHere(first.id);
      },
      { rootMargin: "-10% 0px -55% 0px" },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);
  return (
    <nav aria-label="Settings sections" className="sticky top-8 hidden flex-col gap-6 wide:flex">
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {SECTIONS.map((s) => {
          const on = s.id === here;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={on ? "true" : undefined}
                onClick={() => setHere(s.id)}
                className={`flex min-h-14 items-center gap-3 rounded-btn px-3.5 py-2 no-underline transition-colors duration-120 ${
                  on ? "bg-cover-blue text-on-cover" : "text-ink hover:bg-surface2"
                }`}
              >
                <Icon name={s.icon} size={20} className={on ? "" : "text-ink2"} />
                <span className="flex flex-col">
                  <span className={`text-body ${on ? "font-black" : "font-bold"}`}>{s.label}</span>
                  <span className={`text-caption ${on ? "text-on-cover2" : "text-ink2"}`}>{s.note}</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      <Rabbit pose="sitting" size={112} className="self-center" />
    </nav>
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
    <form onSubmit={submit} className="flex flex-col gap-3.5">
      <div className="grid grid-cols-1 gap-3.5 min-[420px]:grid-cols-2">{children}</div>
      {hint && <p className="m-0 text-meta text-ink2">{hint}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending} loading={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <Button variant="text" onClick={onCancel} className="px-3">
          Close
        </Button>
      </div>
    </form>
  );
}

function DateField({ name, label: text, value }: { name: string; label: string; value: string }) {
  return <Field label={text} type="date" name={name} required defaultValue={value} />;
}

function NumberField({ name, label: text, value, min, max }: { name: string; label: string; value: number; min: number; max: number }) {
  return <Field label={text} type="number" name={name} inputMode="numeric" required min={min} max={max} defaultValue={value} />;
}

/** An on/off in a form: the label, then a switch that submits "on" under `name`. */
function Check({ name, label: text, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex min-h-13 items-center justify-between gap-3 self-end text-body font-bold">
      {text}
      <Switch name={name} label={text} defaultChecked={checked} />
    </label>
  );
}

/** A day chip that's a checkbox (ChoiceChips' look, uncontrolled for the form). */
function Chip({ name, value, label: text, checked }: { name: string; value: string; label: string; checked: boolean }) {
  return (
    <label className="relative inline-flex h-11 cursor-pointer items-center rounded-pill border-[1.5px] border-line-strong bg-surface px-4 text-body font-bold text-ink transition-colors duration-120 hover:bg-surface2 has-checked:border-cover-blue has-checked:bg-cover-blue has-checked:font-black has-checked:text-on-cover has-focus-visible:outline-[2.5px] has-focus-visible:outline-offset-[3px] has-focus-visible:outline-focus has-focus-visible:outline-solid">
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
    <div className="flex flex-col gap-2">
      <Segmented
        label={name}
        name={name}
        defaultValue={value}
        disabled={pending}
        onChange={onChoose}
        options={options.map(([v, text]) => ({ value: v, label: text }))}
      />
      {hint && <p className="m-0 text-meta text-ink2">{hint}</p>}
    </div>
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
