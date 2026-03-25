# Setup-2 — Logic ve Matching

Bu doküman Setup-2 için uygulanan dinamik akışı ve skor mantığını özetler.

## Intent

- Soru: **What kind of connection are you looking for?**
- Seçenekler: `just_friends`, `keeping_it_casual`, `open_to_relationship`, `not_sure_yet`
- `not_sure_yet` chip'inde ✨ işareti ve tooltip vardır.

## Not sure yet UX

- Chip tıklanınca tooltip açılır: `Keeping it open means you'll appear in more matches`
- 3 saniye sonra kapanır veya ekranın başka yerine dokununca kapanır.

## Hard filter

- `lib/intentMatching.ts` / `intentsCanMatch`:
  - explicit intent yalnızca kendisi + `not_sure_yet`
  - `not_sure_yet` herkesle

## Intent score

- `lib/intentMatching.ts` / `intentPairScore`:
  - explicit + same: `+20`
  - explicit + `not_sure_yet`: `+10`
  - `not_sure_yet` + `not_sure_yet`: `+15`

## Soru akışı (dinamik)

- `just_friends` → friendship_type, shared_interests_importance, social_preference
- `keeping_it_casual` → casualness_expectation, exclusivity_view
- `open_to_relationship` → marriage_view, children_view, living_preference, life_priority
- `not_sure_yet`:
  - sub_intent = Friendship → just_friends seti
  - sub_intent = Something romantic → open_to_relationship seti
  - sub_intent = Both → commitment_view, friendship_type, social_preference

## DB

- Setup-2 cevapları: `public.onboarding_answers` tablosuna `user_id` üzerinden upsert
- Intent + completion flags ayrıca `preferences` tablosunda tutulur.
