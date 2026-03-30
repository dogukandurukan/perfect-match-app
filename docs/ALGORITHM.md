# Eşleşme algoritması (v2)

Kaynak kod: `lib/matchScoring.ts` (ana akış), `lib/profileMatching.ts`, `lib/setup1Matching.ts`, `lib/setup2Matching.ts`, `lib/setup3Matching.ts`, `lib/setup4Matching.ts`, `lib/intentMatching.ts`.

---

## 1. Genel akış

1. **Sert filtreler** (başarısızsa `ok: false`, yüzde yok):
   - Aynı şehir (`sameCityHardFilter`)
   - Yaş farkı **≥ 10 yıl** → elenir (`age_gap_too_large`)
   - Cinsiyet ↔ karşı tarafın `meeting_preferences` karşılıklı uyum (`gender_mismatch`)
   - En az bir ortak dil (`no_common_language`)
   - Intent çifti `intentsCanMatch` ile uyumlu olmalı (`intent_mismatch`)

2. **Ham puan**: Setup-1 + Setup-2 + Setup-3 + Setup-4 toplamı (`rawScore`). Negatifse `incompatible_lifestyle`.

3. **Normalize (0–100)**: Her bölüm için ham puan, kendi tavanına göre yüzdeye çevrilir (aşağıdaki formül).

4. **Ağırlıklı ortalama** → `matchPercentage` (0–100, yuvarlanır).

5. **Mükemmel uyum tavanı**: Yüzde ≥ 95 ise ek **4 koşul** sağlanmazsa sonuç **94**’e tavanlanır.

6. **Kategori**: `matchPercentage` eşiklerine göre metin etiket.

7. **Reasons**: `buildMatchReasons` ile dinamik açıklama dizisi (UI/log için).

---

## 2. Setup-1 puanları

| Bileşen | Koşul | Puan |
|--------|--------|------|
| İlçe | Aynı ilçe (trim + lower) | +30 |
| İlçe | Farklı veya eksik | 0 |
| Yaş farkı (yıl) | 0–1 | +8 |
| | 2–3 | +5 |
| | 4–5 | 0 |
| | 6–7 | −5 |
| | 8–9 | −10 |
| | ≥10 | Sert filtre (eşleşme yok); skorda burada 0 |

**Tavan (normalize paydası):** `SETUP1_MAX_POSSIBLE = 38` (`lib/setup1Matching.ts`).

---

## 3. Setup-2 puanları

### Intent çifti (sabit)

| Durum | Puan |
|--------|------|
| `not_sure_yet` × `not_sure_yet` | 28 |
| Aynı intent (diğer) | 45 |
| Biri `not_sure_yet` | 20 |
| Uyuşmaz | 0 |

### Alt sorular (`setup2PairScore`)

Her soru için: **aynı** (trim + lower) → **+12**; metinde both/all/mix/everything esnekliği → **+6**; aksi → **0**. Boş taraflar → **0** (ceza yok).

### Intent’e göre sorulan alanlar (`onboarding_answers` / `setup2_answers`)

| Intent çifti | Alanlar |
|----------------|---------|
| `just_friends` × `just_friends` | `friendship_value`, `hangout_frequency`, `social_preference` |
| `keeping_it_casual` × `keeping_it_casual` | `casualness_expectation`, `exclusivity_view`, `connection_style` |
| `open_to_relationship` × `open_to_relationship` | `marriage_view`, `children_view`, `relationship_pace`, `life_priority` |
| `not_sure_yet` × `not_sure_yet` | `excitement_factor`, `commitment_view`, `connection_energy` |

### Setup-2 üst sınır (`setup2MaxPossible`)

| Çift tipi | Max |
|-----------|-----|
| `not_sure_yet` × `not_sure_yet` | 64 |
| `not_sure_yet` × diğer (veya tersi) | 56 |
| `just_friends` × `just_friends` | 81 |
| `keeping_it_casual` × `keeping_it_casual` | 81 |
| `open_to_relationship` × `open_to_relationship` | 93 |
| Diğer (uyumsuz intent zaten filtrede) | 0 |

---

## 4. Setup-3 puanları (6 bileşen; vibe kaldırılmış)

| Bileşen | Kural | Tipik max notu |
|---------|--------|----------------|
| `morning_night` | Aynı string | +10 |
| `recharge_style` | En az 1 ortak seçenek | +10 |
| `hobbies` | Ortak sayısı × 15, max | +45 |
| `drinking_smoking` | Birleşik skor (profilde `drinking`/`smoking` varsa türetilmiş değer) | +20 / +6 / −10 |
| `education` + `education_detail` | Aynı eğitim +10; detay normalize eşleşirse +10 | +20 |
| `religion` | Eşleşme matrisi (+5 … −5) | değişken |

**Normalize paydası:** sabit **95** (`matchScoring.ts` içi `s3`).

`drinking` / `smoking` ayrı kolonlardan tek `drinking_smoking` değeri üretimi: `calculateMatchScore` içindeki `deriveDrinkingSmoking` (ör. Socially → `When socializing`, Yes/No kombinasyonları).

---

## 5. Setup-4 puanları

| Bileşen | Kural (özet) |
|---------|----------------|
| `availability_days` | Ortak gün sayısına göre +50 … −20 |
| `availability_hours` | Ortak saat +30 … −5 |
| `meeting_environment` | Ortak ortam +30 … −10 |
| `preferred_locations` | 1 ortak +15, 2+ +20 |
| `first_date_expectation` | Aynı +15; biri “All of the above” +8 |
| `bio` | Çift bio bonusu (en fazla +5) |

**Normalize paydası:** sabit **115**.

