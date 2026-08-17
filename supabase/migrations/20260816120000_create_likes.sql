-- Contextual likes (Bumble-style): Home bottom ❤ (target_type='profile') + foto/prompt "Note"
-- (target_type='photo'|'prompt' + opsiyonel note). Home ön-sinyalini + Buzz Faz B "seni kim
-- beğendi (+ hangi fotona ne yazdı)" ekranını AYNI tablo besler. Dondurulmuş şema — CLAUDE.md §3/§5.
create table if not exists public.likes (
  id          uuid primary key default gen_random_uuid(),
  liker_id    uuid not null references public.profiles(id) on delete cascade,
  likee_id    uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('photo', 'prompt', 'profile')),
  target_key  text,                                   -- foto index/path VEYA prompt id; 'profile' iken null
  note        text check (char_length(note) <= 240),  -- opsiyonel; not yazmak ÜCRETSİZ, görmek premium
  status      text not null default 'sent' check (status in ('sent', 'matched', 'passed', 'expired')),
  match_id    uuid references public.matches(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (liker_id, likee_id)                         -- MVP: kişi başına tek hedefli beğeni (upsert ile güncellenir)
);

create index if not exists likes_likee_idx on public.likes (likee_id);

alter table public.likes enable row level security;

-- Liker kendi satırını yönetir (insert + upsert-update + geri-okuma).
-- Likee-okuma BİLİNÇLİ olarak yok: Buzz Faz B'de premium-gated SECURITY DEFINER RPC ile gelecek
-- (count her zaman, note/target/kimlik yalnız premium) — böylece not/hedef premium olmadan sızmaz.
create policy likes_insert_own on public.likes
  for insert to authenticated
  with check (auth.uid() = liker_id);

create policy likes_select_own on public.likes
  for select to authenticated
  using (auth.uid() = liker_id);

create policy likes_update_own on public.likes
  for update to authenticated
  using (auth.uid() = liker_id)
  with check (auth.uid() = liker_id);
