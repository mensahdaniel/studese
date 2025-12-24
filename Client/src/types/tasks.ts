/**
 * Enhanced Task Types
 * Comprehensive type definitions for the task management system
 */

// ============================================
// Core Task Types
// ============================================

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  order: number;
  created_at?: string;
}

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskCategory = 'personal' | 'academic' | 'study' | 'collaborative';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  due_date: string;
  completed: boolean;
  created_at: string;

  // Computed/dynamic fields
  dynamic_priority?: TaskPriority;

  // Recurrence
  is_recurring: boolean;
  recurrence_type: RecurrenceType | null;
  recurrence_interval: number;
  recurrence_days: number[] | null; // For weekly: [0-6] (Sun-Sat)
  recurrence_end_date: string | null;
  parent_task_id: string | null;
  recurrence_count: number;

  // Snooze
  snoozed_until: string | null;
  snooze_count: number;
  last_reminder_at: string | null;

  // Reminders
  reminder_minutes_before: number[];

  // Subtasks
  subtasks: Subtask[];

  // Time tracking
  estimated_minutes: number | null;
  time_spent_minutes: number;

  // Dependencies
  depends_on: string[];

  // Additional
  notes: string | null;
  tags: string[];
}

// For creating new tasks
export interface NewTask {
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  due_date: string;
  due_time: string;

  // Optional enhanced fields
  is_recurring?: boolean;
  recurrence_type?: RecurrenceType;
  recurrence_interval?: number;
  recurrence_days?: number[];
  recurrence_end_date?: string;

  reminder_minutes_before?: number[];
  subtasks?: Subtask[];
  estimated_minutes?: number;
  depends_on?: string[];
  notes?: string;
  tags?: string[];
}

// For updating tasks
export type TaskUpdate = Partial<Omit<Task, 'id' | 'user_id' | 'created_at'>>;

// ============================================
// User Preferences Types
// ============================================

export interface UserPreferences {
  id: string;
  user_id: string;

  // Quiet Hours
  quiet_hours_enabled: boolean;
  quiet_hours_start: string; // TIME format "HH:MM:SS"
  quiet_hours_end: string;
  quiet_hours_days: number[]; // [0-6]

  // Default reminder settings
  default_reminder_minutes: number[];

  // Pomodoro settings
  pomodoro_work_minutes: number;
  pomodoro_short_break_minutes: number;
  pomodoro_long_break_minutes: number;
  pomodoro_sessions_before_long_break: number;

  // Notification preferences
  notification_sound_enabled: boolean;
  notification_vibration_enabled: boolean;
  batch_notifications: boolean;

  // UI preferences
  default_task_view: 'list' | 'grid' | 'kanban';
  show_completed_tasks: boolean;

  created_at: string;
  updated_at: string;
}

export type UserPreferencesUpdate = Partial<Omit<UserPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

// ============================================
// Time Tracking Types
// ============================================

export interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  is_pomodoro: boolean;
  pomodoro_type: 'work' | 'short_break' | 'long_break' | null;
  notes: string | null;
  created_at: string;
}

export interface NewTimeEntry {
  task_id: string;
  started_at?: string;
  is_pomodoro?: boolean;
  pomodoro_type?: 'work' | 'short_break' | 'long_break';
  notes?: string;
}

// ============================================
// Focus Session (Pomodoro) Types
// ============================================

export type FocusSessionType = 'work' | 'short_break' | 'long_break';
export type FocusSessionStatus = 'in_progress' | 'completed' | 'interrupted' | 'skipped';

export interface FocusSession {
  id: string;
  user_id: string;
  task_id: string | null;
  session_type: FocusSessionType;
  planned_duration_minutes: number;
  actual_duration_minutes: number | null;
  started_at: string;
  ended_at: string | null;
  status: FocusSessionStatus;
  interruption_reason: string | null;
  session_number: number;
  notes: string | null;
  created_at: string;
}

export interface NewFocusSession {
  task_id?: string;
  session_type: FocusSessionType;
  planned_duration_minutes: number;
  session_number?: number;
}

