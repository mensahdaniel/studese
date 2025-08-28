import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Trash2
} from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/utils/supabase";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";

interface CalendarItem {
  id: string;
  title: string;
  type: "event" | "task";
  location?: string;
  date: string;  // YYYY-MM-DD
  color?: string;
  completed?: boolean;  // for tasks
  link?: string;  // for events
}

const Calendar = () => {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [events, setEvents] = useState<CalendarItem[]>([]);
  const [tasks, setTasks] = useState<CalendarItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllItems, setShowAllItems] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      // Fetch events
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("user_id", user.id);

      if (eventError) {
        toast({ title: "Error", description: eventError.message, variant: "destructive" });
      } else {
        setEvents(eventData.map(e => ({ ...e, type: "event", color: "bg-primary/10 text-primary border-primary/20" })));
      }

      // Fetch tasks
      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id);

      if (taskError) {
        toast({ title: "Error", description: taskError.message, variant: "destructive" });
      } else {
        setTasks(taskData.map(t => ({ ...t, type: "task", date: t.due_date, color: "bg-success/10 text-success border-success/20" })));
      }

      setIsLoading(false);
    };

    fetchData();
  }, [toast]);

  const allItems = [...events, ...tasks].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const getDaysInMonth = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start, end });
    const startWeek = startOfWeek(start);
    const endWeek = endOfWeek(end);
    return eachDayOfInterval({ start: startWeek, end: endWeek });
  };

  const getItemsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return allItems.filter(i => i.date === dateStr);
  };

  const toggleComplete = async (item: CalendarItem) => {
    if (item.type === "task") {
      const updated = { ...item, completed: !item.completed };
      const { error } = await supabase.from("tasks").update(updated).eq("id", item.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setTasks(tasks.map(t => t.id === item.id ? updated : t));
      }
    }
  };

  const deleteItem = async (item: CalendarItem) => {
    const table = item.type === "event" ? "events" : "tasks";
    const { error } = await supabase.from(table).delete().eq("id", item.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      if (item.type === "event") setEvents(events.filter(e => e.id !== item.id));
      if (item.type === "task") setTasks(tasks.filter(t => t.id !== item.id));
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setCurrentDate(subDays(currentDate, view === "month" ? 30 : 7))}>
            <ChevronLeft />
          </Button>
          <h1 className="text-xl font-bold">{format(currentDate, view === "month" ? "MMMM yyyy" : "MMM d, yyyy")}</h1>
          <Button variant="ghost" onClick={() => setCurrentDate(addDays(currentDate, view === "month" ? 30 : 7))}>
            <ChevronRight />
          </Button>
        </div>

        {/* View Switch */}
        <div className="flex gap-2">
          <Button variant={view === "month" ? "default" : "outline"} onClick={() => setView("month")}>Month</Button>
          <Button variant={view === "week" ? "default" : "outline"} onClick={() => setView("week")}>Week</Button>
          <Button variant={view === "day" ? "default" : "outline"} onClick={() => setView("day")}>Day</Button>
        </div>

        {/* Calendar View */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              {view === "month" && (
                <div className="grid grid-cols-7 gap-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                    <div key={day} className="text-center font-medium text-sm">{day}</div>
                  ))}
                  {getDaysInMonth().map(day => (
                    <div key={day.toString()} className={`p-2 border rounded ${isSameDay(day, new Date()) ? "bg-primary/10" : ""}`}>
                      <div className="text-sm font-medium">{format(day, "d")}</div>
                      <div className="space-y-1 mt-1">
                        {getItemsForDate(day).slice(0, 2).map(i => (
                          <div key={i.id} className={`text-xs p-1 rounded ${i.color}`}>{i.title}</div>
                        ))}
                        {getItemsForDate(day).length > 2 && <div className="text-xs">+{getItemsForDate(day).length - 2} more</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {view === "week" && (
                <div className="space-y-2">
                  {eachDayOfInterval({ start: startOfWeek(currentDate), end: endOfWeek(currentDate) }).map(day => (
                    <div key={day.toString()} className="p-2 border rounded">
                      <div className="font-medium">{format(day, "EEE d")}</div>
                      <div className="space-y-1 mt-1">
                        {getItemsForDate(day).map(i => (
                          <div key={i.id} className={`text-sm p-1 rounded ${i.color}`}>{i.title}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {view === "day" && (
                <div className="space-y-2">
                  <div className="text-center text-lg font-medium mb-2">
                    {format(currentDate, "MMMM d, yyyy")}
                  </div>
                  <div className="space-y-1">
                    {getItemsForDate(currentDate).map(i => (
                      <div key={i.id} className={`p-2 border rounded ${i.color}`}>
                        <div className="font-medium">{i.title}</div>
                        {i.location && <div className="text-xs text-muted-foreground">{i.location}</div>}
                        <Badge>{i.type}</Badge>
                      </div>
                    ))}
                    {getItemsForDate(currentDate).length === 0 && (
                      <div className="text-sm text-muted-foreground text-center">No items</div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Items Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upcoming Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(showAllItems ? allItems : allItems.slice(0, 4)).map(i => (
                  <div key={i.id} className="space-y-2 p-3 rounded-lg border border-border flex justify-between items-center">
                    <div>
                      <h4 className="font-medium text-sm">{i.title}</h4>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <CalendarIcon className="h-3 w-3" /> {format(new Date(i.date), "MMM d")}
                      </div>
                      <Badge className={i.color}>{i.type}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {i.type === "task" && <Checkbox checked={i.completed} onCheckedChange={() => toggleComplete(i)} />}
                      <Trash2 className="h-4 w-4 cursor-pointer" onClick={() => deleteItem(i)} />
                    </div>
                  </div>
                ))}
                {allItems.length > 4 && <Button variant="link" size="sm" onClick={() => setShowAllItems(!showAllItems)}>{showAllItems ? "Collapse" : "Show All"}</Button>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Calendar;