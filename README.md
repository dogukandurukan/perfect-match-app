# Perfect Match – Dating App (MVP)

Bu repo, Expo + React Native ile geliştirdiğin **algoritma odaklı tek buluşmalık dating uygulamasının** MVP kodunu içerir.

Uygulamanın farkı: kullanıcıdan aldığı onboarding cevaplarına göre **günün/haftanın tek “perfect match” buluşmasını** önermek.

---

## Kurulum ve geliştirme

- **Bağımlılıklar**

  ```bash
  npm install
  ```

- **Geliştirme sunucusu**

  ```bash
  npx expo start
  ```

  - Terminalde:
    - `i` → iOS simulator
    - `a` → Android emulator
    - `w` → Web
  - Telefonda **Expo Go** ile QR kodu okutarak canlı görüntüleyebilirsin.

---

## Mimari genel bakış

- **React Native + Expo**
  - `expo-router` ile **file-based navigation** kullanıyor.
  - Ana giriş noktası: `app/_layout.tsx`.

- **Ana ekran (Landing / SS1)**
  - Dosya: `app/(tabs)/index.tsx`
  - Özellikler:
    - Tam ekran koyu arka plan (`#0F1117`).
    - Ortada “Dating App” + slogan.
    - Üst-orta: **home ikonu** (tıklayınca Landing’e döner).
    - İki ana buton (Figma’ya göre aynı boy):
      - **Get Started** → `onboarding/step2`
      - **Log in** → `/(auth)/login`

- **Auth akışı (Supabase)**
  - Supabase client: `lib/supabaseClient.ts`
    - Env değişkenleri:
      - `EXPO_PUBLIC_SUPABASE_URL`
      - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
    - Bu değerler `app.json` içindeki `expo.extra` alanından okunuyor.

  - **Sign up (Create account)**: `app/(auth)/register.tsx`
    - Alanlar:
      - `username`
      - `email`
      - `password`
      - `confirmPassword`
    - Davranış:
      - Eğer `email` ve `password` **boşsa** → Supabase çağrısı yapmadan **onboarding akışına** geçer.
      - Eğer doldurulduysa:
        - Şifre ve tekrar aynı olmalı.
        - Şifre en az 8 karakter olmalı.
        - Password altında Weak/Mid/Strong strength göstergesi bulunur.
        - Supabase `auth.signUp` ile kayıt olur, `username` `user_metadata` içine yazılır.
        - Başarılı olunca şu an onboarding akışına yönlendirir (profil setup aşaması hazır olunca “kalp” ekrana geçilecek).
      - Ekstra:
        - **“Hesap oluşturmadan devam et”** linki → doğrudan onboarding’e gider.

  - **Log in**: `app/(auth)/login.tsx`
    - Email + şifre ile Supabase `auth.signInWithPassword`.
    - Başarılı olunca `/(tabs)` ana ekrana yönlendirir.

---

## Onboarding akışı (SS1 + 2 adım)

Şu an onboarding, “SS1 Landing” sonrası 2 ekranla devam ediyor:

- **SS1 Landing / SS1**: `app/(tabs)/index.tsx`
  - **Get Started** → `onboarding/step2`
  - **Log in** → `/(auth)/login`
  - Üst-orta home ikonu ile geri dönüş

- **Onboarding-2**: `app/onboarding/step2.tsx`
  - Soru: “What are you looking for?”
  - Seçenekler (single-select):
    - Something serious
    - A life partner
    - Just friends
    - Not sure yet
  - Seçim yapınca → `onboarding/step3`

- **Onboarding-3**: `app/onboarding/step3.tsx`
  - Soru: “How does your ideal weekend look?”
  - Seçenekler (multi-select):
    - Outdoors & active
    - Cozy & homebody
    - Social & events
    - Mix of everything
  - Altta **Continue** butonu ile → `/(auth)/register`
  - Kartlara basınca seçimin değiştiği UI geri bildirimi var

> Not: Şu an onboarding cevapları yalnızca local UI state’inde tutuluyor; veri kalıcılığı (Supabase) bir sonraki fazda eklenecek.

