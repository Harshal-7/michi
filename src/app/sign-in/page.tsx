import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { safeNext } from "@/lib/auth/device";
import { SIGN_IN_REQUIRED } from "@/lib/auth/required";
import { Spot } from "@/components/ui/art/spots";
import { authSetupProblems, currentSession } from "@/lib/auth/session";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

/** RF_SignIn: the farmhouse door, the name, and the passphrase card. */
export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const next = safeNext((await searchParams).next);
  if (!SIGN_IN_REQUIRED) redirect(next);
  const problems = authSetupProblems();
  if (problems.length === 0 && (await currentSession())) redirect(next);
  return (
    <div className="mx-auto flex min-h-dvh max-w-105 flex-col px-6 pb-7">
      <main className="flex flex-auto flex-col justify-center gap-11 py-8">
        <div className="flex flex-col items-center text-center">
          <Spot kind="door" size={180} />
          <h1 className="m-0 mt-3.5 flex items-center gap-2.5 text-display leading-tight font-black">
            Michi
            <span lang="ja" className="font-ja text-headline font-semibold text-accent">
              道
            </span>
          </h1>
          <p className="m-0 mt-0.5 text-body text-ink2">Your daily Japanese, between classes.</p>
        </div>
        <SignInForm next={next} disabled={problems.length > 0} />
        {problems.length > 0 && (
          <div role="status" className="rounded-card border-[1.5px] border-dashed border-line-strong px-4 py-3.5 text-meta text-ink2">
            <p className="m-0 text-body font-bold text-ink">Not set up yet</p>
            <ul className="m-0 mt-1 flex list-disc flex-col gap-1 pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </main>
      <p className="m-0 text-center text-meta text-ink2">A private app. Only you can sign in.</p>
    </div>
  );
}
