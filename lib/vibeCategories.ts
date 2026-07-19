import { meetingPrefAcceptsGender } from '@/lib/profileMatching';
import { supabase } from '@/lib/supabaseClient';
import { resolveProfilePhotoUrl } from '@/lib/userPhotosStorage';

export type VibeCategoryId =
  | 'district'
  | 'night_owls'
  | 'early_birds'
  | 'weekend_coffee'
  | 'music_soul'
  | 'gaming'
  | 'reading'
  | 'recharge';

export type VibeCategory = {
  id: VibeCategoryId;
  emoji: string;
  title: string;
  description: string;
};

export const VIBE_CATEGORIES: VibeCategory[] = [
  {
    id: 'district',
    emoji: '📍',
    title: 'Semtindekiler',
    description: 'Aynı semtte yaşayanlar',
  },
  {
    id: 'night_owls',
    emoji: '🌙',
    title: 'Gece Kuşları',
    description: 'İkimiz de geceleri daha aktifiz',
  },
  {
    id: 'early_birds',
    emoji: '🌅',
    title: 'Erken Kuşlar',
    description: 'Sabahın köründe hazır olanlar',
  },
  {
    id: 'weekend_coffee',
    emoji: '☕',
    title: 'Hafta Sonu Kahvesi',
    description: 'Cumartesi veya Pazar müsait olanlar',
  },
  {
    id: 'music_soul',
    emoji: '🎵',
    title: 'Müzik Ruhu',
    description: 'Aynı müzik dünyasından',
  },
  {
    id: 'gaming',
    emoji: '🎮',
    title: 'Oyun Arkadaşı',
    description: 'Gaming hobisi paylaşanlar',
  },
  {
    id: 'reading',
    emoji: '📚',
    title: 'Kitap Kulübü',
    description: 'Okuma tutkusu olanlar',
  },
  {
    id: 'recharge',
    emoji: '⚡',
    title: 'Enerji Uyumu',
    description: 'Sosyal/yalnız şarj tarzı aynı olanlar',
  },
];

export type MyVibeContext = {
  userId: string;
  city: string | null;
  district: string | null;
  gender: string | null;
  meeting_preferences: string[] | null;
  morning_night: string | null;
  availability_days: string[] | null;
  favorite_music: string | null;
  hobbies: string[] | null;
  recharge_style: string | string[] | null;
  languages: string[] | null;
};

export type VibeProfileRow = {
  id: string;
  first_name: string | null;
  date_of_birth: string | null;
  district: string | null;
  city: string | null;
  gender: string | null;
  meeting_preferences: string[] | null;
  morning_night: string | null;
  availability_days: string[] | null;
  favorite_music: string | null;
  hobbies: string[] | null;
  recharge_style: string | string[] | null;
  languages: string[] | null;
  photos: string[] | null;
};

export type VibeStripUser = {
  id: string;
  first_name: string | null;
  date_of_birth: string | null;
  district: string | null;
  photoUrl: string | null;
};

export type VibeStripData = {
  category: VibeCategory;
  totalCount: number;
  users: VibeStripUser[];
};

export type VibeListUser = VibeProfileRow & {
  match_percentage: number | null;
  photoUrl: string | null;
};

const STRIP_SELECT =
  'id, first_name, date_of_birth, district, photos, gender, city, morning_night, availability_days, favorite_music, hobbies, recharge_style, meeting_preferences, languages';

const DETAIL_SELECT =
  'id, first_name, date_of_birth, district, city, gender, meeting_preferences, morning_night, availability_days, favorite_music, hobbies, recharge_style, languages, photos';

const GENDER_PREF_TO_PROFILE: Record<string, string> = {
  Men: 'Man',
  Women: 'Woman',
  'Non-binary': 'Non-binary',
};

function normalizeRecharge(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return value.trim() ? [value.trim()] : [];
}

function passesGenderFilter(me: MyVibeContext, profile: VibeProfileRow): boolean {
  return meetingPrefAcceptsGender(me.meeting_preferences, profile.gender);
}

function shouldSkipCategory(categoryId: VibeCategoryId, me: MyVibeContext): boolean {
  switch (categoryId) {
    case 'district':
      return !me.district?.trim();
    case 'recharge':
      return normalizeRecharge(me.recharge_style).length === 0;
    default:
      return false;
  }
}

function applyGenderQueryFilter<T extends { in: (col: string, vals: string[]) => T }>(
  query: T,
  meetingPrefs: string[] | null,
): T {
  if (!meetingPrefs?.length || meetingPrefs.includes('Everyone')) return query;
  const genders = meetingPrefs
    .map((pref) => GENDER_PREF_TO_PROFILE[pref])
    .filter((g): g is string => !!g);
  if (genders.length === 0) return query;
  return query.in('gender', genders);
}

function applyBlockedFilter<T extends { not: (col: string, op: string, val: string) => T }>(
  query: T,
  blockedIds: Set<string>,
): T {
  if (blockedIds.size === 0) return query;
  return query.not('id', 'in', `(${Array.from(blockedIds).join(',')})`);
}

