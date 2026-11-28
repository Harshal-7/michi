import { AppStatus } from "@/components/cards/app-status";
import { PhoneNav } from "@/components/shell/phone-nav";
import { PhoneTopBar } from "@/components/shell/phone-top-bar";
import { Sidebar } from "@/components/shell/sidebar";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { daysBetween, formatDayMonth, studyDate } from "@/lib/day";
import { todaysPlan } from "@/lib/planner/today-plan";

/**
 * The signed-in app: the laptop sidebar from 1024px; below that the page, "+ Add a word" at the top of
 * the hubs and the bottom bar. Pages use the phone layout (20px sides), centred and at most 720px wide
 * on a laptop (44px sides). Main's bottom padding clears the bar (--nav-h).
 * Layouts don't run again on every navigation, so each page checks the session too.
 * The first page load of each study day freezes the day's plan (src/lib/planner/freeze.ts), so
 * every page and both devices see the same list. A page that opts in with `data-wide` gets the
 * wider 1136px column on a laptop, and lays out its own columns there (mostly from `wide:`, 1280px).
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireSignedIn();
  const [settings] = await Promise.all([
    getSettings(getDb()),
    // If the plan can't be built, Today shows the error; every other page still works.
    todaysPlan().catch((error: unknown) => console.error("Couldn't build today's plan", error)),
  ]);
  const workLocked = daysBetween(studyDate(), settings.workUnlock) > 0;
  return (
    <div className="min-h-dvh laptop:flex">
      <Sidebar workBadge={workLocked ? `opens ${formatDayMonth(settings.workUnlock)}` : null} />
      <div className="relative min-w-0 flex-1">
        <PhoneTopBar />
        <main className="mx-auto flex w-full max-w-180 flex-col gap-4 px-5 pt-[max(12px,env(safe-area-inset-top))] pb-nav laptop:px-11 laptop:pt-8 laptop:pb-10 laptop:has-[>[data-wide]]:max-w-[1136px]">
          {children}
        </main>
      </div>
      <PhoneNav />
      <AppStatus />
    </div>
  );
}
