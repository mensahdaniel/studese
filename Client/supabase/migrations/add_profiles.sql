-- Migration: Add profiles table
-- This table stores user profile information and payment status
-- Required for the paywall-first model

-- ============================================
-- 1. Create profiles table
-- ============================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  is_paid BOOLEAN DEFAULT FALSE,
  subscription_status TEXT DEFAULT 'inactive', -- 'inactive', 'active', 'cancelled', 'past_due'
  subscription_id TEXT, -- Stripe subscription ID
  customer_id TEXT, -- Stripe customer ID
  subscription_started_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_customer_id ON profiles(customer_id);

-- ============================================
-- 2. Enable Row Level Security
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. RLS Policies
-- ============================================

-- Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow inserts during signup (service role or the user themselves)
DROP POLICY IF EXISTS "Allow profile creation during signup" ON profiles;
CREATE POLICY "Allow profile creation during signup" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);

-- Service role can do anything (for webhooks, admin operations)
DROP POLICY IF EXISTS "Service role has full access" ON profiles;
CREATE POLICY "Service role has full access" ON profiles
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ============================================
-- 4. Trigger function to create profile on signup
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, full_name, is_paid)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'username', ''),
    FALSE
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- ============================================
-- 5. Create trigger on auth.users
-- ============================================

-- Drop existing trigger if it exists (to avoid conflicts)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 6. Function to update updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- ============================================
-- 7. Backfill existing users (if any)
-- ============================================

-- Insert profiles for any existing users who don't have one
INSERT INTO profiles (id, email, username, is_paid)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1)),
  FALSE
FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 8. Add helpful comments
-- ============================================

COMMENT ON TABLE profiles IS 'User profiles with subscription/payment information';
COMMENT ON COLUMN profiles.is_paid IS 'Whether user has an active paid subscription';
COMMENT ON COLUMN profiles.subscription_status IS 'Current subscription status: inactive, active, cancelled, past_due';
COMMENT ON COLUMN profiles.customer_id IS 'Stripe customer ID for payment processing';
COMMENT ON COLUMN profiles.subscription_id IS 'Stripe subscription ID';
