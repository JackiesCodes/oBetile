"use client";

import { useState } from "react";
import { X, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import clsx from "clsx";

type Mode = "login" | "signup" | "forgot";

export default function AuthModal() {
  const { authModalOpen, authModalTab, closeAuthModal, signIn, signUp, openAuthModal, resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mode, setMode] = useState<Mode>(authModalTab);

  // Sync mode when tab changes externally
  const currentMode: Mode = success ? mode : (mode === "forgot" ? "forgot" : authModalTab);

  if (!authModalOpen) return null;

  const reset = (newMode: Mode) => {
    setMode(newMode);
    setError(null);
    setSuccess(false);
    if (newMode !== "forgot") openAuthModal(newMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (currentMode === "forgot") {
      const { error: err } = await resetPasswordForEmail(email);
      setLoading(false);
      if (err) setError(err);
      else setSuccess(true);
      return;
    }

    const fn = currentMode === "login" ? signIn : signUp;
    const { error: err } = await fn(email, password);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      if (currentMode === "signup") setSuccess(true);
      else closeAuthModal();
    }
  };

  const Logo = () => (
    <div className="flex font-rajdhani text-xl font-semibold">
      <span className="text-white">o</span>
      <span className="text-brand-green">Bet</span>
      <span className="text-white">ile</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 pt-12 sm:pt-4 overflow-y-auto">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeAuthModal} />

      {/* Modal */}
      <div className="relative bg-brand-dark-2 rounded-2xl w-full max-w-md border border-brand-dark-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-brand-dark-5">
          <Logo />
          <button onClick={closeAuthModal} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Forgot password view */}
        {currentMode === "forgot" ? (
          <div className="px-6 py-5">
            {success ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-white font-semibold">Check your email!</p>
                <p className="text-gray-400 text-sm mt-1">We sent a password reset link to <span className="text-white">{email}</span></p>
                <button onClick={closeAuthModal} className="mt-4 w-full bg-brand-green text-black font-bold py-2.5 rounded-lg">
                  Done
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => reset("login")}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors mb-4"
                >
                  <ArrowLeft size={13} /> Back to login
                </button>
                <p className="text-white font-semibold mb-1">Forgot your password?</p>
                <p className="text-gray-400 text-sm mb-4">Enter your email and we'll send you a reset link.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5 font-medium">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full bg-brand-dark-4 text-white rounded-lg px-3 py-2.5 text-sm outline-none border border-brand-dark-5 focus:border-brand-green transition-colors"
                    />
                  </div>
                  {error && (
                    <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded px-3 py-2">{error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand-green hover:bg-brand-green-hover text-black font-bold py-3 rounded-lg text-sm transition-colors disabled:opacity-60"
                  >
                    {loading ? "Sending…" : "Send Reset Link"}
                  </button>
                </form>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b border-brand-dark-5">
              {(["login", "signup"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => reset(t)}
                  className={clsx(
                    "flex-1 py-3 text-sm font-semibold transition-colors",
                    authModalTab === t
                      ? "text-white border-b-2 border-brand-green"
                      : "text-gray-500 hover:text-gray-300"
                  )}
                >
                  {t === "login" ? "Log In" : "Sign Up"}
                </button>
              ))}
            </div>

            <div className="px-6 py-5">
              {success ? (
                <div className="text-center py-4">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="text-white font-semibold">Check your email!</p>
                  <p className="text-gray-400 text-sm mt-1">We sent a confirmation link to <span className="text-white">{email}</span></p>
                  <button onClick={closeAuthModal} className="mt-4 w-full bg-brand-green text-black font-bold py-2.5 rounded-lg">
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5 font-medium">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full bg-brand-dark-4 text-white rounded-lg px-3 py-2.5 text-sm outline-none border border-brand-dark-5 focus:border-brand-green transition-colors"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs text-gray-400 font-medium">Password</label>
                      {authModalTab === "login" && (
                        <button
                          type="button"
                          onClick={() => reset("forgot")}
                          className="text-[11px] text-gray-500 hover:text-brand-green transition-colors"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showPass ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-brand-dark-4 text-white rounded-lg px-3 py-2.5 pr-10 text-sm outline-none border border-brand-dark-5 focus:border-brand-green transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                      >
                        {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded px-3 py-2">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand-green hover:bg-brand-green-hover text-black font-bold py-3 rounded-lg text-sm transition-colors disabled:opacity-60"
                  >
                    {loading ? "Please wait…" : authModalTab === "login" ? "Log In" : "Create Account"}
                  </button>

                  <p className="text-center text-xs text-gray-500">
                    {authModalTab === "login" ? (
                      <>No account?{" "}
                        <button type="button" onClick={() => reset("signup")} className="text-brand-green hover:underline">
                          Sign up free
                        </button>
                      </>
                    ) : (
                      <>Already have an account?{" "}
                        <button type="button" onClick={() => reset("login")} className="text-brand-green hover:underline">
                          Log in
                        </button>
                      </>
                    )}
                  </p>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
