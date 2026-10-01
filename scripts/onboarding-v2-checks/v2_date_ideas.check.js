// "Suggest a date" ideas from V2 first-date preferences (dateSuggestions.ts).
const { ok, eq, lib, done } = require('./_setup');
const S = lib('dateSuggestions.ts');

// Wednesday 1 Oct 2026, 18:00 local.
const now = new Date(2026, 9, 1, 18, 0, 0);
const local = (iso) => { const d = new Date(iso); return [d.getDay(), d.getHours(), d.getMinutes(), d.getDate()]; };

ok(eq(S.dateIdeas(null, null, now), { times: [], basis: null }), 'no preferences → no ideas (picker only)');
ok(eq(S.dateIdeas({ days: 'weekends', time: null }, null, now).times, []), 'half-answered → no ideas');

const we = S.dateIdeas({ days: 'weekends', time: 'evening' }, { days: 'weekends', time: 'evening' }, now);
ok(we.times.length === 3 && we.basis === 'both', 'both weekend-evening → 3 ideas from both');
ok(we.times.every((t) => { const [d, h, m] = local(t); return (d === 0 || d === 6) && h === 19 && m === 30; }), 'only Sat/Sun at 19:30 local');
ok(local(we.times[0])[3] === 3, 'first idea is the coming Saturday (3 Oct)');

const today = S.dateIdeas({ days: 'either', time: 'either' }, null, now);
ok(today.times.every((t) => new Date(t).getDate() !== 1), 'never today (starts tomorrow, never in the past)');
ok(today.basis === 'mine' && today.times.length === 3, 'only mine known → basis mine');
ok(eq(today.times.map((t) => local(t).slice(1, 3)), [[13, 0], [19, 30], [13, 0]]), 'either/either → daytime + evening ideas');

const clash = S.dateIdeas({ days: 'weekdays', time: 'daytime' }, { days: 'weekends', time: 'evening' }, now);
ok(clash.basis === 'mine' && clash.times.every((t) => { const [d, h] = local(t); return d >= 1 && d <= 5 && h === 13; }),
  'no overlap → my own preference, not presented as shared');

const overlap = S.dateIdeas({ days: 'either', time: 'either' }, { days: 'weekends', time: 'evening' }, now);
ok(overlap.basis === 'both' && overlap.times.every((t) => { const [d, h] = local(t); return (d === 0 || d === 6) && h === 19; }),
  'overlap is used when it exists');

ok(!S.isSendableTime(null, now) && !S.isSendableTime(new Date(now.getTime() - 60000).toISOString(), now), 'past / empty not sendable');
ok(!S.isSendableTime(new Date(now.getTime() + 60000).toISOString(), now), 'less than 5 minutes ahead not sendable');
ok(S.isSendableTime(new Date(now.getTime() + 3600e3).toISOString(), now), 'an hour ahead is sendable');
ok(we.times.every((t) => /Z$/.test(t)), 'sent as UTC ISO (timestamptz), built from local time');

module.exports = done('V2 date ideas');
