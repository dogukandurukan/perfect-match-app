// Local verification of the proposed P0 privacy migrations (no live DB).
//
// Runs on PGlite (Postgres 17 in WASM), which enforces roles, column
// privileges and RLS. It rebuilds the relevant LIVE state of 2026-09-28
// (profiles columns, default Supabase grants, the real lockdown migration
// file, live RLS/storage policies as dumped read-only, stub RPCs with the
// live signatures), then applies P0-A, P0-B and both rollbacks from the
// real files in supabase/proposed/, checking each stage as three actors:
// anon, the account owner, and another signed-in user.
//
// Only synthetic sentinel values are used; results print pass/fail only.
//
// Run (PGlite is not an app dependency):
//   npm i --no-save --prefix /tmp/pglite @electric-sql/pglite
//   PGLITE=/tmp/pglite/node_modules/@electric-sql/pglite/dist/index.js \
//     node supabase/proposed/tests/p0_privacy.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..', '..');
const { PGlite } = await import(
  process.env.PGLITE ? pathToFileURL(process.env.PGLITE).href : '@electric-sql/pglite'
);
const db = new PGlite();
const read = (rel) => fs.readFileSync(path.join(repo, rel), 'utf8');

const A = '00000000-0000-4000-8000-00000000000a'; // owner / viewer
const B = '00000000-0000-4000-8000-00000000000b'; // other visible user
const H = '00000000-0000-4000-8000-00000000000c'; // hidden, matched with A
const X = '00000000-0000-4000-8000-00000000000d'; // hidden, not matched
const N = '00000000-0000-4000-8000-00000000000e'; // signed up, no profile row yet
const SENTINEL = 'SYNTHETIC-PRIVATE';

let passed = 0;
let failed = 0;
const check = (cond, name) => {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.log('FAIL', name);
  }
};

async function as(role, uid, sql, params = []) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify(uid ? { sub: uid, role } : { role }),
  ]);
  if (role !== 'postgres') await db.exec(`set role ${role}`);
  try {
    const r = await db.query(sql, params);
    return { ok: true, rows: r.rows };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    await db.exec('reset role');
  }
}
const denied = (r) => !r.ok && /permission denied|row-level security/i.test(r.error);

// ─── Baseline = live state 2026-09-28 ──────────────────────────────────────
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to public;
grant usage on schema public to anon, authenticated, service_role;
-- Supabase default privileges for new objects in public
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create table public.profiles (
  id uuid primary key, first_name text, last_name text, phone_number text, date_of_birth date,
  zodiac_sign text, city text, district text, lat float8, lng float8, full_address text, gender text,
  meeting_preferences text[], languages text[], morning_night text, recharge_style text, hobbies text[],
  vibe text, drinking text, smoking text, pets text, education text, education_detail text, religion text,
  bio text, availability_days text[], availability_hours text[], meeting_environment text[],
  favorite_spots jsonb, neighborhoods text[], first_date_expectation text, photos text[],
  setup_completed boolean default false, created_at timestamptz default now(), updated_at timestamptz,
  current_step int, country_code text, dial_code text, username text, setup1_completed boolean,
  favorite_music text, favorite_movie text, favorite_book text, favorite_activity text, core_value text,
  impressed_by text, dealbreaker text, expo_push_token text, preferred_locations text[],
  daily_views_count int, daily_views_reset_at timestamptz, daily_invites_count int,
  daily_invites_reset_at timestamptz, photo_verified boolean default false, discovery_age_min int,
  discovery_age_max int, discovery_max_distance text, notify_new_match boolean, notify_messages boolean,
  notify_meeting_invite boolean, is_hidden boolean default false, hide_location boolean default false,
  deleted_at timestamptz, is_premium boolean default false, instagram_handle text,
  verification_selfie_path text, phone_verified boolean, waitlist_number bigint, waitlist_boost int,
  occupation text, quick_icebreaker_answers jsonb, discovery_verified_only boolean,
  discovery_nonsmokers_only boolean, height_cm int, discovery_height_min int, discovery_height_max int,
  discovery_zodiac_signs text[], discovery_pets text[], discovery_education text[],
  discovery_religion text[], last_active_at timestamptz, discovery_active_today boolean,
  privacy_consent_at timestamptz);
