-- Incident fix: the previous migration revoked EXECUTE on is_premium() from
-- `authenticated`, assuming it was only called server-side via service_role. It's
-- actually also called directly from the browser with the user's own session
-- (index.html line ~1151: POST {REST}/rpc/is_premium with profile_id = session.user.id),
-- which broke premium status for every logged-in user, including production accounts.
--
-- Fix: restore EXECUTE for `authenticated`, and instead close the original IDOR
-- (any authenticated user could pass an arbitrary profile_id and read someone else's
-- premium status) inside the function body — only the profile owner or service_role
-- gets a real answer; anyone else always gets `false` with no information leaked.
grant execute on function public.is_premium(uuid) to authenticated;

create or replace function public.is_premium(profile_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select
    case
      when coalesce(auth.role(), 'anon') <> 'service_role' and auth.uid() is distinct from profile_id then false
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
