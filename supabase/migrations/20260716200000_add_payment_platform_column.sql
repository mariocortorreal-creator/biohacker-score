-- Informational only — records which channel granted a profile's current premium
-- access. Never read by is_premium() or the premium_source check constraint; those
-- stay untouched. Lets support/analytics answer "how did this user pay?" without
-- guessing from stripe_customer_id being null.
alter table public.profiles
  add column payment_platform text check (payment_platform in ('stripe', 'apple_iap', 'google_iap'));
