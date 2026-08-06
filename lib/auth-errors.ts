import { PASSWORD_HINT } from "@/lib/password";

/**
 * Turn a Supabase Auth error into something worth showing a user.
 *
 * The provider's strings are written for developers — "Invalid login
 * credentials", or a literal dump of the required password character sets —
 * and were being rendered straight into the auth modal.
 *
 * Matching is on substrings because the exact wording is not part of any
 * contract and has changed between releases; anything unrecognised falls back
 * to a generic line, with the original logged so it stays debuggable.
 */
const RULES: [RegExp, string][] = [
  [
    /invalid login credentials|invalid email or password/i,
    "Email or password is incorrect.",
  ],
  [
    /email not confirmed|confirm your email/i,
    "Please confirm your email address first — check your inbox for the link.",
  ],
  [
    /already registered|already been registered|user already exists/i,
    "An account with this email already exists. Try signing in instead.",
  ],
  [
    /signups? not allowed|signup is disabled|email signups are disabled/i,
    "Registration isn't open at the moment. Please check back soon.",
  ],
  [
    /unable to validate email|invalid email/i,
    "That email address doesn't look valid.",
  ],
  [
    /password/i,
    PASSWORD_HINT,
  ],
  [
    /for security purposes|rate limit|too many requests/i,
    "Too many attempts. Please wait a moment and try again.",
  ],
  [
    /failed to fetch|network|timeout/i,
    "Couldn't reach the server. Check your connection and try again.",
  ],
];

export function friendlyAuthError(message: string | null | undefined): string | null {
  if (!message) return null;

  for (const [pattern, friendly] of RULES) {
    if (pattern.test(message)) return friendly;
  }

  // Keep the original reachable for debugging without putting it on screen.
  console.error("Unmapped auth error:", message);
  return "Something went wrong. Please try again.";
}
