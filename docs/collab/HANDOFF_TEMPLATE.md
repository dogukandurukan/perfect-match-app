# Teslim şablonu (her küçük değişiklik paketi için)

Kopyala, doldur, Doğukan'a gönder. Bir paket = tek ekran / tek konu.

```
## Paket: <kısa başlık, ör. "Welcome başlığı — 2 varyant">
Dal: tempa/branding-r1 · commit: <git rev-parse --short HEAD>

### Ne değişti
- <1–3 madde>

### Gerekçe
- <neden daha iyi: okunabilirlik, marka dili, akış…>

### Önce / sonra
- Önce: <ekran görüntüsü — DEV · Design preview, ekran + durum adı>
- Sonra: <ekran görüntüsü — aynı ekran + durum>

### Değişen dosyalar
- <git diff --stat çıktısı>

### Etki alanı
- [ ] Yalnız DEV önizleme (lib/dev/designPreview.ts, components/dev/design/*)
- [ ] Canlı ekran(lar): <hangileri>
- [ ] Global tema / ortak bileşen (theme.ts, components/onboarding-v2/*): <etkilenen ekranlar>

### Onay gerektiren kararlar
- <yok / soru ekleme-çıkarma, zorunluluk, saklanan değer, akış sırası, marka adı, global tema…>

### Kontroller
- npx tsc --noEmit: <temiz / hata>
- node scripts/onboarding-v2-checks/run.js: <N/N passed>
- iPhone'da bakıldı: <evet — hangi ekran/durum / hayır>

### Açık sorular
- <varsa>
```

Kurallar: ekran görüntülerinde gerçek kişi, gerçek e-posta, giriş kodu veya
anahtar olmasın (önizleme yalnız sentetik içerik gösterir). Push / merge yok;
Doğukan inceleyip karar verir.
