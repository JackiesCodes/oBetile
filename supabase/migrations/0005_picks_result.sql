-- Add result tracking to user_picks for future accuracy scoring
alter table public.user_picks
  add column if not exists result text check (result in ('correct','wrong','push')) default null;

-- Add unique constraint to support upsert by (user_id, fixture_id)
alter table public.user_picks
  drop constraint if exists user_picks_user_fixture_unique;

alter table public.user_picks
  add constraint user_picks_user_fixture_unique unique (user_id, fixture_id);
