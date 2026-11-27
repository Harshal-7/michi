import type { MetadataRoute } from "next";

import { DEFAULT_LOOKS, PAGE_COLOR } from "@/lib/theme";

/**
 * Lets the phone install Michi like an app: full screen, with the icons that
 * scripts/draw-icons.mjs draws from icon.svg. iPhones take their icon from apple-icon.png.
 * No offline mode: there's no service worker until the reminder (round 4).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Michi 道",
    short_name: "Michi",
    description: "Daily Japanese study: reviews, quizzes and a plan from N5 to N3.",
    lang: "en",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: PAGE_COLOR[DEFAULT_LOOKS.light],
    theme_color: PAGE_COLOR[DEFAULT_LOOKS.light],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
