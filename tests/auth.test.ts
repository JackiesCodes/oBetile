import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { passwordProblems, describePasswordProblems, PASSWORD_MIN_LENGTH } from "@/lib/password";
import { friendlyAuthError } from "@/lib/auth-errors";

/**
 * These rules mirror a Supabase dashboard setting. If the two drift apart a
 * password accepted here is rejected by the server, which is how the
 * reset-password form used to dead-end on its own 6 character minimum.
 */
describe("passwordProblems", () => {
  it("accepts a password meeting every rule", () => {
    expect(passwordProblems("Abcdefg1!")).toEqual([]);
    expect(describePasswordProblems("Str0ng&Passw0rd")).toBeNull();
  });

  it("names each missing requirement", () => {
    expect(describePasswordProblems("Ab1!")).toContain(`${PASSWORD_MIN_LENGTH} characters`);
    expect(describePasswordProblems("abcdefg1!")).toContain("uppercase");
    expect(describePasswordProblems("ABCDEFG1!")).toContain("lowercase");
    expect(describePasswordProblems("Abcdefgh!")).toContain("number");
    expect(describePasswordProblems("Abcdefg1")).toContain("symbol");
  });

  it("rejects a password one character short", () => {
    expect(passwordProblems("Abcde1!")).not.toEqual([]);
    expect(passwordProblems("Abcde12!")).toEqual([]);
  });

  it("lists several problems in one sentence", () => {
    const msg = describePasswordProblems("abc") ?? "";
    expect(msg).toMatch(/ and /);
    expect(msg.endsWith(".")).toBe(true);
  });
});

/**
 * Supabase's own messages are written for developers — a weak password comes
 * back as a literal dump of the required character sets. None of them should
 * ever reach a user unaltered.
 */
describe("friendlyAuthError", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  const cases: [string, RegExp][] = [
    ["Invalid login credentials", /incorrect/i],
    ["Email not confirmed", /confirm/i],
    ["User already registered", /already exists/i],
    ["Signups not allowed for this instance", /isn't open/i],
    ["Email signups are disabled", /isn't open/i],
    ["Unable to validate email address: invalid format", /doesn't look valid/i],
    ["For security purposes, you can only request this after 51 seconds.", /too many attempts/i],
    ["Failed to fetch", /connection/i],
  ];

  it.each(cases)("rewrites %s", (raw, expected) => {
    const out = friendlyAuthError(raw);
    expect(out).toMatch(expected);
    expect(out).not.toBe(raw);
  });

  it("rewrites the raw character-set dump for a weak password", () => {
    const raw =
      "Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789.";
    const out = friendlyAuthError(raw) ?? "";
    expect(out).not.toContain("abcdefghijklmnopqrstuvwxyz");
    expect(out).toMatch(/8 characters/);
  });

  it("never leaks an unrecognised provider message", () => {
    const raw = "some brand new provider error nobody has mapped";
    expect(friendlyAuthError(raw)).toBe("Something went wrong. Please try again.");
  });

  it("passes null through so callers can show nothing", () => {
    expect(friendlyAuthError(null)).toBeNull();
    expect(friendlyAuthError(undefined)).toBeNull();
  });
});
