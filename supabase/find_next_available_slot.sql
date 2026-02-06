-- Supabase RPC Function: find_next_available_slot
-- This function finds the next available delivery time slot that can accommodate the required load
--
-- IMPORTANT: Run this script in the Supabase Dashboard → SQL Editor (or via migration)
-- so the RPC is available to the app. Otherwise you'll get PGRST202 "function not found".
--
-- Usage: SELECT find_next_available_slot(12.5);
-- Returns: JSON object with slot info or NULL if shop is at capacity

CREATE OR REPLACE FUNCTION public.find_next_available_slot(required_load NUMERIC)
RETURNS JSON AS $$
DECLARE
  result_slot RECORD;
  is_next_slot BOOLEAN;
  immediate_next_slot_time TIMESTAMP;
  slot_day_num INTEGER;
  current_day_num INTEGER;
  days_ahead INTEGER;
  slot_timestamp_calc TIMESTAMP;
BEGIN
  -- Get current day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
  current_day_num := EXTRACT(DOW FROM CURRENT_DATE)::int;
  
  -- Find the immediate next slot time (for comparison) - calculate dynamically
  -- Use CTE to cast hours to integer once (hours column may be TEXT)
  WITH slot_base AS (
    SELECT 
      day,
      ampm,
      (NULLIF(TRIM(COALESCE(hours::text, '')), '')::integer + CASE 
        WHEN ampm = 'PM' AND NULLIF(TRIM(COALESCE(hours::text, '')), '')::integer <> 12 THEN 12 
        WHEN ampm = 'AM' AND NULLIF(TRIM(COALESCE(hours::text, '')), '')::integer = 12 THEN -12
        ELSE 0 
      END) AS hour_24,
      COALESCE(minutes, 0)::integer AS min_val,
      CASE 
        WHEN TRIM(day) = 'Sunday' THEN 0
        WHEN TRIM(day) = 'Monday' THEN 1
        WHEN TRIM(day) = 'Tuesday' THEN 2
        WHEN TRIM(day) = 'Wednesday' THEN 3
        WHEN TRIM(day) = 'Thursday' THEN 4
        WHEN TRIM(day) = 'Friday' THEN 5
        WHEN TRIM(day) = 'Saturday' THEN 6
        ELSE -1
      END AS day_num
    FROM delivery_times
    WHERE hours IS NOT NULL AND ampm IS NOT NULL AND TRIM(COALESCE(hours::text, '')) <> ''
  )
  SELECT 
    calculated_ts INTO immediate_next_slot_time
  FROM (
    SELECT 
      CASE 
        WHEN (CURRENT_DATE + (day_num - current_day_num + 7) % 7 * INTERVAL '1 day' + hour_24 * INTERVAL '1 hour' + min_val * INTERVAL '1 minute') > NOW()
        THEN (CURRENT_DATE + (day_num - current_day_num + 7) % 7 * INTERVAL '1 day' + hour_24 * INTERVAL '1 hour' + min_val * INTERVAL '1 minute')
        ELSE (CURRENT_DATE + ((day_num - current_day_num + 7) % 7 + 7) * INTERVAL '1 day' + hour_24 * INTERVAL '1 hour' + min_val * INTERVAL '1 minute')
      END as calculated_ts
    FROM slot_base
  ) sub
  WHERE calculated_ts > NOW()
  ORDER BY calculated_ts ASC
  LIMIT 1;

  -- Find the first slot that can accommodate the load - calculate timestamp dynamically
  -- Use CTE to cast hours to integer once (hours column may be TEXT)
  WITH slot_with_h24 AS (
    SELECT 
      dt.id,
      dt.day,
      dt.hours,
      dt.minutes,
      dt.ampm,
      dt.current_load_lu,
      dt.max_capacity_lu,
      (NULLIF(TRIM(dt.hours::text), '')::integer + CASE 
        WHEN dt.ampm = 'PM' AND NULLIF(TRIM(dt.hours::text), '')::integer <> 12 THEN 12 
        WHEN dt.ampm = 'AM' AND NULLIF(TRIM(dt.hours::text), '')::integer = 12 THEN -12
        ELSE 0 
      END) AS hour_24,
      COALESCE(dt.minutes, 0)::integer AS min_val,
      CASE 
        WHEN TRIM(dt.day) = 'Sunday' THEN 0
        WHEN TRIM(dt.day) = 'Monday' THEN 1
        WHEN TRIM(dt.day) = 'Tuesday' THEN 2
        WHEN TRIM(dt.day) = 'Wednesday' THEN 3
        WHEN TRIM(dt.day) = 'Thursday' THEN 4
        WHEN TRIM(dt.day) = 'Friday' THEN 5
        WHEN TRIM(dt.day) = 'Saturday' THEN 6
        ELSE -1
      END AS day_num
    FROM delivery_times dt
    WHERE 
      dt.hours IS NOT NULL 
      AND dt.ampm IS NOT NULL
      AND TRIM(COALESCE(dt.hours::text, '')) <> ''
      AND COALESCE(dt.max_capacity_lu, 0) > 0
      AND (COALESCE(dt.current_load_lu, 0) + required_load) <= dt.max_capacity_lu
  )
  SELECT 
    slot_id,
    estimated_time,
    current_load_lu,
    max_capacity_lu,
    day,
    calculated_timestamp
  INTO result_slot
  FROM (
    SELECT 
      id as slot_id,
      CONCAT(hours, ':', LPAD(COALESCE(minutes::text, '00'), 2, '0'), ' ', ampm) as estimated_time,
      COALESCE(current_load_lu, 0) as current_load_lu,
      COALESCE(max_capacity_lu, 20) as max_capacity_lu,
      TRIM(day) as day,
      CASE 
        WHEN (CURRENT_DATE + (day_num - current_day_num + 7) % 7 * INTERVAL '1 day' + hour_24 * INTERVAL '1 hour' + min_val * INTERVAL '1 minute') > NOW()
        THEN (CURRENT_DATE + (day_num - current_day_num + 7) % 7 * INTERVAL '1 day' + hour_24 * INTERVAL '1 hour' + min_val * INTERVAL '1 minute')
        ELSE (CURRENT_DATE + ((day_num - current_day_num + 7) % 7 + 7) * INTERVAL '1 day' + hour_24 * INTERVAL '1 hour' + min_val * INTERVAL '1 minute')
      END as calculated_timestamp
    FROM slot_with_h24
  ) sub
  WHERE calculated_timestamp > NOW()
  ORDER BY calculated_timestamp ASC
  LIMIT 1;

  -- Check if result exists
  IF result_slot IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check if this is NOT the immediate next slot (is_delayed = true means we skipped slots)
  IF immediate_next_slot_time IS NULL THEN
    is_next_slot := false;
  ELSE
    is_next_slot := (result_slot.calculated_timestamp > immediate_next_slot_time);
  END IF;

  -- Return JSON result
  RETURN json_build_object(
    'slot_id', result_slot.slot_id,
    'estimated_time', result_slot.estimated_time,
    'is_delayed', is_next_slot,
    'current_load', result_slot.current_load_lu,
    'max_capacity', result_slot.max_capacity_lu,
    'available_capacity', result_slot.max_capacity_lu - result_slot.current_load_lu,
    'day', result_slot.day
  );
