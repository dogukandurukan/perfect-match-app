# Setup-4 — Logic ve Matching

Setup-4 sorulari sert filtre degil, skor bazli calisir.

## DB alanlari
- `availability_days` (`text[]`)
- `availability_hours` (`text[]`)
- `meeting_environment` (`text[]`)
- `preferred_locations` (`text[]`) — max 3 neighborhoods (optional)
- `favorite_spots` (`jsonb`) - skora etki etmez
- `first_date_expectation` (`text`)
- `bio` (`text`)

## Skor fonksiyonlari (`lib/setup4Matching.ts`)

- `availabilityDaysScore`
  - 5+ ortak gun: `+40`
  - 3-4 ortak gun: `+25`
  - 1-2 ortak gun: `+10`
  - 0 ortak gun: `-20`
- `availabilityHoursScore`
  - 3 ortak saat: `+30`
  - 2 ortak saat: `+20`
  - 1 ortak saat: `+10`
  - 0 ortak saat: `-15`
- `meetingEnvironmentScore`
  - 4-5 ortak tercih: `+30`
  - 3 ortak tercih: `+20`
  - 2 ortak tercih: `+15`
  - 1 ortak tercih: `+10`
  - 0 ortak tercih: `-10`
- `preferredLocationsScore`
  - 1 ortak semt: `+15`
  - 2+ ortak semt: `+20`
  - 0 ortak semt: `+0` (eşleşmeyi engellemez)
- `firstDateExpectationScore`
  - ayni secim: `+15`
  - bir taraf `All of the above`: `+8`
  - diger durum: `0`
- `bioBonusScore`
  - bio doluysa `+5`

Toplam: `setup4ScoreTotal` (maksimum `+120`).

## UI notlari

- Siralama: gunler / saat / mekan / preferred neighborhoods / ilk bulusma beklentisi → bio.
- `Always` secimi tum gunleri secili gosterecek sekilde normalize edilir.
- Meeting environment seciminde ilgili optional input animasyonla acilir.
- Bio altinda karakter sayaci: `x/300`.
