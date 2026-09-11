-- Log mutual_match as an analytics event for both sides. This trigger is
-- the ONLY place a mutual match happens (no client action fires exactly
-- once), so it's a more reliable instrumentation point than anything in
-- chat.tsx/notifications.tsx. Body otherwise byte-identical to
-- 20260909090000_mutual_like_opens_chat.sql — only the two logEvent-style
-- inserts before `return NEW` are new.
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

  insert into events (user_id, name, properties)
  values
    (NEW.liker_id, 'mutual_match', jsonb_build_object('match_id', v_match_id)),
    (NEW.likee_id, 'mutual_match', jsonb_build_object('match_id', v_match_id));

  return NEW;
end;
$function$;
