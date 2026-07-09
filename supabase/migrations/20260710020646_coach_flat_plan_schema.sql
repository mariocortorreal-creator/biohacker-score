-- Replace the old tiered pricing model (1-5 / 6-50 / 51-150 clients at $14/$64/$134)
-- with the flat plan Mario confirmed: $20/mo per coach, hard cap 25 clients.
alter table public.coaches
  drop constraint coaches_subscription_tier_check;

alter table public.coaches
  alter column subscription_tier set default 'standard';

alter table public.coaches
  add constraint coaches_subscription_tier_check
  check (subscription_tier = any (array['standard'::text]));

-- Backfill existing coach rows (currently just Mario) to the new flat tier label.
update public.coaches
set subscription_tier = 'standard'
where subscription_tier is null or subscription_tier not in ('standard');

comment on table public.coaches is 'Coaches (Mario + paying colleague trainers) who manage their own client roster. Pricing: flat $20/mo per coach, hard cap of 25 clients per coach (enforced by trg_enforce_coach_client_limit) and 50 active coaches platform-wide (enforced by trg_enforce_active_coach_cap).';

comment on column public.coaches.subscription_tier is 'Flat plan identifier, currently always ''standard'' ($20/mo, up to 25 clients). Kept as a column in case a future plan variant is introduced.';
