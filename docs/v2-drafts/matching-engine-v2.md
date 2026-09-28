# Matching Engine V2 — Audit & Implementation Plan

Claude Code tarafından 2026-09-20'de, ChatGPT'nin hazırladığı "TEMPA — Technical Handoff" belgesine karşılık üretildi. Repo + canlı Supabase DB'ye (pg_get_functiondef ile RPC gövdeleri, list_tables ile gerçek şema) bakılarak yazıldı — hiçbir bölüm hafızadan/CLAUDE.md özetinden kopyalanmadı, hepsi bu oturumda yeniden doğrulandı. **Henüz hiçbir kod/şema değişikliği yapılmadı** — bu sadece audit + plan.

---

## 0. Yöntem

İncelenenler: `mcp__supabase__list_tables` (verbose, gerçek kolonlar), `pg_get_functiondef` ile `get_top_matches`/`try_send_invite`/`upsert_match`/`handle_mutual_like`/`get_my_likers`/`increment_daily_views`'ın TAM gövdesi, `app/profile-setup/**`, `app/(tabs)/index.tsx`, `app/filters.tsx`, `lib/matchInvite.ts`, `lib/dailyViews.ts`, `lib/setup2Matching.ts`, `lib/onboardingIntent.ts`, `lib/onboardingStep2Context.tsx`, `lib/profileSettings.ts`, `lib/analytics.ts` + tüm `logEvent(...)` çağrıları.

---

## A. MEVCUT DURUM — matching bugün gerçekte nasıl çalışıyor

### A.1 Tek RPC, SQL içinde, `LANGUAGE sql` fonksiyon
`get_top_matches(p_user_id, p_limit)` — Postgres'te yaşıyor, git'te yok. Home (`p_limit:10`) ve Matches'in "eksik aday doldurma" döngüsü (`p_limit: missingCount+5`) tarafından çağrılıyor. Akış:

