-- Diet generator (Nutrición tab) + 3 subscription plans (básico/pro/elite).
-- subscription_tier is independent of plan/premium_source: those still control general
-- premium access (is_premium()), this only determines the monthly diet-generation quota
-- once premium_source = 'paid'. Fallback when subscription_tier is null, applied in the
-- generate-diet-plan edge function (not here): trial -> basico quota, comp_trainer -> elite quota.

alter table public.profiles
  add column age integer,
  add column height_cm numeric,
  add column activity_level text check (activity_level in ('sedentario','ligero','moderado','activo','muy_activo')),
  add column nutrition_goal text check (nutrition_goal in ('cut','bulk','maintain')),
  add column subscription_tier text check (subscription_tier in ('basico','pro','elite'));

create table public.subscription_plans (
  tier text primary key,
  display_name text not null,
  price_usd numeric not null,
  monthly_diet_quota integer not null,
  stripe_price_id text
);

alter table public.subscription_plans enable row level security;

create policy "Authenticated users can read subscription plans"
  on public.subscription_plans for select
  using (true);

insert into public.subscription_plans (tier, display_name, price_usd, monthly_diet_quota) values
  ('basico', 'Plan Básico', 9.99, 2),
  ('pro', 'Plan Pro', 13.99, 3),
  ('elite', 'Plan Elite', 19.99, 10);

create table public.client_food_exclusions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  food_name text not null,
  reason text not null default 'dislike' check (reason in ('dislike','allergy')),
  created_at timestamptz not null default now()
);

alter table public.client_food_exclusions enable row level security;

create policy "Client manages own exclusions"
  on public.client_food_exclusions for all
  using (client_id = auth.uid());

create table public.diet_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  calorie_target integer not null,
  protein_g numeric not null,
  carbs_g numeric not null,
  fat_g numeric not null,
  meal_plan jsonb not null,
  input_snapshot jsonb not null,
  generated_at timestamptz not null default now()
);

alter table public.diet_plans enable row level security;

create policy "Client reads own diet plans"
  on public.diet_plans for select
  using (client_id = auth.uid());

-- No insert/update policy for the client: writes go exclusively through the
-- generate-diet-plan edge function (service role), so the monthly quota can't
-- be manipulated from the client. Coach has no policy on diet_plans or
-- client_food_exclusions either, consistent with coaches only touching routines.
