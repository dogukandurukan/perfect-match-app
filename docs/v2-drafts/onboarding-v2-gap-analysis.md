# Onboarding V2 — Gap Analysis

Claude Code tarafından 2026-09-20'de, `~/Downloads/Tempa-Onboarding-V2-Master-Spec.md`'ye (canonical spec) karşılık üretildi. **Hiçbir kod/şema/migration çalıştırılmadı.** Her bulgu ya doğrudan kod okunarak ya da canlı Supabase DB'sine sorgu atılarak (RLS policy'leri, gerçek GRANT'ler, storage bucket ayarları) doğrulandı — hiçbiri CLAUDE.md özetinden kopyalanmadı.

İlgili önceki belge: `docs/matching-engine-v2.md` (2026-09-20, aynı gün) — oradaki bulgularla çakışan yerler referans veriliyor, tekrar yazılmadı.

---

## 🔴 0. Bu audit sırasında bulunan, spec'ten bağımsız 2 kritik güvenlik açığı

Bunlar Onboarding V2 ile ilgisiz, **bugün canlıda var olan** sorunlar ama spec'in Section 12 (manual verification integrity) ve Section 14 (membership gate) taleplerini **temelden geçersiz kılacak** cinsten — bu yüzden en başta, ayrı olarak flagliyorum.

### 0.1 `profiles` tablosunda hiçbir kolon UPDATE'ten korunmuyor
```sql
has_column_privilege('authenticated','public.profiles','photo_verified','UPDATE') → true
has_column_privilege('authenticated','public.profiles','is_premium','UPDATE')      → true
has_column_privilege('authenticated','public.profiles','waitlist_number','UPDATE') → true
```
`"Users can update own profile"` RLS policy'si `USING (auth.uid()=id)` — **`WITH CHECK` yok, kolon bazlı kısıtlama yok.** Sonuç: herhangi bir giriş yapmış kullanıcı, kendi REST session'ıyla `PATCH /rest/v1/profiles?id=eq.<kendi-id>` ile `{"photo_verified": true}` ya da `{"is_premium": true}` gönderip **manuel doğrulamayı ve premium/membership kontrolünü kendi kendine bypass edebilir.** Bu, spec'in "manual review", "Accepted → Membership gate", "membership-entitlement state" taleplerinin HEPSİNİN üzerine inşa edileceği zemini bugün itibariyle güvensiz kılıyor — V2'nin membership gate'i, bu düzeltilmeden anlamsız olur.
**Öneri:** `photo_verified`/`is_premium`/(gelecekteki `membership_status`/`application_status`) gibi "sadece server-side yazılabilir" kolonlar için ya (a) `REVOKE UPDATE (col) FROM authenticated` + servis-rolüyle çalışan bir RPC/Edge Function, ya da (b) bir `BEFORE UPDATE` trigger'la bu kolonların `auth.uid()=id` tarafından değiştirilmesini engellemek gerekiyor. CLAUDE.md'nin 2026-09-08'de `try_send_invite`/`increment_daily_views` için yaptığı "anon/authenticated grant'ini kapat, RPC üzerinden yürüt" deseninin aynısı.

### 0.2 Doğrulama selfie'si PUBLIC bir storage bucket'ta
```sql
select id, public from storage.buckets → user-photos: public=true
```
`verification_selfie_path` = `{userId}/verification_selfie.jpg`, aynı **public** `user-photos` bucket'ında (normal profil fotoları ile birlikte). Yani `https://<proje>.supabase.co/storage/v1/object/public/user-photos/{userId}/verification_selfie.jpg` **kimlik doğrulama olmadan, sadece userId bilerek** herkes tarafından indirilebilir — ve `userId` değerleri zaten uygulama içinde (Discover/Matches/Chat'te) her authenticated kullanıcıya sürekli gösteriliyor. Spec'in Section 12/17'sinin "verification selfie is never public / only authorized reviewers may access it" şartını doğrudan ihlal ediyor.
**Öneri:** Ayrı, **private** bir bucket (örn. `verification-selfies`) + sadece service-role/reviewer erişimine izin veren Storage RLS + kullanıcıya gösterirken (varsa) signed URL. Bu V2'nin zaten "restricted admin review queue" gereksiniminin bir parçası, ek iş değil — sırayla yapılmalı.

---

## A. EKRAN BAZLI GAP ANALİZİ

