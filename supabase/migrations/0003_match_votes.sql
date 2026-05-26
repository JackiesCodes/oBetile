-- Match market community votes
create table public.match_market_votes (
  fixture_id integer not null,
  market text not null,
  selection text not null,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamptz default now(),
  primary key (fixture_id, market, user_id)
);

alter table match_market_votes enable row level security;

create policy "Public votes readable"
  on match_market_votes for select using (true);

create policy "Auth users can vote"
  on match_market_votes for insert
  with check (auth.uid() = user_id);

create policy "Own votes deletable"
  on match_market_votes for delete
  using (auth.uid() = user_id);
