"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { createPlayer, type PlayerState, signInPlayer } from "@/lib/play/actions";
import { hueStyle } from "@/lib/games/catalog";
import { NAME_MAX } from "@/lib/play/names";

import { Rabbit } from "@/components/ui/art/rabbit";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

import { ordinal } from "./bits";
import { announcePlayer, type SheetMode, usePlay } from "./player";

/**
 * "Pick a name" (RF_PlayNameSheet): a name with a live check and a 4-digit PIN, or "Welcome back" with
 * a name and PIN. A sheet from the bottom on a phone, a dialog on a laptop, with ui Sheet's look; its
 * own <dialog> because the head carries the rabbit (or the score) and the form switches inside it.
 * Opened from the top bar, or from a game's end to save the score; signing in claims the games kept
 * on this device.
 */
export function NameSheet() {
  const { sheet, closeSheet } = usePlay();
  const dialog = useRef<HTMLDialogElement>(null);
  const [have, setHave] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (sheet && !d.open) {
      setHave(sheet.kind === "have");
      d.showModal();
    } else if (!sheet && d.open) d.close();
  }, [sheet]);

  const done = () => {
    announcePlayer();
    closeSheet();
  };

  return (
    <dialog
      ref={dialog}
      onClose={closeSheet}
      onClick={(e) => {
        // A tap on the faded page behind closes it.
        if (e.target === e.currentTarget) closeSheet();
      }}
      aria-label={sheet?.kind === "save" ? "Save your score" : have ? "Welcome back" : "Pick a name"}
      className="m-auto mb-0 max-h-[calc(100dvh-12px)] w-full max-w-none overflow-y-auto rounded-t-sheet border-0 bg-raised p-0 text-ink shadow-raised backdrop:bg-scrim laptop:mb-auto laptop:w-120 laptop:rounded-sheet"
    >
      {sheet && (
        <div className="flex flex-col gap-3 px-5 pt-2.5 pb-[max(16px,env(safe-area-inset-bottom))] laptop:px-7 laptop:pt-6 laptop:pb-6">
          <span aria-hidden="true" className="h-1.25 w-11 self-center rounded-full bg-line-strong laptop:hidden" />
          {have ? (
            <HaveName key="have" onDone={done} onSwitch={() => setHave(false)} onClose={closeSheet} />
          ) : (
            <NewName key="new" mode={sheet} onDone={done} onSwitch={() => setHave(true)} onClose={closeSheet} />
          )}
        </div>
      )}
    </dialog>
  );
}

function Header({ title, lead, onClose, stamp }: { title: string; lead: string; onClose: () => void; stamp?: number }) {
  return (
    <div className="flex items-start gap-3">
      {stamp !== undefined ? (
        <span
          aria-hidden="true"
          style={hueStyle("kana")}
          className="mt-1 grid size-14 shrink-0 -rotate-6 place-items-center rounded-full border-[3px] border-hue text-title font-black text-hue"
        >
          {stamp}
        </span>
      ) : (
        <span className="mt-1.5 shrink-0">
          <Rabbit pose="waving" size={72} />
        </span>
      )}
      <div className="flex min-w-0 flex-auto flex-col gap-1">
        <h2 className="m-0 text-headline font-black">{title}</h2>
        <p className="m-0 text-meta text-ink2">{lead}</p>
      </div>
      <button type="button" aria-label="Close" onClick={onClose} className="grid size-12 shrink-0 place-items-center rounded-full bg-surface2 text-ink hover:bg-accent-soft">
        <Icon name="close" />
      </button>
    </div>
  );
}

/** Calls `onDone` once for each answer from the server that carries the player's name. */
function useDoneOnce(state: PlayerState, onDone: () => void) {
  const handled = useRef<PlayerState | null>(null);
  useEffect(() => {
    if (state.name && handled.current !== state) {
      handled.current = state;
      onDone();
    }
  }, [state, onDone]);
}

type Check = { name: string; problem: string | null; free: boolean; suggestions: string[] } | null;