1. **Hard filter'lar (WHERE):** aynı şehir (case-insensitive), `discovery_max_distance` ilçe eşleşmesi, `discovery_verified_only`, `discovery_nonsmokers_only`, `discovery_height_min/max`, `discovery_zodiac_signs`, `discovery_pets`, `discovery_education`, `discovery_religion`, `discovery_active_today`, blocks (iki yönlü), var olan `matches` satırı (pending/accepted/yakın-zamanda-expired-14g/yakın-zamanda-passed-42g) → hariç, **karşılıklı** `meeting_preferences`/`gender` eşleşmesi.
2. **🔴 GERÇEK BUG (bu oturumda bulundu, V2'den bağımsız):** `discovery_age_min`/`discovery_age_max` — Filters ekranında tam çalışan bir slider, `profiles`'a yazıyor, `lib/profileSettings.ts` okuyor — ama `get_top_matches`'in `me` CTE'si bu iki kolonu **hiç select etmiyor, WHERE'de hiç kullanmıyor.** Kullanıcı "25-30 yaş görmek istiyorum" dese bile Discover/Matches bunu tamamen yok sayıyor. CLAUDE.md'nin aylarca süren filtre-ekleme oturumlarında (height/zodiac/pets/education/religion/verified/nonsmokers/active) bu hiç fark edilmemiş — hepsi age'in zaten çalıştığını varsaymış. **Bu, V2 beklemeden düzeltilebilecek/düzeltilmesi gereken bağımsız bir P0.**
3. **Puanlama (SQL, tek fonksiyon içinde, ~140 satır):** `location_score`(20/8) + `age_score`(-5..20, iki kişi arası fark üzerinden — kullanıcının SEÇTİĞİ bir aralık değil, ham yaş farkı) + `intent_score`(sadece `onboarding_answers.intent` eşitliği, 0/10/20/40) + "yaşam tarzı kovası" (morning_night/recharge/hobby/availability/drinking/smoking/education/language/environment/zodiac/favorite_spot, TOPLAM 65'e sabitlenmiş) → `completeness_multiplier`(0.85-1.0) ile çarpılıp `sort_boost`(verified +15, beni-önceden-beğenmiş +40) ile toplanıp sıralanıyor. Gösterilen `%` = `adjusted_score/140`, 20-99 arası clamp, yaş cezası negatifse tavan 85.
4. **`reasons[]`:** aynı fonksiyon içinde CASE listesinden en fazla 3, öncelik: intent eşitliği > ortak hobi > konum > favori mekan > içki > sigara > buluşma ortamı > burç.

### A.2 `onboarding_answers` — şemada VAR ama neredeyse HİÇ kullanılmıyor
Gerçek kolonlar (canlı DB'den): `intent, sub_intent, friendship_type, shared_interests_importance, social_preference, casualness_expectation, exclusivity_view, marriage_view, children_view, living_preference, life_priority, commitment_view, friendship_value, hangout_frequency, connection_style, relationship_pace, excitement_factor, connection_energy, relationship_vision`.

`get_top_matches` bunlardan **sadece `intent`'i** okuyor. Diğer 18 kolon **puanlamaya hiç girmiyor.**

Ama bunların çoğu **gerçekten toplanıyor**: `app/profile-setup/step2/{index,q1,q2,q3}.tsx` + `lib/onboardingStep2Context.tsx` — kullanıcı intent seçiyor (`just_friends`/`keeping_it_casual`/`open_to_relationship`/`not_sure_yet`), sonra **intent'e göre değişen 3 takip sorusu** soruluyor ve `onboarding_answers`'a yazılıyor (`friendship_value/hangout_frequency/social_preference` sadece just_friends'te; `casualness_expectation/exclusivity_view/connection_style` sadece keeping_it_casual'da; vb.). **Bu, handoff'un Bölüm 8 ve 12'sinin istediği "intent'e göre değişen compatibility sorularının" birebir aynısı — zaten var, zaten toplanıyor, sadece hiç skorlanmıyor.**

Şu an `onboarding_answers`'ta sadece **3 satır** var (505 profilden) — yani gerçek kullanıcıların neredeyse hiçbiri bu akıştan geçmemiş (seed script'i muhtemelen bu tabloyu hiç doldurmuyor, sadece `intent` bir şekilde `profiles`/eski akıştan geliyor olabilir — ayrıca doğrulanmalı). `sub_intent`, `marriage_view`, `children_view`, `living_preference`, `shared_interests_importance`, `friendship_type` kolonları ise **hiçbir UI ekranı tarafından yazılmıyor** (grep: sadece bir dosyada geçiyorlar, aşağıya bakın) — DB'de var ama tamamen boş/ölü.

### A.3 🟡 ÖNEMLİ KEŞİF: `lib/setup2Matching.ts` — kullanılmayan ama DOĞRU tasarlanmış bir scoring modülü
Bu dosya (`Last updated: Mayıs 2026`, yani **CLAUDE.md'nin logladığı hemen hemen her oturumdan ÖNCE** yazılmış) tam olarak handoff'un istediği şeyi yapıyor: intent'e göre farklı alt-soru setlerini karşılaştırıyor (`setup2AnswersScore`), her intent-çifti için **adil bir max-possible-score** hesaplıyor (`setup2MaxPossible` — just_friends×just_friends=81, not_sure_yet×not_sure_yet=64, vb. — yüzdeyi intent'e göre normalize ediyor), "Both/All/Mix/Everything" gibi esnek cevaplara kısmi puan veriyor (`setup2PairScore`).

**Grep ile doğrulandı: bu dosyayı hiçbir yer import etmiyor.** Muhtemelen `get_top_matches` SQL'e taşınırken (Eylül'deki büyük yeniden yazımlarda) bu TS modülü unutulmuş/atlanmış — SQL fonksiyonu tek başına kolayca bir TS dosyasını çağıramayacağı için, port edilmesi gerekirken hiç edilmemiş. **V2 bunu sıfırdan icat etmek zorunda değil — mantığı zaten doğru, sadece (a) gerçek uygulamaya bağlanmamış (b) SQL'e taşınması ya da yürütme katmanının SQL'den çıkarılması gerekiyor.**

### A.4 "Match" kelimesi bugün ÜÇ farklı anlamda kullanılıyor — handoff Bölüm 4'ün tam işaret ettiği sorun
`matches` tablosundaki BİR satır, aynı `status` alanı üzerinden şunların HEPSİ olabiliyor:
1. **Öneri/aday** — `get_top_matches` bir kişiyi döndürünce `upsert_match` RPC'si hemen `status='pending', invited_by=null` bir satır yazıyor (Matches'in "Ready" listesini doldurmak için). Bu, handoff'un "recommendation/pick" dediği şey — ama DB'de zaten bir "match".
2. **Devam eden davet süreci** — `invited_by` set edilmiş, `chat_opened` henüz false. Bu "date-planning process" (handoff Bölüm 22).
3. **Gerçek karşılıklı eşleşme** — `chat_opened=true` (accept ile ya da `handle_mutual_like` trigger'ıyla, `source='mutual_like'`).
4. **Geçmiş/expired/passed** — cooldown penceresi için tutulan kayıtlar.

`likes` tablosu ayrı duruyor (liker/likee/target/note/status: sent→matched/passed/expired) — bu iyi, handoff'un istediği "likes ayrı olsun" prensibiyle zaten uyumlu. Ama **"recommendation" hiç ayrı bir kavram değil, `matches` satırının bir alt-durumu.**

### A.5 Discover'da "Pass" — hiçbir yere yazılmıyor
`app/(tabs)/index.tsx`'te `handlePass`: `void userId; completePass();` — **tamamen local, DB'ye hiçbir insert/update yok.** Bu, hem section 18-19'un (cooldown) hem section 14'ün (Personal Fit — pasgeçilen profillerden öğrenme) önkoşulunu bugün kırıyor: aynı kişi bir sonraki `get_top_matches` çağrısında (aynı gün, ikinci bir Discover açılışında) **tekrar çıkabilir**, çünkü `matches` tablosunda hiç iz bırakmadı. `handleLike` ise gerçek: `likes` tablosuna `target_type='profile'` upsert (`recordLike`).

### A.6 "Discover ~10 profil/gün" bugün YOK — bunun yerine "günde 5/10 beğeni hakkı" var
Discover feed'i (`get_top_matches p_limit:10`) her fokus'ta yeniden çekiliyor, **kaç farklı profil gösterildiği hiç sayılmıyor/sınırlanmıyor** (aynı gün 3 kere Home'a girilse, örtüşen ama aynı olmayan setler dönebilir — RPC deterministic ama zaman geçtikçe sort_boost/liked_me değişebilir). Sınırlanan tek şey **beğeni sayısı**: `daily_views_count`/`increment_daily_views` RPC'si, free=5/premium=10, `likes` insert'i başına 1 artıyor (`Home`'daki her ❤ + Note). `try_send_invite` ayrıca **davet** için ayrı bir limit (free=1/premium=3/gün). Yani bugün üç ayrı sayaç var: beğeni (5/10), davet (1/3), ve **"kaç profil gösterildi" hiç yok.**

### A.7 UI'da compatibility yüzdesi — çok geniş yüzey alanı
`match_percentage`/`MatchScoreBadge` şurada render ediliyor: `app/(tabs)/index.tsx` (Discover hero kartı), `app/(tabs)/matches.tsx` (Ready kartları), `app/candidate-profile.tsx`, `app/plan-detail.tsx`, `app/vibe-detail.tsx`, `components/home/{VerifiedBadge,ProfileHeroCard,MatchScoreBadge}.tsx`, `components/matches/MatchScoreBadge.tsx`, `components/matches/ReadyMatchCard.tsx`, `components/profile/HingeProfileCard.tsx`, `lib/hingeProfile.ts`, `lib/vibeCategories.ts`. **Section 2'nin "yüzde gösterme" kararı, tahmin edilenden çok daha büyük bir UI değişikliği** — en az 10 dosya, 2 ayrı `MatchScoreBadge` komponenti (Home'un Warm Editorial paleti + Matches'in kendi paleti).

### A.8 Event/analytics altyapısı — var ama Discover/Pick'e özel event yok
`lib/analytics.ts`'in `logEvent` fire-and-forget'i + `events` tablosu (RLS: sadece kendi `user_id`'ne insert) zaten kurulu. Gerçekte loglanan event'ler: `signup_completed, onboarding_completed, like_sent, invite_sent, invite_accepted, mutual_match (server-side trigger), first_message_sent, premium_screen_viewed, premium_cta_tapped`. **Hiç yok:** `discover_profile_seen/opened/passed`, `pick_generated/viewed/opened/note_sent/passed`, `ready_to_meet`, `date_plan_started/created`. Section 32'nin istediği event seti büyük ölçüde eksik ama altyapı (tablo+RLS+fire-and-forget helper) zaten hazır — yeni bir sistem kurmaya gerek yok, sadece çağrı eklemek yeterli.

### A.9 Zaten var olan, handoff'un "hard filter" listesine denk düşen mekanizmalar
- Gender/orientation karşılıklı eşleşme: ✅ var (`meeting_preferences` iki yönlü).
- Blocks: ✅ var (`pair_is_blocked`, RLS'e gömülü — CLAUDE.md 2026-09-16 güvenlik turu).
- Reports → otomatik gizleme: ✅ var (`auto_hide_after_reports` trigger, 3 farklı rapor sonrası `is_hidden`).
- Konum/mesafe: ✅ var ama kaba (`same_district` | `whole_city`, gerçek lat/lng mesafe hesaplaması yok — `lat/lng` kolonları var ama `get_top_matches` hiç kullanmıyor).
- Yaş aralığı: 🔴 UI var, DB var, RPC'de YOK (A.2'deki bug).
- Explicit dealbreaker: `profiles.dealbreaker` — free-text, sadece PROFİLDE GÖSTERİLİYOR, filtrelemede hiç kullanılmıyor.

---

## B. REUSABLE — olduğu gibi kalabilir

- **`likes` şeması** (liker/likee/target_type/target_key/note/status/match_id) — handoff'un "likes ayrı olsun" isteğiyle zaten uyumlu, dokunmaya gerek yok.
- **`handle_mutual_like` trigger** — mutual-like'ı gerçek bir match'e yükseltme mekaniği (idempotent, `likes.status` senkronu, chat seed'i, notification+event) sağlam, mantık değişmeden kalabilir.
- **`onboarding_answers`'ın intent + 12 alt-soru şeması** (A.2) — V2'nin "compatibility questionnaire"si için sıfırdan yazılacak yeni sorular değil, **zaten toplanan veri.** Sadece skorlamaya bağlanması gerekiyor.
- **`lib/setup2Matching.ts`'in mantığı** (A.3) — port edilerek/uyarlanarak reuse edilebilir, sıfırdan tasarım gerekmez.
- **Blocks/reports/RLS güvenlik katmanı** — dokunulmasına gerek yok.
- **`try_send_invite`/`upsert_match`'in "row-locked, auth.uid() doğrulamalı RPC" deseni** — yeni RPC'ler (örn. `generate_daily_pick`) aynı güvenlik desenini taklit etmeli, sıfırdan öğrenmeye gerek yok.
- **Events tablosu + `logEvent()` helper'ı** — yeni event isimleri eklemek yeterli, altyapı değişmez.
- **`discovery_verified_only`/`discovery_nonsmokers_only`/`discovery_height_min/max`/`discovery_zodiac_signs`/`discovery_pets`/`discovery_education`/`discovery_religion`/`discovery_active_today`** — bunların hepsi zaten "preference, hard-filter değil" mantığıyla eklenmiş (kullanıcı isterse kilitli Advanced Filters'tan açıyor) — handoff'un Bölüm 9-10'undaki PREFERENCE kategorisiyle kavramsal olarak zaten örtüşüyor, sadece resmi kategoriye alınması gerekiyor.

## C. CHANGE

- **`get_top_matches`** — yüzde yerine internal ranking score döndürmeli (ya da yüzde hâlâ dönebilir ama **client hiç render etmeyecek** — bkz. D). `discovery_age_min/max` filtresi eklenmeli (bug fix, V2'den bağımsız yapılabilir). Puanlama, "Eligibility → Preferences → Compatibility → Personal Fit → Reliability → Liquidity" katmanlarına ayrıştırılmalı — bugünkü tek dev SQL blok yerine.
- **Intent skorlaması** — bugünkü "eşit mi değil mi" (0/10/20/40) yerine `lib/setup2Matching.ts`'teki intent-koşullu alt-soru karşılaştırmasına geçmeli.
- **"Pass" (Discover)** — artık bir yere yazılmalı (yeni bir event/tablo, `matches` satırı YARATMADAN — bkz. D, "matches" kavram kirliliğini büyütmemek için).
- **`match_percentage` UI'ı** — ~10 dosyada, yüzde yerine `reasons[]`/"Why this pick" metnine geçmeli (A.7).
- **Discovery limiti** — "günde N beğeni" yerine/yanında "günde N farklı profil" kavramı eklenmeli (Discover'ı Pick'ten ayırmak için, section 3).
- **Age matching** — ham yaş-farkı puanlamasından (`age_score` -5..20) çıkıp, kullanıcının **kendi seçtiği** `discovery_age_min/max` aralığının İÇİNDE olmayı nötr kabul eden bir modele geçmeli (section 7 — "aralık içinde ayrıca ceza verme" zaten CLAUDE.md'de bir kez tartışılmış ama hiç uygulanmamış, RPC hâlâ ceza veriyor).

## D. REMOVE / DEPRECATE

- **`matches` tablosunun "recommendation" olarak kullanılması** (`upsert_match`'in pending/invited_by=null satırları) — V2'de bunun yerine ayrı bir `recommendations`/`daily_picks` kavramı olmalı (bkz. E). Mevcut `matches` satırları geriye dönük olarak GERÇEK match'lere (invited_by set VEYA chat_opened=true VEYA source='mutual_like') daraltılmalı.
- **Kullanıcıya gösterilen `%X uyum` / `match_percentage` / `MatchScoreBadge`** — handoff'un en net talimatı ("Do NOT expose an artificial compatibility percentage"). Sayının kendisi backend'de kalabilir (internal ranking), ama HİÇBİR ekranda `%` olarak render edilmemeli.
- **`onboarding_answers.sub_intent, marriage_view, children_view, living_preference, shared_interests_importance, friendship_type`** — hiçbir UI yazmıyor, hiçbir RPC okumuyor. Ya gerçekten kullanılacaksa (children_view özellikle section 12'nin "Children" maddesiyle örtüşüyor — muhtemelen KULLANILMALI, silinmemeli) UI'ya bağlanmalı, ya da gerçekten terk edildiyse migration'da not düşülüp bırakılmalı (silme gerekmez, `religion` kararındaki gibi "kolonu dondur" yaklaşımı yeterli).
- **`lib/setup2Matching.ts`'in "unused" durumu** — dosyanın kendisi silinmemeli (B'de reusable), ama "hiç çağrılmıyor" durumu sonlandırılmalı: ya port edilir ya da bilinçli olarak "bu mantık artık SQL'de X şeklinde yaşıyor" notuyla kapatılır.

## E. ADD

- **`recommendations` (veya `daily_picks`) tablosu** — `user_id, candidate_id, rank, score_internal, reasons[], tier (A/B/C/D), generated_at, expires_at, viewed_at, dismissed_at, resulted_in_like boolean`. `matches` tablosundan tamamen ayrı — bir recommendation ASLA otomatik `matches` satırı yaratmaz; sadece kullanıcı like/note atarsa (mevcut `likes` akışı) ya da mutual olursa gerçek `matches` doğar.
- **`discover_pass` / benzeri hafif bir tablo veya `events` üzerinden cooldown** — section 18-19'un istediği "30-45 gün cooldown" için bugün hiç veri yok (A.5). En basit çözüm: `events`'e `discover_pass` yazmak + `get_top_matches`'in WHERE'ine `NOT EXISTS (recent discover_pass event)` eklemek — yeni bir tablo şart değil, `events` zaten var.
- **Preference-strength alanları** (section 10 — "Don't care / Prefer / Dealbreaker") — bugünkü `discovery_*` kolonlarının çoğu ikili (filtre açık/kapalı). 3-seviyeli bir model için ya yeni kolonlar (`preference_strength_smoking` gibi) ya da tek bir `preferences_jsonb` kolonu gerekir — şema kararı, aşağıda "Açık Kararlar"da.
- **`profile_seen`/`profile_opened`/`pick_viewed`/`pick_note_sent`/`ready_to_meet`/`date_plan_created` event'leri** (section 32) — `logEvent()` helper'ı zaten var, sadece çağrı noktaları eklenmeli.
- **`generate_daily_pick(user_id)` RPC'si** — section 31'in istediği "önceden hesapla, kaydet, ekran sadece okur" modeli. Bugünkü `get_top_matches` her ekran açılışında YENİDEN hesaplıyor (A.6) — Pick için bu YANLIŞ olur (aynı gün 3 kere açılınca 3 farklı Pick görünmemeli).
- **Application/waitlist akışı** (section 23-25) — `profiles.waitlist_number`/`waitlist_boost` kolonları zaten var (CLAUDE.md: "kozmetik, gerçekten geciktirmiyor") ama gerçek bir "review/accept" akışı, admin ekranı veya durum makinesi yok. Section 23'ün "Application → Review → Accepted → Membership" akışı sıfırdan kurulmalı.

---

## FIELD-BY-FIELD TABLO

Sadece matching/preference/compatibility'yle doğrudan ilgili alanlar listelendi (foto/bio/dil gibi salt-görüntüleme alanları atlandı).

| Alan | Bugünkü kullanım | Kategori (hedef) | Karar | Hard filter? | Ranking signal? | Kullanıcı tercihi mi? | Dealbreaker olabilir mi? | Not |
|---|---|---|---|---|---|---|---|---|
| `gender` + `meeting_preferences` | Karşılıklı hard filter | Eligibility | KEEP | Evet | Hayır | Evet (zaten var) | Yapısal olarak zaten öyle | — |
| `discovery_age_min/max` | UI+DB var, RPC'de YOK | Eligibility/Preference | **FIX (bug) + CHANGE** | Evet (olmalı) | Hayır | Evet | Hayır (aralık zaten kullanıcı tercihi) | A.2'deki P0 |
| `date_of_birth` → yaş farkı | `age_score` -5..20 | Compatibility (bugün) → Eligibility (hedef) | CHANGE | — | Azalt/kaldır | — | — | section 7: aralık içinde ceza verme |
| `city`/`district`/`discovery_max_distance` | Hard filter (şehir) + ranking (ilçe +20/+8) | Eligibility | KEEP (genişlet: gerçek mesafe) | Evet | Kısmen | Evet | Hayır | `lat/lng` var ama kullanılmıyor |
| `blocks`/`reports` | Hard filter | Eligibility | KEEP | Evet | Hayır | — | — | Sağlam |
| `onboarding_answers.intent` | +40/+20/+10/0 | Eligibility+Compatibility | CHANGE | Kısmen (strict long-term × casual → ineligible olabilir) | Evet | Evet | Section 8'e göre olabilir | Formül intent'e göre dallanmalı |
| `onboarding_answers.{friendship_value,hangout_frequency,social_preference,casualness_expectation,exclusivity_view,connection_style,relationship_pace,life_priority,relationship_vision,excitement_factor,commitment_view,connection_energy}` | **Toplanıyor, hiç skorlanmıyor** | Compatibility | **ADD (wire up)** | Hayır | Evet | Hayır (compatibility, tercih değil) | Hayır | `lib/setup2Matching.ts` zaten mantığı yazmış |
| `onboarding_answers.{sub_intent,marriage_view,children_view,living_preference,shared_interests_importance,friendship_type}` | Şemada var, hiç yazılmıyor/okunmuyor | Compatibility (children_view özellikle) | ADD (UI + scoring) veya dondur | children_view dealbreaker olabilir | — | — | children_view evet | UI hiç yok |
| `morning_night`,`recharge_style` | Eşitlik +15/+15 | Compatibility | KEEP (matrix'e geçir) | Hayır | Evet | Hayır | Hayır | Naif eşitlik — section 13 uyarısı burada geçerli |
| `hobbies` | Kesişim ×5, max 25 | Compatibility/Learned | KEEP | Hayır | Evet | Kısmen | Hayır | — |
| `availability_days/hours` | Kesişim eşiği 15/8/3 | Compatibility | KEEP | Hayır | Evet | Hayır | Hayır | — |
| `drinking`/`smoking` | Eşitlik+zıtlık matrisi (-6..10) | Preference/Dealbreaker adayı | CHANGE | Hayır (bugün) → kullanıcı "dealbreaker" derse evet | Evet | Evet (`discovery_nonsmokers_only` zaten var) | **Evet** — section 10'un birebir örneği | 3-seviyeli modele taşınmalı |
| `education`,`education_detail` | Eşitlik +8, + `discovery_education` filtre | Preference | KEEP | Opsiyonel (zaten var) | Evet | Evet | Hayır | — |
| `religion` | KVKK gerekçesiyle donduruldu (2026-09-13), skora hiç girmiyor | — | KEEP FROZEN | Hayır | Hayır | Hayır | — | Dokunma, hukuki karar zaten verilmiş |
| `languages` | Kesişim ≥1 → +5 | Compatibility | KEEP | Hayır | Evet | Hayır | Hayır | — |
| `meeting_environment` | Kesişim eşiği 12/6 | Compatibility | KEEP | Hayır | Evet | Hayır | Hayır | — |
| `zodiac_sign` + `discovery_zodiac_signs` | +5/+2 bonus + opsiyonel filtre | Preference (eğlence) | KEEP | Opsiyonel (zaten var) | Evet (küçük) | Evet | Hayır | Kullanıcı isteğiyle eklenmiş, bilimsel değil ama zararsız |
| `height_cm` + `discovery_height_min/max` | Sadece filtre, skora hiç girmiyor | Profile/Preference | KEEP | Opsiyonel | Hayır | Evet | Section 11'in "az sayıda yüksek-sinyal tercih" örneği | Zaten doğru tasarlanmış |
| `pets` + `discovery_pets` | Sadece filtre | Profile/Preference | KEEP | Opsiyonel | Hayır | Evet | Hayır | — |
| `photo_verified` | +15 skor + sort_boost | Reliability/Trust | CHANGE (kategori) | Hayır | Evet | Hayır | Hayır | Section 15'in "reliability" alanına taşınmalı, "compatibility" değil |
| `last_active_at` + `discovery_active_today` | Filtre + heartbeat | Reliability | KEEP | Opsiyonel | Evet (potansiyel) | Evet | Hayır | Section 15'in "recent activity" sinyali zaten var |
| `dealbreaker` (free-text) | Sadece profilde gösteriliyor | Dealbreaker | **CHANGE** | Hayır (bugün) | Hayır | — | Evet ama serbest metin, yapılandırılmamış | Section 10'un istediği yapılandırılmış modele taşınmalı |
| `favorite_spots` | jsonb, kategori eşleşmesi +5 | Compatibility | KEEP | Hayır | Evet | Hayır | Hayır | — |
| `likes` (liker→likee, target/note/status) | Discover'daki gerçek sinyal | Learned | KEEP | Hayır | Evet (zaten `liked_me`→+40 sort_boost) | — | — | Section 5'in istediği "incoming interest boost" **zaten var**, sadece "recommendation"a taşınmalı |
| Discover "pass" | **Hiçbir yere yazılmıyor** | Learned | **ADD** | Hayır (ama cooldown için gerekli) | Evet (gelecekte) | — | — | A.5 — en kritik eksik |
| `matches` (pending/invited_by=null) | "Recommendation" yerine kullanılıyor | — | **SPLIT OUT** | — | — | — | — | A.4/D — kavramsal karışıklığın kaynağı |

---

## AÇIK KARARLAR — koda geçmeden önce kullanıcıdan netleştirilmeli

1. **Recommendation/Pick verisini nerede tutacağız?** Yeni tablo (`recommendations`) mu, yoksa `matches`'e `kind`/`is_recommendation` gibi bir ayrım kolonu mu eklenecek? Öneri: **yeni tablo** — handoff'un Bölüm 4'ü kavramsal ayrımı çok net istiyor, aynı tabloda bir bayrakla çözmek 6 ay sonra tekrar karışır.
2. **Puanlama SQL'de mi kalacak, yoksa bir Edge Function/TS katmanına mı taşınacak?** SQL avantajı: mevcut `get_top_matches` gibi hızlı (8 Eylül'deki optimizasyon ~9ms'e indirmişti), tek transaction. Dezavantajı: `lib/setup2Matching.ts` gibi TS'te yazılmış mantığı SQL'e tekrar tekrar port etmek zorunda kalıyoruz (bu tam olarak bugünkü sorunun sebebi). Bu, Ay 1'in en önemli mimari kararı — kod yazmadan önce netleşmeli.
3. **"Preference strength" (Don't care/Prefer/Dealbreaker) için şema:** ayrı kolonlar mı (`smoking_dealbreaker boolean`), yoksa tek bir `preference_strengths jsonb` mü? jsonb daha esnek (yeni bir tercih eklemek migration istemez) ama sorgulanabilirlik/indexleme daha zor.
4. **Age filtresi bug'ı hemen mi düzeltilsin, V2'nin parçası olarak mı?** Bağımsız, düşük riskli, tek satırlık bir WHERE eklemesi — V2'yi beklemeden bugün düzeltilebilir. Öneri: hemen düzelt (ayrı, küçük bir görev).
5. **`onboarding_answers`'ın 6 hiç-kullanılmayan kolonu** (`sub_intent` vb.) — gerçekten UI'ya bağlanacak mı (özellikle `children_view` section 12'nin "Children" maddesiyle örtüşüyor), yoksa terk mi edilecek?
6. **Mevcut `matches` verisi geriye dönük nasıl temizlenecek?** 81 satırlık `matches` tablosunun kaçı gerçek "recommendation" (invited_by=null, status=pending), kaçı gerçek davet/match? Yeni `recommendations` tablosuna geçerken bu satırları migrate mi edeceğiz yoksa sıfırdan mı başlayacağız (küçük kullanıcı sayısında muhtemelen sıfırdan başlamak daha temiz)?

---

## IMPLEMENTATION PLAN — Ay 1 (Matching Engine V2 tasarımı) somut adımlara bölünmüş

Handoff'un kendi 5-aylık takvimine göre, sadece **Ay 1** aşağıda somutlaştırıldı (Ay 2+ handoff'ta zaten yüksek seviyede tanımlı, Ay 1 bitmeden detaylandırmak erken).

### Hafta 1 — Karar + şema tasarımı (kod yok)
- Yukarıdaki "Açık Kararlar"ın kullanıcıyla netleştirilmesi.
- `recommendations` tablosunun tam şeması (kolonlar, indexler, RLS).
- Eligibility/Preference/Compatibility/Dealbreaker/Learned kategorilerinin FİNAL alan listesi (bu audit'in tablosu taslak, kullanıcı onayı gerekiyor).

### Hafta 2 — Eligibility + age-bug fix + event altyapısı
- `discovery_age_min/max` fix'i `get_top_matches`'e eklenir (bağımsız, düşük riskli).
- `discover_pass` event'i eklenir (Discover'daki pass artık `logEvent('discover_pass', {candidate_id})` yazar) + `get_top_matches`'in WHERE'ine cooldown kontrolü.
- `discover_profile_seen/opened`, `pick_viewed/opened/note_sent/passed`, `ready_to_meet`, `date_plan_created` event'leri kod noktalarına eklenir (henüz analiz edilmeyecek, sadece toplanmaya başlanır — section 32'nin kendi notu: "immediately implement every event" değil, ama erken toplamaya başlamak Ay 4'teki tuning için veri biriktirir).

### Hafta 3 — Compatibility katmanının yeniden yazımı
- `lib/setup2Matching.ts`'in mantığı (intent-koşullu alt-soru karşılaştırması) `get_top_matches`'e (ya da kararlaştırılan yeni katmana) port edilir.
- Intent skorlaması "eşit/değil" yerine intent-koşullu hale getirilir.
- "Yaşam tarzı kovası" mantığı korunur ama Compatibility/Preference ayrımına göre yeniden gruplanır (örn. drinking/smoking preference-strength modeline taşınırsa kovadan çıkar).

### Hafta 4 — Recommendation/Pick ayrımı + serving mimarisi
- `recommendations` tablosu + `generate_daily_pick(user_id)` RPC'si (try_send_invite'ın row-locked/auth.uid() deseninde).
- `upsert_match`'in "pending, invited_by=null" kullanımı kaldırılır — Ready/Discover artık `recommendations`'tan besleniyor, `matches` sadece gerçek eşleşme+davet süreçlerinde satır alıyor.
- Client tarafı: Home/Matches'in `match_percentage` render'ları kaldırılır, `reasons[]`/"Why this pick" metnine geçilir (bu, en büyük UI-yüzeyli değişiklik, ~10 dosya).

Ay 1 sonu çıktı: **çalışan bir "Bugünün Pick'i" ekranı**, yüzdesiz, gerçek intent-compatibility'yi kullanan, Discover'dan (davranışsal sinyal + `likes.liked_me` boost) beslenen, kaydedilmiş/tek-seferlik hesaplanan bir öneri. Ay 2'nin "Discover limit + Notes + mutual Match + Chat + behavior events" işi buna oturur.

---

## Dürüst sınırlamalar
- Bu audit **statik kod/şema okumasına** dayanıyor — cihazda hiçbir şey test edilmedi.
- `onboarding_answers`'ta sadece 3 satır olduğu için, bu 18 kolonun gerçek kullanıcı davranışında ne kadar dolu/tutarlı olacağı bilinmiyor (505 profilin çoğu muhtemelen seed script'ten, `onboarding_answers` hiç yok).
- Ranking algoritmasının "doğru" olup olmadığı (section 39'un felsefesi) kod okuyarak değerlendirilemez — bu, Ay 4'teki gerçek kullanıcı testiyle ölçülecek bir şey.