alter table public.profiles enable row level security;
create policy "Users can insert own profile" on public.profiles for insert to public with check (auth.uid() = id);
create policy "Users can view own profile" on public.profiles for select to public using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

create table public.matches (id uuid primary key default gen_random_uuid(), user_a_id uuid, user_b_id uuid, status text);
alter table public.matches enable row level security;
create policy matches_select_policy on public.matches for select to public
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);
`);
// the real lockdown migration (UPDATE column allowlist + UPDATE policy)
await db.exec(read('supabase/migrations/20260920090000_lockdown_profiles_column_grants.sql'));
await db.exec(`
revoke update (daily_views_count, daily_views_reset_at) on public.profiles from authenticated; -- 20260921091500
create policy profiles_select_authenticated on public.profiles for select to authenticated
  using ((auth.uid() = id) or ((coalesce(is_hidden, false) = false) and (deleted_at is null))
    or (exists (select 1 from public.matches m where ((m.user_a_id = auth.uid()) and (m.user_b_id = profiles.id))
      or ((m.user_b_id = auth.uid()) and (m.user_a_id = profiles.id)))));

-- storage (minimal) with the live policies
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
grant all on storage.objects to anon, authenticated, service_role;
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant execute on function storage.foldername(text) to public;
create policy "photos are public" on storage.objects for select to public using (bucket_id = 'user-photos');
create policy "Anyone can view photos" on storage.objects for select to authenticated using (bucket_id = 'user-photos');
create policy "Users can upload their own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'user-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users can upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'user-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete their own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'user-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users can delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'user-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder upload only" on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-selfies' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder delete only" on storage.objects for delete to authenticated
  using (bucket_id = 'verification-selfies' and (storage.foldername(name))[1] = auth.uid()::text);

-- stub RPCs with the live signatures (bodies simplified; P0 wraps them unchanged)
create function public.get_top_matches(p_user_id uuid, p_limit integer default 3)
returns table(user_id uuid, first_name text, date_of_birth date, city text, district text, zodiac_sign text,
  photos text[], match_percentage integer, match_category text, reasons text[], favorite_music text,
  favorite_movie text, favorite_book text, hobbies text[], availability_days text[], drinking text,
  smoking text, education text, education_detail text, morning_night text)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.first_name, p.date_of_birth, p.city, p.district, p.zodiac_sign, p.photos, 70, 'x',
    array['r'], null, null, null, p.hobbies, p.availability_days, p.drinking, p.smoking, p.education,
    p.education_detail, p.morning_night
  from public.profiles p
  where auth.uid() = p_user_id and p.id <> p_user_id and coalesce(p.is_hidden, false) = false
  order by p.first_name limit p_limit $$;
