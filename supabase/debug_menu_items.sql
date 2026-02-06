-- Debug script to check why menu items aren't showing
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check if RLS is enabled and what policies exist
SELECT 
    tablename, 
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('menu_items', 'restaurant_master');

-- 2. List all RLS policies on menu_items
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd as command,
    roles,
    qual as using_expression,
    with_check
FROM pg_policies 
WHERE tablename = 'menu_items';

-- 3. List all RLS policies on restaurant_master
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd as command,
    roles,
    qual as using_expression,
    with_check
FROM pg_policies 
WHERE tablename = 'restaurant_master';

-- 4. Check if your test menu item exists and its restaurant_id
SELECT 
    id,
    restaurant_id,
    dish_name,
    menu_price,
    created_at
FROM menu_items 
WHERE dish_name = 'test' OR dish_name ILIKE '%test%'
ORDER BY created_at DESC;

-- 5. Check if that restaurant is active in restaurant_master
SELECT 
    rm.restaurant_id,
    rm.restaurant_name,
    rm.is_active,
    CASE WHEN COALESCE(rm.is_active, true) THEN 'YES - Active (shown to customers)' ELSE 'NO - Inactive (hidden)' END as visibility
FROM restaurant_master rm
WHERE rm.restaurant_id = (
    SELECT restaurant_id 
    FROM menu_items 
    WHERE dish_name = 'test' 
    LIMIT 1
);

-- 6. Test the actual query that the app uses (active restaurants only)
SELECT 
    rm.restaurant_id,
    rm.restaurant_name,
    json_agg(mi.*) as menu_items
FROM restaurant_master rm
LEFT JOIN menu_items mi ON rm.restaurant_id = mi.restaurant_id
WHERE COALESCE(rm.is_active, true) = true
AND rm.restaurant_id = (
    SELECT restaurant_id 
    FROM menu_items 
    WHERE dish_name = 'test' 
    LIMIT 1
)
GROUP BY rm.restaurant_id, rm.restaurant_name;

-- 7. Check if menu_items table has proper foreign key relationship
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'menu_items';

-- 8. Count menu items per restaurant (to see if test item is there)
SELECT 
    rm.restaurant_id,
    rm.restaurant_name,
    COUNT(mi.id) as menu_item_count,
    STRING_AGG(mi.dish_name, ', ') as dish_names
FROM restaurant_master rm
LEFT JOIN menu_items mi ON rm.restaurant_id = mi.restaurant_id
WHERE COALESCE(rm.is_active, true) = true
GROUP BY rm.restaurant_id, rm.restaurant_name
ORDER BY menu_item_count DESC;





