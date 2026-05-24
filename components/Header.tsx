"use client";

import Link from "next/link";
import { useState } from "react";
import { Search, Menu, X, Bell, LogOut } from "lucide-react";
import { usePredictions } from "@/context/BetSlipContext";
import { useAuth } from "@/context/AuthContext";

interface Props {
  onSearchOpen: () => void;
}

export default function Header({ onSearchOpen }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { items } = usePredictions();
  const { user, signOut, openAuthModal } = useAuth();

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "";

  return (
    <header className="h-14 bg-black border-b border-brand-dark-5 flex items-center px-4 gap-3 sticky top-0 z-50">
      {/* Logo */}
      <Link href="/" className="flex items-center shrink-0">
        <span className="font-rajdhani font-semibold text-2xl text-white leading-none">o</span>
        <span className="font-rajdhani font-semibold text-2xl text-brand-green leading-none">Bet</span>
        <span className="font-rajdhani font-semibold text-2xl text-white leading-none">ile</span>
      </Link>

      {/* Nav Links */}
      <nav className="hidden md:flex items-center gap-1 ml-2">
        {[
          { label: "Sports", href: "/sport/soccer" },
          { label: "Live", href: "/live" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm text-gray-300 hover:text-white hover:bg-brand-dark-4 px-3 py-1.5 rounded transition-colors font-medium"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex-1" />

      {/* Search trigger */}
      <button
        onClick={onSearchOpen}
        className="hidden sm:flex items-center bg-brand-dark-4 hover:bg-brand-dark-5 rounded-full px-3 py-1.5 gap-2 w-48 lg:w-64 transition-colors border border-transparent hover:border-brand-dark-5"
      >
        <Search size={14} className="text-gray-400 shrink-0" />
        <span className="text-sm text-gray-500 text-left w-full">Search matches...</span>
      </button>

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        {/* Mobile prediction count badge */}
        {items.length > 0 && (
          <div className="xl:hidden flex items-center gap-1 bg-brand-dark-4 border border-brand-green/60 text-white text-xs font-bold px-2.5 py-1.5 rounded-full">
            <span>🔮</span>
            <span className="text-brand-green">{items.length}</span>
          </div>
        )}

        {user ? (
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 bg-brand-dark-4 hover:bg-brand-dark-5 border border-brand-dark-5 px-3 py-1.5 rounded-lg transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-brand-green flex items-center justify-center text-black text-[10px] font-bold">
                {initials}
              </div>
              <span className="hidden sm:block text-sm text-white font-medium truncate max-w-[100px]">
                {user.email?.split("@")[0]}
              </span>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-10 bg-brand-dark-3 border border-brand-dark-5 rounded-xl shadow-2xl py-1 min-w-[160px] z-50">
                <button
                  onClick={() => { signOut(); setUserMenuOpen(false); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-300 hover:bg-brand-dark-4 hover:text-red-400 transition-colors"
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <button
              onClick={() => openAuthModal("login")}
              className="hidden sm:block text-sm text-white bg-brand-dark-4 hover:bg-brand-dark-5 border border-brand-dark-5 px-4 py-1.5 rounded font-medium transition-colors"
            >
              Log In
            </button>
            <button
              onClick={() => openAuthModal("signup")}
              className="text-sm text-black bg-brand-green hover:bg-brand-green-hover px-4 py-1.5 rounded font-bold transition-colors"
            >
              Join Now
            </button>
          </>
        )}

        <button
          onClick={onSearchOpen}
          className="sm:hidden text-gray-400 hover:text-white transition-colors"
        >
          <Search size={18} />
        </button>

        <Bell size={18} className="text-gray-600 hidden sm:block" />
      </div>

      {/* Mobile menu toggle */}
      <button
        className="md:hidden text-gray-400 hover:text-white ml-1"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {menuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {menuOpen && (
        <div className="absolute top-14 left-0 right-0 bg-brand-dark-2 border-b border-brand-dark-5 py-2 md:hidden z-50">
          {[
            { label: "Sports", href: "/sport/soccer" },
            { label: "Live", href: "/live" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-brand-dark-4"
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          {!user && (
            <div className="flex gap-2 px-4 py-2">
              <button
                onClick={() => { openAuthModal("login"); setMenuOpen(false); }}
                className="flex-1 text-sm text-white bg-brand-dark-4 border border-brand-dark-5 py-2 rounded font-medium"
              >
                Log In
              </button>
              <button
                onClick={() => { openAuthModal("signup"); setMenuOpen(false); }}
                className="flex-1 text-sm text-black bg-brand-green py-2 rounded font-bold"
              >
                Join Now
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
