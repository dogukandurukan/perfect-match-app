# Perfect Match — Master Plan

Bu belge **şu anki tamamlanma durumunu** ve **sonraki fazları** özetler. Eşleşme matematiği için bkz. `docs/ALGORITHM.md`.

---

## PHASE 0 — Tamamlandı

- UI ekranları (setup 1–2–3–4)
- Auth (login / signup)
- DB tabloları (`profiles` + `onboarding_answers`)
- Dummy data (300 profil)
- Matching algoritması v2
- Test scriptleri: `seed`, `testMatching`, `topMatches`, `updateOnboarding`, `analyzeMatches`

---

## PHASE 1 — Sırada

- Setup-1 → `profiles` upsert
- Setup-2 → `onboarding_answers` upsert
- Setup-3 → `profiles` upsert (atlanırsa null)
- Setup-4 → `profiles` upsert + `setup_completed = true`
- Fotoğraf upload → Supabase Storage
- Auth sonrası yönlendirme

---

## PHASE 2 — Profil

- Profil görüntüleme
- Profil düzenleme

---

## PHASE 3 — Matching MVP

- “Find my match” butonu
- Sonuç ekranı (kategori + reasons + fotoğraf)
- Eşleşme listesi (%50+)

---

## PHASE 4 — Buluşma

- Zaman slotu önerisi
- İki taraf onayı
- Push notification

---

## PHASE 5 — Canlı

- App Store / Play Store

---

*Güncelleme: faz yapısı ve Phase 0 kapsamı yenilendi; algoritma ayrıntısı `docs/ALGORITHM.md`.*
