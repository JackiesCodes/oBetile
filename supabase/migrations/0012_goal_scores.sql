-- The scores a goal market has to settle against.
--
-- fixture_results already stores home_goals/away_goals, which is the provider's
-- `goals` field: the FINAL score, extra time included. That is the right number
-- for 1X2 — a tie won in extra time has a real winner — and the wrong number for
-- every goal market. Bookmakers settle goals on ninety minutes, so a Champions
-- League tie level at 1-1 and finishing 3-2 after extra time is Under 2.5
-- everywhere else and would have been Over 2.5 here. League 2 is in the tracked
-- set, so this is reachable, not theoretical.
--
-- Stored rather than derived because the provider is the only source of the
-- split and the subscription ends: once a fixture has gone, an unrecorded
-- ninety-minute score cannot be recovered, and the pick that needed it can
-- never be settled.
--
-- The half-time columns are the same argument made once: they cost two integers
-- a row and are the only thing standing between us and the half-based markets
-- (HT/FT, first-half result, both-teams-to-score-in-a-half). Cheaper to capture
-- now, while the sweep is already writing the row, than to backfill later from
-- a provider we no longer pay for.
--
-- All four are nullable. Fixtures that never finished have no such score, and a
-- row written before this migration has nulls until the sweep next touches it —
-- settlement treats a missing ninety-minute score as "cannot settle yet" rather
-- than assuming it equals the final.

alter table public.fixture_results
  add column if not exists home_goals_90 integer,
  add column if not exists away_goals_90 integer,
  add column if not exists home_goals_ht integer,
  add column if not exists away_goals_ht integer;

comment on column public.fixture_results.home_goals_90 is
  'Home goals at the end of normal time. Differs from home_goals only when a tie went to extra time; goal markets settle on this.';
comment on column public.fixture_results.away_goals_90 is
  'Away goals at the end of normal time. Differs from away_goals only when a tie went to extra time; goal markets settle on this.';
comment on column public.fixture_results.home_goals_ht is
  'Home goals at half time.';
comment on column public.fixture_results.away_goals_ht is
  'Away goals at half time.';
