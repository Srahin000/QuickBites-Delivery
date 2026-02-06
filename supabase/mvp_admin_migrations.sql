-- MVP Admin migrations
-- Run in Supabase SQL Editor (production + staging as needed)

-- 1) Deliverer-only phone + logistics flags on users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT false;

-- Optional: constrain phone to deliverers via app logic (DB constraint can be added later)

-- 2) Restaurant online/offline toggle
-- Note: restaurant_master already has 'active' column, no need to add 'is_active'
-- Uncomment below if 'active' column doesn't exist:
-- ALTER TABLE public.restaurant_master
-- ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- 3) Menu item out-of-stock toggle
ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS out_of_stock BOOLEAN NOT NULL DEFAULT false;

-- 4) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_verified ON public.users(verified);
CREATE INDEX IF NOT EXISTS idx_users_is_online ON public.users(is_online);
CREATE INDEX IF NOT EXISTS idx_restaurant_master_active ON public.restaurant_master(active);
CREATE INDEX IF NOT EXISTS idx_menu_items_out_of_stock ON public.menu_items(out_of_stock);



