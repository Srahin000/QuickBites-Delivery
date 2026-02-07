-- =====================================================
-- Daily Configuration Table
-- =====================================================
-- Manages system-wide delivery configuration settings
-- Allows admin control over driver pace and customer window intervals

CREATE TABLE IF NOT EXISTS public.daily_configs (
  id SERIAL PRIMARY KEY,
  config_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Driver Configuration
  trips_per_hour INTEGER NOT NULL DEFAULT 4 CHECK (trips_per_hour IN (2, 3, 4)),
  -- 2 trips/hour = 30-minute slots (relaxed)
  -- 3 trips/hour = 20-minute slots (standard)
  -- 4 trips/per_hour = 15-minute slots (rush)
  
  load_units_per_driver NUMERIC NOT NULL DEFAULT 20.0,
  -- Each driver can carry 20 LU per trip/slot (configurable)
  
  -- Customer Facing Configuration
  customer_interval_minutes INTEGER NOT NULL DEFAULT 60 CHECK (customer_interval_minutes IN (30, 60)),
  -- 60 = Customers see hourly blocks (10 AM, 11 AM, 12 PM)
  -- 30 = Customers see 30-minute blocks (10:00 AM, 10:30 AM)
  
  -- Operational Settings
  min_order_buffer_minutes INTEGER NOT NULL DEFAULT 105,
  -- Minimum time before slot that orders can be placed
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure only one config per date
  UNIQUE(config_date)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_daily_configs_date ON public.daily_configs(config_date);

-- Insert default configuration for today
INSERT INTO public.daily_configs (
  config_date,
  trips_per_hour,
  load_units_per_driver,
  customer_interval_minutes,
  min_order_buffer_minutes
) VALUES (
  CURRENT_DATE,
  4, -- 15-minute driver slots (rush mode)
  20.0, -- 20 LU per trip/slot
  60, -- Customers see hourly blocks
  105 -- 1h 45m buffer
) ON CONFLICT (config_date) DO NOTHING;

-- =====================================================
-- Update delivery_times to add customer_window_label
-- =====================================================

ALTER TABLE public.delivery_times 
ADD COLUMN IF NOT EXISTS customer_window_label TEXT;

-- Create index for grouping queries
CREATE INDEX IF NOT EXISTS idx_delivery_times_customer_window 
ON public.delivery_times(customer_window_label);

COMMENT ON COLUMN public.delivery_times.customer_window_label IS 
'Customer-facing time window label (e.g., "10:00 AM"). Multiple driver slots share the same label.';

-- =====================================================
-- Function: Calculate Customer Window Label
-- =====================================================
-- Rounds a timestamp down to the nearest customer interval boundary

CREATE OR REPLACE FUNCTION public.calculate_customer_window_label(
  slot_time TIMESTAMP,
  interval_minutes INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  boundary_time TIMESTAMP;
  hour_12 INTEGER;
  minute_val INTEGER;
  am_pm TEXT;
BEGIN
  -- Round UP to the next interval boundary (so 11:59 PM becomes 12:00 AM next day)
  boundary_time := date_trunc('hour', slot_time) + 
                   (CEIL(EXTRACT(MINUTE FROM slot_time)::NUMERIC / interval_minutes) * interval_minutes) * INTERVAL '1 minute';
  
  -- Extract components for 12-hour format
  hour_12 := EXTRACT(HOUR FROM boundary_time)::INTEGER;
  minute_val := EXTRACT(MINUTE FROM boundary_time)::INTEGER;
  
  -- Convert to 12-hour format
  IF hour_12 = 0 THEN
    hour_12 := 12;
    am_pm := 'AM';
  ELSIF hour_12 < 12 THEN
    am_pm := 'AM';
  ELSIF hour_12 = 12 THEN
    am_pm := 'PM';
  ELSE
    hour_12 := hour_12 - 12;
    am_pm := 'PM';
  END IF;
  
  -- Format the label
  IF minute_val = 0 THEN
    RETURN hour_12 || ':00 ' || am_pm;
  ELSE
    RETURN hour_12 || ':' || LPAD(minute_val::TEXT, 2, '0') || ' ' || am_pm;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.calculate_customer_window_label IS
'Calculates the customer-facing window label by rounding slot timestamp to interval boundary';

-- =====================================================
-- Function: Generate Dynamic Slots
-- =====================================================
-- Generates delivery time slots based on trips_per_hour configuration

CREATE OR REPLACE FUNCTION public.generate_dynamic_slots(
  for_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  day_name TEXT,
  slot_hour INTEGER,
  slot_minute INTEGER,
  slot_period TEXT,
  slot_timestamp TIMESTAMP,
  customer_label TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  config_record RECORD;
  slot_interval INTEGER; -- minutes between slots
  current_slot TIMESTAMP;
  end_slot TIMESTAMP;
  day_names TEXT[] := ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  day_name TEXT;
  slot_hour_12 INTEGER;
  slot_minute INTEGER;
  slot_period TEXT;
BEGIN
  -- Get configuration for the date
  SELECT * INTO config_record
  FROM public.daily_configs
  WHERE config_date = for_date
  LIMIT 1;
  
  -- Use defaults if no config found
  IF NOT FOUND THEN
    config_record.trips_per_hour := 4;
    config_record.customer_interval_minutes := 60;
  END IF;
  
  -- Calculate slot interval based on trips per hour
  -- 2 trips/hour = 30 min slots
  -- 3 trips/hour = 20 min slots
  -- 4 trips/hour = 15 min slots
  slot_interval := 60 / config_record.trips_per_hour;
  
  -- Generate slots for each day of the week
  FOREACH day_name IN ARRAY day_names
  LOOP
    -- Service hours: 10 AM to 9 PM
    current_slot := for_date + TIME '10:00:00';
    end_slot := for_date + TIME '21:00:00';
    
    WHILE current_slot < end_slot LOOP
      -- Extract hour, minute, period
      slot_hour_12 := EXTRACT(HOUR FROM current_slot)::INTEGER;
      slot_minute := EXTRACT(MINUTE FROM current_slot)::INTEGER;
      
      -- Convert to 12-hour format
      IF slot_hour_12 = 0 THEN
        slot_hour_12 := 12;
        slot_period := 'AM';
      ELSIF slot_hour_12 < 12 THEN
        slot_period := 'AM';
      ELSIF slot_hour_12 = 12 THEN
        slot_period := 'PM';
      ELSE
        slot_hour_12 := slot_hour_12 - 12;
        slot_period := 'PM';
      END IF;
      
      -- Calculate customer window label
      RETURN QUERY SELECT
        day_name,
        slot_hour_12,
        slot_minute,
        slot_period,
        current_slot,
        calculate_customer_window_label(current_slot, config_record.customer_interval_minutes);
      
      -- Move to next slot
      current_slot := current_slot + (slot_interval || ' minutes')::INTERVAL;
    END LOOP;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.generate_dynamic_slots IS
'Generates delivery time slots dynamically based on trips_per_hour configuration. Returns slots for all days of the week.';

-- =====================================================
-- Function: Regenerate Delivery Times
-- =====================================================
-- Updates and regenerates delivery_times slots while preserving driver assignments

CREATE OR REPLACE FUNCTION public.regenerate_delivery_times(
  for_date DATE DEFAULT CURRENT_DATE
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  slot_record RECORD;
  inserted_count INTEGER := 0;
  updated_count INTEGER := 0;
  existing_slot_id BIGINT;
  config_record RECORD;
BEGIN
  -- Get configuration for the date
  SELECT * INTO config_record
  FROM public.daily_configs
  WHERE config_date = for_date
  LIMIT 1;
  
  -- Use defaults if no config found
  IF NOT FOUND THEN
    config_record.load_units_per_driver := 20.0;
  END IF;
  
  -- Create a temporary table to track which slots should exist
  CREATE TEMP TABLE IF NOT EXISTS temp_new_slots (
    day_name TEXT,
    slot_hour INTEGER,
    slot_minute INTEGER,
    slot_period TEXT,
    slot_timestamp TIMESTAMP,
    customer_label TEXT,
    processed BOOLEAN DEFAULT FALSE
  ) ON COMMIT DROP;
  
  -- Clear temp table
  DELETE FROM temp_new_slots;
  
  -- Insert all slots that should exist based on current config
  INSERT INTO temp_new_slots (day_name, slot_hour, slot_minute, slot_period, slot_timestamp, customer_label)
  SELECT * FROM public.generate_dynamic_slots(for_date);
  
  -- Update or insert slots
  FOR slot_record IN SELECT * FROM temp_new_slots
  LOOP
    -- Try to find existing slot with matching day/time
    SELECT id INTO existing_slot_id
    FROM public.delivery_times
    WHERE TRIM(day) = TRIM(slot_record.day_name)
      AND hours = slot_record.slot_hour
      AND COALESCE(minutes, 0) = slot_record.slot_minute
      AND TRIM(ampm) = TRIM(slot_record.slot_period)
    LIMIT 1;
    
    IF existing_slot_id IS NOT NULL THEN
      -- Update existing slot with new customer_window_label and slot_timestamp
      UPDATE public.delivery_times
      SET 
        slot_timestamp = slot_record.slot_timestamp,
        customer_window_label = slot_record.customer_label
      WHERE id = existing_slot_id;
      
      updated_count := updated_count + 1;
    ELSE
      -- Insert new slot
      INSERT INTO public.delivery_times (
        day,
        hours,
        minutes,
        ampm,
        slot_timestamp,
        customer_window_label,
        counter,
        current_load_lu,
        max_capacity_lu
      ) VALUES (
        slot_record.day_name,
        slot_record.slot_hour,
        slot_record.slot_minute,
        slot_record.slot_period,
        slot_record.slot_timestamp,
        slot_record.customer_label,
        0,
        0,
        0
      );
      
      inserted_count := inserted_count + 1;
    END IF;
  END LOOP;
  
  -- Delete slots that shouldn't exist anymore (those not in temp_new_slots)
  -- Only delete if they don't have any current load or active orders
  DELETE FROM public.delivery_times dt
  WHERE NOT EXISTS (
    SELECT 1 FROM temp_new_slots tns
    WHERE TRIM(dt.day) = TRIM(tns.day_name)
      AND dt.hours = tns.slot_hour
      AND COALESCE(dt.minutes, 0) = tns.slot_minute
      AND TRIM(dt.ampm) = TRIM(tns.slot_period)
  )
  AND COALESCE(dt.current_load_lu, 0) = 0;
  
  -- Recalculate max_capacity_lu for all slots based on driver assignments
  UPDATE public.delivery_times dt
  SET max_capacity_lu = COALESCE(
    (SELECT COUNT(*) * config_record.load_units_per_driver
     FROM public.driver_schedules ds
     WHERE ds.delivery_time_id = dt.id),
    0
  );
  
  RETURN format('Updated %s slots, inserted %s new slots', updated_count, inserted_count);
END;
$$;

COMMENT ON FUNCTION public.regenerate_delivery_times IS
'Updates and regenerates delivery_times slots while preserving driver assignments and existing references';

-- =====================================================
-- RPC: Update Daily Configuration
-- =====================================================
-- Admin function to update configuration and regenerate slots

CREATE OR REPLACE FUNCTION public.update_daily_config(
  new_trips_per_hour INTEGER,
  new_customer_interval INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result TEXT;
BEGIN
  -- Validate inputs
  IF new_trips_per_hour NOT IN (2, 3, 4) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'trips_per_hour must be 2, 3, or 4'
    );
  END IF;
  
  IF new_customer_interval NOT IN (30, 60) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'customer_interval_minutes must be 30 or 60'
    );
  END IF;
  
  -- Update or insert config for today
  INSERT INTO public.daily_configs (
    config_date,
    trips_per_hour,
    customer_interval_minutes
  ) VALUES (
    CURRENT_DATE,
    new_trips_per_hour,
    new_customer_interval
  )
  ON CONFLICT (config_date)
  DO UPDATE SET
    trips_per_hour = new_trips_per_hour,
    customer_interval_minutes = new_customer_interval,
    updated_at = NOW();
  
  -- Regenerate delivery time slots
  result := regenerate_delivery_times(CURRENT_DATE);
  
  RETURN json_build_object(
    'success', true,
    'message', result,
    'trips_per_hour', new_trips_per_hour,
    'customer_interval_minutes', new_customer_interval
  );
END;
$$;

COMMENT ON FUNCTION public.update_daily_config IS
'Updates daily configuration and regenerates delivery time slots. Admin only.';
