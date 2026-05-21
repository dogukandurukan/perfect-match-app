# HANDOFF — Perfect Match / dating-app

Son güncelleme: Mayıs 2026  
Bu belge kod tabanının özeti içindir. Canlı Supabase şeması ile repo migration’ları farklı olabilir — deploy öncesi Dashboard + `supabase/migrations` karşılaştırın.

---

## 1. Ekranlar (`app/`) — dosya ve amaç

| Dosya | Amaç |
|--------|------|
| `app/_layout.tsx` | Kök Stack: sekmeler, auth, profile-setup, modal, deep link |
| `app/(auth)/login.tsx` | Giriş, şifremi unuttum |
| `app/(auth)/register.tsx` | Kayıt (`phone_number` metadata) |
| `app/(tabs)/_layout.tsx` | Alt tab: **Ana Sayfa**, **Eşleşmeler**, **Profil** |
| `app/(tabs)/index.tsx` | Ana sekme: setup yönlendirme; tam profilde aktif eşleşme kartı + istatistikler; “Eşleşmelerimi Gör” |
| `app/(tabs)/matches.tsx` | Eşleşmeler: gelen davetler (`user_a_accepted`), `get_top_matches` kartları, foto swipe, `buildSmartReasons` chip’leri |
| `app/(tabs)/profile.tsx` | Kendi profil görüntüleme (Step 3–4 + kültürel alanlar), çıkış, “Profili Düzenle” |
| `app/(tabs)/explore.tsx` | Expo şablonu; **tab bar’da yok** (dosya diskte) |
| `app/onboarding/index.tsx` | Onboarding giriş |
| `app/profile-setup/_layout.tsx` | Setup stack layout |
| `app/profile-setup/index.tsx` | Setup’a yönlendirme |
| `app/profile-setup/step1.tsx` | Profil + foto (`user-photos` Storage), `profiles` upsert |
| `app/profile-setup/step2.tsx` | Intent + `onboarding_answers` |
| `app/profile-setup/step3.tsx` | Yaşam tarzı, hobiler, eğitim, din, içki/sigara |
| `app/profile-setup/step4.tsx` | Müsaitlik, buluşma ortamı, bio, `setup_completed` |
| `app/profile-setup/success.tsx` | Tamamlandı; “Find my match” / top 3 |
| `app/match-results.tsx` | Top 3 sonuç kartları → Tanış → `micro-intro` |
| `app/micro-intro.tsx` | 3 adım (kafe / gün / saat); `matches` güncelleme; `isAccepting` ile B kabulü; done → `user-profile` |
| `app/user-profile.tsx` | Karşı kullanıcı profili (`userId` param) |
| `app/profile-edit.tsx` | Bio, müsaitlik, kültürel chip alanları, değerler (kayıt `profiles`) |
| `app/coming-soon.tsx` | `sports_partner` intent sonrası placeholder |
| `app/reset-password.tsx` | Şifre sıfırlama |
| `app/modal.tsx` | Örnek modal |

---

## 2. `lib/` — önemli modüller

| Dosya | Rol |
|--------|-----|
| `supabaseClient.ts` | Supabase client; **`persistSession: false`** (Expo Go) |
| `matchScoring.ts` | `calculateMatchScore`, `culturalBonusScore`, `MATCH_SCORE_MAX=300`, kategori eşikleri |
| `profileMatching.ts` … `setup4Matching.ts` | Setup skorları / sert filtreler |
| `onboardingIntent.ts`, `intentMatching.ts` | Intent |
| `profileCompletion.ts` | `getProfileSetupState` |
| `userPhotosStorage.ts` | `user-photos` bucket, signed URL |
| `findAndSaveTopMatches.ts` | Top eşleşme + `matches` yazma (bazı akışlar) |
| `authDeepLinks.ts` | Deep link oturumu |
| `designTokens.ts` | UI renkleri |

---

## 3. Supabase — tablolar ve kolonlar

> **Uyarı:** Uygulama `matches` için `user_a_id` / `user_b_id` / intro kolonları kullanıyor. Repodaki `20260429001000_create_matches_table.sql` ise `user_id` / `matched_user_id` tanımlı. **Canlı DB ile senkronize edilmeli.**

### `profiles`

- Kimlik: `id`, `first_name`, `last_name`, `gender`, `date_of_birth`, `zodiac_sign`, `city`, `district`, `phone_number`, `photos` (`text[]`)
- Tercihler: `meeting_preferences`, `languages`, `current_step`, `setup_completed`
- Setup 3: `morning_night`, `recharge_style`, `hobbies`, `drinking`, `smoking`, `education`, `education_detail`, `religion`
- Setup 4: `availability_days`, `availability_hours`, `meeting_environment`, `favorite_spots`, `first_date_expectation`, `bio`
- Profil düzenleme (Phase 5): `favorite_music`, `favorite_movie`, `favorite_book`, `favorite_activity`, `core_value`, `impressed_by`, `dealbreaker`

### `onboarding_answers`

- `user_id` (unique), `intent`, `sub_intent`, setup-2 alanları (`friendship_value`, `hangout_frequency`, …)

### `matches` (uygulama beklentisi)

