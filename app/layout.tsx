import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

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
    <html lang="en">
      <body className="bg-brand-dark text-white min-h-screen">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
