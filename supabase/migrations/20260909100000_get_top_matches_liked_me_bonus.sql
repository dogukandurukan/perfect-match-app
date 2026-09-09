-- Hamle 2 (2026-09-09, follow-up to the mutual-like feature migration
-- 20260909090000): one-sided likes still did nothing for the liker beyond
-- counting toward the daily quota and showing up in the likee's Buzz teaser
-- — the algorithmic Matches feed never took them into account, so liking
-- someone had zero effect on whether you'd ever actually see them again.
-- Candidates who have already liked ME (a 'sent' like pointed at
-- p_user_id, not yet reciprocated) now get a strong scoring bonus, so
-- they're far more likely to fill one of Matches' 3 slots next time it
-- backfills. Mutual likes never reach this RPC at all — the mutual-like
-- trigger already opens an accepted+chat_opened match for those pairs,
-- which the existing "already has an active match" exclusion in
-- `candidates` filters out here, same as any other active match.
--
-- Byte-identical otherwise to the 20260908090000 perf rewrite — only
-- addition is the `liked_me` column + its term in raw_score.

CREATE OR REPLACE FUNCTION public.get_top_matches(p_user_id uuid, p_limit integer DEFAULT 3)
 RETURNS TABLE(user_id uuid, first_name text, date_of_birth date, city text, district text, zodiac_sign text, photos text[], match_percentage integer, match_category text, reasons text[], favorite_music text, favorite_movie text, favorite_book text, hobbies text[], availability_days text[], drinking text, smoking text, education text, education_detail text, morning_night text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
WITH me AS (
  SELECT p.id, p.gender, p.meeting_preferences, p.city, p.district, p.date_of_birth,
    p.morning_night, p.recharge_style, p.hobbies, p.availability_days,
    p.drinking, p.smoking, p.vibe, p.education, p.meeting_environment, p.languages,
    p.discovery_max_distance,
    oa.intent
  FROM profiles p
  LEFT JOIN onboarding_answers oa ON oa.user_id = p.id
  WHERE p.id = p_user_id
),
candidates AS (
  SELECT p.id, p.first_name, p.date_of_birth, p.city, p.district, p.zodiac_sign, p.photos,
    p.favorite_music, p.favorite_movie, p.favorite_book, p.hobbies, p.availability_days,
    p.drinking, p.smoking, p.education, p.education_detail, p.morning_night,
    p.photo_verified,
    (SELECT COUNT(*) FROM unnest(p.hobbies) h WHERE h = ANY(me.hobbies)) AS hobby_overlap,
    (SELECT COUNT(*) FROM unnest(p.availability_days) d WHERE d = ANY(me.availability_days)) AS avail_overlap,
    (SELECT COUNT(*) FROM unnest(p.languages) l WHERE l = ANY(me.languages)) AS lang_overlap,
    (SELECT COUNT(*) FROM unnest(p.meeting_environment) e WHERE e = ANY(me.meeting_environment)) AS env_overlap,
    CASE
      WHEN p.district IS NOT NULL AND lower(trim(p.district)) = lower(trim(me.district)) THEN 20
      WHEN p.city IS NOT NULL AND lower(trim(p.city)) = lower(trim(me.city)) THEN 8
      ELSE 0
    END AS location_score,
    CASE
      WHEN ABS(DATE_PART('year', AGE(p.date_of_birth)) - DATE_PART('year', AGE(me.date_of_birth))) <= 1 THEN 20
      WHEN ABS(DATE_PART('year', AGE(p.date_of_birth)) - DATE_PART('year', AGE(me.date_of_birth))) <= 2 THEN 15
      WHEN ABS(DATE_PART('year', AGE(p.date_of_birth)) - DATE_PART('year', AGE(me.date_of_birth))) <= 4 THEN 5
      WHEN ABS(DATE_PART('year', AGE(p.date_of_birth)) - DATE_PART('year', AGE(me.date_of_birth))) <= 5 THEN 0
      WHEN ABS(DATE_PART('year', AGE(p.date_of_birth)) - DATE_PART('year', AGE(me.date_of_birth))) <= 6 THEN -10
      WHEN ABS(DATE_PART('year', AGE(p.date_of_birth)) - DATE_PART('year', AGE(me.date_of_birth))) <= 8 THEN -20
      ELSE -30
    END AS age_score,
    CASE
      WHEN oa.intent IS NOT NULL AND me.intent IS NOT NULL AND oa.intent = me.intent THEN 40
      WHEN (oa.intent = 'not_sure_yet' OR me.intent = 'not_sure_yet') THEN 20
      WHEN (
        (oa.intent = 'keeping_it_casual' AND me.intent = 'open_to_relationship') OR
        (oa.intent = 'open_to_relationship' AND me.intent = 'keeping_it_casual')
      ) THEN 10
      WHEN (oa.intent = 'just_friends' OR me.intent = 'just_friends') THEN 5
      ELSE 0
    END AS intent_score,
    CASE WHEN p.morning_night IS NOT NULL AND p.morning_night = me.morning_night THEN 15 ELSE 0 END AS morning_night_score,
    CASE WHEN p.recharge_style IS NOT NULL AND p.recharge_style = me.recharge_style THEN 15 ELSE 0 END AS recharge_score,
    CASE
      WHEN me.drinking IS NULL OR p.drinking IS NULL THEN 0
      WHEN me.drinking = p.drinking THEN 10
      WHEN (me.drinking='Yes' AND p.drinking='Socially') OR (me.drinking='Socially' AND p.drinking='Yes') THEN 5
      WHEN (me.drinking='No' AND p.drinking='Socially') OR (me.drinking='Socially' AND p.drinking='No') THEN 0
      WHEN (me.drinking='Yes' AND p.drinking='No') OR (me.drinking='No' AND p.drinking='Yes') THEN -1
      ELSE 0
    END AS drinking_score,
    CASE
      WHEN me.smoking IS NULL OR p.smoking IS NULL THEN 0
      WHEN me.smoking = p.smoking THEN 10
      WHEN (me.smoking='No' AND p.smoking='Socially') OR (me.smoking='Socially' AND p.smoking='No') THEN 5
      WHEN (me.smoking='Yes' AND p.smoking='Socially') OR (me.smoking='Socially' AND p.smoking='Yes') THEN -1
      WHEN (me.smoking='No' AND p.smoking='Yes') OR (me.smoking='Yes' AND p.smoking='No') THEN -1
      ELSE 0
    END AS smoking_score,
    CASE WHEN p.education IS NOT NULL AND p.education = me.education THEN 8 ELSE 0 END AS education_score,
    CASE WHEN p.photo_verified THEN 15 ELSE 0 END AS verified_score,
    -- Hamle 2: candidate already liked ME (unrequited so far — a mutual
    -- like would already be an active match and excluded below).
    EXISTS (
      SELECT 1 FROM likes l
      WHERE l.liker_id = p.id AND l.likee_id = p_user_id AND l.status = 'sent'
    ) AS liked_me
  FROM profiles p
  LEFT JOIN onboarding_answers oa ON oa.user_id = p.id
  CROSS JOIN me
  WHERE p.id != p_user_id
    AND p.setup_completed = true
    AND lower(trim(p.city)) = lower(trim(me.city))
    AND (
      me.discovery_max_distance IS NULL
      OR me.discovery_max_distance = 'whole_city'
      OR (
        p.district IS NOT NULL AND me.district IS NOT NULL
        AND translate(lower(trim(p.district)), 'çğıöşü', 'cgiosu')
          = translate(lower(trim(me.district)), 'çğıöşü', 'cgiosu')
      )
    )
    AND p.id NOT IN (
      SELECT CASE WHEN m.user_a_id = p_user_id THEN m.user_b_id ELSE m.user_a_id END
      FROM matches m
      WHERE (m.user_a_id = p_user_id OR m.user_b_id = p_user_id)
        AND (
          m.status IN ('pending', 'accepted')
          OR (m.status = 'expired' AND m.created_at > now() - interval '14 days')
          OR (m.status = 'passed' AND m.created_at > now() - interval '42 days')
        )
      UNION
      SELECT blocked_id FROM blocks WHERE blocker_id = p_user_id
      UNION
      SELECT blocker_id FROM blocks WHERE blocked_id = p_user_id
    )
    AND (
      'Everyone' = ANY(me.meeting_preferences)
      OR ('Women' = ANY(me.meeting_preferences) AND p.gender = 'Woman')
      OR ('Men' = ANY(me.meeting_preferences) AND p.gender = 'Man')
      OR ('Non-binary' = ANY(me.meeting_preferences) AND p.gender = 'Non-binary')
    )
    AND (
      'Everyone' = ANY(p.meeting_preferences)
      OR ('Men' = ANY(p.meeting_preferences) AND me.gender = 'Man')
      OR ('Women' = ANY(p.meeting_preferences) AND me.gender = 'Woman')
      OR ('Non-binary' = ANY(p.meeting_preferences) AND me.gender = 'Non-binary')
    )
),
scored AS MATERIALIZED (
  SELECT c.*,
    (
      c.location_score
      + c.age_score
      + c.intent_score
      + c.morning_night_score
      + c.recharge_score
      + LEAST(25, (c.hobby_overlap * 5)::int)
      + CASE
          WHEN c.avail_overlap >= 4 THEN 15
          WHEN c.avail_overlap >= 2 THEN 8
          WHEN c.avail_overlap >= 1 THEN 3
          ELSE 0
        END
      + c.drinking_score
      + c.smoking_score
      + c.education_score
      + CASE WHEN c.lang_overlap >= 1 THEN 5 ELSE 0 END
      + CASE
          WHEN c.env_overlap >= 2 THEN 12
          WHEN c.env_overlap >= 1 THEN 6
          ELSE 0
        END
      + c.verified_score
      + CASE WHEN c.liked_me THEN 40 ELSE 0 END
    ) AS raw_score
  FROM candidates c
)
SELECT
  s.id AS user_id, s.first_name, s.date_of_birth, s.city, s.district, s.zodiac_sign, s.photos,
  LEAST(99, GREATEST(20, ROUND((s.raw_score::numeric / 150) * 100)))::integer AS match_percentage,
  CASE
    WHEN (s.raw_score::numeric / 150) * 100 >= 80 THEN '🔥 Mükemmel uyum'
    WHEN (s.raw_score::numeric / 150) * 100 >= 60 THEN '✨ Harika eşleşme'
    WHEN (s.raw_score::numeric / 150) * 100 >= 40 THEN '👍 İyi eşleşme'
    ELSE '🤝 Olası eşleşme'
  END AS match_category,
  ARRAY['eslesme'] AS reasons,
  s.favorite_music, s.favorite_movie, s.favorite_book, s.hobbies, s.availability_days,
  s.drinking, s.smoking, s.education, s.education_detail, s.morning_night
FROM scored s
ORDER BY s.raw_score DESC
LIMIT p_limit;
$function$;
