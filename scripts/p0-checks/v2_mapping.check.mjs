// V2 draft ⇄ server round trip (lib/onboardingV2/serverMapping.ts): every
// answer survives save → reload unchanged. Run: node scripts/p0-checks/v2_mapping.check.mjs
import * as M from '../../lib/onboardingV2/serverMapping.ts';

let passed = 0;
let failed = 0;
const check = (c, n) => (c ? passed++ : (failed++, console.log('FAIL', n)));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const basics = {
  firstName: 'Test', lastName: 'Applicant', dobDay: '12', dobMonth: '4', dobYear: '1995', gender: 'man',
  interestedIn: ['women', 'non_binary_people'], locationQuery: 'Kadıköy, İstanbul, Turkey',
  location: { id: 'tr-istanbul-kadikoy', kind: 'district', city: 'İstanbul', district: 'Kadıköy', country: 'Turkey', label: 'Kadıköy, İstanbul, Turkey' },
  heightCm: '181',
};
const iso = M.dobToIso(new Date(1995, 3, 12));
check(iso === '1995-04-12', 'DOB → ISO date (local calendar day, no timezone shift)');
const sb = M.basicsToServer(basics, iso);
check(eq(M.basicsFromServer(sb), basics), 'basics round trip');
const cityOnly = { ...basics, locationQuery: 'Ankara, Turkey', location: { id: 'tr-ankara', kind: 'city', city: 'Ankara', district: null, country: 'Turkey', label: 'Ankara, Turkey' } };
check(eq(M.basicsFromServer(M.basicsToServer(cityOnly, iso)), cityOnly), 'city-only location round trip');
const empty = { firstName: '', lastName: '', dobDay: '', dobMonth: '', dobYear: '', gender: null, interestedIn: [], locationQuery: '', location: null, heightCm: '' };
check(eq(M.basicsFromServer(M.basicsToServer(empty, null)), empty), 'empty basics round trip (nulls, no invented values)');

const compat = { intent: 'long_term', socialEnergy: 'mix', messageFrequency: 'few_checkins', relationshipSpace: 'balance',
  emotionalExpression: 'open', meetingPace: 'after_chatting', values: ['trust', 'respect'] };
check(eq(M.compatFromServer(M.compatToServer(compat)), compat), 'compatibility round trip');
const life = { smoking: 'no', drinking: 'sometimes', pets: 'have_pets', activity: 'somewhat', petKind: 'cat' };
check(eq(M.lifeFromServer(M.lifeToServer(life)), life), 'your life round trip');
check(M.lifeToServer({ ...life, pets: 'neutral' }).pet_kind === null, 'pet kind dropped unless "have pets"');
const item = (kind, n, extra = {}) => ({ kind, source: 'custom', id: `custom:${kind}:${n}`, title: `T${n}`, ...extra });
const world = { workStatus: 'student', jobTitle: 'Barista', school: item('school', 1, { subtitle: 'İstanbul' }), hometown: null,
  interests: ['travel', 'music'], artists: [item('artist', 1)], books: [item('book', 1, { subtitle: 'Author' }), item('book', 2)],
  screen: [item('screen', 1, { imageUrl: 'https://covers.example/1.jpg' })] };
check(eq(M.worldFromServer(M.worldToServer(world)), world), 'your world round trip (taste items incl. subtitle/image)');
const dates = { dateTypes: ['coffee', 'walk'], spotText: 'Moda sahil', days: 'weekends', time: 'evening' };
check(eq(M.datesFromServer(M.datesToServer(dates)), dates), 'your dates round trip');
check(M.datesToServer({ ...dates, spotText: '   ' }).favorite_spot === null, 'blank favorite spot → none');

const prompts = [{ promptId: 'ask_me_about', answer: 'Istanbul' }, { promptId: null, answer: '' }, { promptId: 'comfort_food', answer: ' Soup ' }];
const sp = M.promptsToServer(prompts);
check(eq(sp, [{ slot: 1, prompt_id: 'ask_me_about', answer: 'Istanbul' }, { slot: 3, prompt_id: 'comfort_food', answer: 'Soup' }]),
  'prompts → server keeps slots, drops empty, trims');
check(eq(M.promptsFromServer(sp), [prompts[0], { promptId: null, answer: '' }, { promptId: 'comfort_food', answer: 'Soup' }]),
  'prompts ← server back into 3 slots');

const photos = M.photosFromServer([{ id: 'b', path: 'u/2.jpg', position: 2 }, { id: 'a', path: 'u/1.jpg', position: 1 }],
  new Map([['u/1.jpg', 'https://signed/1'], ['u/2.jpg', null]]));
check(photos.map((p) => p.serverId).join() === 'a,b' && photos[0].uri === 'https://signed/1' && photos[1].broken === true,
  'photos ordered by position; unsignable photo marked broken (not faked)');

check(eq(M.resumePos({ resume_section: 'yourWorld', resume_step: 4 }), { section: 'yourWorld', step: 4 }), 'resume position');
check(eq(M.resumePos(null), { section: 'basics', step: 1 }), 'no draft → start');
check(eq(M.resumePos({ resume_section: 'hack', resume_step: 99 }), { section: 'basics', step: 1 }), 'unknown section → start');
check(eq(M.resumePos({ resume_section: 'basics', resume_step: 99 }), { section: 'basics', step: 6 }), 'step clamped to the section');
check(eq(M.resumePos({ resume_section: 'yourProfile', resume_step: 7 }), { section: 'yourProfile', step: 6 }),
  'never resumes on "received" without a submission');
check(eq(M.resumePos({ resume_section: 'yourProfile', resume_step: 5 }), { section: 'yourProfile', step: 6 }),
  'live mode skips the email-entry step');
check(eq(M.firstMissingPos(['yourProfile.selfie', 'basics.height']), { section: 'basics', step: 6 }), 'missing → first in flow order');
check(M.firstMissingPos(['account.email']) === null, 'email missing → no in-app step (re-sign-in)');

console.log(`V2 mapping: ${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
