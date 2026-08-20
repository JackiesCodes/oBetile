-- A selection now names the market it was made in.
--
-- slip_picks.pick was constrained to home/draw/away, which was exactly right
-- while a prediction could only ever be a match result. It is the thing in the
-- way of storing "both teams to score: yes" or "over 2.5", so the constraint
-- goes and the market comes in beside it.
--
-- Existing rows are all match results — that is the only thing the app could
-- produce — so the column defaults to '1x2' and backfills them correctly with
-- no data migration.
--
-- What replaces the constraint. The valid selections depend on which market a
-- row is in, and that mapping lives in lib/markets.ts, where pricing and
-- settlement read it too; restating it here in SQL is precisely the duplication
-- that made lib/vote-markets.ts necessary. isValidSelection is the real guard.
-- What stays in the database is a bound on shape rather than meaning: non-empty
-- and short enough that a bug writes a bad row rather than a large one.

alter table public.slip_picks
  add column if not exists market text not null default '1x2';

alter table public.slip_picks
  drop constraint if exists slip_picks_pick_check;

alter table public.slip_picks
  add constraint slip_picks_pick_check
  check (char_length(pick) between 1 and 32);

alter table public.slip_picks
  add constraint slip_picks_market_check
  check (char_length(market) between 1 and 32);

comment on column public.slip_picks.market is
  'Market id from lib/markets.ts. Defaults to 1x2, which is what every row predating markets is.';

-- One selection per fixture per slip still holds, and is load-bearing rather
-- than incidental: combinedConfidence multiplies the selections in a slip as
-- though they were independent, and two markets on the same match are not.
-- Allowing both would need the joint probability read off the scoreline grid,
-- which is possible — every market comes from one — but is not what the slip
-- maths does today.
