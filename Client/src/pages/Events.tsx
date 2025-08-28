import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Calendar, 
  Search, 
  Filter,
  ExternalLink,
  Plus
} from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/utils/supabase";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Events = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    category: "academic",
    date: "",
    location: "",
    link: ""
  });

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: true });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setEvents(data || []);
      }
      setIsLoading(false);
    };

    fetchEvents();
  }, [toast]);

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.date) {
      toast({ title: "Missing fields", description: "Title and date required.", variant: "destructive" });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      return;
    }

    const eventToAdd = {
      ...newEvent,
      user_id: user.id
    };

    const { data, error } = await supabase.from("events").insert([eventToAdd]).select();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setEvents([data[0], ...events]);
      toast({ title: "Success", description: "Event added!" });
      setShowForm(false);
      setNewEvent({ title: "", description: "", category: "academic", date: "", location: "", link: "" });
    }
  };

  const categories = [
    { id: "all", name: "All Events", count: events.length },
    { id: "academic", name: "Academic", count: events.filter(e => e.category === "academic").length },
    { id: "career", name: "Career", count: events.filter(e => e.category === "career").length },
    { id: "social", name: "Social", count: events.filter(e => e.category === "social").length },
    { id: "wellness", name: "Wellness", count: events.filter(e => e.category === "wellness").length },
    { id: "research", name: "Research", count: events.filter(e => e.category === "research").length },
    { id: "environmental", name: "Environmental", count: events.filter(e => e.category === "environmental").length }
  ];

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "academic": return "bg-primary/10 text-primary";
      case "career": return "bg-purple-500/10 text-purple-600";
      case "social": return "bg-pink-500/10 text-pink-600";
      case "wellness": return "bg-green-500/10 text-green-600";
      case "research": return "bg-blue-500/10 text-blue-600";
      case "environmental": return "bg-emerald-500/10 text-emerald-600";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || event.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <MapPin className="h-8 w-8" />
              Campus Events
            </h1>
            <p className="text-muted-foreground">Discover and join exciting events happening on campus</p>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Event
          </Button>
        </div>

        {/* Add Event Form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>Add New Event</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Title"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              />
              <Input
                placeholder="Description"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
              />
              <Select value={newEvent.category} onValueChange={(val) => setNewEvent({ ...newEvent, category: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="academic">Academic (Class)</SelectItem>
                  <SelectItem value="career">Career</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                  <SelectItem value="wellness">Wellness</SelectItem>
                  <SelectItem value="research">Research</SelectItem>
                  <SelectItem value="environmental">Environmental</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={newEvent.date}
                onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
              />
              <Input
                placeholder="Location"
                value={newEvent.location}
                onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
              />
              <Input
                placeholder="Link (optional)"
                value={newEvent.link}
                onChange={(e) => setNewEvent({ ...newEvent, link: e.target.value })}
              />
              <Button onClick={handleAddEvent}>Save Event</Button>
            </CardContent>
          </Card>
        )}

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filter by Date
          </Button>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className="text-sm"
            >
              {category.name} ({category.count})
            </Button>
          ))}
        </div>

        {/* Events Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <Card key={event.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-video bg-muted relative">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <Badge variant="secondary" className={getCategoryColor(event.category)}>
                    {event.category}
                  </Badge>
                </div>
              </div>
              
              <CardHeader className="pb-3">
                <CardTitle className="text-lg leading-tight">{event.title}</CardTitle>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {event.description}
                </p>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {formatDate(event.date)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {event.location}
                  </div>
                </div>
                
                <div className="flex gap-2">
                  {event.link && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={event.link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Join Online
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredEvents.length === 0 && (
          <Card className="py-12">
            <CardContent className="text-center">
              <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No events found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "Try adjusting your search terms or filters" : "No events are currently available"}
              </p>
              <Button variant="outline">
                View All Events
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Upcoming Events Summary */}
        <Card>
          <CardHeader>
            <CardTitle>This Week's Highlights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-primary/5">
                <div className="text-2xl font-bold text-primary">{events.length}</div>
                <p className="text-sm text-muted-foreground">Total Events</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-warning/5">
                <div className="text-2xl font-bold text-warning">
                  {events.filter(e => {
                    const eventDate = new Date(e.date);
                    const today = new Date();
                    return eventDate >= today && eventDate <= new Date(today.setDate(today.getDate() + 7));
                  }).length}
                </div>
                <p className="text-sm text-muted-foreground">This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Events;