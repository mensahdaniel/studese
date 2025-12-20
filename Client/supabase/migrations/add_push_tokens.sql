-- Migration: Add push_tokens table for mobile push notifications
-- This table stores Expo push tokens for each user's devices

-- Create the push_tokens table
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique token per user (a user can have multiple devices)
  UNIQUE(user_id, token)
);

-- Create index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);

-- Create index for active tokens only
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(user_id) WHERE is_active = true;

-- Create index for token lookups (for deduplication)
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);

-- Enable Row Level Security
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own push tokens
CREATE POLICY "Users can view own push tokens"
  ON push_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own push tokens
CREATE POLICY "Users can insert own push tokens"
  ON push_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own push tokens
CREATE POLICY "Users can update own push tokens"
  ON push_tokens
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own push tokens
CREATE POLICY "Users can delete own push tokens"
  ON push_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Service role can access all tokens (for sending notifications)
CREATE POLICY "Service role can access all tokens"
  ON push_tokens
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on changes
DROP TRIGGER IF EXISTS push_tokens_updated_at ON push_tokens;
CREATE TRIGGER push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_push_tokens_updated_at();

-- Function to upsert a push token (insert or update if exists)
CREATE OR REPLACE FUNCTION upsert_push_token(
  p_user_id UUID,
  p_token TEXT,
  p_platform TEXT,
  p_device_name TEXT DEFAULT NULL
)
RETURNS push_tokens AS $$
DECLARE
  result push_tokens;
BEGIN
  INSERT INTO push_tokens (user_id, token, platform, device_name, is_active, last_used_at)
  VALUES (p_user_id, p_token, p_platform, p_device_name, true, NOW())
  ON CONFLICT (user_id, token)
  DO UPDATE SET
    is_active = true,
    device_name = COALESCE(EXCLUDED.device_name, push_tokens.device_name),
    last_used_at = NOW(),
    updated_at = NOW()
  RETURNING * INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all active push tokens for a user
CREATE OR REPLACE FUNCTION get_user_push_tokens(p_user_id UUID)
RETURNS SETOF push_tokens AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM push_tokens
  WHERE user_id = p_user_id AND is_active = true
  ORDER BY last_used_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deactivate old/unused tokens (cleanup)
CREATE OR REPLACE FUNCTION cleanup_old_push_tokens(days_threshold INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM push_tokens
    WHERE last_used_at < NOW() - (days_threshold || ' days')::INTERVAL
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION upsert_push_token TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_push_tokens TO authenticated;
-- cleanup function should only be called by service role or scheduled jobs
