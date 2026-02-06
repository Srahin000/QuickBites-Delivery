-- Database Setup for Load Unit Capacity System
-- Run this in your Supabase SQL Editor to prepare the database

-- ====================================
-- Step 1: Update delivery_times table
-- ====================================

-- Add capacity tracking columns if they don't exist
ALTER TABLE delivery_times 
ADD COLUMN IF NOT EXISTS current_load_lu NUMERIC DEFAULT 0;

ALTER TABLE delivery_times 
ADD COLUMN IF NOT EXISTS max_capacity_lu NUMERIC DEFAULT 20;

ALTER TABLE delivery_times 
ADD COLUMN IF NOT EXISTS slot_timestamp TIMESTAMP;

-- Update slot_timestamp for existing rows
-- This converts hours/minutes/ampm to a proper timestamp
UPDATE delivery_times 
SET slot_timestamp = (
  CURRENT_DATE + 
  (hours::int + CASE 
    WHEN ampm = 'PM' AND hours != 12 THEN 12 
    WHEN ampm = 'AM' AND hours = 12 THEN -12
    ELSE 0 
  END) * INTERVAL '1 hour' + 
  COALESCE(minutes, 0) * INTERVAL '1 minute'
)
WHERE slot_timestamp IS NULL;

-- Set default max capacity if not set
UPDATE delivery_times 
SET max_capacity_lu = 20 
WHERE max_capacity_lu IS NULL;

-- Reset current load (for testing)
UPDATE delivery_times SET current_load_lu = 0;

-- ====================================
-- Step 2: Update menu_items table
-- ====================================

-- Add load_unit column if it doesn't exist
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS load_unit NUMERIC DEFAULT 0;

-- Set example load unit values (adjust based on your actual menu)
-- These are sample values - customize for your restaurant

-- Burritos (large items)
UPDATE menu_items 
SET load_unit = 6.0 
WHERE dish_name ILIKE '%burrito%' AND load_unit = 0;

-- Bowls (medium-large items)
UPDATE menu_items 
SET load_unit = 5.0 
WHERE dish_name ILIKE '%bowl%' AND load_unit = 0;

-- Tacos (3-pack, medium items)
UPDATE menu_items 
SET load_unit = 3.0 
WHERE dish_name ILIKE '%taco%' AND load_unit = 0;

-- Quesadillas
UPDATE menu_items 
SET load_unit = 4.0 
WHERE dish_name ILIKE '%quesadilla%' AND load_unit = 0;

-- Sides and small items
UPDATE menu_items 
SET load_unit = 2.0 
WHERE (dish_name ILIKE '%side%' OR 
       dish_name ILIKE '%chip%' OR 
       dish_name ILIKE '%guac%' OR
       dish_name ILIKE '%salsa%') 
AND load_unit = 0;

-- Salads
UPDATE menu_items 
SET load_unit = 4.5 
WHERE dish_name ILIKE '%salad%' AND load_unit = 0;

-- Nachos
UPDATE menu_items 
SET load_unit = 5.5 
WHERE dish_name ILIKE '%nacho%' AND load_unit = 0;

-- Small items (single tacos, small sides)
UPDATE menu_items 
SET load_unit = 1.5 
WHERE load_unit = 0 AND 
      (dish_name ILIKE '%single%' OR 
       dish_name ILIKE '%mini%');

-- Default for remaining items
UPDATE menu_items 
SET load_unit = 3.0 
WHERE load_unit = 0;

-- ====================================
-- Step 3: Update orders table (optional)
-- ====================================

-- Add load tracking to orders for analytics
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS load_unit_total NUMERIC;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS is_split_delivery BOOLEAN DEFAULT false;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS split_delivery_slot_1 INTEGER;

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS split_delivery_slot_2 INTEGER;

-- ====================================
-- Step 4: Verification Queries
-- ====================================

-- Check menu items have load units assigned
SELECT 
  dish_name, 
  load_unit,
  CASE 
    WHEN load_unit = 0 THEN '❌ Missing'
    WHEN load_unit < 2 THEN '✓ Small'
    WHEN load_unit < 4 THEN '✓ Medium'
    WHEN load_unit < 6 THEN '✓ Large'
    ELSE '✓ XLarge'
  END as size_category
FROM menu_items
ORDER BY load_unit DESC;

-- Check delivery slots setup
SELECT 
  id,
  day,
  CONCAT(hours, ':', LPAD(COALESCE(minutes::text, '00'), 2, '0'), ' ', ampm) as time_display,
  current_load_lu,
  max_capacity_lu,
  (max_capacity_lu - current_load_lu) as available_capacity,
  slot_timestamp
