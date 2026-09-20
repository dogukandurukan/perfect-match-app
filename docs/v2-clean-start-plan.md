# V2 Clean-Start — Read-Only Inventory & Implementation Plan

2026-09-21 (ilk yazım), **2026-09-21 (güncelleme — kullanıcı kararı)**. `docs/onboarding-v2-gap-analysis.md` ve `docs/matching-engine-v2.md` ile birlikte okunmalı; bu belge onlarla çelişmiyor, üstüne inşa ediyor.

## 🔓 Kullanıcı kararı — tam clean-start onaylandı

Aşağıdaki §C'deki açık kararlar kapatıldı: **`[3.-taraf-e-postası — kimliği doğrulanamadı]` dahil 607 auth hesabının tamamı** (Doğukan'ın kendi hesapları dahil) test/dummy kabul edildi ve silinmesi onaylandı. Mevcut profil/onboarding/match/like/message/notification/storage içeriğinin korunmasına gerek yok. Gerçek/QA hesapları temizlik + V2 kurulumu sonrasında yeniden açılacak.

**Hazırlık (salt-okunur/geri alınabilir metadata):**
1. ✅ Timestamp'li audit snapshot alındı ve okunabilirliği doğrulandı (§B.0) — **"fully restorable backup" DEĞİL**, terminoloji düzeltildi (bkz. §B.0'ın "Neyi GERİ YÜKLEYEMEZ" bölümü).
2. ✅ 63 migration için CLI baseline/repair tamamlandı — `local==remote`, 63/63, 0 uyuşmazlık, element-bazlı karşılaştırmayla doğrulandı (§B.1).
3. ✅ Son dry-run sayıları üretildi (§B.0.1).
4. ✅ FK bağımlılık sırası + `matches.meetup_proposed_by` NO ACTION durumu canlı veriyle yeniden doğrulandı (§B.2).

## ✅ 2026-09-21 — Adım A/B/C UYGULANDI (geri alınamaz, kullanıcı onayıyla)

**A. Storage temizliği — TAMAMLANDI.** Tek kullanımlık `v2-cleanup-storage` Edge Function'ı (service-role, sadece sayı döndürüyor, hiçbir path/uuid loglamıyor) deploy edildi, çağrıldı, sonuç bağımsız olarak doğrulandı, sonra hem canlı projeden hem yerel diskten silindi. Sonuç: `user-photos` 22/22 silindi, `verification-selfies` 3/3 silindi, 0 hata. Doğrulama: `storage.objects` TOPLAM = 0 (tüm bucket'larda), 3 bucket'ın hepsi hâlâ var, `verification-selfies.public = false` korunuyor.

**B. Uygulama verisi temizliği — TAMAMLANDI.** `DELETE FROM matches` → `DELETE FROM profiles` (tek transaction, cascade geri kalanını temizledi). Before/after (tam liste):
```
matches: 81→0   profiles: 505→0   onboarding_answers: 504→0
likes: 39→0     messages: 32→0    notifications: 294→0
events: 40→0    blocks: 1→0       reports: 1→0
venues: 10→10   (DOKUNULMADI, doğrulandı)
```

**C. Auth temizliği — TAMAMLANDI.** Tek kullanımlık `v2-cleanup-auth` Edge Function'ı (Admin API, chunked/bounded concurrency=10, idempotent — 404/"not found" ayrı sayılıyor, hiçbir uuid/token/secret loglamıyor, sadece sayı+jenerik hata metni döndürüyor) deploy edildi, çağrıldı: **607 bulundu, 607 silindi, 0 zaten-yoktu, 0 başarısız.** Bağımsız doğrulama: `auth.users`=0, `auth.identities`=0. Fonksiyon hem canlı projeden hem yerel diskten silindi.

**Phase 0/0.1 regresyon checklist'i — TAMAMEN YEŞİL:** `photo_verified`/`is_premium`/`waitlist_number`/`waitlist_boost`/`daily_views_count`/`daily_views_reset_at` hâlâ `authenticated` için UPDATE kilitli; `first_name` hâlâ güncellenebilir (normal profil düzenleme bozulmadı); `verification-selfies` hâlâ private; `get_top_matches` hâlâ SECURITY DEFINER + `anon` EXECUTE kapalı + `authenticated` EXECUTE açık; `get_daily_views_state` aynı şekilde; `onboarding_answers`'ta `qual=true` policy sayısı = 0. **`npx tsc --noEmit` temiz. Migration baseline hâlâ 63/63 `local==remote`.**

**Henüz yapılmadı, onay bekleniyor:** adım 8-10 (V2 şeması, `onboarding_answers_v2`, 80-120 seed profil) — kullanıcının açık talimatı gereği ayrıca onaylanmadan başlanmayacak.

