import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES = new Set(["email", "recovery", "signup", "invite", "magiclink", "email_change"]);

/**
 * Only ever redirect to a path on this site.
 *
 * `next` arrives from the email link, so it is attacker-controllable. Appending
 * it to the origin unchecked is an open redirect: "@evil.com" makes
 * "https://site.com@evil.com", which parses as host evil.com with the real site
 * as userinfo, and "//evil.com" is protocol-relative. Both would hand a
 * freshly-authenticated visitor to another origin, so anything that is not a
 * single-slash relative path falls back to the homepage.
 */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/")) return "/";
  // Reject "//host" and "/\host" — both escape to another origin.
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNext(searchParams.get("next"));

  const supabase = await createClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else if (token_hash && type && OTP_TYPES.has(type)) {
    await supabase.auth.verifyOtp({
      token_hash,
      type: type as "email" | "recovery" | "signup",
    });
  }

  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/auth/reset-password`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