- `user_a_id`, `user_b_id`, `match_score`, `status` (`pending` / `accepted` / `expired`), `algo_version`
- Micro-intro: `user_a_accepted`, `user_b_accepted`, `user_a_intro_answers`, `user_b_intro_answers` (jsonb: `kafe`, `gun`, `saat`)
- Opsiyonel: `expires_at` (48h planı)

### `match_pair_scores`

- `user_a_id`, `user_b_id`, `total_score`, `raw_total_score`, `match_percentage`, `breakdown` (jsonb)

### Storage

- Bucket **`user-photos`** (private), path `{user_id}/photo_{n}.jpg`, RLS migration: `20260403120000_storage_user_photos_bucket_rls.sql`

---

## 4. RPC fonksiyonları

### `get_top_matches(p_user_id uuid, p_limit int)`

- **Kullanım:** `app/(tabs)/index.tsx` (navigasyon), `app/(tabs)/matches.tsx` (kart listesi)
- **Beklenen dönüş (app tipi):** `user_id`, `first_name`, `date_of_birth`, `city`, `district`, `zodiac_sign`, `photos`, `match_percentage`, `match_category`, `reasons`, `favorite_music`, `favorite_movie`, `favorite_book`, `hobbies`, `availability_days`, `drinking`, `smoking`, `education`, `education_detail`, `morning_night`
- **Not:** RPC tanımı repoda migration olarak **yok**; Supabase SQL Editor’da deploy edilmiş olmalı. Eksik kolonlar varsa chip/reason boş kalır.

---

## 5. Bilinen buglar / riskler

1. **`matches` şema sapması:** Migration `user_id` / `matched_user_id`; kod `user_a_id` / `user_b_id` + intro alanları.
2. **Fotoğraf upload:** Step1 upload var; profil sekmesinden upload yok; bazı cihazlarda bucket/RLS hataları log + Alert ile görünür.
3. **`persistSession: false`:** Uygulama kapanınca oturum düşer; production’da AsyncStorage + `persistSession: true` gerekir.
4. **Push notification yok:** Davet / kabul / buluşma onayı bildirimi implemente değil.
5. **`explore.tsx`:** Tab dışı ölü route dosyası.
6. **`profile-edit` ↔ `hobbies`:** Hobiler chip’leri `favorite_activity` kolonuna yazılıyor; `matches` smart reasons `profiles.hobbies` ile karşılaştırır — veri modeli netleştirilmeli.
7. **`get_top_matches`:** Repo’da SQL yok; ortam bağımlı.

---

## 6. Tamamlanan özellikler

### Phase 0 — Temel

- Expo Router, auth (login/register), Supabase client
- Design tokens, ortak UI bileşenleri

### Phase 1 — Profile setup

- Step 1–4, `onboarding_answers`, intent, foto storage
- `profileCompletion` yönlendirme

### Phase 2 — Intent / coming-soon

- `sports_partner` → `coming-soon`

### Phase 3 — Eşleşme bulma

- `calculateMatchScore`, `match-results`, `findAndSaveTopMatches` / success akışı
- `matches` + `get_top_matches` (canlı RPC)

### Phase 4 — Micro-intro (ilk sürüm)

- 3 soru, `matches` intro answers, pending UI

### Phase 5 — Matches, profil, akıllı nedenler (güncel)

- Tab: Ana Sayfa / Eşleşmeler / **Profil**
- **matches tab:** gelen davetler, kabul → `micro-intro` (`isAccepting=1`), red, foto swipe, burç, semt, `matchCategory` emoji
- **`buildSmartReasons`:** semt, müzik/film/kitap overlap, hobiler, müsait günler, içki/sigara, sabahçı/gececi, eğitim
- **`culturalBonusScore`:** `favorite_music` / `favorite_movie` / `favorite_book` token overlap → raw skor + % bonus (max +15)
- **Profil sekmesi:** tam profil okuma; **profile-edit:** chip input, müzik/sanatçı, film/dizi ayrımı
- **micro-intro done:** `{matchName}'in profiline git` + `user-profile`
- **Ana sayfa:** aktif eşleşme kartı, istatistik placeholder

---

## 7. Phase 6 planı

1. **Fotoğraf upload fix** — Profil sekmesinden ekle/sil; step1 ile aynı bucket/RLS; signed URL tutarlılığı
2. **Push notification** — Davet, kabul, buluşma onayı (Expo Notifications + Supabase trigger veya edge function)
3. **Güven katmanı** — Telefon doğrulama, raporlama, opsiyonel kimlik/selfie doğrulama badge
4. **Şema tekilleştirme** — `matches` migration + `get_top_matches` repoya SQL; RLS
5. **48 saat sayacı** — `expires_at` UI (`match-results`, matches kartları)
6. **Oturum** — Production `persistSession` + güvenli storage

---

## 8. Dosya başlığı standardı

İşlevsel kod dışında, ekran dosyalarının ilk satırı:

```ts
// Screen: [ekran adı] | Status: stable | Last updated: Mayıs 2026
```

`wip`: setup success, modal, explore, match-results (kısmi).

---

## 9. Hızlı komutlar

```bash
npx tsc --noEmit
npx expo start
```

```bash
git status
supabase db push   # migration sırasına dikkat
```

---

## 10. İlgili dokümanlar

- `docs/PHASE4.md` — micro-intro / 48h planı
- `CHANGELOG.md` — Phase 3 notları
- `README.md` — kurulum
