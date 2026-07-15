-- profiles.subscription_tier is meant to be set exclusively by stripe-webhook (via
-- SERVICE_ROLE_KEY) after a real Stripe payment. profiles already has a client-facing
-- UPDATE policy (auth.uid() = id) that legitimately lets users PATCH their own goal /
-- body-composition columns directly via PostgREST — without this trigger, that same
-- policy would also let a user PATCH their own subscription_tier straight to 'elite'
-- and inflate their monthly diet-generation quota (2 -> 10) with no payment.
create or replace function public.protect_subscription_tier()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.subscription_tier is distinct from old.subscription_tier
     and coalesce(auth.role(), 'anon') <> 'service_role' then
    raise exception 'subscription_tier solo puede modificarse a través del webhook de pagos.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_subscription_tier on public.profiles;

create trigger trg_protect_subscription_tier
  before update on public.profiles
  for each row
  execute function public.protect_subscription_tier();

revoke execute on function public.protect_subscription_tier() from public, anon, authenticated;
