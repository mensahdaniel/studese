import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, CheckSquare, Calendar, Flag, Search, Clock } from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/utils/supabase";
import { useToast } from "@/hooks/use-toast";
import { isBefore, subDays } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Tasks = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    category: "personal",
    priority: "medium",
    due_date: "",
    due_time: ""
  });

  // =============================================
  // 🕒 FIXED TIME CALCULATION WITH TIMEZONE HANDLING
  // =============================================
  /**
   * BOSS'S FIX: Proper timezone handling
   * - Database stores UTC time
   * - We calculate using user's local timezone
   */
  const getAccurateTimeRemaining = (dueDateUTC: string): string => {
    try {
      // Convert UTC time from database to user's local time
      const dueDateLocal = new Date(dueDateUTC);
      const nowLocal = new Date(); // Already in user's local time
      
      // Calculate difference in milliseconds
      const diffMs = dueDateLocal.getTime() - nowLocal.getTime();
      
      // If difference is negative, task is overdue
      if (diffMs < 0) {
        const absDiffMs = Math.abs(diffMs);
        const diffMinutes = Math.floor(absDiffMs / (1000 * 60));
        const diffHours = Math.floor(absDiffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays > 0) {
          return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        }
        if (diffHours > 0) {
          return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        }
        return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
      } 
      // If difference is positive, task is upcoming
      else {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays > 0) {
          return `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
        }
        if (diffHours > 0) {
          return `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
        }
        if (diffMinutes > 0) {
          return `in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
        }
        return 'due now';
      }
    } catch (error) {
      console.error('Time calculation error:', error);
      return 'Time error';
    }
  };

  // =============================================
  // 📅 BOSS'S FIX: CONVERT UTC TO LOCAL TIME FOR DISPLAY
  // =============================================
  /**
   * Convert UTC time from database to user's local time for display
   */
  const formatDateForDisplay = (utcDateString: string): string => {
    const dueDate = new Date(utcDateString);
    
    return dueDate.toLocaleString("en-US", {
      weekday: "long",
      month: "short", 
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // User's local timezone
    });
  };

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        const updatedTasks = (data || []).map(task => ({
          ...task,
          dynamic_priority: calculateDynamicPriority(task.due_date)
        }));
        setTasks(updatedTasks);
      }
      setLoading(false);
    };

    fetchTasks();
  }, [toast]);

  const calculateDynamicPriority = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    if (isBefore(due, subDays(today, 0))) return "high";
    if (isBefore(due, subDays(today, -2))) return "high";
    if (isBefore(due, subDays(today, -7))) return "medium";
    return "low";
  };

  // =============================================
  // ➕ BOSS'S FIX: CONVERT LOCAL TIME TO UTC FOR DATABASE
  // =============================================
  /**
   * BOSS'S FIX: Convert user's local time to UTC before saving to database
   */
  const handleAddTask = async () => {
    if (!newTask.title || !newTask.due_date) {
      toast({ title: "Missing fields", description: "Title and due date required.", variant: "destructive" });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }
    
    // 🕒 BOSS'S FIX: Handle date/time with timezone conversion
    let dueDate: Date;
    
    if (newTask.due_time) {
      // User selected both date and time in THEIR local timezone
      const localDateTimeString = `${newTask.due_date}T${newTask.due_time}`;
      dueDate = new Date(localDateTimeString);
    } else {
      // Default to 1 hour from now in user's local time
      dueDate = new Date();
      dueDate.setHours(dueDate.getHours() + 1);
      
      toast({ 
        title: "Note", 
        description: "No time specified. Defaulting to 1 hour from now." 
      });
    }

    // Validate the date
    if (isNaN(dueDate.getTime())) {
      toast({ title: "Error", description: "Invalid date/time combination.", variant: "destructive" });
      return;
    }

    // 🎯 BOSS'S KEY FIX: Convert to UTC before saving to database
    const utcDateString = dueDate.toISOString();

    console.log('🕒 TIME CONVERSION DEBUG:', {
      userInput: { date: newTask.due_date, time: newTask.due_time },
      localTime: dueDate.toString(),
      storedAsUTC: utcDateString,
      timeRemaining: getAccurateTimeRemaining(utcDateString)
    });

    const taskToAdd = {
      title: newTask.title,
      description: newTask.description,
      category: newTask.category,
      priority: newTask.priority,
      due_date: utcDateString, // Store as UTC in database
      user_id: user.id,
      completed: false
    };

    const { data, error } = await supabase.from("tasks").insert([taskToAdd]).select();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      const addedTask = { ...data[0], dynamic_priority: calculateDynamicPriority(data[0].due_date) };
      setTasks([addedTask, ...tasks]);
      toast({ title: "Success", description: "Task added!" });
      setShowForm(false);
      setNewTask({ title: "", description: "", category: "personal", priority: "medium", due_date: "", due_time: "" });
    }
  };

  const handleToggleCompleted = async (task: any) => {
    if (!task.id) {
      toast({ title: "Error", description: "Task ID missing.", variant: "destructive" });
      return;
    }

    const updatedTask = { completed: !task.completed };
    const { data, error } = await supabase
      .from("tasks")
      .update(updatedTask)
      .eq("id", task.id)
      .select();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data && data.length > 0) {
      const updatedData = { ...task, completed: data[0].completed, dynamic_priority: calculateDynamicPriority(task.due_date) };
      setTasks(tasks.map(t => t.id === task.id ? updatedData : t));
      toast({ title: "Success", description: `Task marked as ${updatedTask.completed ? "completed" : "incomplete"}!` });
    }
  };

  const handleDeleteTask = async (task: any) => {
    if (!task.id) {
      toast({ title: "Error", description: "Task ID missing.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setTasks(tasks.filter(t => t.id !== task.id));
      toast({ title: "Success", description: "Task deleted!" });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-500/10 text-red-600 border-red-200";
      case "medium": return "bg-yellow-500/10 text-yellow-600 border-yellow-200";
      case "low": return "bg-green-500/10 text-green-600 border-green-200";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "academic": return "bg-primary/10 text-primary";
      case "study": return "bg-blue-500/10 text-blue-600";
      case "collaborative": return "bg-purple-500/10 text-purple-600";
      case "personal": return "bg-green-500/10 text-green-600";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = selectedFilter === "all" || task.dynamic_priority === selectedFilter || (selectedFilter === "completed" && task.completed);
    return matchesSearch && matchesFilter;
  });

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Task Reminders</h1>
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
            September 2025
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">
                {tasks.filter(t => !t.completed).length}
              </div>
              <p className="text-sm text-muted-foreground">Pending Tasks</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {tasks.filter(t => t.completed).length}
              </div>
              <p className="text-sm text-muted-foreground">Completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {tasks.filter(t => t.priority === "high" && !t.completed).length}
              </div>
              <p className="text-sm text-muted-foreground">High Priority</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">
                {tasks.filter(t => new Date(t.due_date) < new Date() && !t.completed).length}
              </div>
              <p className="text-sm text-muted-foreground">Overdue</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedFilter} onValueChange={setSelectedFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Add New Task</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              />
              <Input
                placeholder="Description"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              />
              <Select value={newTask.category} onValueChange={(val) => setNewTask({ ...newTask, category: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="academic">Academic</SelectItem>
                  <SelectItem value="study">Study</SelectItem>
                  <SelectItem value="collaborative">Collaborative</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newTask.priority} onValueChange={(val) => setNewTask({ ...newTask, priority: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  placeholder="Select date"
                />
                <Input
                  type="time"
                  value={newTask.due_time}
                  onChange={(e) => setNewTask({ ...newTask, due_time: e.target.value })}
                  placeholder="Select time"
                />
              </div>
              
              {/* 🆕 BOSS'S FIX: Show local time preview */}
              {newTask.due_date && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2">📅 Task Due Preview</h4>
                  {newTask.due_time ? (
                    <div className="space-y-1 text-sm">
                      <div><strong>Your local time:</strong> {formatDateForDisplay(new Date(`${newTask.due_date}T${newTask.due_time}`).toISOString())}</div>
                      <div><strong>Time remaining:</strong> {
                        getAccurateTimeRemaining(new Date(`${newTask.due_date}T${newTask.due_time}`).toISOString())
                      }</div>
                    </div>
                  ) : (
                    <div className="text-orange-600 text-sm">
                      ⚠️ No time selected. Will default to 1 hour from now.
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-2">
                <Button onClick={handleAddTask}>Save Task</Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading tasks...</p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <Card key={task.id} className={`${task.completed ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={() => handleToggleCompleted(task)}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className={`font-medium text-lg ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {task.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                          {/* 🆕 BOSS'S FIX: Show actual due date in user's timezone */}
                          <p className="text-xs text-gray-500 mt-1">
                            Due: {formatDateForDisplay(task.due_date)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline" className={getPriorityColor(task.dynamic_priority)}>
                            <Flag className="h-3 w-3 mr-1" />
                            {task.dynamic_priority}
                          </Badge>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteTask(task)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className={getCategoryColor(task.category)}>
                          {task.category}
                        </Badge>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className={`font-medium ${
                            task.dynamic_priority === 'high' && !task.completed ? 'text-red-600' : 
                            task.completed ? 'text-green-600' : 'text-muted-foreground'
                          }`}>
                            {getAccurateTimeRemaining(task.due_date)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {filteredTasks.length === 0 && !loading && (
          <Card className="py-12">
            <CardContent className="text-center">
              <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "Try adjusting your search terms" : "Get started by adding your first task!"}
              </p>
              <Button onClick={() => setShowForm(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Task
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default Tasks;
