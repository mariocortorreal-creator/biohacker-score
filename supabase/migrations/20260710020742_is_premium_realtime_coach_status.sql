-- Client-of-a-coach premium access is now computed in real time against the linked
-- coach's current status (coach_clients -> coaches.status), instead of the old static
-- premium_source = 'comp_trainer' flag. If the coach cancels/lapses, the client loses
-- access on the very next check, with no manual intervention.
--
-- Mario's own personal comp_trainer clients (profiles.premium_source = 'comp_trainer'
-- with no coach_clients row) keep working exactly as before, since the coach-link branch
-- only applies when a coach_clients row actually exists for that profile.
create or replace function public.is_premium(profile_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select
    case
      -- Client linked to a coach: premium is entirely derived from the coach's status.
      when cc.coach_id is not null then coalesce(co.status = 'active', false)
      when p.premium_source = 'paid' then true
      when p.premium_source = 'comp_trainer' then true
      when p.premium_source = 'trial' then (p.trial_ends_at is not null and now() <= p.trial_ends_at)
      else false
    end
  from public.profiles p
  left join public.coach_clients cc on cc.client_id = p.id
  left join public.coaches co on co.id = cc.coach_id
  where p.id = profile_id;
$$;
