/**
 * Enhanced Tasks Page
 *
 * A comprehensive task management page with:
 * - Subtasks/Checklists
 * - Recurring tasks
 * - Time tracking
 * - Focus timer (Pomodoro)
 * - Snooze functionality
 * - Task dependencies
 * - Pre-due reminders
 * - Settings panel
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
  Flag,
  Search,
  Clock,
  Trash2,
  MoreHorizontal,
  ListTodo,
  AlertCircle,
  CheckCheck,
  Timer,
  Filter,
  Loader2,
  GraduationCap,
  BookOpen,
  Users,
  User,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
  X,
  ArrowUpDown,
  Settings,
  Play,
  Pause,
  RotateCcw,
  BellOff,
  Bell,
  Repeat,
  ListChecks,
  ChevronRight,
  Edit3,
  Coffee,
  Brain,
  Link,
  Unlink,
  Save,
} from "lucide-react";

import { supabase } from "@/utils/supabase";
import { useToast } from "@/hooks/use-toast";
import { isBefore, addDays, format, isToday, isTomorrow, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { clearTaskReminder, resetTaskReminder } from "@/services/taskReminderService";
import { v4 as uuidv4 } from "uuid";

// Import enhanced components
import { FocusTimerDialog, MiniFocusTimer } from "@/components/tasks/FocusTimer";
import { SubtasksList, SubtaskProgress } from "@/components/tasks/SubtasksList";
import { SnoozeMenu, SnoozeStatus } from "@/components/tasks/SnoozeMenu";
import { RecurrenceConfigComponent, RecurrencePreview, DEFAULT_RECURRENCE_CONFIG, type RecurrenceConfig } from "@/components/tasks/RecurrenceConfig";
import { TaskSettings, TaskSettingsButton } from "@/components/tasks/TaskSettings";
import { PRE_REMINDER_OPTIONS, WEEKDAYS, type Task as TaskType, type Subtask, type TaskUpdate } from "@/types/tasks";

// Local Task type that's compatible with database responses (allows string for category/priority)
interface Task {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  due_date: string;
  completed: boolean;
  user_id: string;
  created_at: string;
  dynamic_priority?: string;
  is_recurring: boolean;
  recurrence_type: string | null;
  recurrence_interval: number;
  recurrence_days: number[] | null;
  recurrence_end_date: string | null;
  parent_task_id: string | null;
  recurrence_count: number;
  snoozed_until: string | null;
  snooze_count: number;
  last_reminder_at: string | null;
  reminder_minutes_before: number[];
  subtasks: Subtask[];
  estimated_minutes: number | null;
  time_spent_minutes: number;
  depends_on: string[];
  notes: string | null;
  tags: string[];
}

interface NewTask {
  title: string;
  description: string;
  category: string;
  priority: string;
  due_date: string;
  due_time: string;
  // Enhanced fields
  is_recurring: boolean;
  recurrence_type: string;
  recurrence_interval: number;
  recurrence_days: number[];
  recurrence_end_date: string;
  reminder_minutes_before: number[];
  estimated_minutes: string;
  subtasks: Subtask[];
}

const DEFAULT_NEW_TASK: NewTask = {
  title: "",
  description: "",
  category: "personal",
  priority: "medium",
  due_date: "",
  due_time: "",
  is_recurring: false,
  recurrence_type: "daily",
  recurrence_interval: 1,
  recurrence_days: [1, 2, 3, 4, 5],
  recurrence_end_date: "",
  reminder_minutes_before: [15],
  estimated_minutes: "",
  subtasks: [],
};

const Tasks = () => {
  // State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("due_date");
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [showFocusTimer, setShowFocusTimer] = useState(false);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [newTask, setNewTask] = useState<NewTask>(DEFAULT_NEW_TASK);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [activeTab, setActiveTab] = useState("details");
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState<Partial<Task>>({});

  const { toast } = useToast();



  // Calculate time remaining with friendly format
  const getTimeRemaining = (dueDateUTC: string): { text: string; isOverdue: boolean; isUrgent: boolean; shortText: string } => {
    try {
      const dueDate = new Date(dueDateUTC);
      const now = new Date();
      const diffMs = dueDate.getTime() - now.getTime();

      if (diffMs < 0) {
        const text = formatDistanceToNow(dueDate, { addSuffix: false }) + " overdue";
        return { text, isOverdue: true, isUrgent: true, shortText: "Overdue" };
      }

      if (isToday(dueDate)) {
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 0) {
          return { text: `Due in ${hours}h ${minutes}m`, isOverdue: false, isUrgent: hours <= 2, shortText: `${hours}h` };
        }
        return { text: `Due in ${minutes} minutes`, isOverdue: false, isUrgent: true, shortText: `${minutes}m` };
      }

      if (isTomorrow(dueDate)) {
        return { text: "Due tomorrow", isOverdue: false, isUrgent: false, shortText: "Tomorrow" };
      }

      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        return { text: `Due in ${diffDays} days`, isOverdue: false, isUrgent: diffDays <= 2, shortText: `${diffDays}d` };
      }

      return { text: format(dueDate, "MMM d"), isOverdue: false, isUrgent: false, shortText: format(dueDate, "MMM d") };
    } catch {
      return { text: "No date", isOverdue: false, isUrgent: false, shortText: "—" };
    }
  };

  // Format date for display
  const formatDateForDisplay = (utcDateString: string): string => {
    try {
      const date = new Date(utcDateString);
      return format(date, "EEE, MMM d, yyyy 'at' h:mm a");
    } catch {
      return "Invalid date";
    }
  };

  // Calculate dynamic priority
  const calculateDynamicPriority = (dueDate: string, userPriority: string): string => {
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

    const levelToPriority: Record<number, string> = { 0: "high", 1: "medium", 2: "low" };
    return levelToPriority[urgencyLevel] || userPriority;
  };

  // Fetch tasks
  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Error",
          description: "Please sign in to view your tasks.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      console.log(data);

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        const updatedTasks = (data || []).map((task) => ({
          ...task,
          subtasks: task.subtasks || [],
          depends_on: task.depends_on || [],
          tags: task.tags || [],
          reminder_minutes_before: task.reminder_minutes_before || [15],
          dynamic_priority: calculateDynamicPriority(task.due_date, task.priority),
        }));
        setTasks(updatedTasks);
      }
      setLoading(false);
    };

    fetchTasks();
  }, [toast]);

  // Add new task
  const handleAddTask = async () => {
    if (!newTask.title.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a task title.",
        variant: "destructive",
      });
      return;
    }

    if (!newTask.due_date) {
      toast({
        title: "Due Date Required",
        description: "Please select a due date.",
        variant: "destructive",
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast({
        title: "Error",
        description: "Please sign in to add tasks.",
        variant: "destructive",
      });
      return;
    }

    let dueDate: Date;
    if (newTask.due_time) {
      dueDate = new Date(`${newTask.due_date}T${newTask.due_time}`);
    } else {
      dueDate = new Date(`${newTask.due_date}T09:00:00`);
    }

    if (isNaN(dueDate.getTime())) {
      toast({
        title: "Invalid Date",
        description: "Please enter a valid date and time.",
        variant: "destructive",
      });
      return;
    }

    const taskToAdd = {
      user_id: user.id,
      title: newTask.title.trim(),
      description: newTask.description.trim() || null,
      category: newTask.category,
      priority: newTask.priority,
      due_date: dueDate.toISOString(),
      completed: false,
      is_recurring: newTask.is_recurring,
      recurrence_type: newTask.is_recurring ? newTask.recurrence_type : null,
      recurrence_interval: newTask.recurrence_interval,
      recurrence_days: newTask.is_recurring && newTask.recurrence_type === "weekly" ? newTask.recurrence_days : null,
      recurrence_end_date: newTask.recurrence_end_date ? new Date(newTask.recurrence_end_date).toISOString() : null,
      reminder_minutes_before: newTask.reminder_minutes_before,
      estimated_minutes: newTask.estimated_minutes ? parseInt(newTask.estimated_minutes) : null,
      subtasks: newTask.subtasks,
    };

    const { data, error } = await supabase.from("tasks").insert([taskToAdd]).select();

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else if (data && data[0]) {
      const addedTask: Task = {
        ...data[0],
        category: data[0].category as string,
        priority: data[0].priority as string,
        subtasks: data[0].subtasks || [],
        depends_on: data[0].depends_on || [],
        tags: data[0].tags || [],
        reminder_minutes_before: data[0].reminder_minutes_before || [15],
        dynamic_priority: calculateDynamicPriority(data[0].due_date, data[0].priority),
      } as Task;
      setTasks([addedTask, ...tasks]);
      setShowAddDialog(false);
      setNewTask(DEFAULT_NEW_TASK);
      toast({
        title: "Task Created",
        description: newTask.is_recurring ? "Your recurring task has been scheduled." : "Your task has been added successfully.",
      });
    }
  };

  // Toggle task completion
  const handleToggleCompleted = async (task: Task, e?: React.MouseEvent) => {
    e?.stopPropagation();

    const { data, error } = await supabase
      .from("tasks")
      .update({ completed: !task.completed })
      .eq("id", task.id)
      .select();

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else if (data && data[0]) {
      setTasks(
        tasks.map((t) =>
          t.id === task.id
            ? { ...t, completed: data[0].completed, dynamic_priority: calculateDynamicPriority(t.due_date, t.priority) }
            : t
        )
      );

      clearTaskReminder(task.id);

      if (data[0].completed) {
        toast({
          title: "Task Completed",
          description: task.is_recurring ? "Nice! The next occurrence has been scheduled." : "Great job on finishing that task!",
        });
      }
    }
  };

  // Delete task
  const handleDeleteTask = async (task: Task) => {
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      clearTaskReminder(task.id);
      setTasks(tasks.filter((t) => t.id !== task.id));
      setTaskToDelete(null);
      setShowTaskDetail(false);
      toast({
        title: "Task Deleted",
        description: "The task has been removed.",
      });
    }
  };

  // Update task
  const handleUpdateTask = async (taskId: string, updates: Partial<Task>): Promise<Task | null> => {
    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", taskId)
      .select()
      .single();

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    const updatedTask = {
      ...data,
      subtasks: data.subtasks || [],
      depends_on: data.depends_on || [],
      tags: data.tags || [],
      reminder_minutes_before: data.reminder_minutes_before || [15],
      dynamic_priority: calculateDynamicPriority(data.due_date, data.priority),
    };

    setTasks(tasks.map((t) => (t.id === taskId ? updatedTask : t)));

    if (selectedTask?.id === taskId) {
      setSelectedTask(updatedTask);
    }

    if (updates.due_date) {
      resetTaskReminder(taskId);
    }

    return updatedTask;
  };

  // Add subtask to new task
  const handleAddNewSubtask = () => {
    if (!newSubtaskTitle.trim()) return;

    const subtask: Subtask = {
      id: uuidv4(),
      title: newSubtaskTitle.trim(),
      completed: false,
      order: newTask.subtasks.length,
    };

    setNewTask({
      ...newTask,
      subtasks: [...newTask.subtasks, subtask],
    });
    setNewSubtaskTitle("");
  };

  // Remove subtask from new task
  const handleRemoveNewSubtask = (subtaskId: string) => {
    setNewTask({
      ...newTask,
      subtasks: newTask.subtasks.filter((s) => s.id !== subtaskId),
    });
  };

  // Toggle new task subtask
  const handleToggleNewSubtask = (subtaskId: string) => {
    setNewTask({
      ...newTask,
      subtasks: newTask.subtasks.map((s) =>
        s.id === subtaskId ? { ...s, completed: !s.completed } : s
      ),
    });
  };

  // Start focus timer for task
  const handleStartFocus = (task: Task) => {
    setFocusTask(task);
    setShowFocusTimer(true);
  };

  // Toggle reminder option
  const toggleReminderOption = (minutes: number) => {
    const current = newTask.reminder_minutes_before;
    if (current.includes(minutes)) {
      setNewTask({
        ...newTask,
        reminder_minutes_before: current.filter((m) => m !== minutes),
      });
    } else {
      setNewTask({
        ...newTask,
        reminder_minutes_before: [...current, minutes].sort((a, b) => a - b),
      });
    }
  };

  // Toggle weekday for recurrence
  const toggleWeekday = (day: number) => {
    const current = newTask.recurrence_days;
    if (current.includes(day)) {
      setNewTask({
        ...newTask,
        recurrence_days: current.filter((d) => d !== day),
      });
    } else {
      setNewTask({
        ...newTask,
        recurrence_days: [...current, day].sort(),
      });
    }
  };

  // Get priority config
  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case "high":
        return {
          label: "High",
          color: "text-red-600 dark:text-red-400",
          bg: "bg-red-50 dark:bg-red-950/30",
          border: "border-red-200 dark:border-red-800",
          dot: "bg-red-500",
          gradient: "from-red-500/20 via-red-500/5 to-transparent",
        };
      case "medium":
        return {
          label: "Medium",
          color: "text-amber-600 dark:text-amber-400",
          bg: "bg-amber-50 dark:bg-amber-950/30",
          border: "border-amber-200 dark:border-amber-800",
          dot: "bg-amber-500",
          gradient: "from-amber-500/20 via-amber-500/5 to-transparent",
        };
      case "low":
        return {
          label: "Low",
          color: "text-emerald-600 dark:text-emerald-400",
          bg: "bg-emerald-50 dark:bg-emerald-950/30",
          border: "border-emerald-200 dark:border-emerald-800",
          dot: "bg-emerald-500",
          gradient: "from-emerald-500/20 via-emerald-500/5 to-transparent",
        };
      default:
        return {
          label: "—",
          color: "text-gray-600",
          bg: "bg-gray-50",
          border: "border-gray-200",
          dot: "bg-gray-500",
          gradient: "from-gray-500/20 via-gray-500/5 to-transparent",
        };
    }
  };

  // Get category config
  const getCategoryConfig = (category: string) => {
    switch (category) {
      case "academic":
        return {
          icon: GraduationCap,
          label: "Academic",
          color: "text-indigo-600 dark:text-indigo-400",
          bg: "bg-indigo-100 dark:bg-indigo-900/40",
        };
      case "study":
        return {
          icon: BookOpen,
          label: "Study",
          color: "text-blue-600 dark:text-blue-400",
          bg: "bg-blue-100 dark:bg-blue-900/40",
        };
      case "collaborative":
        return {
          icon: Users,
          label: "Team",
          color: "text-purple-600 dark:text-purple-400",
          bg: "bg-purple-100 dark:bg-purple-900/40",
        };
      case "personal":
      default:
        return {
          icon: User,
          label: "Personal",
          color: "text-teal-600 dark:text-teal-400",
          bg: "bg-teal-100 dark:bg-teal-900/40",
        };
    }
  };

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        const matchesSearch =
          task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          task.description?.toLowerCase().includes(searchTerm.toLowerCase());

        let matchesFilter = true;
        switch (selectedFilter) {
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
          case "high":
          case "medium":
          case "low":
            matchesFilter = task.dynamic_priority === selectedFilter && !task.completed;
            break;
        }

        const matchesCategory = selectedCategory === "all" || task.category === selectedCategory;

        return matchesSearch && matchesFilter && matchesCategory;
      })
      .sort((a, b) => {
        // Completed tasks always at bottom
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }

        switch (sortBy) {
          case "due_date":
            return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          case "priority": {
            const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
            return (priorityOrder[a.dynamic_priority || "medium"] || 2) - (priorityOrder[b.dynamic_priority || "medium"] || 2);
          }
          case "created":
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          default:
            return 0;
        }
      });
  }, [tasks, searchTerm, selectedFilter, selectedCategory, sortBy]);

  // Stats
  const stats = useMemo(() => ({
    total: tasks.length,
    pending: tasks.filter((t) => !t.completed).length,
    completed: tasks.filter((t) => t.completed).length,
    overdue: tasks.filter((t) => !t.completed && new Date(t.due_date) < new Date()).length,
    today: tasks.filter((t) => !t.completed && isToday(new Date(t.due_date))).length,
    highPriority: tasks.filter((t) => t.dynamic_priority === "high" && !t.completed).length,
    recurring: tasks.filter((t) => t.is_recurring).length,
  }), [tasks]);

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  // Filter chips
  const filterChips = [
    { value: "all", label: "All", count: stats.total },
    { value: "pending", label: "To Do", count: stats.pending },
    { value: "today", label: "Today", count: stats.today, highlight: stats.today > 0 },
    { value: "overdue", label: "Overdue", count: stats.overdue, danger: stats.overdue > 0 },
    { value: "completed", label: "Done", count: stats.completed },
    { value: "recurring", label: "Recurring", count: stats.recurring, icon: Repeat },
  ];

  // Get subtask progress
  const getSubtaskProgress = (subtasks: Subtask[]): { completed: number; total: number; percentage: number } => {
    if (!subtasks || subtasks.length === 0) return { completed: 0, total: 0, percentage: 0 };
    const completed = subtasks.filter((s) => s.completed).length;
    return {
      completed,
      total: subtasks.length,
      percentage: Math.round((completed / subtasks.length) * 100),
    };
  };

  // Check if task is snoozed
  const isTaskSnoozed = (task: Task): boolean => {
    if (!task.snoozed_until) return false;
    return new Date(task.snoozed_until) > new Date();
  };

  // Format time spent
  const formatTimeSpent = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <>
      <div className="min-h-[100dvh] bg-gradient-to-b from-background via-background to-muted/30">
        {/* Main Container */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32 sm:pb-8">
          {/* Header Section */}
          <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-4 border-b border-border/40">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Title and Stats Preview */}
              <div className="flex items-center gap-4">
                <div className="p-2.5 lg:p-3 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl lg:rounded-2xl">
                  <ListTodo className="h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold tracking-tight">Task Manager</h1>
                  <p className="text-xs sm:text-sm lg:text-base text-muted-foreground">
                    {stats.pending} tasks remaining • {completionRate}% complete
                  </p>
                </div>
              </div>

              {/* Search, Settings, and Add Button */}
              <div className="flex items-center gap-3 lg:w-auto lg:min-w-[500px]">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tasks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-10 h-10 lg:h-11 bg-muted/50 border-0 rounded-xl"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {/* Mini Focus Timer */}
                <MiniFocusTimer className="hidden sm:flex" />

                {/* Settings Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSettings(true)}
                  className="h-10 w-10 lg:h-11 lg:w-11"
                >
                  <Settings className="h-5 w-5" />
                </Button>

                {/* Add Task Button */}
                <Button
                  onClick={() => setShowAddDialog(true)}
                  className="gap-2 h-10 lg:h-11 px-4 lg:px-6 shadow-lg bg-primary hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 lg:h-5 lg:w-5" />
                  <span className="hidden sm:inline">New Task</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="mt-6 lg:mt-8 mb-6">
            {/* Mobile: Horizontal scroll */}
            <div className="lg:hidden">
              <ScrollArea className="w-full -mx-4 px-4">
                <div className="flex gap-3 pb-2">
                  <Card className="min-w-[140px] shrink-0 border-0 shadow-sm bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        <span className="text-xl font-bold text-primary">{completionRate}%</span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Completion</p>
                      <div className="mt-2 h-1.5 bg-primary/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="min-w-[100px] shrink-0 border-0 shadow-sm">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-1">
                        <Target className="h-5 w-5 text-blue-500" />
                        <span className="text-xl font-bold">{stats.pending}</span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">To Do</p>
                    </CardContent>
                  </Card>

                  <Card className="min-w-[100px] shrink-0 border-0 shadow-sm">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-1">
                        <CheckCheck className="h-5 w-5 text-emerald-500" />
                        <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.completed}</span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Done</p>
                    </CardContent>
                  </Card>

                  {stats.overdue > 0 && (
                    <Card className="min-w-[100px] shrink-0 border-0 shadow-sm bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center justify-between mb-1">
                          <AlertCircle className="h-5 w-5 text-red-500" />
                          <span className="text-xl font-bold text-red-600 dark:text-red-400">{stats.overdue}</span>
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Overdue</p>
                      </CardContent>
                    </Card>
                  )}

                  {stats.recurring > 0 && (
                    <Card className="min-w-[100px] shrink-0 border-0 shadow-sm">
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center justify-between mb-1">
                          <Repeat className="h-5 w-5 text-purple-500" />
                          <span className="text-xl font-bold text-purple-600 dark:text-purple-400">{stats.recurring}</span>
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Recurring</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
                <ScrollBar orientation="horizontal" className="invisible" />
              </ScrollArea>
            </div>

            {/* Desktop: Full grid */}
            <div className="hidden lg:grid lg:grid-cols-5 gap-4">
              <Card className="border-0 shadow-md bg-gradient-to-br from-primary/10 via-primary/5 to-background">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-3xl font-bold text-primary">{completionRate}%</span>
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">Completion Rate</p>
                  <div className="mt-3 h-2 bg-primary/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-3xl font-bold">{stats.pending}</span>
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">Tasks To Do</p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                      <CheckCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stats.completed}</span>
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">Completed</p>
                </CardContent>
              </Card>

              <Card className={cn(
                "border-0 shadow-md hover:shadow-lg transition-shadow",
                stats.overdue > 0 && "bg-gradient-to-br from-red-500/10 via-red-500/5 to-background"
              )}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <span className={cn("text-3xl font-bold", stats.overdue > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>{stats.overdue}</span>
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">Overdue</p>
                </CardContent>
              </Card>

              <Card className={cn(
                "border-0 shadow-md hover:shadow-lg transition-shadow",
                stats.highPriority > 0 && "bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-background"
              )}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                      <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <span className={cn("text-3xl font-bold", stats.highPriority > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{stats.highPriority}</span>
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">High Priority</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Filter Chips */}
              <ScrollArea className="w-full sm:w-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="flex gap-2 pb-2 sm:pb-0">
                  {filterChips.map((chip) => {
                    const ChipIcon = chip.icon;
                    return (
                      <button
                        key={chip.value}
                        onClick={() => setSelectedFilter(chip.value)}
                        className={cn(
                          "shrink-0 px-3 lg:px-4 py-1.5 lg:py-2 rounded-full text-xs sm:text-sm font-medium transition-all",
                          "flex items-center gap-1.5 lg:gap-2",
                          selectedFilter === chip.value
                            ? "bg-primary text-primary-foreground shadow-md"
                            : chip.danger && chip.count > 0
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                              : chip.highlight && chip.count > 0
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50"
                                : "bg-muted hover:bg-muted/80 text-muted-foreground"
                        )}
                      >
                        {ChipIcon && <ChipIcon className="h-3.5 w-3.5" />}
                        {chip.label}
                        <span className={cn(
                          "text-[10px] lg:text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                          selectedFilter === chip.value
                            ? "bg-primary-foreground/20"
                            : "bg-background/50"
                        )}>
                          {chip.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <ScrollBar orientation="horizontal" className="invisible sm:hidden" />
              </ScrollArea>

              {/* Filter & Sort Controls */}
              <div className="flex items-center gap-2">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="h-9 w-[130px] lg:w-[160px] bg-muted/50 border-0">
                    <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="academic">Academic</SelectItem>
                    <SelectItem value="study">Study</SelectItem>
                    <SelectItem value="collaborative">Team</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-9 w-[120px] lg:w-[140px] bg-muted/50 border-0">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="due_date">Due Date</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="created">Recently Added</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Tasks List */}
          <div className="space-y-3 lg:space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 sm:py-24">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-sm text-muted-foreground">Loading your tasks...</p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-16 sm:py-24 px-4">
                  <div className="p-4 bg-muted/50 rounded-2xl mb-4">
                    {searchTerm || selectedFilter !== "all" || selectedCategory !== "all" ? (
                      <Search className="h-10 w-10 lg:h-12 lg:w-12 text-muted-foreground" />
                    ) : (
                      <Sparkles className="h-10 w-10 lg:h-12 lg:w-12 text-muted-foreground" />
                    )}
                  </div>
                  <h3 className="text-lg lg:text-xl font-semibold mb-2">
                    {searchTerm || selectedFilter !== "all" || selectedCategory !== "all"
                      ? "No tasks found"
                      : "All clear!"}
                  </h3>
                  <p className="text-sm lg:text-base text-muted-foreground text-center mb-6 max-w-md">
                    {searchTerm || selectedFilter !== "all" || selectedCategory !== "all"
                      ? "Try adjusting your search or filters to find what you're looking for"
                      : "You have no tasks yet. Create one to get started on your productivity journey!"}
                  </p>
                  {(searchTerm || selectedFilter !== "all" || selectedCategory !== "all") ? (
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => {
                        setSearchTerm("");
                        setSelectedFilter("all");
                        setSelectedCategory("all");
                      }}
                    >
                      Clear All Filters
                    </Button>
                  ) : (
                    <Button size="lg" onClick={() => setShowAddDialog(true)} className="gap-2">
                      <Plus className="h-5 w-5" />
                      Create Your First Task
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Task Items - Grid on large screens */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4 auto-rows-fr">
                  {filteredTasks.map((task) => {
                    const timeInfo = getTimeRemaining(task.due_date);
                    const priorityConfig = getPriorityConfig(task.dynamic_priority || task.priority);
                    const categoryConfig = getCategoryConfig(task.category);
                    const CategoryIcon = categoryConfig.icon;
                    const subtaskProgress = getSubtaskProgress(task.subtasks);
                    const isSnoozed = isTaskSnoozed(task);

                    return (
                      <Card
                        key={task.id}
                        onClick={() => {
                          setSelectedTask(task);
                          setShowTaskDetail(true);
                          setActiveTab("details");
                        }}
                        className={cn(
                          "border-0 shadow-sm transition-all duration-200 overflow-hidden group",
                          "hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] cursor-pointer",
                          "flex flex-col h-full",
                          task.completed && "opacity-60 hover:opacity-80",
                          !task.completed && `bg-gradient-to-r ${priorityConfig.gradient}`
                        )}
                      >
                        <CardContent className="p-0 flex-1 flex">
                          <div className="flex flex-1">
                            {/* Priority Indicator */}
                            <div className={cn("w-1.5 lg:w-2 shrink-0", priorityConfig.dot)} />

                            {/* Main Content */}
                            <div className="flex-1 p-4 lg:p-5 flex flex-col">
                              <div className="flex items-start gap-3 lg:gap-4">
                                {/* Checkbox */}
                                <button
                                  onClick={(e) => handleToggleCompleted(task, e)}
                                  className={cn(
                                    "mt-0.5 shrink-0 transition-all duration-200",
                                    "active:scale-90 touch-manipulation",
                                    "focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-full"
                                  )}
                                >
                                  {task.completed ? (
                                    <CheckCircle2 className="h-6 w-6 lg:h-7 lg:w-7 text-emerald-500" />
                                  ) : (
                                    <Circle className={cn("h-6 w-6 lg:h-7 lg:w-7 transition-colors", priorityConfig.color, "hover:fill-current hover:fill-opacity-10")} />
                                  )}
                                </button>

                                {/* Task Info */}
                                <div className="flex-1 min-w-0 flex flex-col">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <h3 className={cn(
                                          "font-semibold text-sm sm:text-base lg:text-lg leading-tight truncate",
                                          task.completed && "line-through text-muted-foreground"
                                        )}>
                                          {task.title}
                                        </h3>
                                        {task.is_recurring && (
                                          <Repeat className="h-4 w-4 text-purple-500 shrink-0" />
                                        )}
                                        {isSnoozed && (
                                          <BellOff className="h-4 w-4 text-amber-500 shrink-0" />
                                        )}
                                      </div>
                                    </div>

                                    {/* Actions */}
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 shrink-0 opacity-60 group-hover:opacity-100"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleCompleted(task);
                                        }}>
                                          {task.completed ? (
                                            <>
                                              <Circle className="h-4 w-4 mr-2" />
                                              Mark as To Do
                                            </>
                                          ) : (
                                            <>
                                              <CheckCircle2 className="h-4 w-4 mr-2" />
                                              Mark as Done
                                            </>
                                          )}
                                        </DropdownMenuItem>

                                        {!task.completed && (
                                          <>
                                            <DropdownMenuItem onClick={(e) => {
                                              e.stopPropagation();
                                              handleStartFocus(task);
                                            }}>
                                              <Brain className="h-4 w-4 mr-2" />
                                              Start Focus Session
                                            </DropdownMenuItem>

                                            <DropdownMenuSeparator />

                                            <DropdownMenuLabel className="text-xs text-muted-foreground">
                                              Snooze
                                            </DropdownMenuLabel>
                                            <DropdownMenuItem onClick={(e) => {
                                              e.stopPropagation();
                                              handleUpdateTask(task.id, {
                                                snoozed_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                                                snooze_count: (task.snooze_count || 0) + 1,
                                              });
                                              toast({ title: "Snoozed", description: "Reminder snoozed for 15 minutes." });
                                            }}>
                                              <Clock className="h-4 w-4 mr-2" />
                                              15 minutes
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={(e) => {
                                              e.stopPropagation();
                                              handleUpdateTask(task.id, {
                                                snoozed_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                                                snooze_count: (task.snooze_count || 0) + 1,
                                              });
                                              toast({ title: "Snoozed", description: "Reminder snoozed for 1 hour." });
                                            }}>
                                              <Clock className="h-4 w-4 mr-2" />
                                              1 hour
                                            </DropdownMenuItem>
                                          </>
                                        )}

                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setTaskToDelete(task);
                                          }}
                                          className="text-destructive focus:text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Delete Task
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>

                                  {task.description && (
                                    <p className="text-xs sm:text-sm text-muted-foreground mt-1 lg:mt-2 line-clamp-2">
                                      {task.description}
                                    </p>
                                  )}

                                  {/* Subtask Progress */}
                                  {subtaskProgress.total > 0 && (
                                    <div className="flex items-center gap-2 mt-2">
                                      <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                                      <Progress value={subtaskProgress.percentage} className="h-1.5 flex-1 max-w-[100px]" />
                                      <span className="text-xs text-muted-foreground">
                                        {subtaskProgress.completed}/{subtaskProgress.total}
                                      </span>
                                    </div>
                                  )}

                                  {/* Meta Row */}
                                  <div className="flex-1" />
                                  <div className="flex items-center flex-wrap gap-2 pt-3 lg:pt-4">
                                    {/* Category */}
                                    <div className={cn(
                                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                                      categoryConfig.bg, categoryConfig.color
                                    )}>
                                      <CategoryIcon className="h-3.5 w-3.5" />
                                      {categoryConfig.label}
                                    </div>

                                    {/* Priority */}
                                    <div className={cn(
                                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                                      priorityConfig.bg, priorityConfig.color, priorityConfig.border
                                    )}>
                                      <Flag className="h-3.5 w-3.5" />
                                      {priorityConfig.label}
                                    </div>

                                    {/* Date */}
                                    <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
                                      <Calendar className="h-3.5 w-3.5" />
                                      {format(new Date(task.due_date), "MMM d, yyyy")}
                                    </div>

                                    {/* Time Tracking */}
                                    {task.time_spent_minutes > 0 && (
                                      <div className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
                                        <Timer className="h-3.5 w-3.5" />
                                        {formatTimeSpent(task.time_spent_minutes)}
                                      </div>
                                    )}
                                  </div>

                                  {/* Time Remaining Badge */}
                                  <div className={cn(
                                    "inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg text-xs font-medium w-fit",
                                    task.completed
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                      : isSnoozed
                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                        : timeInfo.isOverdue
                                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                          : timeInfo.isUrgent
                                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                            : "bg-muted text-muted-foreground"
                                  )}>
                                    <Clock className="h-3.5 w-3.5" />
                                    {task.completed ? "Completed" : isSnoozed ? "Snoozed" : timeInfo.text}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Summary footer */}
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  Showing {filteredTasks.length} of {stats.total} tasks
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Floating Add Button - Mobile only */}
      <Button
        onClick={() => setShowAddDialog(true)}
        size="lg"
        className="sm:hidden fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-xl z-50"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Add Task Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              Create New Task
            </DialogTitle>
            <DialogDescription>
              What do you need to accomplish? Fill in the details below.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Complete math homework"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="h-11"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Add more details about this task..."
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Category and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Category</Label>
                  <Select
                    value={newTask.category}
                    onValueChange={(value) => setNewTask({ ...newTask, category: value })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Personal
                        </div>
                      </SelectItem>
                      <SelectItem value="academic">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4" />
                          Academic
                        </div>
                      </SelectItem>
                      <SelectItem value="study">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          Study
                        </div>
                      </SelectItem>
                      <SelectItem value="collaborative">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Team
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Priority</Label>
                  <Select
                    value={newTask.priority}
                    onValueChange={(value) => setNewTask({ ...newTask, priority: value })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-red-500" />
                          High
                        </div>
                      </SelectItem>
                      <SelectItem value="medium">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-amber-500" />
                          Medium
                        </div>
                      </SelectItem>
                      <SelectItem value="low">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-emerald-500" />
                          Low
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Estimated Time */}
              <div className="space-y-2">
                <Label htmlFor="estimated" className="text-sm font-medium">Estimated Time (minutes)</Label>
                <Input
                  id="estimated"
                  type="number"
                  placeholder="e.g., 30"
                  value={newTask.estimated_minutes}
                  onChange={(e) => setNewTask({ ...newTask, estimated_minutes: e.target.value })}
                  className="h-11"
                />
              </div>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4 mt-4">
              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="due_date" className="text-sm font-medium">Due Date *</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_time" className="text-sm font-medium">Due Time</Label>
                  <Input
                    id="due_time"
                    type="time"
                    value={newTask.due_time}
                    onChange={(e) => setNewTask({ ...newTask, due_time: e.target.value })}
                    className="h-11"
                  />
                </div>
              </div>

              {/* Reminders */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Reminders</Label>
                <div className="flex flex-wrap gap-2">
                  {PRE_REMINDER_OPTIONS.map((option) => (
                    <button
                      key={option.minutes}
                      type="button"
                      onClick={() => toggleReminderOption(option.minutes)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                        newTask.reminder_minutes_before.includes(option.minutes)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Recurring Task */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Recurring Task</Label>
                  </div>
                  <Switch
                    checked={newTask.is_recurring}
                    onCheckedChange={(checked) => setNewTask({ ...newTask, is_recurring: checked })}
                  />
                </div>

                {newTask.is_recurring && (
                  <div className="space-y-4 pl-6 border-l-2 border-primary/20">
                    {/* Recurrence Type */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Repeat</Label>
                      <Select
                        value={newTask.recurrence_type}
                        onValueChange={(value) => setNewTask({ ...newTask, recurrence_type: value })}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Interval */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Every</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          value={newTask.recurrence_interval}
                          onChange={(e) => setNewTask({ ...newTask, recurrence_interval: parseInt(e.target.value) || 1 })}
                          className="h-10 w-20"
                        />
                        <span className="text-sm text-muted-foreground">
                          {newTask.recurrence_type === "daily" ? "day(s)" :
                            newTask.recurrence_type === "weekly" ? "week(s)" :
                              newTask.recurrence_type === "monthly" ? "month(s)" : "year(s)"}
                        </span>
                      </div>
                    </div>

                    {/* Weekday Selection (for weekly) */}
                    {newTask.recurrence_type === "weekly" && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">On Days</Label>
                        <div className="flex gap-1">
                          {WEEKDAYS.map((day) => (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => toggleWeekday(day.value)}
                              className={cn(
                                "h-9 w-9 rounded-full text-xs font-medium transition-colors",
                                newTask.recurrence_days.includes(day.value)
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted hover:bg-muted/80"
                              )}
                            >
                              {day.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* End Date */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">End Date (optional)</Label>
                      <Input
                        type="date"
                        value={newTask.recurrence_end_date}
                        onChange={(e) => setNewTask({ ...newTask, recurrence_end_date: e.target.value })}
                        className="h-10"
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="subtasks" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Subtasks / Checklist</Label>
                <p className="text-xs text-muted-foreground">Break down this task into smaller steps</p>
              </div>

              {/* Add Subtask Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Add a subtask..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddNewSubtask();
                    }
                  }}
                  className="h-10"
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={handleAddNewSubtask}
                  disabled={!newSubtaskTitle.trim()}
                  className="h-10 w-10 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Subtasks List */}
              {newTask.subtasks.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {newTask.subtasks.map((subtask) => (
                    <div
                      key={subtask.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleNewSubtask(subtask.id)}
                        className="shrink-0"
                      >
                        {subtask.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                      <span className={cn(
                        "flex-1 text-sm",
                        subtask.completed && "line-through text-muted-foreground"
                      )}>
                        {subtask.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveNewSubtask(subtask.id)}
                        className="shrink-0 p-1 rounded-full hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <ListChecks className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No subtasks yet</p>
                  <p className="text-xs text-muted-foreground">Add subtasks to break down this task</p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTask} disabled={!newTask.title.trim() || !newTask.due_date}>
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Sheet */}
      <Sheet open={showTaskDetail} onOpenChange={setShowTaskDetail}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedTask && (
            <>
              <SheetHeader>
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleToggleCompleted(selectedTask)}
                    className="mt-1 shrink-0"
                  >
                    {selectedTask.completed ? (
                      <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                    ) : (
                      <Circle className={cn("h-7 w-7", getPriorityConfig(selectedTask.dynamic_priority || selectedTask.priority).color)} />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <SheetTitle className={cn(
                      "text-xl text-left",
                      selectedTask.completed && "line-through text-muted-foreground"
                    )}>
                      {selectedTask.title}
                    </SheetTitle>
                    <SheetDescription className="text-left mt-1">
                      Created {format(new Date(selectedTask.created_at), "MMM d, yyyy")}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Status Badges */}
                <div className="flex flex-wrap gap-2">
                  {/* Priority */}
                  <Badge className={cn(
                    "gap-1",
                    getPriorityConfig(selectedTask.dynamic_priority || selectedTask.priority).bg,
                    getPriorityConfig(selectedTask.dynamic_priority || selectedTask.priority).color,
                    getPriorityConfig(selectedTask.dynamic_priority || selectedTask.priority).border
                  )}>
                    <Flag className="h-3 w-3" />
                    {getPriorityConfig(selectedTask.dynamic_priority || selectedTask.priority).label} Priority
                  </Badge>

                  {/* Category */}
                  <Badge variant="secondary" className="gap-1">
                    {(() => {
                      const config = getCategoryConfig(selectedTask.category);
                      const Icon = config.icon;
                      return (
                        <>
                          <Icon className="h-3 w-3" />
                          {config.label}
                        </>
                      );
                    })()}
                  </Badge>

                  {/* Recurring */}
                  {selectedTask.is_recurring && (
                    <Badge variant="secondary" className="gap-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                      <Repeat className="h-3 w-3" />
                      Recurring
                    </Badge>
                  )}

                  {/* Snoozed */}
                  {isTaskSnoozed(selectedTask) && (
                    <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      <BellOff className="h-3 w-3" />
                      Snoozed
                    </Badge>
                  )}
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="w-full grid grid-cols-3">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="subtasks">
                      Subtasks
                      {selectedTask.subtasks.length > 0 && (
                        <span className="ml-1.5 text-xs bg-muted px-1.5 rounded">
                          {selectedTask.subtasks.filter(s => s.completed).length}/{selectedTask.subtasks.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="time">Time</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="mt-4 space-y-4">
                    {/* Description */}
                    {selectedTask.description && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Description</Label>
                        <p className="text-sm">{selectedTask.description}</p>
                      </div>
                    )}

                    {/* Due Date */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Due Date</Label>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{formatDateForDisplay(selectedTask.due_date)}</span>
                      </div>
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium w-fit",
                        selectedTask.completed
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : getTimeRemaining(selectedTask.due_date).isOverdue
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : getTimeRemaining(selectedTask.due_date).isUrgent
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-muted text-muted-foreground"
                      )}>
                        <Clock className="h-3.5 w-3.5" />
                        {selectedTask.completed ? "Completed" : getTimeRemaining(selectedTask.due_date).text}
                      </div>
                    </div>

                    {/* Reminders */}
                    {selectedTask.reminder_minutes_before.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Reminders</Label>
                        <div className="flex flex-wrap gap-2">
                          {selectedTask.reminder_minutes_before.map((mins) => {
                            const option = PRE_REMINDER_OPTIONS.find(o => o.minutes === mins);
                            return (
                              <Badge key={mins} variant="outline" className="gap-1">
                                <Bell className="h-3 w-3" />
                                {option?.label || `${mins}m before`}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Recurrence Info */}
                    {selectedTask.is_recurring && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Recurrence</Label>
                        <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                          <div className="flex items-center gap-2 text-sm">
                            <Repeat className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            <span>
                              Repeats {selectedTask.recurrence_type}
                              {selectedTask.recurrence_interval > 1 && ` every ${selectedTask.recurrence_interval} ${selectedTask.recurrence_type === "daily" ? "days" : selectedTask.recurrence_type === "weekly" ? "weeks" : selectedTask.recurrence_type === "monthly" ? "months" : "years"}`}
                            </span>
                          </div>
                          {selectedTask.recurrence_days && selectedTask.recurrence_days.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {WEEKDAYS.map(day => (
                                <span
                                  key={day.value}
                                  className={cn(
                                    "h-6 w-6 rounded-full flex items-center justify-center text-xs",
                                    selectedTask.recurrence_days?.includes(day.value)
                                      ? "bg-purple-200 text-purple-700 dark:bg-purple-800 dark:text-purple-200"
                                      : "bg-muted text-muted-foreground"
                                  )}
                                >
                                  {day.label[0]}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Dependencies */}
                    {selectedTask.depends_on && selectedTask.depends_on.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Dependencies</Label>
                        <div className="space-y-2">
                          {selectedTask.depends_on.map((depId) => {
                            const depTask = tasks.find(t => t.id === depId);
                            if (!depTask) return null;
                            return (
                              <div key={depId} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                                {depTask.completed ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                ) : (
                                  <Circle className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className={cn("text-sm", depTask.completed && "line-through text-muted-foreground")}>
                                  {depTask.title}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="subtasks" className="mt-4">
                    <SubtasksList
                      task={selectedTask as unknown as TaskType}
                      onUpdate={(updates) => handleUpdateTask(selectedTask.id, updates) as Promise<TaskType | null>}
                    />
                  </TabsContent>

                  <TabsContent value="time" className="mt-4 space-y-4">
                    {/* Time Summary */}
                    <div className="grid grid-cols-2 gap-4">
                      <Card className="border-0 shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Target className="h-4 w-4 text-blue-500" />
                            <span className="text-xs text-muted-foreground">Estimated</span>
                          </div>
                          <p className="text-lg font-semibold">
                            {selectedTask.estimated_minutes ? formatTimeSpent(selectedTask.estimated_minutes) : "—"}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="border-0 shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Timer className="h-4 w-4 text-emerald-500" />
                            <span className="text-xs text-muted-foreground">Time Spent</span>
                          </div>
                          <p className="text-lg font-semibold">
                            {selectedTask.time_spent_minutes > 0 ? formatTimeSpent(selectedTask.time_spent_minutes) : "—"}
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Progress */}
                    {selectedTask.estimated_minutes && selectedTask.estimated_minutes > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">
                            {Math.min(100, Math.round((selectedTask.time_spent_minutes / selectedTask.estimated_minutes) * 100))}%
                          </span>
                        </div>
                        <Progress
                          value={Math.min(100, (selectedTask.time_spent_minutes / selectedTask.estimated_minutes) * 100)}
                          className="h-2"
                        />
                      </div>
                    )}

                    {/* Focus Timer Button */}
                    {!selectedTask.completed && (
                      <Button
                        onClick={() => {
                          handleStartFocus(selectedTask);
                          setShowTaskDetail(false);
                        }}
                        className="w-full gap-2"
                        size="lg"
                      >
                        <Brain className="h-5 w-5" />
                        Start Focus Session
                      </Button>
                    )}
                  </TabsContent>
                </Tabs>

                <Separator />

                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                  {!selectedTask.completed && (
                    <SnoozeMenu
                      task={selectedTask as unknown as TaskType}
                      trigger={
                        <Button variant="outline" className="w-full gap-2">
                          <BellOff className="h-4 w-4" />
                          Snooze Reminder
                        </Button>
                      }
                      onSnooze={() => {
                        // Refresh the task
                      }}
                    />
                  )}

                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => handleToggleCompleted(selectedTask)}
                  >
                    {selectedTask.completed ? (
                      <>
                        <Circle className="h-4 w-4" />
                        Mark as To Do
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Mark as Done
                      </>
                    )}
                  </Button>

                  <Button
                    variant="destructive"
                    className="w-full gap-2"
                    onClick={() => {
                      setShowTaskDetail(false);
                      setTaskToDelete(selectedTask);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Task
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Task Settings */}
      <TaskSettings open={showSettings} onOpenChange={setShowSettings} />

      {/* Focus Timer Dialog */}
      <FocusTimerDialog
        open={showFocusTimer}
        onOpenChange={setShowFocusTimer}
        task={focusTask as unknown as TaskType | undefined}
        tasks={tasks.filter(t => !t.completed) as unknown as TaskType[]}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{taskToDelete?.title}"? This action cannot be undone.
              {taskToDelete?.subtasks && taskToDelete.subtasks.length > 0 && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                  This task has {taskToDelete.subtasks.length} subtask(s) that will also be deleted.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => taskToDelete && handleDeleteTask(taskToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Tasks;
