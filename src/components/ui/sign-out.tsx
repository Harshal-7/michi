import { signOut } from "@/lib/auth/actions";

/** "Signed in on this phone · Sign out" (F_More's footer line, with the way out). */
export function SignOut({ device }: { device: string }) {
  return (
    <form action={signOut} className="flex flex-wrap items-center justify-center gap-x-1 text-xs text-ink2">
      <span>Signed in on this {device} ·</span>
      <button type="submit" className="min-h-11 border-none bg-transparent px-1 text-xs font-semibold text-ink2 underline underline-offset-2">
        Sign out
      </button>
    </form>
  );
}
