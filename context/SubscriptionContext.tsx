"use client";

import { createContext, useContext } from "react";

export type SubscriptionTier = "free" | "pro";

interface SubscriptionCtx {
  tier: SubscriptionTier;
  isPro: boolean;
}

const SubscriptionContext = createContext<SubscriptionCtx>({
  tier: "free",
  isPro: false,
});

// All users are 'free' tier until subscription is implemented.
// Swap this provider to check Stripe/payment status when ready.
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  return (
    <SubscriptionContext.Provider value={{ tier: "free", isPro: false }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
