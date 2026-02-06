-- Rider-Powered Schedule: One-time reset so slots are closed (0 LU) until riders are assigned.
-- Run once in Supabase SQL Editor. Existing trigger keeps capacity = driver_count * 20 going forward.
--
-- 1. Set all slots to 0 capacity (closed until assigned).
-- 2. Recalculate from current driver_schedules so only slots with at least one driver get non-zero capacity.

-- Step 1: Close all slots
UPDATE public.delivery_times
SET max_capacity_lu = 0;

-- Step 2: Recalculate from current assignments (only assigned slots get capacity)
UPDATE public.delivery_times dt
SET max_capacity_lu = (
  SELECT COUNT(*) * 20.0
  FROM public.driver_schedules ds
  WHERE ds.delivery_time_id = dt.id
)
WHERE EXISTS (
  SELECT 1 FROM public.driver_schedules ds WHERE ds.delivery_time_id = dt.id
);

-- Optional: Verify
-- SELECT id, day, hours, ampm, max_capacity_lu,
--        (SELECT COUNT(*) FROM driver_schedules WHERE delivery_time_id = delivery_times.id) as rider_count
-- FROM delivery_times ORDER BY day, hours LIMIT 20;