// ============================================
// Snooze Types
// ============================================

export interface SnoozedReminder {
  id: string;
  task_id: string;
  user_id: string;
  snoozed_at: string;
  snooze_until: string;
  snooze_duration_minutes: number;
  original_reminder_stage: number;
  is_processed: boolean;
  processed_at: string | null;
  created_at: string;
}

export const SNOOZE_OPTIONS = [
  { label: '5 minutes', minutes: 5 },
  { label: '10 minutes', minutes: 10 },
  { label: '15 minutes', minutes: 15 },
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: 'Tomorrow 9 AM', minutes: -1, special: 'tomorrow_9am' },
] as const;

export type SnoozeOption = typeof SNOOZE_OPTIONS[number];

// ============================================
// Reminder Types
// ============================================

export const PRE_REMINDER_OPTIONS = [
  { label: 'At time of event', minutes: 0 },
  { label: '5 minutes before', minutes: 5 },
  { label: '15 minutes before', minutes: 15 },
  { label: '30 minutes before', minutes: 30 },
  { label: '1 hour before', minutes: 60 },
  { label: '2 hours before', minutes: 120 },
  { label: '1 day before', minutes: 1440 },
] as const;

export type PreReminderOption = typeof PRE_REMINDER_OPTIONS[number];

// ============================================
// Recurrence Types
// ============================================

export const RECURRENCE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
] as const;

export const WEEKDAYS = [
  { value: 0, label: 'Sun', fullLabel: 'Sunday' },
  { value: 1, label: 'Mon', fullLabel: 'Monday' },
  { value: 2, label: 'Tue', fullLabel: 'Tuesday' },
  { value: 3, label: 'Wed', fullLabel: 'Wednesday' },
  { value: 4, label: 'Thu', fullLabel: 'Thursday' },
  { value: 5, label: 'Fri', fullLabel: 'Friday' },
  { value: 6, label: 'Sat', fullLabel: 'Saturday' },
] as const;

// ============================================
// Statistics Types
// ============================================

export interface TaskStats {
  total: number;
  pending: number;
  completed: number;
  overdue: number;
  today: number;
  highPriority: number;
  completionRate: number;
}

export interface FocusStats {
  totalSessions: number;
  completedSessions: number;
  totalFocusMinutes: number;
  averageSessionLength: number;
  currentStreak: number;
  longestStreak: number;
}

export interface TimeTrackingStats {
  totalTimeSpent: number;
  averageTimePerTask: number;
  tasksWithTimeTracked: number;
  estimateAccuracy: number; // percentage of how accurate estimates are
}

// ============================================
// Filter and Sort Types
// ============================================

export type TaskFilterType =
  | 'all'
  | 'pending'
  | 'completed'
  | 'overdue'
  | 'today'
  | 'upcoming'
  | 'high'
  | 'medium'
  | 'low'
  | 'recurring'
  | 'has_subtasks'
  | 'has_dependencies';

export type TaskSortType =
  | 'due_date'
  | 'priority'
  | 'created'
  | 'title'
  | 'estimated_time'
  | 'time_spent';

export interface TaskFilters {
  filter: TaskFilterType;
  category: TaskCategory | 'all';
  sortBy: TaskSortType;
  searchTerm: string;
  tags?: string[];
  showCompleted?: boolean;
}

// ============================================
// Dependency Types
// ============================================

export interface TaskDependency {
  taskId: string;
  dependsOnTaskId: string;
  dependsOnTask?: Task;
  isBlocking: boolean; // true if dependency is not yet completed
}

export interface DependencyGraph {
  nodes: Map<string, Task>;
  edges: Map<string, string[]>; // taskId -> [dependsOnTaskIds]
}

// ============================================
// Notification Types
// ============================================

export interface TaskNotification {
  id: string;
  user_id: string;
  task_id: string;
  type: 'due' | 'overdue' | 'pre_reminder' | 'snoozed';
  title: string;
  message: string;
  reminder_stage: number;
  is_read: boolean;
  created_at: string;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
