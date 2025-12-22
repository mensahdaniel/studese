-- Migration: Enhanced Task Features
-- Adds support for: recurring tasks, subtasks, time tracking, dependencies, snooze, and quiet hours
-- This migration is idempotent (safe to run multiple times)

-- ============================================
-- 1. Add new columns to tasks table
-- ============================================

-- Recurrence fields
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_type TEXT; -- 'daily', 'weekly', 'monthly', 'yearly', 'custom'
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_interval INTEGER DEFAULT 1; -- every N days/weeks/months
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_days INTEGER[]; -- for weekly: [0,1,2,3,4,5,6] (Sun=0, Sat=6)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_end_date TIMESTAMPTZ; -- when recurrence ends (null = forever)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL; -- links recurring instances to parent
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_count INTEGER DEFAULT 0; -- how many times this has recurred

-- Snooze fields
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ; -- when snooze expires
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS snooze_count INTEGER DEFAULT 0; -- how many times snoozed
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ; -- when last reminder was sent

-- Pre-due reminders (minutes before due date to remind)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_minutes_before INTEGER[] DEFAULT ARRAY[15]; -- e.g., [60, 30, 15, 0]

-- Subtasks stored as JSONB array
-- Format: [{ "id": "uuid", "title": "string", "completed": bool, "order": number }]
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]'::jsonb;

-- Time tracking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER; -- estimated time to complete
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS time_spent_minutes INTEGER DEFAULT 0; -- total time spent

-- Dependencies (array of task IDs this task depends on)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS depends_on UUID[] DEFAULT '{}'; -- tasks that must be completed first

-- Notes/comments for the task
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes TEXT;

-- Tags for better organization
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- ============================================
-- 2. Create user_preferences table
-- ============================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,

  -- Quiet Hours / Do Not Disturb
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00:00', -- 10 PM
  quiet_hours_end TIME DEFAULT '07:00:00', -- 7 AM
  quiet_hours_days INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6], -- which days (all by default)

  -- Default reminder settings
  default_reminder_minutes INTEGER[] DEFAULT ARRAY[15], -- default pre-reminders for new tasks

  -- Pomodoro settings
  pomodoro_work_minutes INTEGER DEFAULT 25,
  pomodoro_short_break_minutes INTEGER DEFAULT 5,
  pomodoro_long_break_minutes INTEGER DEFAULT 15,
  pomodoro_sessions_before_long_break INTEGER DEFAULT 4,

  -- Notification preferences
  notification_sound_enabled BOOLEAN DEFAULT true,
  notification_vibration_enabled BOOLEAN DEFAULT true,
  batch_notifications BOOLEAN DEFAULT false, -- group multiple notifications

  -- UI preferences
  default_task_view TEXT DEFAULT 'list', -- 'list', 'grid', 'kanban'
  show_completed_tasks BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then create
DROP POLICY IF EXISTS "Users can view own preferences" ON user_preferences;
CREATE POLICY "Users can view own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON user_preferences;
CREATE POLICY "Users can insert own preferences" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON user_preferences;
CREATE POLICY "Users can update own preferences" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own preferences" ON user_preferences;
CREATE POLICY "Users can delete own preferences" ON user_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 3. Create task_time_entries table for detailed time tracking
-- ============================================

CREATE TABLE IF NOT EXISTS task_time_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Time tracking
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ, -- null if still running
  duration_minutes INTEGER, -- computed when ended

  -- Pomodoro tracking
  is_pomodoro BOOLEAN DEFAULT false,
  pomodoro_type TEXT, -- 'work', 'short_break', 'long_break'

  -- Notes for this session
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on task_time_entries
ALTER TABLE task_time_entries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then create
DROP POLICY IF EXISTS "Users can view own time entries" ON task_time_entries;
CREATE POLICY "Users can view own time entries" ON task_time_entries
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own time entries" ON task_time_entries;
CREATE POLICY "Users can insert own time entries" ON task_time_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own time entries" ON task_time_entries;
CREATE POLICY "Users can update own time entries" ON task_time_entries
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own time entries" ON task_time_entries;
CREATE POLICY "Users can delete own time entries" ON task_time_entries
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 4. Create snoozed_reminders table
-- ============================================

