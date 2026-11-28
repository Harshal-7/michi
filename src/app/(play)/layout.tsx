/**
 * The public games (/play): open to everyone, with no sign-in check, so pages stay static and
 * visitors don't wake the database. Who's playing comes from /api/play/me in the browser.
 * TODO(play shell): the sidebar, top bar and player pill come from the play-canvas boards.
 */
export default function PlayLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh">
      <main className="mx-auto flex w-full max-w-[720px] flex-col gap-3 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-[calc(32px+env(safe-area-inset-bottom))] laptop:px-12 laptop:pt-7 laptop:pb-8 laptop:has-[>[data-wide]]:max-w-[1136px]">
        {children}
      </main>
    </div>
  );
}
