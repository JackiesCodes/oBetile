import { describe, it, expect } from "vitest";
import { safeNext, OTP_TYPES } from "@/lib/safe-redirect";

/**
 * The auth callback had a real open redirect: `next` comes from an email link,
 * and appending it to the origin unchecked let "@evil.com" resolve to another
 * host. These cases exist so that never comes back.
 */
describe("safeNext", () => {
  const ORIGIN = "https://o-betile.vercel.app";
  const hostOf = (next: string) => new URL(ORIGIN + safeNext(next)).host;
  const OWN_HOST = new URL(ORIGIN).host;

  it("keeps ordinary relative paths", () => {
    expect(safeNext("/profile")).toBe("/profile");
    expect(safeNext("/profile?tab=picks")).toBe("/profile?tab=picks");
    expect(safeNext("/legal/privacy")).toBe("/legal/privacy");
  });

  it("blocks the userinfo escape that made this exploitable", () => {
    // Unfixed, origin + "@evil.com" parses to host evil.com.
    expect(new URL(ORIGIN + "@evil.com").host).toBe("evil.com");
    expect(safeNext("@evil.com")).toBe("/");
    expect(hostOf("@evil.com")).toBe(OWN_HOST);
  });

  it("blocks protocol-relative and backslash escapes", () => {
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(hostOf("//evil.com")).toBe(OWN_HOST);
    expect(hostOf("/\\evil.com")).toBe(OWN_HOST);
  });

  it("blocks absolute URLs and non-path values", () => {
    for (const bad of ["https://evil.com", "http://evil.com", "evil.com", "javascript:alert(1)", ""]) {
      expect(safeNext(bad)).toBe("/");
    }
  });

  it("falls back to the homepage when absent", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
  });

  it("never returns a value that leaves this origin", () => {
    const hostile = ["@evil.com", "//evil.com", "/\\evil.com", "https://evil.com", "\\\\evil.com", "/%2F%2Fevil.com"];
    for (const next of hostile) {
      expect(hostOf(next)).toBe(OWN_HOST);
    }
  });
});

describe("OTP_TYPES", () => {
  it("allows the types Supabase issues", () => {
    for (const t of ["email", "recovery", "signup"]) expect(OTP_TYPES.has(t)).toBe(true);
  });

  it("rejects anything else rather than passing it through", () => {
    for (const t of ["", "admin", "../../etc", "sql"]) expect(OTP_TYPES.has(t)).toBe(false);
  });
});
