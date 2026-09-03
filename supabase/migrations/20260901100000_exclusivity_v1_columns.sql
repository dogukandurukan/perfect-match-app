-- Exclusivity V1 (2026-09-01, product decision — CLAUDE.md §5): trust/quality
-- signals + a cosmetic waitlist. Instagram handle (soft identity signal,
-- manually spot-checked alongside photo verification), a verification selfie
-- path (manual review — no automated selfie-matching service, doesn't scale
-- yet, but this app's user count doesn't need it to), and the waitlist pair
-- (assigned sequential number + a boost that verification/referrals reduce
-- against — purely a displayed-position mechanic, NOT an access gate; see
-- product-decision note for why a hard gate was rejected at this liquidity
-- stage).
alter table public.profiles
  add column if not exists instagram_handle text,
  add column if not exists verification_selfie_path text,
  add column if not exists phone_verified boolean not null default false,
  add column if not exists waitlist_number bigint,
  add column if not exists waitlist_boost integer not null default 0;

-- Backfill waitlist_number for existing rows in signup order, then make new
-- signups get one automatically via a sequence-backed default.
create sequence if not exists public.waitlist_number_seq;

do $$
declare
  r record;
begin
  for r in
    select id from public.profiles where waitlist_number is null order by created_at asc
  loop
    update public.profiles
      set waitlist_number = nextval('public.waitlist_number_seq')
      where id = r.id;
  end loop;
end $$;

alter table public.profiles
  alter column waitlist_number set default nextval('public.waitlist_number_seq');
