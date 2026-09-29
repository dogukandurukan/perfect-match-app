-- P0-B EMERGENCY REOPEN — NOT A ROLLBACK YOU SHOULD RUN BY DEFAULT.
-- This re-exposes every signed-in user's private columns (DOB, phone,
-- address, lat/lng, district, push token, selfie path …) to every other
-- signed-in user, exactly as before P0-B. The intended recovery for a broken
-- release is FIX-FORWARD: ship a client hotfix that reads profile_cards / the
-- wrappers, or disable the affected screen (plan §5.3). Run this only with an
-- explicit, written owner decision that accepts the exposure, and re-apply
-- P0-B as soon as the hotfix is out.
begin;
drop policy if exists profiles_select_own on public.profiles;
create policy "Users can view own profile" on public.profiles for select to public
  using (auth.uid() = id);
create policy profiles_select_authenticated on public.profiles for select to authenticated
  using ((auth.uid() = id)
    or ((coalesce(is_hidden, false) = false) and (deleted_at is null))
    or (exists (select 1 from public.matches m
                where ((m.user_a_id = auth.uid()) and (m.user_b_id = profiles.id))
                   or ((m.user_b_id = auth.uid()) and (m.user_a_id = profiles.id)))));
grant execute on function public.get_top_matches(uuid, integer) to authenticated;
grant execute on function public.get_my_likers(integer) to authenticated;
commit;