END;
$$ LANGUAGE plpgsql;

-- Example usage:
-- SELECT find_next_available_slot(12.5);
-- Returns: {"slot_id": 3, "estimated_time": "2:00 PM", "is_delayed": false, "current_load": 8.5, "max_capacity": 20, "available_capacity": 11.5}

-- For testing: Check if a 25 LU order would split
-- SELECT find_next_available_slot(20.0); -- First bag
-- SELECT find_next_available_slot(5.0);  -- Remaining items

-- Debug queries to troubleshoot:
-- 
-- 1. Check what day PostgreSQL thinks it is:
-- SELECT CURRENT_DATE, EXTRACT(DOW FROM CURRENT_DATE) as day_num,
--        CASE EXTRACT(DOW FROM CURRENT_DATE)
--          WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday'
--          WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday' WHEN 6 THEN 'Saturday'
--        END as day_name;
--
-- 2. Check Thursday slots and their calculated timestamps:
-- SELECT 
--   id, 
--   TRIM(day) as day, 
--   hours, 
--   minutes, 
--   ampm,
--   current_load_lu, 
--   max_capacity_lu,
--   (max_capacity_lu - current_load_lu) as available_capacity,
--   (CURRENT_DATE + 
--     ((4 - EXTRACT(DOW FROM CURRENT_DATE)::int + 7) % 7) * INTERVAL '1 day' +
--     (hours::int + CASE WHEN ampm = 'PM' AND hours::int != 12 THEN 12 WHEN ampm = 'AM' AND hours::int = 12 THEN -12 ELSE 0 END) * INTERVAL '1 hour' +
--     COALESCE(minutes, 0) * INTERVAL '1 minute'
--   ) as calculated_ts,
--   NOW() as current_time,
--   (CURRENT_DATE + 
--     ((4 - EXTRACT(DOW FROM CURRENT_DATE)::int + 7) % 7) * INTERVAL '1 day' +
--     (hours::int + CASE WHEN ampm = 'PM' AND hours::int != 12 THEN 12 WHEN ampm = 'AM' AND hours::int = 12 THEN -12 ELSE 0 END) * INTERVAL '1 hour' +
--     COALESCE(minutes, 0) * INTERVAL '1 minute'
--   ) > NOW() as is_future
-- FROM delivery_times 
-- WHERE TRIM(day) = 'Thursday' AND hours IS NOT NULL AND ampm IS NOT NULL
-- ORDER BY hours, minutes
-- LIMIT 10;
--
-- 3. Test the function with different load values:
-- SELECT find_next_available_slot(5.0);   -- Small load
-- SELECT find_next_available_slot(15.0);  -- Medium load  
-- SELECT find_next_available_slot(25.0);  -- Large load (should return NULL if no slot fits)
--
-- 4. Check capacity for Thursday slots:
-- SELECT 
--   TRIM(day) as day, 
--   hours, 
--   minutes, 
--   ampm,
--   current_load_lu, 
--   max_capacity_lu, 
--   (max_capacity_lu - current_load_lu) as available_capacity,
--   CASE WHEN (current_load_lu + 10) <= max_capacity_lu THEN 'YES' ELSE 'NO' END as can_fit_10_lu
-- FROM delivery_times 
-- WHERE TRIM(day) = 'Thursday' AND hours IS NOT NULL AND ampm IS NOT NULL
-- ORDER BY hours, minutes;
