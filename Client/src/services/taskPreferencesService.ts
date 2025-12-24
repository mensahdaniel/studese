/**
 * Task Preferences Service
 *
 * Manages user preferences for task management including:
 * - Quiet Hours / Do Not Disturb
 * - Snooze functionality
 * - Default reminder settings
 * - Notification preferences
 */

import { supabase } from "@/utils/supabase";
import type { UserPreferences, UserPreferencesUpdate, SnoozedReminder, Task } from "@/types/tasks";
import { SNOOZE_OPTIONS } from "@/types/tasks";

// ============================================
// Types
// ============================================

export interface QuietHoursStatus {
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  nextActiveIn: number | null; // minutes until quiet hours start
  nextEndIn: number | null; // minutes until quiet hours end
}

// Default preferences when none exist
const DEFAULT_PREFERENCES: Omit<UserPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00:00',
  quiet_hours_end: '07:00:00',
  quiet_hours_days: [0, 1, 2, 3, 4, 5, 6],
  default_reminder_minutes: [15],
  pomodoro_work_minutes: 25,
  pomodoro_short_break_minutes: 5,
  pomodoro_long_break_minutes: 15,
  pomodoro_sessions_before_long_break: 4,
  notification_sound_enabled: true,
  notification_vibration_enabled: true,
  batch_notifications: false,
  default_task_view: 'list',
  show_completed_tasks: true,
};

// ============================================
// User Preferences Service
// ============================================