### A.1 Hesap oluşturma / Auth
**Bugün:** `app/(auth)/register.tsx` — Supabase Auth **email+password** (`signUp`/`signInWithPassword`). Telefon hiç auth kimliği değil, sadece `profiles.phone_number` alanı (step1/index.tsx'te toplanıyor, doğrulanmıyor). E-posta doğrulaması `emailRedirectTo` ile bir link gönderiyor ama app bunu **hiçbir yerde kontrol etmiyor** (giriş sonrası e-posta doğrulanmış mı diye bakmıyor).
**Spec:** Telefon = giriş noktası + hesabı yaratan OTP kimliği. E-posta = ayrı, zorunlu ama girişten hemen sonra değil, submission öncesi doğrulanan ikinci bir checklist item.
**Karar: CHANGE — köklü.** Bu, basit bir ekran değişikliği değil, **auth mimarisi değişikliği**:
- Supabase Auth'ta telefonu birincil kimlik yapmak (`signInWithOtp({phone})`) İÇİN gerçek bir SMS sağlayıcısı (Twilio vb.) Supabase projesine bağlanmalı — bu **ücretli, dışarıdan bir bağımlılık**, CLAUDE.md'nin daha önce "ertelendi" dediği tam olarak bu (§5, "Kimlik güvenilirliği — ertelendi" notu). Kod yazmadan önce bu sağlayıcı kararı verilmeli.
- "Telefon birincil + e-posta ayrıca doğrulanan ikincil kimlik, aynı hesapta" — Supabase Auth bunu native olarak destekliyor (`auth.users` hem `phone` hem `email` kolonlarını taşıyabilir, ikisi de ayrı ayrı `phone_confirmed_at`/`email_confirmed_at` ile doğrulanabilir) ama bugünkü kod bunların hiçbirini kullanmıyor — sıfırdan kurulacak.
- **`register.tsx`, `login.tsx`, `forgot-password.tsx` üçü de yeniden yazılmalı.**

### A.2 `app/profile-setup/step1/index.tsx` (telefon)
**Bugün:** Düz text input, OTP yok, "Continue" her zaman aktif (sadece boş olmasın diye kontrol).
**Karar: CHANGE** → A.1'in parçası, gerçek OTP ekranına dönüşmeli (kod girişi, resend, hata/expire state'leri, OS autofill).

### A.3 `step1/photos.tsx`
**Bugün:** `PHOTO_SLOTS=6`, ama alt yazı **"Add at least one to continue"** — minimum sadece **1** foto. Yüz net görünmeli / grup fotosu olmasın gibi bir kural yok, crop/reposition/reorder yok (CLAUDE.md: "otomatik ilk-boş-slota-atama" — sıralama manuel değil).
**Spec:** min 3, max 6, ilk foto net yüz + grup fotosu olamaz, crop/reposition/reorder.
**Karar: CHANGE.** Max zaten spec'e uyuyor (6). Minimum 1→3 kolay bir doğrulama değişikliği. Crop/reposition/reorder + "ilk foto yüz kontrolü/grup fotosu değil" kontrolleri **yeni** — otomatik yüz tespiti yapılmayacaksa (spec bunu istemiyor, manuel review zaten var) bu kural muhtemelen sadece review aşamasında insan tarafından kontrol edilecek, onboarding'de teknik bir gate olmayabilir — **açık karar**.

### A.4 `step1/verify.tsx` (selfie)
**Bugün:** **Opsiyonel** (Next hiç kilitlenmiyor), tek sabit talimat yok (sadece "take a selfie"), submission'a bağlı bir review kuyruğu yok, sonuç sadece tek `photo_verified` boolean (retry/rejected state'leri yok).
**Spec:** Zorunlu, değişken poz talimatı ("iki parmak kaldır" gibi), submission'a bağlı review kuyruğu, 3 durumlu sonuç (`verified/retry_required/rejected`).
**Karar: CHANGE.** Bkz. §0.2 (bucket) ve §F (review state machine) — bu ekranın kendisi küçük bir değişiklik, ama arkasındaki veri modeli/depolama tamamen yeniden kurulmalı.

### A.5 `step1/{name,instagram,birthdate,location,gender,languages}.tsx`
- **name:** KEEP (zaten `first_name`, visible, gerekli).
- **instagram:** KEEP (spec'te açıkça yok ama zaten var, zararsız, "trust signal" olarak CLAUDE.md'nin exclusivity kararına uygun — kaldırmaya gerek yok).
- **birthdate:** KEEP + CHANGE — doğum tarihi zaten private tutuluyor (sadece yaş gösteriliyor, CLAUDE.md doğrulamış), zodiac otomatik hesaplanıyor (`lib/zodiac.ts`). Spec'in "zodiac skora max %2-3 katkı" kuralı bugün **YOK** — `get_top_matches`'te zodiac +5/+2 sabit puan (140 üzerinden ~%3.5, sınırda ama biraz yüksek) — matching-engine-v2.md'de zaten not edilmişti, burada tekrar teyit.
- **location:** KEEP — `lib/turkishGeo.ts` tabanlı gerçek city/district autocomplete zaten var, spec'in "district = distance/locality" gereksinimini karşılıyor. Distance/km bazlı hiçbir şey yok (bkz A.13).
- **gender:** `GENDER_CHIPS = ['Man','Woman','Non-binary']` — **spec'in "Self-describe" seçeneği YOK.** CHANGE (kolay, ek bir chip + serbest metin alanı).
- **languages:** KEEP — zaten çoklu seçim, en az 1 zorunlu.

