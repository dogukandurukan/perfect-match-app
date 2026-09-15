// Screen: Privacy Notice (KVKK Aydınlatma Metni) | New 2026-09-15,
// expanded same day (user: "olabildigince hukuki yükümlülükleri cover
// edicek sekilde hazırlar mısın"). In-app, not an external URL —
// settings.tsx's PRIVACY_URL points at a placeholder domain with no real
// page yet, and this needs to always work from the register screen
// regardless of that. Turkish body text deliberately — this is a
// KVKK-specific legal notice for Turkish users, not general app UI copy
// (rest of the app is English).
//
// IMPORTANT: this text was drafted by Claude Code, not a lawyer. It goes
// beyond KVKK Article 10's bare minimum (controller identity, purpose,
// transfer, collection method/legal basis, Article 11 rights) to also
// cover data retention, cross-border transfer, what other users can see,
// age restriction, and security — but it MUST still be reviewed by a
// lawyer before real users sign up (CLAUDE.md §5 — already a known
// pre-launch item; this screen doesn't close that, it gives the consent
// mechanism something real and thorough to point at).
//
// ONE OPEN FACT THE LAWYER NEEDS: which region Supabase hosts this
// project in (Dashboard → Settings → General → Region) — user didn't know
// it when this was written. Section 6 below is written to be true either
// way (discloses that infrastructure may be outside Turkey) but the exact
// country/adequacy-decision analysis needs that fact filled in.
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

