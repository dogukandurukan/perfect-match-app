-- Daily profile view limit (free tier: 3 views per rolling 24h window)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_views_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_views_reset_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.profiles.daily_views_count IS 'Rolling 24h profile views (pass/like/tap); free tier limit 3';
COMMENT ON COLUMN public.profiles.daily_views_reset_at IS 'Start of current 24h view window';

CREATE OR REPLACE FUNCTION public.refresh_daily_views_if_needed(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    daily_views_count = 0,
    daily_views_reset_at = now()
  WHERE id = p_user_id
    AND daily_views_reset_at < now() - interval '24 hours';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_daily_views(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_reset timestamptz;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  PERFORM public.refresh_daily_views_if_needed(p_user_id);

  SELECT daily_views_count, daily_views_reset_at
  INTO v_count, v_reset
  FROM public.profiles
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'count', COALESCE(v_count, 0),
    'reset_at', v_reset,
    'limit_reached', COALESCE(v_count, 0) >= 3
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_daily_views(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_reset timestamptz;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  PERFORM public.refresh_daily_views_if_needed(p_user_id);

  UPDATE public.profiles
  SET daily_views_count = daily_views_count + 1
  WHERE id = p_user_id
  RETURNING daily_views_count, daily_views_reset_at
  INTO v_count, v_reset;

  RETURN jsonb_build_object(
    'count', COALESCE(v_count, 0),
    'reset_at', v_reset,
    'limit_reached', COALESCE(v_count, 0) >= 3
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_daily_views_if_needed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_views(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_daily_views(uuid) TO authenticated;
