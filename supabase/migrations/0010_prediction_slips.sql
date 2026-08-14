-- Predictions become groups rather than loose rows.
--
-- Until now a pick was one row in user_picks, unique on (user_id, fixture_id),
-- saved the instant a percentage was tapped. That cannot express "these six
-- selections are one prediction I am making together", which is the whole point
-- of a slip, and the unique constraint actively prevented the same fixture
-- appearing in two different slips.
--
-- This is additive. user_picks is left in place and its rows are copied into a
-- slip per user, so nothing is lost and the change is reversible by pointing the
-- app back at the old table.

create table if not exists public.prediction_slips (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null check (char_length(title) between 1 and 80),
  note text check (char_length(note) <= 280),
  created_at timestamptz default now() not null,
  -- Null until the author chooses to share. Sharing is what makes a slip
  -- readable by anyone else, so this column is the whole access boundary.
  shared_at timestamptz
);

create table if not exists public.slip_picks (
  id uuid default gen_random_uuid() primary key,
  slip_id uuid references public.prediction_slips on delete cascade not null,
  fixture_id integer not null,
  home_team text not null,
  away_team text not null,
  pick text check (pick in ('home','draw','away')) not null,
  confidence integer check (confidence between 0 and 100),
  kickoff timestamptz,
  result text check (result in ('correct','wrong','push')),
  created_at timestamptz default now() not null,
  -- A fixture can appear in many slips, but only once within one.
  unique (slip_id, fixture_id)
);

create index if not exists slip_picks_slip_id_idx on public.slip_picks (slip_id);
create index if not exists prediction_slips_user_idx on public.prediction_slips (user_id, created_at desc);
create index if not exists prediction_slips_shared_idx on public.prediction_slips (shared_at desc)
  where shared_at is not null;

alter table public.prediction_slips enable row level security;
alter table public.slip_picks enable row level security;

-- Read: your own always, other people's only once shared.
create policy "Own or shared slips readable"
  on public.prediction_slips for select
  using (auth.uid() = user_id or shared_at is not null);

create policy "Own slips writable"
  on public.prediction_slips for insert
  with check (auth.uid() = user_id);

create policy "Own slips editable"
  on public.prediction_slips for update
  using (auth.uid() = user_id);

create policy "Own slips deletable"
  on public.prediction_slips for delete
  using (auth.uid() = user_id);

-- Picks inherit their slip's visibility. Written as an exists() against the
-- parent so a shared slip's contents are readable without exposing anything
-- belonging to an unshared one.
create policy "Picks follow their slip"
  on public.slip_picks for select
  using (
    exists (
      select 1 from public.prediction_slips s
      where s.id = slip_picks.slip_id
        and (s.user_id = auth.uid() or s.shared_at is not null)
    )
  );

create policy "Own slip picks writable"
  on public.slip_picks for insert
  with check (
    exists (
      select 1 from public.prediction_slips s
      where s.id = slip_picks.slip_id and s.user_id = auth.uid()
    )
  );

create policy "Own slip picks editable"
  on public.slip_picks for update
  using (
    exists (
      select 1 from public.prediction_slips s
      where s.id = slip_picks.slip_id and s.user_id = auth.uid()
    )
  );

create policy "Own slip picks deletable"
  on public.slip_picks for delete
  using (
    exists (
      select 1 from public.prediction_slips s
      where s.id = slip_picks.slip_id and s.user_id = auth.uid()
    )
  );

-- Sharing a slip creates a community post that points at it.
alter table public.community_posts
  add column if not exists slip_id uuid references public.prediction_slips on delete cascade;

create index if not exists community_posts_slip_idx on public.community_posts (slip_id)
  where slip_id is not null;

-- Carry existing picks across, one slip per user, so nobody loses what they saved.
do $$
declare
  u record;
  new_slip uuid;
begin
  for u in select distinct user_id from public.user_picks loop
    insert into public.prediction_slips (user_id, title, created_at)
    values (u.user_id, 'Earlier predictions', now())
    returning id into new_slip;

    insert into public.slip_picks
      (slip_id, fixture_id, home_team, away_team, pick, confidence, result, created_at)
    select new_slip, p.fixture_id, p.home_team, p.away_team, p.pick, p.confidence, p.result, p.created_at
    from public.user_picks p
    where p.user_id = u.user_id
    on conflict (slip_id, fixture_id) do nothing;
  end loop;
end $$;

notify pgrst, 'reload schema';
