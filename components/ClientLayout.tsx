"use client";

import { useState } from "react";
import { PredictionProvider } from "@/context/BetSlipContext";
import { AuthProvider } from "@/context/AuthContext";
import { FavouritesProvider } from "@/context/FavouritesContext";
import { MatchDetailProvider } from "@/context/MatchDetailContext";
import { SubscriptionProvider } from "@/context/SubscriptionContext";
import Header from "@/components/Header";
import LeftSidebar from "@/components/LeftSidebar";
import RightPanel from "@/components/RightPanel";
import AuthModal from "@/components/AuthModal";
import SearchModal from "@/components/SearchModal";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <AuthProvider>
      <SubscriptionProvider>
      <MatchDetailProvider>
      <FavouritesProvider>
      <PredictionProvider>
        <Header onSearchOpen={() => setSearchOpen(true)} />
        <AuthModal />
        <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
        <div className="flex h-[calc(100vh-56px)] overflow-hidden">
          <LeftSidebar />
          <main className="flex-1 overflow-y-auto bg-brand-dark">
            {children}
          </main>
          <RightPanel />
        </div>
      </PredictionProvider>
      </FavouritesProvider>
      </MatchDetailProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}
