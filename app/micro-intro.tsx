// Screen: Micro-intro (buluşma tercihleri) | Status: stable | Last updated: Mayıs 2026
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';

function firstParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? '';
  return val ?? '';
}

function capitalizeWords(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function normalizeCafe(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/\s*([,\-–—])\s*/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();
  return capitalizeWords(cleaned);
}

const CUSTOM_CAFE_OPTION = '📍 Başka bir kafe önerelim';

const FALLBACK_CAFE_OPTIONS = [
  '☕ Mandabatmaz — Beyoğlu',
  "☕ Walter's Coffee — Kadıköy",
  '☕ Kronotrop — Nişantaşı',
];

const STEP_DAY = {
  question: 'Hangi gün müsaitsin?',
  options: [
    '📅 Bu Cumartesi',
    '📅 Bu Pazar',
    '📅 Gelecek hafta sonu',
    '📅 Alternatif bir gün öner',
  ],
};

const STEP_TIME = {
  question: 'Hangi saat aralığı sana uyar?',
  options: [
    '🌅 10:00 – 12:00',
    '☀️ 12:00 – 14:00',
    '🌤 14:00 – 17:00',
    '🕐 Başka bir saat öner',
  ],
};

type VenueRow = {
  name: string;
  district: string;
  emoji: string | null;
};

function formatVenueOption(venue: VenueRow): string {
  return `${venue.emoji ?? '☕'} ${venue.name} — ${venue.district}`;
}

function pickVenues(venues: VenueRow[], userDistrict: string | null): VenueRow[] {
  const picked: VenueRow[] = [];
  const seen = new Set<string>();

  const addVenue = (venue: VenueRow) => {
    const key = `${venue.name}|${venue.district}`;
    if (seen.has(key) || picked.length >= 3) return;
    seen.add(key);
    picked.push(venue);
  };

  if (userDistrict) {
    venues.filter((v) => v.district === userDistrict).forEach(addVenue);
  }

  venues.forEach((venue) => {
    if (picked.length >= 3) return;
    addVenue(venue);
  });

  return picked;
}

export default function MicroIntroScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const matchUserId = firstParam(params.matchUserId);
  const matchName = firstParam(params.matchName);
  const matchAge = firstParam(params.matchAge);
  const matchCity = firstParam(params.matchCity);
  const matchPhoto = firstParam(params.matchPhoto);
  const matchPercentage = firstParam(params.matchPercentage);
  const isAccepting = firstParam(params.isAccepting) === '1';

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [customCafe, setCustomCafe] = useState('');
  const [customDay, setCustomDay] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [confirmedDetails, setConfirmedDetails] = useState<{
    kafe: string;
    gun: string;
    saat: string;
  } | null>(null);
  const [cafeOptions, setCafeOptions] = useState<string[]>([
    ...FALLBACK_CAFE_OPTIONS,
    CUSTOM_CAFE_OPTION,
  ]);
  const [venuesLoading, setVenuesLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setVenuesLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        let userDistrict: string | null = null;
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('district')
            .eq('id', user.id)
            .single();
          userDistrict = profile?.district ?? null;
        }

        const { data: venues, error } = await supabase
          .from('venues')
          .select('name, district, emoji')
          .eq('is_active', true);

        if (!mounted) return;

        if (error || !venues || venues.length === 0) {
          setCafeOptions([...FALLBACK_CAFE_OPTIONS, CUSTOM_CAFE_OPTION]);
          return;
        }

        const picked = pickVenues(venues as VenueRow[], userDistrict);
        if (picked.length === 0) {
          setCafeOptions([...FALLBACK_CAFE_OPTIONS, CUSTOM_CAFE_OPTION]);
          return;
        }

        setCafeOptions([...picked.map(formatVenueOption), CUSTOM_CAFE_OPTION]);
      } catch {
        if (mounted) {
          setCafeOptions([...FALLBACK_CAFE_OPTIONS, CUSTOM_CAFE_OPTION]);
        }
      } finally {
        if (mounted) setVenuesLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const steps = useMemo(
    () => [
      {
        question: 'Hangi kafede buluşalım?',
        options: cafeOptions,
      },
      STEP_DAY,
      STEP_TIME,
    ],
    [cafeOptions],
  );

  function handleSelect(option: string) {
    setSelected(option);
  }

  async function handleNext() {
    if (!selected) return;
    const effectiveSelected =
      selected === CUSTOM_CAFE_OPTION && customCafe.trim()
        ? `☕ ${normalizeCafe(customCafe)}`
        : selected === '📅 Alternatif bir gün öner' && customDay.trim()
        ? `📅 ${capitalizeWords(customDay)}`
        : selected === '🕐 Başka bir saat öner' && customTime.trim()
        ? `🕐 ${customTime.trim()}`
        : selected;
    const newAnswers = [...answers, effectiveSelected];

    if (step < steps.length - 1) {
      setAnswers(newAnswers);
      setSelected(null);
      setStep(step + 1);
      return;
    }

    // Son adım — Supabase'e yaz
    setSending(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Oturum bulunamadı.');

      const introAnswers = {
        kafe: newAnswers[0],
        gun: newAnswers[1],
        saat: newAnswers[2],
      };

      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      // Match satırını bul veya oluştur
      const { data: existingMatch } = await supabase
        .from('matches')
        .select('id, user_a_id, user_b_id, user_a_intro_answers')
        .or(
          `and(user_a_id.eq.${user.id},user_b_id.eq.${matchUserId}),` +
            `and(user_a_id.eq.${matchUserId},user_b_id.eq.${user.id})`,
        )
        .maybeSingle();

      let match = existingMatch;

      if (!match) {
        // Yeni eşleşme: status her zaman pending (isAccepting olsa bile insert'te accepted yapılmaz)
        const { data: newMatch, error: insertError } = await supabase
          .from('matches')
          .insert({
            user_a_id: user.id,
            user_b_id: matchUserId,
            match_score: Number(matchPercentage) || 0,
            status: 'pending',
            expires_at: expiresAt,
            user_a_accepted: true,
            user_a_intro_answers: introAnswers,
          })
          .select('id, user_a_id, user_b_id, user_a_intro_answers')
          .single();

        if (insertError) throw new Error(insertError.message);
        match = newMatch;
      } else {
        // Mevcut eşleşme: status yalnızca isAccepting=true iken accepted olur
        const isUserA = match.user_a_id === user.id;
        const basePayload = isUserA
          ? { user_a_accepted: true, user_a_intro_answers: introAnswers }
          : { user_b_accepted: true, user_b_intro_answers: introAnswers };
        const updatePayload = isAccepting
          ? { ...basePayload, status: 'accepted' as const }
          : basePayload;

        const { error } = await supabase.from('matches').update(updatePayload).eq('id', match.id);

        if (error) throw new Error(error.message);
      }

      // Buluşma detaylarını belirle
      // isAccepting = true ise: Kullanıcı A'nın cevapları referans alınır
      // isAccepting = false ise: kendi cevaplarımız
      const details =
        isAccepting && match.user_a_intro_answers
          ? {
              kafe: match.user_a_intro_answers.kafe ?? introAnswers.kafe,
              gun: match.user_a_intro_answers.gun ?? introAnswers.gun,
              saat: match.user_a_intro_answers.saat ?? introAnswers.saat,
            }
          : introAnswers;

      setConfirmedDetails(details);
      setDone(true);
    } catch (e: any) {
      Alert.alert('Hata', e?.message ?? 'Bir hata oluştu.');
    } finally {
      setSending(false);
    }
  }

  if (done) {
    const isConfirmed = isAccepting;
    return (
      <ScreenContainer style={styles.container}>
        <View style={styles.doneWrap}>
          <ThemedText style={styles.doneEmoji}>{isConfirmed ? '🎉' : '⏳'}</ThemedText>
          <ThemedText style={styles.doneTitle}>
            {isConfirmed
              ? 'Buluşmanız onaylandı!'
              : `${matchName} ile buluşma isteğin gönderildi!`}
          </ThemedText>

          {isConfirmed && confirmedDetails ? (
            <View style={styles.confirmedBox}>
              <ThemedText style={styles.confirmedLabel}>Buluşma detayları</ThemedText>
              <View style={styles.confirmedRow}>
                <ThemedText style={styles.confirmedIcon}>☕</ThemedText>
                <ThemedText style={styles.confirmedText}>
                  {confirmedDetails.kafe.replace(/^☕\s*/, '')}
                </ThemedText>
              </View>
              <View style={styles.confirmedRow}>
                <ThemedText style={styles.confirmedIcon}>📅</ThemedText>
                <ThemedText style={styles.confirmedText}>
                  {confirmedDetails.gun.replace(/^📅\s*/, '')}
                </ThemedText>
              </View>
              <View style={styles.confirmedRow}>
                <ThemedText style={styles.confirmedIcon}>🕐</ThemedText>
                <ThemedText style={styles.confirmedText}>
                  {confirmedDetails.saat.replace(/^[🌅☀️🌤]\s*/, '')}
                </ThemedText>
              </View>
            </View>
          ) : (
            <ThemedText style={styles.doneSubtitle}>
              {matchName} onayladığında sana bildireceğiz.
            </ThemedText>
          )}

          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() =>
              router.push({
                pathname: '/user-profile',
                params: { userId: matchUserId },
              } as any)
            }
            activeOpacity={0.8}>
            <ThemedText style={styles.doneBtnText}>{matchName}'in profiline git →</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.doneBtnSecondary}
            onPress={() => router.replace('/(tabs)' as any)}
            activeOpacity={0.8}>
            <ThemedText style={styles.doneBtnSecondaryText}>Ana sayfaya dön</ThemedText>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const currentStep = steps[step];
  const nextDisabled =
    !selected ||
    (step === 0 && venuesLoading) ||
    (selected === CUSTOM_CAFE_OPTION && customCafe.trim().length === 0) ||
    (selected === '📅 Alternatif bir gün öner' && customDay.trim().length === 0) ||
    (selected === '🕐 Başka bir saat öner' && customTime.trim().length === 0) ||
    sending;

  return (
    <ScreenContainer style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profil satırı */}
        <View style={styles.profileRow}>
          <Image source={{ uri: matchPhoto }} style={styles.profilePhoto} />
          <View style={styles.profileInfo}>
            <ThemedText style={styles.profileName}>
              {matchName}, {matchAge}
            </ThemedText>
            <ThemedText style={styles.profileCity}>📍 {matchCity}</ThemedText>
          </View>
          <View style={styles.percentBadge}>
            <ThemedText style={styles.percentText}>%{matchPercentage}</ThemedText>
          </View>
        </View>

        {/* isAccepting ise küçük bilgi notu */}
        {isAccepting && (
          <View style={styles.acceptingNote}>
            <ThemedText style={styles.acceptingNoteText}>
              {matchName} seni buluşmaya davet etti. Tercihlerini seç ve onaylayalım! ☕
            </ThemedText>
          </View>
        )}

        {/* İlerleme noktaları */}
        <View style={styles.dotsRow}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]}
            />
          ))}
        </View>

        {/* Soru */}
        <ThemedText style={styles.question}>{currentStep.question}</ThemedText>

        {/* Seçenekler */}
        <View style={styles.optionsWrap}>
          {step === 0 && venuesLoading ? (
            <ThemedText style={styles.loadingText}>Kafeler yükleniyor...</ThemedText>
          ) : (
            currentStep.options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.option, selected === opt && styles.optionSelected]}
                onPress={() => handleSelect(opt)}
                activeOpacity={0.8}>
                <ThemedText style={[styles.optionText, selected === opt && styles.optionTextSelected]}>
                  {opt}
                </ThemedText>
              </TouchableOpacity>
            ))
          )}
          {selected === CUSTOM_CAFE_OPTION && step === 0 && (
            <TextInput
              style={styles.customInput}
              placeholder="Kafe adı ve semt yaz..."
              placeholderTextColor="#AAAAAA"
              value={customCafe}
              onChangeText={setCustomCafe}
              returnKeyType="done"
            />
          )}
          {selected === '📅 Alternatif bir gün öner' && step === 1 && (
            <TextInput
              style={styles.customInput}
              placeholder="Örn: Gelecek Salı, 3 Haziran..."
              placeholderTextColor="#AAAAAA"
              value={customDay}
              onChangeText={setCustomDay}
              returnKeyType="done"
            />
          )}
          {selected === '🕐 Başka bir saat öner' && step === 2 && (
            <TextInput
              style={styles.customInput}
              placeholder="Örn: 17:00 – 19:00"
              placeholderTextColor="#AAAAAA"
              value={customTime}
              onChangeText={setCustomTime}
              returnKeyType="done"
            />
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextBtn, nextDisabled && styles.nextBtnDisabled]}
          onPress={handleNext}
          disabled={nextDisabled}
          activeOpacity={0.8}>
          <ThemedText style={styles.nextBtnText}>
            {sending
              ? 'Gönderiliyor…'
              : step < steps.length - 1
                ? 'İleri →'
                : isAccepting
                  ? 'Onayla ve Buluş! 🎉'
                  : 'Gönder ✓'}
          </ThemedText>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start' },
  scroll: { flex: 1 },
  content: { paddingBottom: 16, paddingHorizontal: 4, gap: 20 },
  footer: {
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFF',
  },

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
  },
  profilePhoto: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DDD',
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  profileCity: { fontSize: 13, color: '#888', marginTop: 2 },
  percentBadge: {
    backgroundColor: colors.accent,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  percentText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  acceptingNote: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  acceptingNoteText: {
    color: colors.accent,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  dotActive: { backgroundColor: colors.accent, width: 24 },
  dotDone: { backgroundColor: colors.accent, opacity: 0.4 },

  question: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },

  optionsWrap: { gap: 10 },
  loadingText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 15,
    paddingVertical: 16,
  },
  option: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.bgCard,
  },
  optionSelected: {
    borderColor: colors.accent,
    backgroundColor: '#FFF8E1',
  },
  optionText: { fontSize: 15, color: colors.textPrimary },
  optionTextSelected: { color: colors.accent, fontWeight: '500' },
  customInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
    color: colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.accent,
    marginTop: 8,
  },

  nextBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Done ekranı
  doneWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  doneEmoji: { fontSize: 56 },
  doneTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  doneSubtitle: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmedBox: {
    backgroundColor: '#FFF8E1',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  confirmedLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: 4,
    textAlign: 'center',
  },
  confirmedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  confirmedIcon: { fontSize: 18 },
  confirmedText: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  doneBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  doneBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  doneBtnSecondary: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 4,
  },
  doneBtnSecondaryText: {
    color: '#888',
    fontSize: 14,
  },
});
