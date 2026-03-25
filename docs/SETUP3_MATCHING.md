# Setup-3 — Logic ve Matching (Guncel)

Bu dokuman Setup-3 icin skor bazli eslesme mantigini anlatir. Sert filtre yoktur.

## Genel

- Tum alanlar skor uretir.
- Farkli secimler eslesmeyi engellemez.
- Negatif skor yalnizca religion tablosunda vardir.

## DB alanlari

- `morning_night` (text)
- `recharge_style` (text)
- `hobbies` (text[])
- `vibe` (text)
- `drinking` (text)
- `smoking` (text)
- `pets` (text)
- `education` (text)
- `education_detail` (text, optional)
- `occupation` (text, profile zenginligi; skorda yok)
- `religion` (text)

## Skor fonksiyonlari (`lib/setup3Matching.ts`)

- `morningNightScore`: ayni secim `+10`
- `rechargeStyleScore`: ayni secim `+10`
- `hobbiesScore`: ortak hobi sayisi 1→`+15`, 2→`+20`, 3→`+25`, 4→`+30`, 5+→`+35`
- `vibeScore`: ayni secim `+15`
- `drinkingScore`: ayni secim `+10`
- `smokingScore`: ayni secim `+10`
- `petsScore`: ayni secim `+5`
- `educationScore`:
  - ayni seviye `+15`
  - `education_detail` case-insensitive / aksan normalize eslesirse ekstra `+20`
  - toplam max `+35`
- `religionScore`: tabloya gore `+20` ile `-15` arasi
- `setup3ScoreTotal`: tumu toplar (max `+150`)

## UI notlari

- Education follow-up input secime gore animasyonla acilir.
- Hobbies: 3 preset + custom, max 5.
- `Next →` ve `Skip for now` ekranin altinda yer alir.
