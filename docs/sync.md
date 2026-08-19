# The local copy of the football data

## What this is for

Everything the site shows still comes from API-Football through the request
cache, exactly as before. This layer exists for the one thing that cache cannot
do: survive.

A saved prediction is scored against a finished fixture. If results only ever
live in a fifteen-minute cache, then the day the subscription lapses — currently
**2026-09-05** — every slip becomes unsettleable and the record of who was right
goes with it. Storing finished results locally is what prevents that, and it is
why the job is worth running while the API still works rather than after.

## Why it is shaped this way

Three constraints decided the design, not preference.

**Vercel Hobby schedules one cron run a day.** Minute-level freshness is
therefore not on the table, so live scores stay entirely on the request cache
where they already work. The daily job handles what does not need to be fresh:
results that never change again, and season records that move a little each
week.

**Supabase Free gives 500MB and pauses after seven days of no activity.** So the
question is not what could be stored but what is worth the space. Finished
fixtures and one row per team per competition qualify; every fixture worldwide,
players, events, lineups and transfers do not — they are large, change
constantly, and are cheap to re-fetch. A side effect worth noting: the daily job
touches the database, which keeps the project from idling into a pause.

**The API allows 7,500 requests a day and 300 a minute**, shared with the whole
site. A full pass is a few dozen calls, run three at a time.

## Setup

Two environment variables, both server-side only:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Lets the job write. The football tables grant `select` to everyone and `insert` to nobody, so only the service role — which bypasses row level security — can populate them. Never prefix this `NEXT_PUBLIC_`. |
| `CRON_SECRET` | Authorises the endpoint. Vercel sends it as a bearer token on scheduled runs. |

Until both are set, `/api/sync` answers **503** with the list of what it needs,
and the rest of the app carries on reading live from API-Football. Nothing
breaks while the local copy is empty — it simply is not used yet.

## Running it

```
GET /api/sync                       # everything — what the cron calls
GET /api/sync?job=results&days=3    # finished fixtures for the last 3 days
GET /api/sync?job=stats&league=39   # one competition's team records
```

Authorise with `Authorization: Bearer $CRON_SECRET`, or `?secret=` for a manual
run. A partial run answers **207** with the detail, rather than a flat success
that hides half a job.

## Why a run does not always finish

Two limits meet almost exactly, and a full statistics sweep sits between them.
The subscription allows 300 upstream calls a minute; the sweep needs about 235
of them, one per team plus one standings call per league. Paced to stay inside
that — 4 a second, leaving room for the requests the site itself is serving —
a full pass takes close to a minute, against a function limit of 60 seconds.

So the sweep takes a deadline and stops **between leagues**, never partway
through one: a competition abandoned halfway would be counted as swept while
holding an incomplete table. What it did not reach is named in the run's detail
and the run is recorded as not ok:

```
out of time after 9 of 13 league(s) — not reached: 71,262,307,39
```

That is expected output, not a fault. Roughly nine or ten of the thirteen
leagues complete per run.

Which leagues get cut is therefore decided by the order, and the order is
**stalest first** — whatever was written longest ago goes to the front, leagues
with no rows at all before that. A fixed list would starve the same tail every
night. Rotating the start daily, which this used to do, advances one place a day
while the cut is three or four deep, so a league near the end waits days: after
that change Brasileirão and Liga MX both sat on three-day-old partial tables.
Ordering by staleness needs no extra state — the `updated_at` already on every
row is the whole input.

An explicit `?league=` list is never reordered. That is a request for those
competitions, in that order.

## What gets stored

| Table | Contents | Rough size |
| --- | --- | --- |
| `fixture_results` | Finished fixtures only — score, status, outcome | a few thousand rows per season |
| `team_season_stats` | One row per team per competition, with the derived metrics alongside | ~260 rows across the tracked leagues |
| `sync_runs` | One row per run, so a failure is visible without reading platform logs | small, append-only |

Unfinished fixtures are deliberately skipped. A row that exists but says nothing
is worse than no row, because the read path would treat it as an answer.

## How the read path uses it

`/api/football/results` asks the database first and only calls the API for
fixtures it does not already have settled. The response carries
`x-results-source: database | mixed | upstream` so it is visible which answered.

If the database is unreachable the read falls back to the API — the behaviour
that existed before this table did.

## Deliberately not stored

Live scores, odds, lineups, events, injuries, players, transfers. All are either
too volatile to be worth persisting or too large for the tier, and all are
already served well by the request cache.
