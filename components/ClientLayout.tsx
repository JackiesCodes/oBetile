"use client";

import { PredictionProvider } from "@/context/BetSlipContext";
import Header from "@/components/Header";
import LeftSidebar from "@/components/LeftSidebar";
import BetSlip from "@/components/BetSlip";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <PredictionProvider>
      <Header />
      <div className="flex h-[calc(100vh-56px)] overflow-hidden">
        <LeftSidebar />
        <main className="flex-1 overflow-y-auto bg-brand-dark">
          {children}
        </main>
        <BetSlip />
      </div>
    </PredictionProvider>
  );
}
