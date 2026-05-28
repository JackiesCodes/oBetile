-- Fix function_search_path_mutable + anon/authenticated SECURITY DEFINER exposure
-- Supabase linter warnings: 0011, 0028, 0029

-- Fix 1: Recreate handle_new_user with empty search_path + revoke public execute
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

-- Revoke direct REST API execution (trigger invocation is unaffected by EXECUTE grants)
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.handle_new_user() from public;

-- Fix 2: Recreate update_likes_count with empty search_path + fully-qualified table names
create or replace function public.update_likes_count()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if TG_OP = 'INSERT' then
    update public.community_posts set likes_count = likes_count + 1 where id = NEW.post_id;
  elsif TG_OP = 'DELETE' then
    update public.community_posts set likes_count = greatest(likes_count - 1, 0) where id = OLD.post_id;
  end if;
  return null;
end;
$$;
