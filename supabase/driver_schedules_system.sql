-- Driver Schedules System: Link delivery capacity to driver availability
-- This system automatically adjusts delivery_times.max_capacity_lu based on how many drivers are assigned to each slot
--
-- IMPORTANT: Run this in Supabase SQL Editor AFTER setup_load_unit_system.sql
--
-- Overview:
-- 1. driver_schedules table: Links drivers (auth.users) to delivery_times slots
-- 2. Trigger: Auto-updates max_capacity_lu = (driver_count * 20.0) whenever schedules change
-- 3. RPC function: assign_driver_shift() for bulk-inserting shifts

-- ========================================
-- 1. CREATE driver_schedules TABLE
-- ========================================
CREATE TABLE IF NOT EXISTS public.driver_schedules (
  id BIGSERIAL PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delivery_time_id BIGINT NOT NULL REFERENCES public.delivery_times(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  
  -- Prevent duplicate assignments (same driver can't be assigned to same slot twice)
  UNIQUE(driver_id, delivery_time_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_driver_schedules_driver_id ON public.driver_schedules(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_schedules_delivery_time_id ON public.driver_schedules(delivery_time_id);
CREATE INDEX IF NOT EXISTS idx_driver_schedules_created_at ON public.driver_schedules(created_at);

-- Enable Row Level Security
ALTER TABLE public.driver_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow authenticated users to read, only admins/drivers to modify
CREATE POLICY "Allow authenticated users to read driver schedules"
  ON public.driver_schedules
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow drivers to read their own schedules"
  ON public.driver_schedules
  FOR SELECT
  TO authenticated
  USING (auth.uid() = driver_id);

-- Note: INSERT/UPDATE/DELETE should be restricted to admin users only
-- You can add admin role checks here if you have a roles system

COMMENT ON TABLE public.driver_schedules IS 'Links drivers to delivery time slots. Capacity is automatically calculated based on driver count.';
COMMENT ON COLUMN public.driver_schedules.driver_id IS 'Reference to auth.users - the driver assigned to this slot';
COMMENT ON COLUMN public.driver_schedules.delivery_time_id IS 'Reference to delivery_times - the time slot being covered';
COMMENT ON COLUMN public.driver_schedules.notes IS 'Optional notes about the shift (e.g., "Training shift", "On-call backup")';

-- ========================================
-- 2. CREATE TRIGGER FUNCTION TO UPDATE CAPACITY
-- ========================================
-- This function recalculates max_capacity_lu for affected delivery_times slots
-- Formula: max_capacity_lu = (number_of_drivers * 20.0)
--
-- Logic:
-- - Each driver can carry 20.0 Load Units per shift
-- - 0 drivers = 0 capacity (slot unavailable)
-- - 1 driver = 20.0 LU capacity
-- - 2 drivers = 40.0 LU capacity
-- - etc.

CREATE OR REPLACE FUNCTION public.update_delivery_capacity()
RETURNS TRIGGER AS $$
DECLARE
  affected_slot_id BIGINT;
  driver_count INTEGER;
  new_capacity NUMERIC(10, 2);
BEGIN
  -- Determine which slot was affected
  IF (TG_OP = 'DELETE') THEN
    affected_slot_id := OLD.delivery_time_id;
  ELSE
    affected_slot_id := NEW.delivery_time_id;
  END IF;

  -- Count drivers assigned to this slot
  SELECT COUNT(*) INTO driver_count
  FROM public.driver_schedules
  WHERE delivery_time_id = affected_slot_id;

  -- Calculate new capacity: drivers * 20 LU per driver
  new_capacity := driver_count * 20.0;

  -- Update the delivery_times table
  UPDATE public.delivery_times
  SET max_capacity_lu = new_capacity
  WHERE id = affected_slot_id;

  -- Log the change (optional, for debugging)
  RAISE NOTICE 'Updated slot % capacity: % drivers → % LU', affected_slot_id, driver_count, new_capacity;

  -- Return appropriate record
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.update_delivery_capacity() IS 'Trigger function that recalculates max_capacity_lu based on driver count (drivers * 20 LU)';

-- ========================================
-- 3. CREATE TRIGGERS
-- ========================================
-- Fire the capacity update function whenever driver schedules change

DROP TRIGGER IF EXISTS trigger_update_capacity_on_insert ON public.driver_schedules;
CREATE TRIGGER trigger_update_capacity_on_insert
  AFTER INSERT ON public.driver_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_delivery_capacity();

DROP TRIGGER IF EXISTS trigger_update_capacity_on_delete ON public.driver_schedules;
CREATE TRIGGER trigger_update_capacity_on_delete
  AFTER DELETE ON public.driver_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_delivery_capacity();

-- Note: No UPDATE trigger needed since we have UNIQUE constraint on (driver_id, delivery_time_id)
-- so the only updates would be to notes field, which doesn't affect capacity

-- ========================================
-- 4. RPC FUNCTION: assign_driver_shift
-- ========================================
-- Bulk-assign a driver to multiple time slots within a shift period
--
-- Parameters:
--   p_driver_id: UUID of the driver (from auth.users)
--   p_start_time: Start time of shift (format: 'HH:MM AM/PM', e.g., '12:00 PM')
--   p_end_time: End time of shift (format: 'HH:MM AM/PM', e.g., '5:00 PM')
--   p_day: Day of week (e.g., 'Monday', 'Thursday')
--   p_notes: Optional notes for all slots in this shift
--
-- Returns: JSON with assignment count and affected slot IDs

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
  -- Validate driver exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_driver_id) THEN
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
    -- Note: Handles overnight shifts (e.g., 11 PM to 2 AM)
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

COMMENT ON FUNCTION public.assign_driver_shift IS 'Bulk-assigns a driver to all delivery slots within a shift time range. Auto-updates capacity via triggers.';

-- ========================================
-- 5. HELPER VIEW: Driver Schedule Overview
-- ========================================
-- View to see all driver assignments with human-readable info

CREATE OR REPLACE VIEW public.v_driver_schedule_overview AS
SELECT 
  ds.id as schedule_id,
  ds.driver_id,
  u.email as driver_email,
  u.raw_user_meta_data->>'full_name' as driver_name,
  dt.id as slot_id,
  TRIM(dt.day) as day,
  CONCAT(dt.hours, ':', LPAD(COALESCE(dt.minutes::text, '00'), 2, '0'), ' ', dt.ampm) as time_slot,
  dt.max_capacity_lu,
  dt.current_load_lu,
  (dt.max_capacity_lu - dt.current_load_lu) as available_capacity,
  ds.notes,
  ds.created_at as assigned_at
FROM public.driver_schedules ds
JOIN auth.users u ON ds.driver_id = u.id
JOIN public.delivery_times dt ON ds.delivery_time_id = dt.id
ORDER BY dt.day, dt.hours, dt.minutes;

COMMENT ON VIEW public.v_driver_schedule_overview IS 'Human-readable view of all driver assignments with capacity info';

-- ========================================
-- 6. USAGE EXAMPLES
-- ========================================

-- Example 1: Assign a driver to Thursday 12 PM - 5 PM shift
-- SELECT assign_driver_shift(
--   'driver-uuid-here',
--   '12:00 PM',
--   '5:00 PM',
--   'Thursday',
--   'Regular shift'
-- );

-- Example 2: View all driver assignments
-- SELECT * FROM v_driver_schedule_overview;

-- Example 3: See capacity for Thursday slots
-- SELECT 
--   TRIM(day) as day,
--   CONCAT(hours, ':', LPAD(COALESCE(minutes::text, '00'), 2, '0'), ' ', ampm) as time_slot,
--   (SELECT COUNT(*) FROM driver_schedules WHERE delivery_time_id = delivery_times.id) as driver_count,
--   max_capacity_lu,
--   current_load_lu,
--   (max_capacity_lu - current_load_lu) as available_capacity
-- FROM delivery_times
-- WHERE TRIM(day) = 'Thursday'
-- ORDER BY hours, minutes;

-- Example 4: Remove a driver from a specific slot
-- DELETE FROM driver_schedules 
-- WHERE driver_id = 'driver-uuid-here' 
--   AND delivery_time_id = 687;
-- -- Capacity will auto-update via trigger

-- Example 5: Get all shifts for a specific driver
-- SELECT 
--   TRIM(dt.day) as day,
--   CONCAT(dt.hours, ':', LPAD(COALESCE(dt.minutes::text, '00'), 2, '0'), ' ', dt.ampm) as time_slot,
--   ds.notes
-- FROM driver_schedules ds
-- JOIN delivery_times dt ON ds.delivery_time_id = dt.id
-- WHERE ds.driver_id = 'driver-uuid-here'
-- ORDER BY dt.day, dt.hours, dt.minutes;

-- Example 6: Assign multiple drivers to the same shift (increases capacity)
-- SELECT assign_driver_shift('driver-1-uuid', '12:00 PM', '5:00 PM', 'Thursday', 'Driver 1');
-- SELECT assign_driver_shift('driver-2-uuid', '12:00 PM', '5:00 PM', 'Thursday', 'Driver 2');
-- -- Each slot from 12-5 PM will now have max_capacity_lu = 40.0 (2 drivers * 20 LU)

-- Example 7: Find slots with no drivers (0 capacity)
-- SELECT 
--   id,
--   TRIM(day) as day,
--   CONCAT(hours, ':', LPAD(COALESCE(minutes::text, '00'), 2, '0'), ' ', ampm) as time_slot,
--   max_capacity_lu
-- FROM delivery_times
-- WHERE max_capacity_lu = 0
-- ORDER BY day, hours, minutes;

-- ========================================
-- 7. INITIAL CAPACITY SYNC (OPTIONAL)
-- ========================================
-- If you already have driver_schedules data, run this to sync capacity values

-- UPDATE delivery_times dt
-- SET max_capacity_lu = (
--   SELECT COUNT(*) * 20.0
--   FROM driver_schedules ds
--   WHERE ds.delivery_time_id = dt.id
-- );

-- ========================================
-- 8. ADMIN FUNCTIONS (BONUS)
-- ========================================

-- Function to get driver workload summary
CREATE OR REPLACE FUNCTION public.get_driver_workload(p_driver_id UUID)
RETURNS JSON AS $$
DECLARE
  v_total_slots INTEGER;
  v_days_worked TEXT[];
  v_earliest_slot TEXT;
  v_latest_slot TEXT;
BEGIN
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
    'total_slots', v_total_slots,
    'days_worked', v_days_worked,
    'earliest_slot', v_earliest_slot,
    'latest_slot', v_latest_slot,
    'estimated_hours', ROUND((v_total_slots * 20.0) / 60.0, 2) -- 20 min per slot average
  );
END;
$$ LANGUAGE plpgsql;

-- Function to clear all schedules for a specific day (useful for schedule resets)
CREATE OR REPLACE FUNCTION public.clear_day_schedules(p_day TEXT)
RETURNS JSON AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM driver_schedules
    WHERE delivery_time_id IN (
      SELECT id FROM delivery_times WHERE TRIM(day) = TRIM(p_day)
    )
    RETURNING *
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  RETURN json_build_object(
    'success', true,
    'day', TRIM(p_day),
    'schedules_cleared', v_deleted_count,
    'message', format('Cleared %s driver assignments for %s', v_deleted_count, TRIM(p_day))
  );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Check if everything is set up correctly:
-- 1. Table exists
-- SELECT EXISTS (
--   SELECT FROM information_schema.tables 
--   WHERE table_schema = 'public' 
--   AND table_name = 'driver_schedules'
-- ) as table_exists;

-- 2. Triggers exist
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
--   AND event_object_table = 'driver_schedules';

-- 3. Functions exist
-- SELECT routine_name, routine_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN ('assign_driver_shift', 'update_delivery_capacity', 'get_driver_workload', 'clear_day_schedules');

-- ========================================
-- TESTING SCRIPT
-- ========================================

-- Test the system with a dummy driver:
-- 
-- Step 1: Create a test driver (or use an existing UUID from auth.users)
-- INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'test-driver@example.com');
-- 
-- Step 2: Assign driver to Thursday 12 PM - 3 PM
-- SELECT assign_driver_shift(
--   (SELECT id FROM auth.users WHERE email = 'test-driver@example.com'),
--   '12:00 PM',
--   '3:00 PM',
--   'Thursday',
--   'Test shift'
-- );
-- 
-- Step 3: Verify capacity updated
-- SELECT 
--   id,
--   CONCAT(hours, ':', LPAD(COALESCE(minutes::text, '00'), 2, '0'), ' ', ampm) as slot,
--   max_capacity_lu,
--   (SELECT COUNT(*) FROM driver_schedules WHERE delivery_time_id = delivery_times.id) as driver_count
-- FROM delivery_times
-- WHERE TRIM(day) = 'Thursday' 
--   AND hours::int >= 12 
--   AND hours::int < 15
-- ORDER BY hours, minutes;
-- Expected: All 12-3 PM slots should have max_capacity_lu = 20.0 and driver_count = 1
--
-- Step 4: Add second driver to same shift (should double capacity)
-- Step 5: Remove drivers and verify capacity drops to 0

-- ========================================
-- MIGRATION NOTES
-- ========================================
-- If you need to reset the system:
-- DROP TRIGGER IF EXISTS trigger_update_capacity_on_insert ON public.driver_schedules;
-- DROP TRIGGER IF EXISTS trigger_update_capacity_on_delete ON public.driver_schedules;
-- DROP FUNCTION IF EXISTS public.update_delivery_capacity();
-- DROP FUNCTION IF EXISTS public.assign_driver_shift(UUID, TEXT, TEXT, TEXT, TEXT);
-- DROP VIEW IF EXISTS public.v_driver_schedule_overview;
-- DROP TABLE IF EXISTS public.driver_schedules;
