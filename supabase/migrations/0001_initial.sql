-- oBetile initial schema

-- Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  avatar_url text,
  created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Public profiles readable" on profiles for select using (true);
create policy "Own profile editable" on profiles for all using (auth.uid() = id);

-- Favourites (leagues, teams, fixtures)
create table public.favourites (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  type text check (type in ('league','team','fixture')) not null,
  external_id integer not null,
  name text,
  logo_url text,
  created_at timestamptz default now(),
  unique(user_id, type, external_id)
);
alter table favourites enable row level security;
create policy "Own favourites only" on favourites for all using (auth.uid() = user_id);

-- User picks (insight tracking — no financial data)
create table public.user_picks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  fixture_id integer not null,
  home_team text not null,
  away_team text not null,
  pick text check (pick in ('home','draw','away')) not null,
  confidence integer check (confidence between 0 and 100),
  created_at timestamptz default now()
);
alter table user_picks enable row level security;
create policy "Own picks only" on user_picks for all using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
