// Screen: Eşleşme sonuçları | Status: stable | Last updated: Mayıs 2026
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
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
  const router = useRouter();
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
    return () => { mounted = false; };
  }, [parsedResults]);

  function handleTanis(match: MatchCardData) {
    router.push({
      pathname: '/micro-intro',
      params: {
        matchUserId: match.user_id,
        matchName: match.first_name ?? 'Kullanıcı',
        matchAge: String(safeAge(match.date_of_birth)),
        matchCity: match.city ?? '',
        matchPhoto: match.displayPhotoUrl,
        matchPercentage: String(match.match_percentage),
      },
    } as unknown as Parameters<typeof router.push>[0]);
  }

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.title}>Eşleşmelerin ✨</ThemedText>
        <ThemedText style={styles.subtitle}>
          Algoritmamız sana en uygun {cards.length} kişiyi seçti
        </ThemedText>

        {cards.map((match) => (
          <View key={match.user_id} style={styles.card}>

            <View style={styles.photoWrap}>
              <Image source={{ uri: match.displayPhotoUrl }} style={styles.photo} />
              <View style={styles.percentageBadge}>
                <ThemedText style={styles.percentageText}>
                  %{match.match_percentage}
                </ThemedText>
              </View>
            </View>

            <View style={styles.infoWrap}>
              <View style={styles.nameRow}>
                <ThemedText style={styles.name}>
                  {match.first_name ?? 'Kullanıcı'}, {safeAge(match.date_of_birth)}
                </ThemedText>
                <ThemedText style={styles.city}>📍 {match.city ?? 'Bilinmiyor'}</ThemedText>
              </View>

              <View style={styles.categoryWrap}>
                <ThemedText style={styles.categoryText}>{match.match_category}</ThemedText>
              </View>

              <View style={styles.chipsRow}>
                {match.reasons.slice(0, 4).map((reason, idx) => (
                  <View key={`${match.user_id}-c-${idx}`} style={styles.chip}>
                    <ThemedText style={styles.chipText}>{reason}</ThemedText>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={styles.tanisBtn}
                onPress={() => handleTanis(match)}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.tanisBtnText}>Tanış →</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start' },
  content: { paddingBottom: 40, gap: 16 },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 4,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    overflow: 'hidden',
  },
  photoWrap: {
    position: 'relative',
    width: '100%',
    height: 220,
  },
  photo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#DDD',
  },
  percentageBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.accent,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  percentageText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  infoWrap: {
    padding: 14,
    gap: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  city: {
    color: '#888',
    fontSize: 13,
  },
  categoryWrap: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  categoryText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '500',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: '#E0E0E0',
  },
  chipText: {
    color: '#555',
    fontSize: 12,
  },
  tanisBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 2,
  },
  tanisBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