/** The live check: what the server says about the name, a moment after typing stops. */
function useNameCheck(name: string): Check {
  const [check, setCheck] = useState<Check>(null);
  useEffect(() => {
    const trimmed = name.trim();
    if ([...trimmed].length < 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- nothing to check yet
      setCheck(null);
      return;
    }
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/play/name?name=${encodeURIComponent(trimmed)}`, { signal: ctl.signal, cache: "no-store" });
        if (res.ok) setCheck({ name: trimmed, ...((await res.json()) as Omit<NonNullable<Check>, "name">) });
      } catch {
        // No signal or typed on: the save says what's wrong instead.
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [name]);
  return check && check.name === name.trim() ? check : null;
}

function NewName({ mode, onDone, onSwitch, onClose }: { mode: SheetMode; onDone: () => void; onSwitch: () => void; onClose: () => void }) {
  const [state, action, pending] = useActionState<PlayerState, FormData>(createPlayer, {});
  const [name, setName] = useState("");
  const check = useNameCheck(name);
  const save = mode.kind === "save" ? mode : null;

  useDoneOnce(state, onDone);

  const serverNameError = state.field === "name" && state.error ? state.error : null;
  const nameError = serverNameError ?? (check?.problem || (check && !check.free ? `${check.name} is taken. Pick one of these, or change it.` : null));
  const free = check?.free && !serverNameError;

  return (
    <form action={action} className="flex flex-col gap-4">
      <Header
        title={save ? `Save your ${save.score}` : "Pick a name"}
        lead={
          save
            ? save.place
              ? `It goes on this week’s board as ${ordinal(save.place)}. Takes ten seconds.`
              : "Keep it with your name, on any device. Takes ten seconds."
            : "Keep your scores and get on the leaderboards, on any device."
        }
        onClose={onClose}
        stamp={save?.score}
      />
      <NameField
        value={name}
        onChange={setName}
        autoComplete="username"
        state={nameError ? "bad" : free ? "free" : "plain"}
        note={nameError ?? (free ? `${check!.name} is free. 3 to ${NAME_MAX} letters, digits, kana or kanji.` : `3 to ${NAME_MAX} letters, digits, kana or kanji. Everyone sees it on the leaderboards.`)}
      >
        {check && !check.free && check.suggestions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-meta font-bold text-ink2">Free:</span>
            {check.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                lang={/[^\x00-\x7f]/.test(s) ? "ja" : undefined}
                onClick={() => setName(s)}
                className="h-11 rounded-pill border-[1.5px] border-line-strong bg-surface px-3.5 text-meta font-bold hover:bg-surface2"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </NameField>
      <PinBoxes
        legend="Make a 4-digit PIN"
        autoComplete="new-password"
        error={state.field === "pin" ? (state.error ?? null) : null}
        note="You’ll need it on other devices. It can’t be reset, so keep it safe."
        reset={state}
      />
      {state.field === "wait" && <Wait error={state.error!} />}
      <div className="flex flex-col gap-2">
        <ul aria-label="What Michi keeps" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {["No email", "Any device", "Delete any time"].map((k) => (
            <li key={k} className="inline-flex h-7.5 items-center gap-1.5 rounded-track bg-surface2 px-2.75 text-meta font-bold">
              <Icon name="check" size={16} stroke={2.6} className="text-good" />
              {k}
            </li>
          ))}
        </ul>
        <p className="m-0 text-meta text-ink2">Michi keeps only your name, a scrambled copy of your PIN and your scores.</p>
      </div>
      <Button type="submit" size="lg" full loading={pending} disabled={pending}>
        {pending ? "Saving…" : save ? "Save my score" : "Save and play"}
      </Button>
      <p className="-mt-2 mb-0 flex items-center justify-center gap-1 text-meta text-ink2">
        Have a name?
        <button type="button" onClick={onSwitch} className="h-11 px-1.5 text-body font-black text-accent">
          Sign in
        </button>
      </p>
    </form>
  );
}

function HaveName({ onDone, onSwitch, onClose }: { onDone: () => void; onSwitch: () => void; onClose: () => void }) {
  const [state, action, pending] = useActionState<PlayerState, FormData>(signInPlayer, {});
  const [name, setName] = useState("");
  useDoneOnce(state, onDone);
  const locked = state.field === "wait";
  return (
    <form action={action} className="flex flex-col gap-4">
      <Header title="Welcome back" lead="Your name and PIN, from any device." onClose={onClose} />
      <NameField
        value={name}
        onChange={setName}
        autoComplete="username"
        state={state.field === "name" ? "bad" : "plain"}
        note={state.field === "name" && state.error ? state.error : "The name you picked before."}
      />
      <PinBoxes
        legend="Your 4-digit PIN"
        autoComplete="current-password"
        disabled={locked}
        error={state.field === "pin" ? (state.error ?? null) : null}
        note="Forgot it? It can’t be reset; pick a new name instead. After 5 wrong tries, sign-in pauses for 15 minutes."
        reset={state}
      />
      {locked && <Wait error={state.error!} />}
      <Button type="submit" size="lg" full loading={pending} disabled={pending || locked}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="-mt-2 mb-0 flex items-center justify-center gap-1 text-meta text-ink2">
        New here?
        <button type="button" onClick={onSwitch} className="h-11 px-1.5 text-body font-black text-accent">
          Pick a name
        </button>
      </p>
    </form>
  );
}

function NameField({
  value,
  onChange,
  autoComplete,
  state,
  note,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  state: "plain" | "free" | "bad";
  note: string;
  children?: React.ReactNode;
}) {
  const border = state === "bad" ? "border-again" : state === "free" ? "border-good" : "border-line-strong focus:border-accent focus:shadow-field";
  const noteStyle = state === "bad" ? "font-bold text-again" : state === "free" ? "font-bold text-good" : "text-ink2";
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="play-name" className="text-meta font-black">
        Your name
      </label>
      <div className="relative">
        <input
          id="play-name"
          name="name"
          type="text"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={NAME_MAX * 2}
          aria-invalid={state === "bad" || undefined}
          aria-describedby="play-name-note"
          className={`box-border block h-14 w-full rounded-btn-lg border-2 bg-surface pr-12 pl-4 text-lead font-bold text-ink outline-none transition-[border-color,box-shadow] duration-120 ${border}`}
        />
        {state === "free" && <Icon name="check" size={22} stroke={2.6} className="absolute top-4.25 right-4 text-good" />}
      </div>
      <p id="play-name-note" aria-live="polite" className={`m-0 text-meta ${noteStyle}`}>
        {note}
      </p>
      {children}
    </div>
  );
}

/**
 * Four boxes for the PIN, one digit each: typing moves on, Backspace goes back, a pasted or
 * filled-in PIN spreads across them. The form sends them joined as `pin`.
 */
function PinBoxes({
  legend,
  note,
  error,
  disabled,
  autoComplete,
  reset,
}: {
  legend: string;
  note: string;
  error: string | null;
  disabled?: boolean;
  autoComplete: string;
  /** A new answer from the server; after a wrong PIN the boxes clear. */
  reset: PlayerState;
}) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (reset.field !== "pin") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a wrong PIN clears the boxes
    setDigits(["", "", "", ""]);
    boxes.current[0]?.focus();
  }, [reset]);

  const put = (i: number, raw: string) => {
    const typed = raw.normalize("NFKC").replace(/\D/g, "");
    if (!typed) {
      setDigits((d) => d.map((x, j) => (j === i ? "" : x)));
      return;
    }
    const next = [...digits];
    [...typed].slice(0, 4 - i).forEach((c, k) => (next[i + k] = c));
    setDigits(next);
    boxes.current[Math.min(3, i + typed.length)]?.focus();
  };

  const first = digits.findIndex((d) => d === "");
  return (
    <fieldset disabled={disabled} className={`m-0 flex flex-col gap-2 border-none p-0 ${disabled ? "opacity-45" : ""}`}>
      <legend className="mb-2 p-0 text-meta font-black">{legend}</legend>
      <input type="hidden" name="pin" value={digits.join("")} />
      <div className="flex gap-2.5">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              boxes.current[i] = el;
            }}
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? autoComplete : "off"}
            aria-label={`PIN digit ${i + 1}`}
            aria-invalid={error ? true : undefined}
            value={d}
            onChange={(e) => put(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
            }}
            onFocus={(e) => e.target.select()}
            className={`box-border h-16 w-14.5 rounded-btn-lg border-2 bg-surface p-0 text-center text-headline font-black text-ink outline-none focus:border-accent focus:shadow-field ${
              error ? "border-again" : i === first ? "border-accent shadow-field" : "border-line-strong"
            }`}
          />
        ))}
      </div>
      <p aria-live="polite" className={`m-0 text-meta ${error ? "font-bold text-again" : "text-ink2"}`}>
        {error ?? note}
      </p>
    </fieldset>
  );
}

function Wait({ error }: { error: string }) {
  return (
    <Banner kind="info" icon="clock" role="alert" title="Take a short break">
      {error}
    </Banner>
  );
}
