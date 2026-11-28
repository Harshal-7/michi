import { signOut } from "@/lib/auth/actions";
import { SIGN_IN_REQUIRED } from "@/lib/auth/required";

import { Button } from "./button";

/** "Sign out of this phone" (RF_More's last line). Hidden while sign-in is off. */
export function SignOut({ device }: { device: string }) {
  if (!SIGN_IN_REQUIRED) return null;
  return (
    <form action={signOut} className="flex justify-center">
      <Button type="submit" variant="text" icon="logout">
        Sign out of this {device}
      </Button>
    </form>
  );
}