**Doğrulama notu (formatting düzeltmesi):** önceki bir sohbet mesajında before/after tablosu terminalde bazı değerleri kısaltılmış gösterebilir (`50`/`29` gibi) — bu sadece görüntüleme/render sorunuydu, bu dosyadaki (ve orijinal SQL sorgu çıktılarındaki) **gerçek** before değerleri her zaman `profiles=505, onboarding_answers=504, notifications=294` idi (yukarıdaki §A ve §B.0.1'de birden fazla yerde birebir tutarlı şekilde kayıtlı). Silme sonrası **tüm kullanıcıya bağlı tabloların nihai kalan değeri kesin olarak 0'dır** — `auth.users=0`, `profiles=0`, `onboarding_answers=0`, `matches=0`, `likes=0`, `messages=0`, `notifications=0`, `events=0`, `blocks=0`, `reports=0`, `storage.objects=0` — tek istisna kullanıcıya bağlı olmayan `venues=10` (değişmedi, bilinçli olarak korundu).

---

## A. KANIT — mevcut veri gerçekten dummy mi?

Yöntem: `auth.users`, `profiles`, `onboarding_answers`, `matches`, `likes`, `messages`, `notifications`, `events`, `blocks`, `reports`, `storage.objects` çapraz sorgulandı. Hiçbir tabloya körü körüne "dummy'dir" denmedi — her tablo için ayrı kanıt var.

### A.1 `auth.users` — 607 satır
```sql
total_users=607, email_confirmed=607, ever_signed_in=7, has_phone_identity=0
distinct_email_domains=5
```
Domain dağılımı: **`example.com` → 600**, `gmail.com` → 4, `1234` → 1, `gma.com` → 1, `invent.ai` → 1.

`example.com` RFC 2606'da ayrılmış, gerçek kayıt için asla kullanılmayan bir test domaini. **600/607 hesap hiç giriş yapmamış** (`last_sign_in_at IS NULL`) — geriye kalan 7 hesabın TAMAMI en az bir kez giriş yapmış. Bu 600 hesabın tek başına domain'i bile yeterli kanıt, ama aşağıda bağımsız olarak da doğrulanıyor.

### A.2 Geriye kalan 7 hesap — tek tek kimlik tespiti
| id | email | created_at | last_sign_in_at | Sınıf |
|---|---|---|---|---|
| `d6f391a2-...` | `test@1234` | 2026-04-12 | = created_at (tek oturum) | Atılmış manuel test — **profil yok** |
| `e5426159-...` | `[Doğukan'ın ana email adresi]` | 2026-04-12 | 2026-09-16 (aktif kullanım) | **Doğukan'ın ana hesabı** (CLAUDE.md'nin bildiği) |
| `4b0d2b9c-...` | `[3.-taraf-e-postası — kimliği doğrulanamadı]` | 2026-06-09 | = created_at (tek oturum) | **⚠️ Belirsiz — bkz. A.3** |
| `1d2a579f-...` | `[Doğukan'ın iş e-postası]` | 2026-07-26 | = created_at | Doğukan'ın kendi iş e-postası (CLAUDE.md'de yanlışlıkla "Asli" diye etiketlenmiş — gerçekte Doğukan'ın kendisi) |
| `ed8c3991-...` | `[Doğukan'ın email varyantı #1]` | 2026-09-02 | = created_at | Doğukan'ın kendi varyant hesabı |
| `5503c067-...` | `[Doğukan'ın email varyantı #2 — typo domain]` | 2026-09-03 | = created_at | **Doğukan'ın 2. test hesabı** (CLAUDE.md'nin bildiği) |
| `02f0b22b-...` | `[Doğukan'ın email varyantı #3]` | 2026-09-15 | = created_at | Doğukan'ın kendi varyant hesabı |

### A.3 ⚠️ Tek gerçek belirsizlik: `[3.-taraf-e-postası — kimliği doğrulanamadı]`
Bu hesap CLAUDE.md'nin bildiği hiçbir test hesabıyla eşleşmiyor. E-posta handle'ı gerçek bir isme benziyor — Doğukan'ın kendi email varyantlarından biri değil. **Bu, gerçek bir üçüncü kişinin (bir arkadaş/tester) uygulamayı bir kez denediği bir hesap olabilir.** Kanıtlarla sınırlayabildiğim kadarı: hiç profil satırı yok, hiç `onboarding_answers` satırı yok, hiç storage objesi yok, hiç match/like/mesaj/event'e karışmamış — yani DB'de tuttuğu tek iz, `auth.users`'taki bir e-posta adresi. **Bunu dummy varsaymadım ve silme planına dahil etmedim — kullanıcıdan açık onay gerekiyor** (belki gerçekten Doğukan'ın kendisi farklı bir cihazdan/hesaptan denemiştir, belki gerçek bir üçüncü kişidir — ayırt edecek başka kanıt yok).

`test@1234` içinse risk pratik olarak sıfır (hiçbir kişisel veri yok, tek karakterlik atılmış bir test) ama yine de "sil" demeden önce onaylanmalı.

### A.4 `profiles` — 505 satır, 3 toplu ekleme + 5 gerçek hesap
```sql
total_profiles=505, pravatar_photo=500, no_photos=1, distinct_first_names=49
```
Günlük dağılım (`created_at`):
```
2026-03-26 → 200   2026-05-04 → 200   2026-03-29 → 100   (= 500)
2026-04-12 → 1     2026-07-26 → 1     2026-09-02 → 1     2026-09-03 → 1     2026-09-15 → 1   (= 5, tam olarak A.2'deki 5 gerçek hesabın günleriyle birebir eşleşiyor)
```
505 profilin **500'ü** üç net toplu-ekleme gününde oluşmuş, **49 farklı isim** üzerinden dağılmış (profil başına ortalama ~10 tekrar — CLAUDE.md'nin "13 tane Aslı" gözlemiyle birebir tutarlı) ve **500'ü** `photos[1]`'de gerçek bir yükleme değil, harici `https://i.pravatar.cc/...` URL'si taşıyor. Kalan 5 profil, A.2'deki 5 gerçek hesabın günlük oluşturma zaman damgalarıyla **tam olarak** eşleşiyor.

