// Real account deletion (2026-09-15) — the previous flow (softDeleteAccount
// in lib/profileSettings.ts) only set profiles.deleted_at/is_hidden and
// signed out; the auth.users identity and all personal data stayed in the
// DB untouched, just hidden from discovery. That's a deactivation, not a
// deletion — doesn't satisfy Apple's "must actually delete the account, not
// merely deactivate it" review requirement, and is weak on KVKK's right to
// erasure. This function does the real thing:
//   1. Verify the caller's own JWT (never trust a client-supplied user id —
//      you can only ever delete yourself).
//   2. Remove their Storage objects (photos + verification selfie all live
//      under `{userId}/` in the user-photos bucket).
//   3. Delete the `profiles` row — cascades to blocks/likes/matches/
//      messages/notifications/onboarding_answers/reports/events (all FK'd
//      to profiles with ON DELETE CASCADE, verified against pg_constraint
//      before writing this).
//   4. Delete the actual `auth.users` row via the admin API. Must happen
//      AFTER step 3 — profiles.id -> auth.users(id) has no cascade, so
//      deleting auth.users first would fail on the still-present profiles
//      row.
// Deliberately immediate/irreversible, no grace period — Apple allows
// either, a grace period needs a scheduled follow-up job for no real
// benefit at this stage.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify identity using the caller's own JWT — this is the only source
    // of truth for "who is being deleted", never a request body field.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const userId = user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: files, error: listError } = await admin.storage.from('user-photos').list(userId);
    if (listError) {
      console.error('delete-account: storage list failed', listError);
    } else if (files && files.length > 0) {
      const paths = files.map((f) => `${userId}/${f.name}`);
      const { error: removeError } = await admin.storage.from('user-photos').remove(paths);
      if (removeError) console.error('delete-account: storage remove failed', removeError);
    }

    const { error: profileError } = await admin.from('profiles').delete().eq('id', userId);
    if (profileError) {
      console.error('delete-account: profiles delete failed', profileError);
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error('delete-account: auth user delete failed', authDeleteError);
      return new Response(JSON.stringify({ error: authDeleteError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('delete-account: unexpected error', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
