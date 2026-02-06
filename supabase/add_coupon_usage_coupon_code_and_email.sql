-- Add denormalized fields to coupons_usage for easier admin viewing
-- - coupon_code: the readable code (e.g. REFERRAL50)
-- - user_email: the email of the user who redeemed/used it
--
-- NOTE:
-- This denormalizes data (duplicates it) for convenience in admin queries.
-- If you prefer NOT to denormalize, we can instead create a VIEW that joins
-- coupons_usage -> coupons -> users.

-- 1) Add columns (safe to run multiple times)
ALTER TABLE public.coupons_usage
ADD COLUMN IF NOT EXISTS coupon_code TEXT,
ADD COLUMN IF NOT EXISTS user_email TEXT;

-- 2) Backfill existing rows
-- Backfill coupon_code from coupons
UPDATE public.coupons_usage cu
SET coupon_code = c.coupon_code
FROM public.coupons c
WHERE cu.coupon_id = c.id;

-- Backfill user_email from users
UPDATE public.coupons_usage cu
SET user_email = u.email
FROM public.users u
WHERE cu.user_id = u.id;

-- 3) Keep the columns populated going forward
CREATE OR REPLACE FUNCTION public.populate_coupons_usage_denorm_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- coupon_code from coupons
  SELECT c.coupon_code
  INTO NEW.coupon_code
  FROM public.coupons c
  WHERE c.id = NEW.coupon_id;

  -- user_email from users (public.users)
  SELECT u.email
  INTO NEW.user_email
  FROM public.users u
  WHERE u.id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_populate_coupons_usage_denorm_fields ON public.coupons_usage;
CREATE TRIGGER trg_populate_coupons_usage_denorm_fields
BEFORE INSERT OR UPDATE OF coupon_id, user_id
ON public.coupons_usage
FOR EACH ROW
EXECUTE FUNCTION public.populate_coupons_usage_denorm_fields();

