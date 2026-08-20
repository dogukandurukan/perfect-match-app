# Perfect Match — CLAUDE.md

Bu dosya, repo + terminal erişimi olan agent'ları projeye hızlı ve doğru şekilde tanıtmak içindir. Her oturumun ortak zeminidir.

**Repo:** `github.com/dogukandurukan/perfect-match-app` · Yerel: `~/dating-app-recovered`
**Aşama:** Alpha, MVP öncesi (~%75–80). Tek geliştirici (Doğukan), part-time ~10–15 saat/hafta.
**Supabase proje ref:** `fyqwjduzpnjuxqsloxih`

---

## 0. ÖNCE BUNU OKU — kritik kurallar (agent'ların düştüğü tuzaklar)

1. **RPC ve RLS policy'leri git'te DEĞİL, Supabase içinde yaşıyor.** `get_top_matches` (eşleştirme motoru) ve tüm Row Level Security politikaları veritabanında. Bir davranışı kodda bulamıyorsan DB'ye bak; grep RPC gövdesine giremez — `SELECT pg_get_functiondef('public.get_top_matches'::regproc);` ile çek.
2. **İSİMLE değil ID ile ilerle.** Seed'de 13 tane "Asli" var. Kullanıcı ayrımını her zaman UUID ile yap, `first_name` ile asla.
3. **DB'ye yazan değişiklikten önce constraint/policy kontrol et.** Kod doğru olsa da DB reddedebilir (örn. `matches.status` için `matches_status_check`). RLS bir insert'i sessizce engelleyebilir.
4. **Bir katmanı elemeden diğerine geçme.** Teşhis sırası: (a) şikayeti grep'le (`--exclude-dir=node_modules --exclude-dir=.git`), (b) kodda yoksa DB/RPC'yi tara, (c) constraint/policy'yi doğrula. Tahminle katman atlama.
5. **Supabase sorgu hataları sessizce yutuluyor.** Çoğu yerde `.single()`/`.maybeSingle()` sonucunun `error`'ı loglanmıyor. Bir ekran "boş" görünüyorsa büyük ihtimalle select hata veriyordur (var olmayan **tek** bir kolon tüm select'i null yapar). Şüphelendiğinde `const { data, error } = ...` yapıp error'ı logla.
6. **Değişiklikleri küçük ve kapsamlı tut: test → commit → sıradaki.** İstenmeyen refactor / import düzeni / stil temizliği yapma.

**Çalışma tarzı (geliştiricinin tercihi):** adım adım ilerle — tek problem bul, göster, fix et, dur. Kapsamlı tara ama tek seferde her şeyi değiştirme. Ajanları gerektiğinde kullan ama context'i yorma.

---

## 1. Proje nedir

Skor bazlı otomatik eşleştirmeye dayalı bir **dating uygulaması**. Klasik "sonsuz swipe" yerine iki-adımlı, niyetli tanışma akışı.

- **Çekirdek farklılaştırıcı (henüz kurulmadı):** Hinge tarzı **bağlamlı beğeni** — bir profilin belirli öğesine (foto/soru) beğeni. `likes` tablosu planlı; asıl ürün kimliği burada olacak.
- **İkinci tez:** "Yavaş dating" — davet → kabul → sohbet → buluşma (check-in) funnel'ı; hız yerine gerçek buluşma.
- **UI referansı:** Hinge. Altın accent `#B8860B` (`colors.accent`).
- **Kuzey-yıldızı metrik:** **buluşma oranı** (match → chat → gerçekten buluştu mu). Hem ürün farkı hem en değerli veri.

Çekirdek döngü uçtan uca doğrulanmış (like → davet → kabul → chat → mesaj).

---

## 2. Teknoloji ve ortam

**Stack:** Expo + React Native + TypeScript + `expo-router` + Supabase (Postgres + Auth + Storage + Realtime).
**Görüntü:** `expo-image`. **Realtime chat:** Supabase channel `postgres_changes` INSERT aboneliği.
**Çalışma modu:** Expo Go (development build DEĞİL → **push notification henüz yok**; dev-build göçü planlı büyük iş, `eas.json` yok).

