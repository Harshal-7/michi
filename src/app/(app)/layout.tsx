import { PhoneNav } from "@/components/shell/phone-nav";
import { PhoneTopBar } from "@/components/shell/phone-top-bar";
import { Sidebar } from "@/components/shell/sidebar";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { daysBetween, formatDayMonth, studyDate } from "@/lib/day";

/**
 * The signed-in app: the laptop sidebar from 1024px; below that the top bar, the page and the
 * floating pill nav. Pages use the phone layout, centred and at most 720px wide on a laptop.
 * Layouts don't run again on every navigation, so each page checks the session too.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireSignedIn();
  const settings = await getSettings(getDb());
  const workLocked = daysBetween(studyDate(), settings.workUnlock) > 0;
  return (
    <div className="min-h-dvh laptop:flex">
      <Sidebar workBadge={workLocked ? formatDayMonth(settings.workUnlock) : null} />
      <div className="min-w-0 flex-1">
        <PhoneTopBar />
        <main className="mx-auto flex w-full max-w-[720px] flex-col gap-3 px-4 pt-3 pb-[calc(112px+env(safe-area-inset-bottom))] laptop:px-12 laptop:pt-7 laptop:pb-8">
          {children}
        </main>
      </div>
      <PhoneNav />
    </div>
  );
}
