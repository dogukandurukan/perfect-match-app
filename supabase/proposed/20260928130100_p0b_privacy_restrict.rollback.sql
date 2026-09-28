-- Rollback for P0-B. Restores the pre-P0 read access exactly (re-opens the
-- privacy exposure — use only to recover a broken release, then re-apply).
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
grant select, insert, update, delete, truncate, references, trigger on public.profiles to anon;
grant execute on function public.get_top_matches(uuid, integer) to authenticated;
grant execute on function public.get_my_likers(integer) to authenticated;
commit;
