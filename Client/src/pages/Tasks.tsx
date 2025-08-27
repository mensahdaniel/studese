import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, CheckSquare, Calendar, Flag, Search } from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/utils/supabase";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const LOCAL_TASKS_KEY = "tasks_local";

const Tasks = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [unsyncedTasks, setUnsyncedTasks] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    category: "personal",
    priority: "medium",
    dueDate: ""
  });

  const { toast } = useToast();

  /** Load tasks from localStorage on mount */
  useEffect(() => {
    const storedTasks = localStorage.getItem(LOCAL_TASKS_KEY);
    if (storedTasks) setTasks(JSON.parse(storedTasks));
  }, []);

  /** Sync unsynced tasks to Supabase */
  const trySyncTasks = async () => {
    if (unsyncedTasks.length === 0) return;

    const remainingTasks: any[] = [];

    for (const task of unsyncedTasks) {
      try {
        const { error } = await supabase.from("tasks").insert([task]);
        if (error) {
          remainingTasks.push(task); // keep unsynced
        }
      } catch {
        remainingTasks.push(task); // keep unsynced
      }
    }

    setUnsyncedTasks(remainingTasks);
  };

  /** Attempt sync on reconnect */
  useEffect(() => {
    const handleOnline = () => trySyncTasks();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [unsyncedTasks]);

  /** Fetch tasks from Supabase (merge with local tasks) */
  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const mergedTasks = [
        ...tasks.filter(t => t.id == null), // local-only tasks
        ...(data || [])
      ];
      setTasks(mergedTasks);
      localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(mergedTasks));
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load tasks.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  /** Save task locally + queue for syncing */
  const handleAddTask = () => {
    if (!newTask.title || !newTask.dueDate) {
      toast({
        title: "Missing fields",
        description: "Please provide a title and due date.",
        variant: "destructive"
      });
      return;
    }

    const taskToAdd = {
      ...newTask,
      completed: false,
      created_at: new Date().toISOString()
    };

    // Save locally
    const updatedTasks = [taskToAdd, ...tasks];
    setTasks(updatedTasks);
    localStorage.setItem(LOCAL_TASKS_KEY, JSON.stringify(updatedTasks));

    // Queue for Supabase sync
    setUnsyncedTasks(prev => [...prev, taskToAdd]);
    trySyncTasks();

    toast({
      title: "Task added",
      description: "Your new task has been saved locally."
    });

    setNewTask({
      title: "",
      description: "",
      category: "personal",
      priority: "medium",
      dueDate: ""
    });
  };

  /** Filters & helper functions remain the same as your original Tasks component */
  const filters = [
    { id: "all", name: "All Tasks", count: tasks.length },
    { id: "pending", name: "Pending", count: tasks.filter(t => !t.completed).length },
    { id: "completed", name: "Completed", count: tasks.filter(t => t.completed).length },
    { id: "overdue", name: "Overdue", count: tasks.filter(t => new Date(t.dueDate) < new Date() && !t.completed).length },
    { id: "today", name: "Due Today", count: tasks.filter(t => t.dueDate === new Date().toISOString().split("T")[0]).length }
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-destructive/10 text-destructive border-destructive/20";
      case "medium": return "bg-warning/10 text-warning border-warning/20";
      case "low": return "bg-success/10 text-success border-success/20";
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
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesFilter = true;

    switch (selectedFilter) {
      case "pending": matchesFilter = !task.completed; break;
      case "completed": matchesFilter = task.completed; break;
      case "overdue": matchesFilter = new Date(task.dueDate) < new Date() && !task.completed; break;
      case "today": matchesFilter = task.dueDate === new Date().toISOString().split("T")[0]; break;
    }

    return matchesSearch && matchesFilter;
  });

  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Overdue";
    if (diffDays === 0) return "Due today";
    if (diffDays === 1) return "Due tomorrow";
    return `Due in ${diffDays} days`;
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CheckSquare className="h-8 w-8" />
              Tasks
            </h1>
            <p className="text-muted-foreground">Stay on top of your assignments and deadlines</p>
          </div>
        </div>

        {/* Add Task Form */}
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
            <Input
              type="date"
              value={newTask.dueDate}
              onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
            />
            <div className="flex gap-2">
              <select
                className="border rounded p-2"
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <select
                className="border rounded p-2"
                value={newTask.category}
                onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
              >
                <option value="personal">Personal</option>
                <option value="academic">Academic</option>
                <option value="study">Study</option>
                <option value="collaborative">Collaborative</option>
              </select>
            </div>
            <Button onClick={handleAddTask} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </CardContent>
        </Card>

        {/* Search and Filters */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <Button
              key={filter.id}
              variant={selectedFilter === filter.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedFilter(filter.id)}
              className="text-sm"
            >
              {filter.name} ({filter.count})
            </Button>
          ))}
        </div>

        {/* Tasks Overview Cards */}
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
              <div className="text-2xl font-bold text-success">
                {tasks.filter(t => t.completed).length}
              </div>
              <p className="text-sm text-muted-foreground">Completed</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-destructive">
                {tasks.filter(t => t.priority === "high" && !t.completed).length}
              </div>
              <p className="text-sm text-muted-foreground">High Priority</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-warning">
                {tasks.filter(t => new Date(t.dueDate) < new Date() && !t.completed).length}
              </div>
              <p className="text-sm text-muted-foreground">Overdue</p>
            </CardContent>
          </Card>
        </div>

        {/* Tasks List */}
        <div className="space-y-4">
          {loading ? (
            <p className="text-center text-muted-foreground">Loading tasks...</p>
          ) : (
            filteredTasks.map((task) => (
              <Card key={task.id} className={`transition-all ${task.completed ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Checkbox checked={task.completed} className="mt-1" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <h3 className={`font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                          {task.title}
                        </h3>
                        <Badge variant="outline" className={getPriorityColor(task.priority)}>
                          <Flag className="h-3 w-3 mr-1" />
                          {task.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{task.description}</p>
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className={getCategoryColor(task.category)}>
                          {task.category}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {getDaysUntilDue(task.dueDate)}
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
                {searchTerm ? "Try adjusting your search terms" : "Add your first task to get started"}
              </p>
              <Button onClick={handleAddTask}>
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default Tasks;
