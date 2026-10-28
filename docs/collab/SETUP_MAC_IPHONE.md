# Mac + iPhone kurulumu (tasarım ortağı)

Hedef: aynı teslim sürümünden başlamak, **kendi** yerel backend'ini ve sentetik
verini kullanmak, değişiklikleri iPhone'da görmek. Doğukan'ın veritabanı
yedeği, gerçek kullanıcıları, fotoğrafları, giriş kodları ve anahtarları
paylaşılmaz; gerekmez.

> Bu kurulum senin Mac'inde ve iPhone'unda **henüz denenmedi**. İlk gün birlikte
> doğrulanacak; takılırsan `npm run collab:doctor` çıktısını Doğukan'a gönder.

## 1. Gerekenler

Önce Mac'i kontrol et:

```bash
sw_vers -productVersion
uname -m
sysctl -n hw.memsize
df -h ~
xcode-select -p
```

Bu komutlar sırasıyla macOS sürümünü, işlemciyi (`arm64` = Apple Silicon, `x86_64` = Intel), belleği (≥ 8 GB önerilir; 16 GB rahat), boş diski (25 GB+) ve Command Line Tools kurulu mu olduğunu gösterir.

| Ne | Sürüm / not | Gerekli mi |
|---|---|---|
| Git | Command Line Tools'taki `/usr/bin/git` yeterli (yoksa `xcode-select --install`) | **evet** |
| Node.js + npm | **Node 22 LTS** önerilir. Expo SDK 54'ün alt sınırı 20.19.x; Doğukan 24.14 kullanıyor. Kurulum: nodejs.org'dan macOS **.pkg** yükleyicisi, işlemcine uygun olanı. Homebrew **gerekmez** | **evet** |
| Container runtime | **Docker Desktop for Mac** (Apple Silicon veya Intel sürümü). Kurmadan önce Docker'ın güncel sistem gereksinimlerinde macOS sürümünün desteklendiğini kontrol et (docs.docker.com → Install Docker Desktop on Mac). Betikler `docker` komutunu kullanır; OrbStack / Colima da `docker` sağlar ama **denenmedi** | yerel backend için **evet**; yalnız backend'siz önizleme için hayır |
| Supabase CLI | **kurma** — betikler `npx supabase@2.120.0` ile kendisi indirir (Node gerekir) | hayır |
| Claude Code | Mac'te, dosya / terminal erişimli | evet |
| GitHub hesabı | `dogukandurukan/perfect-match-app` erişimi (Doğukan ekler) | evet |
| iPhone | iOS 16+ (Geliştirici Modu açılabilmeli), Mac ile **aynı Wi-Fi** (misafir ağı değil) | evet |
| Tempa development build | Doğukan'ın EAS / Apple hesabıyla **senin iPhone'una kayıtlı** yeni build (§3) | evet (Doğukan hazırlar) |

**Gerekmeyenler (fiziksel iPhone yolu):**
- **Tam Xcode gerekmez.** Development build EAS'in bulut sunucularında Doğukan'ın Apple hesabıyla derlenir. Senin Mac'in yalnız JavaScript'i Metro ile iPhone'a sunar.
- Senin Apple Developer hesabın, EAS CLI ve Expo Go gerekmez.
- **Homebrew ve GitHub CLI (`gh`) gerekmez.**
  - Klonlama ve okuma için git yeterli.
  - Kendi dalını push etmen gerektiğinde git, GitHub kullanıcı adını ve bir **Personal Access Token** ister (GitHub → Settings → Developer settings → Fine-grained token, yalnız bu repo, Contents: Read and write). macOS bunu Anahtar Zinciri'nde saklar.
  - `gh` yalnız isteğe bağlı bir kolaylıktır.

**İsteğe bağlı: iOS Simülatörü (bugün gerekmez, denenmedi):**
- **Tam Xcode** gerekir (App Store; ~15 GB+, kurulumdan sonra bir kez açılıp ek bileşenleri yüklenir) ve yerel derleme yapılır: `npx expo run:ios`.
  - Bu komut git dışında kalan bir `ios/` klasörü üretir ve CocoaPods ister.
  - İlk derleme uzun sürer.
- Repo'da simülatör için bir EAS build profili **yok**; eklemek bir yapılandırma değişikliğidir ve Doğukan'ın onayını gerektirir.

