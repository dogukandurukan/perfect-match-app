# Perfect Match — Master Plan (MVP’ye kadar)

Bu belge projenin **şu anki aşamasını**, **MVP hedeflerini** ve **sıradaki işleri** özetler. README ile birlikte tek kaynak olarak güncellenmelidir.

---

## 1. Şu an hangi aşamadayız?

**Faz:** Phase 1 tamamlanma aşamasına yakın — **Profile Setup (4 adım) + Auth akışı** büyük ölçüde kodda; **Supabase şemasının production’a oturtulması** ve **match / profil görüntüleme** henüz MVP düzeyinde değil.

### Tamamlanan (özet)

| Alan | Durum |
|------|--------|
| Expo Router, auth (login/register), e-posta doğrulama + şifre sıfırlama | Var |
| Landing: Get Started → Kayıt, profil eksikse yönlendirme | Var |
| Onboarding step2/3 kaldırıldı; intent Setup-2 içinde | Var |
| Profile Setup 1–4 (foto, isim, DOB+burç, boy, konum, gender, meeting prefs, diller; Setup-2 dinamik intent; Setup-3 yaşam; Setup-4 müsaitlik/bio) | Var |
| Tasarım token’ları + Setup UI (progress bar, chip 20px, KeyboardAvoidingView) | Var (`lib/designTokens.ts`, `SetupScreenHeader`, setup ekranları) |
| İstemci tarafı matching yardımcıları (`lib/intentMatching.ts`, `lib/profileMatching.ts`, `lib/setup2Matching.ts`, `lib/setup3Matching.ts`, `lib/setup4Matching.ts`, `lib/matchScoring.ts`) | Var (henüz backend/job yok) |
| Supabase client + `app.json` extra | Var |
| SQL migration dosyaları (`supabase/migrations/`) | Var (projede; prod’da çalıştırılmalı) |

### Eksik / yapılacak (MVP için kritik)

- Tüm migration’ların **Supabase projesinde** uygulanması ve RLS politikalarının netleştirilmesi.
- **Profil detay / düzenleme** ekranı: toplanan alanların kullanıcıya gösterimi.
- **Matching pipeline:** havuz → sert filtreler → skor → tek öneri (Edge Function veya RPC).
- **“Find match”** akışının gerçek veriye bağlanması.
- (İsteğe bağlı MVP+) Buluşma yeri/saat önerisi ve onay.

---

## 2. MVP hedefi (ürün tanımı)

**MVP:** Aynı şehir / uyumlu intent ve gender tercihleri olan kullanıcılar arasından, **basit skor ile tek bir “günün eşleşmesi”** önermek; kullanıcı profili Setup ile toplanmış veriye dayanır.

**Başarı ölçütleri (öneri):**

1. Kullanıcı kayıt olup Profile Setup’ı tamamlayabiliyor; veri `profiles` + `preferences` içinde tutuluyor.
2. İki test kullanıcısı ile karşılıklı gender/meeting ve intent kuralları sağlandığında match üretilebiliyor.
3. Skor; en azından intent + şehir + gender eşleşmesi + dil bonusu gibi kurallarla tutarlı.

---

## 3. MVP’ye kadar yapılacaklar (sıralı backlog)

### A. Veri katmanı (öncelik: yüksek)

1. **Migrations:** `supabase/migrations/` altındaki tüm dosyaları sırayla prod/staging’de çalıştır.
2. **RLS:** `profiles`, `preferences` için `auth.uid()` ile okuma/yazma politikaları; geliştirme sırasında geçici olarak gevşetip sonra sıkılaştırma.
3. **Eksik kolon hatalarını gider:** Uygulama `upsert`/`update` gönderdiği her alanın tabloda var olduğundan emin ol.

### B. Profil görünürlüğü (öncelik: yüksek–orta)

1. **Profil özeti ekranı** veya mevcut Home üzerinde kart: yaş, burç, ilçe+şehir, diller, meeting prefs (özet), intent (Setup-2 sonrası).
2. İleride: **Profili düzenle** (Setup ile parity veya kısmi alanlar).

### C. Matching (öncelik: yüksek — MVP’nin kalbi)

1. Sunucu tarafında veya güvenli RPC ile:
   - Intent: `intentsCanMatch` mantığı (`lib/intentMatching.ts`).
   - Gender ↔ `meeting_preferences`: `meetingPreferencesMutuallyCompatible` (`lib/profileMatching.ts`).
   - Şehir: aynı `city` (veya mesafe) sert filtre.
   - Dil: ortak dil zorunlu (sert filtre); ek puan `languageCountScore` (`docs/SETUP1_MATCHING.md`).
