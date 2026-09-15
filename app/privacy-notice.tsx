// Screen: Privacy Notice (KVKK Aydınlatma Metni) | New 2026-09-15
// In-app, not an external URL — settings.tsx's PRIVACY_URL points at a
// placeholder domain that isn't a real hosted page yet, and this needs to
// always work from the register screen regardless of that. Turkish body
// text deliberately — this is a KVKK-specific legal notice for Turkish
// users, not general app UI copy (rest of the app is English).
//
// IMPORTANT: this text was drafted by Claude Code, not a lawyer. It covers
// KVKK Article 10's five required sections (controller identity, purpose,
// transfer, collection method/legal basis, Article 11 rights) but MUST be
// reviewed by a lawyer before real users sign up (CLAUDE.md §5 — this was
// already a known pre-launch blocker, this screen doesn't close it, it
// gives the mechanism something real to point at).
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';

const ACCENT = '#1A1A1A';

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      <ThemedText style={styles.sectionBody}>{children}</ThemedText>
    </View>
  );
}

export default function PrivacyNoticeScreen() {
  const router = useRouter();

  return (
    <ScreenContainer style={styles.container}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/register'))}
        hitSlop={8}>
        <Ionicons name="chevron-back" size={24} color={ACCENT} />
        <ThemedText style={styles.backText}>Back</ThemedText>
      </TouchableOpacity>

      <ThemedText type="title" style={styles.pageTitle}>
        Privacy Notice
      </ThemedText>
      <ThemedText style={styles.pageSubtitle}>
        Kişisel Verilerin Korunması Hakkında Aydınlatma Metni
      </ThemedText>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Section title="1. Veri Sorumlusu">
          {
            'Bu uygulama ("Perfect Match") kapsamında kişisel verileriniz, veri sorumlusu sıfatıyla Doğukan Durukan tarafından, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca aşağıda açıklanan kapsam ve amaçlarla işlenmektedir.\n\nİletişim: dogukandurukan7@gmail.com'
          }
        </Section>

        <Section title="2. Kişisel Verilerinizin İşlenme Amacı">
          {
            'Ad-soyad, doğum tarihi, fotoğraflarınız, konum (şehir/ilçe), telefon numarası, ilgi alanları ve tercihleriniz, ve uygulama içi mesajlarınız gibi kişisel verileriniz; hesabınızın oluşturulması ve yönetilmesi, size uygun eşleşmelerin sunulması, uygulama içi iletişimin sağlanması, hizmet kalitesinin ve güvenliğinin artırılması (sahte hesap/kötüye kullanım tespiti dahil) ve yasal yükümlülüklerin yerine getirilmesi amaçlarıyla işlenmektedir.'
          }
        </Section>

        <Section title="3. Kişisel Verilerin Aktarılması">
          {
            'Kişisel verileriniz, yukarıda belirtilen amaçlarla sınırlı olarak, hizmet aldığımız barındırma/altyapı sağlayıcılarına (ör. Supabase) ve yasal zorunluluk halinde yetkili kamu kurum ve kuruluşlarına aktarılabilir. Verileriniz açık rızanız olmadan pazarlama amacıyla üçüncü taraflarla paylaşılmaz veya satılmaz.'
          }
        </Section>

        <Section title="4. Kişisel Veri Toplamanın Yöntemi ve Hukuki Sebebi">
          {
            'Kişisel verileriniz, uygulamayı kullanımınız sırasında elektronik ortamda doğrudan sizin tarafınızdan girilerek toplanmaktadır. Hukuki sebep, KVKK m.5/2 kapsamında bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması ve açık rızanızdır.'
          }
        </Section>

        <Section title="5. Haklarınız (KVKK m.11)">
          {
            'KVKK\'nın 11. maddesi uyarınca; kişisel verinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini isteme, KVKK m.7 şartları çerçevesinde silinmesini veya yok edilmesini isteme, bu işlemlerin verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme, işlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme ve kanuna aykırı işleme sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme haklarına sahipsiniz.\n\nBu haklarınızı kullanmak için yukarıdaki iletişim adresinden bize ulaşabilirsiniz.'
          }
        </Section>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  backText: { color: ACCENT, fontSize: 16 },
  pageTitle: { color: ACCENT, fontSize: 26, fontWeight: '700' },
  pageSubtitle: { color: '#888', fontSize: 13, marginTop: 2, marginBottom: 16 },
  scroll: { paddingBottom: 40, gap: 20 },
  section: { gap: 6 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  sectionBody: { fontSize: 14, lineHeight: 21, color: colors.textPrimary },
});
