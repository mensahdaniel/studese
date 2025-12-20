import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "@/components/ui/dropdown-menu";

import {
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
  Flag,
  Search,
  Clock,
  Trash2,
  MoreVertical,
  ListTodo,
  AlertCircle,
  CheckCheck,
  Timer,
  Filter,
  SortAsc,
  Loader2,
  GraduationCap,
  BookOpen,
  Users,
  User,
  Settings2,
} from "lucide-react";

import { supabase } from "@/utils/supabase";
import { useToast } from "@/hooks/use-toast";
import { isBefore, subDays, addDays, format } from "date-fns";
import { cn } from "@/lib/utils";
import { forceCheckReminders, clearTaskReminder } from "@/services/taskReminderService";

interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  due_date: string;
  completed: boolean;
  user_id: string;
  created_at: string;
  dynamic_priority?: string;
  reminder_triggered?: boolean;
}

interface NewTask {
  title: string;
  description: string;
  category: string;
  priority: string;
  due_date: string;
  due_time: string;
}

const Tasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("due_date");
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { toast } = useToast();

  const [newTask, setNewTask] = useState<NewTask>({
    title: "",
    description: "",
    category: "personal",
    priority: "medium",
    due_date: "",
    due_time: "",
  });

  // Trigger a check when tasks change (handled by global taskReminderService)
  useEffect(() => {
    if (tasks.length > 0) {
      forceCheckReminders();
    }
  }, [tasks]);

  // Calculate time remaining
  const getTimeRemaining = (dueDateUTC: string): { text: string; isOverdue: boolean; isUrgent: boolean } => {
    try {
      const dueDate = new Date(dueDateUTC);
      const now = new Date();
      const diffMs = dueDate.getTime() - now.getTime();

      if (diffMs < 0) {
        const absDiffMs = Math.abs(diffMs);
        const diffMinutes = Math.floor(absDiffMs / (1000 * 60));
        const diffHours = Math.floor(absDiffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));

        let text = "";
        if (diffDays > 0) {
          text = `${diffDays}d overdue`;
        } else if (diffHours > 0) {
          text = `${diffHours}h overdue`;
        } else {
          text = `${diffMinutes}m overdue`;
        }
        return { text, isOverdue: true, isUrgent: true };
      } else {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        let text = "";
        let isUrgent = false;

        if (diffDays > 0) {
          text = `in ${diffDays}d`;
        } else if (diffHours > 0) {
          text = `in ${diffHours}h`;
          isUrgent = diffHours <= 2;
        } else if (diffMinutes > 0) {
          text = `in ${diffMinutes}m`;
          isUrgent = true;
        } else {
          text = "due now";
          isUrgent = true;
        }
        return { text, isOverdue: false, isUrgent };
      }
    } catch {
      return { text: "Invalid date", isOverdue: false, isUrgent: false };
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

    // Priority order for comparison (lower number = higher priority)
    const priorityLevel: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const userLevel = priorityLevel[userPriority] ?? 1;

    let urgencyLevel = userLevel; // Start with user's selected priority

    // Upgrade priority based on due date urgency (never downgrade)
    if (isBefore(due, now)) {
      // Overdue - always high priority
      urgencyLevel = 0;
    } else if (isBefore(due, addDays(now, 2))) {
      // Due within 2 days - at least high priority
      urgencyLevel = Math.min(urgencyLevel, 0);
    } else if (isBefore(due, addDays(now, 7))) {
      // Due within 7 days - at least medium priority
      urgencyLevel = Math.min(urgencyLevel, 1);
    }

    // Convert back to priority string
    const levelToPriority: Record<number, string> = { 0: "high", 1: "medium", 2: "low" };
    return levelToPriority[urgencyLevel] || userPriority;
  };

  // Fetch tasks
  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

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

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        const updatedTasks = (data || []).map((task) => ({
          ...task,
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

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
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      category: newTask.category,
      priority: newTask.priority,
      due_date: dueDate.toISOString(),
      user_id: user.id,
      completed: false,
    };

    const { data, error } = await supabase.from("tasks").insert([taskToAdd]).select();

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else if (data && data[0]) {
      const addedTask = {
        ...data[0],
        dynamic_priority: calculateDynamicPriority(data[0].due_date, data[0].priority),
      };
      setTasks([addedTask, ...tasks]);
      setShowAddDialog(false);
      setNewTask({
        title: "",
        description: "",
        category: "personal",
        priority: "medium",
        due_date: "",
        due_time: "",
      });
      toast({
        title: "Task Created",
        description: "Your task has been added successfully.",
      });
    }
  };

  // Toggle task completion
  const handleToggleCompleted = async (task: Task) => {
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

      // Clear the reminder so it can trigger again if task is uncompleted
      clearTaskReminder(task.id);

      if (data[0].completed) {
        toast({
          title: "Task Completed",
          description: "Great job!",
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
      // Clear any pending reminder for this task
      clearTaskReminder(task.id);

      setTasks(tasks.filter((t) => t.id !== task.id));
      toast({
        title: "Task Deleted",
        description: "The task has been removed.",
      });
    }
  };

  // Get priority styles
  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case "high":
        return {
          badge: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400",
          icon: "text-red-500",
          bar: "bg-red-500",
        };
      case "medium":
        return {
          badge: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
          icon: "text-amber-500",
          bar: "bg-amber-500",
        };
      case "low":
        return {
          badge: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
          icon: "text-emerald-500",
          bar: "bg-emerald-500",
        };
      default:
        return {
          badge: "bg-gray-100 text-gray-700 border-gray-200",
          icon: "text-gray-500",
          bar: "bg-gray-500",
        };
    }
  };

  // Get category icon and styles
  const getCategoryInfo = (category: string) => {
    switch (category) {
      case "academic":
        return {
          icon: GraduationCap,
          label: "Academic",
          styles: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
        };
      case "study":
        return {
          icon: BookOpen,
          label: "Study",
          styles: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        };
      case "collaborative":
        return {
          icon: Users,
          label: "Collaborative",
          styles: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
        };
      case "personal":
      default:
        return {
          icon: User,
          label: "Personal",
          styles: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
        };
    }
  };

  // Filter and sort tasks
  const filteredTasks = tasks
    .filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesFilter = true;
      if (selectedFilter === "pending") matchesFilter = !task.completed;
      else if (selectedFilter === "completed") matchesFilter = task.completed;
      else if (selectedFilter === "overdue") matchesFilter = !task.completed && new Date(task.due_date) < new Date();
      else if (selectedFilter === "high" || selectedFilter === "medium" || selectedFilter === "low") {
        matchesFilter = task.dynamic_priority === selectedFilter;
      }

      const matchesCategory = selectedCategory === "all" || task.category === selectedCategory;

      return matchesSearch && matchesFilter && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === "due_date") {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      } else if (sortBy === "priority") {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return (priorityOrder[a.dynamic_priority as keyof typeof priorityOrder] || 2) -
          (priorityOrder[b.dynamic_priority as keyof typeof priorityOrder] || 2);
      } else if (sortBy === "created") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return 0;
    });

  // Stats
  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => !t.completed).length,
    completed: tasks.filter((t) => t.completed).length,
    overdue: tasks.filter((t) => !t.completed && new Date(t.due_date) < new Date()).length,
    highPriority: tasks.filter((t) => t.dynamic_priority === "high" && !t.completed).length,
  };

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <ListTodo className="h-7 w-7 text-primary" />
                </div>
                Task Manager
              </h1>
              <p className="text-muted-foreground mt-1">
                Stay organized and never miss a deadline
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Add task button */}
              <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Task
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{stats.pending}</p>
                    <p className="text-xs text-muted-foreground font-medium">Pending</p>
                  </div>
                  <div className="p-2 bg-blue-100 rounded-lg dark:bg-blue-900/30">
                    <Circle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
                    <p className="text-xs text-muted-foreground font-medium">Completed</p>
                  </div>
                  <div className="p-2 bg-emerald-100 rounded-lg dark:bg-emerald-900/30">
                    <CheckCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
                    <p className="text-xs text-muted-foreground font-medium">Overdue</p>
                  </div>
                  <div className="p-2 bg-red-100 rounded-lg dark:bg-red-900/30">
                    <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-amber-600">{stats.highPriority}</p>
                    <p className="text-xs text-muted-foreground font-medium">High Priority</p>
                  </div>
                  <div className="p-2 bg-amber-100 rounded-lg dark:bg-amber-900/30">
                    <Flag className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-primary">{completionRate}%</p>
                    <p className="text-xs text-muted-foreground font-medium">Completion</p>
                  </div>
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Timer className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${completionRate}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <Card className="mb-6 border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tasks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-muted/50 border-0"
                  />
                </div>

                {/* Status Filter */}
                <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                  <SelectTrigger className="w-full md:w-[140px] bg-muted/50 border-0">
                    <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tasks</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="high">High Priority</SelectItem>
                    <SelectItem value="medium">Medium Priority</SelectItem>
                    <SelectItem value="low">Low Priority</SelectItem>
                  </SelectContent>
                </Select>

                {/* Category Filter */}
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full md:w-[160px] bg-muted/50 border-0">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="academic">Academic</SelectItem>
                    <SelectItem value="study">Study</SelectItem>
                    <SelectItem value="collaborative">Collaborative</SelectItem>
                  </SelectContent>
                </Select>

                {/* Sort */}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full md:w-[140px] bg-muted/50 border-0">
                    <SortAsc className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="due_date">Due Date</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="created">Created</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Tasks List */}
          <div className="space-y-3">
            {loading ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading your tasks...</p>
                  </div>
                </CardContent>
              </Card>
            ) : filteredTasks.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="p-4 bg-muted rounded-full mb-4">
                    <CheckCircle2 className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">No tasks found</h3>
                  <p className="text-muted-foreground text-center mb-4 max-w-sm">
                    {searchTerm
                      ? "Try adjusting your search or filters"
                      : "Create your first task to get started"}
                  </p>
                  <Button onClick={() => setShowAddDialog(true)} variant="outline" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Task
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[calc(100vh-480px)] min-h-[400px]">
                <div className="space-y-3 pr-4">
                  {filteredTasks.map((task) => {
                    const timeInfo = getTimeRemaining(task.due_date);
                    const priorityStyles = getPriorityStyles(task.dynamic_priority || task.priority);
                    const categoryInfo = getCategoryInfo(task.category);
                    const CategoryIcon = categoryInfo.icon;

                    return (
                      <Card
                        key={task.id}
                        className={cn(
                          "border-0 shadow-sm transition-all duration-200 hover:shadow-md overflow-hidden group",
                          task.completed && "opacity-60"
                        )}
                      >
                        {/* Priority indicator bar */}
                        <div className={cn("h-1", priorityStyles.bar)} />

                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            {/* Checkbox */}
                            <button
                              onClick={() => handleToggleCompleted(task)}
                              className="mt-1 flex-shrink-0 transition-transform hover:scale-110"
                            >
                              {task.completed ? (
                                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                              ) : (
                                <Circle className={cn("h-6 w-6", priorityStyles.icon)} />
                              )}
                            </button>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <h3
                                    className={cn(
                                      "font-semibold text-base truncate",
                                      task.completed && "line-through text-muted-foreground"
                                    )}
                                  >
                                    {task.title}
                                  </h3>
                                  {task.description && (
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                      {task.description}
                                    </p>
                                  )}
                                </div>

                                {/* Actions */}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleToggleCompleted(task)}>
                                      {task.completed ? (
                                        <>
                                          <Circle className="h-4 w-4 mr-2" />
                                          Mark as Pending
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle2 className="h-4 w-4 mr-2" />
                                          Mark as Complete
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteTask(task)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete Task
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              {/* Meta info */}
                              <div className="flex flex-wrap items-center gap-2 mt-3">
                                {/* Category badge */}
                                <Badge variant="secondary" className={cn("gap-1 font-normal", categoryInfo.styles)}>
                                  <CategoryIcon className="h-3 w-3" />
                                  {categoryInfo.label}
                                </Badge>

                                {/* Priority badge */}
                                <Badge variant="outline" className={cn("gap-1 font-normal", priorityStyles.badge)}>
                                  <Flag className="h-3 w-3" />
                                  {(task.dynamic_priority || task.priority).charAt(0).toUpperCase() +
                                    (task.dynamic_priority || task.priority).slice(1)}
                                </Badge>

                                <Separator orientation="vertical" className="h-4" />

                                {/* Due date */}
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                  <Calendar className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">{formatDateForDisplay(task.due_date)}</span>
                                  <span className="sm:hidden">{format(new Date(task.due_date), "MMM d")}</span>
                                </div>

                                <Separator orientation="vertical" className="h-4" />

                                {/* Time remaining */}
                                <div
                                  className={cn(
                                    "flex items-center gap-1.5 text-sm font-medium",
                                    task.completed
                                      ? "text-emerald-600"
                                      : timeInfo.isOverdue
                                        ? "text-red-600"
                                        : timeInfo.isUrgent
                                          ? "text-amber-600"
                                          : "text-muted-foreground"
                                  )}
                                >
                                  <Clock className="h-3.5 w-3.5" />
                                  {task.completed ? "Completed" : timeInfo.text}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </div>

      {/* Add Task Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              Create New Task
            </DialogTitle>
            <DialogDescription>
              Add a new task to your list. Set a due date and time to receive reminders.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Enter task title..."
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
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
                <Label>Category</Label>
                <Select
                  value={newTask.category}
                  onValueChange={(val) => setNewTask({ ...newTask, category: val })}
                >
                  <SelectTrigger>
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
                        Collaborative
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={(val) => setNewTask({ ...newTask, priority: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      <div className="flex items-center gap-2">
                        <Flag className="h-4 w-4 text-emerald-500" />
                        Low
                      </div>
                    </SelectItem>
                    <SelectItem value="medium">
                      <div className="flex items-center gap-2">
                        <Flag className="h-4 w-4 text-amber-500" />
                        Medium
                      </div>
                    </SelectItem>
                    <SelectItem value="high">
                      <div className="flex items-center gap-2">
                        <Flag className="h-4 w-4 text-red-500" />
                        High
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Due Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  min={format(new Date(), "yyyy-MM-dd")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="due_time">Due Time</Label>
                <Input
                  id="due_time"
                  type="time"
                  value={newTask.due_time}
                  onChange={(e) => setNewTask({ ...newTask, due_time: e.target.value })}
                />
              </div>
            </div>

            {/* Preview */}
            {newTask.due_date && (
              <div className="p-4 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Reminder Preview
                </div>
                <p className="text-sm text-muted-foreground">
                  {newTask.due_time
                    ? `You'll be reminded on ${formatDateForDisplay(
                      new Date(`${newTask.due_date}T${newTask.due_time}`).toISOString()
                    )}`
                    : `Due date set for ${format(new Date(newTask.due_date), "EEEE, MMMM d, yyyy")} at 9:00 AM`}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Reminders appear in your notification bell and play a sound alert.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTask} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Tasks;