### A.5 `onboarding_answers` — 504 satır, aynı desen
```
2026-05-04→200, 2026-03-26→159, 2026-03-29→141 (=500), + 4 tekil gün (gerçek hesaplar)
```
Not: `matching-engine-v2.md`'de (2026-09-20) "sadece 3 satır var" denmişti — bu **yanlıştı** (muhtemelen o sorgu farklı bir filtre/zamanla çalıştırılmış). Gerçek sayı 504. Bu düzeltme, o belgeyi geçmişe dönük değiştirmeden burada not ediliyor.

### A.6 Etkileşim tabloları — dummy profiller BİRBİRİYLE HİÇ etkileşmemiş
```sql
matches:       81/81  gerçek hesaba dokunuyor  (100%)
likes:         39/39  gerçek hesaba dokunuyor  (100%)
messages:      32/32  gerçek hesaba dokunuyor  (100%)
events:        37/40  gerçek hesaba dokunuyor  (3 tanesi dummy tarafından — muhtemelen bir dummy'nin "karşı taraf" olarak bir trigger'dan event alması)
notifications: 54/294 gerçek hesaba dokunuyor  (kalan 240'ı, gerçek hesabın dummy'yle eşleştiği matches satırlarında dummy TARAFA otomatik yazılan "new_match" bildirimleri — handle_match_notification trigger'ı, CLAUDE.md'de zaten bilinen "gereksiz satır birikiyor" davranışı)
```
**Sonuç: 500 dummy profil hiçbir zaman birbiriyle eşleşmedi/beğenmedi/mesajlaşmadı.** Var olan HER gerçek etkileşim, Doğukan'ın kendi hesaplarından biriyle dummy havuzu arasında, Doğukan'ın kendi testleri sırasında oluşmuş. `blocks`(1)/`reports`(1) — ikisi de aktör `e5426159` (Doğukan), hedef dummy hesaplar.

### A.7 Storage — dummy profillerin gerçek dosyası YOK
```sql
user-photos: total_objects=22, distinct_user_folders=5
verification-selfies: 3 obje (Phase 0'dan biliniyor, 02f0b22b/5503c067/ed8c3991 — üçü de Doğukan'ın kendi hesabı, A.2'ye bak)
```
22 obje, tam olarak 5 klasörde — yani **500 dummy profilin storage'da tek bir dosyası bile yok** (`photos` alanları sadece pravatar.cc metnini tutuyor). Temizlenecek "dummy fotoğraf dosyası" diye bir şey **storage'da mevcut değil** — bu hem işi kolaylaştırıyor hem de "silinecek obje" varsayımının yanlış olacağını gösteriyor.

### A.8 Özet sınıflandırma
| Sınıf | Sayı | Kanıt |
|---|---|---|
| Dummy/seed (`@example.com`, 3 toplu ekleme günü) | 500 profil + karşılık gelen auth.users/onboarding_answers | Domain + zaman kümeleme + isim tekrarı + pravatar + storage'da dosya yokluğu |
| Doğukan'ın kendi test hesapları | 5 (profilli) + belki `test@1234` (profilsiz) | Email varyantları, CLAUDE.md'nin bilinen UUID tablosu, tüm gerçek etkileşimlerin kaynağı |
| **Belirsiz, ONAY GEREKİR** | 1 (`[3.-taraf-e-postası — kimliği doğrulanamadı]`) | Hiçbir veri izi yok ama kimliği doğrulanamıyor |

---

## B. PLAN

### B.0 Audit snapshot / veri export'u — ALINDI ve doğrulandı ✅
**Terminoloji düzeltmesi:** aşağıdaki, "geri yüklenebilir bir yedek" (full restorable backup) DEĞİL — bir **audit snapshot / veri export'u**. Bu ayrım önemli, aşağıda açıklanıyor.

`npx supabase db dump --linked` Docker/Podman gerektiriyor; bu ortamda **ikisi de yok** (`pg_dump`/`psql` de yok — dördü de doğrudan test edildi, hiçbiri bulunamadı). Bu yüzden klasik tek-dosyalık `pg_dump` formatında bir dump bu oturumdan alınamıyor. Bunun yerine **tablo başına mantıksal JSON export** yapıldı: `SELECT row_to_json(t) FROM <tablo> t`, `npx supabase db query --linked -f` ile çalıştırılıp çıktı doğrudan diske yönlendirildi (PII'nin gereksiz yere bu oturumun kendi context'ine girmemesi için).

**Konum:** `backups/20260920T184910Z_*.json` (12 dosya) + `backups/20260920T184910Z_README.md` (tam detay + aşağıdaki sınırların uzun açıklaması). **`.gitignore`'a `backups/` eklendi — commit'lenmeyecek.**

**⚠️ Neyi GERİ YÜKLEYEMEZ (README'de detaylı):**
- **Auth kimliği/şifre.** `auth.users.encrypted_password` bir hash olarak export'ta duruyor ama `auth.identities`/oturum/provider bağları hiç export edilmedi (zaten `auth.users`'tan CASCADE ile geliyorlar, bağımsız veri taşımıyorlar) — bu JSON'u ham SQL ile `auth.users`'a geri yazmak **çalışan bir login oluşturmaz**. Gerçek bir "geri getirme" Admin API ile **yeni** bir hesap açmak demektir, hash'i replay etmek değil.
- **Storage dosya byte'ları.** `storage.objects` sadece metadata (path/owner/zaman) — gerçek fotoğraf/selfie byte'ları hiçbir yerde export edilmedi, edilemez de (Docker olmadan storage byte-level export mekanizması yok). Bir fotoğraf bu snapshot'tan **asla** geri getirilemez.

