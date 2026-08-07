-- Let a signed-in user delete their own account and everything attached to it.
--
-- Data protection law gives users a right to erasure, and there was no way to
-- exercise it: deleting an auth user normally requires the service_role key,
-- which this app deliberately does not hold — putting that credential in the
-- application would be a far worse trade than a narrowly scoped function.
--
-- Deleting the auth.users row cascades to profiles, favourites, user_picks,
-- community_posts, post_likes and match_market_votes, since every one of those
-- references auth.users (or profiles) with on delete cascade.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  -- The identity comes from the JWT, never from an argument, so this can only
  -- ever delete the caller's own account.
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function public.delete_own_account() from public;
revoke execute on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;

notify pgrst, 'reload schema';
