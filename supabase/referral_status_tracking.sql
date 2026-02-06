-- Referral Status Tracking System
-- This creates a flexible status tracking system for targeted notifications
-- Run this in your Supabase SQL Editor

-- ==========================================
-- 1. USER STATUSES TABLE
-- ==========================================

-- Table to track user statuses for targeted notifications
CREATE TABLE IF NOT EXISTS user_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL, -- e.g., 'referred', 'winner', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  removed_at TIMESTAMP WITH TIME ZONE, -- NULL means status is active
  metadata JSONB DEFAULT '{}'::jsonb, -- For additional data like referral_code, etc.
  CONSTRAINT unique_active_status UNIQUE(user_id, status) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_user_statuses_user ON user_statuses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_statuses_status ON user_statuses(status);
CREATE INDEX IF NOT EXISTS idx_user_statuses_active ON user_statuses(user_id, status) WHERE removed_at IS NULL;

-- ==========================================
-- 2. UPDATE USER_REFERRAL_CODES TABLE
-- ==========================================

-- Add coupon_uses_remaining column if it doesn't exist (for REFERRAL50 counter)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_referral_codes' 
    AND column_name = 'coupon_uses_remaining'
  ) THEN
    ALTER TABLE user_referral_codes 
    ADD COLUMN coupon_uses_remaining INTEGER DEFAULT 0;
  END IF;
END $$;

-- ==========================================
-- 3. CREATE REFERRAL COUPONS
-- ==========================================

-- Ensure REFERRED coupon exists (free delivery)
INSERT INTO coupons (
  coupon_code,
  category,
  percentage,
  valid,
  categories,
  max_usage,
  end_at
) VALUES (
  'REFERRED',
  'delivery-fee',  -- discount applies only to delivery fee, not food
  100.00,          -- 100% off delivery fee
  true,
  'delivery-fee',
  1,               -- One-time use
  NOW() + INTERVAL '1 year' -- Expires in 1 year
) ON CONFLICT (coupon_code) DO UPDATE
SET category = 'delivery-fee', valid = true, end_at = NOW() + INTERVAL '1 year';

-- Ensure REFERRAL50 coupon exists (50% off for referrer)
INSERT INTO coupons (
  coupon_code,
  category,
  percentage,
  valid,
  categories,
  max_usage,
  end_at
) VALUES (
  'REFERRAL50',
  'referral',
  50.00, -- 50% off
  true,
  'delivery-fee, restaurant-fee, dev-fee, item-fee', -- Applies to all fees
  999999, -- High max usage (controlled by coupon_uses_remaining in user_referral_codes)
  NOW() + INTERVAL '1 year' -- Expires in 1 year
) ON CONFLICT (coupon_code) DO UPDATE
SET valid = true, end_at = NOW() + INTERVAL '1 year';

-- ==========================================
-- 4. DATABASE FUNCTIONS
-- ==========================================

