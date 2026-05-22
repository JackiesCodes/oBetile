-- Community posts table
create table public.community_posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  content text not null check (char_length(content) between 1 and 500),
  fixture_id integer,
  league_id integer,
  sport text not null default 'soccer',
  likes_count integer not null default 0,
  created_at timestamptz default now()
);

alter table community_posts enable row level security;

create policy "Public posts readable"
  on community_posts for select using (true);

create policy "Authenticated users can post"
  on community_posts for insert
  with check (auth.uid() = user_id);

create policy "Own posts editable"
  on community_posts for update
  using (auth.uid() = user_id);

create policy "Own posts deletable"
  on community_posts for delete
  using (auth.uid() = user_id);

-- Post likes table (composite PK prevents duplicate likes)
create table public.post_likes (
  post_id uuid references community_posts on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

alter table post_likes enable row level security;

create policy "Public likes readable"
  on post_likes for select using (true);

create policy "Authenticated users can like"
  on post_likes for insert
  with check (auth.uid() = user_id);

create policy "Own likes deletable"
  on post_likes for delete
  using (auth.uid() = user_id);

-- Trigger: keep likes_count in sync automatically
create or replace function public.update_likes_count()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update community_posts set likes_count = likes_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update community_posts set likes_count = greatest(likes_count - 1, 0) where id = OLD.post_id;
  end if;
  return null;
end; $$;

create trigger on_like_change
  after insert or delete on post_likes
  for each row execute procedure public.update_likes_count();
