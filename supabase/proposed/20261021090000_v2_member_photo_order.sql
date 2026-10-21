-- V2: an approved, active member may reorder their OWN existing profile photos
-- and choose the main photo (owner decision 2026-10-21, a narrow exception to
-- D90). LOCAL (tempa-local) first; not wired into apply-dev.mjs.
--
-- reorder_member_photos_v2(p_ids uuid[], p_expected uuid[])
--   • caller: an active V2 member (v2_assert_member_profile_edit) — drafts,
--     pending, rejected, suspended and signed-out callers are refused;
--   • only the ORDER changes: no insert, delete, file / path change, review or
--     approval change. Photo ids stay the same, so likes that target a photo
--     (likes.target_key = photo id) keep their target;
--   • p_ids must be exactly the caller's current photo set (no missing, extra,
--     duplicate or foreign id) → else 'photo_set_mismatch';
--   • p_expected is the order the client saw; if the server order differs
--     (changed on another device / screen) → 'photos_changed', nothing written
--     (never a silent overwrite);
--   • atomic: the caller's account_state_v2 row is locked first (the same lock
--     the applicant reorder uses), all positions change in one statement (the
--     (user_id, position) unique constraint is DEFERRABLE INITIALLY DEFERRED);
--   • keeps the denormalised copy profiles.photos (written at acceptance by
--     review_application_v2, read by older screens such as the chat header) in
--     the new order.
-- The applicant path (reorder_profile_photos_v2, v2_assert_editable) and the
-- general application lock are unchanged.

create or replace function public.reorder_member_photos_v2(p_ids uuid[], p_expected uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := public.v2_assert_member_profile_edit();
  v_current uuid[];
begin
  if p_ids is null or p_expected is null then raise exception 'photo_set_mismatch' using errcode = '22023'; end if;
  perform 1 from account_state_v2 where user_id = v_uid for update;
  select coalesce(array_agg(id order by position), '{}') into v_current from profile_photos_v2 where user_id = v_uid;
  if v_current is distinct from p_expected then
    raise exception 'photos_changed' using errcode = '40001',
      hint = 'the photos changed since they were loaded; reload and try again';
  end if;
  if cardinality(p_ids) <> cardinality(v_current)
     or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) x)
     or (select array_agg(x order by x) from unnest(p_ids) x) is distinct from (select array_agg(x order by x) from unnest(v_current) x) then
    raise exception 'photo_set_mismatch' using errcode = '22023';
  end if;
  if p_ids = v_current then
    return jsonb_build_object('ok', true, 'changed', false, 'main_path', public.v2_main_photo(v_uid));
  end if;
  update profile_photos_v2 f set position = x.ord
  from unnest(p_ids) with ordinality as x(id, ord)
  where f.id = x.id and f.user_id = v_uid;
  update profiles set photos = (select array_agg(f.storage_path order by f.position) from profile_photos_v2 f where f.user_id = v_uid)
  where id = v_uid;
  return jsonb_build_object('ok', true, 'changed', true, 'main_path', public.v2_main_photo(v_uid));
end;
$$;

revoke all on function public.reorder_member_photos_v2(uuid[], uuid[]) from public, anon;
grant execute on function public.reorder_member_photos_v2(uuid[], uuid[]) to authenticated;