-- Function to add a status to a user
CREATE OR REPLACE FUNCTION add_user_status(
  p_user_id UUID,
  p_status VARCHAR(50),
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  status_id UUID;
BEGIN
  -- First, remove any existing active status of the same type
  UPDATE user_statuses
  SET removed_at = NOW()
  WHERE user_id = p_user_id 
    AND status = p_status 
    AND removed_at IS NULL;
  
  -- Insert new status
  INSERT INTO user_statuses (user_id, status, metadata)
  VALUES (p_user_id, p_status, p_metadata)
  RETURNING id INTO status_id;
  
  RETURN status_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove a status from a user
CREATE OR REPLACE FUNCTION remove_user_status(
  p_user_id UUID,
  p_status VARCHAR(50)
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_statuses
  SET removed_at = NOW()
  WHERE user_id = p_user_id 
    AND status = p_status 
    AND removed_at IS NULL;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has active status
CREATE OR REPLACE FUNCTION has_user_status(
  p_user_id UUID,
  p_status VARCHAR(50)
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_statuses
    WHERE user_id = p_user_id 
      AND status = p_status 
      AND removed_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all users with a specific active status (for targeted notifications)
CREATE OR REPLACE FUNCTION get_users_with_status(
  p_status VARCHAR(50)
)
RETURNS TABLE(user_id UUID, created_at TIMESTAMP WITH TIME ZONE, metadata JSONB) AS $$
BEGIN
  RETURN QUERY
  SELECT us.user_id, us.created_at, us.metadata
  FROM user_statuses us
  WHERE us.status = p_status 
    AND us.removed_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process referral code at signup
-- This will be called from the Edge Function or app code
CREATE OR REPLACE FUNCTION process_referral_signup(
  p_referee_user_id UUID,
  p_referral_code VARCHAR(10)
)
RETURNS JSONB AS $$
DECLARE
  v_referrer_id UUID;
  v_referrer_code_record RECORD;
  v_result JSONB;
BEGIN
  -- Find the referrer by referral code
  SELECT urc.user_id INTO v_referrer_id
  FROM user_referral_codes urc
  WHERE urc.referral_code = UPPER(p_referral_code)
  LIMIT 1;
  
  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid referral code'
    );
  END IF;
  
  -- Prevent self-referral
  IF v_referrer_id = p_referee_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot use your own referral code'
    );
  END IF;
  
  -- Check if referee already used a referral code
  IF EXISTS (
    SELECT 1 FROM referral_usage 
    WHERE referee_user_id = p_referee_user_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Referral code already used'
    );
  END IF;
  
  -- Create referral_usage record
  INSERT INTO referral_usage (
    referral_code,
    referrer_user_id,
    referee_user_id,
    referrer_rewarded,
    referee_rewarded
  ) VALUES (
    UPPER(p_referral_code),
    v_referrer_id,
    p_referee_user_id,
    false,
    false
  );
  
  -- Add "referred" status to referee
  PERFORM add_user_status(
    p_referee_user_id,
    'referred',
    jsonb_build_object('referral_code', p_referral_code, 'referrer_id', v_referrer_id)
  );
  
  -- Give referee the REFERRED coupon (free delivery)
  INSERT INTO coupons_usage (
    user_id,
    coupon_id,
    status,
    expires_at
  )
  SELECT 
    p_referee_user_id,
    c.id,
    'available',
    NOW() + INTERVAL '90 days' -- Expires in 90 days
  FROM coupons c
  WHERE c.coupon_code = 'REFERRED'
  ON CONFLICT DO NOTHING;
  
  -- Increment referrer's coupon counter and give them REFERRAL50 coupon
  UPDATE user_referral_codes
  SET coupon_uses_remaining = COALESCE(coupon_uses_remaining, 0) + 1
  WHERE user_id = v_referrer_id;
  
  -- Give referrer the REFERRAL50 coupon if they don't have it
  INSERT INTO coupons_usage (
    user_id,
    coupon_id,
    status,
    expires_at
  )
  SELECT 
    v_referrer_id,
    c.id,
    'available',
    NOW() + INTERVAL '1 year'
  FROM coupons c
  WHERE c.coupon_code = 'REFERRAL50'
    AND NOT EXISTS (
      SELECT 1 FROM coupons_usage cu
      WHERE cu.user_id = v_referrer_id
        AND cu.coupon_id = c.id
        AND cu.status = 'available'
    )
  ON CONFLICT DO NOTHING;
  
  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_referrer_id,
    'message', 'Referral code applied successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to remove "referred" status when REFERRED coupon is used
-- and decrement REFERRAL50 counter when used
CREATE OR REPLACE FUNCTION remove_referred_status_on_coupon_use()
RETURNS TRIGGER AS $$
DECLARE
  v_coupon_code TEXT;
  v_current_uses INTEGER;
BEGIN
  -- Only process if status changed to 'applied'
  IF NEW.status = 'applied' AND (OLD.status IS NULL OR OLD.status != 'applied') THEN
    -- Get the coupon code
    SELECT c.coupon_code INTO v_coupon_code
    FROM coupons c
    WHERE c.id = NEW.coupon_id;
    
    -- If it's the REFERRED coupon, remove the referred status
    IF v_coupon_code = 'REFERRED' THEN
      PERFORM remove_user_status(NEW.user_id, 'referred');
    END IF;
    
    -- If it's REFERRAL50, decrement the counter (only if > 0)
    IF v_coupon_code = 'REFERRAL50' THEN
      -- Get current uses remaining
      SELECT COALESCE(coupon_uses_remaining, 0) INTO v_current_uses
      FROM user_referral_codes
      WHERE user_id = NEW.user_id;
      
      -- Only decrement if there are uses remaining
      IF v_current_uses > 0 THEN
        UPDATE user_referral_codes
        SET coupon_uses_remaining = v_current_uses - 1
        WHERE user_id = NEW.user_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_remove_referred_status ON coupons_usage;
CREATE TRIGGER trigger_remove_referred_status
AFTER UPDATE ON coupons_usage
FOR EACH ROW
WHEN (NEW.status = 'applied')
EXECUTE FUNCTION remove_referred_status_on_coupon_use();

-- ==========================================
-- 5. ROW LEVEL SECURITY POLICIES
-- ==========================================

ALTER TABLE user_statuses ENABLE ROW LEVEL SECURITY;

-- Users can view their own statuses
DROP POLICY IF EXISTS "Users can view their own statuses" ON user_statuses;
CREATE POLICY "Users can view their own statuses"
ON user_statuses FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all statuses (for targeted notifications)
DROP POLICY IF EXISTS "Admins can view all statuses" ON user_statuses;
CREATE POLICY "Admins can view all statuses"
ON user_statuses FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE id = auth.uid() AND role = 'admin'
));

-- Service account can insert/update statuses (via functions)
DROP POLICY IF EXISTS "Service can manage statuses" ON user_statuses;
CREATE POLICY "Service can manage statuses"
ON user_statuses FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ==========================================
-- 6. GRANT PERMISSIONS
-- ==========================================

GRANT ALL ON user_statuses TO authenticated;
GRANT EXECUTE ON FUNCTION add_user_status TO authenticated;
GRANT EXECUTE ON FUNCTION remove_user_status TO authenticated;
GRANT EXECUTE ON FUNCTION has_user_status TO authenticated;
GRANT EXECUTE ON FUNCTION get_users_with_status TO authenticated;
GRANT EXECUTE ON FUNCTION process_referral_signup TO authenticated;
