-- Cleanup (2026-09-01): send_like() is genuinely dead — no trigger calls it,
-- no client code calls it (grepped), and it references likes.liked_id, a
-- column from the OLD likes schema dropped on 2026-08-16 (current schema
-- uses likee_id) — it would error if anyone tried to call it today.
-- Confirmed the other 4 "suspect" functions (handle_match_notification,
-- handle_mutual_accept, update_match_status, update_updated_at) ARE live,
-- trigger-wired, and left alone — only this one was actually orphaned.
drop function if exists public.send_like(uuid, numeric);
