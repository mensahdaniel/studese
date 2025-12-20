-- Migration: Add canvas_state column to notes table
-- This stores the full canvas state (strokes, template, background) for the custom drawing canvas

-- Add canvas_state column as JSONB to store the drawing data
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS canvas_state JSONB;

-- Add updated_at column if it doesn't exist
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create an index on updated_at for faster sorting
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);

-- Create a trigger to automatically update updated_at on row update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_notes_updated_at ON notes;

CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comment on the new column
COMMENT ON COLUMN notes.canvas_state IS 'Stores the full canvas state including strokes, template, and background for the drawing canvas';
