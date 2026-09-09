-- Mutual-like → instant chat (2026-09-09, product decision after market
-- research: every mainstream dating app treats a mutual like/swipe as
-- "you can now message" — Bumble was the one exception with a gendered
-- post-match gate and killed it in 2025 specifically because ~50% of
-- matches never started a conversation. Home's `likes` table and the
-- algorithmic Matches/"Let's meet" funnel were completely disconnected
-- until now: reciprocal likes produced zero events (no match row, no
-- notification, nothing) — the highest-intent signal in the app was a
-- dead end. This does NOT touch the existing algorithmic invite funnel
-- (try_send_invite/acceptMatchInvite/shouldOpenChatOnAccept) at all — it's
-- new, parallel machinery that happens to terminate at the same `matches`
-- row shape chat.tsx/messages.tsx already read generically. Deliberately
-- does not consume the daily invite quota (that quota exists to ration
-- cold outreach to an algorithmic stranger; mutual consent isn't cold) and
-- does not apply the hetero "woman opens chat" rule (both sides already
-- gave equal, explicit consent).

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'algo_invite';

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_source_check;
ALTER TABLE public.matches
  ADD CONSTRAINT matches_source_check CHECK (source IN ('algo_invite', 'mutual_like'));

CREATE OR REPLACE FUNCTION public.handle_mutual_like()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_match_id uuid;
begin
  -- Only a live like counts (not one already superseded/expired/passed).
  if NEW.status <> 'sent' then
    return NEW;
  end if;

  -- Does the other side already have a live like pointed back at me?
  if not exists (
    select 1 from likes r
    where r.liker_id = NEW.likee_id
      and r.likee_id = NEW.liker_id
      and r.status = 'sent'
  ) then
    return NEW;
  end if;

  -- Elevate (or create) the matches row for this pair straight to an open
  -- chat. idx_matches_unique_pair means at most one matches row can ever
  -- exist per pair regardless of status, so this has to be an upsert, not a
  -- plain insert — an algorithmic candidate that was sitting 'pending' (or
  -- 'passed'/'expired') between these two gets promoted by the mutual like.
  -- The `WHERE chat_opened IS NOT TRUE` guard makes this idempotent: if the
  -- pair is already talking (however that happened), do nothing and skip
  -- the notification/message-seeding below entirely.
  insert into matches (user_a_id, user_b_id, status, match_score, chat_opened, source, expires_at, created_at)
  values (
    least(NEW.liker_id::text, NEW.likee_id::text)::uuid,
    greatest(NEW.liker_id::text, NEW.likee_id::text)::uuid,
    'accepted',
    100,  -- mutual, explicit consent from both sides — the strongest signal this app has, treated as a perfect score
    true,
    'mutual_like',
    now() + interval '24 hours',
    now()
  )
  on conflict (least(user_a_id::text, user_b_id::text), greatest(user_a_id::text, user_b_id::text))
  do update set status = 'accepted', chat_opened = true, source = 'mutual_like'
  where matches.chat_opened is not true
  returning id into v_match_id;

  if v_match_id is null then
    return NEW; -- already open — nothing new happened, don't re-notify/re-seed
  end if;

  -- Link both likes rows to the match they produced.
  update likes
    set status = 'matched', match_id = v_match_id
    where status = 'sent'
      and ((liker_id = NEW.liker_id and likee_id = NEW.likee_id)
        or (liker_id = NEW.likee_id and likee_id = NEW.liker_id));

  -- Seed the chat with whichever side(s) wrote a Note — Hinge's own
  -- mechanic (a contextual like's note becomes the opening message) — so
  -- the thread never opens completely blank. No note on either side: chat
  -- opens empty, chat.tsx's existing icebreaker suggestions cover that.
  insert into messages (sender_id, receiver_id, content, created_at)
  select l.liker_id, l.likee_id, l.note, l.created_at
  from likes l
  where l.match_id = v_match_id
    and l.note is not null
    and length(trim(l.note)) > 0
  order by l.created_at asc;

  insert into notifications (user_id, type, text, related_user_id)
  values
    (NEW.liker_id, 'mutual_match', 'Eşleştiniz! Sohbet açıldı 💛', NEW.likee_id),
    (NEW.likee_id, 'mutual_match', 'Eşleştiniz! Sohbet açıldı 💛', NEW.liker_id);

  return NEW;
end;
$function$;

DROP TRIGGER IF EXISTS trg_handle_mutual_like ON public.likes;
CREATE TRIGGER trg_handle_mutual_like
  AFTER INSERT OR UPDATE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_mutual_like();

-- Trigger-only function, same reasoning as auto_hide_after_reports /
-- handle_match_notification (2026-09-08 security pass): no legitimate
-- direct-call use case, trigger firing isn't subject to EXECUTE ACL checks.
REVOKE EXECUTE ON FUNCTION public.handle_mutual_like() FROM PUBLIC, anon, authenticated;