2. Setup-2’deki evlilik/çocuk gibi alanlar için **sert filtre** kuralları (dökümana göre) kodlanmalı.
3. Skor sonrası **tek kullanıcı** seçimi + “bugün eşleşme yok” eşiği.

### D. Ürün cilası

- Find match butonu → gerçek sonuç / boş durum mesajı.
- Hata ve yükleme durumları.
- (Sonra) Mekan / zaman slotu önerisi.

---

## 4. Bu aşamadan sonra neye odaklanmalı?

**Önerilen sıra (en mantıklı yol):**

1. **Veritabanı (A)** — Kod zaten alan gönderiyor; migration + RLS olmadan prod’da kırılgan kalırsın. Bu, diğer her şeyin önkoşulu.
2. **Profilde gösterim (B)** — Hem kullanıcı güveni hem de “veri doğru mu?” debug’u için Setup ile aynı sprintte veya hemen ardından. Algoritma yazmadan önce verinin okunduğunu görmek işi hızlandırır.
3. **Matching skoru ve pipeline (C)** — DB ve profil okuma oturunca; istemci helper’ları referans alarak **tek bir sunucu fonksiyonunda** topla (güvenlik + tutarlılık).

**Kısa cevap:** Önce **DB + migration + RLS**; paralel veya hemen sonra **profil özet ekranı**; sonra **matching algoritması ve Find match**. Sadece algoritmaya dalmak, şema veya veri yoksa zaman kaybettirir; sadece UI yapmak ise MVP’yi tamamlamaz — ikisini DB sabitlendikten sıkı bağlamak en verimli rotadır.

---

## 5. Toplanan bilgiler profilde nasıl görünecek? (hedef)

| Kaynak | Örnek alan | Profilde (önerilen gösterim) |
|--------|------------|------------------------------|
| Setup-1 | `first_name`, `last_name` | İsim |
| Setup-1 | `photos` | Galeri / ilk foto |
| Setup-1 | `date_of_birth`, `zodiac_sign` | Yaş · burç |
| Setup-1 | `height_cm` | Boy (cm, varsa) |
| Setup-1 | `district`, `city` | Kadıköy, İstanbul |
| Setup-1 | `gender` | Cinsiyet |
| Setup-1 | `meeting_preferences` | Aranan: Men, Women, … |
| Setup-1 | `languages` | Turkish, English, … |
| Setup-2 | `preferences.intent` + `setup2_answers` | Bağlantı niyeti + özet (kullanıcı dostu metin) |
| Setup-3 | `preferences.*`, `profiles.occupation`, `education_detail` | Yaşam tarzı özeti, meslek, eğitim |
| Setup-4 | müsaitlik, mekan, bio | Özet veya “detayda göster” |

Kart eşleşmesinde **karşı tarafa** neyin açılacağı gizlilik politikasına bağlı; MVP’de genelde yaş, şehir, foto, ortak ilgi/niyet özeti yeterli olabilir.

---

## 6. Dosya referansları (geliştiriciler için)

- Akış: `app/(tabs)/index.tsx`, `lib/profileCompletion.ts`
- Setup: `app/profile-setup/step1.tsx` … `step4.tsx`
- Intent tipleri: `lib/onboardingIntent.ts`
- Eşleşme yardımcıları: `lib/intentMatching.ts`, `lib/profileMatching.ts`
- Setup-1 eşleşme: `docs/SETUP1_MATCHING.md`
- Setup-2 eşleşme: `docs/SETUP2_MATCHING.md`
- Setup-3 eşleşme: `docs/SETUP3_MATCHING.md`
- Setup-4 eşleşme: `docs/SETUP4_MATCHING.md`
- Master eşleşme akışı: `docs/MATCHING_MASTER.md`
- Migration’lar: `supabase/migrations/`
- Auth / deep link: `lib/authDeepLinks.ts`, `app/reset-password.tsx`
- Debug gezinme (Setup demo): `components/ui/WebDebugNav.tsx` — web’de her zaman; **native’de yalnızca `__DEV__`** sağ üst panel

---

*Son güncelleme: auth + Setup UI + match skor cap + demo gate notları bu belgeye işlendi.*
