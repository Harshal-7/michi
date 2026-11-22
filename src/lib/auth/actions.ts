"use server";

import { ipAddress } from "@vercel/functions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { recordSignInAttempt, signInAllowed } from "@/db/auth";
import { getDb } from "@/db/client";

import { deviceFromUserAgent, safeNext } from "./device";
import { verifyPassphrase } from "./password";
import { authSetupProblems, endSession, startSession } from "./session";

export type SignInState = { error?: string };

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  if (authSetupProblems().length > 0) return { error: "Sign-in isn't set up yet. See the list below." };
  const h = await headers();
  const key = ipAddress(h) ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const db = getDb();
  if (!(await signInAllowed(db, key))) return { error: "Too many wrong tries. Wait 15 minutes, then try again." };
  const passphrase = formData.get("passphrase");
  const ok = typeof passphrase === "string" && (await verifyPassphrase(passphrase, process.env.PASSPHRASE_HASH));
  await recordSignInAttempt(db, key, ok);
  if (!ok) return { error: "That passphrase isn't right." };
  await startSession(deviceFromUserAgent(h.get("user-agent")));
  redirect(safeNext(formData.get("next")));
}

export async function signOut(): Promise<void> {
  await endSession();
  redirect("/sign-in");
}