CREATE TABLE IF NOT EXISTS snoozed_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Snooze details
  snoozed_at TIMESTAMPTZ DEFAULT now(),
  snooze_until TIMESTAMPTZ NOT NULL,
  snooze_duration_minutes INTEGER NOT NULL,

  -- Original reminder info
  original_reminder_stage INTEGER DEFAULT 0,

  -- Status
  is_processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on snoozed_reminders
ALTER TABLE snoozed_reminders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then create
DROP POLICY IF EXISTS "Users can view own snoozed reminders" ON snoozed_reminders;
CREATE POLICY "Users can view own snoozed reminders" ON snoozed_reminders
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own snoozed reminders" ON snoozed_reminders;
CREATE POLICY "Users can insert own snoozed reminders" ON snoozed_reminders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own snoozed reminders" ON snoozed_reminders;
CREATE POLICY "Users can update own snoozed reminders" ON snoozed_reminders
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own snoozed reminders" ON snoozed_reminders;
CREATE POLICY "Users can delete own snoozed reminders" ON snoozed_reminders
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 5. Create focus_sessions table for Pomodoro tracking
-- ============================================

CREATE TABLE IF NOT EXISTS focus_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL, -- optional, can focus without a task

  -- Session details
  session_type TEXT NOT NULL DEFAULT 'work', -- 'work', 'short_break', 'long_break'
  planned_duration_minutes INTEGER NOT NULL,
  actual_duration_minutes INTEGER,

  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'in_progress', -- 'in_progress', 'completed', 'interrupted', 'skipped'
  interruption_reason TEXT,

  -- Session number in current set
  session_number INTEGER DEFAULT 1, -- 1, 2, 3, 4 then reset

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on focus_sessions
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then create
DROP POLICY IF EXISTS "Users can view own focus sessions" ON focus_sessions;
CREATE POLICY "Users can view own focus sessions" ON focus_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own focus sessions" ON focus_sessions;
CREATE POLICY "Users can insert own focus sessions" ON focus_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own focus sessions" ON focus_sessions;
CREATE POLICY "Users can update own focus sessions" ON focus_sessions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own focus sessions" ON focus_sessions;
CREATE POLICY "Users can delete own focus sessions" ON focus_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 6. Create indexes for better performance
-- ============================================

-- Tasks indexes
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_snoozed_until ON tasks(snoozed_until) WHERE snoozed_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_is_recurring ON tasks(is_recurring) WHERE is_recurring = true;
CREATE INDEX IF NOT EXISTS idx_tasks_due_date_pending ON tasks(due_date) WHERE completed = false;

-- Time entries indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_task ON task_time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON task_time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_started ON task_time_entries(started_at);

