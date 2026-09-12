-- Adding date_of_birth so the new "Liked You" grid (Hinge-reference redesign,
-- 2026-09-12) can show "Name, Age" on each card like the reference — the
-- return row shape changes, so DROP+CREATE (same pattern as
-- increment_daily_views, CREATE OR REPLACE refuses a changed return type).
-- Scoring/logic otherwise byte-identical to the previous version.
DROP FUNCTION IF EXISTS public.get_my_likers(integer);

CREATE FUNCTION public.get_my_likers(p_limit integer DEFAULT 50)
 RETURNS TABLE(
   total_count bigint,
   liker_id uuid,
   first_name text,
   date_of_birth date,
   photo_path text,
   target_type text,
   target_key text,
   note text,
   created_at timestamp with time zone
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
        p.date_of_birth,
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
        null::date,
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
$function$;

REVOKE ALL ON FUNCTION public.get_my_likers(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_likers(integer) TO authenticated;
