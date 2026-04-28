# Setup-1 — Logic ve Matching

Setup-2+ mantığı ayrı dokümanda; bu dosya yalnızca **Setup-1 alanları** ve **eşleşme kuralları** için referanstır.

## Alanlar ve DB karşılıkları

| Alan | DB alanı | Tip | Zorunlu |
|------|-----------|-----|---------|
| Fotoğraflar | `photos` | `text[]` | Min 1 (uygulama) |
| First name | `first_name` | text | Evet |
| Last name | `last_name` | text | Evet |
| Doğum tarihi | `date_of_birth` | date (ISO string) | Evet |
| Burç | `zodiac_sign` | text | Otomatik |
| Konum | `city`, `district`, `lat`, `lng`, `full_address` | mixed | Evet |
| Gender | `gender` | text | Evet |
| Meeting preference | `meeting_preferences` | `text[]` | Evet |
| Diller | `languages` | `text[]` | Hayır (UI); eşleşme için en az 1 ortak dil gerekir) |

## Sert filtreler (`lib/profileMatching.ts`)

1. **Konum:** `sameCityHardFilter` — `city` eşit değilse eşleşme yok.
2. **Gender + meeting preference:** `meetingPreferencesMutuallyCompatible` — karşılıklı uyum; `Everyone` tüm `gender` değerlerini kabul eder.
3. **Dil:** `languagesHardCompatible` — ortak dil yoksa eşleşme yok (her iki tarafta da anlamlı dil listesi ve kesişim gerekir).

## Skor bileşenleri

| Bileşen | Fonksiyon | Özet |
|---------|-----------|------|
| İlçe bonusu | `districtBonusScore` | Aynı ilçe +10 |
| Yaş farkı | `ageDifferenceScore` | Aynı yaş +10; 1–5 → 0; 6–10 → -10; 11–15 → -20; 15+ → -30 |
| Dil sayısı | `languageCountScore` | 1 ortak → 0; 2 → +5; 3+ → +10 |

Birleşik kontrol: `setup1HardFiltersPass`, toplam skor (sert filtreler sonrası): `setup1ScoreTotal`.

## UX (uygulama)

- Doğum tarihi → takvim; burç tooltip; `zodiac_sign` kaydı.
- Konum: metin + “Use my location”; profilde `district + city`.
- Diller: Turkish / English / German + özel; max 5; subtitle: *Optional — add up to 5 for better matches*.
- Fotoğraflar: 3 slot, max ~100×100; Storage (private): `user-photos` bucket, yol `{user_id}/photo_{n}.{ext}` → `photos` dizisinde bucket içi yol veya harici URL.
