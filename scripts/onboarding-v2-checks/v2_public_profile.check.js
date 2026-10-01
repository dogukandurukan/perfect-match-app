// Another member's public profile (get_profile_v2 → publicProfileFromServer →
// buildPublicProfileBlocks): same blocks as the owner's own approved preview,
// empty fields/groups hidden, unsigned photos dropped.
const { ok, eq, lib, done } = require('./_setup');
const P = lib('yourProfile.ts');
const M = lib('serverMapping.ts');

const item = (kind, n, extra = {}) => ({ kind, source: 'custom', id: `custom:${kind}:${n}`, title: `T${n}`, ...extra });
const basics = {
  firstName: 'Ada', lastName: 'Secret', dobDay: '12', dobMonth: '4', dobYear: '1995', gender: 'woman', interestedIn: ['men'],
  locationQuery: 'Kadıköy, İstanbul, Turkey',
  location: { id: 'tr-istanbul-kadikoy', kind: 'district', city: 'İstanbul', district: 'Kadıköy', country: 'Turkey', label: 'Kadıköy, İstanbul, Turkey' },
  heightCm: '168',
};
const compat = { intent: 'long_term', socialEnergy: 'mix', messageFrequency: 'often', relationshipSpace: 'balance',
  emotionalExpression: 'open', meetingPace: 'quickly', values: ['trust', 'respect'] };
const life = { smoking: 'no', drinking: 'sometimes', pets: 'have_pets', petKind: 'cat', activity: 'somewhat' };
const world = { workStatus: 'full_time', jobTitle: 'Designer', school: item('school', 1), hometown: item('hometown', 2),
  interests: ['travel', 'books'], artists: [item('artist', 3)], books: [item('book', 4, { imageUrl: 'https://covers.example/4.jpg' })],
  screen: [item('screen', 5)] };
const dates = { dateTypes: ['coffee', 'walk'], spotText: 'Moda sahil', days: 'weekends', time: 'evening' };
const photos = [1, 2, 3].map((k) => ({ id: 'p' + k, uri: `https://signed.example/${k}.jpg`, path: `u/${k}.jpg` }));
const profile = { ...P.EMPTY_PROFILE_DRAFT, photos,
  prompts: [{ promptId: 'ask_me_about', answer: 'Istanbul' }, { promptId: 'comfort_food', answer: 'Soup' }, { promptId: null, answer: '' }] };

const own = P.buildProfilePreview(basics, compat, life, world, dates, profile);
const age = own[0].age;
// What get_profile_v2 returns for the same person (allowed fields only).
const row = {
  user_id: 'u', first_name: 'Ada', age, zodiac: 'Aries', city: 'İstanbul', height_cm: 168, work_status: 'full_time',
  job_title: 'Designer', school: world.school, hometown: world.hometown, intent: 'long_term', core_values: ['trust', 'respect'],
  interests: ['travel', 'books'], smoking: 'no', drinking: 'sometimes', pets: 'have_pets', pet_kind: 'cat', activity: 'somewhat',
  artists: world.artists, books: world.books, screen: world.screen, date_types: ['coffee', 'walk'], favorite_spot: 'Moda sahil',
  days_pref: 'weekends', time_pref: 'evening',
  prompts: [{ slot: 2, prompt_id: 'comfort_food', answer: 'Soup' }, { slot: 1, prompt_id: 'ask_me_about', answer: 'Istanbul' }],
  photo_paths: ['u/1.jpg', 'u/2.jpg', 'u/3.jpg'],
};
const signed = new Map(photos.map((p) => [p.path, p.uri]));
const other = P.buildPublicProfileBlocks(M.publicProfileFromServer(row, signed));
const strip = (blocks) => JSON.parse(JSON.stringify(blocks, (k, v) => (k === 'id' && typeof v === 'string' && /^(p\d|public:)/.test(v) ? undefined : v)));
ok(eq(strip(other), strip(own)), 'another member\'s profile = the owner\'s approved preview (same blocks, same order)');
const text = JSON.stringify(other);
ok(!/Secret|1995|Kadıköy|tr-istanbul/.test(text), 'no surname, DOB, district or location id in the blocks');
ok(text.includes('Aries') && text.includes('168 cm') && text.includes('From T2') && text.includes('Favorite spot: Moda sahil'),
  'zodiac, height, hometown and favorite spot shown');

// Empty profile: no empty sections or headers; unsigned photos dropped.
const bare = { ...row, height_cm: null, zodiac: null, work_status: null, job_title: null, school: null, hometown: null, intent: null,
  core_values: [], interests: [], smoking: null, drinking: null, pets: null, pet_kind: null, activity: null, artists: [], books: [],
  screen: [], date_types: [], favorite_spot: null, days_pref: null, time_pref: null, prompts: [] };
const bareBlocks = P.buildPublicProfileBlocks(M.publicProfileFromServer(bare, new Map([['u/1.jpg', 'https://signed.example/1.jpg']])));
ok(eq(bareBlocks.map((b) => b.type), ['hero', 'facts']), 'only the hero and the city remain (empty groups/titles hidden)');
ok(bareBlocks.filter((b) => b.type === 'photo').length === 0, 'photos that could not be signed are not shown');
const noPhoto = P.buildPublicProfileBlocks(M.publicProfileFromServer({ ...bare, city: null, photo_paths: [] }, new Map()));
ok(eq(noPhoto.map((b) => b.type), ['header']), 'no photo and no facts → name/age header only');

module.exports = done('V2 public profile');
