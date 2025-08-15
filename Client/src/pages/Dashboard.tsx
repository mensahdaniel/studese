import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  CheckSquare, 
  FileText, 
  Plus, 
  Clock,
  BookOpen,
  AlertCircle,
  LogOut
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import ThemeToggle from "@/components/ThemeToggle";
import { supabase } from "@/utils/supabase";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [recentNotes, setRecentNotes] = useState<any[]>([]); // now from Supabase

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        setUser(user);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to load user data.",
          variant: "destructive",
        });
      }
    };

    fetchUser();
  }, [toast]);
  
  // Fetch recent notes from Supabase
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const { data, error } = await supabase
          .from("notes")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5);

        if (error) throw error;
        setRecentNotes(data || []);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to load notes.",
          variant: "destructive",
        });
      }
    };

    fetchNotes();
  }, [toast]);

  //fetch note count from supabase
  const [noteCount, setNoteCount] = useState<number>(0);

  useEffect(() => {
    const fetchNoteCount = async () => {
     try {
      const { count, error } = await supabase
        .from("notes")
        .select("*", { count: "exact", head: true });

      if (error) throw error;
      setNoteCount(count || 0);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load note count.",
        variant: "destructive",
      });
    }
  };

  fetchNoteCount();
}, [toast]);


  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
      navigate("/login");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign out.",
        variant: "destructive",
      });
    }
  };

  // Mock data for demonstration
  const upcomingClasses = [
    { time: "9:00 AM", subject: "Computer Science 101", location: "Room 204" },
    { time: "2:00 PM", subject: "Mathematics", location: "Room 150" },
    { time: "4:30 PM", subject: "Physics Lab", location: "Lab B" }
  ];

  const todaysTasks = [
    { task: "Submit Programming Assignment", urgent: true },
    { task: "Read Chapter 5 - Biology", urgent: false },
    { task: "Prepare for Math Quiz", urgent: true },
    { task: "Team Project Meeting", urgent: false }
  ];

 /* const recentNotes = [
    { title: "Lecture Notes - CS 101", date: "Today" },
    { title: "Study Group Ideas", date: "Yesterday" },
    { title: "Research Paper Outline", date: "2 days ago" }
  ];*/

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {getGreeting()}, {user?.user_metadata?.username || user?.email.split('@')[0] || 'User'}! 👋
            </h1>
            <p className="text-muted-foreground">Here's what's happening today ✨</p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSignOut}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border hover:shadow-lg transition-all duration-200">
            <CardContent className="p-4 flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Today's Classes</p>
                <p className="text-2xl font-bold">3</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border hover:shadow-lg transition-all duration-200">
            <CardContent className="p-4 flex items-center space-x-3">
              <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center">
                <CheckSquare className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-medium">Pending Tasks</p>
                <p className="text-2xl font-bold">7</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border hover:shadow-lg transition-all duration-200">
            <CardContent className="p-4 flex items-center space-x-3">
              <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium">Notes</p>
                <p className="text-2xl font-bold">{noteCount}</p> 
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border hover:shadow-lg transition-all duration-200">
            <CardContent className="p-4 flex items-center space-x-3">
              <div className="w-10 h-10 bg-destructive/10 rounded-lg flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium">Due Soon</p>
                <p className="text-2xl font-bold">2</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Today's Schedule */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Today's Classes
              </CardTitle>
              <Link to="/calendar">
                <Button variant="ghost" size="sm">View All</Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingClasses.map((class_, index) => (
                <div key={index} className="flex items-center space-x-4 p-3 rounded-lg border border-border">
                  <div className="text-center">
                    <p className="text-sm font-medium">{class_.time}</p>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{class_.subject}</p>
                    <p className="text-sm text-muted-foreground">{class_.location}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Today's Tasks */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                Today's Tasks
              </CardTitle>
              <Link to="/tasks">
                <Button variant="ghost" size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {todaysTasks.map((task, index) => (
                <div key={index} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-accent">
                  <input type="checkbox" className="rounded" />
                  <div className="flex-1">
                    <p className={`text-sm ${task.urgent ? 'font-medium' : ''}`}>
                      {task.task}
                    </p>
                    {task.urgent && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-destructive/10 text-destructive">
                        Urgent
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Notes from Supabase */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Recent Notes
              </CardTitle>
              <Link to="/notes">
                <Button variant="ghost" size="sm">
                  <Plus className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentNotes.length > 0 ? (
                recentNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 rounded-lg border border-border hover:bg-accent cursor-pointer transition-colors"
                  >
                    <p className="font-medium text-sm">{note.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notes yet</p>
                  <p className="text-xs">Start capturing your thoughts! 💭</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Study Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              💡 Study Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
                <span className="text-lg">🍅</span>
                <div>
                  <p className="text-sm font-medium">Take breaks every 25 minutes</p>
                  <p className="text-xs text-muted-foreground">Use the Pomodoro technique to maintain focus and prevent burnout</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
                <span className="text-lg">📚</span>
                <div>
                  <p className="text-sm font-medium">Review notes within 24 hours</p>
                  <p className="text-xs text-muted-foreground">This helps transfer information from short-term to long-term memory</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50">
                <span className="text-lg">🧠</span>
                <div>
                  <p className="text-sm font-medium">Use active recall instead of re-reading</p>
                  <p className="text-xs text-muted-foreground">Test yourself on what you've learned rather than just reviewing</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link to="/notes">
                <Button variant="outline" className="h-20 flex flex-col items-center gap-2 w-full">
                  <FileText className="h-6 w-6" />
                  <span className="text-sm">New Note</span>
                </Button>
              </Link>
              
              <Link to="/tasks">
                <Button variant="outline" className="h-20 flex flex-col items-center gap-2 w-full">
                  <CheckSquare className="h-6 w-6" />
                  <span className="text-sm">Add Task</span>
                </Button>
              </Link>
              
              <Link to="/calendar">
                <Button variant="outline" className="h-20 flex flex-col items-center gap-2 w-full">
                  <Calendar className="h-6 w-6" />
                  <span className="text-sm">Schedule</span>
                </Button>
              </Link>
              
              <Link to="/resources">
                <Button variant="outline" className="h-20 flex flex-col items-center gap-2 w-full">
                  <BookOpen className="h-6 w-6" />
                  <span className="text-sm">Resources</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Dashboard;