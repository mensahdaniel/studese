import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  CheckSquare, 
  FileText, 
  Plus, 
  Clock,
  Badge,
  BookOpen,
  AlertCircle,
  LogOut
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { supabase } from "@/utils/supabase";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, isBefore, subDays } from "date-fns";

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString(); // or use a custom format
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [recentNotes, setRecentNotes] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [todaysTasks, setTodaysTasks] = useState<any[]>([]);
  const [noteCount, setNoteCount] = useState(0);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        toast({ title: "Error", description: "Please log in.", variant: "destructive" });
        navigate("/login");
        return;
      }
      setUser(user);
    };

    fetchUser();
  }, [toast, navigate]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // Recent Notes
      const { data: notesData, error: notesError } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (notesError) toast({ title: "Error", description: notesError.message, variant: "destructive" });
      else setRecentNotes(notesData || []);

      // Note Count
      const { count: noteCount, error: countError } = await supabase
        .from("notes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (countError) toast({ title: "Error", description: countError.message, variant: "destructive" });
      else setNoteCount(noteCount || 0);

      // Upcoming Events (includes classes)
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", new Date().toISOString().split("T")[0])  // Upcoming only
        .order("date", { ascending: true });

      if (eventsError) toast({ title: "Error", description: eventsError.message, variant: "destructive" });
      else setUpcomingEvents(eventsData || []);

      // Today's Tasks (with dynamic priority)
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .eq("completed", false);

      if (tasksError) toast({ title: "Error", description: tasksError.message, variant: "destructive" });
      else {
        const updatedTasks = (tasksData || []).map(task => ({
          ...task,
          dynamic_priority: calculateDynamicPriority(task.due_date),
          urgent: isBefore(new Date(task.due_date), subDays(new Date(), 0))
        }));
        setTodaysTasks(updatedTasks);
      }
    };

    fetchData();
  }, [user, toast]);

  const calculateDynamicPriority = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    if (isBefore(due, subDays(today, 0))) return "high";
    if (isBefore(due, subDays(today, -2))) return "high";
    if (isBefore(due, subDays(today, -7))) return "medium";
    return "low";
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({ title: "Signed out", description: "See you soon!" });
    navigate("/login");
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Greeting */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold">{getGreeting()}, {user?.user_metadata?.username || "User"}!</h1>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        {/* Upcoming Events (includes classes) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📅 Upcoming Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {upcomingEvents.map((evt) => (
                  <div key={evt.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent cursor-pointer transition-colors">
                    <p className="font-medium text-sm">{evt.title} ({evt.category})</p>
                    <p className="text-xs text-muted-foreground">{formatDate(evt.date)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No upcoming events</p>
                <p className="text-xs">Add some to stay organized! 📚</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ✅ Today's Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todaysTasks.length > 0 ? (
              <div className="space-y-3">
                {todaysTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent cursor-pointer transition-colors">
                    <p className="font-medium text-sm">{task.title}</p>
                    <Badge className={task.urgent ? "bg-red-500/10 text-red-600" : "bg-green-500/10 text-green-600"}>
                      {task.dynamic_priority}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No tasks for today</p>
                <p className="text-xs">You're all caught up! 🎉</p>
              </div>
            )}
          </CardContent>
        </Card>
{/* Recent Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📝 Recent Notes ({noteCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentNotes.length > 0 ? (
              recentNotes.map((note) => (
                <div key={note.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent cursor-pointer transition-colors">
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