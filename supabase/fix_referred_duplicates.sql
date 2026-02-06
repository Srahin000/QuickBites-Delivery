-- One-off: fix REFERRED coupon (delivery-only) and optionally remove duplicate coupons_usage
-- Run once in Supabase SQL Editor if REFERRED was applied to subtotal or showed 2x/3x.

-- 1) Make REFERRED apply only to delivery fee (not food)
UPDATE coupons SET category = 'delivery-fee' WHERE coupon_code = 'REFERRED';

-- 2) Optional: remove duplicate REFERRED rows so each user has at most one. Keeps oldest.
--    (The app now dedupes when fetching, so this just cleans the DB.)
DELETE FROM coupons_usage
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, coupon_id ORDER BY created_at) rnum
    FROM coupons_usage
    WHERE coupon_id = (SELECT id FROM coupons WHERE coupon_code = 'REFERRED')
  ) t WHERE t.rnum > 1
);
