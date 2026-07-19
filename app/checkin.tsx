// Screen: Buluşma check-in | Status: test | Last updated: Mayıs 2026
import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';

function firstParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? '';
  return val ?? '';
}

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function ratingEmoji(r: number): string {
  if (r <= 3) return '😕';
  if (r <= 6) return '🙂';
  if (r <= 8) return '😊';
  return '🔥';
}

export default function CheckinScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const matchId = firstParam(params.matchId);
  const matchName = firstParam(params.matchName);
  const isUserA = firstParam(params.isUserA) === '1';

  const [step, setStep] = useState<'went' | 'rating' | 'done'>('went');
  const [wentThere, setWentThere] = useState<boolean | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleWent(went: boolean) {
    setWentThere(went);
    if (!went) {
      // Gitmediyse direkt kaydet
      setLoading(true);
      const updatePayload = isUserA ? { checkin_a: false } : { checkin_b: false };
      await supabase.from('matches').update(updatePayload).eq('id', matchId);
      setLoading(false);
      setStep('done');
    } else {
      setStep('rating');
    }
  }

  async function handleRating(r: number) {
    setRating(r);
  }

  async function handleSubmit() {
    if (!rating) return;
    setLoading(true);

    const checkinPayload = isUserA
      ? { checkin_a: true, date_rating_a: rating }
      : { checkin_b: true, date_rating_b: rating };

    await supabase.from('matches').update(checkinPayload).eq('id', matchId);

    // İkisi de true ise confirmed yap
    const { data: match } = await supabase
      .from('matches')
      .select('checkin_a, checkin_b')
      .eq('id', matchId)
      .single();

    if (match?.checkin_a === true && match?.checkin_b === true) {
      await supabase
        .from('matches')
        .update({ checkin_confirmed: true })
        .eq('id', matchId);
    }

    setLoading(false);
    setStep('done');
  }

  // WENT ekranı
  if (step === 'went') {
    return (
      <ScreenContainer style={styles.container}>
        <View style={styles.wrap}>
          <ThemedText style={styles.emoji}>☕</ThemedText>
          <ThemedText style={styles.title}>
            {matchName} ile buluşmaya gittiniz mi?
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Buluşmanızın gerçekleşip gerçekleşmediğini öğrenmek istiyoruz.
          </ThemedText>
          <TouchableOpacity
            style={styles.yesBtn}
            onPress={() => handleWent(true)}
            disabled={loading}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.yesBtnText}>☕ Evet, gittik!</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.noBtn}
            onPress={() => handleWent(false)}
            disabled={loading}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.noBtnText}>😕 Hayır, gitmedik</ThemedText>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // RATING ekranı
  if (step === 'rating') {
    return (
      <ScreenContainer style={styles.container}>
        <View style={styles.wrap}>
          <ThemedText style={styles.emoji}>
            {rating ? ratingEmoji(rating) : '⭐'}
          </ThemedText>
          <ThemedText style={styles.title}>
            Buluşma nasıl geçti?
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            1'den 10'a kadar puanla. Geri bildirimler daha iyi eşleşmeler için kullanılır.
          </ThemedText>

          <View style={styles.ratingsGrid}>
            {RATINGS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.ratingBtn, rating === r && styles.ratingBtnSelected]}
                onPress={() => handleRating(r)}
                activeOpacity={0.8}
              >
                <ThemedText
                  style={[styles.ratingBtnText, rating === r && styles.ratingBtnTextSelected]}
                >
                  {r}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {rating && (
            <ThemedText style={styles.ratingLabel}>
              {rating <= 3 && 'Üzgünüz, bir dahakine daha iyisi olur 💪'}
              {rating > 3 && rating <= 6 && 'Fena değil! Belki tekrar buluşursunuz 🙂'}
              {rating > 6 && rating <= 8 && 'Harika! Güzel bir buluşmaydı 😊'}
              {rating > 8 && 'Mükemmel! Bu çok umut verici 🔥'}
            </ThemedText>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, !rating && { opacity: 0.4 }]}
            onPress={handleSubmit}
            disabled={!rating || loading}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.submitBtnText}>
              {loading ? 'Kaydediliyor...' : 'Gönder ✓'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // DONE ekranı
  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.wrap}>
        <ThemedText style={styles.emoji}>
          {wentThere ? (rating && rating > 6 ? '🎉' : '😊') : '😕'}
        </ThemedText>
        <ThemedText style={styles.title}>
          {wentThere
            ? 'Geri bildiriminiz için teşekkürler!'
            : 'Üzgünüz, bir dahakine daha iyi olur!'}
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          {wentThere
            ? 'Puanın daha iyi eşleşmeler bulmamıza yardımcı olacak.'
            : 'Sorun yaşadıysan profil sayfasından şikayet edebilirsin.'}
        </ThemedText>
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => router.replace('/(tabs)' as any)}
          activeOpacity={0.8}
        >
          <ThemedText style={styles.homeBtnText}>Ana sayfaya dön</ThemedText>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center' },

  wrap: {
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  emoji: { fontSize: 64 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },

  yesBtn: {
    width: '100%',
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  yesBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  noBtn: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  noBtnText: { color: '#888', fontSize: 16, fontWeight: '500' },

  ratingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginVertical: 8,
  },
  ratingBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
  },
  ratingBtnSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  ratingBtnText: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  ratingBtnTextSelected: { color: '#FFF' },
  ratingLabel: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '500',
    textAlign: 'center',
  },

  submitBtn: {
    width: '100%',
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

  homeBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  homeBtnText: { color: '#888', fontSize: 14 },
});
