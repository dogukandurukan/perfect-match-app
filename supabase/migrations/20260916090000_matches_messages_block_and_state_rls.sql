-- Security fix (2026-09-16 audit).
--
-- Found: matches/messages RLS never checked the `blocks` table anywhere
-- outside get_top_matches' discovery filtering. A direct REST call to
-- /rest/v1/matches or /rest/v1/messages (bypassing the app's invite/accept
-- flow entirely) could:
--   1. INSERT or UPDATE a `matches` row against ANY other profile —
--      including someone who has blocked you — with status='accepted' and
--      chat_opened=true set directly, skipping the whole invite/consent
--      funnel and daily invite limits.
--   2. Once a chat is open, keep sending messages to someone who has since
--      blocked you. This is not just a REST exploit: chat.tsx has zero
--      block-awareness, so this was real, current, reachable-by-normal-app-
--      usage behavior — blocking someone you already had an open chat with
--      did nothing to actually stop them from messaging you.
--
-- Fix scope (deliberately RLS-only, no client changes): a brand-new matches
-- row may only ever be inserted in its normal starting state (pending, chat
-- closed), and blocked pairs can no longer create/advance a matches row or
-- exchange messages. This does NOT model the full invite/accept state
-- machine (e.g. "only the non-inviter may accept" is still unenforced at
-- the DB layer) — that's a larger piece of work (moving matches writes
-- behind SECURITY DEFINER RPCs, like try_send_invite already does)
-- deliberately deferred to before store submission, tracked in CLAUDE.md.

create or replace function public.pair_is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

drop policy if exists "matches_insert_own" on matches;
create policy "matches_insert_own" on matches
  for insert
  with check (
    (auth.uid() = user_a_id or auth.uid() = user_b_id)
    and status = 'pending'
    and chat_opened is not true
    and not public.pair_is_blocked(user_a_id, user_b_id)
  );

-- Consolidates the two previously-duplicate UPDATE policies
-- (matches_update_policy + "users can update own matches" — functionally
-- identical, confirmed harmless but redundant) into one, plus the new
-- block check.
drop policy if exists "matches_update_policy" on matches;
drop policy if exists "users can update own matches" on matches;
create policy "matches_update_own" on matches
  for update
  using (
    (auth.uid() = user_a_id or auth.uid() = user_b_id)
    and not public.pair_is_blocked(user_a_id, user_b_id)
  )
  with check (
    auth.uid() = user_a_id or auth.uid() = user_b_id
  );

drop policy if exists "messages_insert_policy" on messages;
create policy "messages_insert_policy" on messages
  for insert
  with check (
    auth.uid() = sender_id
    and not public.pair_is_blocked(sender_id, receiver_id)
    and exists (
      select 1 from matches
      where status = 'accepted'
        and ((user_a_id = auth.uid() and user_b_id = messages.receiver_id)
          or (user_b_id = auth.uid() and user_a_id = messages.receiver_id))
    )
  );
