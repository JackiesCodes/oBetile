-- Harden check_rate_limit against being used to lock other people out.
--
-- The previous signature took the bucket, limit and window from the caller.
-- Because the app authenticates as `authenticated`, that function is reachable
-- at /rest/v1/rpc/check_rate_limit, so any signed-in user could call it with
-- another user's bucket and a long window and drive that account's counter over
-- the limit — a denial of service against a specific victim. Supabase's linter
-- flags this as 0029.
--
-- The identity now comes from auth.uid() rather than an argument, so a caller
-- can only ever spend their own allowance, and the limits live here instead of
-- being supplied by the caller.

drop function if exists public.check_rate_limit(text, integer, integer);

create or replace function public.check_rate_limit(p_action text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_limit  integer;
  v_window integer;
  v_count  integer;
  v_bucket text;
begin
  -- Every rate-limited route requires a session; no session, no allowance.
  if v_uid is null then
    return false;
  end if;

  -- Server-side allowances. Deliberately not parameters: a caller must not be
  -- able to widen its own limit or stretch another account's window.
  case p_action
    when 'post' then v_limit := 5;  v_window := 60;
    when 'vote' then v_limit := 30; v_window := 60;
    when 'like' then v_limit := 60; v_window := 60;
    else return false;
  end case;

  v_bucket := p_action || ':' || v_uid::text;

  insert into public.rate_limits as rl (bucket, count, expires_at)
  values (v_bucket, 1, clock_timestamp() + make_interval(secs => v_window))
  on conflict (bucket) do update
    set count = case
          when rl.expires_at < clock_timestamp() then 1
          else rl.count + 1
        end,
        expires_at = case
          when rl.expires_at < clock_timestamp()
            then clock_timestamp() + make_interval(secs => v_window)
          else rl.expires_at
        end
  returning rl.count into v_count;

  return v_count <= v_limit;
end;
$$;

revoke execute on function public.check_rate_limit(text) from public;
revoke execute on function public.check_rate_limit(text) from anon;
grant execute on function public.check_rate_limit(text) to authenticated;

notify pgrst, 'reload schema';
