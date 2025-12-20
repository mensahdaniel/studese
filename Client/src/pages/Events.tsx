import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  Calendar,
  Search,
  ExternalLink,
  Plus,
  Clock,
  Sparkles,
  Users,
  GraduationCap,
  Briefcase,
  Heart,
  FlaskConical,
  Leaf,
  ChevronRight,
  CalendarDays,
  TrendingUp,
  Loader2,
  X,
} from "lucide-react";
import { supabase } from "@/utils/supabase";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Event {
  id: string;
  title: string;
  description: string;
  category: string;
  date: string;
  location: string;
  link?: string;
}

const Events = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { toast } = useToast();

  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    category: "academic",
    date: "",
    location: "",
    link: "",
  });

  const getTimeRemaining = (eventDate: string) => {
    try {
      const now = new Date();
      const due = new Date(eventDate);

      if (isNaN(due.getTime())) return { text: "Invalid date", isUpcoming: false, isToday: false };

      const diffMs = due.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const isToday = due.toDateString() === now.toDateString();

      if (diffMs < 0) {
        const absMinutes = Math.abs(diffMinutes);
        const absHours = Math.abs(diffHours);
        const absDays = Math.abs(diffDays);

        if (absDays > 0) return { text: `${absDays}d ago`, isUpcoming: false, isToday: false };
        if (absHours > 0) return { text: `${absHours}h ago`, isUpcoming: false, isToday };
        return { text: `${absMinutes}m ago`, isUpcoming: false, isToday };
      } else {
        if (diffDays > 0) return { text: `in ${diffDays}d`, isUpcoming: true, isToday: false };
        if (diffHours > 0) return { text: `in ${diffHours}h`, isUpcoming: true, isToday };
        if (diffMinutes > 0) return { text: `in ${diffMinutes}m`, isUpcoming: true, isToday };
        return { text: "Now", isUpcoming: true, isToday: true };
      }
    } catch {
      return { text: "Error", isUpcoming: false, isToday: false };
    }
  };

  const handleEventClick = (event: Event) => {
    if (event.link) {
      window.open(event.link, "_blank");
    } else if (event.id && event.id.length > 10) {
      window.open(`https://www.events.hypafy.com/events/${event.id}`, "_blank");
    } else {
      toast({
        title: event.title,
        description: `📅 ${formatDate(event.date)}\n📍 ${event.location || "Location TBA"}`,
      });
    }
  };

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true);

      try {
        const lat = 49.78542855061154;
        const lng = -97.19991754745038;
        const page = 1;

        const response = await fetch(
          `https://nlgrnddx13.execute-api.us-east-1.amazonaws.com/prod/event/list?lat=${lat}&lng=${lng}&page=${page}`,
          {
            method: "GET",
            headers: {
              "x-api-key": "QLQFG0LMMpsaNyR65rDT3sArD4Bdyaq3RsHHdmEd",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const responseData = await response.json();
        const eventsArray = responseData.events || [];
        const formattedEvents: Event[] = eventsArray.map((event: Record<string, unknown>) => ({
          id: event.id as string,
          title: event.title as string,
          description: event.description as string,
          category: "social",
          date: (event.localStart || event.date) as string,
          location: ((event.location as Record<string, string>)?.address || event.location) as string,
          link: event.link as string,
        }));

        setEvents(formattedEvents);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to fetch events from external API.",
          variant: "destructive",
        });
        console.error("API fetch error:", error);
      }

      setIsLoading(false);
    };

    fetchEvents();
  }, [toast]);

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.date) {
      toast({
        title: "Missing fields",
        description: "Title and date are required.",
        variant: "destructive",
      });
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Error",
        description: "Please sign in to add events.",
        variant: "destructive",
      });
      return;
    }

    const eventToAdd = {
      ...newEvent,
      user_id: user.id,
    };

    const { data, error } = await supabase.from("events").insert([eventToAdd]).select();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data && data[0]) {
      setEvents([data[0], ...events]);
      toast({ title: "Event Created", description: "Your event has been added successfully!" });
      setShowAddDialog(false);
      setNewEvent({
        title: "",
        description: "",
        category: "academic",
        date: "",
        location: "",
        link: "",
      });
    }
  };

  const getCategoryInfo = (category: string) => {
    const categories: Record<string, { icon: typeof GraduationCap; label: string; color: string; bgColor: string }> = {
      academic: {
        icon: GraduationCap,
        label: "Academic",
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-500/10",
      },
      career: {
        icon: Briefcase,
        label: "Career",
        color: "text-purple-600 dark:text-purple-400",
        bgColor: "bg-purple-500/10",
      },
      social: {
        icon: Users,
        label: "Social",
        color: "text-pink-600 dark:text-pink-400",
        bgColor: "bg-pink-500/10",
      },
      wellness: {
        icon: Heart,
        label: "Wellness",
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-500/10",
      },
      research: {
        icon: FlaskConical,
        label: "Research",
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-500/10",
      },
      environmental: {
        icon: Leaf,
        label: "Environmental",
        color: "text-green-600 dark:text-green-400",
        bgColor: "bg-green-500/10",
      },
    };
    return categories[category] || categories.social;
  };

  const categories = [
    { id: "all", name: "All", icon: Sparkles },
    { id: "academic", name: "Academic", icon: GraduationCap },
    { id: "career", name: "Career", icon: Briefcase },
    { id: "social", name: "Social", icon: Users },
    { id: "wellness", name: "Wellness", icon: Heart },
    { id: "research", name: "Research", icon: FlaskConical },
    { id: "environmental", name: "Environmental", icon: Leaf },
  ];

  const filteredEvents = events.filter((event) => {
    const matchesSearch =
      event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || event.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatShortDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      day: date.getDate(),
      month: date.toLocaleDateString("en-US", { month: "short" }),
      weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
    };
  };

  const upcomingCount = events.filter((e) => new Date(e.date) > new Date()).length;
  const thisWeekCount = events.filter((e) => {
    const eventDate = new Date(e.date);
    const today = new Date();
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return eventDate >= today && eventDate <= weekFromNow;
  }).length;

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl">
                <CalendarDays className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Events</h1>
                <p className="text-muted-foreground">
                  Discover {events.length} events happening around you
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Stats Pills */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-full">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-600">{upcomingCount} upcoming</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-full">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">{thisWeekCount} this week</span>
              </div>
            </div>

            <Button onClick={() => setShowAddDialog(true)} className="gap-2 shadow-lg">
              <Plus className="h-4 w-4" />
              Add Event
            </Button>
          </div>
        </div>

        {/* Search and Categories */}
        <div className="space-y-4 mb-8">
          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 bg-background/80 backdrop-blur-sm border-muted-foreground/20"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
                onClick={() => setSearchTerm("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Category Pills */}
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-2">
              {categories.map((category) => {
                const Icon = category.icon;
                const count =
                  category.id === "all"
                    ? events.length
                    : events.filter((e) => e.category === category.id).length;
                const isSelected = selectedCategory === category.id;

                return (
                  <Button
                    key={category.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category.id)}
                    className={cn(
                      "gap-2 shrink-0 transition-all",
                      isSelected && "shadow-md"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {category.name}
                    <Badge
                      variant="secondary"
                      className={cn(
                        "ml-1 h-5 min-w-5 px-1.5 text-xs",
                        isSelected && "bg-primary-foreground/20 text-primary-foreground"
                      )}
                    >
                      {count}
                    </Badge>
                  </Button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Events Grid */}
        {filteredEvents.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map((event) => {
              const timeInfo = getTimeRemaining(event.date);
              const categoryInfo = getCategoryInfo(event.category);
              const CategoryIcon = categoryInfo.icon;
              const dateInfo = formatShortDate(event.date);

              return (
                <Card
                  key={event.id}
                  className={cn(
                    "group relative overflow-hidden cursor-pointer transition-all duration-300",
                    "hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1",
                    "border-0 bg-card/80 backdrop-blur-sm",
                    timeInfo.isToday && "ring-2 ring-primary/20"
                  )}
                  onClick={() => handleEventClick(event)}
                >
                  {/* Gradient accent */}
                  <div
                    className={cn(
                      "absolute inset-x-0 top-0 h-1 transition-all duration-300",
                      "bg-gradient-to-r from-primary/60 via-primary to-primary/60",
                      "group-hover:h-1.5"
                    )}
                  />

                  <CardContent className="p-5">
                    <div className="flex gap-4">
                      {/* Date Block */}
                      <div
                        className={cn(
                          "flex flex-col items-center justify-center min-w-14 h-14 rounded-xl",
                          "bg-gradient-to-br from-muted/80 to-muted/40",
                          "group-hover:from-primary/10 group-hover:to-primary/5",
                          "transition-colors duration-300"
                        )}
                      >
                        <span className="text-xs font-medium text-muted-foreground uppercase">
                          {dateInfo.month}
                        </span>
                        <span className="text-xl font-bold leading-none">{dateInfo.day}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Category & Time */}
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            variant="secondary"
                            className={cn(
                              "gap-1.5 font-medium",
                              categoryInfo.bgColor,
                              categoryInfo.color
                            )}
                          >
                            <CategoryIcon className="h-3 w-3" />
                            {categoryInfo.label}
                          </Badge>

                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs font-medium shrink-0",
                              timeInfo.isUpcoming
                                ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/5"
                                : "border-muted-foreground/30 text-muted-foreground"
                            )}
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            {timeInfo.text}
                          </Badge>
                        </div>

                        {/* Title */}
                        <h3 className="font-semibold text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                          {event.title}
                        </h3>

                        {/* Description */}
                        {event.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {event.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDate(event.date)}</span>
                        </div>
                      </div>
                    </div>

                    {event.location && (
                      <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}

                    {/* Hover Action */}
                    <div
                      className={cn(
                        "absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100",
                        "transition-all duration-300 group-hover:translate-x-0 translate-x-2"
                      )}
                    >
                      <div className="p-2 rounded-full bg-primary/10 text-primary">
                        <ChevronRight className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <Card className="py-16 border-dashed bg-muted/20">
            <CardContent className="text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <CalendarDays className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {searchTerm ? "No events found" : "No events yet"}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {searchTerm
                  ? "Try adjusting your search terms or changing the category filter"
                  : "Be the first to add an event and share it with the community"}
              </p>
              {!searchTerm && (
                <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Event
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick Stats - Mobile */}
        <div className="sm:hidden mt-6">
          <Card className="bg-gradient-to-r from-primary/5 via-background to-primary/5">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{upcomingCount}</div>
                  <p className="text-xs text-muted-foreground">Upcoming</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{thisWeekCount}</div>
                  <p className="text-xs text-muted-foreground">This Week</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Event Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Create New Event
            </DialogTitle>
            <DialogDescription>
              Add a new event to share with the community
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                placeholder="Enter event title"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What's this event about?"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                className="resize-none"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={newEvent.category}
                  onValueChange={(val) => setNewEvent({ ...newEvent, category: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="academic">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4" />
                        Academic
                      </div>
                    </SelectItem>
                    <SelectItem value="career">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Career
                      </div>
                    </SelectItem>
                    <SelectItem value="social">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Social
                      </div>
                    </SelectItem>
                    <SelectItem value="wellness">
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4" />
                        Wellness
                      </div>
                    </SelectItem>
                    <SelectItem value="research">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="h-4 w-4" />
                        Research
                      </div>
                    </SelectItem>
                    <SelectItem value="environmental">
                      <div className="flex items-center gap-2">
                        <Leaf className="h-4 w-4" />
                        Environmental
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date & Time *</Label>
                <Input
                  id="date"
                  type="datetime-local"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="location"
                  placeholder="Where is this event?"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="link">Event Link (optional)</Label>
              <div className="relative">
                <ExternalLink className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="link"
                  placeholder="https://..."
                  value={newEvent.link}
                  onChange={(e) => setNewEvent({ ...newEvent, link: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddEvent} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Events;
