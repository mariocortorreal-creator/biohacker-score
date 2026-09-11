-- Daily reminder preference. Nullable: no reminder until the user picks a time.
alter table public.profiles
  add column if not exists reminder_time time;

comment on column public.profiles.reminder_time is
  'Local clock time at which the app schedules the daily "log your night" notification. Null = no reminder.';
