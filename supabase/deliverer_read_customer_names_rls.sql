-- Allow deliverers to read customer names (first_name, last_name) for users who have orders.
-- So the Deliverer Orders screen can show "Customer: John Doe" instead of "Customer: Unknown".
-- Uses SECURITY DEFINER to avoid RLS recursion when checking if current user is a deliverer.

-- 1) Function: is the current user a deliverer?
CREATE OR REPLACE FUNCTION public.current_user_is_deliverer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'deliverer')
$$;

GRANT EXECUTE ON FUNCTION public.current_user_is_deliverer() TO authenticated;

-- 2) Policy: deliverers can read users who appear as order customer (user_id in orders)
CREATE POLICY "Deliverers can read customer names for orders"
ON public.users
FOR SELECT
TO authenticated
USING (
  public.current_user_is_deliverer()
  AND EXISTS (SELECT 1 FROM public.orders o WHERE o.user_id = users.id)
);
