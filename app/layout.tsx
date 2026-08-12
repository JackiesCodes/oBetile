import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "oBetile — Football Predictions & Live Scores",
  // Describes what the app actually does today. It covers competitions
  // worldwide, not one country, and only football has a data source — the other
  // sports are placeholders, so listing them here would promise nothing.
  description:
    "Win probabilities, live scores, standings and match insights for football competitions around the world — from the Premier League and Champions League to MLS, Brasileirão and Liga MX. Free, with no betting.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: the script below mutates this element before
    // React hydrates, which is the whole point of it running early.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Must run before the first paint, or the page renders in the wrong
            theme and then corrects itself — the flash every themed site is
            judged on. Inline and synchronous is the only way to get that. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-brand-dark text-white min-h-screen">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
