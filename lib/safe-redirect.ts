/**
 * Only ever redirect to a path on this site.
 *
 * `next` arrives from an authentication email link, so it is attacker
 * controllable. Appending it to the origin unchecked is an open redirect:
 * "@evil.com" builds "https://site.com@evil.com", which URL parsing resolves to
 * host evil.com with the real site as userinfo, and "//evil.com" is protocol
 * relative. Either would hand a freshly authenticated visitor to another origin.
 *
 * Anything that is not a single-slash relative path falls back to the homepage.
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/")) return "/";
  // Reject "//host" and "/\host" — both escape to another origin.
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

/** OTP types Supabase can verify. Anything else is not passed through. */
export const OTP_TYPES = new Set([
  "email",
  "recovery",
  "signup",
  "invite",
  "magiclink",
  "email_change",
]);