-- Focus sessions indexes
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user ON focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_task ON focus_sessions(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_focus_sessions_status ON focus_sessions(status) WHERE status = 'in_progress';

-- Snoozed reminders indexes
CREATE INDEX IF NOT EXISTS idx_snoozed_reminders_until ON snoozed_reminders(snooze_until) WHERE is_processed = false;

-- ============================================
-- 7. Create function to auto-update updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to user_preferences
DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. Create function to handle recurring task completion
-- ============================================

CREATE OR REPLACE FUNCTION create_next_recurring_task()
RETURNS TRIGGER AS $$
DECLARE
  next_due_date TIMESTAMPTZ;
  new_task_id UUID;
BEGIN
  -- Only process if task is being marked as completed and is recurring
  IF NEW.completed = true AND OLD.completed = false AND NEW.is_recurring = true THEN

    -- Calculate next due date based on recurrence type
    CASE NEW.recurrence_type
      WHEN 'daily' THEN
        next_due_date := NEW.due_date + (NEW.recurrence_interval || ' days')::INTERVAL;
      WHEN 'weekly' THEN
        next_due_date := NEW.due_date + (NEW.recurrence_interval * 7 || ' days')::INTERVAL;
      WHEN 'monthly' THEN
        next_due_date := NEW.due_date + (NEW.recurrence_interval || ' months')::INTERVAL;
      WHEN 'yearly' THEN
        next_due_date := NEW.due_date + (NEW.recurrence_interval || ' years')::INTERVAL;
      ELSE
        -- Custom or unknown, use daily as fallback
        next_due_date := NEW.due_date + (NEW.recurrence_interval || ' days')::INTERVAL;
    END CASE;

    -- Check if we should create next occurrence (not past end date)
    IF NEW.recurrence_end_date IS NULL OR next_due_date <= NEW.recurrence_end_date THEN
      -- Create the next recurring task
      INSERT INTO tasks (
        user_id,
        title,
        description,
        category,
        priority,
        due_date,
        completed,
        is_recurring,
        recurrence_type,
        recurrence_interval,
        recurrence_days,
        recurrence_end_date,
        parent_task_id,
        recurrence_count,
        reminder_minutes_before,
        estimated_minutes,
        tags,
        notes
      ) VALUES (
        NEW.user_id,
        NEW.title,
        NEW.description,
        NEW.category,
        NEW.priority,
        next_due_date,
        false,
        true,
        NEW.recurrence_type,
        NEW.recurrence_interval,
        NEW.recurrence_days,
        NEW.recurrence_end_date,
        COALESCE(NEW.parent_task_id, NEW.id), -- Link to original parent or this task
        NEW.recurrence_count + 1,
        NEW.reminder_minutes_before,
        NEW.estimated_minutes,
        NEW.tags,
        NEW.notes
      ) RETURNING id INTO new_task_id;

      -- Update the completed task to mark it's no longer the active recurring instance
      NEW.is_recurring := false;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger for recurring tasks
DROP TRIGGER IF EXISTS handle_recurring_task_completion ON tasks;
CREATE TRIGGER handle_recurring_task_completion
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION create_next_recurring_task();

-- ============================================
-- 9. Create function to update task time_spent when time entries are added
-- ============================================

CREATE OR REPLACE FUNCTION update_task_time_spent()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the task's total time spent
  UPDATE tasks
  SET time_spent_minutes = (
    SELECT COALESCE(SUM(duration_minutes), 0)
    FROM task_time_entries
    WHERE task_id = COALESCE(NEW.task_id, OLD.task_id)
    AND duration_minutes IS NOT NULL
  )
  WHERE id = COALESCE(NEW.task_id, OLD.task_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger for time entries
DROP TRIGGER IF EXISTS update_task_time_on_entry ON task_time_entries;
CREATE TRIGGER update_task_time_on_entry
  AFTER INSERT OR UPDATE OR DELETE ON task_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_task_time_spent();

-- ============================================
-- 10. Create helper function to check if in quiet hours
-- ============================================

CREATE OR REPLACE FUNCTION is_in_quiet_hours(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  prefs user_preferences%ROWTYPE;
  current_time_val TIME;
  current_day INTEGER;
BEGIN
  -- Get user preferences
  SELECT * INTO prefs FROM user_preferences WHERE user_id = p_user_id;

  -- If no preferences or quiet hours not enabled, return false
  IF prefs IS NULL OR NOT prefs.quiet_hours_enabled THEN
    RETURN false;
  END IF;

  -- Get current time and day
  current_time_val := LOCALTIME;
  current_day := EXTRACT(DOW FROM CURRENT_DATE)::INTEGER;

  -- Check if current day is in quiet hours days
  IF NOT (current_day = ANY(prefs.quiet_hours_days)) THEN
    RETURN false;
  END IF;

  -- Check if current time is within quiet hours
  -- Handle overnight quiet hours (e.g., 22:00 to 07:00)
  IF prefs.quiet_hours_start > prefs.quiet_hours_end THEN
    -- Overnight: quiet if time >= start OR time < end
    RETURN current_time_val >= prefs.quiet_hours_start OR current_time_val < prefs.quiet_hours_end;
  ELSE
    -- Same day: quiet if time >= start AND time < end
    RETURN current_time_val >= prefs.quiet_hours_start AND current_time_val < prefs.quiet_hours_end;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. Create helper function to increment snooze count
-- ============================================

CREATE OR REPLACE FUNCTION increment_snooze_count(p_task_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE tasks
  SET snooze_count = COALESCE(snooze_count, 0) + 1
  WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 12. Grant necessary permissions
-- ============================================

-- Ensure authenticated users can access the new tables
GRANT ALL ON user_preferences TO authenticated;
GRANT ALL ON task_time_entries TO authenticated;
GRANT ALL ON snoozed_reminders TO authenticated;
GRANT ALL ON focus_sessions TO authenticated;

-- Grant usage on sequences if any
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
