-- Bug fix: 20260713164300_diet_generator_schema.sql seeded subscription_plans with
-- placeholder prices (9.99/13.99/19.99) and left stripe_price_id null. The real, live
-- Stripe Payment Links charge different amounts, confirmed against the Stripe
-- dashboard: básico $7.99 (price_1To7SuLb3yxBeQwgnfiEuRZF), pro $14.00
-- (price_1Tsnw2Lb3yxBeQwgiESzfDdN), elite $19.00 (price_1TsoCELb3yxBeQwg2az3dJJa).
--
-- Impact of the bug: stripe-webhook's checkout.session.completed matches a client tier
-- by exact charged amount (TIER_AMOUNTS_CENTS, fixed in the same commit as this
-- migration) — with the wrong amounts, a real paying client would hit the unmatched-
-- amount branch and never receive premium. Separately, stripe_price_id being null meant
-- tierForPriceId() (used by customer.subscription.updated, i.e. renewals/plan changes)
-- could never resolve a client tier either.
update public.subscription_plans set price_usd = 7.99, stripe_price_id = 'price_1To7SuLb3yxBeQwgnfiEuRZF' where tier = 'basico';
update public.subscription_plans set price_usd = 14.00, stripe_price_id = 'price_1Tsnw2Lb3yxBeQwgiESzfDdN' where tier = 'pro';
update public.subscription_plans set price_usd = 19.00, stripe_price_id = 'price_1TsoCELb3yxBeQwg2az3dJJa' where tier = 'elite';
