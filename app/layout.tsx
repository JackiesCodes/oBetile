import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "oBetile — Sports Predictions Botswana",
  description: "Predict match outcomes for soccer, basketball, cricket and more. Live win probabilities in BWP.",
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
