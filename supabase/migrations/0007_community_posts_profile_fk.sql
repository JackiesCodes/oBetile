-- Let PostgREST embed a post's author.
--
-- The community feed selects "*, profiles(username, avatar_url)", but
-- community_posts.user_id only referenced auth.users. PostgREST resolves
-- embeds from foreign keys, and there was no path from community_posts to
-- public.profiles, so every read of the feed failed with PGRST200
-- ("Could not find a relationship between 'community_posts' and 'profiles'").
--
-- profiles.id is itself the primary key and references auth.users, so pointing
-- user_id at profiles keeps the same integrity guarantee and adds the path the
-- embed needs. Every user gets a profile row from the on_auth_user_created
-- trigger, so this cannot orphan a post.

alter table public.community_posts
  drop constraint if exists community_posts_user_id_profiles_fkey;

alter table public.community_posts
  add constraint community_posts_user_id_profiles_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

-- PostgREST caches the schema; without this the new relationship is invisible
-- until the next restart.
notify pgrst, 'reload schema';