create function public.get_my_likers(p_limit integer)
returns table(total_count bigint, liker_id uuid, first_name text, date_of_birth date, photo_path text,
  target_type text, target_key text, note text, created_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  return query select 1::bigint, p.id, p.first_name, p.date_of_birth, p.photos[1], 'profile'::text,
    null::text, null::text, now() from public.profiles p where p.id = '${B}'::uuid limit p_limit;
end $$;
revoke all on function public.get_top_matches(uuid, integer) from public, anon;
revoke all on function public.get_my_likers(integer) from public, anon;
grant execute on function public.get_top_matches(uuid, integer) to authenticated;
grant execute on function public.get_my_likers(integer) to authenticated;
`);

// synthetic data (as postgres)
const priv = (tag) => `'${SENTINEL}-${tag}'`;
await db.exec(`
insert into public.profiles (id, first_name, last_name, phone_number, date_of_birth, city, gender,
  meeting_preferences, full_address, lat, lng, expo_push_token, photos, setup_completed, is_hidden)
values
 ('${A}', 'Ada', ${priv('ln-a')}, ${priv('ph-a')}, '1996-05-01', 'Istanbul', 'Man', '{Women}', ${priv('ad-a')}, 41.0, 29.0, ${priv('tk-a')}, '{${A}/1.jpg}', true, false),
 ('${B}', 'Bea', ${priv('ln-b')}, ${priv('ph-b')}, '1995-03-02', 'Istanbul', 'Woman', '{Men}', ${priv('ad-b')}, 41.1, 29.1, ${priv('tk-b')}, '{${B}/1.jpg}', true, false),
 ('${H}', 'Hal', ${priv('ln-h')}, ${priv('ph-h')}, '1994-01-03', 'Istanbul', 'Woman', '{Everyone}', null, null, null, null, '{${H}/1.jpg}', true, true),
 ('${X}', 'Xen', ${priv('ln-x')}, ${priv('ph-x')}, '1993-01-04', 'Istanbul', 'Woman', '{Women}', null, null, null, null, '{${X}/1.jpg}', true, true);
insert into public.matches (user_a_id, user_b_id, status) values ('${A}', '${H}', 'accepted');
insert into storage.objects (bucket_id, name) values
 ('user-photos', '${A}/1.jpg'), ('user-photos', '${B}/1.jpg'), ('verification-selfies', '${B}/s.jpg');
`);

const leakB = async () => {
  const r = await as('authenticated', A, `select phone_number, last_name, date_of_birth, full_address, expo_push_token from public.profiles where id = $1`, [B]);
  return r.ok && r.rows.length === 1 && String(r.rows[0].phone_number).startsWith(SENTINEL);
};
const newUserInsertVerified = async () =>
  (await as('authenticated', N, `insert into public.profiles (id, photo_verified, is_premium) values ($1, true, true)`, [N])).ok;
const anonListsPhotos = async () => {
  const r = await as('anon', null, `select name from storage.objects where bucket_id = 'user-photos'`);
  return r.ok && r.rows.length > 0;
};

// ─── Stage 0: baseline reproduces the reported exposure ────────────────────
check(await leakB(), 'baseline: other user CAN read private columns (exposure reproduced)');
check(await anonListsPhotos(), 'baseline: anon CAN list user-photos (exposure reproduced)');
check((await as('authenticated', A, `select name from storage.objects where bucket_id='user-photos' and name like $1`, [`${B}/%`])).rows?.length === 1,
  'baseline: signed-in user CAN list another user\'s photo objects');
{
  const r = await as('authenticated', A, `select date_of_birth from public.get_top_matches($1, 10)`, [A]);
  check(r.ok && r.rows.length > 0 && r.rows[0].date_of_birth, 'baseline: get_top_matches returns full DOB');
}
check(await newUserInsertVerified(), 'baseline: new user CAN insert own row with photo_verified/is_premium (bypass reproduced)');
await db.exec(`delete from public.profiles where id = '${N}'`);

// ─── Stage 1: P0-A ──────────────────────────────────────────────────────────
await db.exec(read('supabase/proposed/20260928130000_p0a_privacy_additive.sql'));

check(denied(await as('authenticated', N, `insert into public.profiles (id, photo_verified) values ($1, true)`, [N])), 'A: insert photo_verified denied');
check(denied(await as('authenticated', N, `insert into public.profiles (id, is_premium) values ($1, true)`, [N])), 'A: insert is_premium denied');
check((await as('authenticated', N, `insert into public.profiles (id, privacy_consent_at) values ($1, now())`, [N])).ok, 'A: register-style insert (id + consent) still works');
check(denied(await as('authenticated', N, `insert into public.profiles (id, first_name) values ($1, 'x')`, [B])), 'A: insert for another id blocked by RLS');
{
  const r = await as('authenticated', N, `update public.profiles set setup_completed = true where id = $1`, [N]);
  check(!r.ok && /setup_incomplete/.test(r.error), 'A: setup_completed without required fields rejected');
  const r2 = await as('authenticated', N, `update public.profiles set first_name='Nia', date_of_birth='2000-01-01', gender='Woman', city='Istanbul', meeting_preferences='{Men}', setup_completed=true where id=$1`, [N]);
  check(r2.ok, 'A: setup_completed with required fields accepted (V1 onboarding end)');
  const r3 = await as('authenticated', N, `update public.profiles set date_of_birth='2015-01-01' where id=$1`, [N]);
  check(r3.ok, 'A: later edits on a completed profile are not blocked by the gate');
  const young = await as('postgres', null, `select 1`);
  void young;
}
check(!(await as('authenticated', N, `update public.profiles set verification_selfie_path = $2 where id = $1`, [N, `${B}/x.jpg`])).ok, 'A: selfie path in someone else\'s folder rejected');
check((await as('authenticated', N, `update public.profiles set verification_selfie_path = $2 where id = $1`, [N, `${N}/x.jpg`])).ok, 'A: selfie path in own folder accepted');
check(denied(await as('authenticated', N, `update public.profiles set photo_verified = true where id = $1`, [N])), 'A: photo_verified still not client-updatable');
check((await as('postgres', null, `update public.profiles set photo_verified = true where id = $1`, [N])).ok, 'A: server/reviewer role can still set photo_verified');
check(denied(await as('authenticated', A, `truncate public.profiles`)), 'A: truncate denied for authenticated');
check(!(await anonListsPhotos()), 'A: anon can no longer list user-photos');
check((await as('authenticated', A, `select name from storage.objects where bucket_id='user-photos'`)).rows.every((o) => o.name.startsWith(A)), 'A: signed-in user lists only own photo objects');
check((await as('authenticated', A, `select name from storage.objects where bucket_id='user-photos' and name like $1`, [`${A}/%`])).rows.length === 1, 'A: owner still lists own photos');
check((await as('authenticated', A, `select name from storage.objects where bucket_id='verification-selfies'`)).rows.length === 0, 'A: nobody lists selfies (unchanged)');
check((await as('authenticated', A, `insert into storage.objects (bucket_id, name) values ('user-photos', $1)`, [`${A}/2.jpg`])).ok, 'A: owner upload to own folder still works');
check(!(await as('authenticated', A, `insert into storage.objects (bucket_id, name) values ('user-photos', $1)`, [`${B}/2.jpg`])).ok, 'A: upload into another folder blocked');
check(await leakB(), 'A (by design): old client path still readable until P0-B — exposure NOT yet closed');
{
  const cards = await as('authenticated', A, `select * from public.profile_cards order by first_name`);
  const names = cards.rows?.map((r) => r.first_name) ?? [];
  const cols = cards.rows?.length ? Object.keys(cards.rows[0]) : [];
  check(cards.ok && names.includes('Bea') && names.includes('Hal') && !names.includes('Xen'), 'A: profile_cards = visible + matched-hidden, not unmatched-hidden');
  const forbidden = ['last_name', 'phone_number', 'date_of_birth', 'full_address', 'lat', 'lng', 'expo_push_token', 'verification_selfie_path', 'meeting_preferences', 'is_premium', 'deleted_at', 'instagram_handle', 'dial_code', 'country_code', 'privacy_consent_at', 'current_step', 'last_active_at'];
  check(forbidden.every((c) => !cols.includes(c)), 'A: profile_cards exposes no private column');
  check(!JSON.stringify(cards.rows).includes(SENTINEL), 'A: no private sentinel value reachable through profile_cards');
  const bea = cards.rows.find((r) => r.first_name === 'Bea');
  check(typeof bea.age === 'number' && bea.age >= 18, 'A: profile_cards gives computed age');
  check(bea.interested_in_viewer === true && cards.rows.find((r) => r.first_name === 'Hal').interested_in_viewer === true, 'A: interested_in_viewer computed without exposing preferences');
  check(denied(await as('anon', null, `select * from public.profile_cards`)), 'A: anon cannot read profile_cards');
}
{
  const r = await as('authenticated', A, `select * from public.get_discovery_cards(10)`);
  check(r.ok && r.rows.length > 0 && 'age' in r.rows[0] && !('date_of_birth' in r.rows[0]), 'A: get_discovery_cards returns age, no DOB');
  const l = await as('authenticated', A, `select * from public.get_my_liker_cards(10)`);
  check(l.ok && l.rows.length === 1 && 'age' in l.rows[0] && !('date_of_birth' in l.rows[0]), 'A: get_my_liker_cards returns age, no DOB');
  check(denied(await as('anon', null, `select * from public.get_discovery_cards(10)`)), 'A: anon cannot call get_discovery_cards');
}

// ─── Stage 2: P0-B ──────────────────────────────────────────────────────────
await db.exec(read('supabase/proposed/20260928130100_p0b_privacy_restrict.sql'));
check(!(await leakB()), 'B: other user can NOT read private columns anymore');
{
  const r = await as('authenticated', A, `select id from public.profiles`);
  check(r.ok && r.rows.length === 1 && r.rows[0].id === A, 'B: profiles returns only the caller\'s own row');
  const own = await as('authenticated', A, `select phone_number, date_of_birth, last_name from public.profiles where id = $1`, [A]);
  check(own.ok && own.rows.length === 1 && String(own.rows[0].phone_number).startsWith(SENTINEL), 'B: owner still reads own private fields (Settings/Profile edit)');
  check(denied(await as('anon', null, `select id from public.profiles`)), 'B: anon has no table access');
  const cards = await as('authenticated', A, `select first_name, age from public.profile_cards where id = $1`, [B]);
  check(cards.ok && cards.rows.length === 1, 'B: other users still displayable via profile_cards');
  check(denied(await as('authenticated', A, `select * from public.get_top_matches($1, 10)`, [A])), 'B: get_top_matches (full DOB) not client-callable');
  check((await as('authenticated', A, `select * from public.get_discovery_cards(10)`)).rows.length > 0, 'B: discovery via wrapper still works');
  check(denied(await as('authenticated', A, `select * from public.get_my_likers(10)`)), 'B: get_my_likers (full DOB) not client-callable');
  check((await as('authenticated', A, `select * from public.get_my_liker_cards(10)`)).rows.length === 1, 'B: likers via wrapper still works');
  const upd = await as('authenticated', A, `update public.profiles set first_name = 'hack' where id = $1 returning id`, [B]);
  check(upd.ok && upd.rows.length === 0, 'B: cannot update another user\'s row');
  check((await as('authenticated', A, `update public.profiles set bio = 'hi' where id = $1 returning id`, [A])).rows?.length === 1, 'B: owner can still edit own profile');
}

// ─── Stage 3: rollbacks restore the previous state ─────────────────────────
await db.exec(read('supabase/proposed/20260928130100_p0b_privacy_restrict.rollback.sql'));
check(await leakB(), 'rollback B: previous read access restored (exposure re-opened as documented)');
check((await as('authenticated', A, `select date_of_birth from public.get_top_matches($1, 10)`, [A])).ok, 'rollback B: get_top_matches callable again');
await db.exec(read('supabase/proposed/20260928130000_p0a_privacy_additive.rollback.sql'));
await db.exec(`delete from public.profiles where id = '${N}'`);
check(await newUserInsertVerified(), 'rollback A: insert grants restored (baseline)');
check(await anonListsPhotos(), 'rollback A: storage policies restored (baseline)');
check((await as('postgres', null, `select to_regclass('public.profile_cards') is null as gone`)).rows[0].gone, 'rollback A: profile_cards removed');

console.log(`P0 privacy (local PGlite): ${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
