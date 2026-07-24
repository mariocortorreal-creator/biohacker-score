-- Admin identity: lets Mario (and future admins) manage any user's plan and
-- coach status from a new "Admin" section in index.html, instead of the SQL-only
-- workaround that's been the only option until now. Mirrors how `coaches` is a
-- minimal "is this a coach" table -- there's only one privilege level today, so
-- no separate roles/permissions table is needed.

create table public.admins (
  id uuid primary key references public.profiles(id) on delete cascade,
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
-- Deliberately no policies: nobody reads/writes this table directly via
-- PostgREST, including admins themselves. All access goes through is_admin()
-- and the admin RPCs added in later migrations, which run as SECURITY DEFINER
-- and bypass RLS the same way add_coach_client_by_email already does against
-- coaches/coach_clients.

create or replace function public.is_admin()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.admins where id = auth.uid()
  );
$$;

-- Every logged-in user calls this (to decide whether to show the Admin tab),
-- so the grant to authenticated is intentional and must not be reverted in a
-- future cleanup migration -- see the is_premium() incident in
-- 20260714184954 -> 20260714191049 for exactly what that mistake costs.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

insert into public.admins (id)
select id from public.profiles where email = 'mariocortorreal@gmail.com'
on conflict do nothing;
