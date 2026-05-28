"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient, hasSupabaseConfig } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    if (!hasSupabaseConfig()) { setHasSession(false); return; }
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
    }
  };

  // Still checking session
  if (hasSession === null) {
    return (
      <div className="min-h-screen bg-brand-dark-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-dark-1 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-brand-dark-2 rounded-2xl border border-brand-dark-5 shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-brand-dark-5">
          <div className="flex font-rajdhani text-xl font-semibold mb-1">
            <span className="text-white">o</span>
            <span className="text-brand-green">Bet</span>
            <span className="text-white">ile</span>
          </div>
          <p className="text-gray-400 text-sm">Set a new password</p>
        </div>

        <div className="px-6 py-6">
          {success ? (
            <div className="text-center py-2">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-white font-semibold text-lg">Password updated!</p>
              <p className="text-gray-400 text-sm mt-1 mb-5">You can now log in with your new password.</p>
              <button
                onClick={() => router.push("/")}
                className="w-full bg-brand-green hover:bg-brand-green-hover text-black font-bold py-3 rounded-lg text-sm transition-colors"
              >
                Go to Homepage
              </button>
            </div>
          ) : !hasSession ? (
            <div className="text-center py-2">
              <div className="text-4xl mb-3">⚠️</div>
              <p className="text-white font-semibold">Link expired</p>
              <p className="text-gray-400 text-sm mt-1 mb-5">This reset link has expired or already been used. Request a new one.</p>
              <button
                onClick={() => router.push("/")}
                className="w-full bg-brand-green hover:bg-brand-green-hover text-black font-bold py-3 rounded-lg text-sm transition-colors"
              >
                Back to Homepage
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">New Password</label>
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

              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Confirm Password</label>
                <input
                  type={showPass ? "text" : "password"}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-brand-dark-4 text-white rounded-lg px-3 py-2.5 text-sm outline-none border border-brand-dark-5 focus:border-brand-green transition-colors"
                />
              </div>

              {error && (
                <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-green hover:bg-brand-green-hover text-black font-bold py-3 rounded-lg text-sm transition-colors disabled:opacity-60"
              >
                {loading ? "Updating…" : "Update Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