### Çalıştırma
```bash
cd ~/dating-app-recovered
# Asli'nin telefonu (iPhone XR) LAN'da bağlanmıyor → tünel şart:
npx expo start --tunnel -c
# İki telefon da Mac'le AYNI wifi'deyse LAN daha hızlı:
npx expo start -c
```
- **ngrok patlarsa** ("failed to start tunnel"): `npm install -g @expo/ngrok`, tekrar dene ya da birkaç dk bekle.
- **QR açılmazsa:** Metro'da `s` (Expo Go modu); telefonda Expo Go'yu tamamen kapat-aç.
- **Kod değişince:** `r` = reload (saf JS/TS fix'lerde yeter). Native modül değiştiyse Expo Go'yu tam kapat-aç şart. (foto yeniden yüklemek ≠ reload.)

### DB / migration uygulama (DDL) — DİKKAT
- **`supabase db push` KÖR ÇALIŞTIRMA.** Remote şema geçmişi CLI-tracked değil (geçmiş değişiklikler SQL editor'dan elle yapıldığından 8 yerel migration remote'ta "unapplied" görünüyor). Push, migration geçmişini önce onarmadan güvenli değil.
- **Tek dosyalık DDL uygula:** `supabase db query --linked -f <dosya>` (CLI bu makinede authenticated). Ya da Supabase Studio → SQL Editor'a yapıştır.
- **Supabase MCP bağlantısı bu ajan oturumlarında salt-okunur** → DDL/yazma CLI ister. (Örnek: `likes` tablosu 2026-08-16'da `db query --linked -f` ile canlıya alındı.)

### Test hesapları (ID ile ilerle!)
| Kişi | UUID |
|---|---|
| Doğukan | `e5426159-0d49-42c5-b79d-0d1b3cdfea9a` |
| Asli (gerçek 2. hesap) | `1d2a579f-434c-4392-9556-974c8b2617e0` |

---

## 3. Mimari

### Çekirdek döngü
```
Home (keşif) ──like──▶ Matches ("Let's meet" davet)
                          ├─ karşı taraf kabul ──▶ chat açılır ──▶ mesajlaşma
                          └─ confirmed meetups ──▶ check-in
```
Funnel iki-adımlı ve iki cinsiyette **simetrik** (bkz. §7 ürün kararları).

### Ekran haritası (`app/`)
| Dosya | Rol |
|---|---|
| `(tabs)/index.tsx` | Home — keşif kartları (`get_top_matches` RPC), like |
| `(tabs)/matches.tsx` | Matches — davet gönder/al, açık sohbetler, pass |
| `(tabs)/messages.tsx` | Konuşma listesi |
| `(tabs)/notifications.tsx` | Alerts |
| `(tabs)/map.tsx` | Bölge yoğunluk haritası (rapor "ÖLÜ" diyordu ama route aktif — silmeden önce teyit et) |
| `(tabs)/vibe.tsx` · `(tabs)/profile.tsx` | Vibe akışı · kendi profil |
| `chat.tsx` | Birebir sohbet — realtime, icebreaker, chat-gate |
| `user-profile.tsx` | Karşı tarafın profili + block/report |
| `premium.tsx` | Monetizasyon iskeleti |
| `checkin.tsx` · `micro-intro.tsx` | Buluşma check-in · mikro tanışma |

### Önemli lib helper'ları (`lib/`)
- `matchInvite` → `orderedPair(a, b)` — iki kullanıcıyı deterministik sıraya sokar (user_a_id / user_b_id).
- `icebreakers` → `generateIcebreakers(me, them, matchPct)`.
- `labels` → `formatIntentLabel`, `formatDrinkingLabel`, `formatSmokingLabel`, `formatAvailabilityLabel`.
- `designTokens` → `colors` (accent `#B8860B`), `spacing`, `radius`. **Borç:** çoğu ekran gri tonlarını ve `ACCENT`'i hardcode ediyor; `border/textMuted/bgSubtle` eklenmeli.
- **Foto URL için İKİ ayrı helper var, karıştırma:**
  - `resolveProfilePhotoUrl` → `getProfilePhotoPublicUrl(path)` — **public** URL (chat başlığı, mesaj avatarları).
  - `userPhotosStorage` → `resolveProfilePhotoUrl(path, 3600)` — **signed** URL, 1 saat (user-profile ekranı).
  - Storage bucket: `user-photos` (public).

### Veri modeli — anahtar tablolar
Kod referansına göre kullanılan tablolar: `profiles`, `matches`, `onboarding_answers`, `messages`, `notifications`, `blocks`, `reports`, `venues`, `match_pair_scores`.

**`profiles`** (DB'den doğrulanmış kolonlar — dikkat: **`intent` YOK**):
```
availability_days, availability_hours, bio, city, core_value, country_code,
created_at, current_step, daily_invites_count, daily_invites_reset_at,
daily_views_count, daily_views_reset_at, date_of_birth, dealbreaker, deleted_at,
dial_code, discovery_age_max, discovery_age_min, discovery_max_distance, district,
drinking, education, education_detail, expo_push_token, favorite_activity,
favorite_book, favorite_movie, favorite_music, favorite_spots,
first_date_expectation, first_name, full_address, gender, hide_location, hobbies,
id, impressed_by, is_hidden, languages, last_name, lat, lng, meeting_environment,
meeting_preferences, morning_night, neighborhoods, notify_meeting_invite,
notify_messages, notify_new_match, pets, phone_number, photo_verified, photos,
preferred_locations, recharge_style, religion, setup1_completed, setup_completed,
smoking, updated_at, username, vibe, zodiac_sign
```
**`matches`** — `id, status, chat_opened, match_score, user_a_id, user_b_id, created_at, expires_at, updated_at`. `status` ∈ `pending | accepted | expired | passed` (constraint `matches_status_check`). `expired` = süre doldu; `passed` = elle geçildi (bilinçli olarak ayrı).
**`messages`** — `id, sender_id, receiver_id, content, created_at`
**`onboarding_answers`** — niyet/kişilik verisi. **`intent` verisi burada** (profiles'ta değil). KVKK açısından gözden geçirilecek.
**`blocks`** — `blocker_id, blocked_id` · **`reports`** — `reporter_id, reported_id, reason`
**`likes`** — **UYGULANDI (2026-08-16, CLI ile canlıya alındı)** (`supabase/migrations/20260816120000_create_likes.sql`); tablo + 3 RLS policy birebir. Eski uyumsuz tablo (`liked_id`, target_type/note/status yok, 0 satır) drop edildi. **Client Home'da BAĞLI** (❤ + Note tek `recordLike` upsert). **Likee-okuma DA BAĞLI (2026-08-18)** — `get_my_likers` SECURITY DEFINER RPC (`supabase/migrations/20260817100100_get_my_likers_rpc.sql`, CLI ile uygulandı) + `profiles.is_premium` stub kolon (`20260817100000_profiles_is_premium.sql`); Buzz `notifications.tsx` bu RPC'den besleniyor. Dondurulmuş şema (Home bağlamlı-beğeni + Buzz Faz B tek tablo):
```sql
create table likes (
  id          uuid primary key default gen_random_uuid(),
  liker_id    uuid not null references profiles(id) on delete cascade,
  likee_id    uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('photo','prompt','profile')),
  target_key  text,          -- foto path/index VEYA prompt kolon-anahtarı; 'profile' iken null
  note        text check (char_length(note) <= 240),   -- opsiyonel Bumble "Note"; ücretsiz yazılır
  status      text not null default 'sent'
              check (status in ('sent','matched','passed','expired')),
  match_id    uuid references matches(id) on delete set null,  -- ön-sinyal → davet bağı
  created_at  timestamptz not null default now(),
  unique (liker_id, likee_id)   -- MVP: kişi başına tek hedefli beğeni (şema çok-reaksiyona gevşetilebilir)
);
```
RLS/premium (Faz B): likee her zaman **count** görür; `note`/`target_key`/kimlik yalnız premium (Buzz unlock) → RPC blur'lu vs full döndürür.

### RPC — `get_top_matches` (Supabase içinde, git'te yok)
Eleme penceresi:
```sql
m.status IN ('pending', 'accepted')
OR (m.status = 'expired' AND m.created_at > now() - interval '14 days')
OR (m.status = 'passed'  AND m.created_at > now() - interval '42 days')
```
Pencere `created_at`'e bakıyor (pass anına değil); kesin "pass'ten N gün" istenirse `updated_at`'e çekilmeli. `not_sure_yet` matching ağırlığı (20, normalizer 150) sert olabilir — açık karar. Diğer RPC'ler: `try_send_invite`, `upsert_match`.

### RLS modeli (denetlendi)
- **messages:** INSERT sadece sender isen ve accepted match varsa (simetrik); SELECT/UPDATE sadece sender/receiver. Eski `messages_own` bypass'ı kapatıldı.
- **matches:** tek insert policy `matches_insert_own`, `with_check (auth.uid() = user_a_id OR auth.uid() = user_b_id)`. Gevşek `matches_insert_policy` silindi.
- **Kalan not (beta öncesi):** `profiles_select_all` + `onboarding_select_all` herkese açık SELECT veriyor → `is_hidden`/`deleted_at` filtresi client + RPC'de uygulanmalı (soft-delete'li profiller sızabilir). RLS repoda yok — `supabase db pull` ile şema+policy çekilmeli.

---

## 4. Güncel durum & açık işler

**Bitmiş (son oturumlar):**
- Chat → profil navigasyonu + block/report erişimi; pass→'passed' (3 katman senkron); RLS güvenlik denetimi (2 açık kapatıldı); sol (karşı taraf) mesaj avatarları.
- **`intent` bug FİX'Lİ** — `user-profile.tsx` artık `intent`'i `profiles` select'inden çıkarıyor ve ayrı `onboarding_answers` sorgusuyla çekip profile'a birleştiriyor ("Looking for" satırı geri geldi).
- **Ortak `ErrorState` bileşeni** (`components/ErrorState.tsx`) — index/messages/notifications/map ekranlarına retry ile bağlandı (gerçek hata artık boş listeden ayırt ediliyor).
- **chat.tsx** — `chatOpened===null` iken spinner (kilit-ekranı flaş'ı giderildi); gönderme hatası artık görünür (inline uyarı + metin geri konur).

**Bitmiş (2026-08-15):**
- ✅ **Sağ (kendi) mesaj avatarı** — `chat.tsx`'e `myPhotoUrl` + `myInitial` state + `profiles(photos, first_name)` fetch eklendi; `renderMessage`'ın `isMine` dalı balonun sağında avatar gösteriyor (sol tarafın simetriği). Commit `fa060e1`.
- ✅ **Balon avatarına tıklayınca profile git** — sol (theirs) son-balon avatarı `TouchableOpacity` ile header'ın `openUserProfile()`'ına bağlandı. Commit `2481e30`.
- ✅ **Error state audit TAMAMLANDI** — ortak `ErrorState` retry'lı olarak tüm ana ekranlara bağlandı: `vibe` (`77def58`), `user-profile` (`35faf25`), `matches` (`77b9cec`), `chat` gate (`a944308`). Desen: `error`+`reloadKey` state, fetch `try/catch`, kısmi içerik varsa korunur (`error && !hasContent`). Daha önce index/messages/notifications/map zaten bağlıydı. rn-ui-reviewer (built-in `claude`+sonnet ile) vibe & matches'i review etti; matches'te kritik bir bulgu (myMatches error yutulması) düzeltildi.

**Bitmiş (2026-08-16):**
- ✅ **Kalan sessiz-yutulan select hataları kapandı** — matches `profiles`(by id) davet/sohbet listesi hatası artık error state'e taşınıyor; `intentRows` (yardımcı veri) `console.warn` ile loglanıp bloklamadan degrade oluyor (`52984bf`). chat `fetchMessages` hatası → `messagesError` state + `ErrorState` retry, kısmi içerik korunur (`a468d59`). **Error-state serisi tamamen bitti.**
- ✅ **chat klavye boşluğu giderildi (cihazda doğrulandı)** — `ScreenContainer` alt safe-area padding'i chat'te 0'landı, alt inset input satırına taşındı (klavye kapalıyken `insets.bottom`, açıkken 12; `Keyboard` show/hide listener). `keyboardVerticalOffset` sabit 90 → `0` (bu düzende `behavior='padding'` offset'i düz boşluk olarak koyuyor; boşluk ≈ offset). Commits `3c9418f`+`3ca3602`.
- ✅ **chat input bar cila** — send butonu 40→44pt; `'↑'` glyph → `Ionicons arrow-up` + gönderirken `ActivityIndicator`; send+back butonuna `accessibilityRole/Label/State`; `designTokens`'e `bgSubtle/border/textMuted` eklendi ve chat input hardcode grileri + `radius.pill` token'a geçti (`33cd58d`). Setleri `phosphor` yerine mevcut `@expo/vector-icons`/`Ionicons` ile yaptık.
- ✅ **chat foto ekleme butonu — UI iskeleti (P2 Katman 1)** — `expo-image-picker` eklendi; input solunda kamera butonu (44pt, nötr dolgu, `camera-outline`, a11y) → Alert sheet (Take Photo / Choose from Library) → izin + picker açılıyor; seçim sonrası şimdilik **"Coming soon"** (upload YOK, bilinçli) (`95ab34e`).

**Bitmiş (2026-08-16, devam):**
- ✅ **Alerts → "Buzz" sekmesi: premium likes redesign (A→B fazlı, Faz A).** Ürün kararı: A→B fazlı — önce backend'siz premium kabuk, sonra ayrı oturumda gerçek likes backend. **Sekme "Alerts" → "Buzz"** (`_layout.tsx` title+headerTitle; ekran başlığı "Buzz"). `notifications.tsx` üç bölge (kullanıcı feedback v3 — sıralama: **önce featured, sonra feed, EN ALTTA likes footer**): (1) **`FeaturedCard`** (ÜSTTE, `ListHeaderComponent`) — `invite_accepted` ("X said yes") + `new_invite`/`meeting_invite` ("X wants to meet") yüksek-sinyal: 52pt avatar + rozet (checkmark yeşil / cafe altın) + kalın başlık + renkli aksiyon pill ("Pick time"/"Respond"), gölgeyle öne çıkar. (2) **Compact feed** (ORTA) — mesaj/check-in/expiry `Ionicons` tint rozet satırları ("Earlier" başlığı). (3) **`LikesSection`** (EN ALTTA, `ListFooterComponent`) — "N people like you" + **4'lü blur STRIP** (3 blur'lu yüz tile + 4. "+N" sayaç tile; `expo-image` `blurRadius:22`, yeni bağımlılık YOK; `resolveProfilePhotoUrl` signed URL, foto yoksa baş-harf fallback; her tile'da faint heart) + full-width davetkâr **"Unlock to see who likes you"** butonu → `/premium`; likeCount 0 iken null. Zone sınıflandırması tek yerde: `LIKE_TYPES`/`FEATURED_TYPES` + `isLikeType`/`isFeaturedType`; `LIKE_FACE_TILES=3`; zone'lar `useMemo`. Faz B bağı: `LikesSection` count/avatars kaynağı → B'de `likes` tablosuna geçecek, premium'da unblur. tsc temiz. **Commit edilmedi; cihazda görsel doğrulama sürüyor.**

**Not (2026-08-16):** `messages` sekmesi de yeniden adlandırıldı: **"Messages" → "Chats"** (`_layout.tsx` title+headerTitle + `messages.tsx` ekran başlığı). Görünen alt bar: Home · Matches · Buzz · Chats (Vibe/Map/Profile/explore zaten `href:null`, bardan gizli ama erişilebilir; Profile sağ-üst avatardan).

**Bitmiş (2026-08-17/18):**
- ✅ **Home Bumble redesign + likes write-side** (`4bba4d9`, 2026-08-17) — interleave scroll profil, Note bottom-sheet composer, About-me/Looking-for/Interests/Languages/Location chip sistemi, verified rozeti; Home ❤+Note tek `recordLike`→`likes` upsert.
- ✅ **Buzz Faz B — READ side TAMAMLANDI** (`a7a448d`) — `profiles.is_premium` stub + `get_my_likers` SECURITY DEFINER RPC (`auth.uid()` bazlı, non-premium'da kimlik/not NULL). `notifications.tsx` `LikesSection` artık `notifications` değil bu RPC'den besleniyor: locked'da anonim kalp tile (eski client-side blur gerçek fotoyu sızdırıyordu, düzeltildi), unlocked'da gerçek foto/isim + tıklayınca `user-profile`. Tek kişi likete isim başlıkta ("X likes you"). Cihazda locked+unlocked doğrulandı. Aşağıdaki "🔜🔜 Home redesign" ve eski "🔜 Alerts Faz B" kalemleri bu ikisiyle kapandı.
- ✅ **Emoji chip'lerden Bumble tarzı vektör ikon sistemine geçiş** (`b6d053a`) — `lib/hingeProfile.ts` `ProfileChip` artık `{key, icon: Ionicons-name, label}`; About-me/Looking-for/Interests/Languages chip'lerindeki gömülü emoji (👤🎓🍷🚭🐾🕊️💎✨⭐🌈💬 vb.) kaldırıldı, tek-renk outline ikonlarla değişti. `user-profile.tsx` (Aslı'nın profili, Mayıs'tan beri dokunulmamıştı) aynı builder'lara (`buildAboutMeChips/buildLookingForChips/buildInterestChips/buildLanguageChips/buildAvailabilityChip`) + `SectionCard`/`ChipGrid`'e taşındı — Home ile aynı görsel dil. Alt aksiyon butonlarındaki (Send message/Report/Block) literal emoji de vektör ikonla değişti. Cihazda doğrulandı, kullanıcı onayladı.

**Bitmiş (2026-08-19):**
- ~~🔜 **UI-4 — rn-ui-reviewer pass + push.**~~ — TAMAMLANDI (2026-08-18). `rn-ui-reviewer` 3 kritik/yüksek bulgu buldu+düzeltti (user-profile loading spinner eksikliği, Chats CTA + user-profile aksiyon butonlarında a11y label eksikliği); `get_my_likers` RPC kimlik-sızıntısı riski kontrol edildi, sorun yok. Kozmetik bulgular (hardcode gold palet, 42pt<44pt dokunma hedefi vb.) bilinçli ertelendi. Push edildi (`994c1c7`, `origin/main`).
- ✅ **Buzz featured card — inline Respond TAMAMLANDI (`961bf4a`).** "Wants to meet" kartı artık ✕/✓ butonlarıyla Matches'e gitmeden kabul/red ediliyor (`acceptMatchInvite` reuse edildi; red = matches.tsx'teki "Maybe later" ile aynı, DB'ye yazmıyor, sadece yerel dismiss — matches.tsx da hard-decline persist etmiyor, tutarlı). Bu arada bulunan/düzeltilen 3 bug: (1) featured kartlar `is_read` filtrelemiyordu → kabul/red edilen (hatta sadece açılan) davet Buzz'a her dönüşte tekrar geliyordu, düzeltildi (`is_read` artık filtre); bu ayrıca Haziran'dan kalma 2 çürük seed bildirimini de otomatik gizledi. (2) Chat hemen açılmayan accept (`shouldOpenChatOnAccept` cinsiyet kuralı) sessizdi → onay alert'i eklendi. (3) Tek beğenide locked tile tüm satırı kaplayıp dev kare oluyordu (`flex:1`, kardeş yok) → `maxWidth:110` ile sınırlandı.
- ✅ **Handled invite'lar feed'e "demote" oluyor, yok olmuyor (`30ea6c2`).** Accept/decline sonrası kart tamamen kaybolunca Buzz "sadece likes kutusu" kalan, neredeyse boş bir ekrana dönüyordu (kullanıcı testi sonrası bulundu) — artık `is_read` olan featured item'lar compact feed'e "You said yes to X" / "You said not now to X" özet satırı olarak düşüyor (`NotificationRow.resolvedSummary`, client-only/persist edilmiyor — reload sonrası `feedRowText`'teki generic fallback'e döner, örn. "You responded to X's invite"). Cihazda doğrulandı, kullanıcı onayladı.
- **Not — Supabase CLI ağ sorunu:** Bu oturumda `npx supabase db query --linked`/`projects list` gibi tüm CLI komutları sürekli timeout'a düştü (muhtemelen dünkü ngrok SNI-block'una benzer bir ağ engeli). Yazma gereken test-veri işlemleri bu yüzden **Supabase Dashboard SQL Editor** üzerinden elle yapıldı (kullanıcı çalıştırdı). MCP bu oturumda salt-okunur kaldığı için doğrulamalar `mcp__supabase__execute_sql` ile yapıldı. Gelecek oturumda CLI'yı tekrar dene, hâlâ patlıyorsa aynı dashboard-SQL yolunu kullan.

**Bitmiş (2026-08-20):**
- ✅ **Buzz'a önerilen mekan+saat önizlemesi eklendi (`e63668d`).** "Wants to meet" featured kartı artık davetçinin `micro-intro.tsx`'te seçtiği mekan+3 saat önerisini gösteriyor (`introAnswersForUser`+`formatIntroLines`, `matches.user_a/b_intro_answers` — Matches'te zaten vardı, Buzz'da eksikti). Birkaç görsel iterasyon sonrası: 📍 mekan / 🕐 saatler ayrı satırlarda, kartın alt kısmında böl geçit çizgisiyle; feed satırları sade kaldı (sadece mekan, saatler yok — "You're chatting with X"e detay eklemek kullanıcı tarafından reddedildi, kalabalık görünüyordu). Cihazda birkaç tur test edildi, onaylandı.
- **Netleşen bilgi — "Pick time & place" akışı zaten kısmen VARMIŞ:** `micro-intro.tsx` (Matches'teki "Let's meet" ekranı) çoktan mekan (`venues` tablosu, bölgeye göre önerili) + müsaitliğe göre önerilen 3 saat seçimi yapıyor, `matches.user_a/b_intro_answers` jsonb'ye yazıyor. **Eksik olan tek şey:** kabul edildikten sonra 3 öneriden BİRİNİN kesinleşmesi — şu an yok, taraflar kesin saati muhtemelen sohbette kendi aralarında konuşuyor. `checkin.tsx` da zaten var (gidildi mi + 1-10 rating + `checkin_a/checkin_b/checkin_confirmed` karşılıklı onay) — kullanıcının sorduğu "rate verme" fikri **zaten yapılmış**, sadece Buzz'da hiç hatırlatılmıyor (Matches'in "confirmed meetups" bölümünden erişiliyor).
- **Not — is_premium test state:** Doğukan hesabı (`e5426159-...`) artık kalıcı olarak `is_premium=true` (kullanıcı isteğiyle, dashboard'dan). Gerçek ödeme sistemi yok, bu sadece stub flag. Buzz'da "seni kim beğendi" artık her zaman unlock görünecek — test ederken bunu hesaba kat.
- **Not — Supabase CLI hâlâ kırık:** Bugün de aynı ağ sorunu devam etti, tüm `npx supabase db query --linked` denemeleri timeout'a düştü (yanlışlıkla art arda macOS Keychain izin penceresi de tetikledi — zararsız, Cancel'lanabilir). Dashboard SQL Editor yolu bugün de kullanıldı. Yarın önce hızlıca `npx supabase db query --linked "select 1;"` ile dene, 10-15sn'de dönmezse direkt dashboard'a geç, uzun süre CLI ile uğraşma.

**Açık:**
- ~~🔜 **"Pick time" — kesin saat/mekan onayı**~~ — TAMAMLANDI (`3289258`, 2026-08-21). Davet kabul edilirken invitee artık 3 önerilen saatten birini chip olarak seçmek ZORUNDA (seçmeden ✓ pasif) + "Suggest another time" ile serbest metin karşı-önerisi yapabiliyor; mekan için de "Suggest a different place" linkiyle aynısı (opsiyonel, varsayılan davetçinin önerisi). `matches.confirmed_slot`/`confirmed_place` (text, migrations `20260821090000`/`093000`) — kabul anında yazılıyor, davetçinin "said yes" kartında "Confirmed: ..." olarak görünüyor, CTA "Open chat"a dönüyor. **Bilinçli tek taraflı:** sadece invitee kesinleştiriyor, davetçinin ayrıca onaylaması gerekmiyor (checkin.tsx'teki karşılıklı `checkin_a/checkin_b` deseni burada KULLANILMADI — basit tutuldu, taraflar zaten sohbette konuşabilir). Yol boyunca bulunan/düzeltilen 2 bug: (1) kartın tamamı tek büyük `TouchableOpacity` olduğu için TextInput'a dokunmak bile kartı "okundu" işaretleyip kaybediyordu — kabul edilmemiş kartlar artık düz `View`, sadece ✕/✓ karar veriyor. (2) kabul sonrası özet metni hem geçici (ephemeral) hem kalıcı (DB fallback) kaynaktan aynı bilgiyi ekleyip tekrarlı görünüyordu — artık tek kaynak (`matches.confirmed_slot`). Cihazda custom saat+mekan ile test edildi, onaylandı. **Not:** test verisinde Derya match'inde (`bdcbeba8-...`) gerçek olmayan "Kadikoy bina? / Friday evening 20?" değerleri duruyor, temizlenmedi (zararsız, sonra silinir).
- 🔜 **Buzz "activity history" feed — büyük iş, ürün fikri (kullanıcı önerisi).** Instagram Activity ekranı referans: tarihe göre gruplanmış geçmiş (Bugün/Dün/Son 7 gün) — kime like/Note attın, hangi davete yes/no dedin vb. Bugünkü "demote to feed" (dünkü oturum) küçük/geçici bir versiyonu — asıl istenen çok daha kapsamlı, `likes`+`matches`+`notifications`'ı birleştiren ayrı bir liste-ekranı; hangi olay tiplerinin "history" sayılacağına önce karar verilmeli. Henüz başlanmadı.
- ~~🔜🔜 **Home profil kartını Bumble seviyesine çıkar**~~ — YUKARIDA TAMAMLANDI (2026-08-17/18), eski not aşağıda arşiv amaçlı duruyor: `likes` şeması donduruldu (§3). UI adımı: `HingeProfileCard` tek full-screen swipe → **interleave scroll profil** (fotolar + About/Looking-for/Interests/Languages/Location + prompt kartları), her foto & prompt'ta **Note** iskeleti (backend `likes` gelene kadar Buzz Faz A deseni: buton var, kayıt sonra) + X/❤ alt bar; ayrıca Buzz+Chats empty-state = profil güç çubuğu + aktivasyon checklist. `rn-ui-reviewer` pass. Mevcut Home (`app/(tabs)/index.tsx`): tam-ekran foto + `%68` uyum rozeti + isim/yaş + tagline + "Things in common" (etiketler, müzik/film/kitap) + müsaitlik/içki/sigara/konum kartı + X/❤/⭐ aksiyon butonları + "My ideal date / go-to spot / where I hang out" kartları. **Hedef:** Bumble hissi — foto sırası/yerleşimi, yazı tonu, About Me bölümleri, **prompt/soru cevapları**, ve **fotoğrafı/prompt'u beğenip opsiyonel NOT/YORUM yazma** etkileşimi. **KULLANICI YENİ OTURUMDA BUMBLE EKRAN GÖRÜNTÜLERİNİ ATACAK** — tam bir Bumble profilinin tüm fotoları (yazı tonu, foto yerleri, about, prompt konuşmaları). İş akışı: (1) Bumble görselleri gelsin, (2) `ui-ux-pro-max` skill (görsel sistem) + `rn-ui-reviewer` ajanı (RN implementasyon) + `business-strategist` (hangi özellik "yavaş dating" tezine uyar) devreye, (3) **ÖNCE ürün/scope kararı, SONRA UI**. **KRİTİK MİMARİ BAĞ:** "fotoyu/prompt'u beğen + yorum yaz" = Bumble like-with-comment = **`likes` tablosu = Buzz Faz B ile AYNI veri modeli**. `likes` şemasını (hedef foto/prompt id + opsiyonel yorum metni + liker/likee) **bir kez** doğru tasarla; bu şema hem Home like-etkileşimini hem Buzz "Unlock → seni kim beğendi (+ hangi fotona ne yazdı)" ekranını besler. Yani Home redesign ile [[Alerts Faz B]] birlikte tasarlanacak.
  - ~~**Alt-kalem — empty/0-state'ler**~~ — YUKARIDA TAMAMLANDI (`9509ad2`, UI-3). Not: asıl çözüm UI değil **likidite/growth** (beta'yı tek şehre sıkıştır, `business-strategist`); empty-state yara bandı.
- ✅ **`likes` WRITE side (Home) BAĞLANDI (2026-08-16).** Home ❤ (target_type='profile') + foto/prompt **Note** (target_type='photo'|'prompt' + opsiyonel note) tek `recordLike` upsert'i (`onConflict liker_id,likee_id` → kişi başına tek satır). İkisi de günlük kotayı düşürür + feed ilerletir (Note artık skeleton değil; ❤ eskiden **hiçbir şey kaydetmiyordu** — sadece sayaç). Ölü ⭐ SuperSwipe **gizlendi** (yalnız ✕/❤). Migration `supabase/migrations/20260816120000_create_likes.sql` — **UYGULA.**
- ~~🔜 **Alerts Faz B — READ side**~~ — YUKARIDA TAMAMLANDI (`get_my_likers` RPC, `a7a448d`).
- **P2 Katman 2 — gerçek foto gönderimi (DB'ye dokunur, büyük iş):** `messages.media_url` kolonu (+ `content` nullable), özel storage bucket + RLS (accepted-match kontrolü), `renderMessage` foto balonu, signed URL upload. `openPhotoPicker` içinde `TODO(P2 Katman 2)` işaretli. Önce **ürün/KVKK kararı** (foto akışı "yavaş dating" tezine uyuyor mu, moderasyon). `supabase-expert` ajanını hak eder. **Ses notu bilinçli olarak EKLENMEYECEK** (dwell-time artırır, buluşma tezinin tersi).
- Tema token seti **kısmen** uygulandı (token'lar eklendi ama sadece chat input'ta kullanıldı; diğer ekranlar hâlâ gri/accent hardcode ediyor — token sweep açık). ErrorState retry butonu ~42pt <44pt hâlâ açık.
- dev-build (EAS) göçü + push; ölü kod/seed temizliği; contextual `likes`; analytics + beta.

---

## 5. Ürün kararları (log)
- **Mesaj kuralı simetrik kalıyor.** "Kadın accepted olmadan mesaj atabilsin" fikri reddedildi — funnel'ın değeri simetride; muafiyet spam/taciz kapısı açar. Alternatif = funnel'ı hızlandırmak (aksiyonlu "X seni beğendi → tek dokunuşla kabul" bildirimi).
- **`expired` vs `passed` ayrı** (elle geçme ≠ süre dolumu), eleme pencereleri farklı (14 vs 42 gün).
- **Home Bumble redesign + `likes` şeması — KARAR VERİLDİ (2026-08-16, business-strategist+ui-ux-pro-max onaylı).** Bumble özellik seti tezimize göre süzüldü:
  - **ADOPT:** interleave scroll profil (foto↔kart dokusu, tek full-screen swipe DEĞİL) · blok bazlı **"Note"** (bağlamlı beğeni = çekirdek kimlik) · verified rozeti (render-only, `photo_verified` kolonu).
  - **ADAPT (mevcut kolonlardan, yeni tablo YOK):** About-me chip grid · "Looking for" · Interests · Languages · Location · **prompt Q&A** = mevcut serbest-metin kolonları sabit prompt etiketiyle (`favorite_book/movie/music`, `first_date_expectation`, `core_value`, `favorite_activity`).
  - **REJECT-DEFER:** SuperSwipe (swipe hacmi satışı = "parayı buluşma değerine bağla" ihlali).
  - **`likes` şeması DONDURULDU** (bkz §3 — Home Note-beğeni + Buzz Faz B AYNI tablo): kişi başına **tek hedefli beğeni** (şema çok-reaksiyona hazır ama MVP tek); Home Note-beğeni = **ön-sinyal, davet DEĞİL** (kritik: beğeni anında davete dönerse Buzz'ın "seni kim beğendi" verisi kalmaz — funnel: Note-beğeni → karşı taraf Buzz'da görür → davet → kabul → sohbet → buluşma); **not yazmak ÜCRETSİZ, görmek PREMIUM** (asimetri Buzz'da).
  - **Empty/0-state (Buzz+Chats) bu iş kapsamında:** sahte like YOK → **profil güç çubuğu + aktivasyon checklist'i** (foto ekle / prompt cevapla / doğrulan); asıl çözüm likidite.
  - **Tek beğeni modeli (2026-08-16 uygulandı):** Home ❤ + Note tek `recordLike`→`likes` upsert; boş/no-op aksiyon kalmadı. **Önemli tespit:** eski ❤ aslında hiçbir şey kaydetmiyordu (sadece günlük sayaç), yani "Home like → Matches davet" akışı Home'da DEĞİL — davet zaten Matches ekranında başlıyor. Dolayısıyla Home beğenisini "ön-sinyal (davet değil)" yapmak mevcut funnel'ı BOZMAZ; davet adımı Matches'te aynen durur. SuperSwipe ⭐ gizlendi.
- **Açık kararlar:** tez kişilik mi / konum-niyet mi · check-in "yavaş dating" tezi · KVKK hassas veri sınırı (Note serbest-metin = başka kullanıcı hakkında; moderasyon `reports`'a bağlanacak) · `not_sure_yet` ağırlığı · para modeli (bkz. business-strategist ajanı).

---

## 6. Sık kullanılan test SQL'leri
```sql
-- Günlük limitleri sıfırla
UPDATE profiles SET daily_views_count=0, daily_views_reset_at=now(),
  daily_invites_count=0, daily_invites_reset_at=now()
WHERE id='e5426159-0d49-42c5-b79d-0d1b3cdfea9a';
-- Eşleşmeyi dirilt
UPDATE matches SET status='pending', expires_at=now()+interval '24 hours' WHERE id='<matchId>';
-- RLS policy dökümü
SELECT tablename, policyname, cmd, roles, qual::text, with_check::text
FROM pg_policies WHERE schemaname='public' ORDER BY tablename, cmd;
-- matches status constraint
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid='matches'::regclass AND contype='c';
-- profiles gerçek kolon listesi (select ile diff'lemek için)
SELECT column_name FROM information_schema.columns
WHERE table_name='profiles' AND table_schema='public' ORDER BY column_name;
-- RPC gövdesi (grep göremez)
SELECT pg_get_functiondef('public.get_top_matches'::regproc);
```

---

## 7. Teşhis metodu (işe yaradı, koru)
1. Şikayeti önce grep'le (`--exclude-dir=node_modules --exclude-dir=.git`).
2. Kodda yoksa DB/RPC'yi tara — `pg_get_functiondef` ile çek.
3. Karşılaştırmayı **ID ile** yap, isimle asla (13 Asli).
4. DB'ye yazan değişiklikten önce **constraint/policy** kontrol et.
5. Boş ekran/sessiz hata → `error`'ı logla (var-olmayan kolon tüm select'i null yapar).
6. Bir katmanı elemeden diğerine geçme. Her çalışan parçadan sonra: **test → commit → sıradaki.**
