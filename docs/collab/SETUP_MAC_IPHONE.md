# Mac + iPhone kurulumu (tasarım ortağı)

Hedef: aynı teslim sürümünden başlamak, **kendi** yerel backend'ini ve sentetik
verini kullanmak, değişiklikleri iPhone'da görmek. Doğukan'ın veritabanı
yedeği, gerçek kullanıcıları, fotoğrafları, giriş kodları ve anahtarları
paylaşılmaz; gerekmez.

> Bu kurulum senin Mac'inde ve iPhone'unda **henüz denenmedi**. İlk gün birlikte
> doğrulanacak; takılırsan `npm run collab:doctor` çıktısını Doğukan'a gönder.

## 1. Gerekenler

| Ne | Sürüm / not | Ne zaman |
|---|---|---|
| macOS | Docker Desktop'ın desteklediği güncel bir sürüm | — |
| Boş disk | 25 GB+ (Docker imajları + node_modules) | — |
| Git | `xcode-select --install` (Command Line Tools; tam Xcode **gerekmez**) | buluşmadan önce |
| Node.js | 22 LTS veya daha yeni (Expo SDK 54 en az 20.19 ister; bu paket Node 24.14 ile denendi) | buluşmadan önce |
| Docker Desktop | yalnız yerel backend için; tasarım önizlemesi için gerekmez | buluşmadan önce |
| GitHub hesabı | `dogukandurukan/perfect-match-app` reposuna Doğukan'ın verdiği erişim | Doğukan ekler |
| Claude Code | Mac'te, dosya/terminal erişimli | — |
| iPhone | iOS 16+ ise Developer Mode açılabilmeli; Mac ile **aynı Wi-Fi** | — |
| Tempa development build | Doğukan'ın Apple hesabıyla, **senin iPhone'una kayıtlı** yeni build (§3) | Doğukan hazırlar |

Gerekmeyenler: Xcode, Apple Developer hesabı (senin), EAS CLI, Expo Go.

### Buluşmadan önce yapılacak büyük indirmeler
1. Docker Desktop'ı kur ve bir kez aç ("Running" görünsün).
2. Node.js 22 LTS kur.
3. Repo'yu klonla, teslim commit'ine geç ve `npm ci` çalıştır (Doğukan'ın verdiği komutlarla).
4. `npm run collab:setup` — ilk çalıştırma Supabase Docker imajlarını indirir (birkaç GB, 10–30 dk).
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

Doğrulanan durum (EAS, 2026-10-26, salt okunur):
- Tek iOS development build: 2026-08-26, commit `5dba6a8`, dağıtım **internal** (ad-hoc). Kurulum bağlantısının süresi 2026-09-09'da doldu.
- O tarihten bu yana yerel (native) bağımlılık değişmedi (`package.json` / `app.json` farkı yalnız npm komutları + `eas.json`) → güncel JS sürümü bu build'de çalışır (Doğukan'ın telefonunda kullanılıyor).
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

### A) Yalnız tasarım önizlemesi (backend gerekmez — ilk tur için yeterli)
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
