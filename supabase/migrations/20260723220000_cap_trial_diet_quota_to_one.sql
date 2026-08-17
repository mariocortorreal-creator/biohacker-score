-- Trial users' diet quota was falling back to "basico" tier's quota (2),
-- same as a real paying customer. Each diet generation costs Mario a real
-- Anthropic API call, so trial testers must be capped at exactly 1 diet for
-- the whole trial, independent of tier. General premium/tier access for
-- trial (recipes, etc.) is unaffected — this only changes the diet quota.
-- See also: client-side resolveClientTier() in index.html, which was
-- separately fixed the same day to resolve trial -> "elite" tier for
-- everything that's NOT diet-quota-gated (recipe gallery, etc.).
create or replace function public.get_client_diet_quota(profile_id uuid)
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
    return 1;
  elsif v_tier is not null then
    select monthly_diet_quota into v_quota from public.subscription_plans where tier = v_tier;
    return coalesce(v_quota, 0);
  elsif v_premium_source = 'comp_trainer' then
    select monthly_diet_quota into v_quota from public.subscription_plans where tier = 'elite';
    return coalesce(v_quota, 0);
  else
    return 0;
  end if;
end;
$function$
