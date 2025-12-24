import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Calendar, CheckSquare, FileText, Plus, LogOut, BookOpen, Clock, ChevronRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { supabase } from "@/utils/supabase";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, isBefore, subDays } from "date-fns";
import { cn } from "@/lib/utils";

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

  const username = user?.user_metadata?.username || "Student";

  return (
    <div className="p-4 sm:p-6 space-y-5 sm:space-y-8 max-w-7xl mx-auto pb-24 sm:pb-6">
      {/* Header - More compact on mobile */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight truncate">
              {getGreeting()}, <span className="text-primary">{username}</span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Welcome to your Studese Pro dashboard
            </p>
          </div>
        </div>

        {/* Sign Out - Smaller on mobile */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          className="gap-2 h-9"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </Button>
      </div>

      {/* Quick Stats Cards - Horizontal scroll on mobile */}
      <ScrollArea className="w-full sm:hidden">
        <div className="flex gap-3 pb-2">
          <QuickStatCard
            icon={FileText}
            label="Notes"
            value={noteCount}
            href="/notes"
            color="text-blue-500"
            bgColor="bg-blue-500/10"
          />
          <QuickStatCard
            icon={CheckSquare}
            label="Tasks"
            value={todaysTasks.length}
            href="/tasks"
            color="text-green-500"
            bgColor="bg-green-500/10"
          />
          <QuickStatCard
            icon={Calendar}
            label="Events"
            value={upcomingEvents.length}
            href="/events"
            color="text-purple-500"
            bgColor="bg-purple-500/10"
          />
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>

      {/* Grid Layout for Events, Tasks, Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Upcoming Events */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-base sm:text-lg font-semibold">
                <div className="p-1.5 bg-purple-500/10 rounded-lg">
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                </div>
                Upcoming Events
              </span>
              <Link to="/events">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {upcomingEvents.length ? (
              <div className="space-y-2">
                {upcomingEvents.slice(0, 3).map(evt => (
                  <div
                    key={evt.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer touch-manipulation active:scale-[0.98]"
                    onClick={() => navigate("/events")}
                  >
                    <p className="font-medium text-sm truncate flex-1 mr-2">{evt.title}</p>
                    <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(evt.date)}
                    </span>
                  </div>
                ))}
                {upcomingEvents.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{upcomingEvents.length - 3} more events
                  </p>
                )}
              </div>
            ) : (
              <EmptyState icon={Calendar} text="No upcoming events" subtext="Add some to stay organized" />
            )}
            <div className="mt-4">
              <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                <Link to="/events" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Event
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Today's Tasks */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-base sm:text-lg font-semibold">
                <div className="p-1.5 bg-green-500/10 rounded-lg">
                  <CheckSquare className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                </div>
                Today's Tasks
              </span>
              <Link to="/tasks">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {todaysTasks.length ? (
              <div className="space-y-2">
                {todaysTasks.slice(0, 3).map(task => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer touch-manipulation active:scale-[0.98]"
                    onClick={() => navigate("/tasks")}
                  >
                    <p className="font-medium text-sm truncate flex-1 mr-2">{task.title}</p>
                    <span className={cn(
                      "text-xs font-semibold px-2 py-1 rounded-full shrink-0",
                      task.urgent || task.dynamic_priority === "high"
                        ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                        : task.dynamic_priority === "medium"
                          ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    )}>
                      {task.dynamic_priority}
                    </span>
                  </div>
                ))}
                {todaysTasks.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{todaysTasks.length - 3} more tasks
                  </p>
                )}
              </div>
            ) : (
              <EmptyState icon={CheckSquare} text="No tasks for today" subtext="You're all caught up!" />
            )}
            <div className="mt-4">
              <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                <Link to="/tasks" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Task
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Notes */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-base sm:text-lg font-semibold">
                <div className="p-1.5 bg-blue-500/10 rounded-lg">
                  <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                </div>
                Recent Notes
                <span className="text-xs font-normal text-muted-foreground">({noteCount})</span>
              </span>
              <Link to="/notes">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {recentNotes.length ? (
              <div className="space-y-2">
                {recentNotes.slice(0, 3).map(note => (
                  <div
                    key={note.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer touch-manipulation active:scale-[0.98]"
                    onClick={() => navigate(`/notes/${note.id}`)}
                  >
                    <p className="font-medium text-sm truncate flex-1 mr-2">{note.title || "Untitled"}</p>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                    </span>
                  </div>
                ))}
                {recentNotes.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center pt-1">
                    +{recentNotes.length - 3} more notes
                  </p>
                )}
              </div>
            ) : (
              <EmptyState icon={FileText} text="No notes yet" subtext="Start capturing your thoughts" />
            )}
            <div className="mt-4">
              <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                <Link to="/notes/new" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Note
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions - 2x2 grid on mobile, 4 columns on desktop */}
      <Card>
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="text-base sm:text-lg font-semibold">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {quickActions.map(action => (
              <Link to={action.href} key={action.label}>
                <Button
                  variant="outline"
                  className={cn(
                    "h-20 sm:h-24 flex flex-col items-center justify-center gap-2 w-full",
                    "hover:border-primary/50 hover:bg-primary/5 transition-all",
                    "touch-manipulation active:scale-[0.98]"
                  )}
                >
                  <div className={cn("p-2 rounded-lg", action.bgColor)}>
                    <action.icon className={cn("h-5 w-5 sm:h-6 sm:w-6", action.color)} />
                  </div>
                  <span className="text-xs sm:text-sm font-medium">{action.label}</span>
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Quick Stat Card for mobile horizontal scroll
const QuickStatCard = ({
  icon: Icon,
  label,
  value,
  href,
  color,
  bgColor
}: {
  icon: any;
  label: string;
  value: number;
  href: string;
  color: string;
  bgColor: string;
}) => (
  <Link to={href}>
    <Card className="min-w-[120px] touch-manipulation active:scale-[0.98]">
      <CardContent className="p-4 flex flex-col items-center gap-2">
        <div className={cn("p-2 rounded-lg", bgColor)}>
          <Icon className={cn("h-5 w-5", color)} />
        </div>
        <span className="text-2xl font-bold">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  </Link>
);

const EmptyState = ({ icon: Icon, text, subtext }: { icon: any; text: string; subtext: string }) => (
  <div className="text-center py-6 sm:py-8 text-muted-foreground">
    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
      <Icon className="h-6 w-6 sm:h-7 sm:w-7 opacity-50" />
    </div>
    <p className="text-sm font-medium">{text}</p>
    <p className="text-xs mt-1">{subtext}</p>
  </div>
);

const quickActions = [
  { href: "/notes/new", label: "New Note", icon: FileText, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  { href: "/tasks", label: "Add Task", icon: CheckSquare, color: "text-green-500", bgColor: "bg-green-500/10" },
  { href: "/calendar", label: "Schedule", icon: Calendar, color: "text-purple-500", bgColor: "bg-purple-500/10" },
  { href: "/resources", label: "Resources", icon: BookOpen, color: "text-amber-500", bgColor: "bg-amber-500/10" },
];

export default Dashboard;
