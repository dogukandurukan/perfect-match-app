# Birlikte çalışma: dal, commit, PR, güncelleme, çakışma

| | |
|---|---|
| Repo | https://github.com/dogukandurukan/perfect-match-app |
| Başlangıç (teslim) dalı | `tempa/collab-design-prep-r3` — ürün `0a03bd7` + bu hazırlık paketi |
| Senin dalın | `tempa/branding-r1` (teslim commit'inden açılır) |
| Ürün geliştirme dalı | `tempa/v2-persist-r2` — **dokunma**: push, merge, rebase yok |
| Karar veren | Doğukan |

## 1. Günlük açılış
```bash
git status                      # temiz mi, doğru dalda mısın (tempa/branding-r1)?
npm run collab:preview          # yalnız tasarım önizlemesi
# ya da: npm run collab:start  # kendi yerel backend'in + giriş
```
`git status` beklenmeyen değişiklik gösteriyorsa **önce dur** ve Claude Code'dan ne olduğunu açıklamasını iste; silme / geri alma yapma.

## 2. Küçük değişiklik paketi
1. Tek konu seç (ör. "spec welcome başlığına 2 varyant").
2. Değişikliği yap → iPhone'da önizlemede bak.
3. Kontroller:
   ```bash
   npx tsc --noEmit
   node scripts/onboarding-v2-checks/run.js
   ```
4. Yalnız ilgili dosyaları ekle ve commit'le:
   ```bash
   git add <dosyalar>
   git commit -m "design(welcome): two headline variants in the preview"
   ```
   `.env*`, `.test-backend/`, ekran görüntüsü ham dosyaları, giriş kodları commit'e girmez.

## 3. Kendi dalını push et, PR aç
```bash
git push -u origin tempa/branding-r1
```
PR: GitHub'da repo → "Compare & pull request" → **base: `tempa/collab-design-prep-r3`**, compare: `tempa/branding-r1`. Açıklama = [`HANDOFF_TEMPLATE.md`](HANDOFF_TEMPLATE.md). PR'ı Doğukan inceler ve birleştirir; sen birleştirmezsin.

Asla:
- `git push` ile `tempa/v2-persist-r2`, `main` veya başkasının dalına göndermek;
- `--force` push;
- PR'ı kendin merge etmek, ürün dalını kendi dalına otomatik merge etmek.

## 4. Ürün güncellemelerini kontrollü almak
Yalnız Doğukan "şu sürümü al" dediğinde (yeni bir teslim dalı veya commit SHA verir):
```bash
git fetch origin
git status                               # temiz olmalı; değilse önce commit'le
git merge --no-ff <Doğukan'ın verdiği dal veya SHA>
```
Otomatik `git pull`, zamanlanmış güncelleme, `rebase` yok.

## 5. Çakışma olursa
- `git merge` "CONFLICT" derse: **dur**. Çözmeye, `--abort`'a veya dosya silmeye kendi başına karar verme.
- `git status` ve `git diff --name-only --diff-filter=U` çıktısını Doğukan'a gönder.
- Doğukan söylerse: `git merge --abort` birleştirmeyi geri alır, senin commit'lerin yerinde kalır.
- Çalışmanı korumak için gerekiyorsa önce commit'le; `git stash`, `reset --hard`, `checkout -- .`, `clean` kullanma.

## 6. Kapsam hatırlatması
Ayrıntı: [`README.md`](README.md) §2–4. Kısaca: tasarım önizlemesi ve sunum dosyaları serbest; canlı metin, global tema, ortak onboarding bileşenleri Doğukan onayıyla; auth, veritabanı, kurallar, eşleşme, sohbet, ödeme, başvuru kabulü kapsam dışı. Sosyal medya / pazar araştırması / içerik taslakları repo dışında (ChatGPT, belgeler) hazırlanır; hesap açma, yayınlama, hesap paylaşma bu işin parçası değil.
