-- Suplementos tab is now fully open to everyone (free, trial, any plan) — no premium gating.
-- premium_only becomes dead metadata on this table; UI no longer reads it for gating.
update public.supplement_recommendations set premium_only = false;
alter table public.supplement_recommendations alter column premium_only set default false;
