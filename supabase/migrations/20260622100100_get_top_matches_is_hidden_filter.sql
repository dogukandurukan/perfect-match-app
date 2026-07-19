-- Exclude hidden / soft-deleted profiles from get_top_matches candidates

DO $$
DECLARE
  func_src text;
  hidden_filter constant text := 'COALESCE(p.is_hidden, false) = false';
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO func_src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'get_top_matches'
  ORDER BY p.oid
  LIMIT 1;

  IF func_src IS NULL THEN
    RAISE NOTICE 'get_top_matches() not found; skip is_hidden filter';
    RETURN;
  END IF;

  IF func_src LIKE '%' || hidden_filter || '%' THEN
    RAISE NOTICE 'get_top_matches already filters is_hidden; skipping';
    RETURN;
  END IF;

  IF func_src LIKE '%p.setup_completed = true%' THEN
    func_src := replace(
      func_src,
      'p.setup_completed = true',
      'p.setup_completed = true AND COALESCE(p.is_hidden, false) = false AND p.deleted_at IS NULL'
    );
  ELSIF func_src LIKE '%setup_completed = true%' THEN
    func_src := replace(
      func_src,
      'setup_completed = true',
      'setup_completed = true AND COALESCE(p.is_hidden, false) = false AND p.deleted_at IS NULL'
    );
  ELSE
    RAISE EXCEPTION 'Could not locate setup_completed filter in get_top_matches()';
  END IF;

  EXECUTE func_src;
END $$;
