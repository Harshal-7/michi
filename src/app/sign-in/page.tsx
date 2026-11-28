// design-lint: legacy
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { safeNext } from "@/lib/auth/device";
import { SIGN_IN_REQUIRED } from "@/lib/auth/required";
import { authSetupProblems, currentSession } from "@/lib/auth/session";

import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

/** F_SignIn. */
export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const next = safeNext((await searchParams).next);
  if (!SIGN_IN_REQUIRED) redirect(next);
  const problems = authSetupProblems();
  if (problems.length === 0 && (await currentSession())) redirect(next);
  return (
    <div className="mx-auto flex min-h-dvh max-w-[420px] flex-col px-6 pb-7">
      <main className="flex flex-auto flex-col justify-center gap-7 py-8">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <p
            aria-hidden="true"
            lang="ja"
            className="m-0 flex size-[72px] -rotate-6 items-center justify-center rounded-full border-2 border-accent font-card text-4xl font-bold text-accent"
          >
            道
          </p>
          <h1 className="m-0 font-head text-[34px] leading-[1.15]">Michi</h1>
          <p className="m-0 text-[15px] leading-normal text-ink2">Your daily Japanese, between classes.</p>
        </div>
        <SignInForm next={next} disabled={problems.length > 0} />
        {problems.length > 0 && (
          <div className="rounded-card border border-dashed border-line p-3 text-[13px] text-ink2">
            <p className="m-0 font-bold text-ink">Not set up yet</p>
            <ul className="m-0 mt-1 flex list-disc flex-col gap-1 pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
      </main>
      <p className="m-0 text-center text-xs text-ink2">A private app. Only you can sign in.</p>
    </div>
  );
}
