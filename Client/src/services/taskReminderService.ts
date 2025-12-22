/**
 * Global Task Reminder Service with Progressive Overdue Reminders
 *
 * This service runs app-wide to check for due tasks and trigger notifications.
 * It implements a progressive reminder system that escalates notifications
 * for overdue tasks at specific intervals.
 *
 * Features:
 * - Progressive overdue reminders (0, 5, 10, 15 minutes)
 * - Pre-due reminders (configurable minutes before)
 * - Quiet hours respect
 * - Snooze support
 * - Push notifications on mobile
 *
 * Reminder Schedule:
 * - Pre-due: Configurable (e.g., 60, 30, 15, 0 minutes before)
 * - Stage 0: When task becomes due (0 minutes overdue)
 * - Stage 1: 5 minutes overdue
 * - Stage 2: 10 minutes overdue
 * - Stage 3: 15 minutes overdue (final)
 *
 * Each stage triggers:
 * - In-app notification with sound (unless in quiet hours)
 * - Push notification (on mobile)
 * - Database notification record
 */

import { supabase } from "@/utils/supabase";
import { triggerTaskAlarm } from "@/lib/notificationEvents";
import { isNativePlatform, scheduleNotification } from "@/utils/mobile";

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  snoozed_until?: string | null;
  reminder_minutes_before?: number[];
}

// Reminder stages in minutes overdue
const REMINDER_STAGES = [0, 5, 10, 15] as const;
type ReminderStage = (typeof REMINDER_STAGES)[number];

interface ReminderState {
  lastStage: ReminderStage;
  timestamp: number;
  dueDate: string;
}

// Messages for each reminder stage
const REMINDER_MESSAGES: Record<
  ReminderStage,
  { title: string; urgency: string }
> = {
  0: { title: "Task Due Now!", urgency: "normal" },
  5: { title: "Task Overdue!", urgency: "warning" },
  10: { title: "Task Still Overdue!", urgency: "urgent" },
  15: { title: "FINAL REMINDER!", urgency: "critical" },
};

// Pre-reminder state tracking
interface PreReminderState {
  triggeredMinutes: number[]; // Which pre-reminder minutes have been triggered
  timestamp: number;
}

