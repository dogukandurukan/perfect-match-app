# Dating App — Tam Logic ve Scoring Master

Bu belge uygulamadaki master matching akisini kod referanslariyla ozetler.

## 1) Hard filters (eslesme olmaz)

`lib/matchScoring.ts` icinde sirasiyla:

1. `setup1HardFiltersPass` (`lib/profileMatching.ts`)
   - ayni city
   - karsilikli gender + meeting_preferences
   - en az 1 ortak language
2. `intentsCanMatch` (`lib/intentMatching.ts`)

Hard filtrelerden biri gecmezse skor hesaplanmaz.

## 2) Skor hesaplama

`calculateMatchScore` toplam skoru su dosyalardan toplar:

- Setup-1: `setup1ScoreTotal` (`lib/profileMatching.ts`)
- Setup-2: `setup2AnswersScore` (`lib/setup2Matching.ts`)
- Setup-3: `setup3ScoreTotal` (`lib/setup3Matching.ts`)
- Setup-4: `setup4ScoreTotal` (`lib/setup4Matching.ts`)

`calculateMatchScore` breakdown da dondurur:

- `setup1`
- `setup2`
- `setup3`
- `setup4`

## 3) Setup bazli detaylar

- Setup-1: `docs/SETUP1_MATCHING.md`
- Setup-2: `docs/SETUP2_MATCHING.md`
- Setup-3: `docs/SETUP3_MATCHING.md`
- Setup-4: `docs/SETUP4_MATCHING.md`

**UI notu:** Setup-3 ekraninda `pets` / `drinking` / `smoking` sorulmaz; bu uc alan Setup-4’te toplanir. Skor fonksiyonlari (`setup3Matching` / `setup4Matching`) ayni DB alanlarini kullanmaya devam eder.
