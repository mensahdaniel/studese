/**
 * Global Task Reminder Service
 *
 * This service runs app-wide to check for due tasks and trigger notifications.
 * It works regardless of which page the user is on and integrates with
 * native push notifications for mobile devices.
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
}

class TaskReminderService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private triggeredReminders: Set<string> = new Set();
  private isRunning: boolean = false;
  private userId: string | null = null;
  private checkIntervalMs: number = 30000; // 30 seconds

  /**
   * Start the reminder service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("Task reminder service is already running");
      return;
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log("No user logged in, reminder service not started");
      return;
    }

    this.userId = user.id;
    this.isRunning = true;

    // Load previously triggered reminders from localStorage to avoid duplicates
    this.loadTriggeredReminders();

    // Check immediately on start
    await this.checkReminders();

    // Set up interval for periodic checks
    this.intervalId = setInterval(() => {
      this.checkReminders();
    }, this.checkIntervalMs);

    console.log("Task reminder service started");
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
   * Check for due tasks and trigger reminders
   */
  private async checkReminders(): Promise<void> {
    if (!this.userId) return;

    try {
      // Fetch incomplete tasks
      const { data: tasks, error } = await supabase
        .from("tasks")
        .select("id, title, description, due_date, completed, priority")
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
        // Skip if already triggered
        if (this.triggeredReminders.has(task.id)) continue;

        const dueDate = new Date(task.due_date);
        const diffMs = dueDate.getTime() - now.getTime();

        // Trigger reminder if task is due within the next minute or overdue (up to 5 min)
        if (diffMs <= 60000 && diffMs > -300000) {
          await this.triggerReminder(task);
        }
      }

      // Clean up old triggered reminders (older than 1 hour)
      this.cleanupTriggeredReminders();
    } catch (error) {
      console.error("Error checking reminders:", error);
    }
  }

  /**
   * Trigger a reminder for a task
   */
  private async triggerReminder(task: Task): Promise<void> {
    // Mark as triggered
    this.triggeredReminders.add(task.id);
    this.saveTriggeredReminders();

    const title = "Task Due Now!";
    const message = `"${task.title}" is due now!`;

    // Create in-app notification in database
    await this.createDatabaseNotification(task, title, message);

    // Trigger the notification bell UI (sound + open bell)
    triggerTaskAlarm(task.id, title, message);

    // Send native push notification if on mobile
    if (isNativePlatform()) {
      scheduleNotification(title, message, {
        task_id: task.id,
        route: "/tasks",
        type: "task_reminder",
      });
    }

    console.log(`Reminder triggered for task: ${task.title}`);
  }

  /**
   * Create a notification record in the database
   */
  private async createDatabaseNotification(
    task: Task,
    title: string,
    message: string
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
   * Load triggered reminders from localStorage
   */
  private loadTriggeredReminders(): void {
    try {
      const stored = localStorage.getItem(`triggered_reminders_${this.userId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Filter out entries older than 1 hour
        const oneHourAgo = Date.now() - 3600000;
        const valid = Object.entries(parsed)
          .filter(([, timestamp]) => (timestamp as number) > oneHourAgo)
          .map(([id]) => id);
        this.triggeredReminders = new Set(valid);
      }
    } catch (error) {
      console.error("Error loading triggered reminders:", error);
      this.triggeredReminders = new Set();
    }
  }

  /**
   * Save triggered reminders to localStorage
   */
  private saveTriggeredReminders(): void {
    try {
      const obj: Record<string, number> = {};
      this.triggeredReminders.forEach((id) => {
        obj[id] = Date.now();
      });
      localStorage.setItem(
        `triggered_reminders_${this.userId}`,
        JSON.stringify(obj)
      );
    } catch (error) {
      console.error("Error saving triggered reminders:", error);
    }
  }

  /**
   * Clean up old triggered reminders
   */
  private cleanupTriggeredReminders(): void {
    try {
      const stored = localStorage.getItem(`triggered_reminders_${this.userId}`);
      if (!stored) return;

      const parsed = JSON.parse(stored);
      const oneHourAgo = Date.now() - 3600000;
      const valid: Record<string, number> = {};

      Object.entries(parsed).forEach(([id, timestamp]) => {
        if ((timestamp as number) > oneHourAgo) {
          valid[id] = timestamp as number;
        }
      });

      localStorage.setItem(
        `triggered_reminders_${this.userId}`,
        JSON.stringify(valid)
      );

      // Update in-memory set
      this.triggeredReminders = new Set(Object.keys(valid));
    } catch (error) {
      console.error("Error cleaning up triggered reminders:", error);
    }
  }

  /**
   * Manually trigger a check (useful after creating/updating tasks)
   */
  async forceCheck(): Promise<void> {
    await this.checkReminders();
  }

  /**
   * Clear a specific reminder from triggered set (e.g., when task is updated)
   */
  clearReminder(taskId: string): void {
    this.triggeredReminders.delete(taskId);
    this.saveTriggeredReminders();
  }

  /**
   * Check if service is running
   */
  isActive(): boolean {
    return this.isRunning;
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

export default taskReminderService;