async function queryCategoryProfiles(
  categoryId: VibeCategoryId,
  me: MyVibeContext,
  blockedIds: Set<string>,
  selectFields: string,
  limit?: number,
): Promise<{ profiles: VibeProfileRow[]; totalCount: number }> {
  if (!me.city?.trim()) return { profiles: [], totalCount: 0 };
  if (shouldSkipCategory(categoryId, me)) return { profiles: [], totalCount: 0 };

  let query = supabase
    .from('profiles')
    .select(selectFields, { count: 'exact' })
    .eq('setup_completed', true)
    .eq('city', me.city)
    .neq('id', me.userId);

  query = applyGenderQueryFilter(query, me.meeting_preferences);
  query = applyBlockedFilter(query, blockedIds);

  switch (categoryId) {
    case 'district':
      query = query.eq('district', me.district).not('district', 'is', null);
      break;
    case 'night_owls':
      query = query.eq('morning_night', 'Night owl');
      break;
    case 'early_birds':
      query = query.eq('morning_night', 'Morning person');
      break;
    case 'weekend_coffee':
      query = query.overlaps('availability_days', ['Sat', 'Sun']);
      break;
    case 'music_soul':
      query = query.not('favorite_music', 'is', null).neq('favorite_music', '');
      break;
    case 'gaming':
      query = query.contains('hobbies', ['Gaming']);
      break;
    case 'reading':
      query = query.contains('hobbies', ['Reading']);
      break;
    case 'recharge': {
      const styles = normalizeRecharge(me.recharge_style);
      query = query.overlaps('recharge_style', styles);
      break;
    }
    default:
      return { profiles: [], totalCount: 0 };
  }

  if (limit != null) {
    query = query.limit(limit);
  }

  const { data, count, error } = await query;
  if (error) {
    console.warn(`[vibe] category query failed (${categoryId})`, error);
    return { profiles: [], totalCount: 0 };
  }

  const profiles = ((data ?? []) as unknown as VibeProfileRow[]).filter((profile) =>
    passesGenderFilter(me, profile),
  );

  return {
    profiles,
    totalCount: count ?? profiles.length,
  };
}

async function resolveStripUsers(profiles: VibeProfileRow[]): Promise<VibeStripUser[]> {
  return Promise.all(
    profiles.map(async (profile) => {
      const path = profile.photos?.[0];
      let photoUrl: string | null = null;
      if (path) {
        photoUrl = await resolveProfilePhotoUrl(path, 3600);
      }
      if (!photoUrl) {
        photoUrl = `https://i.pravatar.cc/300?u=${profile.id}`;
      }
      return {
        id: profile.id,
        first_name: profile.first_name,
        date_of_birth: profile.date_of_birth,
        district: profile.district,
        photoUrl,
      };
    }),
  );
}

export async function fetchMyVibeContext(userId: string): Promise<MyVibeContext | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'city, district, gender, meeting_preferences, morning_night, availability_days, favorite_music, hobbies, recharge_style, languages',
    )
    .eq('id', userId)
    .single();

  if (error || !data) return null;

  return {
    userId,
    city: data.city,
    district: data.district,
    gender: data.gender,
    meeting_preferences: data.meeting_preferences,
    morning_night: data.morning_night,
    availability_days: data.availability_days,
    favorite_music: data.favorite_music,
    hobbies: data.hobbies,
    recharge_style: data.recharge_style,
    languages: data.languages,
  };
}

export async function fetchBlockedUserIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

  const blocked = new Set<string>();
  for (const row of data ?? []) {
    if (row.blocker_id === userId) blocked.add(row.blocked_id);
    if (row.blocked_id === userId) blocked.add(row.blocker_id);
  }
  return blocked;
}

export async function fetchVibeStrip(
  categoryId: VibeCategoryId,
  me: MyVibeContext,
  blockedIds: Set<string>,
): Promise<VibeStripData | null> {
  const category = VIBE_CATEGORIES.find((item) => item.id === categoryId);
  if (!category) return null;

  const { profiles, totalCount } = await queryCategoryProfiles(
    categoryId,
    me,
    blockedIds,
    STRIP_SELECT,
    10,
  );

  if (totalCount === 0 || profiles.length === 0) return null;

  const users = await resolveStripUsers(profiles.slice(0, 10));

  return {
    category,
    totalCount,
    users,
  };
}

export async function fetchAllVibeStrips(
  me: MyVibeContext,
  blockedIds: Set<string>,
): Promise<VibeStripData[]> {
  const results = await Promise.all(
    VIBE_CATEGORIES.map((category) => fetchVibeStrip(category.id, me, blockedIds)),
  );
  return results.filter((strip): strip is VibeStripData => strip !== null);
}

function orderedPair(userA: string, userB: string): [string, string] {
  return userA < userB ? [userA, userB] : [userB, userA];
}

async function fetchMatchPercentages(
  myId: string,
  otherIds: string[],
): Promise<Map<string, number>> {
  if (otherIds.length === 0) return new Map();

  const orFilter = otherIds
    .map((otherId) => {
      const [userAId, userBId] = orderedPair(myId, otherId);
      return `and(user_a_id.eq.${userAId},user_b_id.eq.${userBId})`;
    })
    .join(',');

  const { data, error } = await supabase
    .from('match_pair_scores')
    .select('user_a_id, user_b_id, match_percentage')
    .or(orFilter);

  if (error) {
    console.warn('[vibe] match_pair_scores fetch failed', error);
    return new Map();
  }

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    const otherId = row.user_a_id === myId ? row.user_b_id : row.user_a_id;
    map.set(otherId, row.match_percentage);
  }
  return map;
}

export async function fetchVibeCategoryUsers(
  categoryId: VibeCategoryId,
  me: MyVibeContext,
  blockedIds: Set<string>,
): Promise<VibeListUser[]> {
  const { profiles } = await queryCategoryProfiles(
    categoryId,
    me,
    blockedIds,
    DETAIL_SELECT,
    10,
  );

  const matchMap = await fetchMatchPercentages(
    me.userId,
    profiles.map((profile) => profile.id),
  );

  return profiles.map((profile) => ({
    ...profile,
    match_percentage: matchMap.get(profile.id) ?? null,
    photoUrl: null,
  }));
}

export function getVibeCategoryById(categoryId: string): VibeCategory | undefined {
  return VIBE_CATEGORIES.find((category) => category.id === categoryId);
}
