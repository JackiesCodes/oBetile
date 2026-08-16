-- A local copy of the football data the app cannot afford to lose.
--
-- Scoped deliberately rather than mirroring the provider. The database is on
-- Supabase's free tier, so the question is not "what could we store" but "what
-- is worth 500MB and must survive the provider going away". Two things qualify:
--
--   fixture_results   settles a saved prediction. Without it, every slip
--                     becomes unsettleable the day the subscription lapses,
--                     and the whole record of who was right disappears.
--
--   team_season_stats feeds the statistics layer. One row per team per
--                     competition per season, so the thirteen tracked leagues
--                     cost a few hundred rows, not a few hundred thousand.
--
-- Deliberately NOT stored: every fixture worldwide, players, events, lineups,
-- transfers. Those are large, change constantly, and are perfectly well served
-- by the existing request cache. Persisting them would spend the tier's whole
-- allowance on data that is cheap to re-fetch and worthless once stale.

create table if not exists public.fixture_results (
  fixture_id integer primary key,
  league_id integer,
  league_name text,
  season text,
  kickoff timestamptz,
  home_team_id integer,
  away_team_id integer,
  home_team text not null,
  away_team text not null,
  home_goals integer,
  away_goals integer,
  -- API-Football's short code: FT, AET, PEN, NS, 1H …
  status text not null,
  -- Only set once decided. Mirrors lib/fixture-outcome so a settled pick can be
  -- scored without asking the provider again.
  outcome text check (outcome in ('home','draw','away')),
  finished boolean not null default false,
  updated_at timestamptz default now() not null
);

create index if not exists fixture_results_kickoff_idx
  on public.fixture_results (kickoff desc);
create index if not exists fixture_results_league_idx
  on public.fixture_results (league_id, season);
-- Settling walks the unfinished rows, so that subset gets its own index.
create index if not exists fixture_results_unfinished_idx
  on public.fixture_results (kickoff) where not finished;

create table if not exists public.team_season_stats (
  league_id integer not null,
  season text not null,
  team_id integer not null,
  team_name text,
  team_logo text,

  -- The record, as /teams/statistics reports it.
  played_home integer default 0, played_away integer default 0, played_total integer default 0,
  wins_home integer default 0, wins_away integer default 0, wins_total integer default 0,
  draws_home integer default 0, draws_away integer default 0, draws_total integer default 0,
  losses_home integer default 0, losses_away integer default 0, losses_total integer default 0,
  goals_for_home integer default 0, goals_for_away integer default 0, goals_for_total integer default 0,
  goals_against_home integer default 0, goals_against_away integer default 0, goals_against_total integer default 0,
  clean_sheets_home integer default 0, clean_sheets_away integer default 0, clean_sheets_total integer default 0,
  failed_to_score_home integer default 0, failed_to_score_away integer default 0, failed_to_score_total integer default 0,
  form text,

  -- Derived in lib/statistics and stored alongside, so a reader gets the
  -- figures without the app recomputing them on every request. Nullable
  -- throughout: a side that has played nothing has no win rate, and zero would
  -- read as "never wins".
  win_rate numeric, draw_rate numeric, loss_rate numeric,
  points_per_match numeric,
  goals_per_match numeric, goals_conceded_per_match numeric,
  clean_sheet_percentage numeric, failed_to_score_percentage numeric,
  form_index numeric,
  streak_type text check (streak_type in ('W','D','L')),
  streak_length integer default 0,
  unbeaten_run integer default 0,

  updated_at timestamptz default now() not null,
  primary key (league_id, season, team_id)
);

create index if not exists team_season_stats_team_idx
  on public.team_season_stats (team_id);

alter table public.fixture_results enable row level security;
alter table public.team_season_stats enable row level security;

-- Read by anyone: this is public sporting record, and the app serves it to
-- signed-out visitors. Writes are absent by design — no policy grants them, so
-- only the service role (which bypasses RLS) can populate these, and that key
-- never reaches the browser.
create policy "Fixture results are public" on public.fixture_results for select using (true);
create policy "Team season stats are public" on public.team_season_stats for select using (true);

-- Bookkeeping for the sync job, so a run can be inspected without reading logs
-- and an incremental sync knows where the last one got to.
create table if not exists public.sync_runs (
  id bigserial primary key,
  job text not null,
  started_at timestamptz default now() not null,
  finished_at timestamptz,
  ok boolean,
  records integer default 0,
  detail text
);

create index if not exists sync_runs_job_idx on public.sync_runs (job, started_at desc);

alter table public.sync_runs enable row level security;
-- Operational data, not public sporting record: readable only by the service
-- role, which means no policy at all.

notify pgrst, 'reload schema';
