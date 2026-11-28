"use client";
// design-lint: legacy

import { useActionState } from "react";

import { signIn, type SignInState } from "@/lib/auth/actions";

export function SignInForm({ next, disabled }: { next: string; disabled: boolean }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});
  return (
    <form action={action} className="flex flex-col gap-3.5 rounded-card bg-surface p-5 shadow-card">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1.5 text-[13px] font-bold">
        Passphrase
        <input
          type="password"
          name="passphrase"
          autoComplete="current-password"
          required
          autoFocus
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "sign-in-error" : undefined}
          className="min-h-12 rounded-xl border border-line bg-page px-3.5 text-base font-normal"
        />
      </label>
      {state.error && (
        <p id="sign-in-error" role="alert" className="m-0 text-[13px] font-semibold text-again">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || disabled}
        className="min-h-[50px] rounded-btn border-none bg-accent text-base font-bold text-on-accent disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="m-0 text-[12.5px] leading-normal text-ink2">
        This device stays signed in for a year. After 5 wrong tries, sign-in pauses for 15 minutes.
      </p>
    </form>
  );
}
