-- ============================================
-- AGGRESSIVE FIX: Complete reset of notification RLS policies
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Temporarily disable RLS to clean up
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL policies on notifications table
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'notifications' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON notifications', pol.policyname);
    END LOOP;
END $$;

-- Step 3: Re-enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Step 4: Create fresh policies with explicit role targeting

-- INSERT: Allow any authenticated user to create notifications for ANY user
-- This is required for sharing features
CREATE POLICY "notifications_insert_policy"
    ON notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Also allow anon to insert (for edge functions using anon key)
CREATE POLICY "notifications_insert_anon_policy"
    ON notifications
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- SELECT: Users can only view their own notifications
CREATE POLICY "notifications_select_policy"
    ON notifications
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- UPDATE: Users can only update their own notifications
CREATE POLICY "notifications_update_policy"
    ON notifications
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can only delete their own notifications
CREATE POLICY "notifications_delete_policy"
    ON notifications
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Step 5: Grant table permissions to roles
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;
GRANT INSERT ON notifications TO anon;

-- Step 6: Create the secure email lookup function
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(lookup_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    found_user_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT id INTO found_user_id
    FROM profiles
    WHERE LOWER(email) = LOWER(lookup_email)
    LIMIT 1;

    RETURN found_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) TO anon;

-- Step 7: Sync profile emails from auth.users
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.email = '');

-- Step 8: Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON profiles(LOWER(email));

-- Step 9: Create RPC function to insert notifications (BYPASSES RLS)
-- This is the most reliable way to create notifications for other users
CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT DEFAULT NULL,
    p_data JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    notification_id UUID;
BEGIN
    -- Only allow authenticated users to call this function
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Insert the notification
    INSERT INTO notifications (user_id, type, title, message, data, is_read, created_at)
    VALUES (p_user_id, p_type, p_title, p_message, p_data, false, NOW())
    RETURNING id INTO notification_id;

    RETURN notification_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, TEXT, TEXT, TEXT, JSONB) TO anon;

COMMENT ON FUNCTION public.create_notification IS 'Creates a notification for any user (bypasses RLS). Used for sharing features.';

-- ============================================
-- VERIFICATION: Run this after the migration
-- ============================================
-- SELECT policyname, cmd, permissive, roles, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'notifications';

-- Expected output:
-- notifications_insert_policy      | INSERT | PERMISSIVE | {authenticated} | null | true
-- notifications_insert_anon_policy | INSERT | PERMISSIVE | {anon}          | null | true
-- notifications_select_policy      | SELECT | PERMISSIVE | {authenticated} | (auth.uid() = user_id) | null
-- notifications_update_policy      | UPDATE | PERMISSIVE | {authenticated} | (auth.uid() = user_id) | (auth.uid() = user_id)
-- notifications_delete_policy      | DELETE | PERMISSIVE | {authenticated} | (auth.uid() = user_id) | null

-- ============================================
-- Step 10: Fix notes table RLS for shared notes access
-- ============================================

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can view shared notes" ON notes;
DROP POLICY IF EXISTS "Users can view own notes" ON notes;
DROP POLICY IF EXISTS "notes_select_policy" ON notes;

-- Create comprehensive SELECT policy for notes
-- Users can view notes they own OR notes shared with them
CREATE POLICY "notes_select_policy"
    ON notes
    FOR SELECT
    TO authenticated
    USING (
        -- User owns the note
        auth.uid() = user_id
        OR
        -- Note is public
        is_public = TRUE
        OR
        -- Note has link access
        link_access IN ('anyone_with_link', 'public')
        OR
        -- Note is shared with this user (by user ID or email)
        EXISTS (
            SELECT 1 FROM note_shares
            WHERE note_shares.note_id = notes.id
            AND (
                note_shares.shared_with = auth.uid()
                OR note_shares.shared_with_email = (SELECT email FROM auth.users WHERE id = auth.uid())
            )
        )
    );

-- Also fix note_shares RLS to allow users to see shares for their email
DROP POLICY IF EXISTS "Users can view note shares" ON note_shares;
DROP POLICY IF EXISTS "note_shares_select_policy" ON note_shares;

CREATE POLICY "note_shares_select_policy"
    ON note_shares
    FOR SELECT
    TO authenticated
    USING (
        -- User created the share
        shared_by = auth.uid()
        OR
        -- Share is for this user
        shared_with = auth.uid()
        OR
        -- Share is for this user's email
        shared_with_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Verify notes policies
-- SELECT policyname, cmd, roles, qual FROM pg_policies WHERE tablename = 'notes';
-- SELECT policyname, cmd, roles, qual FROM pg_policies WHERE tablename = 'note_shares';