---

## Profile Setup (2 sayfa - plan)

Onboarding ve auth tamamlandıktan sonra kullanıcı uygulamanın “kalbine” geçmeden önce Profile Setup adımlarını doldurur.

- **Profile Setup Page‑1**
  - Yaş
  - Cinsiyet
  - Şehir (matching için kritik)
  - Meslek (isteğe bağlı/sekonder sinyal)

- **Profile Setup Page‑2**
  - Hobi / ilgi alanları (lifestyle tags)
  - Yaşam tarzı (lifestyle tags)

### Onboarding inputs bu aşamada nasıl kullanılır?

- **Onboarding‑2 (intent)** → Profile preferences alanına map edilir:
  - `just_friends | something_serious | life_partner | not_sure_yet`
- **Onboarding‑3 (ideal weekend)** → Profile preferences alanına map edilir:
  - `ideal_weekend` (multi-select)

Bu değerler daha sonra matching MVP’de “intent filtering + score” için kullanılacaktır.

## Supabase yapılandırması

`app.json` içinde:

```json
"extra": {
  "EXPO_PUBLIC_SUPABASE_URL": "https://<project>.supabase.co",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY": "sb_publishable_..."
}
```

- Bu değerler Supabase projesi içindeki **Settings → API** sayfasından alınır.
- `lib/supabaseClient.ts` bu env değişkenlerini okuyup `createClient` ile Supabase client’ını oluşturur.

---

## Git & GitHub kullanım rehberi

Bu klasör zaten bir git repo (örn. `git rev-parse` ile doğrulanmış). Aşağıdaki adımlarla GitHub’a yedekleyebilir ve işbirliği yapabilirsin.

### 1. İlk commit’i oluştur

```bash
cd dating-app
git status           # değişiklikleri gör
git add .
git commit -m "Initialize Perfect Match MVP with auth and onboarding"
```

### 2. GitHub’da boş repo aç

1. `github.com` → sağ üstte **New repository**.
2. Repository name: örn. `perfect-match-app`.
3. Private/Public seçimini yap.
4. README / .gitignore eklemene gerek yok (zaten projede var).
5. “Create repository” butonuna bas.

GitHub, sayfanın üstünde sana şu tarz komutlar gösterecek; projene uyarlayarak kullan:

```bash
git remote add origin https://github.com/<kullanici-adin>/perfect-match-app.git
git branch -M main
git push -u origin main
```

### 3. Günlük geliştirme akışı

- Değişiklik yaptıktan sonra:

  ```bash
  git status
  git add .
  git commit -m "Kısa, açıklayıcı mesaj"
  git push
  ```

- Başkasıyla çalışırken:
  - `git pull` ile güncel kodu al.
  - Yeni özellikler için `feature/...` branch’leri aç:

    ```bash
    git checkout -b feature/onboarding-improvements
    # geliştirme
    git push -u origin feature/onboarding-improvements
    ```

  - GitHub üzerinden Pull Request açıp kod review yapabilirsiniz.

---

## Sonraki faz (öneri)

1. Supabase üzerinde kullanıcı profili ve onboarding cevapları için tablolar oluşturmak.
2. Onboarding ekranlarından gelen veriyi bu tablolara kaydetmek.
3. Basit bir **matching algoritması** ile tek eşleşme + buluşma yeri/saat önerisi yapan endpoint tasarlamak.

Bu README, projenin şu ana kadarki mimarisini ve akışını özetleyen referans doküman olarak kullanılabilir. Yeni fazlara geçtiğinde bu dosyayı güncelleyerek ilerleyebilirsin.

---

## Master plan (MVP’ye kadar)

### Phase 0 — UI / Design system stabilizasyonu (devam ediyor)

- **Auth & Onboarding pixel-match** (Figma token’larıyla)
  - SS1 Landing: `Get Started` → Onboarding‑2 → Onboarding‑3 → Sign up
  - `Log in` her zaman erişilebilir
- **UI feedback**
  - Butonlarda ve kartlarda basma animasyonu (press → scale/opacity)
  - Seçili kartlarda border vurgusu
  - (İsteğe bağlı) home ikonu basınca SS1’e dönülüyor
