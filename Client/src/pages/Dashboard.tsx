import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, CheckSquare, FileText, Plus, LogOut, BookOpen } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { supabase } from "@/utils/supabase";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, isBefore, subDays } from "date-fns";

const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();

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
      const { data: notesData } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentNotes(notesData || []);

      const { count: noteCount } = await supabase
        .from("notes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      setNoteCount(noteCount || 0);

      const { data: eventsData } = await supabase
        .from("events")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", new Date().toISOString().split("T")[0])
        .order("date", { ascending: true });
      setUpcomingEvents(eventsData || []);

      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .eq("completed", false);
      const updatedTasks = (tasksData || []).map(task => ({
        ...task,
        dynamic_priority: calculateDynamicPriority(task.due_date),
        urgent: isBefore(new Date(task.due_date), subDays(new Date(), 0))
      }));
      setTodaysTasks(updatedTasks);
    };
    fetchData();
  }, [user]);

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
      <div className="p-6 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              {getGreeting()}, {user?.user_metadata?.username || "Student"} 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              Here's what's happening today:
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut} className="flex items-center gap-2">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {/* Grid Layout for Events, Tasks, Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming Events */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <Calendar className="h-5 w-5 text-primary" /> Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length ? (
                <div className="space-y-3">
                  {upcomingEvents.map(evt => (
                    <div
                      key={evt.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition"
                    >
                      <p className="font-medium text-sm">{evt.title}</p>
                      <span className="text-xs text-muted-foreground">{formatDate(evt.date)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Calendar} text="No upcoming events" subtext="Add some to stay organized" />
              )}
              <div className="mt-4 text-right">
                <Button variant="outline" asChild>
                  <Link to="/events"><Plus className="h-4 w-4 mr-2" /> Add Event</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Today's Tasks */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <CheckSquare className="h-5 w-5 text-primary" /> Today's Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todaysTasks.length ? (
                <div className="space-y-3">
                  {todaysTasks.map(task => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition"
                    >
                      <p className="font-medium text-sm">{task.title}</p>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${task.urgent ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
                        {task.dynamic_priority}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={CheckSquare} text="No tasks for today" subtext="You're all caught up!" />
              )}
              <div className="mt-4 text-right">
                <Button variant="outline" asChild>
                  <Link to="/Tasks"><Plus className="h-4 w-4 mr-2" /> Add Task</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Notes */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <FileText className="h-5 w-5 text-primary" /> Recent Notes ({noteCount})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentNotes.length ? (
                recentNotes.map(note => (
                  <div
                    key={note.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition"
                  >
                    <p className="font-medium text-sm">{note.title}</p>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                    </span>
                  </div>
                ))
              ) : (
                <EmptyState icon={FileText} text="No notes yet" subtext="Start capturing your thoughts" />
              )}
              <div className="mt-4 text-right">
                <Button variant="outline" asChild>
                  <Link to="/Notes"><Plus className="h-4 w-4 mr-2" /> Add Note</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quickActions.map(action => (
                <Link to={action.href} key={action.label}>
                  <Button variant="outline" className="h-24 flex flex-col items-center gap-2 w-full">
                    <action.icon className="h-6 w-6" />
                    <span className="text-sm">{action.label}</span>
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

const EmptyState = ({ icon: Icon, text, subtext }: any) => (
  <div className="text-center py-8 text-muted-foreground">
    <Icon className="h-8 w-8 mx-auto mb-2 opacity-50" />
    <p className="text-sm font-medium">{text}</p>
    <p className="text-xs">{subtext}</p>
  </div>
);

const quickActions = [
  { href: "/notes", label: "New Note", icon: FileText },
  { href: "/tasks", label: "Add Task", icon: CheckSquare },
  { href: "/calendar", label: "Schedule", icon: Calendar },
  { href: "/resources", label: "Resources", icon: BookOpen },
];

export default Dashboard;
