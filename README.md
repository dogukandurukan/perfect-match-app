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
    - İki ana buton:
      - **Get Started** → `/(auth)/register` (kayıt → Profile Setup)
      - **Log in** → `/(auth)/login`
    - Oturum açık ve profil tamamlanmadıysa ilgili `profile-setup/stepN` ekranına yönlendirme (`lib/profileCompletion.ts`).

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
      - Eğer `email` ve `password` **boşsa** → anonim oturum ile **Profile Setup step1**’e gider.
      - Eğer doldurulduysa:
        - Şifre ve tekrar aynı olmalı; min 8 karakter.
        - Weak/Mid/Strong strength göstergesi.
        - Supabase `auth.signUp`; başarılı olunca **Profile Setup step1**.
      - **“Hesap oluşturmadan devam et”** → anonim oturum, **step1**.

  - **Log in**: `app/(auth)/login.tsx`
    - Email + şifre ile Supabase `auth.signInWithPassword`.
    - Başarılı olunca profil durumuna göre `profile-setup` veya `/(tabs)`.

---

## Kullanıcı akışı (güncel)

1. **Landing** → **Get Started** → **Kayıt** (`register`) → **Profile Setup** (`step1` … `step4`) → **Ana sekme**.
2. Intent ve dinamik sorular **Onboarding-2/3 olmadan** doğrudan **Setup-2** içinde seçilir.
3. `app/onboarding/index.tsx` doğrudan kayda yönlendirir (eski step2–3 kaldırıldı).

---

## Profile Setup (v5 — 4 adım)

Route’lar: `app/profile-setup/step1.tsx` … `step4.tsx`

| Adım | İçerik (özet) |
|------|----------------|
| **1** | 3 foto (max ~100px), isim, DOG + burç, boy, konum, cinsiyet, meeting preferences (çoklu), diller (en fazla 5, hibrit) |
| **2** | Intent: `just_friends`, `keeping_it_casual`, `open_to_relationship`, `not_sure_yet` + dinamik sorular; `preferences` + `profiles.intent` |
| **3** | Yaşam tarzı (opsiyonel, skip); eğitim + follow-up, `occupation`, `education_detail` → `profiles` |
| **4** | Müsaitlik (gün/saat), mekan chip’leri + favori spot, bio (opsiyonel, skip) |

**İlerleme:** `lib/profileCompletion.ts` — `profiles` + `preferences.setup*_completed`.

**Intent tipleri:** `lib/onboardingIntent.ts` — eski `something_serious` / `life_partner` kayıtları `open_to_relationship` olarak normalize edilir.

**İstemci matching yardımcıları:** `lib/intentMatching.ts`, `lib/profileMatching.ts` (sunucu tarafı pipeline henüz MVP değil).

**Fotoğraf bucket:** `profile-photos` — `{user_id}/photo_{n}.jpg`

**Detaylı faz planı ve sıradaki odak:** [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md)

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

## Master plan (MVP’ye kadar)

Özet ve önceliklendirilmiş backlog: **[`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md)**  
(Şu anki faz, DB + profil UI + matching sırası, profilde alan gösterimi tablosu.)

---

## Tech stack özeti

- **Frontend**: React Native + Expo (`expo-router` ile file-based navigation)
- **Dil**: TypeScript
- **Stil yönetimi**: Klasik `StyleSheet.create` ile component bazlı stiller
  - Şu an Tailwind/NativeWind kullanılmıyor; ileride istersen tasarım sistemini NativeWind’e taşımak kolay olacak.
- **Backend (auth + veri)**: Supabase (`@supabase/supabase-js`)

---

## Web'de hızlı test

- Web'i başlat: `npx expo start --web`
- Değişikliği görmek için dosyayı kaydet (`Cmd+S`); görünmüyorsa terminalde `r` ile reload
- Sağ üstteki `WebDebugNav` paneli: **web’de her zaman**; **native’de yalnızca `__DEV__`** ile hızlı geçiş:
  - `Home`, `Login`, `Sign up`, `Setup-1` … `Setup-4`
- Setup ekranları için demo: `?demo=1` (ör. `/profile-setup/step2?demo=1`). Oturum yok veya e-posta doğrulanmamışken Setup’e girmek için bu parametre gerekir; web’de `profile-setup/_layout` ayrıca URL’den `demo=1` okur.

---

## Product logic & user flow (MVP)

1. **Landing → Kayıt veya Giriş** — Get Started → register; Log in ayrı.
2. **Profile Setup** — Kayıt sonrası `step1` … `step4`; kısmi profille giriş yapan kullanıcı `profileCompletion` ile eksik adıma yönlendirilir.
3. **Home / Match** — Profil tamamlanınca ana sekme; “Find match” henüz gerçek backend eşleşmesine bağlı değil (MVP işi).

---

## Database schema (repo ile hizalı)

**Uygulama şu an şunları kullanıyor / migration dosyalarına bakın:** `supabase/migrations/`

Örnek `profiles` alanları: `first_name`, `last_name`, `gender`, `date_of_birth`, `zodiac_sign`, `city`, `district`, `full_address`, `lat`, `lng`, `photos` (`text[]`), `meeting_preferences`, `languages`, `intent` (Setup-2 sonrası), `occupation`, `education_detail`, `setup1_completed`, …

`preferences`: `intent`, `setup2_answers`, `setup2_completed` … `setup4_completed`, müsaitlik / bio / hobiler vb. (Setup-3 ve 4’e göre).

**Eski README’deki** `ideal_weekend`, `looking_for_gender` vb. isimler **güncel koda göre değişti**; detay için migration dosyalarına ve `app/profile-setup/*.tsx` içindeki `upsert` alanlarına bakın.

Gelecek tablolar (MVP+): `matches`, `places`, `meetings` — bkz. [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md).

---

## Matching (kod + plan)

- **Intent (havuz):** `lib/intentMatching.ts` — `not_sure_yet` herkesle uyumlu; ayrıntı README / Setup-2 dokümanı.
- **Setup-1 (sert filtre):** `lib/profileMatching.ts` — aynı `city`; karşılıklı `gender` ↔ `meeting_preferences`; ortak dil zorunlu (`languagesHardCompatible`).
- **Setup-1 (skor):** ilçe bonusu, yaş farkı, Man+Woman boy farkı, ortak dil sayısına göre dil puanı — bkz. [`docs/SETUP1_MATCHING.md`](docs/SETUP1_MATCHING.md) (`setup1ScoreTotal`).

Setup-2+ alanları ve sunucu tarafı pipeline ayrıca tanımlanacak.

---

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

- **Profile Setup state’i**
  - Her adım Supabase’e kaydediliyor; oturum + `profileCompletion` ile kaldığın adıma dönülür.