function BulletList({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <ThemedText style={styles.bulletDot}>•</ThemedText>
          <ThemedText style={styles.sectionBody}>{item}</ThemedText>
        </View>
      ))}
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
            'Bu uygulama ("Perfect Match") kapsamında kişisel verileriniz, veri sorumlusu sıfatıyla Doğukan Durukan tarafından, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca aşağıda açıklanan kapsam ve amaçlarla işlenmektedir. Uygulama şu an için bireysel bir girişimcilik faaliyeti olarak yürütülmekte olup ayrı bir tüzel kişilik (şirket) bulunmamaktadır; bu durum değiştiğinde bu metin güncellenecektir.\n\nİletişim: dogukandurukan7@gmail.com'
          }
        </Section>

        <BulletList
          title="2. İşlenen Kişisel Veri Kategorileri"
          items={[
            'Kimlik bilgileri: ad, soyad, doğum tarihi, cinsiyet',
            'İletişim bilgileri: e-posta adresi, telefon numarası',
            'Konum bilgileri: şehir, ilçe/mahalle, ve rıza verirseniz cihazınızın konum koordinatları',
            'Görsel kayıtlar: profil fotoğrafları ve (varsa) kimlik doğrulama amaçlı selfie fotoğrafı',
            'Uygulama içi tercih ve içerik verileri: biyografi, hobiler, ilgi alanları, ilişki niyeti, yaşam tarzı tercihleri (içki/sigara, uyku düzeni vb.), buluşma tercihleri ve uygulama içi mesajlarınız',
            'İşlem güvenliği bilgileri: push bildirim token\'ı, hesap oluşturma/giriş kayıtları',
            'Kullanım/analitik verileri: uygulama içi etkileşimleriniz (beğeni, davet, mesajlaşma gibi eylemlerin zaman damgaları) — hizmeti iyileştirmek amacıyla',
            'Şikâyet/güvenlik kayıtları: engellediğiniz veya hakkınızda yapılan şikâyet kayıtları (kötüye kullanımın önlenmesi amacıyla)',
          ]}
        />

        <Section title="3. Özel Nitelikli Kişisel Veri İşlenmemektedir">
          {
            'KVKK m.6 kapsamında "özel nitelikli" sayılan veri kategorilerini (din, sağlık, cinsel hayat, biyometrik veri vb.) bilinçli olarak işlemiyoruz. Örneğin daha önce toplanan "din/inanç" alanı bu nedenle uygulamadan tamamen kaldırılmıştır. Kimlik doğrulama amacıyla paylaşabileceğiniz selfie fotoğrafı yalnızca görsel olarak, elle (otomatik yüz tanıma sistemi kullanılmadan) incelenir; bu nedenle biyometrik veri işleme kapsamında değerlendirilmemektedir.'
          }
        </Section>

        <BulletList
          title="4. Kişisel Verilerinizin İşlenme Amaçları"
          items={[
            'Hesabınızın oluşturulması, doğrulanması ve yönetilmesi',
            'Size uygun eşleşmelerin bir algoritma aracılığıyla sunulması',
            'Uygulama içi mesajlaşma ve iletişimin sağlanması',
            'Buluşma/etkileşim davetlerinin yönetilmesi ve size bildirim gönderilmesi',
            'Hizmet kalitesinin analiz edilmesi ve iyileştirilmesi',
            'Sahte hesap, kötüye kullanım ve dolandırıcılığın tespiti ve önlenmesi',
            'Şikâyet ve kullanıcı güvenliği süreçlerinin yürütülmesi',
            'Yasal yükümlülüklerin yerine getirilmesi ve yetkili mercilerin taleplerinin karşılanması',
          ]}
        />

        <Section title="5. Kişisel Veri Toplamanın Yöntemi ve Hukuki Sebebi">
          {
            'Kişisel verileriniz, uygulamayı kullanımınız sırasında elektronik ortamda doğrudan sizin tarafınızdan girilerek toplanmaktadır. Bu verilerin işlenmesindeki hukuki sebepler KVKK m.5/2 kapsamında: (a) bir sözleşmenin (kullanıcı sözleşmesi) kurulması veya ifasıyla doğrudan ilgili olması, (b) hukuki yükümlülüklerimizin yerine getirilmesi, (c) veri sorumlusunun meşru menfaati (güvenlik ve kötüye kullanımın önlenmesi) ve (d) açık rızanızdır. Fotoğraf, konum gibi bazı veriler yalnızca siz paylaşmayı tercih ederseniz (açık rızanızla) işlenir.'
          }
        </Section>

        <Section title="6. Kişisel Verilerin Aktarılması (Yurt İçi ve Yurt Dışı)">
          {
            'Kişisel verileriniz, yukarıda belirtilen amaçlarla sınırlı olarak, hizmet aldığımız barındırma/altyapı sağlayıcısına (Supabase Inc.) aktarılmaktadır. Bu sağlayıcının sunucuları Türkiye dışında bulunabilir; bu durumda veri aktarımı KVKK m.9 kapsamındaki yurt dışına aktarım hükümlerine tabidir ve gerekli hukuki güvenceler (yeterlilik kararı, standart sözleşme veya açık rızanız) sağlanarak gerçekleştirilir. Verileriniz, yasal zorunluluk hâlinde yetkili kamu kurum ve kuruluşlarına da aktarılabilir. Verileriniz açık rızanız olmadan pazarlama amacıyla üçüncü taraflarla paylaşılmaz veya satılmaz.'
          }
        </Section>

        <Section title="7. Diğer Kullanıcılarla Paylaşılan Bilgiler">
          {
            "Uygulamanın doğası gereği; adınız, yaşınız, profil fotoğraflarınız, biyografiniz, ilgi alanlarınız ve profilinizde paylaşmayı seçtiğiniz diğer bilgiler, uygulamayı kullanan diğer kullanıcılar tarafından görülebilir. Tam adresiniz, telefon numaranız ve e-posta adresiniz diğer kullanıcılarla hiçbir zaman paylaşılmaz. Konum bilginiz varsayılan olarak yalnızca şehir/ilçe düzeyinde gösterilir; Ayarlar'dan konumunuzu gizleyebilirsiniz."
          }
        </Section>

        <Section title="8. Veri Saklama Süresi">
          {
            'Kişisel verileriniz, hesabınız aktif olduğu sürece işlenmeye devam eder. Hesabınızı Ayarlar üzerinden kalıcı olarak sildiğinizde, kişisel verileriniz (fotoğraflar, mesajlar, profil bilgileri dahil) gecikmeksizin sistemlerimizden silinir; yalnızca yasal yükümlülüklerimiz nedeniyle saklanması zorunlu olan veriler (varsa) ilgili mevzuatta öngörülen süre kadar saklanır.'
          }
        </Section>

        <Section title="9. Veri Güvenliği">
          {
            'Kişisel verileriniz, yetkisiz erişime karşı satır bazlı erişim kontrolleri (Row Level Security) ile korunmaktadır — bir kullanıcı yalnızca kendi verilerine ve paylaşım kurallarına uygun diğer kullanıcı verilerine erişebilir. Şifreleriniz veri tabanında düz metin olarak tutulmaz. Buna rağmen internet üzerinden hiçbir aktarımın veya elektronik saklamanın %100 güvenli olduğu garanti edilemez.'
          }
        </Section>

        <Section title="10. Yaş Sınırı">
          {
            'Bu uygulama yalnızca 18 yaşını doldurmuş kullanıcılara yöneliktir. 18 yaşından küçük olduğunuzu öğrenmemiz hâlinde hesabınız ve ilişkili tüm verileriniz gecikmeksizin silinir.'
          }
        </Section>

        <BulletList
          title="11. Haklarınız (KVKK m.11)"
          items={[
            'Kişisel verinizin işlenip işlenmediğini öğrenme',
            'İşlenmişse buna ilişkin bilgi talep etme',
            'İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme',
            'Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme',
            'Eksik veya yanlış işlenmişse düzeltilmesini isteme',
            'KVKK m.7 şartları çerçevesinde silinmesini veya yok edilmesini isteme',
            'Düzeltme/silme işlemlerinin, verilerin aktarıldığı üçüncü kişilere bildirilmesini isteme',
            'İşlenen verilerin münhasıran otomatik sistemlerle analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme',
            'Kanuna aykırı işleme sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme',
          ]}
        />

        <Section title="12. Başvuru Yöntemi">
          {
            'Yukarıdaki haklarınızı kullanmak için 1. maddede belirtilen e-posta adresinden bize ulaşabilirsiniz. Talebiniz, KVKK\'da öngörülen süre ve usullere uygun şekilde en kısa sürede sonuçlandırılacaktır.'
          }
        </Section>

        <Section title="13. Metindeki Değişiklikler">
          {
            'Bu aydınlatma metni, mevzuattaki değişiklikler veya uygulamamızdaki güncellemeler doğrultusunda zaman zaman revize edilebilir. Güncel metin her zaman bu ekranda yer alır.'
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
  sectionBody: { fontSize: 14, lineHeight: 21, color: colors.textPrimary, flex: 1 },
  bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bulletDot: { fontSize: 14, lineHeight: 21, color: colors.textPrimary },
});