- **Şifre UX**
  - Min 8 karakter zorunluluğu
  - Weak/Mid/Strong strength göstergesi

### Phase 1 — Profile Setup (2 sayfa) + preference hazırlığı

- Profile Setup Page‑1 (yaş, cinsiyet, şehir, meslek)
- Profile Setup Page‑2 (hobi, yaşam tarzı / lifestyle tags)
- Onboarding‑2 (intent) ve Onboarding‑3 (ideal weekend) değerlerini bu profile/preferences yapısına map ederek matching için hazır hale getir.

### Phase 2 — Veri kalıcılığı (Supabase)

- Kullanıcı profile + preferences’i Supabase’e kaydet (upsert/patch)

### Phase 3 — Matching MVP (tek match)

- Filtre + skor fonksiyonu
- “Find my perfect match” ekranı + sonuç ekranı

### Phase 4 — Meeting suggestion (mekan + saat)

- `places` üzerinden mekan seçimi
- Basit timeslot önerisi
- Confirm/decline akışı

---

## Tech stack özeti

- **Frontend**: React Native + Expo (`expo-router` ile file-based navigation)
- **Dil**: TypeScript
- **Stil yönetimi**: Klasik `StyleSheet.create` ile component bazlı stiller
  - Şu an Tailwind/NativeWind kullanılmıyor; ileride istersen tasarım sistemini NativeWind’e taşımak kolay olacak.
- **Backend (auth + veri)**: Supabase (`@supabase/supabase-js`)

---

## Product logic & user flow (MVP)

1. **Landing → Auth**
   - Kullanıcı Tinder benzeri landing ekranda:
     - `Create account` (isteğe bağlı alanlar)
     - `Log in`
   - İsterse hiçbir bilgi girmeden onboarding’e atlayabiliyor.

2. **Onboarding + Signup**
   - SS1 Landing: `Get Started` → Onboarding‑2 → Onboarding‑3 → `Sign up`
   - `Log in` ayrı olarak `/(auth)/login` üzerinden gelir.
   - Onboarding’de amaç, matching için kritik niyeti (intent) ve ideal hafta sonunu hızlıca toplamak.

3. **Home / Match akışı (plan)**
   - Onboarding sonrası kullanıcı Home ekrana gelir:
     - “Find my perfect match” butonu.
   - Bu buton ileride backend’deki matching endpoint’ini tetikleyecek:
     - Havuzdan tek eşleşme + buluşma yeri/saat önerisi dönecek.

---

## Database schema (plan)

Supabase tarafında planlanan ana tablolar:

- `profiles`
  - `id` (auth user id)
  - `username`, `age`, `gender`, `city`
  - `occupation` (Profile Setup Page‑1)
  - `looking_for_gender` (dating/friends preference)
  - `lifestyle_tags` (Profile Setup Page‑2: hobi/yaşam tarzı)
- `preferences`
  - `user_id`
  - `intent` (Onboarding‑2: `just_friends | something_serious | life_partner | not_sure_yet`)
  - `ideal_weekend` (Onboarding‑3: multi-select)
- `match_requests`
  - `id`, `user_id`, `status` (`pending`, `matched`, `expired`)
  - `created_at`, `expires_at`
- `matches`
  - `id`, `user_a_id`, `user_b_id`
  - `score`
  - `created_at`
- `places`
  - `id`, `city`, `type` (coffee, bar, walk, brunch, dinner)
  - `name`, `address`, `lat`, `lng`, `price_level`, `vibe_tags`
- `meetings`
  - `id`, `match_id`
  - `place_id`, `time_slot`
  - `status` (`proposed`, `confirmed`, `cancelled`)

Bu şema, onboarding cevaplarını tek noktada toplayıp matching algoritmasında kullanmayı kolaylaştırmak için tasarlandı.

---

## Matching algoritması (plan)

İlk sürüm için basit ama anlamlı skor fonksiyonu (2 aşamalı yaklaşım):

