import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function sendPushNotification(token: string, title: string, body: string) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: token,
      title: title,
      body: body,
      sound: 'default',
      data: {},
    }),
  });
}

function otherUserId(record: { user_a_id: string; user_b_id: string }, knownUserId: string): string {
  if (record.user_a_id === knownUserId) {
    return record.user_b_id;
  }
  return record.user_a_id;
}

// matches rows get created liberally just from Home's discovery-card
// generation (invited_by null) — an INSERT is NOT "someone invited you",
// so (unlike the old version of this function) there is no INSERT handler
// here at all. Only two real signals exist in the current app
// (lib/matchInvite.ts): invited_by newly set (an invite was actually sent),
// and chat_opened flipping false->true on an update that did NOT just set
// invited_by (the invitee accepted). 2026-08-26 rewrite — CLAUDE.md §4.
Deno.serve(async (req) => {
  const body = await req.json();
  const record = body.record;
  const old_record = body.old_record;
  const type = body.type;

  if (type !== 'UPDATE') {
    return new Response('ok', { status: 200 });
  }

  const inviteJustSent = record.invited_by && record.invited_by !== old_record?.invited_by;

  if (inviteJustSent) {
    const recipientId = otherUserId(record, record.invited_by);

    const recipientResult = await supabase
      .from('profiles')
      .select('first_name, expo_push_token')
      .eq('id', recipientId)
      .single();
    const recipient = recipientResult.data;

    const inviterResult = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', record.invited_by)
      .single();
    const inviter = inviterResult.data;

    if (recipient && recipient.expo_push_token) {
      const name = inviter && inviter.first_name ? inviter.first_name : 'Biri';
      // match_score comes through the webhook JSON as a numeric-looking
      // string (Postgres `numeric` type), not a JS number — parseFloat it.
      const scoreNum = record.match_score !== null && record.match_score !== undefined
        ? parseFloat(record.match_score)
        : NaN;
      let messageBody = name + ' seni buluşmaya davet etti. Kaçırma ☕';
      if (!isNaN(scoreNum)) {
        messageBody = name + ' seni buluşmaya davet etti — %' + Math.round(scoreNum) + ' uyum! Kaçırma ☕';
      }
      await sendPushNotification(recipient.expo_push_token, name + ' seni bekliyor 👋', messageBody);
    }
    return new Response('ok', { status: 200 });
  }

  const chatJustOpened = record.chat_opened && !old_record?.chat_opened;

  if (chatJustOpened) {
    const inviterResult = await supabase
      .from('profiles')
      .select('first_name, expo_push_token')
      .eq('id', record.invited_by)
      .single();
    const inviter = inviterResult.data;

    const accepterId = otherUserId(record, record.invited_by);
    const accepterResult = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', accepterId)
      .single();
    const accepter = accepterResult.data;

    if (inviter && inviter.expo_push_token) {
      const name = accepter && accepter.first_name ? accepter.first_name : 'Biri';
      await sendPushNotification(
        inviter.expo_push_token,
        name + ' seni bekliyor olacak! 🎉',
        name + ' buluşma davetini kabul etti — sohbet açıldı, saati netleştirin.'
      );
    }
    return new Response('ok', { status: 200 });
  }

  return new Response('ok', { status: 200 });
});
