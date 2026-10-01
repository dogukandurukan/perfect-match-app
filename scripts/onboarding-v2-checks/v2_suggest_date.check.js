// "Suggest a date" form helpers (dateSuggestions.ts): user-picked day + time,
// local time → UTC, no past times, "Decide together" when no place.
const { ok, eq, lib, done } = require('./_setup');
const S = lib('dateSuggestions.ts');

const now = new Date(2026, 9, 1, 18, 0, 0); // Thu 1 Oct 2026, 18:00 local
const days = S.upcomingDays(now);
ok(days.length === 14 && eq(days[0], { y: 2026, mo: 9, d: 1 }) && eq(days[13], { y: 2026, mo: 9, d: 14 }), '14 days from today');
ok(eq(S.dayLabel(days[0], now), { top: 'Today', bottom: '1 Oct' }) && S.dayLabel(days[1], now).top === 'Tomorrow'
  && eq(S.dayLabel(days[3], now), { top: 'Sun', bottom: '4 Oct' }), 'short day labels');
const iso = S.combineLocal(days[3], { h: 19, m: 30 });
const back = new Date(iso);
ok(/Z$/.test(iso) && back.getDate() === 4 && back.getHours() === 19 && back.getMinutes() === 30, 'local day + time → UTC ISO, round-trips to the same local time');
ok(!S.timeAvailableOn(days[0], { h: 15, m: 0 }, now) && !S.timeAvailableOn(days[0], { h: 18, m: 0 }, now)
  && S.timeAvailableOn(days[0], { h: 19, m: 30 }, now), 'past (and too-near) times today are not available');
ok(S.TIME_CHOICES.every((t) => S.timeAvailableOn(days[1], t, now)), 'all times available tomorrow');
ok(!S.isSendableTime(null, now) && !S.isSendableTime(new Date(now.getTime() + 60000).toISOString(), now)
  && S.isSendableTime(new Date(now.getTime() + 3600e3).toISOString(), now), 'send needs ≥ 5 minutes ahead');
ok(S.suggestionSummary(days[3], { h: 19, m: 30 }, '  ') === 'Sun 4 Oct · 19:30 · Decide together', 'empty place → "Decide together"');
ok(S.suggestionSummary(days[3], { h: 9, m: 5 }, 'Moda') === 'Sun 4 Oct · 09:05 · Moda', 'summary with place');
ok(S.suggestionSummary(null, { h: 9, m: 0 }, '') === null && S.suggestionSummary(days[3], null, '') === null, 'no summary until day and time are picked');
ok(S.TIME_CHOICES.length >= 4 && !('preselected' in S), 'nothing preselected; time is the user\'s choice');

module.exports = done('V2 suggest a date');