Yani bu export'un gerçek değeri: "ne vardı, hangi user_id'ye ait, ne zaman" sorusuna kanıt sağlamak (§A'daki analizin dayandığı tam olarak bu) — "silmeyi geri al" düğmesi değil.

**Doğrulama (varsaymadan, her dosya için ayrı ayrı):**
| Dosya | Satır sayısı (dosyada) | Canlı DB'deki sayı (aynı anda) | JSON geçerli mi |
|---|---|---|---|
| auth_users | 607 | 607 | ✓ |
| profiles | 505 | 505 | ✓ |
| onboarding_answers | 504 | 504 | ✓ |
| matches | 81 | 81 | ✓ |
| likes | 39 | 39 | ✓ |
| messages | 32 | 32 | ✓ |
| notifications | 294 | 294 | ✓ |
| events | 40 | 40 | ✓ |
| blocks | 1 | 1 | ✓ |
| reports | 1 | 1 | ✓ |
| storage_objects (metadata) | 25 | 25 | ✓ |
| storage_buckets | 3 | 3 | ✓ |

Ayrıca bir örnek kaydın (profiles) **değerlerine bakmadan** anahtar yapısı doğrulandı (83 alan, `id`/`photos` mevcut) — hem gerçek veri taşıdığı hem de PII'nin bu context'e sızmadığı teyit edildi.

**Kapsam dışı (dürüstçe belirtilmeli):** Storage'daki gerçek dosya byte'ları (sadece metadata yedeklendi — A.7'nin gösterdiği gibi 500 dummy'nin zaten hiç dosyası yok, gerçek hesapların 22+3 dosyası siliniyor olacağı için bu içerik de zaten kaybolacak, bilinçli bir sınır). Şema DDL'i tek dosya halinde değil — ama `supabase/migrations/`'daki 63 dosya zaten versiyon kontrollü, tam ve replay edilebilir bir şema geçmişi (bkz. B.1).

### B.1 CLI migration history baseline — TAMAMLANDI ve doğrulandı ✅
**Önceki durum:** `npx supabase migration list --linked` 63 migration'ın **tamamında** `remote` sütununu boş gösteriyordu (geçmiş değişikliklerin çoğu `db query --linked -f`/Dashboard SQL Editor ile uygulandığı, `supabase_migrations.schema_migrations` tablosuna hiç yazılmadığı için — CLAUDE.md'nin aylardır bildiği durum).

**Yapılan:** `npx supabase migration repair --status applied <63 versiyon>` — bu **şemayı değiştirmez**, sadece CLI'nin takip tablosunu gerçekle eşitler.

**Doğrulama:** `migration list --linked` tekrar çalıştırıldı — **63 migration'ın tamamında artık `local == remote`**, tek bir boş/uyuşmayan satır yok.

**Not:** `supabase db push`'a hâlâ körü körüne güvenilmemeli (repair sadece geçmişi kayda geçirdi, gelecekteki her yeni migration'ın `db push` ile mi yoksa `db query --linked -f` ile mi uygulanacağı ayrı bir tercih) — ama artık en azından `migration list` gerçek durumu doğru yansıtıyor, bu da V2 migration'larının üstüne güvenle inşa edilebileceği temiz bir başlangıç noktası demek.

**Branching yok** (`list_branches` boş döndü) — "önce bir dev branch'te dene" seçeneği bu projede mevcut değil, bu yüzden B.0'daki yedek tek güvenlik ağı.

### B.0.1 Son dry-run raporu — kesin sayılar (2026-09-21, aynı oturumda, backup ile aynı anda alındı)
```
auth.users          = 607   (auth.identities de 607 — 1:1, cascade ile birlikte gidecek)
profiles             = 505
onboarding_answers   = 504
matches              = 81
likes                = 39
messages             = 32
notifications        = 294
events               = 40
blocks               = 1
reports              = 1
storage.objects      = 25   (22 user-photos + 3 verification-selfies)
storage.buckets      = 3    (user-photos, verification-selfies, profile-photos — bucket'ların KENDİSİ silinmeyecek, sadece objeler)
venues               = 10   (⚠️ KULLANICI-BAĞLI DEĞİL, silinmeyecek — statik mekan referans verisi, hiçbir user_id kolonu yok)
```
Bunlar **§A**'daki kanıt bölümüyle birebir aynı sayılar (o zamandan beri hiç değişmedi, sistemde canlı trafik yok) — dry-run'ın kendisi bu yüzden yeni bir sürpriz çıkarmadı, sadece "silme anında da hâlâ doğru mu" diye bağımsız olarak yeniden doğrulandı.

**`venues` tablosu clean-start kapsamı DIŞINDA** — kullanıcıya bağlı değil (kolon listesinde `user_id` yok), V2'de de aynı mekan verisi kullanılabilir, silinmemeli.

