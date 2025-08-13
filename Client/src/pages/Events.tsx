import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Calendar, 
  Clock, 
  Users, 
  Search, 
  Filter,
  ExternalLink
} from "lucide-react";
import Layout from "@/components/Layout";

const Events = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Mock events data
  const campusEvents = [
    {
      id: 1,
      title: "Career Fair 2024",
      description: "Connect with top employers and explore career opportunities across various industries.",
      category: "career",
      date: "2024-01-25",
      time: "10:00 AM - 4:00 PM",
      location: "Student Center Main Hall",
      attendees: 250,
      rsvp: false,
      image: "/api/placeholder/300/200"
    },
    {
      id: 2,
      title: "Python Workshop: Advanced Concepts",
      description: "Deep dive into advanced Python programming concepts including decorators, generators, and async programming.",
      category: "academic",
      date: "2024-01-22",
      time: "2:00 PM - 5:00 PM",
      location: "Computer Science Building, Room 205",
      attendees: 45,
      rsvp: true,
      image: "/api/placeholder/300/200"
    },
    {
      id: 3,
      title: "Mental Health Awareness Seminar",
      description: "Learn about stress management techniques and available mental health resources on campus.",
      category: "wellness",
      date: "2024-01-24",
      time: "6:00 PM - 8:00 PM",
      location: "Health Center Auditorium",
      attendees: 78,
      rsvp: false,
      image: "/api/placeholder/300/200"
    },
    {
      id: 4,
      title: "International Student Mixer",
      description: "Social event for international students to connect, share experiences, and build friendships.",
      category: "social",
      date: "2024-01-26",
      time: "7:00 PM - 10:00 PM",
      location: "International House Common Room",
      attendees: 92,
      rsvp: true,
      image: "/api/placeholder/300/200"
    },
    {
      id: 5,
      title: "Research Symposium: Climate Science",
      description: "Presentations on cutting-edge climate research by faculty and graduate students.",
      category: "research",
      date: "2024-01-28",
      time: "9:00 AM - 3:00 PM",
      location: "Science Building Auditorium",
      attendees: 156,
      rsvp: false,
      image: "/api/placeholder/300/200"
    },
    {
      id: 6,
      title: "Campus Sustainability Fair",
      description: "Learn about eco-friendly initiatives and how you can contribute to campus sustainability.",
      category: "environmental",
      date: "2024-01-30",
      time: "11:00 AM - 3:00 PM",
      location: "Quad Green Space",
      attendees: 203,
      rsvp: false,
      image: "/api/placeholder/300/200"
    }
  ];

  const categories = [
    { id: "all", name: "All Events", count: campusEvents.length },
    { id: "academic", name: "Academic", count: campusEvents.filter(e => e.category === "academic").length },
    { id: "career", name: "Career", count: campusEvents.filter(e => e.category === "career").length },
    { id: "social", name: "Social", count: campusEvents.filter(e => e.category === "social").length },
    { id: "wellness", name: "Wellness", count: campusEvents.filter(e => e.category === "wellness").length },
    { id: "research", name: "Research", count: campusEvents.filter(e => e.category === "research").length },
    { id: "environmental", name: "Environmental", count: campusEvents.filter(e => e.category === "environmental").length }
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

  const filteredEvents = campusEvents.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description.toLowerCase().includes(searchTerm.toLowerCase());
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
        </div>

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
                    <Clock className="h-4 w-4" />
                    {event.time}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {event.location}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {event.attendees} attending
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    className="flex-1"
                    variant={event.rsvp ? "outline" : "default"}
                  >
                    {event.rsvp ? "Cancel RSVP" : "RSVP"}
                  </Button>
                  <Button size="sm" variant="outline">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
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
                <div className="text-2xl font-bold text-primary">{campusEvents.length}</div>
                <p className="text-sm text-muted-foreground">Total Events</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-success/5">
                <div className="text-2xl font-bold text-success">
                  {campusEvents.filter(e => e.rsvp).length}
                </div>
                <p className="text-sm text-muted-foreground">Your RSVPs</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-warning/5">
                <div className="text-2xl font-bold text-warning">3</div>
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