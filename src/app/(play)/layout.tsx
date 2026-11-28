import { OfflineBanner, PlayVersionBanner } from "@/components/play/banners";
import { NameSheet } from "@/components/play/name-sheet";
import { PlayerProvider } from "@/components/play/player";
import { PlayTopBar } from "@/components/play/top-bar";
import { appVersion } from "@/lib/version";

/**
 * The public games (/play), the louder end of the same system (RF_PlayHub … RF_PlayNameSheet): open to
 * everyone, with no sign-in check, so pages stay static and visitors don't wake the database.
 * Who's playing comes from /api/play/me in the browser. A top bar on phone and laptop, no
 * bottom bar; games in play cover it.
 */
export default function PlayLayout({ children }: LayoutProps<"/">) {
  return (
    <PlayerProvider>
      <div className="min-h-dvh">
        <PlayTopBar />
        <main className="mx-auto flex w-full max-w-300 flex-col gap-4 px-5 pt-3 pb-[calc(32px+env(safe-area-inset-bottom))] laptop:gap-6 laptop:px-11 laptop:pt-8 laptop:pb-10">
          <OfflineBanner />
          {children}
        </main>
      </div>
      <NameSheet />
      <PlayVersionBanner version={appVersion()} />
    </PlayerProvider>
  );
}