**Setup-4 atlanmış sayılır:** İki kullanıcıda da gün/saat/ortam/konum listeleri ve anlamlı `first_date_expectation` / `bio` yoksa (`hasSetup4Data`).

---

## 6. Normalize formülü

Her bölüm için \( \text{max}(0, \text{ham}) \) kullanılır, sonra 100 ile sınırlanır:

- \( s_1 = \min\left(100,\ \dfrac{\max(0,\ \text{setup1Score})}{38} \times 100\right) \)
- \( s_2 = \text{setup2Max} > 0 \ ? \ \min\left(100,\ \dfrac{\max(0,\ \text{setup2Score})}{\text{setup2Max}} \times 100\right) : 0 \)
- \( s_3 = \min\left(100,\ \dfrac{\max(0,\ \text{setup3Score})}{95} \times 100\right) \)
- \( s_4 = \min\left(100,\ \dfrac{\max(0,\ \text{setup4Score})}{115} \times 100\right) \)

---

## 7. Ağırlıklı ortalama

**Setup-4 dolu** (en az bir tarafta veri var):

\[
\text{matchPercentage} = \mathrm{round}\bigl( s_1 \times 0.10 + s_2 \times 0.35 + s_3 \times 0.30 + s_4 \times 0.25 \bigr)
\]

**Setup-4 ikisi için de atlanmış:**

\[
\text{matchPercentage} = \mathrm{round}\bigl( s_1 \times 0.15 + s_2 \times 0.45 + s_3 \times 0.40 \bigr)
\]

Sonuç `min(100, …)` ile tavanlanır.

---

## 8. Mükemmel uyum (≥ %95) — 4 koşul

Yüzde ≥ 95 hesaplandıktan sonra, **hepsi** sağlanmazsa yüzde **94**’e çekilir:

| # | Koşul |
|---|--------|
| 1 | Setup-2 alt soru normalizasyonu: `subNorm ≥ 50` (intent puanı çıkarılmış setup2 / kalan tavan) |
| 2 | `s3 ≥ 45` |
| 3 | `setup1Score ≥ 0` |
| 4 | Setup-4 atlanmış **veya** `s4 ≥ 30` |

---

## 9. Kategori eşikleri

(`matchCategoryFromPercentage`)

| Yüzde | Kategori |
|-------|-----------|
| ≥ 95 | Mükemmel uyum |
| ≥ 65 | Harika eşleşme |
| ≥ 50 | İyi eşleşme |
| ≥ 35 | Olası eşleşme |
| ≥ 20 | Keşfet |
| &lt; 20 | Zayıf eşleşme |

---

## 10. Reasons mantığı

`buildMatchReasons` sırayla ekler:

| Koşul | Metin |
|--------|--------|
| `setup1District > 0` | Aynı semtte yaşıyorsunuz |
| `intentPts === 45` | Aynı hedefte buluşuyorsunuz |
| `intentPts === 28 \|\| 20` | Benzer hedefleriniz var |
| `setup3Score > 40` | Benzer yaşam tarzı |
| `hobbiesPts > 10` ve `hobbyOverlap > 0` | `{n} ortak ilgi alanı` |
| `setup4Score > 25` | Müsait zamanlarınız örtüşüyor |

---

## 11. TypeScript dönüş yapısı (`MatchResult`)

```ts
type MatchFailureReason =
  | 'different_city'
  | 'age_gap_too_large'
  | 'gender_mismatch'
  | 'no_common_language'
  | 'intent_mismatch'
  | 'incompatible_lifestyle';

type MatchResult =
  | {
      ok: false;
      reason: MatchFailureReason;
      rawScore: number | null;
      totalScore: null;
      matchPercentage: null;
    }
  | {
      ok: true;
      rawScore: number;
      clampedScore: number;
      matchPercentage: number;
      matchCategory: string;
      reasons: string[];
      breakdown: {
        setup1: { score: number; maxPossible: 38; penalty: number; normalized: number };
        setup2: { score: number; maxPossible: number; penalty: 0; normalized: number };
        setup3: {
          score: number;
          maxPossible: 95;
          penalty: number;
          universitySameBonus: boolean;
          normalized: number;
        };
        setup4: {
          score: number;
          maxPossible: 115;
          penalty: number;
          isSkipped: boolean;
          normalized: number;
        };
      };
    };
```

`MATCH_SCORE_MAX = 360` sembolik üst sınır olarak export edilir; yüzde ağırlıklı normalize ile üretilir.

---

## 12. Veritabanı alanları (özet)

### `profiles` (Setup-1, 3, 4 + intent yansıması)

| Alan grubu | Alanlar |
|------------|---------|
| Setup-1 | `city`, `district`, `date_of_birth`, `gender`, `meeting_preferences`, `languages` |
| Setup-3 | `morning_night`, `recharge_style`, `hobbies`, `drinking` / `smoking` veya `drinking_smoking`, `education`, `education_detail`, `religion` |
| Setup-4 | `availability_days`, `availability_hours`, `meeting_environment`, `preferred_locations`, `first_date_expectation`, `bio` |
| Diğer | `intent` (opsiyonel; onboarding ile birleştirilir) |

### `onboarding_answers` (Setup-2 + intent)

- `intent`
- Intent çiftine göre yukarıdaki Setup-2 alanları (`friendship_value`, …, `connection_energy`).
- İsteğe bağlı: `preferences.setup2_answers` ile `mergeSetup2Sources` birleşimi.

Detaylı kurallar için: `docs/SETUP1_MATCHING.md` … `SETUP4_MATCHING.md`, `docs/MATCHING_MASTER.md`.