### Buluşmadan önce yapılacak büyük indirmeler
1. Node.js 22 LTS (.pkg) — `node -v`, `npm -v`.
2. Docker Desktop — kurup bir kez aç, "Running" görünsün; `docker info` hata vermemeli.
3. Repo: `~/tempa` klasörüne klonla.
   - Klasör **zaten varsa silme veya üzerine yazma**; dur ve sor.
   - Tasarım klasörün `~/TempaApp`'e **dokunulmaz**.
4. `npm ci`, sonra `npm run collab:setup`. İlk çalıştırma Supabase Docker imajlarını indirir (birkaç GB, 10–30 dk).
5. iPhone: Doğukan'ın gönderdiği kayıt bağlantısını aç (UDID kaydı), sonra build bağlantısından uygulamayı kur.

## 2. Repo ve kendi dalın

Teslim commit'i ve dal adı Doğukan'ın verdiği başlangıç mesajında yazar.
Kendi dalın teslim commit'inden açılır (ör. `tempa/branding-r1`); ürün geliştirme
dalına doğrudan push / merge yapılmaz.

```bash
npm ci
npm run collab:doctor
```

### Ortam dosyası
Elle doldurulacak bir `.env` yok. `npm run collab:setup` yerel backend adresini
ve anahtarlarını **kendisi** üretip `.env.local-backend.local` dosyasına yazar
(git'e girmez, izin 600). Değişken adları için örnek:
[`env.local-backend.example`](env.local-backend.example). Bu dosyayı kimseyle
paylaşma, değerlerini bir yere yapıştırma.

## 3. iPhone: hangi yol?

Uygulama Expo Go ile değil, kendi **development build**'iyle çalışır
(`expo-dev-client`, push bildirimi vb. yerel modüller; Expo Go denenmedi ve önerilmiyor).

Doğrulanan durum (EAS + git, 2026-10-28, salt okunur):
- EAS projesi `@dogukandurukan/dating-app`'te şimdiye kadar **2 iOS build** var (2026-06-02, 2026-08-26), ikisi de elle başlatılmış. Son development build: 2026-08-26, commit `5dba6a8`, dağıtım **internal** (ad-hoc). Kurulum bağlantısının süresi 2026-09-09'da doldu.
- `5dba6a8` → `0a03bd7`: `package.json`, `package-lock.json`, `app.json` **değişmedi** (yalnız `eas.json` ve `app.config.js` eklendi; ikisi de native kod değil) → güncel JS bu native içerikle çalışır (Doğukan'ın telefonunda kullanılıyor). Bu kit `package.json`'a yalnız `collab:*` npm komutları ekler.
- EAS update yok, `expo-updates` kurulu değil: kod telefona yalnız Metro üzerinden gelir.
- Internal build yalnız provisioning profilinde **kayıtlı** cihazlara kurulur; senin iPhone'un kayıtlı değil → **yeni build gerekir** (aynı native içerik, yeni cihaz listesi).
- Gerekenler: Doğukan'ın Apple Developer Program üyeliği (aktif olmalı) ve EAS hesabı. Senin Apple hesabına, Xcode'a gerek yok.

Adımlar:

1. **Doğukan:** `npx eas device:create` → çıkan kayıt bağlantısını sana gönderir.
2. **Sen (iPhone):** bağlantıyı Safari'de aç → profili yükle (Ayarlar'da "Profil İndirildi" → Yükle). Bu yalnız cihaz kimliğini (UDID) kaydeder.
3. **Doğukan:** `npx eas build --profile development --platform ios` (EAS yeni cihazı profile ekler) → kurulum bağlantısını gönderir.
4. **Sen:** bağlantıdan uygulamayı kur. iOS 16+: Ayarlar → Gizlilik ve Güvenlik → **Geliştirici Modu** → aç → yeniden başlat.
5. Uygulama ilk açılışta "Yerel ağ" izni ister → **İzin Ver** (Metro'yu bulmak için gerekli).

Yeni bir yerel modül (npm paketi) eklenirse build yeniden alınır; metin / stil / bileşen değişiklikleri için gerekmez.

## 4. Günlük akış

Hangi ekran hangi modda:

| Ekran (ilk tur) | Mod |
|---|---|
| Discover (örnek profiller) | A — **DEV · Design preview → Main screens · Discover** |
| Açık profil (başkası / kendi Preview) | B — test hesabıyla giriş; Discover veya Matches'ten bir profil, Profile → Preview |
| Edit profile | B — test hesabıyla giriş; Profile → Edit profile |

### A) Yalnız tasarım önizlemesi (backend gerekmez)
```bash
npm run collab:preview
```
- Uygulama "offline" bir adrese (`http://127.0.0.1:59999`, orada hiçbir şey yok) bağlanır; hiçbir şey okunmaz / yazılmaz. Rozet: `LOCAL · local:59999`.
- iPhone: Tempa build'i → geliştirme sunucuları listesinde Mac'in → giriş yapılmamış ekran → **DEV · Design preview**.
- Bu modda giriş / kayıt çalışmaz (beklenen).

### B) Gerçek akış, kendi yerel backend'inle
```bash
npm run collab:setup     # yalnız ilk sefer
npm run collab:start     # her gün
```
- `collab:start` backend'i (veri korunarak) açar, Mac'in Wi-Fi adresini **o an** bulur, Metro'yu başlatır ve sentetik test hesabı için tek kullanımlık giriş kodunu terminale yazar.
- iPhone: giriş yapılmamış ekran → **DEV · Test account sign-in** → terminaldeki kod.
- Yeni kod: `node scripts/local-backend/login-code.mjs tempa-matches-tester@tempa-test.example.com`.
- Yerel posta kutusu (kodlar): Mac'te http://127.0.0.1:55424.

### Kapatma
- Metro: terminalde `Ctrl+C`.
- Backend: `npm run collab:stop` (yalnız Tempa'nın container'larını durdurur, veri kalır).
- Ertesi gün: aynı komutla tekrar başlat. Mac'in Wi-Fi adresi değişmiş olabilir; betikler her seferinde yeniden bulur.

## 5. Bağlantıyı iki ayrı adımda doğrula

iPhone'da `127.0.0.1` iPhone'un kendisidir, Mac değil. Önce Mac adresini öğren:
```bash
npm run collab:lan
```
1. **Metro:** iPhone Safari → `http://<Mac adresi>:8081/status` → `packager-status:running` görmelisin.
2. **Backend** (yalnız mod B): iPhone Safari → `http://<Mac adresi>:55421/auth/v1/health` → kısa bir JSON (ör. "No API key") = erişilebilir.

Mac tarafı OK, iPhone açamıyorsa: aynı Wi-Fi mi (misafir ağları cihazları birbirinden ayırır)? macOS Güvenlik Duvarı node / Docker için izin istedi mi? iPhone'da uygulamaya Yerel Ağ izni verildi mi (Ayarlar → Tempa)?

## 6. Güvenlik korumaları (betikler ne yapar / ne yapmaz)

- `collab:setup` Mac'te zaten bir Tempa yerel backend'i (container **veya** veri volume'u) varsa **hiçbir şey yapmadan durur** — tekrar çalıştırmak veri silmez. Tempa portları (55420–55429) başka bir programda ise durur.
- Kurulumdan sonra veritabanının boş olduğunu doğrulamadan sentetik veri yazmaz; sonra yalnız `@tempa-test.example.com` hesapları olduğunu kontrol eder.
- Betikler repo'nun `dogukandurukan/perfect-match-app` olduğunu ve `local-backend/supabase/config.toml`'un proje `tempa-local` / port 55421 olduğunu doğrular; değilse durur.
- Yerel betikler yalnız `http://127.0.0.1:55421`'i kabul eder; uygulama `local` modda yalnız loopback / özel LAN adresini ve canlı olmayan bir anahtarı kabul eder. Ortak DEV veya canlı projeye hiçbir komut bağlanmaz.
- Sıfırlama (`db reset`) içeren bir komut sana verilmedi. Sıfırlama gerekirse karar Doğukan'ındır.

## 7. Sorun giderme

| Belirti | Ne yap |
|---|---|
| `STOPPED: Docker is not running` | Docker Desktop'ı aç, "Running" olunca tekrar dene |
| `port 8081 is already used` | başka bir terminalde Metro açık → orada `Ctrl+C`; ya da `npm run collab:preview -- 8090` |
| iPhone'da sunucu listesi boş | §5 adım 1; olmazsa build ekranında "Enter URL manually" → `http://<Mac adresi>:8081` |
| Uygulama kırmızı ekran "[backend] …" | Metro'yu `collab:preview` veya `collab:start` ile başlattığından emin ol (düz `npx expo start` değil) |
| Kod kabul edilmiyor | kod ekranındaki adres doğru mu? En yeni kodu kullan (`login-code.mjs`) |
| Ne olduğunu anlamadın | `npm run collab:doctor` çıktısını Doğukan'a gönder (anahtar / kod içermez) |
