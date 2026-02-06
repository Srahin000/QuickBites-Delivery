-- Quick test queries to debug the Rider Scheduler deliverer dropdown issue
-- Run these in Supabase SQL Editor to diagnose the problem

-- ========================================
-- 1. CHECK IF DELIVERERS EXIST
-- ========================================
-- This should show all users with role = 'deliverer'
SELECT id, email, first_name, last_name, role, created_at
FROM public.users
WHERE role = 'deliverer'
ORDER BY email;

-- Expected: Should return at least 1 row
-- If empty: You need to add deliverers or update existing users

-- ========================================
-- 2. CHECK CURRENT USER INFO
-- ========================================
-- This shows who you're logged in as
SELECT auth.uid() as current_user_id,
       email,
       role
FROM public.users
WHERE id = auth.uid();

-- Expected: Should show your admin account with role = 'admin'

-- ========================================
-- 3. CHECK IF ADMIN POLICY IS WORKING
-- ========================================
-- This tests if the admin check function works
SELECT public.current_user_is_admin() as is_admin;

-- Expected: Should return true if you're an admin
-- If false: Your role might not be 'admin' or the function isn't working

-- ========================================
-- 4. CHECK ALL USERS (ADMIN ONLY)
-- ========================================
-- This only works if RLS policies allow it
SELECT id, email, first_name, last_name, role
FROM public.users
ORDER BY role, email;

-- Expected: If you're admin, should show ALL users
-- If error or empty: RLS is blocking you, run users_rls_admin_read.sql

-- ========================================
-- 5. CREATE A TEST DELIVERER (IF NEEDED)
-- ========================================
-- Uncomment and run this to create a test deliverer:

-- UPDATE public.users
-- SET role = 'deliverer',
--     first_name = 'Test',
--     last_name = 'Driver'
-- WHERE email = 'YOUR_TEST_EMAIL@example.com';

-- Or create a brand new test user:
-- INSERT INTO public.users (id, email, first_name, last_name, role)
-- VALUES (
--   gen_random_uuid(),
--   'test-driver@example.com',
--   'Test',
--   'Driver',
--   'deliverer'
-- );

-- ========================================
-- 6. CHECK RLS POLICIES ON USERS TABLE
-- ========================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- Expected: Should show policies like "Admins can read all users" and "Users can read own row"
-- If no policies: Run users_rls_admin_read.sql

-- ========================================
-- TROUBLESHOOTING CHECKLIST
-- ========================================
-- ✅ Run query #1: Do deliverers exist?
--    → If NO: Create deliverers (query #5)
--    → If YES: Continue to next step
--
-- ✅ Run query #2: Are you logged in as admin?
--    → If NO: Log in with admin account
--    → If YES and role ≠ 'admin': Update your role to 'admin'
--
-- ✅ Run query #3: Does admin check work?
--    → If FALSE: Your role isn't 'admin' or function is broken
--    → If TRUE: Continue to next step
--
-- ✅ Run query #4: Can you see all users?
--    → If ERROR/EMPTY: Run users_rls_admin_read.sql
--    → If YES: Your RLS is working, reload the app
