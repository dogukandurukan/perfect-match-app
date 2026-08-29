import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Single-market MVP (Istanbul only, CLAUDE.md §4) — hardcoded UTC+3, no DST
// handling needed for Turkey since 2016.
const IST_OFFSET_MS = 3 * 60 * 60 * 1000;

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

type MatchRow = {
  id: string;
  user_a_id: string;
  user_b_id: string;
  meeting_at: string;
  confirmed_place: string | null;
};

// Sends the push + writes the `notifications` row for both sides of a match.
// Shared by both stages below — only the notification `type`/copy differ.
async function notifyBothSides(
  match: MatchRow,
  type: string,
  pushTitle: string,
  bodyFor: (otherName: string, place: string) => string,
  dataType: string,
) {
  const [userAResult, userBResult] = await Promise.all([
    supabase.from('profiles').select('first_name, expo_push_token').eq('id', match.user_a_id).single(),
    supabase.from('profiles').select('first_name, expo_push_token').eq('id', match.user_b_id).single(),
  ]);
  const userA = userAResult.data;
  const userB = userBResult.data;
  const place = match.confirmed_place ? ' (' + match.confirmed_place + ')' : '';

  let sent = 0;

  if (userA) {
    const otherName = userB && userB.first_name ? userB.first_name : 'Biri';
    await supabase.from('notifications').insert({
      user_id: match.user_a_id,
      type: type,
      text: bodyFor(otherName, place),
      related_user_id: match.user_b_id,
      is_read: false,
    });
    if (userA.expo_push_token) {
      await sendPushNotification(userA.expo_push_token, pushTitle, bodyFor(otherName, place), {
        type: dataType,
        matchId: match.id,
        matchName: otherName,
        isUserA: '1',
      });
      sent += 1;
    }
  }

  if (userB) {
    const otherName = userA && userA.first_name ? userA.first_name : 'Biri';
    await supabase.from('notifications').insert({
      user_id: match.user_b_id,
      type: type,
      text: bodyFor(otherName, place),
      related_user_id: match.user_a_id,
      is_read: false,
    });
    if (userB.expo_push_token) {
      await sendPushNotification(userB.expo_push_token, pushTitle, bodyFor(otherName, place), {
        type: dataType,
        matchId: match.id,
        matchName: otherName,
        isUserA: '0',
      });
      sent += 1;
    }
  }

  return sent;
}

// Called hourly by pg_cron (not a table webhook — no record/old_record here,
// it queries for itself). Two independent stages, both gated by their own
// *_sent_at column so each fires at most once per match (CLAUDE.md §4
// "gün-içi buluşma hatırlatma bildirimi", 2026-08-29):
//
// Stage 1 — morning, future-tense ("are you meeting today?"): only sent
// between 08:00-11:00 Istanbul time for matches meeting later today. Purely
// a heads-up/confirmation — writes nothing to matches beyond the sent-gate,
// the Buzz card's Yes/No is just an acknowledgement (2026-08-29).
//
// Stage 2 — after the fact, past-tense ("did you go?"): fires once meeting_at
// has passed (any hourly tick after — the 24h lookback is a safety net for a
// missed tick, not the intended delay). This is the original single-stage
// version (2026-08-27); its copy was past-tense-corrected here too — it used
// to say "Gidecek misin?" (future tense) even after the meetup had already
// happened, same class of bug the whole two-stage split exists to avoid.
Deno.serve(async (_req) => {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const istHour = istNow.getUTCHours();

  const istMidnight = new Date(
    Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), 0, 0, 0),
  );
  const todayStartUtc = new Date(istMidnight.getTime() - IST_OFFSET_MS);
  const todayEndUtc = new Date(todayStartUtc.getTime() + 24 * 60 * 60 * 1000);

  let totalSent = 0;
  let morningCount = 0;
  let afterCount = 0;

  // Stage 1 — only run the query during the morning window so it can't fire
  // at 2am for a match happening later that day.
  if (istHour >= 8 && istHour < 11) {
    const { data: morningMatches, error: morningError } = await supabase
      .from('matches')
      .select('id, user_a_id, user_b_id, meeting_at, confirmed_place')
      .not('meeting_at', 'is', null)
      .is('meetup_morning_reminder_sent_at', null)
      .gte('meeting_at', todayStartUtc.toISOString())
      .lt('meeting_at', todayEndUtc.toISOString());

    if (morningError) {
      return new Response(JSON.stringify({ error: morningError.message }), { status: 500 });
    }

    for (const match of morningMatches ?? []) {
      const sent = await notifyBothSides(
        match,
        'meetup_reminder_morning',
        'Bugün buluşma günün! ☀️',
        (otherName, place) => otherName + ' ile bugün buluşuyor musun' + place + '?',
        'meetup_reminder_morning',
      );
      totalSent += sent;
      morningCount += 1;
      await supabase
        .from('matches')
        .update({ meetup_morning_reminder_sent_at: new Date().toISOString() })
        .eq('id', match.id);
    }
  }

  // Stage 2 — after meeting_at has passed.
  const { data: afterMatches, error: afterError } = await supabase
    .from('matches')
    .select('id, user_a_id, user_b_id, meeting_at, confirmed_place')
    .not('meeting_at', 'is', null)
    .is('meetup_reminder_sent_at', null)
    .lte('meeting_at', now.toISOString())
    .gte('meeting_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());

  if (afterError) {
    return new Response(JSON.stringify({ error: afterError.message }), { status: 500 });
  }

  for (const match of afterMatches ?? []) {
    const sent = await notifyBothSides(
      match,
      'meetup_reminder',
      'Buluşman nasıl geçti? ☕',
      (otherName, place) => otherName + ' ile bugün buluştun mu' + place + '?',
      'meetup_reminder',
    );
    totalSent += sent;
    afterCount += 1;
    await supabase
      .from('matches')
      .update({ meetup_reminder_sent_at: new Date().toISOString() })
      .eq('id', match.id);
  }

  return new Response(
    JSON.stringify({ morningMatches: morningCount, afterMatches: afterCount, sent: totalSent }),
    { status: 200 },
  );
});
