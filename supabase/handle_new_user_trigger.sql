-- Function to handle new user creation ONLY after email confirmation
-- This function runs with SECURITY DEFINER to bypass RLS policies
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

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users table (fires on INSERT and UPDATE)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated;
