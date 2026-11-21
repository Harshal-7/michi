import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Michi 道",
  description: "A personal Japanese study app: reviews, quizzes and a daily plan from N5 to N3.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
