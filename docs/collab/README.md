# Tempa — tasarım ortağı için başlangıç (ÖNCE BUNU OKU)

Bu klasör, Tempa'nın branding / onboarding tasarımına katılan ortak (ve onun
Mac'indeki Claude Code) içindir. Ürün sahibi ve nihai karar verici: **Doğukan**.

Okuma sırası:
1. Bu dosya — durum, kapsam, kurallar, çalışma yöntemi.
2. [`SETUP_MAC_IPHONE.md`](SETUP_MAC_IPHONE.md) — Mac + iPhone kurulumu, günlük başlatma / durdurma.
3. [`ONBOARDING_INVENTORY.md`](ONBOARDING_INVENTORY.md) — bugünkü onboarding: ekran sırası, tam metinler, seçenekler, kurallar, saklanan değerler.
4. [`WORKING_TOGETHER.md`](WORKING_TOGETHER.md) — dal, commit, push, PR, ürün güncellemesini alma, çakışma.
5. [`HANDOFF_TEMPLATE.md`](HANDOFF_TEMPLATE.md) — her teslimde doldurulacak şablon.
6. Gerekirse: `docs/tempa/DECISIONS.md` (onaylı kararlar), `docs/tempa/ONBOARDING_FLOW.md` (onboarding spec'i).

## 1. Projenin kısa durumu

- **Tempa bir çalışma adı.** Kesin marka adı değil; logo da yok (header'daki "Tempa" yazısı geçici, `components/onboarding-v2/TempaWordmark.tsx`).
- Bu paket ürün commit'i **`f9200c1`** (`tempa/v2-persist-r2`, 2026-10-25) üzerine kuruludur.
- Uygulama: Expo SDK 54 + React Native 0.81 + TypeScript + expo-router, iPhone'da **kendi development build'i** (Expo Go değil). Backend: Supabase (Postgres, Auth, Storage, Realtime).
- Onboarding V2 (7 bölüm) yazılmış ve yerel backend'de uçtan uca çalışıyor. Görsel yön onaylı: fildişi zemin, koyu yeşil buton, Playfair Display başlık + DM Sans metin (`docs/tempa/DECISIONS.md` D2, D42, D43, D46).
- Senin çalışacağın kod, ortak hazırlık commit'inden ayrılan **kendi branding dalın**. Ürün geliştirme dalı ayrı yürüyor; birleştirme kararını Doğukan verir.

### Doğrulama sınırları (bu paket hazırlanırken)

| Kontrol | Durum |
|---|---|
| Kod incelemesi | yapıldı (önizleme gerçek bileşenleri kullanıyor; backend çağrısı yok) |
| Otomatik kontroller | ürün `f9200c1` + paket: `npx tsc --noEmit` temiz; `node scripts/onboarding-v2-checks/run.js` 23 grubun tümü geçti (`design_preview` 19/19 dahil); `scripts/p0-checks` 28·12·14·21 geçti |
| Görsel inceleme | yalnız **web tarayıcısında** (375×812), offline modda, geçici web ayarıyla (ürün `652e2ba` üzerinde yapıldı; `f9200c1` için tekrarlandı — bkz. teslim raporu): üç ekranın hub'ı ve durumları doğru metinle render ediliyor, backend'e istek yok. **iPhone'da değil.** |
| Fiziksel iPhone | **yapılmadı** — senin iPhone'un için yeni development build gerekiyor (SETUP §3) |
| Senin Mac'inde kurulum | **denenmedi** — ilk gün birlikte doğrulanacak |
| "1 standart cevap + 1 sohbet başlatıcı" başvuru yolu | sunucu + istemci kodu var; **telefonda doğrulanmadı** (bkz. INVENTORY §5) |

## 2. Kapsamın

Çalışabileceğin alanlar:
- Marka dili, renk, tipografi, görsel bütünlük **önerileri**.
- Welcome, giriş (login) ve onboarding ekranlarının **sunumu** (yerleşim, boşluk, metin hiyerarşisi).
- Soru metinlerinin anlaşılırlığı ve akış **önerileri**.
- Başvuru tamamlandı / beklemede ekranları.
- Giriş sonrası Home/Discover için **öneri** (mockup / not) — çalışan ürün akışı değiştirilmez.

**İlk tur yalnız üç ekran** (hepsi `DEV · Design preview` içinde):
1. Welcome (bugünkü e-posta ile giriş ekranı + spec'teki henüz yapılmamış "People, not profiles." karşılama ekranı).
2. Temsilî onboarding sorusu: Compatibility 3.2 "How social are you?" (3.1 "What are you looking for?" yerel backend'de artık gizli; niyet D104b "What you're looking for" bölümünde soruluyor — INVENTORY §2b).
3. Başvuru alındı / beklemede (+ reddedildi, yüklenemedi durumları).

### Doğukan'ın onayı gerektirenler (önerebilirsin, tek başına uygulamazsın)
- Soru ekleme / çıkarma, zorunluluk değişikliği, saklanan değerler (option key'leri), gerçek akış sırası.
- Marka adının kesin değişmesi, logo.
- Tüm uygulamaya yayılan tema değişiklikleri (bkz. §4).
- Canlı ekran metinlerinin (copy) değişmesi — önce önizlemede öneri, sonra onay.

### Kapsam dışı (dokunma)
Auth / giriş mantığı, veritabanı, SQL / RPC / erişim kuralları (`supabase/`), eşleşme / skor, sohbet, ödeme, başvuru kabul kuralları, `scripts/local-backend/`, `local-backend/`, `lib/backendConfig.ts`, `lib/supabaseClient.ts`, `app.json` / `eas.json`, `package.json` bağımlılıkları (yeni paket = yeni iPhone build'i).

## 3. Hangi dosyaları değiştirebilirsin

| Dosya | Ne için | Etki alanı |
|---|---|---|
| `lib/dev/designPreview.ts` | önizleme durumları, sentetik içerik, **WELCOME_PROPOSALS** (yeni karşılama metni denemeleri) | yalnız DEV önizleme — serbest |
| `components/dev/design/DesignPreview.tsx` | önizleme ekranları, spec welcome düzeni denemeleri | yalnız DEV önizleme — serbest |
| `components/onboarding-v2/account/AccountFields.tsx` | giriş ekranı metni / onay satırı / hata görünümü | **canlı** giriş ekranı + önizleme → onaylı değişiklik |
| `components/onboarding-v2/yourProfile/ApplicationFields.tsx` | başvuru alındı ekranı, `STATUS_COPY` | **canlı** durum ekranı + onboarding son adımı → onaylı değişiklik |
| `components/onboarding-v2/OnboardingScreen.tsx`, `OnboardingHeader.tsx`, `OnboardingPrimaryButton.tsx`, `OnboardingOptionCard.tsx`, `OnboardingTextField.tsx` | onboarding'in ortak iskeleti | **tüm onboarding** (33 ekran) → onaylı değişiklik |
| `lib/onboardingV2/compatibility.ts` (yalnız `title` / `helper` metinleri) | soru metni | canlı onboarding; **`key` değerlerine dokunma** (saklanan veri) |
| `components/onboarding-v2/TempaWordmark.tsx` | geçici wordmark | her onboarding header'ı |
| `lib/onboardingV2/theme.ts` | renk / font / boşluk token'ları | **58 dosya**: tüm onboarding + V2 sohbet, Discover, Matches, Activity, ilgi alanları → **global, onaysız değiştirme** |

## 4. Global tema / metin değişikliklerinin etkisi

- `lib/onboardingV2/theme.ts` (`obColors`, `obFonts`, `obSpacing`) yalnız onboarding'i değil, 2026-10-01'den beri ana V2 ekranlarını da besliyor (58 import). Bir renk değişikliği sohbet, Discover, Matches ve Activity'yi de değiştirir.
- `lib/homeTheme.ts` ayrı bir palet (33 import) — ana ekranlar. Onboarding önizlemesini etkilemez.
- Ortak onboarding bileşenleri (`components/onboarding-v2/*`) bir kez değişince 7 bölümün tamamında değişir.

**Yöntem:** global dosyayı doğrudan değiştirmek yerine
1. Önce `DesignPreview.tsx` içinde **yerel stil / metin varyantı** dene (yalnız önizleme etkilenir).
2. Önce/sonra ekran görüntüsüyle Doğukan'a sun.
3. Onay gelirse tek, küçük bir değişiklik paketinde paylaşılan dosyaya taşı ve etkilenen ekranları listele.

Not: önizlemedeki gerçek bileşenler `theme.ts`'i doğrudan okur; renk paleti denemesi için bileşen içi "tema anahtarı" henüz yok (büyük refactor olurdu). Palet denemeleri spec welcome düzeninde ve kendi branding dalında `theme.ts` üzerinde yapılır — dal Doğukan onaylamadan birleştirilmez.

## 5. Çalışma yöntemi (küçük paketler)

1. Fikri ChatGPT'de geliştir (mockup, metin).
2. Claude Code'a **tek ekran / tek konu** ver: "Welcome başlığı için 2 varyantı WELCOME_PROPOSALS'a ekle" gibi.
3. iPhone'da önizlemede bak (Metro çalışırken kaydetmek yeterli; olmazsa terminalde `r`).
4. Kontroller: `npx tsc --noEmit` ve `node scripts/onboarding-v2-checks/run.js`.
5. Kendi dalında (`tempa/branding-r1`) küçük commit, sonra **yalnız kendi dalını** push et ve PR aç (taban: `tempa/collab-design-prep-r2`) — ayrıntı [`WORKING_TOGETHER.md`](WORKING_TOGETHER.md). Ürün dalına push / merge yok; PR açıklaması [`HANDOFF_TEMPLATE.md`](HANDOFF_TEMPLATE.md).
6. Bir paket = en fazla birkaç dosya. Auth / DB / kurallar dosyalarına hiç dokunma.

Sırlar: `.env*` dosyalarını, giriş kodlarını, anahtarları asla commit'leme, ekran görüntüsüne / ChatGPT'ye koyma. Uygulamada yalnız `@tempa-test.example.com` sentetik hesaplar ve `@example.com` örnek adresleri kullan.

## 6. Hızlı komutlar

| Ne | Komut |
|---|---|
| Kurulum kontrolü (bir şey değiştirmez) | `npm run collab:doctor` |
| Yalnız tasarım önizlemesi (backend gerekmez) | `npm run collab:preview` |
| Yerel backend'i ilk kez kur (bir kez) | `npm run collab:setup` |
| Backend + Metro (günlük, giriş yapılabilir) | `npm run collab:start` |
| iPhone ↔ Mac bağlantı kontrolü | `npm run collab:lan` |
| Backend'i durdur (veri kalır) | `npm run collab:stop` · Metro: terminalde `Ctrl+C` |

iPhone'da: Tempa development build'i → Mac'teki Metro → giriş yapılmamış ekran → **DEV · Design preview** → ekran + durum seç. Ekrandaki geri oku önizleme listesine döner.
