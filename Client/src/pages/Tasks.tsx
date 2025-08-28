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
import { formatDistanceToNow, isBefore, subDays } from "date-fns";
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
    due_date: ""
  });

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
    if (isBefore(due, subDays(today, 0))) return "high";  // Overdue or today
    if (isBefore(due, subDays(today, -2))) return "high";  // <2 days
    if (isBefore(due, subDays(today, -7))) return "medium";  // <7 days
    return "low";
  };

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

    const taskToAdd = {
      ...newTask,
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
      setNewTask({ title: "", description: "", category: "personal", priority: "medium", due_date: "" });
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
      console.error("Update error:", error);
    } else if (data && data.length > 0) {
      const updatedData = { ...task, completed: data[0].completed, dynamic_priority: calculateDynamicPriority(task.due_date) };
      setTasks(tasks.map(t => t.id === task.id ? updatedData : t));
      toast({ title: "Success", description: `Task marked as ${updatedTask.completed ? "completed" : "incomplete"}!` });
    } else {
      toast({ title: "Error", description: "Failed to update task.", variant: "destructive" });
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
      case "high": return "bg-red-500/10 text-red-600";
      case "medium": return "bg-yellow-500/10 text-yellow-600";
      case "low": return "bg-green-500/10 text-green-600";
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

  const getDaysUntilDue = (dueDate: string) => {
    return formatDistanceToNow(new Date(dueDate), { addSuffix: true });
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
                {tasks.filter(t => new Date(t.due_date) < new Date() && !t.completed).length}
              </div>
              <p className="text-sm text-muted-foreground">Overdue</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Add Task Button */}
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>

        {/* Add Task Form */}
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
              <Input
                type="date"
                value={newTask.due_date}
                onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
              />
              <Button onClick={handleAddTask}>Save Task</Button>
            </CardContent>
          </Card>
        )}

        {/* Tasks List */}
        <div className="space-y-4">
          {loading ? (
            <p>Loading tasks...</p>
          ) : (
            filteredTasks.map((task) => (
              <Card key={task.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={() => handleToggleCompleted(task)}
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between">
                        <h3 className={`font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                          {task.title}
                        </h3>
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
                      <p className="text-sm text-muted-foreground">{task.description}</p>
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className={getCategoryColor(task.category)}>
                          {task.category}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {getDaysUntilDue(task.due_date)}
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
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default Tasks;