1) **Matching Logic — Intent Filtering (sert filtre)**
2) Sonrasında şehir/cinsiyet filtreleri + skor hesabı

### 1) Intent Filtering (eşleşme havuzları)

Onboarding‑2’de seçilen niyet (intent), matching’in ilk ve en sert filtresidir:

```text
just_friends → just_friends + not_sure_yet ile eşleşir

something_serious → something_serious + life_partner + not_sure_yet ile eşleşir

life_partner → something_serious + life_partner + not_sure_yet ile eşleşir

not_sure_yet → herkesle eşleşir
```

### 2) Skor bileşenleri (örnek ağırlıklar)

Intent filtresi geçtikten sonra:

- **Şehir uyumu** → hard filter (aynı şehir)
- **Cinsiyet / preference uyumu** → hard filter (Profile Setup)
- **Ideal weekend uyumu** (Onboarding‑3 multi-select kesişimi) → 0–40 puan
- **Lifestyle / hobi uyumu** (Profile Setup Page‑2 tag kesişimi) → 0–30 puan
- **Intent uyumu** (havuz içinde kalanlar için ek skor düzeltmesi) → 0–30 puan

### Karar

- En yüksek skorlu tek adayı seç.
- Skor belirli bir eşik altındaysa (“50” altı gibi) “Bugün senin için iyi bir eşleşme bulamadık” mesajı göster.

Backend tarafında bu mantık `POST /match/findBest` gibi tek bir endpoint’te toplanacak.

---

## Stil / UI dili notu

- Şu an tüm komponentler klasik `StyleSheet.create` ile stilleniyor.
- Temel tasarım prensipleri:
  - Koyu arka plan: `#0F1117` (bg-primary).
  - Accent renk: `#C9A96E` (accent).
  - Büyük, net başlıklar (`fontSize` 26–34, `fontWeight: '700'`).
  - Yuvarlatılmış (pill) butonlar ve chip’ler.
- İleride:
  - Tek bir `theme` dosyasında renk ve spacing tanımlayıp,
  - İstersen NativeWind / Tailwind benzeri utility sınıflarına geçiş yapılabilir.

---

## Environment değişkenleri ve güvenlik

- Expo tarafında şu an env değerleri `app.json` içindeki `expo.extra` altında tutuluyor:

  ```json
  "extra": {
    "EXPO_PUBLIC_SUPABASE_URL": "https://<project>.supabase.co",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY": "sb_publishable_..."
  }
  ```

- `EXPO_PUBLIC_` prefix’li env’ler **istemci tarafında okunabilir** olduğundan,
  - Sadece public anon key ve URL burada tutulmalı.
  - Admin key, servis role vs. asla repo’ya konmamalı.

- Önerilen pratik:
  - Yerelde `.env` veya `app.config.ts` ile değerleri dışarı almak.
  - Örnek dosya için: `.env.example`:

    ```env
    EXPO_PUBLIC_SUPABASE_URL=your-project-url
    EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
    ```

  - Gerçek `.env` **.gitignore** içinde olmalı ve repo’ya push edilmemeli.

---

## Error handling & data persistence notları

- **Auth hata yönetimi**
  - `register` ve `login` ekranlarında Supabase’ten dönen `error.message` kullanıcıya `Alert` olarak gösteriliyor.
  - Örn: email zaten kayıtlıysa “Kayıt başarısız” diyalogu açılıyor.
  - İleride bu mesajlar kullanıcı dostu Türkçe mesajlara (ör. “Bu e‑posta zaten kayıtlı”) map edilebilir.
  - `register` ekranında ayrıca:
    - Şifre için **min 8 karakter** kontrolü var.
    - Şifre girilirken **Strength: Weak/Mid/Strong** göstergesi yer alıyor.

- **Onboarding state’i**
  - Şu an her onboarding ekranı kendi local state’ini tutuyor.
  - Uygulama kapandığında bu veriler kayboluyor; MVP sonrası:
    - Global state (Context/Zustand) + Supabase’e adım adım yazma,
    - Veya her adım sonrasında Supabase’e patch atma (daha güvenli) planlanabilir.

