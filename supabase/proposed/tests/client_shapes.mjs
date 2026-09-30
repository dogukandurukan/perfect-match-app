// The exact REST shapes the R-P0 client uses to read OTHER people (and the
// own-row reads next to them), replayed over HTTP at P0-A and P0-B.
// Keep in sync with the app files named in each entry.
const arr = (j) => (Array.isArray(j) ? j : []);

export function clientShapes(U) {
  const one = (id) => (j) => arr(j).length === 1 && arr(j)[0].id === id;
  return [
    {
      name: 'Home feed — get_discovery_cards (index.tsx loadFeed)',
      actor: 'A', method: 'POST', path: '/rpc/get_discovery_cards', body: { p_limit: 10 },
      expect: (j) => arr(j).length > 0 && 'age' in arr(j)[0], noPrivate: true,
    },
    {
      name: 'Home feed extras — profile_cards (index.tsx)',
      actor: 'A',
      path: `/profile_cards?select=id,languages,bio,first_date_expectation,favorite_spots,education,education_detail,occupation,zodiac_sign,gender,pets,morning_night,core_value,impressed_by,favorite_activity,photo_verified&id=in.(${U.P},${U.Q})`,
      expect: (j) => arr(j).length === 2, noPrivate: true,
    },
    {
      name: 'Home active match name — profile_cards (index.tsx)',
      actor: 'A', path: `/profile_cards?select=first_name&id=eq.${U.C}`, expect: (j) => arr(j).length === 1,
    },
    {
      name: 'Matches invites/chats — profile_cards (matches.tsx)',
      actor: 'A', path: `/profile_cards?select=id,first_name,age,city,photos,gender&id=in.(${U.B},${U.C},${U.J})`,
      expect: (j) => arr(j).length === 3, noPrivate: true,
    },
    {
      name: 'Matches backfill — get_discovery_cards (matches.tsx)',
      actor: 'A', method: 'POST', path: '/rpc/get_discovery_cards', body: { p_limit: 8 }, expect: (j) => arr(j).length > 0,
    },
    {
      name: 'Matches Ready cards — profile_cards (matches.tsx)',
      actor: 'A',
      path: `/profile_cards?select=id,first_name,age,city,zodiac_sign,photos,favorite_music,favorite_movie,favorite_book,hobbies,availability_days,drinking,smoking,education,education_detail,morning_night,languages,recharge_style,bio,first_date_expectation,favorite_spots,meeting_environment&id=in.(${U.P},${U.Q})`,
      expect: (j) => arr(j).length === 2, noPrivate: true,
    },
    {
      name: 'Chats list — profile_cards (messages.tsx)',
      actor: 'A', path: `/profile_cards?select=id,first_name,photos&id=in.(${U.C})`, expect: one(U.C), noPrivate: true,
    },
    {
      name: 'Chat header photo — profile_cards (chat.tsx)',
      actor: 'A', path: `/profile_cards?select=photos&id=eq.${U.C}`, expect: (j) => arr(j).length === 1,
    },
    {
      name: 'Activity likers — get_my_liker_cards (notifications.tsx)',
      actor: 'A', method: 'POST', path: '/rpc/get_my_liker_cards', body: {}, expect: (j) => arr(j).length >= 1, noPrivate: true,
    },
    {
      name: 'Activity waiting/related — profile_cards (notifications.tsx)',
      actor: 'A', path: `/profile_cards?select=id,first_name,age,photos&id=in.(${U.J},${U.B})`,
      expect: (j) => arr(j).length === 2, noPrivate: true,
    },
    {
      name: 'Activity accept — own gender from profiles (notifications.tsx)',
      actor: 'A', path: `/profiles?select=id,gender&id=eq.${U.A}`, expect: one(U.A),
    },
    {
      name: 'Activity accept — other gender from profile_cards (notifications.tsx)',
      actor: 'A', path: `/profile_cards?select=id,gender&id=eq.${U.J}`, expect: one(U.J),
    },
    {
      name: 'Other user profile — profile_cards (user-profile.tsx)',
      actor: 'A',
      path: `/profile_cards?select=first_name,age,zodiac_sign,city,gender,languages,photos,morning_night,recharge_style,hobbies,drinking,smoking,education,availability_days,availability_hours,meeting_environment,first_date_expectation,bio,favorite_music,favorite_movie,favorite_book,favorite_activity,core_value,impressed_by,dealbreaker,pets,photo_verified&id=eq.${U.C}`,
      expect: (j) => arr(j).length === 1, noPrivate: true,
    },
    {
      name: 'Candidate profile — profile_cards (candidate-profile.tsx)',
      actor: 'A',
      path: `/profile_cards?select=first_name,age,photos,city,gender,zodiac_sign,education,morning_night,drinking,smoking,pets,availability_days,hobbies,favorite_activity,core_value,impressed_by,languages,favorite_music,favorite_movie,favorite_book,bio,first_date_expectation,favorite_spots,meeting_environment&id=eq.${U.P}`,
      expect: (j) => arr(j).length === 1, noPrivate: true,
    },
    {
      name: 'Plan detail — profile_cards (plan-detail.tsx)',
      actor: 'A', path: `/profile_cards?select=first_name,age,photos&id=eq.${U.C}`, expect: (j) => arr(j).length === 1,
    },
    {
      name: 'Blocked users — get_my_blocked_users (blocked-users.tsx)',
      actor: 'A', method: 'POST', path: '/rpc/get_my_blocked_users', body: {},
      expect: (j) => arr(j).some((r) => r.blocked_id === U.F && r.first_name === 'F' && !('photos' in r)),
      noPrivate: true,
    },
    {
      name: '"Looking for" of a visible person — profile_cards.intent (index/matches/candidate/user-profile)',
      actor: 'A', path: `/profile_cards?select=id,intent&id=in.(${U.P},${U.C})`,
      expect: (j) => arr(j).length === 2 && arr(j).every((r) => typeof r.intent === 'string'),
    },
    {
      name: 'Plan your date — other person (micro-intro.tsx)',
      actor: 'A', path: `/profile_cards?select=gender,availability_days&id=eq.${U.P}`, expect: (j) => arr(j).length === 1,
    },
    {
      name: 'Plan your date — venues (micro-intro.tsx)',
      actor: 'A', method: 'POST', path: '/rpc/get_date_venue_suggestions', body: { p_other: U.P },
      expect: (j) => arr(j).length > 0 && arr(j).every((v) => v.reason !== 'them'),
    },
    {
      name: 'Vibe strip — profile_cards (lib/vibeCategories.ts)',
      actor: 'A',
      path: `/profile_cards?select=id,first_name,age,photos,gender,city,morning_night,availability_days,favorite_music,hobbies,recharge_style,languages&city=eq.Istanbul&id=neq.${U.A}&gender=in.(Woman)&morning_night=eq.Night%20owl&limit=10`,
      expect: (j) => arr(j).length > 0, noPrivate: true,
    },
    {
      name: 'Own profile — full row still readable (profile.tsx / settings.tsx)',
      actor: 'A', path: `/profiles?select=*&id=eq.${U.A}`, expect: (j) => arr(j).length === 1 && 'phone_number' in arr(j)[0],
    },
  ];
}
