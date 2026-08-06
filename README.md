# oBetile

Next.js app for live football scores, standings, stats and community predictions,
backed by [API-Football](https://www.api-football.com) and Supabase.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

`.env.local` is git-ignored — real keys never belong in the repo.

| Variable | Purpose |
| --- | --- |
| `APIFOOTBALL_KEY` | API-Football key from the [dashboard](https://dashboard.api-football.com). Server-side only. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key. |

Restart the dev server after editing `.env.local`; Next.js only reads env files at boot.

## Verifying the API-Football key

```bash
curl -s localhost:3000/api/football/status | jq
```

A working key returns the plan and remaining daily quota:

```json
{ "ok": true, "plan": "Free", "requestsToday": 12, "dailyLimit": 100, "remainingToday": 88 }
```

Failures come back with a `kind` that says what to fix:

| `kind` | HTTP | Meaning |
| --- | --- | --- |
| `auth` | 401 | Key missing or invalid — check `APIFOOTBALL_KEY`. |
| `quota` | 429 | Daily or per-minute request limit reached. |
| `plan` | 403 | Key is valid but your plan doesn't cover that endpoint. |
| `http` / `api` | 502 | Upstream outage or a rejected parameter. |

The status route deliberately omits the upstream `account` block (name/email),
since the route has no auth in front of it.

## API-Football notes

API-Football answers with **HTTP 200 even when a request fails** — a bad key,
an exhausted quota, or an out-of-plan endpoint arrive as a populated `errors`
field next to an empty `response`. `lib/api-football.ts` inspects `errors` on
every call and throws `ApiFootballError`, so these surface as real HTTP errors
instead of silently empty panels.

All upstream calls go through `apiFetch` (response only) or `apiFetchRaw`
(response plus quota headers) in `lib/api-football.ts`, and are proxied through
`/api/football/*` routes so the key stays server-side. Responses are cached via
the `revalidate` argument — 30s for live scores, 60s for fixtures, 1h for
league metadata — which matters on the free plan's 100 requests/day.

## Seasons

Seasons are detected, not hardcoded — there is no yearly constant to bump.

API-Football labels seasons two different ways, and the two disagree for half
the year:

| Convention | Leagues | Label |
| --- | --- | --- |
| `split-year` | EPL, LaLiga, Serie A, UCL … | Start year — the 2026/27 season stays `"2026"` until May 2027. |
| `calendar-year` | MLS, Brasileirão, Liga MX | The calendar year — `"2027"` from Jan 2027. |

So in February 2027 the Premier League is `"2026"` while MLS is `"2027"`. Any
single global season value is wrong for one of them, and asking for the wrong
season returns an empty response rather than an error — which is what made this
class of bug hard to spot.

`resolveSeason(leagueId)` handles it: it reads the league's real season from
`/leagues` (preferring the one actually in progress) and falls back to a
date-derived guess based on the league's `calendar` field if that lookup fails.
The standings, top-scorers and news routes use it automatically; pass an
explicit `?season=` to override.

Those `/leagues` lookups share a single Next fetch-cache entry with
`/api/football/leagues/active` via `LEAGUE_META_TTL`, so detection normally
costs no extra quota.

`CURRENT_SEASON` remains as the split-year fallback for calls with no league
context (e.g. player search), but is derived from the date rather than
hardcoded.

Fixture queries by date pass no season at all — API-Football resolves the
correct one per competition.

## Security

Set at the edge in `next.config.js`: Content-Security-Policy, HSTS,
X-Frame-Options, X-Content-Type-Options, Referrer-Policy and Permissions-Policy.
`X-Powered-By` is disabled.

The CSP is strict — `default-src 'self'` with only three external origins
allowed: `media.api-sports.io` for crests, `fonts.googleapis.com` /
`fonts.gstatic.com` for the webfonts `app/globals.css` imports, and
`*.supabase.co` for auth and community data. **Adding any third-party script,
font or image host means adding it to the CSP**, or the browser silently drops
it.

`proxy.ts` refreshes the Supabase session on every request. Without it, access
tokens expire mid-visit and Server Components begin treating a signed-in user as
logged out.

The auth callback only redirects to single-slash relative paths. `next` arrives
from an email link and is attacker-controllable: `?next=@evil.com` would
otherwise build `https://site/@evil.com`, which resolves to host `evil.com`.

API routes never return Supabase error text or raw exceptions — those name
tables, columns and constraints. Failures are logged server-side and callers get
a generic message.

### Rate limiting

Community writes are limited per user, per action:

| Action | Allowance |
| --- | --- |
| Post | 5 / minute |
| Vote | 30 / minute |
| Like | 60 / minute |

Counters live in Postgres (`public.rate_limits`, migrations `0006`/`0008`), not
process memory — the app runs on serverless functions, so an in-process counter
would let a caller multiply their allowance by the number of warm instances. The
table has RLS enabled with no policies: it is reachable only through the
security-definer `check_rate_limit()` function.

`check_rate_limit(action)` takes only the action name. It derives the user from
`auth.uid()` and holds the allowances itself, because it is reachable over
`/rest/v1/rpc`: an earlier version accepted the bucket and limit as arguments,
which let any signed-in user run up **another** account's counter and lock them
out. Supabase's linter still reports `0029` against it — that warning fires for
any security-definer function signed-in users can call. It is accepted here: the
only thing a direct caller can now do is spend their own allowance, and the
alternative (calling it with a `service_role` key) would put a far more
privileged credential in the app.

The check **fails open**. It shares a database with the write it guards, so if
it is unreachable the write fails anyway, and refusing there would surface a
confusing 429 instead of the real error.

## Launch checklist

1. **Resume the Supabase project** if it has auto-paused. A paused project takes
   down auth, profiles, community posts, votes and picks; the football data is
   unaffected because it comes from API-Football.
2. **Apply any unapplied migrations.** Until `check_rate_limit` exists the
   limiter fails open and community writes are unlimited. After applying schema
   changes, run `notify pgrst, 'reload schema';` — PostgREST caches the schema
   and will otherwise report tables and relationships as missing.
3. **Confirm `APIFOOTBALL_KEY` is set** in the Vercel project, for Production and
   Preview. New env vars need a redeploy to take effect.
4. **Password policy** lives under **Authentication → Sign In / Providers →
   Email** (`/dashboard/project/_/auth/providers?provider=Email`) — not under
   Policies. Minimum length 8 and the strongest character requirements are set.
   `lib/password.ts` mirrors those rules client-side so users see what is wrong
   before submitting instead of the raw provider error; **change both together**.
   Leaked-password protection (HaveIBeenPwned) sits on the same page but
   requires the Pro plan.
5. **Re-run the Supabase security advisors** once the project is live — they
   return an empty result against a paused project, which is not the same as a
   clean result.
6. **Check the API-Football subscription renewal date** via
   `/api/football/status`.
