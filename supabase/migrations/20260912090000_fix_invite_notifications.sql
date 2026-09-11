-- Found 2026-09-11 while manually seeding a demo invite to show a user what
-- "someone invited you" looks like: the "new_invite"/"invite_accepted"
-- Buzz featured-card notifications were NEVER actually created by any real
-- code path. The only trigger that claimed to write them
-- (handle_match_notification) checked `user_a_accepted`/`user_b_accepted`
-- transitioning false->true — columns that NOTHING in the current codebase
-- writes (confirmed via grep across app/ and lib/). The real invite flow
-- (lib/matchInvite.ts sendMatchInvite/acceptMatchInvite) uses `invited_by`
-- and `chat_opened` instead, exactly like the push-notification edge
-- function (supabase/functions/send-push-notification/index.ts) already
-- correctly does. So: a real invite reached the recipient's Matches tab
-- ("Invites for you") and their phone (push), but never showed a Buzz card
-- — only manually-seeded test data ever exercised that UI.
--
-- Fix: rewrite the two dead branches to key off invited_by/chat_opened,
-- mirroring the edge function's own logic (and its precedence — an invite
-- that auto-opens chat immediately, i.e. a woman inviting a man, fires only
-- "new_invite", not also "invite_accepted", by returning early). The
-- 'new_match' branch (still filtered out of the UI via LIKE_TYPES, low
-- priority separate cleanup) is untouched. The accepted-branch is guarded
-- to algo_invite only — mutual-like already writes its own 'mutual_match'
-- notification in handle_mutual_like(), so this must not double-fire for it.
CREATE OR REPLACE FUNCTION public.handle_match_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_recipient uuid;
  v_accepter uuid;
BEGIN
  -- Yeni eşleşme (insert, pending) — Home/Matches'in arka planda ürettiği
  -- keşif kartları dahil; bu satır Buzz'da zaten LIKE_TYPES ile gizleniyor.
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    INSERT INTO notifications (user_id, type, text, related_user_id)
    VALUES (NEW.user_b_id, 'new_match', 'Yeni bir eşleşmen var! ✨', NEW.user_a_id);
  END IF;

  -- Davet gönderildi: invited_by bu yazımda yeni set edildi (mutual-like
  -- invited_by'ı hiç set etmiyor, otomatik olarak hariç kalıyor).
  IF NEW.invited_by IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.invited_by IS DISTINCT FROM OLD.invited_by) THEN
    v_recipient := CASE WHEN NEW.invited_by = NEW.user_a_id THEN NEW.user_b_id ELSE NEW.user_a_id END;
    INSERT INTO notifications (user_id, type, text, related_user_id)
    VALUES (v_recipient, 'new_invite', 'Seni buluşmaya davet etti! ☕', NEW.invited_by);
    RETURN NEW; -- aynı yazımda hem "davet gönderildi" hem "kabul edildi" olamaz
  END IF;

  -- Davet kabul edildi: chat_opened bu yazımda false/null'dan true'ya geçti
  -- VE invited_by bu yazımda YENİ set edilmedi (yukarıda ele alındı — o
  -- durumda kadın-davet-eder kuralı chat'i anında açar, bu ayrı bir "kabul"
  -- olayı değildir) VE mutual-like değil (o kendi bildirimini zaten yazdı).
  IF TG_OP = 'UPDATE'
     AND NEW.chat_opened IS TRUE
     AND COALESCE(OLD.chat_opened, false) IS NOT TRUE
     AND NEW.source = 'algo_invite'
     AND NEW.invited_by IS NOT NULL THEN
    v_accepter := CASE WHEN NEW.invited_by = NEW.user_a_id THEN NEW.user_b_id ELSE NEW.user_a_id END;
    INSERT INTO notifications (user_id, type, text, related_user_id)
    VALUES (NEW.invited_by, 'invite_accepted', 'Buluşma isteğin kabul edildi! 🎉', v_accepter);
  END IF;

  RETURN NEW;
END;
$function$;
