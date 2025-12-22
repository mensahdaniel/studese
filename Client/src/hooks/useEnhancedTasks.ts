/**
 * Enhanced Tasks Hooks
 *
 * React hooks for managing enhanced task features including:
 * - Subtasks management
 * - Time tracking
 * - Task dependencies
 * - Recurring tasks
 * - Snooze functionality
 * - Focus timer integration
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/utils/supabase";
import { useToast } from "@/hooks/use-toast";
import type {
  Task,
  NewTask,
  TaskUpdate,
  Subtask,
  TimeEntry,
  TaskFilters,
  TaskStats,
  RecurrenceType,
  TaskPriority,
  TaskCategory,
} from "@/types/tasks";
import { taskPreferencesService } from "@/services/taskPreferencesService";
import { focusTimerService, TimerState } from "@/services/focusTimerService";
import { forceCheckReminders, clearTaskReminder, resetTaskReminder } from "@/services/taskReminderService";
import { isBefore, addDays, isToday, format } from "date-fns";
import { v4 as uuidv4 } from "uuid";

// ============================================
// Task CRUD Hook
// ============================================

export function useTasks(initialFilters?: Partial<TaskFilters>) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilters>({
    filter: "all",
    category: "all",
    sortBy: "due_date",
    searchTerm: "",
    showCompleted: true,
    ...initialFilters,
  });

  const { toast } = useToast();

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Please sign in to view your tasks");
        setLoading(false);
        return;
      }

      const query = supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Calculate dynamic priority for each task
      const tasksWithPriority = (data || []).map((task) => ({
        ...task,
        subtasks: task.subtasks || [],
        depends_on: task.depends_on || [],
        tags: task.tags || [],
        reminder_minutes_before: task.reminder_minutes_before || [15],
        dynamic_priority: calculateDynamicPriority(task.due_date, task.priority),
      }));

      setTasks(tasksWithPriority);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch tasks";
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Calculate dynamic priority based on due date
  const calculateDynamicPriority = (dueDate: string, userPriority: string): TaskPriority => {
    const due = new Date(dueDate);
    const now = new Date();

    const priorityLevel: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const userLevel = priorityLevel[userPriority] ?? 1;
    let urgencyLevel = userLevel;

    if (isBefore(due, now)) {
      urgencyLevel = 0;
    } else if (isBefore(due, addDays(now, 2))) {
      urgencyLevel = Math.min(urgencyLevel, 0);
    } else if (isBefore(due, addDays(now, 7))) {
      urgencyLevel = Math.min(urgencyLevel, 1);
    }

    const levelToPriority: Record<number, TaskPriority> = { 0: "high", 1: "medium", 2: "low" };
    return levelToPriority[urgencyLevel] || (userPriority as TaskPriority);
  };

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        // Search filter
        const matchesSearch =
          task.title.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
          task.description?.toLowerCase().includes(filters.searchTerm.toLowerCase());

        // Status filter
        let matchesFilter = true;
        switch (filters.filter) {
          case "pending":
            matchesFilter = !task.completed;
            break;
          case "completed":
            matchesFilter = task.completed;
            break;
          case "overdue":
            matchesFilter = !task.completed && new Date(task.due_date) < new Date();
            break;
          case "today":
            matchesFilter = isToday(new Date(task.due_date)) && !task.completed;
            break;
          case "recurring":
            matchesFilter = task.is_recurring;
            break;
          case "has_subtasks":
            matchesFilter = task.subtasks && task.subtasks.length > 0;
            break;
          case "has_dependencies":
            matchesFilter = task.depends_on && task.depends_on.length > 0;
            break;
          case "high":
          case "medium":
          case "low":
            matchesFilter = task.dynamic_priority === filters.filter && !task.completed;
            break;
        }

        // Category filter
        const matchesCategory = filters.category === "all" || task.category === filters.category;

        // Show completed filter
        if (!filters.showCompleted && task.completed) {
          return false;
        }

        return matchesSearch && matchesFilter && matchesCategory;
      })
      .sort((a, b) => {
        // Completed tasks always at bottom
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }

        switch (filters.sortBy) {
          case "due_date":
            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          case "priority": {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return (
              (priorityOrder[a.dynamic_priority as keyof typeof priorityOrder] || 2) -
              (priorityOrder[b.dynamic_priority as keyof typeof priorityOrder] || 2)
            );
          }
          case "created":
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          case "title":
            return a.title.localeCompare(b.title);
          case "estimated_time":
            return (b.estimated_minutes || 0) - (a.estimated_minutes || 0);
          case "time_spent":
            return (b.time_spent_minutes || 0) - (a.time_spent_minutes || 0);
          default:
            return 0;
        }
      });
  }, [tasks, filters]);

  // Statistics
  const stats: TaskStats = useMemo(() => {
    const total = tasks.length;
    const pending = tasks.filter((t) => !t.completed).length;
    const completed = tasks.filter((t) => t.completed).length;
    const overdue = tasks.filter((t) => !t.completed && new Date(t.due_date) < new Date()).length;
    const today = tasks.filter((t) => !t.completed && isToday(new Date(t.due_date))).length;
    const highPriority = tasks.filter((t) => t.dynamic_priority === "high" && !t.completed).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, pending, completed, overdue, today, highPriority, completionRate };
  }, [tasks]);

  // Create task
  const createTask = useCallback(
    async (newTask: NewTask): Promise<Task | null> => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Please sign in to add tasks");

        // Build due date
        let dueDate: Date;
        if (newTask.due_time) {
          dueDate = new Date(`${newTask.due_date}T${newTask.due_time}`);
        } else {
          dueDate = new Date(`${newTask.due_date}T09:00:00`);
        }

        const taskToAdd = {
          user_id: user.id,
          title: newTask.title.trim(),
          description: newTask.description?.trim() || null,
          category: newTask.category,
          priority: newTask.priority,
          due_date: dueDate.toISOString(),
          completed: false,
          is_recurring: newTask.is_recurring || false,
          recurrence_type: newTask.recurrence_type || null,
          recurrence_interval: newTask.recurrence_interval || 1,
          recurrence_days: newTask.recurrence_days || null,
          recurrence_end_date: newTask.recurrence_end_date || null,
          reminder_minutes_before: newTask.reminder_minutes_before || [15],
          subtasks: newTask.subtasks || [],
          estimated_minutes: newTask.estimated_minutes || null,
          depends_on: newTask.depends_on || [],
          notes: newTask.notes || null,
          tags: newTask.tags || [],
        };

        const { data, error } = await supabase
          .from("tasks")
          .insert([taskToAdd])
          .select()
          .single();

        if (error) throw error;

        const addedTask = {
          ...data,
          dynamic_priority: calculateDynamicPriority(data.due_date, data.priority),
        };

        setTasks((prev) => [addedTask, ...prev]);
        forceCheckReminders();

        toast({
          title: "Task Created",
          description: "Your task has been added successfully.",
        });

        return addedTask;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create task";
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
        return null;
      }
    },
    [toast]
  );

  // Update task
  const updateTask = useCallback(
    async (taskId: string, updates: TaskUpdate): Promise<Task | null> => {
      try {
        const { data, error } = await supabase
          .from("tasks")
          .update(updates)
          .eq("id", taskId)
          .select()
          .single();

        if (error) throw error;

        const updatedTask = {
          ...data,
          dynamic_priority: calculateDynamicPriority(data.due_date, data.priority),
        };

        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? updatedTask : t))
        );

        // Reset reminder if due date changed
        if (updates.due_date) {
          resetTaskReminder(taskId);
        }

        return updatedTask;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update task";
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
        return null;
      }
    },
    [toast]
  );

  // Toggle completion
  const toggleComplete = useCallback(
    async (task: Task): Promise<void> => {
      try {
        const { data, error } = await supabase
          .from("tasks")
          .update({ completed: !task.completed })
          .eq("id", task.id)
          .select()
          .single();

        if (error) throw error;

        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, completed: data.completed, dynamic_priority: calculateDynamicPriority(t.due_date, t.priority) }
              : t
          )
        );

        clearTaskReminder(task.id);

        if (data.completed) {
          toast({
            title: "Task Completed",
            description: "Great job on finishing that task!",
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update task";
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  // Delete task
  const deleteTask = useCallback(
    async (taskId: string): Promise<boolean> => {
      try {
        const { error } = await supabase.from("tasks").delete().eq("id", taskId);

        if (error) throw error;

        clearTaskReminder(taskId);
        setTasks((prev) => prev.filter((t) => t.id !== taskId));

        toast({
          title: "Task Deleted",
          description: "The task has been removed.",
        });

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete task";
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
        return false;
      }
    },
    [toast]
  );

  return {
    tasks: filteredTasks,
    allTasks: tasks,
    loading,
    error,
    stats,
    filters,
    setFilters,
    fetchTasks,
    createTask,
    updateTask,
    toggleComplete,
    deleteTask,
  };
}

// ============================================
// Subtasks Hook
// ============================================

export function useSubtasks(task: Task, onUpdate: (updates: TaskUpdate) => Promise<Task | null>) {
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks || []);

  useEffect(() => {
    setSubtasks(task.subtasks || []);
  }, [task.subtasks]);

  const progress = useMemo(() => {
    if (subtasks.length === 0) return 0;
    const completed = subtasks.filter((s) => s.completed).length;
    return Math.round((completed / subtasks.length) * 100);
  }, [subtasks]);

  const addSubtask = useCallback(
    async (title: string): Promise<Subtask | null> => {
      const newSubtask: Subtask = {
        id: uuidv4(),
        title: title.trim(),
        completed: false,
        order: subtasks.length,
        created_at: new Date().toISOString(),
      };

      const newSubtasks = [...subtasks, newSubtask];
      const result = await onUpdate({ subtasks: newSubtasks });

      if (result) {
        setSubtasks(newSubtasks);
        return newSubtask;
      }
      return null;
    },
    [subtasks, onUpdate]
  );

  const updateSubtask = useCallback(
    async (subtaskId: string, updates: Partial<Subtask>): Promise<boolean> => {
      const newSubtasks = subtasks.map((s) =>
        s.id === subtaskId ? { ...s, ...updates } : s
      );

      const result = await onUpdate({ subtasks: newSubtasks });

      if (result) {
        setSubtasks(newSubtasks);
        return true;
      }
      return false;
    },
    [subtasks, onUpdate]
  );

  const toggleSubtask = useCallback(
    async (subtaskId: string): Promise<boolean> => {
      const subtask = subtasks.find((s) => s.id === subtaskId);
      if (!subtask) return false;

      return updateSubtask(subtaskId, { completed: !subtask.completed });
    },
    [subtasks, updateSubtask]
  );

  const deleteSubtask = useCallback(
    async (subtaskId: string): Promise<boolean> => {
      const newSubtasks = subtasks.filter((s) => s.id !== subtaskId);
      const result = await onUpdate({ subtasks: newSubtasks });

      if (result) {
        setSubtasks(newSubtasks);
        return true;
      }
      return false;
    },
    [subtasks, onUpdate]
  );

  const reorderSubtasks = useCallback(
    async (fromIndex: number, toIndex: number): Promise<boolean> => {
      const newSubtasks = [...subtasks];
      const [removed] = newSubtasks.splice(fromIndex, 1);
      newSubtasks.splice(toIndex, 0, removed);

      // Update order values
      const reordered = newSubtasks.map((s, i) => ({ ...s, order: i }));

      const result = await onUpdate({ subtasks: reordered });

      if (result) {
        setSubtasks(reordered);
        return true;
      }
      return false;
    },
    [subtasks, onUpdate]
  );

  return {
    subtasks,
    progress,
    addSubtask,
    updateSubtask,
    toggleSubtask,
    deleteSubtask,
    reorderSubtasks,
  };
}

// ============================================
// Time Tracking Hook
// ============================================

export function useTimeTracking(taskId: string) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Fetch time entries
  const fetchEntries = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("task_time_entries")
        .select("*")
        .eq("task_id", taskId)
        .order("started_at", { ascending: false });

      // Handle missing table gracefully
      if (error) {
        if (error.code === '42P01' || error.message?.includes('406') || error.message?.includes('does not exist')) {
          console.warn("task_time_entries table not available yet. Run the database migration.");
          setLoading(false);
          return;
        }
        throw error;
      }

      setEntries(data || []);

      // Check for active entry
      const active = data?.find((e) => !e.ended_at);
      setActiveEntry(active || null);
    } catch (err: unknown) {
      // Also catch 406 errors here
      const error = err as { message?: string; code?: string };
      if (error?.message?.includes('406') || error?.code === '42P01') {
        console.warn("task_time_entries table not available yet. Run the database migration.");
      } else {
        console.error("Error fetching time entries:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Calculate total time
  const totalMinutes = useMemo(() => {
    return entries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
  }, [entries]);

  // Start tracking
  const startTracking = useCallback(async (): Promise<TimeEntry | null> => {
    if (activeEntry) {
      toast({
        title: "Already Tracking",
        description: "Stop the current session first.",
        variant: "destructive",
      });
      return null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Error",
        description: "Please sign in to track time.",
        variant: "destructive",
      });
      return null;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in");

      const { data, error } = await supabase
        .from("task_time_entries")
        .insert({
          task_id: taskId,
          user_id: user.id,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      // Handle missing table
      if (error) {
        if (error.code === '42P01' || error.message?.includes('406') || error.message?.includes('does not exist')) {
          toast({
            title: "Feature Not Available",
            description: "Time tracking requires database migration. Contact admin.",
            variant: "destructive",
          });
          return null;
        }
        throw error;
      }

      setActiveEntry(data);
      setEntries((prev) => [data, ...prev]);

      toast({
        title: "Time Tracking Started",
        description: "Timer is now running.",
      });

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start tracking";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      return null;
    }
  }, [taskId, activeEntry, toast]);

  // Stop tracking
  const stopTracking = useCallback(async (): Promise<TimeEntry | null> => {
    if (!activeEntry) return null;

    try {
      const endTime = new Date();
      const startTime = new Date(activeEntry.started_at);
      const durationMinutes = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 60000));

      const { data, error } = await supabase
        .from("task_time_entries")
        .update({
          ended_at: endTime.toISOString(),
          duration_minutes: durationMinutes,
        })
        .eq("id", activeEntry.id)
        .select()
        .single();

      if (error) throw error;

      setActiveEntry(null);
      setEntries((prev) =>
        prev.map((e) => (e.id === activeEntry.id ? data : e))
      );

      toast({
        title: "Time Tracking Stopped",
        description: `Tracked ${durationMinutes} minutes.`,
      });

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to stop tracking";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      return null;
    }
  }, [activeEntry, toast]);

  // Delete entry
  const deleteEntry = useCallback(
    async (entryId: string): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from("task_time_entries")
          .delete()
          .eq("id", entryId);

        if (error) throw error;

        if (activeEntry?.id === entryId) {
          setActiveEntry(null);
        }
        setEntries((prev) => prev.filter((e) => e.id !== entryId));

        return true;
      } catch (err) {
        console.error("Error deleting time entry:", err);
        return false;
      }
    },
    [activeEntry]
  );

  return {
    entries,
    activeEntry,
    loading,
    totalMinutes,
    isTracking: !!activeEntry,
    startTracking,
    stopTracking,
    deleteEntry,
    refresh: fetchEntries,
  };
}

// ============================================
// Focus Timer Hook
// ============================================

export function useFocusTimer() {
  const [state, setState] = useState<TimerState>(focusTimerService.getState());

  useEffect(() => {
    // Initialize service
    focusTimerService.initialize();

    // Handler that creates a new object to trigger React re-render
    const handleStateUpdate = (newState: TimerState) => {
      setState({ ...newState });
    };

    // Subscribe to all events
    const unsubTick = focusTimerService.on("tick", handleStateUpdate);
    const unsubStart = focusTimerService.on("start", handleStateUpdate);
    const unsubPause = focusTimerService.on("pause", handleStateUpdate);
    const unsubResume = focusTimerService.on("resume", handleStateUpdate);
    const unsubComplete = focusTimerService.on("complete", handleStateUpdate);
    const unsubSessionChange = focusTimerService.on("session-change", handleStateUpdate);
    const unsubReset = focusTimerService.on("reset", handleStateUpdate);

    return () => {
      unsubTick();
      unsubStart();
      unsubPause();
      unsubResume();
      unsubComplete();
      unsubSessionChange();
      unsubReset();
    };
  }, []);

  const start = useCallback((taskId?: string, taskTitle?: string) => {
    focusTimerService.start(taskId, taskTitle);
  }, []);

  const pause = useCallback(() => {
    focusTimerService.pause();
  }, []);

  const resume = useCallback(() => {
    focusTimerService.resume();
  }, []);

  const reset = useCallback(() => {
    focusTimerService.reset();
  }, []);

  const skip = useCallback(() => {
    focusTimerService.skip();
  }, []);

  const switchTo = useCallback((type: "work" | "short_break" | "long_break") => {
    focusTimerService.switchTo(type);
  }, []);

  const setTask = useCallback((taskId: string | null, taskTitle: string | null) => {
    focusTimerService.setTask(taskId, taskTitle);
  }, []);

  return {
    ...state,
    formattedTime: focusTimerService.formatTime(state.timeRemaining),
    progress: focusTimerService.getProgress(),
    start,
    pause,
    resume,
    reset,
    skip,
    switchTo,
    setTask,
    settings: focusTimerService.getSettings(),
  };
}

// ============================================
// Snooze Hook
// ============================================

export function useSnooze() {
  const { toast } = useToast();

  const snooze = useCallback(
    async (taskId: string, minutes: number, stage?: number): Promise<boolean> => {
      const result = await taskPreferencesService.snoozeTask(taskId, minutes, stage);

      if (result.success) {
        const timeStr = minutes < 60 ? `${minutes} minutes` : `${Math.round(minutes / 60)} hour(s)`;
        toast({
          title: "Reminder Snoozed",
          description: `You'll be reminded again in ${timeStr}.`,
        });
        return true;
      } else {
        toast({
          title: "Failed to Snooze",
          description: "Something went wrong. Please try again.",
          variant: "destructive",
        });
        return false;
      }
    },
    [toast]
  );

  const snoozeUntilTomorrow = useCallback(
    async (taskId: string, stage?: number): Promise<boolean> => {
      const result = await taskPreferencesService.snoozeUntilTomorrow(taskId, stage);

      if (result.success) {
        toast({
          title: "Reminder Snoozed",
          description: "You'll be reminded tomorrow at 9 AM.",
        });
        return true;
      } else {
        toast({
          title: "Failed to Snooze",
          description: "Something went wrong. Please try again.",
          variant: "destructive",
        });
        return false;
      }
    },
    [toast]
  );

  const clearSnooze = useCallback(async (taskId: string): Promise<boolean> => {
    return taskPreferencesService.clearSnooze(taskId);
  }, []);

  return {
    snooze,
    snoozeUntilTomorrow,
    clearSnooze,
  };
}

// ============================================
// Dependencies Hook
// ============================================

export function useDependencies(task: Task, allTasks: Task[]) {
  // Get tasks this task depends on
  const dependencies = useMemo(() => {
    return allTasks.filter((t) => task.depends_on?.includes(t.id));
  }, [task.depends_on, allTasks]);

  // Get tasks that depend on this task
  const dependents = useMemo(() => {
    return allTasks.filter((t) => t.depends_on?.includes(task.id));
  }, [task.id, allTasks]);

  // Check if all dependencies are met (completed)
  const allDependenciesMet = useMemo(() => {
    return dependencies.every((d) => d.completed);
  }, [dependencies]);

  // Get blocking dependencies (incomplete ones)
  const blockingDependencies = useMemo(() => {
    return dependencies.filter((d) => !d.completed);
  }, [dependencies]);

  // Get available tasks to add as dependencies (not already dependent, not self, no circular)
  const availableDependencies = useMemo(() => {
    const currentDeps = new Set(task.depends_on || []);
    return allTasks.filter((t) => {
      // Can't depend on self
      if (t.id === task.id) return false;
      // Already a dependency
      if (currentDeps.has(t.id)) return false;
      // Can't create circular dependency
      if (t.depends_on?.includes(task.id)) return false;
      return true;
    });
  }, [task, allTasks]);

  return {
    dependencies,
    dependents,
    allDependenciesMet,
    blockingDependencies,
    availableDependencies,
  };
}