### B.2 Silinecek verinin bağımlılık sırası — gerçek FK kurallarından, YENİDEN doğrulandı
```
profiles.id → auth.users.id:            NO ACTION   (profiles ÖNCE silinmeli, auth.users SONRA)
matches.meetup_proposed_by → profiles:  NO ACTION   (bkz. aşağıdaki canlı bulgu)
onboarding_answers → profiles:          CASCADE
matches.user_a_id/user_b_id → profiles: CASCADE
blocks.blocker_id/blocked_id → profiles:CASCADE
reports.reporter_id/reported_id → profiles: CASCADE
messages.sender_id/receiver_id → profiles:  CASCADE
notifications.user_id → profiles:       CASCADE
notifications.related_user_id → profiles:   SET NULL
likes.liker_id/likee_id → profiles:     CASCADE
likes.match_id → matches.id:            SET NULL
auth.identities/sessions/mfa_factors/one_time_tokens/oauth_authorizations/oauth_consents/webauthn_credentials/webauthn_challenges/mfa_recovery_code_sets → auth.users: hepsi CASCADE
```

**`meetup_proposed_by` canlı kontrolü (varsayılmadı, sorgulandı):** şu an **2 matches satırında** dolu. Analiz: `meetup_proposed_by` mantıksal olarak HER ZAMAN o satırın `user_a_id` ya da `user_b_id`'sinden biri (öneriyi yapan taraf zaten eşleşmenin bir parçası) — yani bu 2 satır zaten `user_a_id`/`user_b_id` CASCADE'i tarafından da kapsanıyor. **Tam clean-start'ta (TÜM 505 profil siliniyor) her matches satırının her iki tarafı da silinen kümede olduğu için, CASCADE (user_a/b) o satırı zaten kaldırıyor — `meetup_proposed_by`'ın NO ACTION'ı hiç devreye girmeden.** Bu, kısmi/seçici bir silmede (bazı profiller kalıp bazıları silinseydi) gerçek bir risk olurdu, ama burada değil.

**Yine de, teorik çıkarıma güvenmemek için** (bu oturumun tekrar tekrar uyguladığı "varsayma, doğrula" ilkesi), fiili silme anında önerilen sıra teorik cascade zamanlamasına bel bağlamıyor:

**Kesin sıra: (1) `DELETE FROM matches` (tüm satırlar, açıkça) → (2) `DELETE FROM profiles` (cascade geri kalan her şeyi — onboarding_answers/blocks/reports/messages/notifications/likes — otomatik temizler) → (3) `auth.users` satırlarını Admin API ile sil.** Adım 1'i açık yapmak, `meetup_proposed_by`'ın teorik NO ACTION riskini tamamen ortadan kaldırıyor, cascade sırasının doğru yorumlanmasına güvenmeye gerek bırakmıyor.

### B.3 Auth kullanıcıları silinsin mi? — ✅ KARAR: EVET, HEPSİ (607/607)
Kullanıcı kararıyla kapatıldı: **`[3.-taraf-e-postası — kimliği doğrulanamadı]` ve Doğukan'ın kendi 5-6 hesabı dahil, 607 hesabın tamamı** siliniyor. Gerçek/QA hesapları temizlik sonrası yeniden açılacak. Artık "hangi hesaplar kalsın" diye bir ayrım YOK — tam sıfırlama.

**Yöntem:** SQL `DELETE FROM auth.users` DEĞİL — `auth.identities/sessions/mfa_factors/one_time_tokens/oauth_authorizations/oauth_consents/webauthn_credentials/webauthn_challenges/mfa_recovery_code_sets` (9 iç tablo, hepsi CASCADE, doğrulandı) Supabase'in kendi iç şeması olduğu için ham SQL yerine **Admin API** (`auth.admin.deleteUser`) kullanılmalı — mevcut `delete-account` Edge Function'ının zaten kullandığı yöntem. **607 hesap için:**
- Tek seferlik, idempotent bir admin fonksiyonu (Phase 0'daki `migrate-verification-selfies` deseninde — kullanılıp hemen silinecek, gerçek UUID'ler repoda kalıcı olarak tutulmayacak).
- **İdempotent olmalı:** her kullanıcı için silmeden önce "hâlâ var mı" kontrolü + sonucu (silindi/zaten-yoktu/hata) ayrı ayrı sayılmalı — kısmi bir çalıştırmadan sonra tekrar çalıştırılırsa kaldığı yerden devam edebilmeli, ikinci kez "already deleted" hatasında patlamamalı.
- **Sonuçlar sayılmalı:** kaç tanesi başarıyla silindi, kaç tanesi zaten yoktu, kaç tanesi hata verdi — ham "hepsi bitti" değil, tam bir rapor.
- Supabase Admin API'nin rate limit'i olabilir (yüzlerce ardışık `deleteUser` çağrısı) — fonksiyon içinde küçük bir batch/pacing (örn. her çağrı arası kısa bekleme ya da Promise.all yerine sıralı işleme) düşünülmeli, tek seferde 607 paralel çağrı atmak yerine.

### B.4 Storage temizliği — 22 obje siliniyor, bucket'lar/policy'ler KALIYOR
A.7'nin gösterdiği gibi `user-photos`'ta 500 dummy'ye ait dosya zaten yok (sadece pravatar.cc metni) — ama artık **607 hesabın tamamı siliniyor**, yani gerçek hesaplara ait **22 `user-photos` objesi + 3 `verification-selfies` objesi (toplam 25)** de silinecek. **Bucket'ların kendisi ve RLS policy'leri SİLİNMİYOR** — kullanıcının açık talimatı ("bucket'ları ve policy'leri silme"). Yöntem: `delete-account` Edge Function'ının storage `.remove()` çağrısıyla aynı desen, her kullanıcının kendi klasöründeki objeleri hedefleyerek (ya da tüm objeleri tek seferde `storage.objects` tablosundan silinecek id listesiyle) — Phase 0/0.1'in kurduğu private-bucket + own-folder-only policy yapısı olduğu gibi kalmalı.

