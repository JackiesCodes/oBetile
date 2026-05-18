"use client";

import Link from "next/link";
import { useState } from "react";
import { Search, Menu, X, Bell, ChevronDown } from "lucide-react";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="h-14 bg-black border-b border-brand-dark-5 flex items-center px-4 gap-3 sticky top-0 z-50">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-1 shrink-0">
        <div className="bg-brand-green w-7 h-7 rounded flex items-center justify-center font-extrabold text-black text-lg leading-none">
          o
        </div>
        <div className="font-extrabold text-white text-lg tracking-tight leading-none">
          Betile
        </div>
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

      {/* Search */}
      <div className="hidden sm:flex items-center bg-brand-dark-4 rounded-full px-3 py-1.5 gap-2 w-48 lg:w-64">
        <Search size={14} className="text-gray-400 shrink-0" />
        <input
          type="text"
          placeholder="Search matches..."
          className="bg-transparent text-sm text-white placeholder-gray-500 outline-none w-full"
        />
      </div>

      {/* Auth Buttons */}
      <div className="flex items-center gap-2">
        <button className="hidden sm:block text-sm text-white bg-brand-dark-4 hover:bg-brand-dark-5 border border-brand-dark-5 px-4 py-1.5 rounded font-medium transition-colors">
          Log In
        </button>
        <button className="text-sm text-black bg-brand-green hover:bg-brand-green-hover px-4 py-1.5 rounded font-bold transition-colors">
          Join Now
        </button>
        <Bell size={18} className="text-gray-400 hover:text-white cursor-pointer hidden sm:block" />
      </div>

      {/* Mobile menu */}
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
        </div>
      )}
    </header>
  );
}
