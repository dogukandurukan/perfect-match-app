// Screen: Ana sayfa sekmesi | Status: stable | Last updated: Mayıs 2026
import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';
import { getProfileSetupState, type ProfileSetupState } from '@/lib/profileCompletion';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

type ActiveMatch = {
  matchId: string;
  firstName: string;
  status: 'pending' | 'accepted';
  userAAccepted: boolean;
  userBAccepted: boolean;
  isUserA: boolean;
  introAnswers: { kafe?: string; gun?: string; saat?: string } | null;
};

export default function HomeScreen() {
  const router = useRouter();
  const [profileState, setProfileState] = useState<ProfileSetupState | null>(null);
  const [checking, setChecking] = useState(true);
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!user) {
        setProfileState(null);
        setChecking(false);
        return;
      }

      const state = await getProfileSetupState(user.id);
      if (!mounted) return;

      if (state === 'setup1') router.replace('/profile-setup/step1');
      if (state === 'setup2') router.replace('/profile-setup/step2');
      if (state === 'setup3') router.replace('/profile-setup/step3');
      if (state === 'setup4') router.replace('/profile-setup/step4');

      setProfileState(state);
      setChecking(false);
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !mounted) return;

        // Accepted match var mı?
        const { data: accepted } = await supabase
          .from('matches')
          .select(
            `
            id, status, user_a_id, user_b_id,
            user_a_accepted, user_b_accepted,
            user_a_intro_answers, user_b_intro_answers,
            profiles!matches_user_b_id_fkey (first_name)
          `,
          )
          .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
          .eq('status', 'accepted')
          .limit(1)
          .single();

        if (!mounted) return;

        if (accepted) {
          const isUserA = accepted.user_a_id === user.id;
          const otherProfile = accepted.profiles as { first_name?: string } | null;
          setActiveMatch({
            matchId: accepted.id,
            firstName: otherProfile?.first_name ?? 'Biri',
            status: 'accepted',
            isUserA,
            userAAccepted: accepted.user_a_accepted,
            userBAccepted: accepted.user_b_accepted,
            introAnswers: isUserA
              ? accepted.user_a_intro_answers
              : accepted.user_b_intro_answers,
          });
          return;
        }

        // Pending match var mı?
        const { data: pending } = await supabase
          .from('matches')
          .select(
            `
            id, status, user_a_id, user_b_id,
            user_a_accepted, user_b_accepted,
            profiles!matches_user_b_id_fkey (first_name)
          `,
          )
          .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
          .eq('status', 'pending')
          .eq('user_a_accepted', true)
          .limit(1)
          .single();

        if (!mounted) return;

        if (pending) {
          const isUserA = pending.user_a_id === user.id;
          const otherProfile = pending.profiles as { first_name?: string } | null;
          setActiveMatch({
            matchId: pending.id,
            firstName: otherProfile?.first_name ?? 'Biri',
            status: 'pending',
            isUserA,
            userAAccepted: pending.user_a_accepted,
            userBAccepted: pending.user_b_accepted,
            introAnswers: null,
          });
        }
      })();
      return () => {
        mounted = false;
      };
    }, []),
  );

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />

      {checking ? null : profileState === 'complete' ? (
        <View style={styles.content}>
          <ThemedText type="title" style={styles.title}>
            Merhaba 👋
          </ThemedText>

          {/* Aktif eşleşme kartı */}
          {activeMatch && (
            <View
              style={[
                styles.activeCard,
                activeMatch.status === 'accepted' && styles.activeCardConfirmed,
              ]}>
              <ThemedText style={styles.activeCardEmoji}>
                {activeMatch.status === 'accepted' ? '🎉' : '⏳'}
              </ThemedText>
              <View style={styles.activeCardInfo}>
                <ThemedText style={styles.activeCardTitle}>
                  {activeMatch.status === 'accepted'
                    ? `${activeMatch.firstName} ile buluşman onaylandı!`
                    : `${activeMatch.firstName} yanıt bekleniyor...`}
                </ThemedText>
                {activeMatch.status === 'accepted' && activeMatch.introAnswers && (
                  <ThemedText style={styles.activeCardDetail}>
                    {activeMatch.introAnswers.kafe} · {activeMatch.introAnswers.gun}
                  </ThemedText>
                )}
              </View>
            </View>
          )}

          {/* İstatistik kartları */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <ThemedText style={styles.statEmoji}>💘</ThemedText>
              <ThemedText style={styles.statLabel}>Eşleşmen</ThemedText>
              <ThemedText style={styles.statValue}>3</ThemedText>
            </View>
            <View style={styles.statCard}>
              <ThemedText style={styles.statEmoji}>☕</ThemedText>
              <ThemedText style={styles.statLabel}>Buluşma</ThemedText>
              <ThemedText style={styles.statValue}>
                {activeMatch?.status === 'accepted' ? '1' : '0'}
              </ThemedText>
            </View>
          </View>

          <ThemedText style={styles.subtitle}>
            Algoritmamız sana en uygun 3 kişiyi seçti.
          </ThemedText>

          <View style={styles.buttonsContainer}>
            <PrimaryButton
              label="Eşleşmelerimi Gör ✨"
              onPress={() => router.push('/(tabs)/matches' as Parameters<typeof router.push>[0])}
            />
          </View>
        </View>
      ) : (
        <View style={styles.content}>
          <ThemedText type="title" style={styles.title}>
            Dating App
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Az swipe, direkt buluşma.
          </ThemedText>
          <View style={styles.buttonsContainer}>
            <PrimaryButton label="Başla" onPress={() => router.push('/(auth)/register')} />
            <PrimaryButton
              label="Giriş Yap"
              onPress={() => router.push('/(auth)/login')}
              style={styles.loginButton}
            />
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'space-between' },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.accent,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    maxWidth: 280,
  },
  buttonsContainer: {
    gap: 12,
    width: '100%',
    maxWidth: 280,
    marginTop: 8,
  },
  loginButton: {
    backgroundColor: colors.accent,
  },

  // Aktif eşleşme kartı
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.accent,
    width: '100%',
    maxWidth: 320,
  },
  activeCardConfirmed: {
    backgroundColor: '#F0FFF4',
    borderColor: '#4CAF50',
  },
  activeCardEmoji: { fontSize: 28 },
  activeCardInfo: { flex: 1 },
  activeCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  activeCardDetail: {
    fontSize: 12,
    color: '#666',
    marginTop: 3,
  },

  // İstatistik kartları
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 320,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  statEmoji: { fontSize: 22 },
  statLabel: { fontSize: 11, color: '#888' },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.accent,
  },
});
