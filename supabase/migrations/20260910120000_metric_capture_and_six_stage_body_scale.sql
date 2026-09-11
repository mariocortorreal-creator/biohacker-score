-- Metric capture rework + six-stage body composition scale.
--
-- Two independent changes, both additive. Nothing is dropped and no existing value is
-- destroyed, so this is safe to run against live data.
--
-- 1. daily_entries keeps the raw answers behind the derived numbers.
--    The app used to ask "how many hours did you sleep?" with a slider. It now asks the
--    two clock times the user actually remembers and derives the hours. The derived
--    columns (sleep_hours, fasting_hours, nutrition_quality) keep their existing meaning
--    and type; these new columns store what the user literally entered, so the form can
--    be reopened as they filled it and the derived number stays auditable.
--
-- 2. profiles moves from the 4-image body scale to a 6-stage one.
--    Old scale: 1 Definido, 2 Atlético, 3 Promedio, 4 Sobre el promedio — a span of
--    roughly 10-30% body fat, with the two leanest images depicting the same physique.
--    New scale: 1 Delgado, 2 Promedio, 3 Sobrepeso, 4 Obesidad, 5 Atlético, 6 Musculoso.
--    Stages 1-4 walk up body fat; 5-6 add muscle at a lean body fat.

begin;

-- ---------- 1. Raw metric answers ----------

alter table public.daily_entries
  add column if not exists sleep_bedtime time,
  add column if not exists sleep_waketime time,
  add column if not exists fast_last_meal time,
  add column if not exists fast_first_meal time,
  add column if not exists nutrition_checks jsonb;

comment on column public.daily_entries.sleep_bedtime is
  'Clock time the user says they went to bed. sleep_hours is derived from this and sleep_waketime.';
comment on column public.daily_entries.sleep_waketime is
  'Clock time the user says they got up.';
comment on column public.daily_entries.fast_last_meal is
  'Last meal of the previous day. fasting_hours is derived from this and fast_first_meal.';
comment on column public.daily_entries.fast_first_meal is
  'First meal of the current day.';
comment on column public.daily_entries.nutrition_checks is
  'The five nutrition checkboxes as ticked, e.g. {"protein":true,"vegetables":false,...}. nutrition_quality (1-10) is derived from it.';

-- RLS already scopes daily_entries by user_id; new columns inherit those policies and
-- need no new grants.

-- ---------- 2. Six-stage body scale ----------

alter table public.profiles
  add column if not exists body_scale_version smallint not null default 1;

comment on column public.profiles.body_scale_version is
  'Which body-composition scale body_current_stage/body_target_stage refer to. 1 = the original 4-image scale, 2 = the 6-stage fat/muscle scale.';

-- The stage columns are still bounded 1..4 by their original CHECK constraints, so they
-- have to be widened before anything can be remapped onto stages 5 or 6.
alter table public.profiles
  drop constraint if exists profiles_body_current_stage_check,
  drop constraint if exists profiles_body_target_stage_check;

alter table public.profiles
  add constraint profiles_body_current_stage_check
    check (body_current_stage is null or (body_current_stage >= 1 and body_current_stage <= 6)),
  add constraint profiles_body_target_stage_check
    check (body_target_stage is null or (body_target_stage >= 1 and body_target_stage <= 6));

-- Map the stored stages onto the new scale, once. Only rows still on version 1 are
-- touched, so re-running this migration is a no-op.
--   old 1 Definido          -> new 5 Atlético   (visible definition, low body fat)
--   old 2 Atlético          -> new 5 Atlético   (the old scale drew these two the same)
--   old 3 Promedio          -> new 2 Promedio
--   old 4 Sobre el promedio -> new 3 Sobrepeso
-- Nothing maps onto 4 Obesidad: the old images never depicted it, and inventing that
-- reading for a stored profile would fabricate data the user never entered.
update public.profiles
set
  body_current_stage = case body_current_stage
    when 1 then 5
    when 2 then 5
    when 3 then 2
    when 4 then 3
    else body_current_stage
  end,
  body_target_stage = case body_target_stage
    when 1 then 5
    when 2 then 5
    when 3 then 2
    when 4 then 3
    else body_target_stage
  end,
  body_scale_version = 2
where body_scale_version = 1
  and (body_current_stage is not null or body_target_stage is not null);

-- Profiles that never picked a body composition move to version 2 without a remap,
-- so new signups and untouched rows agree on which scale the columns mean.
update public.profiles
set body_scale_version = 2
where body_scale_version = 1;

alter table public.profiles
  alter column body_scale_version set default 2;

commit;
