-- Referral and Club Promo Systems Setup
-- Run this in your Supabase SQL Editor

-- ==========================================
-- 1. REFERRAL SYSTEM TABLES
-- ==========================================

-- User referral codes table
CREATE TABLE IF NOT EXISTS user_referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code VARCHAR(10) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON user_referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON user_referral_codes(referral_code);

-- Referral usage tracking
CREATE TABLE IF NOT EXISTS referral_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code VARCHAR(10) NOT NULL,
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  referrer_rewarded BOOLEAN DEFAULT FALSE,
  referee_rewarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_usage_referrer ON referral_usage(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_usage_referee ON referral_usage(referee_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_usage_code ON referral_usage(referral_code);

-- ==========================================
-- 2. CLUB SUPPORT TABLES
-- ==========================================

-- Clubs master table
CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_code VARCHAR(4) NOT NULL UNIQUE,
  club_name VARCHAR(255) NOT NULL,
  commission_percentage DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  total_earned DECIMAL(10,2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_payout_date TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_clubs_code ON clubs(club_code);
CREATE INDEX IF NOT EXISTS idx_clubs_active ON clubs(is_active);

-- Club order tracking
CREATE TABLE IF NOT EXISTS club_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_total DECIMAL(10,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  commission_percentage DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_out BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_club_orders_club ON club_orders(club_id);
CREATE INDEX IF NOT EXISTS idx_club_orders_order ON club_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_club_orders_paid ON club_orders(paid_out);

-- ==========================================
-- 3. ROW LEVEL SECURITY POLICIES
-- ==========================================

-- User referral codes - users can view their own
ALTER TABLE user_referral_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own referral code" ON user_referral_codes;
CREATE POLICY "Users can view their own referral code"
ON user_referral_codes FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own referral code" ON user_referral_codes;
CREATE POLICY "Users can insert their own referral code"
ON user_referral_codes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Referral usage - users can view their own stats
ALTER TABLE referral_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their referral stats" ON referral_usage;
CREATE POLICY "Users can view their referral stats"
ON referral_usage FOR SELECT
TO authenticated
USING (auth.uid() = referrer_user_id OR auth.uid() = referee_user_id);

DROP POLICY IF EXISTS "Users can create referral usage" ON referral_usage;
CREATE POLICY "Users can create referral usage"
ON referral_usage FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = referee_user_id);

DROP POLICY IF EXISTS "Users can update their referral rewards" ON referral_usage;
CREATE POLICY "Users can update their referral rewards"
ON referral_usage FOR UPDATE
TO authenticated
USING (auth.uid() = referrer_user_id OR auth.uid() = referee_user_id);

-- Clubs - public read for active clubs
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active clubs" ON clubs;
CREATE POLICY "Anyone can view active clubs"
ON clubs FOR SELECT
TO public
USING (is_active = true);

-- Admins can manage clubs
DROP POLICY IF EXISTS "Admins can manage clubs" ON clubs;
CREATE POLICY "Admins can manage clubs"
ON clubs FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Club orders - admins only
ALTER TABLE club_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view club orders" ON club_orders;
CREATE POLICY "Admins can view club orders"
ON club_orders FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Authenticated can insert club orders" ON club_orders;
CREATE POLICY "Authenticated can insert club orders"
ON club_orders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update club orders" ON club_orders;
CREATE POLICY "Admins can update club orders"
ON club_orders FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ==========================================
-- 4. DATABASE FUNCTIONS
-- ==========================================

-- Function to automatically generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  done BOOLEAN := FALSE;
BEGIN
  WHILE NOT done LOOP
    code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    IF NOT EXISTS (SELECT 1 FROM user_referral_codes WHERE referral_code = code) THEN
      done := TRUE;
    END IF;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to update club total earned
CREATE OR REPLACE FUNCTION update_club_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE clubs
  SET total_earned = total_earned + NEW.commission_amount
  WHERE id = NEW.club_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_club_total_trigger ON club_orders;
CREATE TRIGGER update_club_total_trigger
AFTER INSERT ON club_orders
FOR EACH ROW
EXECUTE FUNCTION update_club_total();

-- ==========================================
-- 5. GRANT PERMISSIONS
-- ==========================================

GRANT ALL ON user_referral_codes TO authenticated;
GRANT ALL ON referral_usage TO authenticated;
GRANT ALL ON clubs TO authenticated;
GRANT ALL ON club_orders TO authenticated;

-- ==========================================
-- 6. SAMPLE DATA (Optional - for testing)
-- ==========================================

-- Uncomment to add sample clubs for testing:
-- INSERT INTO clubs (club_code, club_name, commission_percentage, is_active) VALUES
-- ('EWB', 'Engineers Without Borders', 15.00, true),
-- ('ACM', 'Association for Computing Machinery', 10.00, true),
-- ('IEEE', 'IEEE Student Branch', 12.00, true)
-- ON CONFLICT (club_code) DO NOTHING;



