-- Buzz Faz B: "seni kim beğendi" — premium-gated okuma yolu.
-- `likes` tablosunda likee-select RLS policy'si BİLİNÇLİ olarak yok (bkz. 20260816120000_create_likes.sql
-- yorumu) — kimlik/not sızıntısını önlemek için tek okuma yolu bu SECURITY DEFINER RPC.
-- Çağıran kullanıcı HER ZAMAN auth.uid() üzerinden bağlanır (parametre olarak user id ALINMAZ — sahtecilik riski).
--
-- status='sent' filtresi: 'matched'/'passed'/'expired' olan beğeniler zaten funnel'ın ilerisinde
-- (eşleşmiş) ya da bitmiş (geçilmiş/süresi dolmuş) — "seni kim beğendi, henüz karşılık vermedin" teaser'ı
-- için anlamsızlar, bu yüzden hariç tutuluyor.
--
-- Premium olmayan çağıran: sadece total_count + created_at alır (blur-strip'in tile sayısını beslemeye
-- yeter), liker_id/first_name/photo_path/target_type/target_key/note hepsi NULL döner — kimlik SIZMAZ.
-- Premium çağıran: tüm kolonlar dolu döner (liker_id, first_name, photo_path, target_type, target_key, note).
--
-- total_count her satırda tekrarlanır (window count) — client ilk satırdan okuyabilir; hiç satır yoksa
-- (0 beğeni) count de örtük olarak 0'dır.
create or replace function public.get_my_likers(p_limit integer default 50)
returns table (
  total_count bigint,
  liker_id    uuid,
  first_name  text,
  photo_path  text,
  target_type text,
  target_key  text,
  note        text,
  created_at  timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_is_premium boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select coalesce(p.is_premium, false)
    into v_is_premium
    from public.profiles p
    where p.id = v_uid;

  v_is_premium := coalesce(v_is_premium, false);

  if v_is_premium then
    return query
      select
        cnt.total_count,
        l.liker_id,
        p.first_name,
        p.photos[1] as photo_path,
        l.target_type,
        l.target_key,
        l.note,
        l.created_at
      from public.likes l
      join public.profiles p on p.id = l.liker_id
      cross join lateral (
        select count(*)::bigint as total_count
        from public.likes l2
        where l2.likee_id = v_uid and l2.status = 'sent'
      ) cnt
      where l.likee_id = v_uid and l.status = 'sent'
      order by l.created_at desc
      limit greatest(p_limit, 0);
  else
    return query
      select
        cnt.total_count,
        null::uuid,
        null::text,
        null::text,
        null::text,
        null::text,
        null::text,
        l.created_at
      from public.likes l
      cross join lateral (
        select count(*)::bigint as total_count
        from public.likes l2
        where l2.likee_id = v_uid and l2.status = 'sent'
      ) cnt
      where l.likee_id = v_uid and l.status = 'sent'
      order by l.created_at desc
      limit least(greatest(p_limit, 0), 3);
  end if;
end;
$$;

revoke all on function public.get_my_likers(integer) from public;
grant execute on function public.get_my_likers(integer) to authenticated;