FROM delivery_times
WHERE slot_timestamp > NOW() OR slot_timestamp IS NULL
ORDER BY day, hours, minutes;

-- ====================================
-- Step 5: Test the RPC function
-- ====================================

-- Test 1: Can a 10 LU order fit?
SELECT find_next_available_slot(10.0);
-- Expected: Returns next available slot with capacity info

-- Test 2: Can a 25 LU order fit? (requires split)
SELECT find_next_available_slot(25.0);
-- Expected: May return NULL if no single slot can fit 25 LU

-- Test 3: Simulate high load
UPDATE delivery_times 
SET current_load_lu = 18 
WHERE id = (SELECT id FROM delivery_times WHERE slot_timestamp > NOW() ORDER BY slot_timestamp LIMIT 1);

-- Now try to fit 5 LU
SELECT find_next_available_slot(5.0);
-- Expected: Should skip to next slot with capacity

-- Reset after test
UPDATE delivery_times SET current_load_lu = 0;

-- ====================================
-- Step 6: Create helpful views (optional)
-- ====================================

-- View: Current capacity across all slots
CREATE OR REPLACE VIEW v_delivery_capacity AS
SELECT 
  id,
  day,
  CONCAT(hours, ':', LPAD(COALESCE(minutes::text, '00'), 2, '0'), ' ', ampm) as time_slot,
  current_load_lu,
  max_capacity_lu,
  (max_capacity_lu - current_load_lu) as available_lu,
  ROUND((current_load_lu / NULLIF(max_capacity_lu, 0) * 100)::numeric, 1) as usage_percent,
  CASE 
    WHEN current_load_lu >= max_capacity_lu THEN '🔴 FULL'
    WHEN current_load_lu >= max_capacity_lu * 0.8 THEN '🟡 HIGH'
    WHEN current_load_lu >= max_capacity_lu * 0.5 THEN '🟢 MODERATE'
    ELSE '🟢 LOW'
  END as status,
  slot_timestamp
FROM delivery_times
WHERE slot_timestamp > NOW()
ORDER BY slot_timestamp;

-- View: Heavy orders analytics
CREATE OR REPLACE VIEW v_heavy_orders AS
SELECT 
  o.order_code,
  o.load_unit_total,
  o.total as order_total,
  o.is_split_delivery,
  o.created_at,
  u.email as customer_email,
  CASE 
    WHEN o.load_unit_total > 20 THEN '🔴 Split Required'
    WHEN o.load_unit_total > 15 THEN '🟡 Large'
    ELSE '🟢 Normal'
  END as order_size
FROM orders o
LEFT JOIN auth.users u ON o.user_id = u.id
WHERE o.load_unit_total > 15
ORDER BY o.created_at DESC;

-- ====================================
-- Step 7: Indexes for performance
-- ====================================

-- Index on slot_timestamp for quick lookups
CREATE INDEX IF NOT EXISTS idx_delivery_times_slot_timestamp 
ON delivery_times(slot_timestamp) 
WHERE slot_timestamp > NOW();

-- Index on current_load for capacity queries
CREATE INDEX IF NOT EXISTS idx_delivery_times_capacity 
ON delivery_times(current_load_lu, max_capacity_lu);

-- ====================================
-- Verification Complete
-- ====================================

-- Run this final check to ensure everything is set up:
DO $$
DECLARE
  missing_load_units INTEGER;
  missing_timestamps INTEGER;
  rpc_exists BOOLEAN;
BEGIN
  -- Check menu items
  SELECT COUNT(*) INTO missing_load_units
  FROM menu_items WHERE load_unit IS NULL OR load_unit = 0;
  
  -- Check delivery times
  SELECT COUNT(*) INTO missing_timestamps
  FROM delivery_times WHERE slot_timestamp IS NULL;
  
  -- Check RPC function
  SELECT EXISTS(
    SELECT 1 FROM pg_proc WHERE proname = 'find_next_available_slot'
  ) INTO rpc_exists;
  
  -- Report
  RAISE NOTICE '=== Load Unit System Setup Check ===';
  RAISE NOTICE 'Menu items missing load_unit: %', missing_load_units;
  RAISE NOTICE 'Delivery slots missing timestamp: %', missing_timestamps;
  RAISE NOTICE 'RPC function exists: %', rpc_exists;
  
  IF missing_load_units = 0 AND missing_timestamps = 0 AND rpc_exists THEN
    RAISE NOTICE '✅ Setup complete! System ready.';
  ELSE
    RAISE NOTICE '⚠️  Some setup steps incomplete.';
  END IF;
END $$;
