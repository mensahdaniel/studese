-- Migration: Add note sharing functionality
-- This enables Google Docs-like sharing with public links, email invites, and user sharing

-- Create enum for share permission levels
DO $$ BEGIN
    CREATE TYPE share_permission AS ENUM ('view', 'edit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for share link access types
DO $$ BEGIN
    CREATE TYPE link_access AS ENUM ('private', 'anyone_with_link', 'public');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add sharing columns to notes table
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS public_link_id UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS link_access link_access DEFAULT 'private',
ADD COLUMN IF NOT EXISTS link_permission share_permission DEFAULT 'view';

-- Create unique index on public_link_id for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_notes_public_link_id ON notes(public_link_id);

-- Create index on is_public for filtering public notes
CREATE INDEX IF NOT EXISTS idx_notes_is_public ON notes(is_public) WHERE is_public = TRUE;

-- Create table for individual user shares (like Google Docs sharing with specific people)
CREATE TABLE IF NOT EXISTS note_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,

    -- The user who shared the note (owner)
    shared_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- The user the note is shared with (can be null if sharing by email to non-user)
    shared_with UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Email for invites to non-users (they can claim access when they sign up)
    shared_with_email TEXT,

    -- Permission level
    permission share_permission NOT NULL DEFAULT 'view',

    -- Invite status
    invite_accepted BOOLEAN DEFAULT FALSE,
    invite_token UUID DEFAULT gen_random_uuid(),
    invite_sent_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure either shared_with or shared_with_email is set
    CONSTRAINT shared_with_check CHECK (
        shared_with IS NOT NULL OR shared_with_email IS NOT NULL
    ),

    -- Prevent duplicate shares
    CONSTRAINT unique_user_share UNIQUE (note_id, shared_with),
    CONSTRAINT unique_email_share UNIQUE (note_id, shared_with_email)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_note_shares_note_id ON note_shares(note_id);
CREATE INDEX IF NOT EXISTS idx_note_shares_shared_with ON note_shares(shared_with);
CREATE INDEX IF NOT EXISTS idx_note_shares_shared_with_email ON note_shares(shared_with_email);
CREATE INDEX IF NOT EXISTS idx_note_shares_invite_token ON note_shares(invite_token);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_note_shares_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS update_note_shares_updated_at ON note_shares;

CREATE TRIGGER update_note_shares_updated_at
    BEFORE UPDATE ON note_shares
    FOR EACH ROW
    EXECUTE FUNCTION update_note_shares_updated_at();

-- RLS Policies for notes table (drop existing and recreate)

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view shared notes" ON notes;
DROP POLICY IF EXISTS "Users can edit shared notes with permission" ON notes;

-- Allow users to view notes that are shared with them
CREATE POLICY "Users can view shared notes"
    ON notes FOR SELECT
    USING (
        -- User owns the note
        auth.uid() = user_id
        OR
        -- Note is public or has public link access
        is_public = TRUE
        OR
        link_access = 'anyone_with_link'
        OR
        link_access = 'public'
        OR
        -- Note is shared with user
        EXISTS (
            SELECT 1 FROM note_shares
            WHERE note_shares.note_id = notes.id
            AND (
                note_shares.shared_with = auth.uid()
                OR note_shares.shared_with_email = auth.email()
            )
        )
    );

-- Allow users to update notes they own or have edit permission
CREATE POLICY "Users can edit shared notes with permission"
    ON notes FOR UPDATE
    USING (
        -- User owns the note
        auth.uid() = user_id
        OR
        -- Note is shared with edit permission
        EXISTS (
            SELECT 1 FROM note_shares
            WHERE note_shares.note_id = notes.id
            AND note_shares.permission = 'edit'
            AND (
                note_shares.shared_with = auth.uid()
                OR note_shares.shared_with_email = auth.email()
            )
        )
        OR
        -- Note has public link with edit permission
        (link_access IN ('anyone_with_link', 'public') AND link_permission = 'edit')
    );

-- RLS Policies for note_shares table

ALTER TABLE note_shares ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view note shares" ON note_shares;
DROP POLICY IF EXISTS "Note owners can create shares" ON note_shares;
DROP POLICY IF EXISTS "Note owners can update shares" ON note_shares;
DROP POLICY IF EXISTS "Note owners can delete shares" ON note_shares;

-- Users can view shares for notes they own or are shared with them
CREATE POLICY "Users can view note shares"
    ON note_shares FOR SELECT
    USING (
        shared_by = auth.uid()
        OR shared_with = auth.uid()
        OR shared_with_email = auth.email()
    );

-- Only note owners can create shares
CREATE POLICY "Note owners can create shares"
    ON note_shares FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM notes
            WHERE notes.id = note_id
            AND notes.user_id = auth.uid()
        )
    );

-- Only note owners can update shares
CREATE POLICY "Note owners can update shares"
    ON note_shares FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM notes
            WHERE notes.id = note_id
            AND notes.user_id = auth.uid()
        )
    );

-- Only note owners can delete shares
CREATE POLICY "Note owners can delete shares"
    ON note_shares FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM notes
            WHERE notes.id = note_id
            AND notes.user_id = auth.uid()
        )
    );

-- Function to claim email invites when a user signs up
CREATE OR REPLACE FUNCTION claim_note_invites()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- Update any pending invites for this email to use the user ID
    UPDATE note_shares
    SET
        shared_with = NEW.id,
        invite_accepted = TRUE,
        updated_at = NOW()
    WHERE
        shared_with_email = NEW.email
        AND shared_with IS NULL;

    RETURN NEW;
END;
$function$;

-- Trigger to claim invites on user creation
DROP TRIGGER IF EXISTS claim_note_invites_on_signup ON auth.users;

CREATE TRIGGER claim_note_invites_on_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION claim_note_invites();

-- Add comment for documentation
COMMENT ON TABLE note_shares IS 'Stores sharing permissions for notes, enabling Google Docs-like collaboration';
COMMENT ON COLUMN notes.is_public IS 'Whether the note is publicly discoverable';
COMMENT ON COLUMN notes.public_link_id IS 'UUID for public/shareable link access';
COMMENT ON COLUMN notes.link_access IS 'Access level for the shareable link: private, anyone_with_link, or public';
COMMENT ON COLUMN notes.link_permission IS 'Permission level for link access: view or edit';
