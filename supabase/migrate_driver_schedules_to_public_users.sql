-- Migration: Update driver_schedules to use public.users instead of auth.users
-- This ensures consistency with your app's user management system
--
-- IMPORTANT: Run this AFTER driver_schedules_system.sql if you already have that set up
-- If starting fresh, use the updated driver_schedules_system.sql instead

-- ========================================
-- 1. DROP EXISTING CONSTRAINTS AND VIEW
-- ========================================

-- Drop the view first (depends on the table structure)
DROP VIEW IF EXISTS public.v_driver_schedule_overview;

-- Drop the foreign key constraint on driver_id
ALTER TABLE public.driver_schedules 
DROP CONSTRAINT IF EXISTS driver_schedules_driver_id_fkey;

-- ========================================
-- 2. ADD NEW FOREIGN KEY TO public.users
-- ========================================

ALTER TABLE public.driver_schedules
ADD CONSTRAINT driver_schedules_driver_id_fkey 
FOREIGN KEY (driver_id) REFERENCES public.users(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.driver_schedules.driver_id IS 'Reference to public.users - the driver assigned to this slot';

-- ========================================
-- 3. UPDATE RLS POLICY
-- ========================================

-- Drop old policy if it exists
DROP POLICY IF EXISTS "Allow drivers to read their own schedules" ON public.driver_schedules;

-- Recreate with same logic (auth.uid() still works since public.users.id syncs with auth)
CREATE POLICY "Allow drivers to read their own schedules"
  ON public.driver_schedules
  FOR SELECT
  TO authenticated
  USING (auth.uid() = driver_id);

-- ========================================
-- 4. UPDATE assign_driver_shift FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION public.assign_driver_shift(
  p_driver_id UUID,
  p_start_time TEXT,
  p_end_time TEXT,
  p_day TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_affected_slots BIGINT[];
  v_assignment_count INTEGER := 0;
  v_slot_record RECORD;
  v_start_hour INTEGER;
  v_start_minute INTEGER;
  v_start_ampm TEXT;
  v_end_hour INTEGER;
  v_end_minute INTEGER;
  v_end_ampm TEXT;
  v_start_24h INTEGER;
  v_end_24h INTEGER;
  v_slot_24h INTEGER;
BEGIN
  -- Validate driver exists in public.users (changed from auth.users)
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_driver_id) THEN
    RAISE EXCEPTION 'Driver with ID % does not exist', p_driver_id;
  END IF;

  -- Parse start time (format: "12:00 PM")
  v_start_hour := SPLIT_PART(p_start_time, ':', 1)::INTEGER;
  v_start_minute := SPLIT_PART(SPLIT_PART(p_start_time, ':', 2), ' ', 1)::INTEGER;
  v_start_ampm := SPLIT_PART(p_start_time, ' ', 2);

  -- Parse end time
  v_end_hour := SPLIT_PART(p_end_time, ':', 1)::INTEGER;
  v_end_minute := SPLIT_PART(SPLIT_PART(p_end_time, ':', 2), ' ', 1)::INTEGER;
  v_end_ampm := SPLIT_PART(p_end_time, ' ', 2);

  -- Convert to 24-hour format for comparison
  v_start_24h := v_start_hour + 
    CASE 
      WHEN v_start_ampm = 'PM' AND v_start_hour <> 12 THEN 12
      WHEN v_start_ampm = 'AM' AND v_start_hour = 12 THEN -12
      ELSE 0
    END;

  v_end_24h := v_end_hour + 
    CASE 
      WHEN v_end_ampm = 'PM' AND v_end_hour <> 12 THEN 12
      WHEN v_end_ampm = 'AM' AND v_end_hour = 12 THEN -12
      ELSE 0
    END;

  -- Find all delivery_times slots in the specified range
  FOR v_slot_record IN
    SELECT id, hours, minutes, ampm
    FROM public.delivery_times
    WHERE TRIM(day) = TRIM(p_day)
      AND hours IS NOT NULL
      AND ampm IS NOT NULL
  LOOP
    -- Convert slot time to 24-hour format
    v_slot_24h := v_slot_record.hours::INTEGER + 
      CASE 
        WHEN v_slot_record.ampm = 'PM' AND v_slot_record.hours::INTEGER <> 12 THEN 12
        WHEN v_slot_record.ampm = 'AM' AND v_slot_record.hours::INTEGER = 12 THEN -12
        ELSE 0
      END;

    -- Check if slot falls within shift time range
    IF (v_start_24h <= v_end_24h AND v_slot_24h >= v_start_24h AND v_slot_24h < v_end_24h) OR
       (v_start_24h > v_end_24h AND (v_slot_24h >= v_start_24h OR v_slot_24h < v_end_24h)) THEN
      
      -- Insert driver schedule (ON CONFLICT DO NOTHING prevents duplicates)
      INSERT INTO public.driver_schedules (driver_id, delivery_time_id, notes)
      VALUES (p_driver_id, v_slot_record.id, p_notes)
      ON CONFLICT (driver_id, delivery_time_id) DO NOTHING;

      -- Track affected slots
      v_affected_slots := array_append(v_affected_slots, v_slot_record.id);
      v_assignment_count := v_assignment_count + 1;
    END IF;
  END LOOP;

  -- Return summary
  RETURN json_build_object(
    'success', true,
    'driver_id', p_driver_id,
    'day', TRIM(p_day),
    'shift_start', p_start_time,
    'shift_end', p_end_time,
    'slots_assigned', v_assignment_count,
    'slot_ids', v_affected_slots,
    'message', format('Assigned driver to %s slots on %s', v_assignment_count, TRIM(p_day))
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'driver_id', p_driver_id,
      'day', p_day
    );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 5. RECREATE VIEW WITH public.users
-- ========================================

CREATE OR REPLACE VIEW public.v_driver_schedule_overview AS
SELECT 
  ds.id as schedule_id,
  ds.driver_id,
  u.email as driver_email,
  CONCAT(u.first_name, ' ', u.last_name) as driver_name,
  u.phone as driver_phone,
  dt.id as slot_id,
  TRIM(dt.day) as day,
  CONCAT(dt.hours, ':', LPAD(COALESCE(dt.minutes::text, '00'), 2, '0'), ' ', dt.ampm) as time_slot,
  dt.max_capacity_lu,
  dt.current_load_lu,
  (dt.max_capacity_lu - dt.current_load_lu) as available_capacity,
  ds.notes,
  ds.created_at as assigned_at
FROM public.driver_schedules ds
JOIN public.users u ON ds.driver_id = u.id
JOIN public.delivery_times dt ON ds.delivery_time_id = dt.id
ORDER BY dt.day, dt.hours, dt.minutes;

COMMENT ON VIEW public.v_driver_schedule_overview IS 'Human-readable view of all driver assignments with capacity info (uses public.users)';

-- ========================================
-- 6. UPDATE get_driver_workload FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION public.get_driver_workload(p_driver_id UUID)
RETURNS JSON AS $$
DECLARE
  v_total_slots INTEGER;
  v_days_worked TEXT[];
  v_earliest_slot TEXT;
  v_latest_slot TEXT;
  v_driver_email TEXT;
  v_driver_name TEXT;
BEGIN
  -- Get driver info from public.users
  SELECT email, CONCAT(first_name, ' ', last_name)
  INTO v_driver_email, v_driver_name
  FROM public.users
  WHERE id = p_driver_id;

  -- Count total slots
  SELECT COUNT(*) INTO v_total_slots
  FROM driver_schedules
  WHERE driver_id = p_driver_id;

  -- Get unique days
  SELECT ARRAY_AGG(DISTINCT TRIM(dt.day))
  INTO v_days_worked
  FROM driver_schedules ds
  JOIN delivery_times dt ON ds.delivery_time_id = dt.id
  WHERE ds.driver_id = p_driver_id;

  -- Get earliest and latest time slots
  SELECT 
    CONCAT(MIN(hours), ':', LPAD(COALESCE(MIN(minutes)::text, '00'), 2, '0'), ' ', MIN(ampm)),
    CONCAT(MAX(hours), ':', LPAD(COALESCE(MAX(minutes)::text, '00'), 2, '0'), ' ', MAX(ampm))
  INTO v_earliest_slot, v_latest_slot
  FROM delivery_times dt
  JOIN driver_schedules ds ON ds.delivery_time_id = dt.id
  WHERE ds.driver_id = p_driver_id;

  RETURN json_build_object(
    'driver_id', p_driver_id,
    'driver_email', v_driver_email,
    'driver_name', v_driver_name,
    'total_slots', v_total_slots,
    'days_worked', v_days_worked,
    'earliest_slot', v_earliest_slot,
    'latest_slot', v_latest_slot,
    'estimated_hours', ROUND((v_total_slots * 20.0) / 60.0, 2)
  );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- VERIFICATION
-- ========================================

-- Verify the constraint is updated
-- SELECT 
--   tc.constraint_name, 
--   kcu.column_name, 
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name 
-- FROM information_schema.table_constraints AS tc 
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.table_name = 'driver_schedules' 
--   AND tc.constraint_type = 'FOREIGN KEY';

-- ========================================
-- NOTES
-- ========================================
-- After running this migration:
-- 1. All driver_schedules now reference public.users(id)
-- 2. Your React Native app should query public.users WHERE role = 'deliverer'
-- 3. The view and functions are updated to use public.users
-- 4. Existing data is preserved (only constraints changed)
