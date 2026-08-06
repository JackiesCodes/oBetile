/**
 * Password rules, mirrored from the Supabase Auth project settings.
 *
 * Supabase enforces these server-side; checking here too means a user is told
 * what is wrong before submitting, rather than getting the raw provider error,
 * which lists the required character sets literally and reads like a bug.
 *
 * Keep in step with Authentication → Sign In / Providers → Email. Being stricter
 * here than the server only produces false rejections, so change both together.
 */
export const PASSWORD_MIN_LENGTH = 8;

/** The symbol set Supabase accepts. */
const SYMBOLS = /[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]/;

export const PASSWORD_HINT =
  "At least 8 characters, including an uppercase and a lowercase letter, a number and a symbol.";

/** What the password is still missing — empty when it satisfies every rule. */
export function passwordProblems(password: string): string[] {
  const problems: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    problems.push(`at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (!/[a-z]/.test(password)) problems.push("a lowercase letter");
  if (!/[A-Z]/.test(password)) problems.push("an uppercase letter");
  if (!/[0-9]/.test(password)) problems.push("a number");
  if (!SYMBOLS.test(password)) problems.push("a symbol");

  return problems;
}

/** A single sentence naming everything still missing, or null when valid. */
export function describePasswordProblems(password: string): string | null {
  const problems = passwordProblems(password);
  if (problems.length === 0) return null;

  const list =
    problems.length === 1
      ? problems[0]
      : `${problems.slice(0, -1).join(", ")} and ${problems[problems.length - 1]}`;

  return `Password needs ${list}.`;
}
