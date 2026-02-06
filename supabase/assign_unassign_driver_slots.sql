-- Assign a driver to specific slots by ID, or remove them.
-- Trigger on driver_schedules will update delivery_times.max_capacity_lu.
-- Run after driver_schedules exists (e.g. driver_schedules_system.sql or migrate_driver_schedules_to_public_users.sql).

-- Assign driver to selected slot IDs (ignores already-assigned)
CREATE OR REPLACE FUNCTION public.assign_driver_to_slots(
  p_driver_id UUID,
  p_delivery_time_ids BIGINT[],
  p_notes TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  slot_id BIGINT;
  insert_count INTEGER := 0;
  driver_name TEXT;
BEGIN
  IF array_length(p_delivery_time_ids, 1) IS NULL OR array_length(p_delivery_time_ids, 1) = 0 THEN
    RETURN 'No slots selected.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_driver_id) THEN
    RAISE EXCEPTION 'Driver with ID % does not exist', p_driver_id;
  END IF;

  SELECT COALESCE(
    NULLIF(TRIM(first_name || ' ' || last_name), ''),
    email
  ) INTO driver_name
  FROM public.users
  WHERE id = p_driver_id;

  FOREACH slot_id IN ARRAY p_delivery_time_ids
  LOOP
    INSERT INTO public.driver_schedules (driver_id, delivery_time_id, notes)
    VALUES (p_driver_id, slot_id, p_notes)
    ON CONFLICT (driver_id, delivery_time_id) DO NOTHING;
    IF FOUND THEN
      insert_count := insert_count + 1;
    END IF;
  END LOOP;

  RETURN 'Assigned ' || COALESCE(driver_name, 'Driver') || ' to ' || insert_count || ' slot(s).';
END;
$$ LANGUAGE plpgsql;

-- Unassign driver from selected slot IDs
CREATE OR REPLACE FUNCTION public.unassign_driver_from_slots(
  p_driver_id UUID,
  p_delivery_time_ids BIGINT[]
)
RETURNS TEXT AS $$
DECLARE
  delete_count INTEGER;
  driver_name TEXT;
BEGIN
  IF array_length(p_delivery_time_ids, 1) IS NULL OR array_length(p_delivery_time_ids, 1) = 0 THEN
    RETURN 'No slots selected.';
  END IF;

  SELECT COALESCE(
    NULLIF(TRIM(first_name || ' ' || last_name), ''),
    email
  ) INTO driver_name
  FROM public.users
  WHERE id = p_driver_id;

  DELETE FROM public.driver_schedules
  WHERE driver_id = p_driver_id
    AND delivery_time_id = ANY(p_delivery_time_ids);

  GET DIAGNOSTICS delete_count = ROW_COUNT;

  RETURN 'Removed ' || COALESCE(driver_name, 'Driver') || ' from ' || delete_count || ' slot(s).';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.assign_driver_to_slots(UUID, BIGINT[], TEXT) IS
  'Assigns a driver to the given delivery_time IDs. Uses ON CONFLICT DO NOTHING. Capacity updated via trigger.';
COMMENT ON FUNCTION public.unassign_driver_from_slots(UUID, BIGINT[]) IS
  'Removes a driver from the given delivery_time IDs. Capacity updated via trigger.';
