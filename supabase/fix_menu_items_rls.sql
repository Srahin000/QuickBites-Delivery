-- Fix RLS policies for menu_items table
-- RECOMMENDED: Keep RLS enabled but add proper policies
-- Run this in your Supabase SQL Editor

-- 1. Ensure RLS is enabled (keep it enabled for security)
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- 2. Check existing policies on menu_items
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies 
WHERE tablename = 'menu_items';

-- 3. Drop existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "menu_items_are_publicly_readable" ON menu_items;

-- 4. Create a policy that allows EVERYONE (including anonymous users) to read menu_items
-- Menu items are public data, so anyone should be able to view them
CREATE POLICY "menu_items_are_publicly_readable" 
ON menu_items
FOR SELECT
TO public
USING (true);

-- 5. Optional: Allow authenticated users to insert/update/delete menu items (for admin)
-- Uncomment if you want admins to be able to modify menu items through the app
-- DROP POLICY IF EXISTS "authenticated_users_can_modify_menu_items" ON menu_items;
-- CREATE POLICY "authenticated_users_can_modify_menu_items" 
-- ON menu_items
-- FOR ALL
-- TO authenticated
-- USING (true)
-- WITH CHECK (true);

-- 6. Also check and fix restaurant_master RLS (important for nested queries!)
-- When you do select('*, menu_items(*)'), RLS applies to BOTH tables
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies 
WHERE tablename = 'restaurant_master';

-- 7. Create policy for restaurant_master if it doesn't exist
DROP POLICY IF EXISTS "restaurant_master_public_read" ON restaurant_master;
CREATE POLICY "restaurant_master_public_read" 
ON restaurant_master
FOR SELECT
TO public
USING (true);

-- 8. Verify both policies were created
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies 
WHERE tablename IN ('menu_items', 'restaurant_master')
ORDER BY tablename, policyname;

-- 9. Test query (should return all menu items now, including your new "test" item)
-- SELECT * FROM menu_items WHERE dish_name = 'test';

