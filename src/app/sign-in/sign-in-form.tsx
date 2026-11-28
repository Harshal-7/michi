"use client";

import { useActionState } from "react";

import { Rabbit } from "@/components/ui/art/rabbit";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { signIn, type SignInState } from "@/lib/auth/actions";

/** RF_SignIn's card: the passphrase, Sign in, and the plain rules, with the rabbit waving from its corner. */
export function SignInForm({ next, disabled }: { next: string; disabled: boolean }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});
  return (
    <Card as="div" padding="lg" className="relative pt-5 pb-4.5">
      <Rabbit pose="waving" size={72} className="absolute -top-12.5 right-3.5" />
      <form action={action} className="flex flex-col gap-3.5">
        <input type="hidden" name="next" value={next} />
        <Field
          label="Passphrase"
          type="password"
          name="passphrase"
          autoComplete="current-password"
          required
          autoFocus
          error={state.error}
        />
        <p role="alert" className="sr-only">
          {state.error}
        </p>
        <Button type="submit" size="lg" full iconEnd="arrow-right" disabled={pending || disabled} loading={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <p className="m-0 text-meta text-ink2">This device stays signed in for a year. After 5 wrong tries, sign-in pauses for 15 minutes.</p>
      </form>
    </Card>
  );
}
