# Setup-3 — Logic ve Matching (Guncel)

Bu dokuman Setup-3 icin skor bazli eslesme mantigini anlatir. Sert filtre yoktur.

## Genel

- Tum alanlar skor uretir.
- Farkli secimler eslesmeyi engellemez.
- Negatif skor yalnizca religion tablosunda vardir.

## DB alanlari

Skor mantigi degismez; alan adlari ve tipleri guncellendi.

- `morning_night` (text)
- `recharge_style` (text[]) — multi-select
- `hobbies` (text[])
- `vibe` (text) — **Setup-3 ekraninda**
- `drinking_smoking` (text) — Setup-3’te tek seçim
- `education` (text)
- `education_detail` (text, optional)
- `occupation` (text, profile zenginligi; skorda yok)
- `religion` (text)

## Skor fonksiyonlari (`lib/setup3Matching.ts`)

- `morningNightScore`: ayni secim `+10`
- `rechargeStyleScore`: ortak secim sayisina gore `0→+0`, `1→+5`, `2→+8`, `3+→+10`
- `hobbiesScore`: ortak hobi sayisi 1→`+15`, 2→`+20`, 3→`+25`, 4→`+30`, 5+→`+35`
- `vibeScore`: ayni secim `+15`
- `drinkingSmokingScore` (Do you drink or smoke?): ayni secim `+10`; biri `When socializing` ise `+3`; farkli ise `+0`
- `educationScore`:
  - ayni seviye `+15`
  - `education_detail` case-insensitive / aksan normalize eslesirse ekstra `+20`
  - toplam max `+35`
- `religionScore`: tabloya gore `+20` ile `-15` arasi
- `setup3ScoreTotal`: tumu toplar (max `+150`)

## UI notlari

- Setup-3 ekrani: morning, recharge (multi), hobbies, **vibe**, **drinking_smoking** (tek soru), education (+ follow-up), religion.
- Education follow-up input secime gore animasyonla acilir.
- Hobbies: 3 preset + custom, max 5.
- `Next →` ve `Skip for now` ekranin altinda yer alir.