### A.6 `step2/{index,q1,q2,q3}.tsx` (Intentions) — **en büyük restructure**
**Bugün:** Intent = 4 seçenek (`just_friends/keeping_it_casual/open_to_relationship/not_sure_yet`), her intent'in **kendine özgü, birbirinden tamamen farklı 3 soru seti** var (12 farklı alan, `onboarding_answers`'a yazılıyor).
**Spec:** Intent = 3 seçenek (`long_term/casual/figuring_it_out`, **just_friends kaldırılıyor**), sonra **HERKESE aynı 3 evrensel soru** (pace, communication/connection_style, closeness/connection_energy) + **1 koşullu son soru** (long_term/figuring_it_out → children_view; casual → exclusivity_view).
**Karar: CHANGE — tamamen yeniden tasarım, eski akışın üstüne yama değil.** Detay için bkz. §E (value remapping) — kolon isimleri kısmen çakışıyor ama **anlamları tamamen farklı**, güvenli otomatik taşıma YOK.

### A.7 `step3/{recharge,hobbies,drinking,education,occupation,height,pets}.tsx`
- **recharge/morning_night:** KEEP ama CHANGE gerekebilir — spec "naive equality kullanma, approved matrix kullan" diyor; bugün `get_top_matches`'te tam eşitlik +15 (naive). Alan/soru aynı kalabilir, **skor mantığı** değişmeli (matching-engine-v2.md'de zaten flag'lenmişti).
- **hobbies:** `MAX_HOBBIES=5`, minimum yok (0 da geçerli). Spec: min 5, max 10. **CHANGE** — hem alt hem üst sınır değişiyor, mevcut kullanıcıların çoğu muhtemelen 5'ten az hobi seçmiş, re-ask gerekebilir (aşağıda genişletme mümkün, azaltma gerekmiyor — sadece minimum'u zorlamak yeterli, geriye dönük veri kaybı yok).
- **drinking/smoking:** Bugün **TEK birleşik chip** (`DrinkingSmoking`: Both/Only drinking/Only smoking/When socializing/Neither) → lossy bir `if/else` ile `drinking`/`smoking` = 'Yes'/'No'/'Socially'e dönüştürülüyor. Spec: **iki bağımsız, 4 değerli soru** (smoking: Never/Occasionally/Regularly/Trying to quit; drinking: Never/Socially/Regularly/Sober). **CHANGE — güvenli otomatik remap YOK** (bkz. §E, kayıp bilgi var: "Only smoking" seçen biri aslında "drinking: Socially" olabilirdi ama bugünkü UI bunu hiç sormuyor, zorla 'No' yazıyor).
- **education/occupation/height/pets:** Büyük ölçüde KEEP. Spec'in "education equality varsayılan bonus olmasın" kuralı bugün ihlal ediliyor (+8 sabit bonus, matching-engine-v2.md'de not edildi). Pets bugün free-form (`No pets/Dog/Cat/Other` muhtemelen tek seçim) — spec "multi-select where appropriate" diyor, kontrol edilip gerekirse çoklu seçime açılmalı.

