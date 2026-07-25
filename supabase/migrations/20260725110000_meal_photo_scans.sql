-- FitIA-style "photo → estimated macros" scanner. Analysis is ephemeral —
-- the photo itself is never persisted (sent to the edge function as base64,
-- discarded after the Claude call), only the detected items and estimated
-- macros are stored. Mirrors the diet_plans pattern throughout: separate
-- quota column on subscription_plans, SELECT-only client RLS, all writes
-- via the edge function's service role, and an atomic quota trigger to
-- close the same TOCTOU race documented in 20260716210000_diet_plan_quota_trigger.sql.

alter table public.subscription_plans
  add column monthly_photo_scan_quota integer not null default 10;

update public.subscription_plans set monthly_photo_scan_quota = 10 where tier = 'basico';
update public.subscription_plans set monthly_photo_scan_quota = 30 where tier = 'pro';
update public.subscription_plans set monthly_photo_scan_quota = 999999 where tier = 'elite';

create table public.meal_photo_scans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  detected_items jsonb not null,
  calories_est integer not null,
  protein_g_est numeric not null,
  carbs_g_est numeric not null,
  fat_g_est numeric not null,
  calories_final integer,
  protein_g_final numeric,
  carbs_g_final numeric,
  fat_g_final numeric,
  edited_by_user boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.meal_photo_scans enable row level security;

create policy "Client reads own meal photo scans"
  on public.meal_photo_scans for select
  using (client_id = auth.uid());

-- No insert/update policy for the client: writes go exclusively through the
-- analyze-meal-photo edge function (service role), same as diet_plans.

-- Trial testers get a small fixed allowance (not the tier-based quota) for
-- the same reason as get_client_diet_quota: each scan costs a real Anthropic
-- API call with image tokens, more expensive per-call than a text-only diet
-- generation.
create or replace function public.get_client_meal_scan_quota(profile_id uuid)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_premium_source text;
  v_tier text;
  v_quota integer;
begin
  select premium_source, subscription_tier
    into v_premium_source, v_tier
    from public.profiles
    where id = profile_id;

  if v_premium_source = 'trial' then
    return 5;
  elsif v_tier is not null then
    select monthly_photo_scan_quota into v_quota from public.subscription_plans where tier = v_tier;
    return coalesce(v_quota, 0);
  elsif v_premium_source = 'comp_trainer' then
    select monthly_photo_scan_quota into v_quota from public.subscription_plans where tier = 'elite';
    return coalesce(v_quota, 0);
  else
    return 0;
  end if;
end;
$function$;

create or replace function public.enforce_meal_scan_quota()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_quota int;
  v_used int;
  v_month_start timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext(new.client_id::text));

  v_quota := public.get_client_meal_scan_quota(new.client_id);
  v_month_start := date_trunc('month', now());

  select count(*) into v_used
  from public.meal_photo_scans
  where client_id = new.client_id
    and created_at >= v_month_start;

  if v_used >= v_quota then
    raise exception 'Cuota mensual de escaneos de comida alcanzada (% de %).', v_used, v_quota
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_meal_scan_quota() from public, anon, authenticated;

drop trigger if exists trg_enforce_meal_scan_quota on public.meal_photo_scans;

create trigger trg_enforce_meal_scan_quota
  before insert on public.meal_photo_scans
  for each row
  execute function public.enforce_meal_scan_quota();
