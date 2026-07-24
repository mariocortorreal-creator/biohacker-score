-- Admin mutations: change a user's plan, and designate/undesignate any user
-- as a coach. plpgsql (unlike the read-only sql functions above) so these can
-- RAISE EXCEPTION -- a mutation should fail loudly for a non-admin caller,
-- not silently no-op.

create or replace function public.admin_set_premium(
  p_user_id uuid,
  p_premium_source text,
  p_trial_ends_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  -- No CHECK constraint enforces this set on profiles.premium_source today,
  -- so this function is the only real safety net, not just the UI dropdown.
  if p_premium_source is not null and p_premium_source not in ('paid', 'comp_trainer', 'trial') then
    raise exception 'invalid_premium_source';
  end if;

  update public.profiles
  set premium_source = p_premium_source,
      trial_ends_at = p_trial_ends_at
  where id = p_user_id;
end;
$$;

revoke execute on function public.admin_set_premium(uuid, text, timestamptz) from public, anon;
grant execute on function public.admin_set_premium(uuid, text, timestamptz) to authenticated;

create or replace function public.admin_set_coach_status(
  p_user_id uuid,
  p_active boolean,
  p_business_name text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  if p_active then
    -- subscription_tier on coaches is CHECK-forced to 'standard' only today
    -- (20260710020646) -- hardcode it, it isn't a caller-supplied param.
    insert into public.coaches (id, status, subscription_tier, business_name)
    values (p_user_id, 'active', 'standard', p_business_name)
    on conflict (id) do update
      set status = 'active',
          business_name = coalesce(excluded.business_name, public.coaches.business_name);
  else
    -- Soft status flip, never DELETE, so an un-designated coach doesn't lose
    -- their coach_clients/routines history.
    update public.coaches set status = 'canceled' where id = p_user_id;
  end if;
end;
$$;

revoke execute on function public.admin_set_coach_status(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_coach_status(uuid, boolean, text) to authenticated;
