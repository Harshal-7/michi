import type { Metadata, Viewport } from "next";

import { ThemeSync } from "@/components/theme-sync";
import { THEME_SCRIPT } from "@/lib/theme";

import "./globals.css";

/**
 * Zen Kaku Gothic New for everything you read and the headings; Zen Old Mincho for the big
 * Japanese on card faces. Google serves Japanese fonts as ~120 small unicode-range files per
 * weight, and the browser fetches only the ones a page uses. (next/font/google downloads all
 * 607 at every dev start and build, and the dev server timed out on a quarter of them.)
 */
const FONTS_CSS =
  "https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&family=Zen+Old+Mincho:wght@600;700&display=swap";

export const metadata: Metadata = {
  title: { default: "Michi 道", template: "%s · Michi" },
  description: "A personal Japanese study app: reviews, quizzes and a daily plan from N5 to N3.",
  applicationName: "Michi",
  appleWebApp: { title: "Michi", capable: true },
  // A private app: keep it out of search engines.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Puts data-theme on <html> and the theme-color meta in place before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS_CSS} />
      </head>
      <body>
        {children}
        <ThemeSync />
      </body>
    </html>
  );
}
