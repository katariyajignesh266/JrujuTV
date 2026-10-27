-- Migration 010: Ensure get_child_watch_summary defaults to 0 instead of null when no watch rows exist

CREATE OR REPLACE FUNCTION public.get_child_watch_summary(p_child_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lifetime       BIGINT := 0;
  v_today          INT    := 0;
  v_channel_count  INT    := 0;
  v_top_channels   JSONB  := '[]'::JSONB;
BEGIN
  -- Lifetime total (PK lookup)
  SELECT COALESCE(lifetime_seconds, 0) INTO v_lifetime
    FROM public.child_watch_totals
   WHERE child_id = p_child_id;

  -- Today's total (composite PK lookup)
  SELECT COALESCE(seconds_watched, 0) INTO v_today
    FROM public.child_watch_daily
   WHERE child_id = p_child_id AND watch_date = CURRENT_DATE;

  -- Total distinct channels
  SELECT COUNT(*) INTO v_channel_count
    FROM public.child_channel_watch_totals
   WHERE child_id = p_child_id;

  -- Top 5 channels
  SELECT jsonb_agg(
    jsonb_build_object(
      'channel_id',        ccwt.channel_id,
      'channel_name',      c.title,
      'channel_thumbnail', c.thumbnail_url,
      'total_seconds',     ccwt.total_seconds
    ) ORDER BY ccwt.total_seconds DESC
  )
  INTO v_top_channels
  FROM (
    SELECT channel_id, total_seconds
      FROM public.child_channel_watch_totals
     WHERE child_id = p_child_id
     ORDER BY total_seconds DESC
     LIMIT 5
  ) ccwt
  JOIN public.channels c ON c.id = ccwt.channel_id;

  RETURN jsonb_build_object(
    'lifetime_seconds',   COALESCE(v_lifetime, 0),
    'today_seconds',      COALESCE(v_today, 0),
    'top_channels',       COALESCE(v_top_channels, '[]'::JSONB),
    'total_channel_count', COALESCE(v_channel_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_child_watch_summary TO authenticated, service_role;
