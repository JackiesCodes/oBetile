-- Rate limiting for user-generated content (posts, votes, likes).
--
-- Counters live in Postgres rather than process memory because the app runs on
-- serverless functions: each instance has its own memory, so an in-process
-- counter would let a caller multiply their allowance by the number of warm
-- instances. A shared table gives one true count regardless of which instance
-- serves the request.

create table if not exists public.rate_limits (
  bucket      text primary key,
  count       integer not null default 0,
  expires_at  timestamptz not null
);

create index if not exists rate_limits_expires_at_idx
  on public.rate_limits (expires_at);

-- RLS on with no policies at all: this table is reachable only through the
-- security-definer function below, never directly from the anon/authenticated
-- REST API. Without this a client could read or rewrite its own counters.
alter table public.rate_limits enable row level security;

/*
 * Atomically count one hit against a bucket and report whether it is allowed.
 *
 * The insert-on-conflict is a single statement so concurrent requests cannot
 * interleave a read and a write and both slip under the limit. An expired
 * window resets rather than blocks, so buckets are self-healing.
 *
 * search_path is pinned to '' (and every name fully qualified) to match the
 * hardening applied in 0004 — a security-definer function with a mutable
 * search_path can be hijacked via a shadowing object.
 */
create or replace function public.check_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_bucket is null or p_limit is null or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  insert into public.rate_limits as rl (bucket, count, expires_at)
  values (
    p_bucket,
    1,
    clock_timestamp() + make_interval(secs => p_window_seconds)
  )
  on conflict (bucket) do update
    set count = case
          when rl.expires_at < clock_timestamp() then 1
          else rl.count + 1
        end,
        expires_at = case
          when rl.expires_at < clock_timestamp()
            then clock_timestamp() + make_interval(secs => p_window_seconds)
          else rl.expires_at
        end
  returning rl.count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Callers are always authenticated: every rate-limited route requires a session.
revoke execute on function public.check_rate_limit(text, integer, integer) from public;
revoke execute on function public.check_rate_limit(text, integer, integer) from anon;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;

/*
 * Housekeeping for expired buckets. Called opportunistically by the app rather
 * than on every request, so the hot path stays a single upsert.
 */
create or replace function public.purge_expired_rate_limits()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.rate_limits where expires_at < clock_timestamp();
$$;

revoke execute on function public.purge_expired_rate_limits() from public;
revoke execute on function public.purge_expired_rate_limits() from anon;
revoke execute on function public.purge_expired_rate_limits() from authenticated;
