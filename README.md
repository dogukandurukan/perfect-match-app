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

- **Ana ekran (Tinder benzeri landing)**
  - Dosya: `app/(tabs)/index.tsx`
  - Özellikler:
    - Tam ekran koyu arka plan.
    - Ortada büyük başlık: **“Swipe Right”**.
    - Altında açıklama metni.
    - İki ana buton:
      - **Create account**
      - **Log in**
  - `Create account` → `/(auth)/register`
  - `Log in` → `/(auth)/login`

- **Auth akışı (Supabase)**
  - Supabase client: `lib/supabaseClient.ts`
    - Env değişkenleri:
      - `EXPO_PUBLIC_SUPABASE_URL`
      - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
    - Bu değerler `app.json` içindeki `expo.extra` alanından okunuyor.

  - **Create account**: `app/(auth)/register.tsx`
    - Alanlar:
      - `username`
      - `email`
      - `password`
      - `confirmPassword`
    - Davranış:
      - Eğer `email` ve `password` **boşsa** → Supabase çağrısı yapmadan **onboarding akışına** geçer.
      - Eğer doldurulduysa:
        - Şifre ve tekrar aynı olmalı.
        - Şifre en az 6 karakter olmalı.
        - Supabase `auth.signUp` ile kayıt olur, `username` `user_metadata` içine yazılır.
        - Başarılı olunca onboarding’e yönlendirir.
      - Ekstra:
        - **“Hesap oluşturmadan devam et”** linki → doğrudan onboarding’e gider.

  - **Log in**: `app/(auth)/login.tsx`
    - Email + şifre ile Supabase `auth.signInWithPassword`.
    - Başarılı olunca `/(tabs)` ana ekrana yönlendirir.

---

## Onboarding akışı (4 adım)

Tüm onboarding ekranları **zorunlu olmayan** sorular içerir; her ekranda **Skip** ile hızlıca geçilebilir.

- **Routing**
  - `app/_layout.tsx` içinde tanımlı ekranlar:
    - `onboarding/index` (Adım 1)
    - `onboarding/step2`
    - `onboarding/step3`
    - `onboarding/step4`

### Adım 1 – Temel bilgiler

- Dosya: `app/onboarding/index.tsx`
- İçerik:
  - Yaş (input).
  - Cinsiyet (Kadın / Erkek / Diğer / Söylemek istemiyorum).
  - Aradığı profil (Kadın / Erkek / Farketmez).
  - Şehir.
- UI:
  - Üstte 4 parçalı progress bar (1. kısım dolu).
  - Altta:
    - **Skip** → direkt Step 2’ye geçer.
    - **Devam et** → Step 2’ye geçer.

### Adım 2 – Zaman ve buluşma tipi

- Dosya: `app/onboarding/step2.tsx`
- İçerik:
  - En rahat olunan zamanlar (Hafta içi akşam, Hafta sonu gündüz, Hafta sonu akşam).
  - Tercih edilen buluşma tipleri (Kahve, Bar / kokteyl, Yürüyüş, Brunch, Akşam yemeği).
- UI:
  - Progress bar’da ilk 2 kısım dolu.
  - Altta:
    - **Skip** → Step 3’e geçer.
    - **Devam et** → Step 3’e geçer.

### Adım 3 – İlgi alanları

- Dosya: `app/onboarding/step3.tsx`
- İçerik:
  - İlgi alanları için çoklu seçim chip’ler (Müzik, Spor, Seyahat, Yeme‑içme, Sinema / dizi, Kitap vb.).
- UI:
  - Progress bar’da ilk 3 kısım dolu.
  - Altta:
    - **Skip** → Step 4’e geçer.
    - **Devam et** → Step 4’e geçer.

### Adım 4 – Sosyal enerji ve beklenti

- Dosya: `app/onboarding/step4.tsx`
- İçerik:
  - Sosyal enerji seviyesi (Sakin / evci, Dengeli, Dışa dönük / enerjik).
  - İlk buluşma beklentisi (Rahat sohbet, Eğlenceli / hareketli, Derin muhabbet).
  - Ne arıyorsun? (Ciddi ilişki, Akışına bırakıyorum, Emin değilim).
- UI:
  - Progress bar’ın 4 parçası da dolu.
  - Altta:
    - **Skip** → doğrudan `/(tabs)` ana ekrana gider.
    - **Tamamla** → yine `/(tabs)` ana ekrana gider.

> Not: Şu an onboarding cevapları yalnızca UI state’inde tutuluyor; bir sonraki fazda bu veriler Supabase veri modeline kaydedilip **matching algoritmasına** giriş olarak kullanılacak.

---

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

2. **Onboarding (4 adım)**
   - Temel bilgiler → Zaman & buluşma tipi → İlgi alanları → Sosyal enerji & beklenti.
   - Her adım atlanabilir; sorular churn yaratmadan maksimum sinyal toplamaya odaklı.

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
  - `looking_for_gender`, `bio`
- `onboarding_answers`
  - `user_id`
  - `availability` (JSON / text[]; örn. `["weekday_evening","weekend_evening"]`)
  - `meeting_types` (JSON / text[])
  - `interests` (JSON / text[])
  - `social_energy`, `first_date_style`, `relationship_intent`
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

İlk sürüm için basit ama anlamlı skor fonksiyonu:

- **Filtreler**
  - Aynı şehir.
  - Karşılıklı gender / age range uyumu.

- **Skor bileşenleri (örnek ağırlıklar)**
  - Zaman uyumu (`availability` kesişimi) → 0–40 puan.
  - Buluşma tipi uyumu (`meeting_types` kesişimi) → 0–30 puan.
  - İlgi alanı kesişimi (`interests` ortak sayısı) → 0–20 puan.
  - Sosyal enerji + ilişki beklentisi uyumu → 0–10 puan.

- **Karar**
  - En yüksek skorlu adayı seç.
  - Skor belirli bir eşik altındaysa (“50” altı gibi) “Bugün senin için iyi bir eşleşme bulamadık” mesajı göster.

Backend tarafında bu mantık `POST /match/findBest` gibi tek bir endpoint’te toplanacak.

---

## Stil / UI dili notu

- Şu an tüm komponentler klasik `StyleSheet.create` ile stilleniyor.
- Temel tasarım prensipleri:
  - Koyu arka plan (`#000000` civarı).
  - Accent renk: turuncu (`#F97316`).
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

- **Onboarding state’i**
  - Şu an her onboarding ekranı kendi local state’ini tutuyor.
  - Uygulama kapandığında bu veriler kayboluyor; MVP sonrası:
    - Global state (Context/Zustand) + Supabase’e adım adım yazma,
    - Veya her adım sonrasında Supabase’e patch atma (daha güvenli) planlanabilir.

