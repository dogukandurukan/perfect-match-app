import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import { resolveProfilePhotoUrl } from '@/lib/userPhotosStorage';

type MatchResultItem = {
  user_id: string;
  first_name: string | null;
  date_of_birth: string | null;
  city: string | null;
  photos: string[] | null;
  match_percentage: number;
  match_category: string;
  reasons: string[];
};

type MatchCardData = MatchResultItem & { displayPhotoUrl: string };

function safeAge(dob: string | null): number {
  if (!dob) return 28;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return 28;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return Math.max(18, age);
}

export default function MatchResultsScreen() {
  const params = useLocalSearchParams<{ results?: string }>();
  const parsedResults = useMemo<MatchResultItem[]>(() => {
    try {
      if (!params.results) return [];
      const decoded = decodeURIComponent(params.results);
      const rows = JSON.parse(decoded) as MatchResultItem[];
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  }, [params.results]);

  const [cards, setCards] = useState<MatchCardData[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const mapped = await Promise.all(
        parsedResults.map(async (row) => {
          const firstPhoto = row.photos?.[0];
          const signed = firstPhoto ? await resolveProfilePhotoUrl(firstPhoto, 3600) : null;
          return {
            ...row,
            displayPhotoUrl: signed ?? `https://i.pravatar.cc/300?u=${row.user_id}`,
          };
        }),
      );
      if (mounted) setCards(mapped);
    })();
    return () => {
      mounted = false;
    };
  }, [parsedResults]);

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.title}>Top 3 Eslestirme Sonucun</ThemedText>
        {cards.map((match) => (
          <View key={match.user_id} style={styles.card}>
            <Image source={{ uri: match.displayPhotoUrl }} style={styles.photo} />
            <View style={styles.mainInfo}>
              <ThemedText style={styles.name}>
                {match.first_name ?? 'Kullanici'} · {safeAge(match.date_of_birth)}
              </ThemedText>
              <ThemedText style={styles.city}>{match.city ?? 'Bilinmeyen sehir'}</ThemedText>
              <ThemedText style={styles.category}>{match.match_category}</ThemedText>
              <View style={styles.reasonsWrap}>
                {match.reasons.slice(0, 3).map((reason, idx) => (
                  <ThemedText key={`${match.user_id}-r-${idx}`} style={styles.reason}>
                    - {reason}
                  </ThemedText>
                ))}
              </View>
            </View>
            <View style={styles.rightCol}>
              <ThemedText style={styles.percentage}>{match.match_percentage}%</ThemedText>
              <PrimaryButton label="Tanis" onPress={() => {}} style={styles.meetBtn} />
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start' },
  content: { paddingBottom: 32, gap: 12 },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderColor: '#E5E5E5',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#DDD',
  },
  mainInfo: { flex: 1, gap: 2 },
  name: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  city: { color: '#666', fontSize: 12 },
  category: { color: colors.textPrimary, fontSize: 12, marginBottom: 4 },
  reasonsWrap: { gap: 2 },
  reason: { color: '#666', fontSize: 12 },
  rightCol: { alignItems: 'flex-end', justifyContent: 'space-between' },
  percentage: { color: colors.accent, fontSize: 24, fontWeight: '700' },
  meetBtn: { minHeight: 40, paddingHorizontal: 10 },
});
