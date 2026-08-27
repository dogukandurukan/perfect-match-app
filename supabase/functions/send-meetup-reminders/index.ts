import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>
) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: token,
      title: title,
      body: body,
      sound: 'default',
      data: data,
    }),
  });
}

// Called hourly by a pg_cron job (not a table webhook — no record/old_record
// here, it queries for itself). Reminds both sides of a confirmed match once
// its meeting_at has actually passed — the copy ("did you go?") is past-tense,
// so firing it before the meetup happened (e.g. a fixed 6am run for a match
// scheduled that evening) reads as nonsensical (found via device testing,
// 2026-08-27). meetup_reminder_sent_at gates re-sends; the 24h lookback is
// just a safety net for a missed cron tick, not the intended normal delay.
// Writes a `notifications` row for each side too (type='meetup_reminder') so
// it's still actionable from Buzz (✓/✕ → checkin) even if the push is missed,
// dismissed, or the recipient has no push token yet.
Deno.serve(async (_req) => {
  const now = new Date();
  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, user_a_id, user_b_id, meeting_at, confirmed_place')
    .not('meeting_at', 'is', null)
    .is('meetup_reminder_sent_at', null)
    .lte('meeting_at', now.toISOString())
    .gte('meeting_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());

  if (error || !matches) {
    return new Response(JSON.stringify({ error: error?.message ?? 'query failed' }), { status: 500 });
  }

  let sent = 0;

  for (const match of matches) {
    const userAResult = await supabase
      .from('profiles')
      .select('first_name, expo_push_token')
      .eq('id', match.user_a_id)
      .single();
    const userA = userAResult.data;

    const userBResult = await supabase
      .from('profiles')
      .select('first_name, expo_push_token')
      .eq('id', match.user_b_id)
      .single();
    const userB = userBResult.data;

    const place = match.confirmed_place ? ' (' + match.confirmed_place + ')' : '';

    if (userA) {
      const otherName = userB && userB.first_name ? userB.first_name : 'Biri';
      await supabase.from('notifications').insert({
        user_id: match.user_a_id,
        type: 'meetup_reminder',
        text: 'Bugün ' + otherName + ' ile buluşuyorsun.',
        related_user_id: match.user_b_id,
        is_read: false,
      });
      if (userA.expo_push_token) {
        await sendPushNotification(
          userA.expo_push_token,
          'Bugün buluşma günün! ☕',
          otherName + ' ile bugün buluşuyorsun' + place + '. Gidecek misin?',
          { type: 'meetup_reminder', matchId: match.id, matchName: otherName, isUserA: '1' }
        );
        sent = sent + 1;
      }
    }

    if (userB) {
      const otherName = userA && userA.first_name ? userA.first_name : 'Biri';
      await supabase.from('notifications').insert({
        user_id: match.user_b_id,
        type: 'meetup_reminder',
        text: 'Bugün ' + otherName + ' ile buluşuyorsun.',
        related_user_id: match.user_a_id,
        is_read: false,
      });
      if (userB.expo_push_token) {
        await sendPushNotification(
          userB.expo_push_token,
          'Bugün buluşma günün! ☕',
          otherName + ' ile bugün buluşuyorsun' + place + '. Gidecek misin?',
          { type: 'meetup_reminder', matchId: match.id, matchName: otherName, isUserA: '0' }
        );
        sent = sent + 1;
      }
    }

    await supabase
      .from('matches')
      .update({ meetup_reminder_sent_at: new Date().toISOString() })
      .eq('id', match.id);
  }

  return new Response(JSON.stringify({ matches: matches.length, sent: sent }), { status: 200 });
});
