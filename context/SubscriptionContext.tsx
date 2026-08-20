"use client";

import { createContext, useContext } from "react";

export type SubscriptionTier = "free" | "pro";

/**
 * Everything on oBetile is free while the platform is being built.
 *
 * A single switch rather than deleting the gate: the tiering machinery is
 * wanted later, and stripping it out now would mean writing it again from
 * memory when payments arrive. Flip this to false on the day there is
 * something to actually charge for, and every gate closes again.
 *
 * Deliberately not "make everyone Pro". Nobody is Pro — there is no such thing
 * to be yet — and a context claiming otherwise would put the wrong badge on
 * every account and quietly become the thing the app believes about its own
 * users.
 */
export const EVERYTHING_IS_FREE = true;

interface SubscriptionCtx {
  tier: SubscriptionTier;
  isPro: boolean;
  /** True while the whole platform is open regardless of tier. */
  everythingIsFree: boolean;
}

const SubscriptionContext = createContext<SubscriptionCtx>({
  tier: "free",
  isPro: false,
  everythingIsFree: EVERYTHING_IS_FREE,
});

// Tier stays 'free' for everyone until subscriptions exist. Swap this provider
// to read payment status when there is any.
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  return (
    <SubscriptionContext.Provider
      value={{ tier: "free", isPro: false, everythingIsFree: EVERYTHING_IS_FREE }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