### B.5 `onboarding_answers_v2` veri modeli
`onboarding-v2-gap-analysis.md`'nin bulduğu en kritik sorun: eski `relationship_pace`/`connection_style`/`connection_energy` kolonları **aynı isimle ama tamamen farklı anlamda** yeniden kullanılıyor. Clean-start bunu bir daha asla yaşamamak için **ayrı bir tablo** olmalı — eski `onboarding_answers`'ın üstüne kolon eklemek/anlamını değiştirmek değil.

Önerilen şema (spec §10 + §11'den, hiçbir eski kolon adı yeniden kullanılmıyor):
```sql
create table onboarding_answers_v2 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,

  -- §10 Intentions — evrensel + koşullu
  intent text not null check (intent in ('long_term','casual','figuring_it_out')),
  connection_pace text,        -- §10.2 (yeni ad — eski relationship_pace'in anlam çakışmasını önlemek için bilinçli olarak farklı isim)
  communication_style text,    -- §10.3 (yeni ad — eski connection_style'ın anlam çakışması)
  closeness_preference text,   -- §10.4 (yeni ad — eski connection_energy'nin anlam çakışması)
  children_view text,          -- §10.5, sadece long_term/figuring_it_out'ta sorulur
  exclusivity_view text,       -- §10.5, sadece casual'da sorulur

  -- §11 Preferences — "kimi görmek istersin", profile'dan AYRI
  pref_age_min int, pref_age_max int,
  pref_distance_km int,                       -- 5/15/30/null(=Anywhere)
  pref_smoking_strength text check (pref_smoking_strength in ('dont_care','prefer','dealbreaker')),
  pref_drinking_strength text check (pref_drinking_strength in ('dont_care','prefer','dealbreaker')),
  pref_height_min_cm int, pref_height_max_cm int,   -- optional, null=no preference
  pref_pets text check (pref_pets in ('yes','it_depends','preferably_no','dealbreaker')),

  onboarding_version text not null default 'v2',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
`profiles`'a EKLENECEK yeni alanlar (spec §6/§7/§8/§9, mevcut kolonlarla ÇAKIŞMAYANLAR — çakışanlar için bkz. gap-analysis'in tablosu):
```sql
alter table profiles add column smoking_v2 text check (smoking_v2 in ('never','occasionally','regularly','trying_to_quit'));
alter table profiles add column drinking_v2 text check (drinking_v2 in ('never','socially','regularly','sober'));
alter table profiles add column gender_self_describe text; -- §6, gender='self_describe' iken
alter table profiles add column job_title text;            -- §7, şirket adı YOK (spec'in açık kuralı)
alter table profiles add column school text;
alter table profiles add column hometown text;
```
`profile_prompts` (§7 — kütüphaneden seç, min 2):
```sql
create table profile_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  prompt_key text not null,   -- spec'in 8 maddelik kütüphanesinden biri
  answer_text text not null,
  display_order smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, prompt_key)
);
```
`smoking`/`drinking` için **eski kolonları DONDUR** (religion kararındaki gibi) — yeni `_v2` kolonlar kullanılsın, eski `Yes/No/Socially` üzerine yazılmasın (aynı isim-aynı-anlam-değil tuzağı burada da geçerli, gap-analysis'te zaten flag'lenmişti).

### B.6 `onboarding_version` / `onboarding_status` — sınırlar net çizilmeli
İki AYRI kavram karışmasın:
- **`profiles.onboarding_version`** (`text`, `'v1'|'v2'`) — hangi şema/soru setinden geçti. Basit, tek kolon.
- **`profiles.onboarding_status`** — SADECE formun kendisi (§4 "Build Your Profile" checklist'i) ne kadar ilerledi: `draft | in_progress | submitted`. `submitted`'a ulaşınca devir teslim, `application_status`'a geçiyor (gap-analysis'in §F'sinde tasarlanan `draft/submitted/under_review/waitlisted/changes_requested/accepted/rejected` state machine'i) — **`onboarding_status` ve `application_status` iki ayrı kolon/kavram olmalı, tek bir enum'a sıkıştırılmamalı**, çünkü biri "form ne kadar dolu" biri "review süreci nerede" soruyor, farklı sahiplerin (kullanıcı vs. reviewer) değiştirdiği farklı şeyler.

### B.7 V2 matching RPC geçişi
Şu an `get_top_matches` zaten `SECURITY DEFINER` + `auth.uid()=p_user_id` doğrulamalı (Phase 0.1) — bu güvenlik iskeleti korunmalı. Öneri:
1. **Yeni bir fonksiyon adı** (`get_top_matches_v2`) ile başla, ESKİsini bozma — `onboarding_answers_v2`'ye join eden, `lib/setup2Matching.ts`'in intent-koşullu mantığını (zaten SQL'e taşınmayı bekleyen, doğru tasarlanmış) uygulayan, `discovery_age_min/max`'ı gerçekten filtreleyen (hâlâ açık olan P0 bug, `matching-engine-v2.md`), karşılıklı yaş aralığı kontrolü yapan bir fonksiyon.
2. Client'ta (Home/Matches) hangi RPC'nin çağrılacağını `profiles.onboarding_version`'a göre seç — v1 kullanıcılar (varsa, kalırlarsa) eski RPC'de kalır, v2 kullanıcılar yeniye gider. Clean-start sonrası muhtemelen HERKES v2 olacağı için bu geçiş kısa ömürlü olur.
3. Ancak `get_top_matches`'in mevcut client çağrı noktaları (`app/(tabs)/index.tsx`, `app/(tabs)/matches.tsx`) tek bir RPC adı bekliyor — iki fonksiyonu yönetmek yerine, tüm dummy veri + eski onboarding_answers temizlendikten sonra **doğrudan `get_top_matches`'in kendisini güncellemek** de savunulabilir bir seçenek (zaten kimse v1 şemasında kalmayacaksa ayrı bir v2 fonksiyonuna gerek kalmaz) — bu bir mimari tercih, ikisi de geçerli, kullanıcıyla netleşmeli (§C).

### B.8 V2 dummy profil seed yaklaşımı — ✅ KARAR: 80-120 kaliteli profil, `is_seed_data=true`
Kullanıcı kararıyla sayı netleşti: **80-120 arası, kaliteli** V2 seed profili (bugünkü 500'lük tek seferlik, hiç etkileşmeyen toplu ekleme yerine — A.6'nın gösterdiği "dummy'ler birbiriyle hiç etkileşmedi" sorununu tekrarlamamak için daha küçük ve amaca uygun).
1. **`profiles.is_seed_data boolean not null default false`, server-controlled** — bu, Phase 0/0.1'in kurduğu allowlist deseniyle AYNI mantıkla korunmalı: `authenticated` rolüne bu kolon için UPDATE grant'i **verilmemeli** (yeni seed script'i `service_role` ile yazacağı için buna ihtiyacı yok), client hiçbir zaman kendi `is_seed_data` değerini değiştirememeli. Domain/isim/tarih desenine bakıp forensik olarak tahmin etmek yerine tek bir `WHERE is_seed_data=true` ile filtrelenebilsin — bugünkü egzersizin bir daha gerekmemesi tam olarak bu kolonun amacı.
2. **pravatar.cc yerine gerçek/lisanslı bir görsel kaynağı** — CLAUDE.md zaten bunu P2 olarak not etmişti ("projede kullanılabilecek yerel demo asset yok"); V2 seed'i bunun için küçük, lisansı temiz bir yerel foto seti kullanmalı (harici, kontrolsüz bir servise bağımlı kalınmasın).
3. Seed, `onboarding_answers_v2` + `profile_prompts` satırlarını da doldursun — sadece `profiles` değil, aksi halde v2 matching'in intent/compatibility puanlaması test edilemez (bugünkü durumda tam olarak buydu: dummy'ler intent verisi olmadan var oldular, gerçek matching hiç test edilemedi çünkü hiç birbirleriyle eşleşmediler — A.6).
4. 80-120'lik seed havuzunun kendi İÇİNDE gerçekçi bir dağılım (yaş/şehir/ilçe/intent/lifestyle çeşitliliği) olmalı — amaç sadece "candidate pool doldurmak" değil, matching'in gerçekten anlamlı skorlar üretip üretmediğini test edebilmek.

### B.9 Phase 0 / 0.1 güvenlik önlemlerinin korunması — regresyon checklist'i
V2 şema işi bittiğinde tekrar çalıştırılmalı:
```sql
-- profiles kolon kilidi hâlâ yerinde mi
select has_column_privilege('authenticated','public.profiles','photo_verified','UPDATE'); -- false olmalı
select has_column_privilege('authenticated','public.profiles','is_premium','UPDATE');      -- false olmalı
select has_column_privilege('authenticated','public.profiles','daily_views_count','UPDATE'); -- false olmalı
-- yeni onboarding_answers_v2 İLK GÜNDEN doğru RLS ile mi kuruldu (qual:true HATASI TEKRARLANMASIN)
select qual from pg_policies where tablename='onboarding_answers_v2' and cmd='SELECT'; -- auth.uid()=user_id olmalı, true OLMAMALI
-- verification-selfies hâlâ private mi
select public from storage.buckets where id='verification-selfies'; -- false olmalı
-- get_top_matches / get_top_matches_v2 hâlâ SECURITY DEFINER + auth check + anon kapalı mı
select prosecdef from pg_proc where proname like 'get_top_matches%';
select has_function_privilege('anon','public.get_top_matches(uuid,integer)','EXECUTE'); -- false olmalı
-- is_seed_data client tarafından yazılamıyor mu (yeni B.8 kolonu)
select has_column_privilege('authenticated','public.profiles','is_seed_data','UPDATE'); -- false olmalı
```
**En kritik risk:** `onboarding_answers_v2` kurulurken Phase 0.1'in düzelttiği tam hatanın (geniş `qual:true` SELECT policy) tekrarlanması — yeni tablo GÜN 1'den `auth.uid()=user_id` ile kurulmalı, sonradan düzeltilecek bir şey olarak bırakılmamalı.

### B.10 Rollback ve doğrulama checklist'i
1. ✅ **Audit snapshot** — B.0'da alındı ve doğrulandı (`backups/20260920T184910Z_*`). Silme öncesi hâlâ geçerli/tazeliğini koruyor (sistemde bu iki mesaj arasında canlı trafik olmadı).
2. **Ön-kontrol (silme anında tekrar):** `matches.meetup_proposed_by` dolu satırlar B.2'de zaten bulundu (2 satır) — silme sırasının kendisi (`DELETE FROM matches` önce) bunu zaten güvenli hale getiriyor, ek bir kontrol gerekmez ama silme sonrası `SELECT count(*) FROM matches` → 0 ile teyit edilmeli.
3. **Silme sonrası doğrulama (kullanıcının istediği tam liste):**
   - `auth.users` = 0
   - `profiles` = 0
   - `onboarding_answers`/`matches`/`likes`/`messages`/`notifications`/`events`/`blocks`/`reports` = 0 (hepsi)
   - `storage.objects` (user-photos + verification-selfies, kullanıcı klasörleri) = 0
   - `venues` = 10 (DEĞİŞMEMELİ — kullanıcı verisi değil)
4. **Bucket/policy kontrolü:** `verification-selfies` bucket'ı hâlâ var VE `public=false`; `user-photos`/`verification-selfies` üzerindeki own-folder-only policy'ler hâlâ duruyor (silinmedi, sadece içindeki objeler boşaldı).
5. **Rollback — gerçekçi sınırlarıyla:** silme geri alınamaz (cascade + Admin API sonrası) ve B.0'daki export **tam bir rollback aracı değil** (bkz. B.0'ın "Neyi GERİ YÜKLEYEMEZ" bölümü — auth kimliği/şifre ve storage byte'ları hiçbir şekilde geri gelmiyor). Export'un gerçek faydası: veri DEĞERLERİNİN (profil bilgisi, mesaj içeriği vb.) denetim amaçlı elle referans alınabilmesi, "uygulamayı silme öncesi haline döndürme" değil. Bu yüzden B.0 atlanmadı ama beklenti de buna göre ayarlanmalı.
6. **V2 şema sonrası:** §B.9'daki güvenlik checklist'i (photo_verified/is_premium/daily_views_*/is_seed_data hâlâ kilitli, onboarding_answers_v2 RLS doğru, get_top_matches hâlâ DEFINER+auth check) + `npx tsc --noEmit` + migration baseline'ın (§B.1) hâlâ `local==remote` gösterdiğinin teyidi + yeni onboarding akışının cihaz testi (telefon/email doğrulama hariç, onlar ayrı bir faz).

---

## C. Açık kararlar — GÜNCEL DURUM

Kullanıcının 2026-09-21 kararıyla 1-3 kapandı. 4-6 hâlâ açık, uygulamaya geçmeden netleşmeli:

1. ~~`[3.-taraf-e-postası — kimliği doğrulanamadı]`~~ — ✅ **KAPANDI: silinecek** (607/607'nin parçası).
2. ~~`test@1234`~~ — ✅ **KAPANDI: silinecek**.
3. ~~Doğukan'ın kendi 5-6 hesabı~~ — ✅ **KAPANDI: silinecek**, sonradan yeniden açılacak.
4. **`get_top_matches` vs `get_top_matches_v2`** — tek fonksiyonu güncellemek mi, paralel yeni fonksiyon mu (§B.7)? Clean-start sonrası ortada hiç v1 kullanıcı kalmayacağı için tek fonksiyonu doğrudan güncellemek artık daha savunulabilir bir seçenek — ama hâlâ kullanıcı tercihi.
5. **V2 seed'in kesin içeriği** — 80-120 sayısı netleşti (§B.8) ama hangi şehir/yaş/intent dağılımıyla kurgulanacağı henüz değil.
6. ~~Migration baseline onarımı~~ — ✅ **TAMAMLANDI** (§B.1), clean-start'tan önce yapıldı.

## D. Dürüst sınırlamalar
- Bu envanter tamamen mevcut anlık DB durumuna dayanıyor — kod tarafında (seed script'in kendisi, varsa) ayrıca okunmadı, sadece sonuçları sorgulandı.
- `events`'teki 3 dummy-taraflı satır ve `notifications`'taki 240 dummy-alıcılı satırın TAM olarak hangi mekanizmadan geldiği (`handle_match_notification` trigger'ı) CLAUDE.md'den biliniyor ama bu oturumda tekrar doğrulanmadı (fonksiyon gövdesi tekrar okunmadı) — düşük riskli bir varsayım, gerekirse silme öncesi tekrar teyit edilebilir. Zaten TÜM tablo temizleneceği için (607/607) bu ayrım artık pratikte önemsiz.
- Supabase branching bu projede yok — "önce izole bir ortamda dene" seçeneği yok. Gerçek `pg_dump` da bu ortamda mümkün değil (Docker/Podman/pg_dump/psql hiçbiri kurulu değil, hepsi test edildi) — B.0'daki mantıksal JSON export tek gerçekçi yedek seçeneğiydi. Kullanıcı isterse Dashboard'ın kendi "Database backups" özelliğini (varsa, plan'a bağlı) ayrıca, bu oturumdan bağımsız olarak tetikleyebilir — bu araçlardan hiçbiri bunu benim adıma yapamıyor.
- B.0'daki yedek **mantıksal** (satır-bazlı JSON) bir yedek, `pg_restore` ile tek komutta geri yüklenebilecek ikili bir dump değil — restore gerekirse elle/script ile satır satır geri yazma gerekir (`backups/*_README.md`'de not edildi).
