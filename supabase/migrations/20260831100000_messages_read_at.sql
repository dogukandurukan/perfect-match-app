-- Fix (2026-08-31, codebase audit): the Chats tab unread badge was a pure
-- heuristic ("was the last message in this thread sent TO me") — reading a
-- conversation without replying left it "unread" forever. Real read tracking:
-- receiver marks messages read when the chat screen displays them.
alter table public.messages add column if not exists read_at timestamptz;
