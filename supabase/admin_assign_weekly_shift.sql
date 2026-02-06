-- Weekly shift: assign a driver to the same time range on multiple days of the week.
-- Uses existing assign_driver_shift() per day. Run after migrate_driver_schedules_to_public_users.sql.

CREATE OR REPLACE FUNCTION public.admin_assign_weekly_shift(
  target_driver_id UUID,
  p_days TEXT[],  -- e.g. ARRAY['Monday', 'Wednesday', 'Friday']
  p_start_time TEXT,
  p_end_time TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_day TEXT;
  v_result JSON;
  v_total_slots INTEGER := 0;
  v_driver_name TEXT;
  v_days_count INTEGER;
BEGIN
  IF array_length(p_days, 1) IS NULL OR array_length(p_days, 1) = 0 THEN
    RAISE EXCEPTION 'At least one day must be selected';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = target_driver_id) THEN
    RAISE EXCEPTION 'Driver with ID % does not exist', target_driver_id;
  END IF;

  SELECT COALESCE(
    NULLIF(TRIM(first_name || ' ' || last_name), ''),
    email
  ) INTO v_driver_name
  FROM public.users
  WHERE id = target_driver_id;

  v_days_count := array_length(p_days, 1);

  FOREACH v_day IN ARRAY p_days
  LOOP
    v_result := public.assign_driver_shift(
      target_driver_id,
      p_start_time,
      p_end_time,
      TRIM(v_day),
      p_notes
    );
    IF (v_result->>'success')::boolean = true THEN
      v_total_slots := v_total_slots + COALESCE((v_result->>'slots_assigned')::integer, 0);
    END IF;
  END LOOP;

  RETURN 'Assigned ' || COALESCE(v_driver_name, 'Driver') || ' to ' || v_total_slots
    || ' slot(s) across ' || v_days_count || ' day(s).';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.admin_assign_weekly_shift(UUID, TEXT[], TEXT, TEXT, TEXT) IS
  'Assigns a driver to the given time range on each selected day of the week (recurring weekly). Uses assign_driver_shift per day.';
