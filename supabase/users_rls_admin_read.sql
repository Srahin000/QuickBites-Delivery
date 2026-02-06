-- Allow admins to read all users (for Rider Scheduler, Manage Employees, Manage Customers, etc.)
-- Run this in Supabase SQL Editor if the admin tab shows no deliverers.
--
-- Uses a SECURITY DEFINER function to avoid infinite recursion: the policy must not
-- query the users table to check "is current user admin?" (that would re-trigger RLS on users).

-- 1) Function that checks if current user is admin.
--    SECURITY DEFINER = runs as function owner, so the SELECT on users inside
--    does not trigger RLS (avoids infinite recursion). Run this script as a role
--    that can read users (e.g. postgres / service role).
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
$$;

-- Grant execute to authenticated so the policy can use it
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;

-- 2) Ensure RLS is enabled on users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3) Drop the old policy that caused recursion (it queried users inside the policy)
DROP POLICY IF EXISTS "Admins can read all users" ON public.users;

-- 4) Admins can read every row in users (no subquery on users = no recursion)
CREATE POLICY "Admins can read all users"
ON public.users
FOR SELECT
TO authenticated
USING (public.current_user_is_admin());

-- 5) Users can read their own row
DROP POLICY IF EXISTS "Users can read own row" ON public.users;
CREATE POLICY "Users can read own row"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());
