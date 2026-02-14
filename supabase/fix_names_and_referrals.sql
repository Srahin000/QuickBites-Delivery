-- ==========================================
-- FIX: Names Not Saving and Referral Rewards
-- Run this in your Supabase SQL Editor to apply the fixes
-- ==========================================

-- Fix 1: Update handle_new_user trigger to save names properly
-- The issue was "ON CONFLICT DO NOTHING" which ignored name updates
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_referral_code TEXT;
  v_referral_promo_enabled BOOLEAN;
BEGIN
  -- Only create profile if email is confirmed
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if profile already exists
  IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Check if referral promo is enabled (service_approval id = 4)
  SELECT open INTO v_referral_promo_enabled
  FROM public.service_approval
  WHERE id = 4;

  -- Insert user profile into public.users table
  -- If profile already exists, update names if they were empty
  INSERT INTO public.users (
    id,
    email,
    first_name,
    last_name,
    role,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = CASE 
      WHEN users.first_name = '' OR users.first_name IS NULL 
      THEN COALESCE(EXCLUDED.first_name, users.first_name)
      ELSE users.first_name
    END,
    last_name = CASE 
      WHEN users.last_name = '' OR users.last_name IS NULL 
      THEN COALESCE(EXCLUDED.last_name, users.last_name)
      ELSE users.last_name
    END,
    email = COALESCE(EXCLUDED.email, users.email);

  -- Generate and insert referral code if promo is enabled
  IF v_referral_promo_enabled = TRUE THEN
    -- Generate referral code
    SELECT public.generate_referral_code() INTO v_referral_code;
    
    IF v_referral_code IS NOT NULL THEN
      INSERT INTO public.user_referral_codes (
        user_id,
        referral_code
      )
      VALUES (
        NEW.id,
        v_referral_code
      )
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated;

-- ==========================================
-- VERIFICATION QUERIES
-- Run these to check if the fixes work
-- ==========================================

-- Check if names are now being saved for new users
-- SELECT id, email, first_name, last_name, role FROM users ORDER BY created_at DESC LIMIT 5;

-- Check referral usage records and rewards
-- SELECT 
--   ru.id,
--   ru.referral_code,
--   ru.referrer_rewarded,
--   ru.referee_rewarded,
--   referrer.email as referrer_email,
--   referee.email as referee_email,
--   ru.created_at
-- FROM referral_usage ru
-- JOIN users referrer ON ru.referrer_user_id = referrer.id
-- JOIN users referee ON ru.referee_user_id = referee.id
-- ORDER BY ru.created_at DESC;

-- Check coupon uses remaining for referrers
-- SELECT 
--   u.email,
--   urc.referral_code,
--   urc.coupon_uses_remaining,
--   urc.created_at
-- FROM user_referral_codes urc
-- JOIN users u ON urc.user_id = u.id
-- WHERE urc.coupon_uses_remaining > 0;

-- ==========================================
-- NOTES
-- ==========================================

-- Fix 1 (Names):
-- - Now when email is confirmed, if the profile exists but names are empty,
--   they will be filled from the signup metadata
-- - This fixes the issue where names weren't being saved during signup

-- Fix 2 (Referrals):
-- - The app code was updated to only mark referrer_rewarded = true when
--   the REFERRAL50 coupon is actually used on an order
-- - Previously, it was marking rewards as used on ANY order, even without
--   applying the coupon
-- - This fixes the "0 pending rewards" issue when you've referred people
--   but haven't used the REFERRAL50 coupon yet

-- How the referral system works:
-- 1. User A signs up and gets a referral code
-- 2. User B signs up with User A's code → creates referral_usage record
--    with referrer_rewarded = false
-- 3. User A gets REFERRAL50 coupon and coupon_uses_remaining increments
-- 4. "Pending Rewards" shows count of referral_usage where referrer_rewarded = false
-- 5. When User A uses REFERRAL50 on an order, referrer_rewarded = true
--    and coupon_uses_remaining decrements
