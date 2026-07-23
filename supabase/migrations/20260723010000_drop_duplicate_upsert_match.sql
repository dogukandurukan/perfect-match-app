-- upsert_match iki sürümde tanımlıydı: (uuid,uuid) ve (uuid,uuid,numeric DEFAULT 0).
-- PostgREST'te "could not choose the best candidate function" riski.
-- Tek çağrı noktası (lib/matchInvite.ts:106) 3 argüman gönderiyor → 2'li sürüm gereksiz.
drop function if exists public.upsert_match(uuid, uuid);