class TaskReminderService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private reminderStates: Map<string, ReminderState> = new Map();
  private preReminderStates: Map<string, PreReminderState> = new Map();
  private isRunning: boolean = false;
  private userId: string | null = null;
  private checkIntervalMs: number = 60000; // 60 seconds for checks (reduced frequency)
  private quietHoursEnabled: boolean = false;
  private quietHoursStart: string = "22:00:00";
  private quietHoursEnd: string = "07:00:00";
  private quietHoursDays: number[] = [0, 1, 2, 3, 4, 5, 6];
  private isChecking: boolean = false; // Prevent concurrent checks
  private lastCheckTime: number = 0; // Debounce checks
  private recentNotifications: Map<string, number> = new Map(); // Track recent notifications to prevent duplicates
  private notificationLock: Set<string> = new Set(); // Lock to prevent concurrent notifications for same task
  private static instanceId: string = Math.random().toString(36).substring(7);

  /**
   * Start the reminder service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("Task reminder service is already running");
      return;
    }

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.log("No user logged in, reminder service not started");
      return;
    }

    this.userId = user.id;
    this.isRunning = true;

    // Load reminder states from localStorage
    this.loadReminderStates();

    // Load quiet hours settings
    await this.loadQuietHoursSettings();

    // Check immediately on start
    await this.checkReminders();

    // Set up interval for periodic checks
    this.intervalId = setInterval(() => {
      this.checkReminders();
    }, this.checkIntervalMs);

    console.log("Task reminder service started with progressive overdue reminders");
  }

  /**
   * Stop the reminder service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.userId = null;
    console.log("Task reminder service stopped");
  }

  /**
   * Load quiet hours settings from user preferences
   */
  private async loadQuietHoursSettings(): Promise<void> {
    if (!this.userId) return;

    try {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_days")
        .eq("user_id", this.userId)
        .maybeSingle(); // Use maybeSingle instead of single to avoid errors when no rows

      // If there's an error (e.g., table doesn't exist), just use defaults
      if (error) {
        // Check if it's a "table doesn't exist" error (code 42P01) or similar
        // These show up as CORS errors in browser but are actually 502/404 errors
        console.log("Could not load quiet hours settings, using defaults:", error.message);
        return;
      }

      if (data) {
        this.quietHoursEnabled = data.quiet_hours_enabled || false;
        this.quietHoursStart = data.quiet_hours_start || "22:00:00";
        this.quietHoursEnd = data.quiet_hours_end || "07:00:00";
        this.quietHoursDays = data.quiet_hours_days || [0, 1, 2, 3, 4, 5, 6];
      }
      // If no data (no row for this user), defaults are already set
    } catch (error) {
      // Network error or table doesn't exist - use defaults silently
      console.log("Quiet hours settings unavailable, using defaults");
    }
  }

  /**
   * Check if currently in quiet hours
   */
  private isInQuietHours(): boolean {
    if (!this.quietHoursEnabled) return false;

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 8); // "HH:MM:SS"
    const currentDay = now.getDay(); // 0-6

    // Check if current day is in quiet hours days
    if (!this.quietHoursDays.includes(currentDay)) {
      return false;
    }

    // Handle overnight quiet hours (e.g., 22:00 to 07:00)
    if (this.quietHoursStart > this.quietHoursEnd) {
      return currentTime >= this.quietHoursStart || currentTime < this.quietHoursEnd;
    } else {
      return currentTime >= this.quietHoursStart && currentTime < this.quietHoursEnd;
    }
  }

  /**
   * Check if a task is currently snoozed
   */
  private isTaskSnoozed(task: Task): boolean {
    if (!task.snoozed_until) return false;
    return new Date(task.snoozed_until) > new Date();
  }

  /**
   * Calculate which reminder stage a task should be at based on how overdue it is
   */
  private calculateReminderStage(overdueMinutes: number): ReminderStage | null {
    // If not yet due, no reminder
    if (overdueMinutes < 0) return null;

    // Find the highest applicable stage
    for (let i = REMINDER_STAGES.length - 1; i >= 0; i--) {
      if (overdueMinutes >= REMINDER_STAGES[i]) {
        return REMINDER_STAGES[i];
      }
    }

    return null;
  }

  /**
   * Check for pre-due reminders
   */
  private checkPreDueReminders(task: Task, minutesUntilDue: number): number | null {
    const reminderMinutes = task.reminder_minutes_before || [15];

    // Find if any pre-reminder should trigger
    for (const minutes of reminderMinutes.sort((a, b) => b - a)) {
      // Check if we're within the reminder window (within 1 minute of the trigger time)
      if (minutesUntilDue <= minutes && minutesUntilDue > minutes - 1) {
        // Check if this pre-reminder has already been triggered
        const preState = this.preReminderStates.get(task.id);
        if (!preState || !preState.triggeredMinutes.includes(minutes)) {
          return minutes;
        }
      }
    }

    return null;
  }

  /**
   * Check for due tasks and trigger progressive reminders
   */
  private async checkReminders(): Promise<void> {
    if (!this.userId) return;

    // Prevent concurrent checks
    if (this.isChecking) {
      console.log(`[Reminder] Skipping check - already checking (instance: ${TaskReminderService.instanceId})`);
      return;
    }

    // Debounce: don't check more than once every 30 seconds
    const now = Date.now();
    if (now - this.lastCheckTime < 30000) {
      console.log(`[Reminder] Skipping check - too soon (${Math.floor((now - this.lastCheckTime) / 1000)}s since last check)`);
      return;
    }

    this.isChecking = true;
    this.lastCheckTime = now;
    console.log(`[Reminder] Starting check (instance: ${TaskReminderService.instanceId})`);

    // Skip if in quiet hours (but still track states)
    const inQuietHours = this.isInQuietHours();

    try {
      // Fetch incomplete tasks that have a due date
      const { data: tasks, error } = await supabase
        .from("tasks")
        .select("id, title, description, due_date, completed, priority, snoozed_until, reminder_minutes_before")
        .eq("user_id", this.userId)
        .eq("completed", false)
        .not("due_date", "is", null);

      if (error) {
        console.error("Error fetching tasks for reminders:", error);
        return;
      }

      if (!tasks || tasks.length === 0) return;

      const now = new Date();

      for (const task of tasks as Task[]) {
        // Skip snoozed tasks
        if (this.isTaskSnoozed(task)) continue;

        const dueDate = new Date(task.due_date);
        const diffMs = dueDate.getTime() - now.getTime();
        const minutesUntilDue = Math.floor(diffMs / 60000);
        const overdueMinutes = -minutesUntilDue;

        // Check for pre-due reminders (up to 24 hours before)
        if (minutesUntilDue > 0 && minutesUntilDue <= 1440) {
          const preReminderMinutes = this.checkPreDueReminders(task, minutesUntilDue);
          if (preReminderMinutes !== null && !inQuietHours) {
            await this.triggerPreReminder(task, preReminderMinutes, minutesUntilDue);
          }
        }

        // Only process overdue reminders for tasks that are due or up to 20 minutes overdue
        if (overdueMinutes < 0 || overdueMinutes > 20) continue;

        // Calculate what stage this task should be at
        const targetStage = this.calculateReminderStage(overdueMinutes);
        if (targetStage === null) continue;

        // Get the current state for this task
        const currentState = this.reminderStates.get(task.id);

        // Check if we need to send a new reminder
        const shouldRemind = this.shouldSendReminder(
          task,
          currentState,
          targetStage,
          dueDate.toISOString()
        );

        if (shouldRemind && !inQuietHours) {
          await this.triggerReminder(task, targetStage, overdueMinutes);
        }
      }

      // Clean up old reminder states (completed or old tasks)
      this.cleanupReminderStates(tasks as Task[]);

      // Clean up old notification tracking (older than 10 minutes)
      const tenMinutesAgo = Date.now() - 600000;
      for (const [key, timestamp] of this.recentNotifications.entries()) {
        if (timestamp < tenMinutesAgo) {
          this.recentNotifications.delete(key);
        }
      }
    } catch (error) {
      console.error("Error checking reminders:", error);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Determine if we should send a reminder for this task
   */
  private shouldSendReminder(
    task: Task,
    currentState: ReminderState | undefined,
    targetStage: ReminderStage,
    dueDate: string
  ): boolean {
    // If no state exists, this is a new reminder
    if (!currentState) {
      return true;
    }

    // If the due date changed, reset reminders
    if (currentState.dueDate !== dueDate) {
      return true;
    }

    // If we haven't reached this stage yet, send reminder
    if (targetStage > currentState.lastStage) {
      return true;
    }

    // Additional guard: even if same stage, don't send if sent within last 5 minutes
    // This prevents duplicates from race conditions or rapid re-checks
    const fiveMinutesAgo = Date.now() - 300000;
    if (currentState.timestamp > fiveMinutesAgo && currentState.lastStage === targetStage) {
      return false;
    }

    return false;
  }

  /**
   * Trigger a pre-due reminder
   */
  private async triggerPreReminder(
    task: Task,
    reminderMinutes: number,
    minutesUntilDue: number
  ): Promise<void> {
    // Update pre-reminder state
    const preState = this.preReminderStates.get(task.id) || {
      triggeredMinutes: [],
      timestamp: Date.now(),
    };
    preState.triggeredMinutes.push(reminderMinutes);
    preState.timestamp = Date.now();
    this.preReminderStates.set(task.id, preState);
    this.saveReminderStates();

    // Build message
    let timeText: string;
    if (reminderMinutes >= 60) {
      const hours = Math.floor(reminderMinutes / 60);
      timeText = `${hours} hour${hours > 1 ? "s" : ""}`;
    } else {
      timeText = `${reminderMinutes} minute${reminderMinutes > 1 ? "s" : ""}`;
    }

    const title = "Upcoming Task";
    const message = `"${task.title}" is due in ${timeText}!`;

    // Create in-app notification
    await this.createDatabaseNotification(task, title, message, -reminderMinutes);

    // Trigger the notification bell UI
    triggerTaskAlarm(task.id, title, message);

    // Send native push notification if on mobile
    if (isNativePlatform()) {
      scheduleNotification(title, message, {
        task_id: task.id,
        route: "/tasks",
        type: "task_pre_reminder",
        reminder_minutes: reminderMinutes,
      });
    }

    console.log(
      `[Pre-Reminder] Task: ${task.title} | Due in ${minutesUntilDue} min`
    );
  }

  /**
   * Trigger a reminder for a task at a specific stage
   */
  private async triggerReminder(
    task: Task,
    stage: ReminderStage,
    overdueMinutes: number
  ): Promise<void> {
    // Create a lock key for this specific task + stage combination
    const lockKey = `${task.id}-${stage}`;

    // If we're already processing a notification for this task+stage, skip
    if (this.notificationLock.has(lockKey)) {
      console.log(`[Reminder] Skipping - lock active for ${lockKey}`);
      return;
    }

    // Acquire lock immediately
    this.notificationLock.add(lockKey);

    try {
      // Double-check against state to prevent any duplicate sends
      const currentState = this.reminderStates.get(task.id);
      if (currentState && currentState.lastStage >= stage) {
        // Already sent this stage or a later one
        const timeSinceLastReminder = Date.now() - currentState.timestamp;
        if (timeSinceLastReminder < 300000) {
          // Don't resend if within 5 minutes
          console.log(`[Reminder] Skipping - already sent stage ${stage} for task ${task.id} ${Math.floor(timeSinceLastReminder / 1000)}s ago`);
          return;
        }
      }

      // Create a unique key for this notification - only use task ID and stage
      // This prevents duplicate notifications for the same stage even as overdueMinutes changes
      const notificationKey = `${task.id}-stage-${stage}`;

      // Check if we've already sent this notification recently (within 5 minutes for same stage)
      const lastSent = this.recentNotifications.get(notificationKey);
      if (lastSent && Date.now() - lastSent < 300000) {
        console.log(`[Reminder] Skipping - notification sent ${Math.floor((Date.now() - lastSent) / 1000)}s ago for ${notificationKey}`);
        return; // Skip duplicate notification for same stage
      }

      // Mark this notification as sent BEFORE doing anything else
      this.recentNotifications.set(notificationKey, Date.now());

      const messageConfig = REMINDER_MESSAGES[stage];
      const stageNumber = REMINDER_STAGES.indexOf(stage) + 1;
      const totalStages = REMINDER_STAGES.length;

      // Build the message based on stage
      let message: string;
      if (stage === 0) {
        message = `"${task.title}" is due now!`;
      } else {
        message = `"${task.title}" is ${overdueMinutes} minutes overdue! (Reminder ${stageNumber}/${totalStages})`;
      }

      const title = messageConfig.title;

      // Update state BEFORE sending to prevent duplicate sends
      this.reminderStates.set(task.id, {
        lastStage: stage,
        timestamp: Date.now(),
        dueDate: task.due_date,
      });
      this.saveReminderStates();

      // Create in-app notification in database
      await this.createDatabaseNotification(task, title, message, stage);

      // Trigger the notification bell UI (sound + visual)
      triggerTaskAlarm(task.id, title, message);

      // Send native push notification if on mobile
      if (isNativePlatform()) {
        const priority = stage >= 10 ? "high" : "default";
        scheduleNotification(title, message, {
          task_id: task.id,
          route: "/tasks",
          type: "task_reminder",
          reminder_stage: stage,
          priority: priority,
        });
      }

      console.log(
        `[Reminder Stage ${stageNumber}/${totalStages}] Task: ${task.title} | ${overdueMinutes} min overdue`
      );
    } finally {
      // Release lock after a delay to prevent rapid re-triggering
      setTimeout(() => {
        this.notificationLock.delete(lockKey);
      }, 10000); // Keep lock for 10 seconds
    }
  }

  /**
   * Create a notification record in the database
   */
  private async createDatabaseNotification(
    task: Task,
    title: string,
    message: string,
    stage: number
  ): Promise<void> {
    if (!this.userId) return;

    try {
      const { error } = await supabase.from("notifications").insert({
        user_id: this.userId,
        type: "task",
        title: title,
        message: message,
        data: {
          task_id: task.id,
          reminder_stage: stage,
          priority: task.priority,
          is_overdue: stage > 0,
        },
        is_read: false,
      });

      if (error) {
        console.error("Failed to create notification:", error);
      }
    } catch (error) {
      console.error("Error creating database notification:", error);
    }
  }

  /**
   * Load reminder states from localStorage
   */
  private loadReminderStates(): void {
    try {
      const stored = localStorage.getItem(`task_reminder_states_${this.userId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, ReminderState>;
        const oneHourAgo = Date.now() - 3600000;

        // Filter out entries older than 1 hour
        this.reminderStates = new Map(
          Object.entries(parsed).filter(([, state]) => state.timestamp > oneHourAgo)
        );
      }

      // Load pre-reminder states
      const preStored = localStorage.getItem(`task_pre_reminder_states_${this.userId}`);
      if (preStored) {
        const parsed = JSON.parse(preStored) as Record<string, PreReminderState>;
        const oneDayAgo = Date.now() - 86400000;

        // Filter out entries older than 1 day
        this.preReminderStates = new Map(
          Object.entries(parsed).filter(([, state]) => state.timestamp > oneDayAgo)
        );
      }
    } catch (error) {
      console.error("Error loading reminder states:", error);
      this.reminderStates = new Map();
      this.preReminderStates = new Map();
    }
  }

  /**
   * Save reminder states to localStorage
   */
  private saveReminderStates(): void {
    try {
      // Save overdue reminder states
      const obj: Record<string, ReminderState> = {};
      this.reminderStates.forEach((state, id) => {
        obj[id] = state;
      });
      localStorage.setItem(
        `task_reminder_states_${this.userId}`,
        JSON.stringify(obj)
      );

      // Save pre-reminder states
      const preObj: Record<string, PreReminderState> = {};
      this.preReminderStates.forEach((state, id) => {
        preObj[id] = state;
      });
      localStorage.setItem(
        `task_pre_reminder_states_${this.userId}`,
        JSON.stringify(preObj)
      );
    } catch (error) {
      console.error("Error saving reminder states:", error);
    }
  }

  /**
   * Clean up reminder states for completed or old tasks
   */
  private cleanupReminderStates(currentTasks: Task[]): void {
    const currentTaskIds = new Set(currentTasks.map((t) => t.id));
    const oneHourAgo = Date.now() - 3600000;

    const toDelete: string[] = [];

    this.reminderStates.forEach((state, id) => {
      // Remove if task no longer exists in incomplete tasks
      if (!currentTaskIds.has(id)) {
        toDelete.push(id);
      }
      // Remove if state is older than 1 hour
      else if (state.timestamp < oneHourAgo) {
        toDelete.push(id);
      }
    });

    toDelete.forEach((id) => this.reminderStates.delete(id));

    if (toDelete.length > 0) {
      this.saveReminderStates();
    }
  }

  /**
   * Manually trigger a check (useful after creating/updating tasks)
   */
  async forceCheck(): Promise<void> {
    // Debounce force checks to prevent spam
    const now = Date.now();
    if (now - this.lastCheckTime < 30000) {
      console.log(`[Reminder] Skipping force check - too soon (${Math.floor((now - this.lastCheckTime) / 1000)}s since last check)`);
      return; // Don't force check more than once every 30 seconds
    }
    await this.checkReminders();
  }

  /**
   * Clear a specific reminder from states (e.g., when task is completed)
   */
  clearReminder(taskId: string): void {
    this.reminderStates.delete(taskId);
    this.preReminderStates.delete(taskId);
    this.saveReminderStates();
  }

  /**
   * Reset reminders for a task (e.g., when due date is changed)
   */
  resetReminder(taskId: string): void {
    this.reminderStates.delete(taskId);
    this.preReminderStates.delete(taskId);
    this.saveReminderStates();
  }

  /**
   * Reload quiet hours settings (call when preferences change)
   */
  async reloadQuietHoursSettings(): Promise<void> {
    await this.loadQuietHoursSettings();
  }

  /**
   * Check if currently in quiet hours
   */
  checkQuietHours(): boolean {
    return this.isInQuietHours();
  }

  /**
   * Get the current reminder state for a task
   */
  getReminderState(taskId: string): ReminderState | undefined {
    return this.reminderStates.get(taskId);
  }

  /**
   * Check if service is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get reminder stages configuration
   */
  getStages(): readonly number[] {
    return REMINDER_STAGES;
  }
}

// Singleton instance
export const taskReminderService = new TaskReminderService();

// Export functions for easy use
export const startTaskReminders = () => taskReminderService.start();
export const stopTaskReminders = () => taskReminderService.stop();
export const forceCheckReminders = () => taskReminderService.forceCheck();
export const clearTaskReminder = (taskId: string) =>
  taskReminderService.clearReminder(taskId);
export const resetTaskReminder = (taskId: string) =>
  taskReminderService.resetReminder(taskId);

export default taskReminderService;
