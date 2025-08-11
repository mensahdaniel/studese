import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus, 
  CheckSquare, 
  Calendar, 
  Flag, 
  Filter,
  Search
} from "lucide-react";
import Layout from "@/components/Layout";

const Tasks = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");

  // Mock tasks data
  const tasks = [
    {
      id: 1,
      title: "Submit Programming Assignment #3",
      category: "academic",
      priority: "high",
      dueDate: "2024-01-20",
      completed: false,
      description: "Complete the sorting algorithms implementation"
    },
    {
      id: 2,
      title: "Read Chapter 5 - Biology Textbook",
      category: "study",
      priority: "medium",
      dueDate: "2024-01-18",
      completed: false,
      description: "Focus on cellular respiration and photosynthesis"
    },
    {
      id: 3,
      title: "Prepare presentation slides",
      category: "academic",
      priority: "high",
      dueDate: "2024-01-22",
      completed: false,
      description: "History class presentation on World War II"
    },
    {
      id: 4,
      title: "Team project meeting",
      category: "collaborative",
      priority: "medium",
      dueDate: "2024-01-19",
      completed: true,
      description: "Discuss project timeline and responsibilities"
    },
    {
      id: 5,
      title: "Buy groceries",
      category: "personal",
      priority: "low",
      dueDate: "2024-01-17",
      completed: false,
      description: "Weekly grocery shopping"
    },
    {
      id: 6,
      title: "Math quiz preparation",
      category: "study",
      priority: "high",
      dueDate: "2024-01-21",
      completed: false,
      description: "Review calculus chapters 3-5"
    }
  ];

  const filters = [
    { id: "all", name: "All Tasks", count: tasks.length },
    { id: "pending", name: "Pending", count: tasks.filter(t => !t.completed).length },
    { id: "completed", name: "Completed", count: tasks.filter(t => t.completed).length },
    { id: "overdue", name: "Overdue", count: 2 },
    { id: "today", name: "Due Today", count: 1 }
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
      case "pending":
        matchesFilter = !task.completed;
        break;
      case "completed":
        matchesFilter = task.completed;
        break;
      case "overdue":
        matchesFilter = new Date(task.dueDate) < new Date() && !task.completed;
        break;
      case "today":
        const today = new Date().toISOString().split('T')[0];
        matchesFilter = task.dueDate === today;
        break;
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
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
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
                2
              </div>
              <p className="text-sm text-muted-foreground">Overdue</p>
            </CardContent>
          </Card>
        </div>

        {/* Tasks List */}
        <div className="space-y-4">
          {filteredTasks.map((task) => (
            <Card key={task.id} className={`transition-all ${task.completed ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Checkbox 
                    checked={task.completed}
                    className="mt-1"
                  />
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className={`font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {task.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={getPriorityColor(task.priority)}>
                          <Flag className="h-3 w-3 mr-1" />
                          {task.priority}
                        </Badge>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      {task.description}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredTasks.length === 0 && (
          <Card className="py-12">
            <CardContent className="text-center">
              <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "Try adjusting your search terms" : "Add your first task to get started"}
              </p>
              <Button>
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