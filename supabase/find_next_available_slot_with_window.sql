-- =====================================================
-- Enhanced RPC: find_next_available_slot with Customer Window Support
-- =====================================================
-- Finds the earliest available driver slot within a customer's selected time window

CREATE OR REPLACE FUNCTION public.find_next_available_slot_in_window(
  required_load NUMERIC,
  customer_window_label TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result_slot RECORD;
  slot_timestamp_calc TIMESTAMP;
  current_day_num INTEGER;
  slot_day_num INTEGER;
  days_ahead INTEGER;
BEGIN
  current_day_num := EXTRACT(DOW FROM CURRENT_DATE)::int;
  
  -- Find the first available slot that can accommodate the load
  -- If customer_window_label provided, filter to that window only
  WITH slot_with_h24 AS (
    SELECT 
      dt.id,
      dt.day,
      dt.hours,
      dt.minutes,
      dt.ampm,
      dt.customer_window_label,
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
      AND dt.max_capacity_lu > 0  -- Only slots with drivers assigned
      AND (customer_window_label IS NULL OR dt.customer_window_label = customer_window_label)
  ),
  slot_with_timestamp AS (
    SELECT 
      *,
      CASE 
        WHEN (CURRENT_DATE + (day_num - current_day_num + 7) % 7 * INTERVAL '1 day' + hour_24 * INTERVAL '1 hour' + min_val * INTERVAL '1 minute') > NOW() + INTERVAL '105 minutes'
        THEN (CURRENT_DATE + (day_num - current_day_num + 7) % 7 * INTERVAL '1 day' + hour_24 * INTERVAL '1 hour' + min_val * INTERVAL '1 minute')
        ELSE (CURRENT_DATE + ((day_num - current_day_num + 7) % 7 + 7) * INTERVAL '1 day' + hour_24 * INTERVAL '1 hour' + min_val * INTERVAL '1 minute')
      END as slot_timestamp
    FROM slot_with_h24
  )
  SELECT 
    id,
    day,
    hours,
    minutes,
    ampm,
    customer_window_label,
    current_load_lu,
    max_capacity_lu,
    slot_timestamp
  INTO result_slot
  FROM slot_with_timestamp
  WHERE 
    slot_timestamp > NOW() + INTERVAL '105 minutes'  -- 1h 45m buffer
    AND (max_capacity_lu - COALESCE(current_load_lu, 0)) >= required_load  -- Has capacity
  ORDER BY slot_timestamp ASC
  LIMIT 1;
  
  -- If no slot found, return NULL
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Return slot details as JSON
  RETURN json_build_object(
    'id', result_slot.id,
    'day', result_slot.day,
    'hours', result_slot.hours,
    'minutes', result_slot.minutes,
    'ampm', result_slot.ampm,
    'customer_window_label', result_slot.customer_window_label,
    'current_load_lu', result_slot.current_load_lu,
    'max_capacity_lu', result_slot.max_capacity_lu,
    'available_capacity', result_slot.max_capacity_lu - COALESCE(result_slot.current_load_lu, 0),
    'slot_timestamp', result_slot.slot_timestamp,
    'estimated_time', TO_CHAR(result_slot.slot_timestamp, 'HH12:MI AM')
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.find_next_available_slot_in_window IS
'Finds earliest available driver slot within optional customer window. If window provided, searches only that window. Otherwise finds next available globally.';
