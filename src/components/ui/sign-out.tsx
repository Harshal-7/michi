import { signOut } from "@/lib/auth/actions";
import { SIGN_IN_REQUIRED } from "@/lib/auth/required";

/** "Signed in on this phone · Sign out" (F_More's footer line, with the way out). Hidden while sign-in is off. */
export function SignOut({ device }: { device: string }) {
  if (!SIGN_IN_REQUIRED) return null;
  return (
    <form action={signOut} className="flex flex-wrap items-center justify-center gap-x-1 text-xs text-ink2">
      <span>Signed in on this {device} ·</span>
      <button type="submit" className="min-h-11 border-none bg-transparent px-1 text-xs font-semibold text-ink2 underline underline-offset-2">
        Sign out
      </button>
    </form>
  );
}
