-- Migration: Add notifications table for in-app notifications
-- This provides a free alternative to email notifications for sharing

-- Drop table if exists to recreate cleanly
DROP TABLE IF EXISTS notifications CASCADE;

-- Create notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The user who receives the notification
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Notification type (note_share, reminder, system, etc.)
    type TEXT NOT NULL DEFAULT 'system',

    -- Notification content
    title TEXT NOT NULL,
    message TEXT,

    -- Additional data as JSON (note_id, share_id, etc.)
    data JSONB DEFAULT '{}',

    -- Read status (using is_read to avoid reserved keyword)
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraint for valid types
    CONSTRAINT valid_type CHECK (type IN ('note_share', 'reminder', 'system', 'task', 'event'))
);

-- Create indexes for fast lookups
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type);

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
    ON notifications FOR DELETE
    USING (auth.uid() = user_id);

-- Allow service role to insert notifications (for edge functions)
CREATE POLICY "Service role can insert notifications"
    ON notifications FOR INSERT
    WITH CHECK (true);

-- Also add email_sent column to note_shares if not exists
ALTER TABLE note_shares
ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE;

-- Create a function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    count_result INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER INTO count_result
    FROM notifications
    WHERE user_id = p_user_id AND is_read = FALSE;

    RETURN count_result;
END;
$function$;

-- Create a function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    UPDATE notifications
    SET is_read = TRUE, read_at = NOW()
    WHERE user_id = p_user_id AND is_read = FALSE;
END;
$function$;

-- Add comments for documentation
COMMENT ON TABLE notifications IS 'Stores in-app notifications for users (free alternative to email)';
COMMENT ON COLUMN notifications.type IS 'Type of notification: note_share, reminder, system, task, event';
COMMENT ON COLUMN notifications.data IS 'JSON data with additional context (note_id, share_id, etc.)';
COMMENT ON COLUMN notifications.is_read IS 'Whether the notification has been read by the user';
