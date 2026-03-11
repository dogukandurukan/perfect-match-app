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
