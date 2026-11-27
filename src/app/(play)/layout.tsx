import { OfflineBanner, PlayVersionBanner } from "@/components/play/banners";
import { NameSheet } from "@/components/play/name-sheet";
import { PlayerProvider } from "@/components/play/player";
import { PlayTopBar } from "@/components/play/top-bar";
import { appVersion } from "@/lib/version";

/**
 * The public games (/play), in their own look (canvas page "Play · public games"): open to
 * everyone, with no sign-in check, so pages stay static and visitors don't wake the database.
 * Who's playing comes from /api/play/me in the browser. A top bar on phone and laptop, no
 * bottom bar; games in play cover it.
 */
export default function PlayLayout({ children }: LayoutProps<"/">) {
  return (
    <PlayerProvider>
      <div className="min-h-dvh">
        <PlayTopBar />
        <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-4 pt-2.5 pb-[calc(32px+env(safe-area-inset-bottom))] laptop:gap-6 laptop:px-10 laptop:pt-7 laptop:pb-10">
          <OfflineBanner />
          {children}
        </main>
      </div>
      <NameSheet />
      <PlayVersionBanner version={appVersion()} />
    </PlayerProvider>
  );
}
