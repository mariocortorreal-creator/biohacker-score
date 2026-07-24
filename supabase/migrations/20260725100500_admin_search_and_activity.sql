-- Read-only admin RPCs: look up any user by email and see their recent
-- activity. Both self-gate via is_admin() inside the body (never trusting a
-- client-supplied flag), so granting execute to `authenticated` is safe -- a
-- non-admin caller just gets the not_authorized exception, same posture as
-- add_coach_client_by_email rejecting a non-coach.

create or replace function public.admin_find_user_by_email(p_email text)
returns table (
  id uuid,
  email text,
  full_name text,
  premium_source text,
  trial_ends_at timestamptz,
  is_coach boolean,
  coach_status text,
  coach_business_name text
)
language sql
stable security definer
set search_path to 'public'
as $$
  select
    p.id,
    p.email,
    p.full_name,
    p.premium_source,
    p.trial_ends_at,
    (co.id is not null) as is_coach,
    co.status as coach_status,
    co.business_name as coach_business_name
  from public.profiles p
  left join public.coaches co on co.id = p.id
  where public.is_admin()
    and lower(p.email) = lower(p_email);
$$;

revoke execute on function public.admin_find_user_by_email(text) from public, anon;
grant execute on function public.admin_find_user_by_email(text) to authenticated;

-- Honest framing: there is no login/session tracking anywhere in this schema
-- (no created_at on profiles, no session table). The only real signal is
-- "did this user log a daily_entries row, and when." index.html must label
-- this "ultimos registros", never "ultima conexion" -- a client could be
-- actively using the app without logging today's metrics.
create or replace function public.admin_recent_activity(p_user_id uuid, p_limit int default 14)
returns table (
  entry_date date,
  sleep_hours numeric,
  exercise_minutes numeric,
  stress_level numeric,
  nutrition_quality numeric
)
language sql
stable security definer
set search_path to 'public'
as $$
  select
    d.entry_date,
    d.sleep_hours,
    d.exercise_minutes,
    d.stress_level,
    d.nutrition_quality
  from public.daily_entries d
  where public.is_admin()
    and d.user_id = p_user_id
  order by d.entry_date desc
  limit p_limit;
$$;

revoke execute on function public.admin_recent_activity(uuid, int) from public, anon;
grant execute on function public.admin_recent_activity(uuid, int) to authenticated;
