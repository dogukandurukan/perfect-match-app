-- Signup phone: store country_code + dial_code for formatted display.

alter table public.profiles
  add column if not exists country_code text;

alter table public.profiles
  add column if not exists dial_code text;

comment on column public.profiles.country_code is 'ISO-like country code used at signup (e.g. TR).';
comment on column public.profiles.dial_code is 'Dial code used at signup (e.g. +90).';

