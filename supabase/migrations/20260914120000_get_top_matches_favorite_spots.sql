-- get_top_matches: favorite_spots (go-to place) bonus (2026-09-14)
-- User request, checked against real data first: favorite_spots values
-- are short, clean neighbourhood names ("Kadikoy", "Moda", "Cihangir"),
-- not free-form sentences — so unlike music/movie/book this is tractable
-- with exact (diacritic-normalized) matching, not crude substring guessing.
-- Verified before building: only 29% of users' favorite coffee-spot equals
-- their own district, so this is NOT redundant with location_score — it
-- captures "where you'd actually go", not just "where you live".
-- Small bonus (+5, same scale as the language bonus), never negative —
-- compares same-category values only (coffee-to-coffee, etc.) via
-- jsonb_each_text + USING(key), same diacritic-normalization pattern
-- already used for district matching in the WHERE clause.

CREATE OR REPLACE FUNCTION public.get_top_matches(p_user_id uuid, p_limit integer DEFAULT 3)
 RETURNS TABLE(user_id uuid, first_name text, date_of_birth date, city text, district text, zodiac_sign text, photos text[], match_percentage integer, match_category text, reasons text[], favorite_music text, favorite_movie text, favorite_book text, hobbies text[], availability_days text[], drinking text, smoking text, education text, education_detail text, morning_night text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
WITH me AS (
  SELECT p.id, p.gender, p.meeting_preferences, p.city, p.district, p.date_of_birth,
    p.zodiac_sign, p.morning_night, p.recharge_style, p.hobbies, p.availability_days,
    p.drinking, p.smoking, p.vibe, p.education, p.meeting_environment, p.languages,
    p.favorite_spots,
    p.discovery_max_distance, p.discovery_verified_only, p.discovery_nonsmokers_only,
    p.discovery_height_min, p.discovery_height_max,
    p.discovery_zodiac_signs, p.discovery_pets,
    p.discovery_education, p.discovery_religion, p.discovery_active_today,
    oa.intent
  FROM profiles p
  LEFT JOIN onboarding_answers oa ON oa.user_id = p.id
  WHERE p.id = p_user_id
),
zodiac_element(sign, element) AS (
  VALUES
    ('Aries','Fire'), ('Leo','Fire'), ('Sagittarius','Fire'),
    ('Taurus','Earth'), ('Virgo','Earth'), ('Capricorn','Earth'),
    ('Gemini','Air'), ('Libra','Air'), ('Aquarius','Air'),
    ('Cancer','Water'), ('Scorpio','Water'), ('Pisces','Water')
),
zodiac_top3(sign, partner) AS (
  VALUES
    ('Aries','Leo'), ('Aries','Sagittarius'), ('Aries','Libra'),
    ('Taurus','Virgo'), ('Taurus','Capricorn'), ('Taurus','Scorpio'),
    ('Gemini','Libra'), ('Gemini','Aquarius'), ('Gemini','Sagittarius'),
    ('Cancer','Scorpio'), ('Cancer','Pisces'), ('Cancer','Capricorn'),
    ('Leo','Aries'), ('Leo','Sagittarius'), ('Leo','Aquarius'),
    ('Virgo','Taurus'), ('Virgo','Capricorn'), ('Virgo','Pisces'),
    ('Libra','Gemini'), ('Libra','Aquarius'), ('Libra','Aries'),
    ('Scorpio','Cancer'), ('Scorpio','Pisces'), ('Scorpio','Taurus'),
    ('Sagittarius','Aries'), ('Sagittarius','Leo'), ('Sagittarius','Gemini'),
    ('Capricorn','Taurus'), ('Capricorn','Virgo'), ('Capricorn','Cancer'),
    ('Aquarius','Gemini'), ('Aquarius','Libra'), ('Aquarius','Leo'),
    ('Pisces','Cancer'), ('Pisces','Scorpio'), ('Pisces','Virgo')
),
candidates AS (
  SELECT p.id, p.first_name, p.date_of_birth, p.city, p.district, p.zodiac_sign, p.photos,
    p.favorite_music, p.favorite_movie, p.favorite_book, p.hobbies, p.availability_days,
    p.drinking, p.smoking, p.education, p.education_detail, p.morning_night,
    p.photo_verified,
    (SELECT array_agg(h) FROM unnest(p.hobbies) h WHERE h = ANY(me.hobbies)) AS shared_hobbies,
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
      WHEN ABS(DATE_PART('year', AGE(p.date_of_birth)) - DATE_PART('year', AGE(me.date_of_birth))) <= 2 THEN 20
      WHEN ABS(DATE_PART('year', AGE(p.date_of_birth)) - DATE_PART('year', AGE(me.date_of_birth))) <= 4 THEN 10
      WHEN ABS(DATE_PART('year', AGE(p.date_of_birth)) - DATE_PART('year', AGE(me.date_of_birth))) <= 6 THEN 5
      ELSE 0
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
      WHEN (me.drinking='Yes' AND p.drinking='No') OR (me.drinking='No' AND p.drinking='Yes') THEN -6
      ELSE 0
    END AS drinking_score,
    CASE
      WHEN me.smoking IS NULL OR p.smoking IS NULL THEN 0
      WHEN me.smoking = p.smoking THEN 10
      WHEN (me.smoking='No' AND p.smoking='Socially') OR (me.smoking='Socially' AND p.smoking='No') THEN 5
      WHEN (me.smoking='Yes' AND p.smoking='Socially') OR (me.smoking='Socially' AND p.smoking='Yes') THEN -6
      WHEN (me.smoking='No' AND p.smoking='Yes') OR (me.smoking='Yes' AND p.smoking='No') THEN -6
      ELSE 0
    END AS smoking_score,
    CASE WHEN p.education IS NOT NULL AND p.education = me.education THEN 8 ELSE 0 END AS education_score,
    CASE WHEN p.photo_verified THEN 15 ELSE 0 END AS verified_score,
    CASE
      WHEN EXISTS (SELECT 1 FROM zodiac_top3 zt WHERE zt.sign = me.zodiac_sign AND zt.partner = p.zodiac_sign) THEN 10
      WHEN EXISTS (
        SELECT 1 FROM zodiac_element ze1, zodiac_element ze2
        WHERE ze1.sign = me.zodiac_sign AND ze2.sign = p.zodiac_sign
          AND (
            (ze1.element IN ('Fire','Air') AND ze2.element IN ('Fire','Air'))
            OR (ze1.element IN ('Earth','Water') AND ze2.element IN ('Earth','Water'))
          )
      ) THEN 5
      ELSE 0
    END AS zodiac_score,
    CASE WHEN EXISTS (
      SELECT 1
      FROM jsonb_each_text(coalesce(me.favorite_spots, '{}'::jsonb)) me_kv(key, val)
      JOIN jsonb_each_text(coalesce(p.favorite_spots, '{}'::jsonb)) p_kv(key, val) USING (key)
      WHERE trim(me_kv.val) <> ''
        AND translate(lower(trim(me_kv.val)), 'çğıöşü', 'cgiosu')
          = translate(lower(trim(p_kv.val)), 'çğıöşü', 'cgiosu')
    ) THEN 5 ELSE 0 END AS spot_score,
    EXISTS (
      SELECT 1 FROM likes l
      WHERE l.liker_id = p.id AND l.likee_id = p_user_id AND l.status = 'sent'
    ) AS liked_me,
    (
      (CASE WHEN me.morning_night IS NOT NULL AND p.morning_night IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN me.recharge_style IS NOT NULL AND p.recharge_style IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN array_length(me.hobbies,1) > 0 AND array_length(p.hobbies,1) > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN array_length(me.availability_days,1) > 0 AND array_length(p.availability_days,1) > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN me.drinking IS NOT NULL AND p.drinking IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN me.smoking IS NOT NULL AND p.smoking IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN me.education IS NOT NULL AND p.education IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN array_length(me.languages,1) > 0 AND array_length(p.languages,1) > 0 THEN 1 ELSE 0 END) +
      (CASE WHEN array_length(me.meeting_environment,1) > 0 AND array_length(p.meeting_environment,1) > 0 THEN 1 ELSE 0 END)
    ) AS applicable_fields
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
    AND (NOT COALESCE(me.discovery_verified_only, false) OR p.photo_verified = true)
    AND (NOT COALESCE(me.discovery_nonsmokers_only, false) OR p.smoking IS DISTINCT FROM 'Yes')
    AND (me.discovery_height_min IS NULL OR p.height_cm IS NULL OR p.height_cm >= me.discovery_height_min)
    AND (me.discovery_height_max IS NULL OR p.height_cm IS NULL OR p.height_cm <= me.discovery_height_max)
    AND (
      me.discovery_zodiac_signs IS NULL
      OR array_length(me.discovery_zodiac_signs, 1) IS NULL
      OR p.zodiac_sign = ANY(me.discovery_zodiac_signs)
    )
    AND (
      me.discovery_pets IS NULL
      OR array_length(me.discovery_pets, 1) IS NULL
      OR p.pets IS NULL
      OR p.pets = ANY(me.discovery_pets)
    )
    AND (
      me.discovery_education IS NULL
      OR array_length(me.discovery_education, 1) IS NULL
      OR p.education IS NULL
      OR p.education = ANY(me.discovery_education)
    )
    AND (
      me.discovery_religion IS NULL
      OR array_length(me.discovery_religion, 1) IS NULL
      OR p.religion IS NULL
      OR p.religion = ANY(me.discovery_religion)
    )
    AND (
      NOT COALESCE(me.discovery_active_today, false)
      OR p.last_active_at >= now() - interval '24 hours'
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
      + c.zodiac_score
      + c.spot_score
    ) AS compat_raw_score,
    (0.85 + 0.15 * (c.applicable_fields::numeric / 9)) AS completeness_multiplier,
    (c.verified_score + CASE WHEN c.liked_me THEN 40 ELSE 0 END) AS sort_boost
  FROM candidates c
),
adjusted AS (
  SELECT s.*,
    (s.compat_raw_score * s.completeness_multiplier) AS adjusted_score
  FROM scored s
)
SELECT
  a.id AS user_id, a.first_name, a.date_of_birth, a.city, a.district, a.zodiac_sign, a.photos,
  LEAST(99, GREATEST(20, ROUND((a.adjusted_score / 125) * 100)))::integer AS match_percentage,
  CASE
    WHEN (a.adjusted_score / 125) * 100 >= 80 THEN '🔥 Exceptional match'
    WHEN (a.adjusted_score / 125) * 100 >= 60 THEN '✨ Great match'
    WHEN (a.adjusted_score / 125) * 100 >= 40 THEN '👍 Good match'
    ELSE '🤝 Possible match'
  END AS match_category,
  (
    SELECT COALESCE(array_agg(reason ORDER BY ord), ARRAY[]::text[])
    FROM (
      SELECT reason, ord
      FROM unnest(ARRAY[
        CASE WHEN a.intent_score = 40 THEN 'Looking for the same thing' END,
        CASE WHEN array_length(a.shared_hobbies,1) >= 1
          THEN 'You both love ' || array_to_string(a.shared_hobbies[1:2], ' & ') END,
        CASE WHEN a.spot_score = 5 THEN 'Same favorite spot' END,
        CASE WHEN a.drinking_score = 10 THEN 'Similar drinking habits' END,
        CASE WHEN a.smoking_score = 10 THEN 'Similar smoking habits' END,
        CASE WHEN a.env_overlap >= 1 THEN 'Same idea of a first date' END,
        CASE WHEN a.location_score = 20 THEN 'Nearby' END,
        CASE WHEN a.zodiac_score = 10 THEN 'Great zodiac match' END
      ]) WITH ORDINALITY AS t(reason, ord)
      WHERE reason IS NOT NULL
      ORDER BY ord
      LIMIT 3
    ) top3
  ) AS reasons,
  a.favorite_music, a.favorite_movie, a.favorite_book, a.hobbies, a.availability_days,
  a.drinking, a.smoking, a.education, a.education_detail, a.morning_night
FROM adjusted a
ORDER BY (a.adjusted_score + a.sort_boost) DESC
LIMIT p_limit;
$function$;

NOTIFY pgrst, 'reload schema';
