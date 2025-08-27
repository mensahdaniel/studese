import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin
} from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/utils/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";

interface CalendarItem {
  id?: number;
  title: string;
  type: string;
  time: string;
  location?: string;
  date: string;
  color?: string;
  completed?: boolean; // for tasks
}

const Calendar = () => {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [events, setEvents] = useState<CalendarItem[]>([]);
  const [tasks, setTasks] = useState<CalendarItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newEvent, setNewEvent] = useState<CalendarItem>({
    title: "",
    type: "event",
    time: "",
    date: new Date().toISOString().split("T")[0],
    color: "bg-primary/10 text-primary border-primary/20",
  });

  // Offline-first load for events
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const storedEvents = localStorage.getItem("events_local");
        const localEvents = storedEvents ? JSON.parse(storedEvents) : [];

        let supabaseEvents: CalendarItem[] = [];
        try {
          const { data, error } = await supabase.from("events").select("*");
          if (!error && data) supabaseEvents = data;
        } catch {}

        const merged = [...localEvents.filter(e => !e.id), ...supabaseEvents];
        setEvents(merged);

        // Sync local-only
        for (const e of localEvents.filter(e => !e.id)) {
          try {
            const { data, error } = await supabase.from("events").insert([e]).select();
            if (!error && data?.[0]?.id) {
              e.id = data[0].id;
              localStorage.setItem("events_local", JSON.stringify(localEvents));
            }
          } catch {}
        }
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to load events",
          variant: "destructive",
        });
      }
    };
    loadEvents();
  }, [toast]);

  // Offline-first load for tasks
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const storedTasks = localStorage.getItem("tasks_local");
        const localTasks = storedTasks ? JSON.parse(storedTasks) : [];

        let supabaseTasks: CalendarItem[] = [];
        try {
          const { data, error } = await supabase.from("tasks").select("*");
          if (!error && data) supabaseTasks = data;
        } catch {}

        const merged = [...localTasks.filter(t => !t.id), ...supabaseTasks];
        setTasks(merged);

        // Sync local-only
        for (const t of localTasks.filter(t => !t.id)) {
          try {
            const { data, error } = await supabase.from("tasks").insert([t]).select();
            if (!error && data?.[0]?.id) {
              t.id = data[0].id;
              localStorage.setItem("tasks_local", JSON.stringify(localTasks));
            }
          } catch {}
        }
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to load tasks",
          variant: "destructive",
        });
      }
    };
    loadTasks();
  }, [toast]);

  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  const weekDays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const allItems = [...events, ...tasks];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const days: (number | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(day);
    return days;
  };

  const getItemsForDate = (day: number) => {
    const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return allItems.filter(i => i.date === dateString);
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1));
      return newDate;
    });
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day &&
           today.getMonth() === currentDate.getMonth() &&
           today.getFullYear() === currentDate.getFullYear();
  };

  const handleAddEvent = async () => {
    const eventToAdd = { ...newEvent };
    setEvents(prev => [...prev, eventToAdd]);

    const storedEvents = localStorage.getItem("events_local");
    const localEvents = storedEvents ? JSON.parse(storedEvents) : [];
    localEvents.push(eventToAdd);
    localStorage.setItem("events_local", JSON.stringify(localEvents));

    try {
      const { data, error } = await supabase.from("events").insert([eventToAdd]).select();
      if (!error && data?.[0]?.id) {
        eventToAdd.id = data[0].id;
        localStorage.setItem("events_local", JSON.stringify(localEvents));
      }
    } catch {}

    setShowModal(false);
    setNewEvent({
      title: "",
      type: "event",
      time: "",
      date: new Date().toISOString().split("T")[0],
      color: "bg-primary/10 text-primary border-primary/20",
    });
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CalendarIcon className="h-8 w-8" /> Calendar
            </h1>
            <p className="text-muted-foreground">Manage your schedule and important dates</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-muted rounded-lg p-1">
              <Button variant={view==="month"?"default":"ghost"} size="sm" onClick={()=>setView("month")}>Month</Button>
              <Button variant={view==="week"?"default":"ghost"} size="sm" onClick={()=>setView("week")}>Week</Button>
              <Button variant={view==="day"?"default":"ghost"} size="sm" onClick={()=>setView("day")}>Day</Button>
            </div>
            <Dialog open={showModal} onOpenChange={setShowModal}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2"/> Add Event</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Event</DialogTitle>
                  <DialogDescription>Fill in the event details</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <input type="text" placeholder="Title" className="input w-full" value={newEvent.title} onChange={e=>setNewEvent({...newEvent,title:e.target.value})}/>
                  <input type="date" className="input w-full" value={newEvent.date} onChange={e=>setNewEvent({...newEvent,date:e.target.value})}/>
                  <input type="text" placeholder="Time" className="input w-full" value={newEvent.time} onChange={e=>setNewEvent({...newEvent,time:e.target.value})}/>
                  <input type="text" placeholder="Location" className="input w-full" value={newEvent.location} onChange={e=>setNewEvent({...newEvent,location:e.target.value})}/>
                  <select className="input w-full" value={newEvent.type} onChange={e=>setNewEvent({...newEvent,type:e.target.value})}>
                    <option value="event">Event</option>
                    <option value="class">Class</option>
                    <option value="deadline">Deadline</option>
                    <option value="study">Study</option>
                    <option value="task">Task</option>
                  </select>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddEvent} className="w-full">Add Event</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={()=>navigateMonth("prev")}><ChevronLeft className="h-4 w-4"/></Button>
                    <Button variant="outline" size="sm" onClick={()=>setCurrentDate(new Date())}>Today</Button>
                    <Button variant="outline" size="sm" onClick={()=>navigateMonth("next")}><ChevronRight className="h-4 w-4"/></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1 mb-4">
                  {weekDays.map(day=><div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">{day}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {getDaysInMonth(currentDate).map((day,index)=>(
                    <div key={index} className={`min-h-[80px] p-1 border border-border rounded-lg ${day?'hover:bg-accent cursor-pointer':''} ${isToday(day||0)?'bg-primary/5 border-primary':''}`}>
                      {day && (
                        <>
                          <div className={`text-sm font-medium mb-1 ${isToday(day)?'text-primary':''}`}>{day}</div>
                          <div className="space-y-1">
                            {getItemsForDate(day).slice(0,2).map(i=>(
                              <div key={i.id||i.title} className={`text-xs p-1 rounded border ${i.color || 'bg-secondary/10 text-secondary border-secondary/20'} truncate`}>{i.title}</div>
                            ))}
                            {getItemsForDate(day).length>2 && <div className="text-xs text-muted-foreground">+{getItemsForDate(day).length-2} more</div>}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upcoming Events & Tasks Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upcoming Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {allItems.slice(0,4).map(i=>(
                  <div key={i.id||i.title} className="space-y-2 p-3 rounded-lg border border-border">
                    <h4 className="font-medium text-sm">{i.title}</h4>
                    {i.time && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3 w-3"/>{i.time}</div>}
                    {i.location && <div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3 w-3"/>{i.location}</div>}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarIcon className="h-3 w-3"/>{new Date(i.date).toLocaleDateString()}</div>
                    <Badge variant="secondary" className={i.color || "bg-secondary/10 text-secondary border-secondary/20"}>{i.type}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Calendar;
