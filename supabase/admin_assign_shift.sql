-- Bulk-assign a driver to all delivery slots within a timestamp range.
-- Trigger on driver_schedules will auto-update delivery_times.max_capacity_lu.
-- Run in Supabase SQL Editor after rider_powered_capacity_reset.sql (and driver_schedules exist).

CREATE OR REPLACE FUNCTION public.admin_assign_shift(
  target_driver_id UUID,
  shift_start TIMESTAMPTZ,
  shift_end TIMESTAMPTZ,
  p_notes TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  slot_id BIGINT;
  assign_count INTEGER;
  driver_name TEXT;
BEGIN
  -- Validate driver exists in public.users
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = target_driver_id) THEN
    RAISE EXCEPTION 'Driver with ID % does not exist', target_driver_id;
  END IF;

  -- Get driver display name for confirmation message
  SELECT COALESCE(
    NULLIF(TRIM(first_name || ' ' || last_name), ''),
    email
  ) INTO driver_name
  FROM public.users
  WHERE id = target_driver_id;

  -- Insert assignment for each slot in the timestamp range (trigger updates capacity)
  FOR slot_id IN
    SELECT id
    FROM public.delivery_times
    WHERE slot_timestamp IS NOT NULL
      AND slot_timestamp >= shift_start
      AND slot_timestamp < shift_end
  LOOP
    INSERT INTO public.driver_schedules (driver_id, delivery_time_id, notes)
    VALUES (target_driver_id, slot_id, p_notes)
    ON CONFLICT (driver_id, delivery_time_id) DO NOTHING;
  END LOOP;

  -- Number of slots in range now assigned to this driver
  SELECT COUNT(*) INTO assign_count
  FROM public.driver_schedules
  WHERE driver_id = target_driver_id
    AND delivery_time_id IN (
      SELECT id FROM public.delivery_times
      WHERE slot_timestamp IS NOT NULL
        AND slot_timestamp >= shift_start
        AND slot_timestamp < shift_end
    );

  RETURN 'Assigned ' || COALESCE(driver_name, 'Driver') || ' to ' || assign_count || ' slot(s).';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.admin_assign_shift(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) IS 'Bulk-assigns a driver to all delivery slots whose slot_timestamp falls in [shift_start, shift_end). Capacity is updated via trigger on driver_schedules.';