class TaskPreferencesService {
  private userId: string | null = null;
  private preferences: UserPreferences | null = null;
  private listeners: Set<(prefs: UserPreferences) => void> = new Set();

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      this.userId = user.id;
      await this.loadPreferences();
    }
  }

  /**
   * Load user preferences from database
   */
  async loadPreferences(): Promise<UserPreferences | null> {
    if (!this.userId) return null;

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // No preferences found, create default
        return await this.createDefaultPreferences();
      }

      // Handle missing table (406 error)
      if (error && (error.code === '42P01' || error.message?.includes('406') || error.message?.includes('does not exist'))) {
        console.warn('User preferences table not available yet. Run the database migration.');
        return null;
      }

      if (error) throw error;

      this.preferences = data;
      return data;
    } catch (error: unknown) {
      // Also catch 406 errors here
      const err = error as { message?: string; code?: string };
      if (err?.message?.includes('406') || err?.code === '42P01') {
        console.warn('User preferences table not available yet. Run the database migration.');
        return null;
      }
      console.error('Error loading preferences:', error);
      return null;
    }
  }

  /**
   * Create default preferences for a user
   */
  private async createDefaultPreferences(): Promise<UserPreferences | null> {
    if (!this.userId) return null;

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .insert({
          user_id: this.userId,
          ...DEFAULT_PREFERENCES,
        })
        .select()
        .single();

      // Handle missing table
      if (error && (error.code === '42P01' || error.message?.includes('406') || error.message?.includes('does not exist'))) {
        console.warn('User preferences table not available yet. Run the database migration.');
        return null;
      }

      if (error) throw error;

      this.preferences = data;
      return data;
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      if (err?.message?.includes('406') || err?.code === '42P01') {
        console.warn('User preferences table not available yet. Run the database migration.');
        return null;
      }
      console.error('Error creating default preferences:', error);
      return null;
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(updates: UserPreferencesUpdate): Promise<UserPreferences | null> {
    if (!this.userId) return null;

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .update(updates)
        .eq('user_id', this.userId)
        .select()
        .single();

      if (error) throw error;

      this.preferences = data;
      this.notifyListeners();
      return data;
    } catch (error) {
      console.error('Error updating preferences:', error);
      return null;
    }
  }

  /**
   * Get current preferences
   */
  getPreferences(): UserPreferences | null {
    return this.preferences;
  }

  /**
   * Subscribe to preference changes
   */
  subscribe(listener: (prefs: UserPreferences) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    if (this.preferences) {
      this.listeners.forEach((listener) => listener(this.preferences!));
    }
  }

  // ============================================
  // Quiet Hours
  // ============================================

  /**
   * Check if currently in quiet hours
   */
  isInQuietHours(): boolean {
    if (!this.preferences?.quiet_hours_enabled) return false;

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 8); // "HH:MM:SS"
    const currentDay = now.getDay(); // 0-6

    // Check if current day is in quiet hours days
    if (!this.preferences.quiet_hours_days.includes(currentDay)) {
      return false;
    }

    const start = this.preferences.quiet_hours_start;
    const end = this.preferences.quiet_hours_end;

    // Handle overnight quiet hours (e.g., 22:00 to 07:00)
    if (start > end) {
      return currentTime >= start || currentTime < end;
    } else {
      return currentTime >= start && currentTime < end;
    }
  }

  /**
   * Get detailed quiet hours status
   */
  getQuietHoursStatus(): QuietHoursStatus {
    if (!this.preferences?.quiet_hours_enabled) {
      return {
        isActive: false,
        startsAt: null,
        endsAt: null,
        nextActiveIn: null,
        nextEndIn: null,
      };
    }

    const isActive = this.isInQuietHours();
    const start = this.preferences.quiet_hours_start;
    const end = this.preferences.quiet_hours_end;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const startParts = start.split(':').map(Number);
    const endParts = end.split(':').map(Number);
    const startMinutes = startParts[0] * 60 + startParts[1];
    const endMinutes = endParts[0] * 60 + endParts[1];

    let nextActiveIn: number | null = null;
    let nextEndIn: number | null = null;

    if (isActive) {
      // Calculate when quiet hours will end
      if (startMinutes > endMinutes) {
        // Overnight
        if (currentMinutes >= startMinutes) {
          nextEndIn = (24 * 60 - currentMinutes) + endMinutes;
        } else {
          nextEndIn = endMinutes - currentMinutes;
        }
      } else {
        nextEndIn = endMinutes - currentMinutes;
      }
    } else {
      // Calculate when quiet hours will start
      if (startMinutes > currentMinutes) {
        nextActiveIn = startMinutes - currentMinutes;
      } else {
        nextActiveIn = (24 * 60 - currentMinutes) + startMinutes;
      }
    }

    return {
      isActive,
      startsAt: start,
      endsAt: end,
      nextActiveIn,
      nextEndIn,
    };
  }

  /**
   * Enable quiet hours
   */
  async enableQuietHours(start?: string, end?: string, days?: number[]): Promise<void> {
    const updates: UserPreferencesUpdate = {
      quiet_hours_enabled: true,
    };

    if (start) updates.quiet_hours_start = start;
    if (end) updates.quiet_hours_end = end;
    if (days) updates.quiet_hours_days = days;

    await this.updatePreferences(updates);
  }

  /**
   * Disable quiet hours
   */
  async disableQuietHours(): Promise<void> {
    await this.updatePreferences({ quiet_hours_enabled: false });
  }

  // ============================================
  // Snooze Functions
  // ============================================

  /**
   * Snooze a task reminder
   */
  async snoozeTask(
    taskId: string,
    durationMinutes: number,
    reminderStage: number = 0
  ): Promise<{ success: boolean; snoozeUntil: Date | null }> {
    if (!this.userId) {
      return { success: false, snoozeUntil: null };
    }

    try {
      const snoozeUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

      // Update task's snoozed_until
      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          snoozed_until: snoozeUntil.toISOString(),
          snooze_count: supabase.rpc ? undefined : 1, // Increment handled separately
        })
        .eq('id', taskId);

      if (taskError) throw taskError;

      // Increment snooze count (ignore errors if RPC doesn't exist)
      try {
        await supabase.rpc('increment_snooze_count', { task_id: taskId });
      } catch {
        // RPC might not exist, that's okay
      }

      // Create snooze record for tracking (ignore if table doesn't exist)
      try {
        await supabase.from('snoozed_reminders').insert({
          task_id: taskId,
          user_id: this.userId,
          snooze_until: snoozeUntil.toISOString(),
          snooze_duration_minutes: durationMinutes,
          original_reminder_stage: reminderStage,
        });
      } catch {
        // Table might not exist yet - that's okay, the task snoozed_until is set
        console.warn('snoozed_reminders table not available. Run the database migration.');
      }

      return { success: true, snoozeUntil };
    } catch (error) {
      console.error('Error snoozing task:', error);
      return { success: false, snoozeUntil: null };
    }
  }

  /**
   * Snooze until tomorrow at 9 AM
   */
  async snoozeUntilTomorrow(taskId: string, reminderStage: number = 0): Promise<{ success: boolean; snoozeUntil: Date | null }> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    const durationMinutes = Math.floor((tomorrow.getTime() - Date.now()) / 60000);

    return this.snoozeTask(taskId, durationMinutes, reminderStage);
  }

  /**
   * Clear snooze from a task
   */
  async clearSnooze(taskId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ snoozed_until: null, snooze_count: 0 })
        .eq('id', taskId);

      if (error) throw error;

      // Mark any pending snoozed reminders as processed
      await supabase
        .from('snoozed_reminders')
        .update({ is_processed: true, processed_at: new Date().toISOString() })
        .eq('task_id', taskId)
        .eq('is_processed', false);

      return true;
    } catch (error) {
      console.error('Error clearing snooze:', error);
      return false;
    }
  }

  /**
   * Check if a task is currently snoozed
   */
  isTaskSnoozed(task: Task): boolean {
    if (!task.snoozed_until) return false;
    return new Date(task.snoozed_until) > new Date();
  }

  /**
   * Get time remaining on snooze
   */
  getSnoozeTimeRemaining(task: Task): number | null {
    if (!task.snoozed_until) return null;
    const remaining = new Date(task.snoozed_until).getTime() - Date.now();
    return remaining > 0 ? Math.floor(remaining / 60000) : null;
  }

  /**
   * Get pending snoozed reminders that should fire now
   */
  async getPendingSnoozedReminders(): Promise<SnoozedReminder[]> {
    if (!this.userId) return [];

    try {
      const { data, error } = await supabase
        .from('snoozed_reminders')
        .select('*')
        .eq('user_id', this.userId)
        .eq('is_processed', false)
        .lte('snooze_until', new Date().toISOString());

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting pending snoozed reminders:', error);
      return [];
    }
  }

  /**
   * Mark a snoozed reminder as processed
   */
  async markSnoozedReminderProcessed(reminderId: string): Promise<void> {
    try {
      await supabase
        .from('snoozed_reminders')
        .update({
          is_processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq('id', reminderId);
    } catch (error) {
      console.error('Error marking snoozed reminder processed:', error);
    }
  }

  // ============================================
  // Default Reminder Settings
  // ============================================

  /**
   * Get default reminder minutes for new tasks
   */
  getDefaultReminderMinutes(): number[] {
    return this.preferences?.default_reminder_minutes || [15];
  }

  /**
   * Update default reminder settings
   */
  async setDefaultReminderMinutes(minutes: number[]): Promise<void> {
    await this.updatePreferences({ default_reminder_minutes: minutes });
  }

  // ============================================
  // Notification Preferences
  // ============================================

  /**
   * Check if sounds are enabled
   */
  isSoundEnabled(): boolean {
    return this.preferences?.notification_sound_enabled ?? true;
  }

  /**
   * Check if vibration is enabled
   */
  isVibrationEnabled(): boolean {
    return this.preferences?.notification_vibration_enabled ?? true;
  }

  /**
   * Check if batch notifications are enabled
   */
  isBatchNotificationsEnabled(): boolean {
    return this.preferences?.batch_notifications ?? false;
  }

  /**
   * Toggle sound notifications
   */
  async toggleSound(enabled: boolean): Promise<void> {
    await this.updatePreferences({ notification_sound_enabled: enabled });
  }

  /**
   * Toggle vibration
   */
  async toggleVibration(enabled: boolean): Promise<void> {
    await this.updatePreferences({ notification_vibration_enabled: enabled });
  }

  // ============================================
  // Pomodoro Settings
  // ============================================

  /**
   * Get Pomodoro settings
   */
  getPomodoroSettings(): {
    workMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
    sessionsBeforeLongBreak: number;
  } {
    return {
      workMinutes: this.preferences?.pomodoro_work_minutes ?? 25,
      shortBreakMinutes: this.preferences?.pomodoro_short_break_minutes ?? 5,
      longBreakMinutes: this.preferences?.pomodoro_long_break_minutes ?? 15,
      sessionsBeforeLongBreak: this.preferences?.pomodoro_sessions_before_long_break ?? 4,
    };
  }

  /**
   * Update Pomodoro settings
   */
  async updatePomodoroSettings(settings: {
    workMinutes?: number;
    shortBreakMinutes?: number;
    longBreakMinutes?: number;
    sessionsBeforeLongBreak?: number;
  }): Promise<void> {
    const updates: UserPreferencesUpdate = {};

    if (settings.workMinutes !== undefined) {
      updates.pomodoro_work_minutes = settings.workMinutes;
    }
    if (settings.shortBreakMinutes !== undefined) {
      updates.pomodoro_short_break_minutes = settings.shortBreakMinutes;
    }
    if (settings.longBreakMinutes !== undefined) {
      updates.pomodoro_long_break_minutes = settings.longBreakMinutes;
    }
    if (settings.sessionsBeforeLongBreak !== undefined) {
      updates.pomodoro_sessions_before_long_break = settings.sessionsBeforeLongBreak;
    }

    await this.updatePreferences(updates);
  }

  // ============================================
  // UI Preferences
  // ============================================

  /**
   * Get default task view
   */
  getDefaultTaskView(): 'list' | 'grid' | 'kanban' {
    return this.preferences?.default_task_view ?? 'list';
  }

  /**
   * Set default task view
   */
  async setDefaultTaskView(view: 'list' | 'grid' | 'kanban'): Promise<void> {
    await this.updatePreferences({ default_task_view: view });
  }

  /**
   * Check if completed tasks should be shown
   */
  shouldShowCompletedTasks(): boolean {
    return this.preferences?.show_completed_tasks ?? true;
  }

  /**
   * Toggle showing completed tasks
   */
  async toggleShowCompletedTasks(show: boolean): Promise<void> {
    await this.updatePreferences({ show_completed_tasks: show });
  }
}

// ============================================
// Singleton Export
// ============================================

export const taskPreferencesService = new TaskPreferencesService();

// Helper exports
export const initTaskPreferences = () => taskPreferencesService.initialize();
export const getPreferences = () => taskPreferencesService.getPreferences();
export const isInQuietHours = () => taskPreferencesService.isInQuietHours();
export const snoozeTask = (taskId: string, minutes: number, stage?: number) =>
  taskPreferencesService.snoozeTask(taskId, minutes, stage);
export const snoozeUntilTomorrow = (taskId: string, stage?: number) =>
  taskPreferencesService.snoozeUntilTomorrow(taskId, stage);

export default taskPreferencesService;