### A.8 `step4/{hours,venue,neighborhoods,firstmeeting,bio}.tsx`
- **hours (availability_hours):** Spec'in section 8 tablosunda bu alan **hiç yok** — "When are you usually free to meet? Weekday evenings/Saturdays/Sundays/Flexible" farklı, daha basit bir soru öneriyor. **CHANGE** — bugünkü `availability_hours` bucket sistemi (Morning/Afternoon/Evening gibi) muhtemelen basitleştirilecek.
- **venue (first-date environment):** Bugün 5 seçenek, emoji'li (`lib/meetingVenues.ts`). Spec: 6 seçenek, emoji yok, biri **yeni** ("A museum, exhibition or live event" — bugün karşılığı yok). **CHANGE**, string'ler `get_top_matches`'in overlap eşleşmesinde kullanıldığı için (exact string match) **remap tablosu gerekli**, aksi halde geçmiş cevaplar sessizce hiç eşleşmez hale gelir.
- **neighborhoods:** Spec'in "advanced location controls" kapsamına giriyor gibi görünüyor, section 6/11'de ayrı bir "neighborhoods" alanı yok. `profiles.neighborhoods` zaten (matching-engine-v2.md'de not edildiği gibi) hiç yazılmıyordu — ama bu step4 ekranı yazıyor mu kontrol edilmeli (isim çakışması riski var, iki farklı "neighborhoods" kavramı karışmasın).
- **firstmeeting (first_date_expectation):** Spec'te birebir karşılığı yok, muhtemelen "Profile prompts" kapsamına taşınabilir veya kalabilir.
- **bio:** KEEP, spec "Short bio, optional, prompts carry more importance" diyor — bugün zorunlu mu opsiyonel mi kontrol edilmeli, muhtemelen zaten opsiyonel.

### A.9 Profile prompts (Section 7) — **bugün hiç yok**
Spec: 8 maddelik bir prompt kütüphanesi, kullanıcı en az 2'sini seçip cevaplıyor (Hinge tarzı). Bugün böyle bir sistem yok — `favorite_music/favorite_movie/favorite_book/core_value/impressed_by/favorite_activity/first_date_expectation` gibi **sabit, herkese aynı sırayla sorulan** alanlar var (kullanıcı bunlardan "seçmiyor", hepsi soruluyor). `lib/hingeProfile.ts`'in `buildPromptCards()`'ı bunları görüntülemede "prompt kartı" gibi gösteriyor ama onboarding'de gerçek bir "kütüphaneden seç" mekanizması yok.
**Karar: ADD** — yeni bir `profile_prompts` tablosu (user_id, prompt_key, answer_text) veya `profiles`/`onboarding_answers`'a jsonb bir alan gerekiyor. Mevcut sabit alanlar (favorite_movie vb.) korunabilir (profil görüntülemede hâlâ kullanılıyorlar) ama "prompt seçimi" ayrı, yeni bir kavram olarak eklenmeli — üstüne yazmak yerine yanına eklemek daha güvenli.

### A.10 Interests (Section 9.1)
**Bugün:** `hobbies` (A.7'de ele alındı) zaten bu işlevi görüyor, min/max sayı farklı. Spec'in **sabit 24 maddelik interest listesi** bugünkü `HOBBY_SUGGESTIONS`'tan (CLAUDE.md: "öneri dropdown'lu, serbest metin de eklenebilir") farklı olabilir — serbest metin eklemeye izin veriyor bugün, spec sabit bir liste öneriyor gibi duruyor (net değil, "Initial interest set" listesi verilmiş ama serbest ekleme yasaklanmamış). **Açık karar.**

### A.11 Manual photo verification — bkz. A.4 + §0.2 + §F.

### A.12 Review/Waitlist/Membership — **bugün hiç yok**
`profiles.waitlist_number`/`waitlist_boost` dışında (CLAUDE.md: "kozmetik, gerçekten geciktirmiyor") hiçbir application/review durum makinesi, hiçbir admin/reviewer ekranı, hiçbir route guard yok. `app/_layout.tsx`'in mevcut auth yönlendirmesi sadece "giriş yapılmış mı" ve `current_step`'e bakıyor, "kabul edildi mi / membership aktif mi" diye bir kontrol hiç yok.
**Karar: ADD — sıfırdan.** Bkz. §F.

### A.13 Preferences — "Who you'd like to meet" (Section 11)
- **Age range:** `discovery_age_min/max` zaten var (Filters ekranı) AMA `matching-engine-v2.md`'de bulunduğu gibi **`get_top_matches` bunu hiç filtrelemiyor** — hem bu spec'in hem önceki audit'in ortak, bağımsız P0'ı.
- **Distance:** Bugün `discovery_max_distance` = `'same_district'|'whole_city'` (kaba). Spec: km bazlı (5/15/30/anywhere). **CHANGE** — gerçek mesafe hesaplaması `lat/lng` kullanmalı (bugün hiç kullanılmıyor), ya da km aralıkları ilçe-tahmini bir yaklaşıma map'lenebilir (daha kaba ama hızlı bir ilk adım).
- **Smoking/Drinking preference (dealbreaker/prefer/dont_care):** Bugün `discovery_nonsmokers_only` (tek boolean, sadece smoking, sadece "dealbreaker" seviyesi var — "prefer" yok) ve **drinking için hiçbir preference kolonu yok**. **ADD** — 3 seviyeli bir model için yeni kolonlar veya bir `preference_strengths jsonb` (matching-engine-v2.md'nin açık kararı #3 ile aynı soru, burada da geçerli).
- **Height:** `discovery_height_min/max` zaten var, spec'e uygun. KEEP.
- **Pets preference:** `discovery_pets` bugün "hangi pet türlerini istiyorsun" (array/filtre) — spec'in "Yes absolutely/It depends/Preferably no/No dealbreaker" modeli **farklı bir soru** (genel tolerans seviyesi, tür değil). **CHANGE/ADD** — muhtemelen ayrı bir alan.
- **Advanced preferences (zodiac/education/verified/active/pets türü/genişletilmiş konum):** Bugün bunların hepsi zaten var (`discovery_zodiac_signs/discovery_education/discovery_verified_only/discovery_active_today/discovery_pets`) ve zaten "Advanced Filters" sekmesinde (premium kilitli) — spec'in "keep these out of initial onboarding, expose later in filters" isteğiyle **zaten birebir uyumlu.** KEEP.

---

## B. KOLON BAZLI TABLO — `profiles` + `onboarding_answers`

| Kolon | Bugünkü değerler/kullanım | Spec'teki karşılığı | Karar | Güvenli remap? |
|---|---|---|---|---|
| `onboarding_answers.intent` | just_friends/keeping_it_casual/open_to_relationship/not_sure_yet | long_term/casual/figuring_it_out (just_friends kalkıyor) | CHANGE | Kısmi: keeping_it_casual→casual, open_to_relationship→long_term, not_sure_yet→figuring_it_out **muhtemelen doğru**; `just_friends` kullanıcıları için **karşılık YOK** — ürün kararı gerekiyor (bkz §I) |
| `relationship_pace` | Sadece open_to_relationship'e özel soru, 4 farklı değer seti | Herkese sorulan evrensel "connection pace" sorusu, 3 farklı değer seti | CHANGE | **HAYIR** — aynı kolon adı, tamamen farklı soru/değerler. Re-ask şart. |
| `connection_style` | Sadece keeping_it_casual'a özel ("vibe ne zaman belli olur"), 4 değer | Herkese sorulan "communication" sorusu, 3 farklı değer | CHANGE | **HAYIR** — isim aynı, anlam tamamen farklı. Re-ask şart. |
| `connection_energy` | Sadece not_sure_yet'e özel ("ne enerjisi getiriyorsun"), 4 değer | Herkese sorulan "closeness/independence" sorusu, 3 farklı değer | CHANGE | **HAYIR** — isim aynı, anlam tamamen farklı. Re-ask şart. |
| `children_view` | **Hiç yazılmıyor** (şemada var, UI yok) | long_term/figuring_it_out'un koşullu son sorusu | ADD | Zaten boş, sorun yok |
| `exclusivity_view` | Sadece keeping_it_casual'a özel ("exclusivity nasıl hissediyorsun"), 3 değer | casual'ın koşullu son sorusu, benzer tema ama 3 FARKLI değer | CHANGE | Kısmi/riskli — tema örtüşüyor ama seçenek metinleri farklı, **manuel value-map + re-ask önerilir** |
| `friendship_value`,`hangout_frequency`,`social_preference` | just_friends'e özel 3 soru | Spec'te just_friends yok | **REMOVE/FREEZE** | Kolonu dondur (religion kararındaki gibi), kod hiç okumasın/yazmasın |
| `casualness_expectation`,`life_priority`,`relationship_vision`,`excitement_factor`,`commitment_view` | Eski intent-özel sorular | Spec'te karşılığı yok | **REMOVE/FREEZE** | Aynı, dondur |
| `sub_intent`,`marriage_view`,`living_preference`,`shared_interests_importance`,`friendship_type` | Hiç yazılmıyor, hiç okunmuyor | Spec'te karşılığı yok | **REMOVE/FREEZE** (zaten ölü) | — |
| `profiles.drinking`/`smoking` | 'Yes'/'No'/'Socially' (birleşik chip'ten lossy türetilmiş) | 4 bağımsız değer, iki ayrı soru | CHANGE | Kısmi/lossy — best-effort map mümkün ama bilgi kaybı var, **re-ask önerilir** |
| `profiles.gender` | Man/Woman/Non-binary | +Self-describe | ADD (genişletme) | Mevcut 3 değer sorunsuz kalır |
| `profiles.meeting_environment` | 5 emoji'li label | 6 emoji'siz label (1 yeni: müze/etkinlik) | CHANGE | Value-map tablosu gerekli (string exact-match matching'i kullanıyor) |
| `profiles.hobbies` | max 5, min 0 | min 5, max 10 | CHANGE | Mevcut veriler geçerli kalır (üst sınır gevşiyor), sadece min zorunluluğu yeni kullanıcılar/re-ask için |
| `profiles.discovery_max_distance` | same_district/whole_city | 5/15/30 km/anywhere | CHANGE | Kaba bir map mümkün (whole_city→anywhere, same_district→~5km) ama gerçek anlamı farklı |
| `profiles.religion`,`discovery_religion` | Donduruldu (2026-09-13, KVKK) | Spec: "Religion remains frozen/out of MVP" | **KEEP FROZEN** | Zaten doğru durumda, dokunma |
| `profiles.photo_verified` | Tek boolean, self-updatable (§0.1) | verified/retry_required/rejected 3 durum + access control | CHANGE | Yeni bir `verification_status` enum + reviewer audit alanı gerekiyor |
| `profiles.phone_verified` | Kolon var, **hiçbir yerde set edilmiyor** (grep: sıfır yazma) | Gerçek OTP sonrası set edilmeli | ADD (fiilen kullanılmaya başlanacak) | — |
| `profiles.waitlist_number`/`waitlist_boost` | Kozmetik, gerçek bir akışa bağlı değil | Application/review/waitlist state machine'in bir parçası olabilir | CHANGE | Gerçek bir `application_status` ile birlikte kullanılmalı |
| `profiles.is_premium` | "Premium özellik" bayrağı (daha fazla beğeni/filtre), self-updatable (§0.1) | Membership gate'in temeli olabilir ama bugünkü anlamı FARKLI (özellik sınırı, erişim değil) | CHANGE | Yeni bir `membership_status`/`membership_active_until` gerekebilir, `is_premium`'u olduğu gibi membership gate yapmak KARIŞTIRIR (bugünkü "premium features" anlamıyla çakışır) |

---

## C. AUTH MİMARİSİ — dışarıdan bağımlılıklar

1. **SMS OTP sağlayıcısı** (Twilio vb.) Supabase projesine bağlanmalı — ücretli, ayrı bir hesap/kurulum, CLAUDE.md'nin daha önce ertelediği tam olarak bu. **Bu olmadan Section 3.1 hiç implemente edilemez.**
2. **Email OTP** — Supabase Auth'un kendi email OTP'si (`signInWithOtp({email})`) ya da mevcut magic-link akışı kullanılabilir, ek bir sağlayıcı gerekmez (Supabase'in kendi SMTP'si/Resend entegrasyonu yeterli olabilir) — bu görece daha kolay.
3. **"Telefon birincil + email ikincil, aynı hesapta"** — Supabase Auth `updateUser({phone})`/`updateUser({email})` ile ikisini de aynı `auth.users` satırına bağlayabiliyor, ama **RLS/route-guard mantığı sıfırdan yazılmalı** (bugün hiçbiri yok).
4. **Route guard'lar** (`app/_layout.tsx`) — bugünkü mantık sadece "session var mı" + `current_step` kontrolü yapıyor. Spec'in Section 2 tablosundaki 8 farklı durumun (phone not verified / application incomplete / submitted-pending / waitlisted / accepted-membership-inactive / membership-active / membership-expired / changes-requested) HERHANGİ birini ayırt edecek bir mekanizma yok — hepsi sıfırdan kurulmalı.

---

## D. Application / Review / Waitlist State Machine — önerilen tasarım

Bugün hiçbir karşılığı yok. Önerilen minimal şema:

```sql
alter table profiles add column application_status text not null default 'draft'
  check (application_status in ('draft','submitted','under_review','waitlisted','changes_requested','accepted','rejected'));
alter table profiles add column application_submitted_at timestamptz;
alter table profiles add column application_reviewed_at timestamptz;
alter table profiles add column application_reviewer_note text; -- sadece reviewer'a görünür olmalı

alter table profiles add column membership_status text not null default 'none'
  check (membership_status in ('none','pending_activation','active','expired','cancelled'));
alter table profiles add column membership_activated_at timestamptz;
alter table profiles add column is_founding_member boolean not null default false;
```

**Reviewer erişimi:** Bugün hiçbir admin/reviewer rolü yok (grep: sıfır sonuç). Ya (a) Supabase Dashboard'dan elle güncelleme (CLAUDE.md'nin `photo_verified` için zaten yaptığı gibi — küçük ölçekte makul, ölçek büyüyünce yetersiz), ya da (b) `auth.users`'a custom bir `role` claim + ayrı bir "reviewer" hesabı türü + kendi RLS'i olan minimal bir admin ekranı. **Spec'in kendisi de "Admin-review staffing" kararını "ayrı, sonra verilecek" diye işaretlemiş (Section 20)** — bu yüzden ilk faz için (a) yeterli, (b) sonraya bırakılabilir.

**`is_premium` ile karışmaması için:** `membership_status='active'` gerçek app-erişim gate'i olmalı; `is_premium` bugünkü "ekstra beğeni/filtre" anlamında KALABİLİR (ayrı kavram) — spec bunu net söylemiyor ama karıştırmamak, section 14'ün "Tempa+'ı şimdi tasarlama" ilkesiyle de uyumlu (membership ≠ premium-features-within-membership).

---

## E. Value Remapping — özet karar

| Alan | Otomatik, sessiz migration güvenli mi? |
|---|---|
| `intent` (just_friends hariç 3 değer) | Kısmen — 3/4 değer mantıklı eşleşiyor |
| `intent = just_friends` | **HAYIR** — karşılık yok, ürün kararı gerekiyor |
| `relationship_pace`,`connection_style`,`connection_energy` | **HAYIR** — aynı kolon adı, anlam tamamen farklı, re-ask şart |
| `exclusivity_view` | Riskli — tema aynı, değerler farklı, manuel map + kullanıcıya "confirm" göster önerilir |
| `drinking`/`smoking` | Kısmen, lossy — best-effort map + isteğe bağlı re-ask önerilir |
| `meeting_environment` | Otomatik mümkün ama **value-map tablosu şart** (string exact-match kullanıldığı için map olmadan sessizce kırılır) |
| `hobbies` | Otomatik güvenli (üst sınır gevşiyor, min yeni kullanıcı için geçerli) |
| `gender` | Otomatik güvenli (mevcut 3 değer aynen geçerli, sadece yeni seçenek ekleniyor) |
| `discovery_max_distance` | Kaba bir map mümkün ama anlamı değişiyor — kullanıcıya bildirilmeli |

**Genel ilke:** "Aynı kolon adı" ≠ "aynı anlam". Bu audit'te en az 3 kolon (`relationship_pace`, `connection_style`, `connection_energy`) tam olarak bu tuzağa düşüyor — isim tesadüfen tutuyor ama iki farklı ürün iterasyonunun tamamen farklı sorularını taşıyor. **Migration script'i yazılırken bu üçü kesinlikle "eski veriyi sıfırla, kullanıcıyı yeniden sor" listesine girmeli.**

---

## F. Matching Engine V2 etkisi (bkz. `docs/matching-engine-v2.md` ile çapraz okunmalı)

- Section 15'in "Reliability/liquidity ayrı, +40 gibi domine eden bir bonus olmasın" kuralı → bugünkü `liked_me: +40` bonusu (matching-engine-v2.md'de zaten flag'liydi) bu spec'le de çelişiyor, **iki belge aynı sonuca varıyor: küçültülmeli/tie-breaker'a indirilmeli.**
- Section 15'in "verification bir reliability sinyali, compatibility değil" kuralı → bugünkü `verified_score: +15`'in "compatibility" havuzunda olması aynı şekilde matching-engine-v2.md'nin C bölümüyle örtüşüyor.
- Yeni intent modeli (3 değer + evrensel 3 soru + 1 koşullu soru) `lib/setup2Matching.ts`'in (matching-engine-v2.md §A.3) mantığından **daha basit** — o dosyanın intent-koşullu yaklaşımı hâlâ doğru bir başlangıç noktası ama alan isimleri/değerleri bu yeni spec'e göre güncellenmeli.
- Age range artık "mutual eligibility" (her iki tarafın aralığı da diğerini kapsamalı) — bugünkü tek-yönlü (sadece BEN'im aralığım kontrol ediliyor, karşı tarafın BENİ görmek isteyip istemediği aralığı hiç kontrol edilmiyor) modelden **CHANGE**, hem age-bug fix'i hem bu karşılıklılık aynı anda düzeltilmeli.

---

## G. Migration / RLS / RPC / Test Planı (fazlı)

### Faz 0 — Güvenlik (bağımsız, hemen yapılabilir)
1. `profiles`'ta kullanıcı tarafından yazılmaması gereken kolonları (`photo_verified`, `is_premium`, ileride `application_status`/`membership_status`) REVOKE + RPC'ye taşı.
2. Verification selfie'sini private bucket'a taşı (yeni yüklemeler için; eski selfie'ler varsa taşınmalı/erişimi kapatılmalı).

### Faz 1 — Şema (destructive olmayan, ek kolon)
3. `application_status`/`membership_status`/`is_founding_member` + ilgili timestamp kolonları eklenir (default'larla, mevcut satırları bozmaz).
4. Yeni Intentions kolonları netleşir (mevcut `relationship_pace`/`connection_style`/`connection_energy`'nin "dondurulacak" mı yoksa "sıfırlanıp yeniden kullanılacak" mı olduğu §I'deki karara bağlı).
5. `profile_prompts` tablosu (ya da jsonb alan) eklenir.
6. Preference-strength kolonları (`smoking_preference_strength` vb. veya `preference_strengths jsonb`) eklenir.

### Faz 2 — RLS
7. `application_status`/`membership_status` için: kullanıcı SADECE okuyabilir, yazma sadece RPC/service-role üzerinden.
8. Reviewer erişimi (varsa yeni bir rol) için ayrı SELECT policy — selfie bucket'ı dahil.

### Faz 3 — RPC
9. `submit_application(user_id)` — tüm zorunlu alanların dolu olduğunu server-side doğrulayıp `application_status='submitted'` yapan, row-locked bir RPC (try_send_invite deseninde).
10. `review_application(...)`/`activate_membership(...)` — reviewer/ödeme entegrasyonu netleşince.
11. `get_top_matches` — age range karşılıklılığı + yeni intent modeli için güncellenir (matching-engine-v2.md'nin Ay 1 planıyla birleşir).

### Faz 4 — Client
12. Auth ekranları (telefon OTP + email OTP) — SMS sağlayıcısı seçilene kadar bekler.
13. "Build your profile" hub (resumable checklist) — yeni bir ekran.
14. Intentions akışının yeniden yazımı (step2).
15. Preferences ekranı (yeni, bugün onboarding'de yok — sadece Filters'ta post-onboarding var; spec bunu onboarding'e taşıyor).
16. Review/Waitlist/Accepted/Membership ekranları.
17. Route guard'ların (`app/_layout.tsx`) 8 durumlu tabloya göre genişletilmesi.

### Test planı
- Her faz için: **yeni hesap** (mevcut veri yok) uçtan uca test edilebilir bağımsız olarak.
- **Mevcut hesap** (3 gerçek `onboarding_answers` satırı + 505 `profiles`) için ayrı bir test: login sonrası hangi ekrana düşüyor, "re-answer" gereken alanlar gerçekten soruluyor mu, eski veriler yanlışlıkla yeni anlamla karışıyor mu (özellikle `relationship_pace`/`connection_style`/`connection_energy`).
- Güvenlik: Faz 0 sonrası `has_column_privilege` sorgusu tekrar çalıştırılıp `false` döndüğü doğrulanmalı; verification bucket'ının gerçekten private olduğu anon bir `curl` ile test edilmeli (matching-engine-v2.md'deki "anon curl ile doğrula" yöntemiyle aynı).

---

## H. Açık kararlar — kullanıcıdan netleşmeden implementasyona geçilmemeli

1. **`just_friends` kullanıcıları ne olacak?** Yeni 3-intent modelinde karşılıkları yok. Seçenekler: (a) bu kullanıcıları intent'i boşaltıp yeniden sormaya zorla, (b) `figuring_it_out`'a otomatik taşı (yanlış olabilir), (c) mevcut kullanıcı sayısı azsa (onboarding_answers'ta sadece 3 satır olduğu için muhtemelen çok az) elle incele.
2. **Mevcut 3 `onboarding_answers` satırının `relationship_pace`/`connection_style`/`connection_energy`/`exclusivity_view` değerleri** — sıfırlanıp yeniden mi sorulacak, yoksa bu üç kullanıcı özel olarak mı ele alınacak (sayı küçük, elle yönetilebilir)?
3. **SMS OTP sağlayıcısı** — hangi sağlayıcı, hangi bütçe, ne zaman aktifleştirilecek? Bu karar gelmeden Section 3.1 hiç kodlanamaz (mock/stub bir "OTP ekranı" yazmak, gerçek doğrulama olmadan spec'in amacını karşılamaz).
4. **Reviewer erişimi** — Dashboard'dan elle mi (ilk faz, düşük maliyet) yoksa gerçek bir admin paneli mi?
5. **`is_premium` ile `membership_status` ilişkisi** — tamamen ayrı kavramlar mı kalacak (önerim), yoksa `is_premium` membership'in bir görünümü mü olacak?
6. **Photo minimum'u 1→3 çıkınca mevcut kullanıcılar** — 1-2 fotoğraflı mevcut profiller "changes_requested" durumuna mı düşecek, yoksa sadece YENİ kullanıcılar için mi zorunlu olacak?
7. **`meeting_environment` value-map'i** — 5 eski etikgoldeni 6 yeni etikete tam olarak kim eşleştirecek (ürün kararı, otomatik/tahminî yapılmamalı — özellikle yeni "müze/etkinlik" seçeneğinin hiç eski karşılığı yok).

---

## I. Dürüst sınırlamalar

- Bu analiz statik kod + canlı şema okumasına dayanıyor, hiçbir ekran cihazda test edilmedi.
- `onboarding_answers`'ta sadece 3 gerçek satır olduğu için "mevcut kullanıcı etkisi" büyük ölçüde teorik — gerçek skala geldiğinde (505 `profiles`'ın çoğu muhtemelen bu tablodan hiç geçmemiş, seed veri) bu sayı büyüyünce migration riski de büyür.
- SMS OTP sağlayıcısı seçimi/entegrasyonu bu repo'nun dışında bir iş (üçüncü parti hesap, fatura) — kod tarafı hazır olsa bile bu karar gelmeden Section 3 canlıya alınamaz.
- Bu belge `docs/matching-engine-v2.md` ile bilerek çapraz referans veriyor — iki belge birlikte okunmalı, matching'e değen kararlar (age range, intent, liked_me bonus) iki kez farklı şekilde çözülmemeli.
