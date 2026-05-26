"use client";

import { Lock } from "lucide-react";
import { useSubscription } from "@/context/SubscriptionContext";

interface Props {
  feature: string;
  children: React.ReactNode;
}

export default function PremiumGate({ children }: Props) {
  const { isPro } = useSubscription();

  if (isPro) return <>{children}</>;

  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* Blurred content */}
      <div className="pointer-events-none select-none blur-sm opacity-40">
        {children}
      </div>
      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-brand-dark-2/60 backdrop-blur-[1px]">
        <div className="flex items-center gap-1.5 bg-brand-dark-3 border border-brand-dark-5 rounded-full px-3 py-1.5">
          <Lock size={12} className="text-yellow-400" />
          <span className="text-xs font-bold text-yellow-400">Pro</span>
        </div>
        <button
          className="text-[11px] text-gray-400 hover:text-white transition-colors underline"
          onClick={() => {
            // TODO: open subscription/upgrade modal when payment is implemented
          }}
        >
          Upgrade to unlock
        </button>
      </div>
    </div>
  );
}
