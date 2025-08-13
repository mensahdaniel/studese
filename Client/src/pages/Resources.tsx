import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  ExternalLink, 
  Star, 
  Search, 
  Filter,
  Link,
  Phone,
  Mail,
  Clock
} from "lucide-react";
import Layout from "@/components/Layout";

const Resources = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Mock resources data
  const resources = [
    {
      id: 1,
      title: "Student Portal",
      description: "Access grades, course schedules, financial aid information, and academic records.",
      category: "academic",
      type: "portal",
      url: "https://student.university.edu",
      bookmarked: true,
      hours: "24/7 Online",
      contact: "portal@university.edu"
    },
    {
      id: 2,
      title: "University Library",
      description: "Online catalog, research databases, study room reservations, and digital resources.",
      category: "academic",
      type: "service",
      url: "https://library.university.edu",
      bookmarked: true,
      hours: "Mon-Thu: 7am-12am, Fri-Sun: 9am-10pm",
      contact: "(555) 123-4567"
    },
    {
      id: 3,
      title: "Career Services Center",
      description: "Resume reviews, interview preparation, job search assistance, and career counseling.",
      category: "career",
      type: "service",
      url: "https://careers.university.edu",
      bookmarked: false,
      hours: "Mon-Fri: 8am-5pm",
      contact: "careers@university.edu"
    },
    {
      id: 4,
      title: "Academic Success Center",
      description: "Tutoring services, study skills workshops, and academic coaching for all subjects.",
      category: "academic",
      type: "service",
      url: "https://success.university.edu",
      bookmarked: true,
      hours: "Mon-Fri: 9am-8pm, Sat-Sun: 1pm-6pm",
      contact: "(555) 123-4568"
    },
    {
      id: 5,
      title: "Student Health Services",
      description: "Medical care, mental health counseling, and wellness programs for students.",
      category: "health",
      type: "service",
      url: "https://health.university.edu",
      bookmarked: false,
      hours: "Mon-Fri: 8am-5pm, Emergency 24/7",
      contact: "(555) 123-4569"
    },
    {
      id: 6,
      title: "Financial Aid Office",
      description: "Scholarships, grants, loans, and financial counseling services.",
      category: "financial",
      type: "service",
      url: "https://financialaid.university.edu",
      bookmarked: false,
      hours: "Mon-Fri: 8am-4:30pm",
      contact: "finaid@university.edu"
    },
    {
      id: 7,
      title: "IT Help Desk",
      description: "Technical support for students, software access, and device troubleshooting.",
      category: "technology",
      type: "support",
      url: "https://it.university.edu",
      bookmarked: true,
      hours: "24/7 Online, Phone: Mon-Fri 7am-7pm",
      contact: "(555) 123-HELP"
    },
    {
      id: 8,
      title: "Student Activities Office",
      description: "Club registration, event planning assistance, and student organization resources.",
      category: "social",
      type: "service",
      url: "https://activities.university.edu",
      bookmarked: false,
      hours: "Mon-Fri: 9am-5pm",
      contact: "activities@university.edu"
    },
    {
      id: 9,
      title: "Dining Services",
      description: "Meal plans, dining hall hours, nutritional information, and special dietary accommodations.",
      category: "dining",
      type: "service",
      url: "https://dining.university.edu",
      bookmarked: false,
      hours: "Varies by location",
      contact: "dining@university.edu"
    },
    {
      id: 10,
      title: "Transportation Services",
      description: "Campus shuttle schedules, parking permits, and bike share program information.",
      category: "transportation",
      type: "service",
      url: "https://transportation.university.edu",
      bookmarked: false,
      hours: "Mon-Fri: 8am-5pm",
      contact: "parking@university.edu"
    }
  ];

  const categories = [
    { id: "all", name: "All Resources", count: resources.length },
    { id: "academic", name: "Academic", count: resources.filter(r => r.category === "academic").length },
    { id: "career", name: "Career", count: resources.filter(r => r.category === "career").length },
    { id: "health", name: "Health & Wellness", count: resources.filter(r => r.category === "health").length },
    { id: "financial", name: "Financial", count: resources.filter(r => r.category === "financial").length },
    { id: "technology", name: "Technology", count: resources.filter(r => r.category === "technology").length },
    { id: "social", name: "Social", count: resources.filter(r => r.category === "social").length }
  ];

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "academic": return "bg-primary/10 text-primary";
      case "career": return "bg-purple-500/10 text-purple-600";
      case "health": return "bg-green-500/10 text-green-600";
      case "financial": return "bg-yellow-500/10 text-yellow-600";
      case "technology": return "bg-blue-500/10 text-blue-600";
      case "social": return "bg-pink-500/10 text-pink-600";
      case "dining": return "bg-orange-500/10 text-orange-600";
      case "transportation": return "bg-indigo-500/10 text-indigo-600";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "portal": return Link;
      case "service": return BookOpen;
      case "support": return Phone;
      default: return BookOpen;
    }
  };

  const filteredResources = resources.filter(resource => {
    const matchesSearch = resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         resource.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || resource.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const bookmarkedResources = resources.filter(resource => resource.bookmarked);

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BookOpen className="h-8 w-8" />
              Campus Resources
            </h1>
            <p className="text-muted-foreground">Quick access to essential university services and tools</p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search resources..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filter
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

        {/* Bookmarked Resources */}
        {bookmarkedResources.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Star className="h-5 w-5 fill-current text-warning" />
              Bookmarked Resources
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bookmarkedResources.map((resource) => {
                const TypeIcon = getTypeIcon(resource.type);
                return (
                  <Card key={resource.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <TypeIcon className="h-5 w-5 text-muted-foreground" />
                          <CardTitle className="text-lg">{resource.title}</CardTitle>
                        </div>
                        <Star className="h-4 w-4 fill-current text-warning flex-shrink-0" />
                      </div>
                      <Badge variant="secondary" className={getCategoryColor(resource.category)}>
                        {resource.category}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        {resource.description}
                      </p>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {resource.hours}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {resource.contact.includes('@') ? (
                            <Mail className="h-3 w-3" />
                          ) : (
                            <Phone className="h-3 w-3" />
                          )}
                          {resource.contact}
                        </div>
                      </div>
                      
                      <Button size="sm" className="w-full">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Visit Resource
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* All Resources */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">All Resources</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredResources.map((resource) => {
              const TypeIcon = getTypeIcon(resource.type);
              return (
                <Card key={resource.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">{resource.title}</CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={resource.bookmarked ? "text-warning" : "text-muted-foreground"}
                      >
                        <Star className={`h-4 w-4 ${resource.bookmarked ? 'fill-current' : ''}`} />
                      </Button>
                    </div>
                    <Badge variant="secondary" className={getCategoryColor(resource.category)}>
                      {resource.category}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {resource.description}
                    </p>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {resource.hours}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {resource.contact.includes('@') ? (
                          <Mail className="h-3 w-3" />
                        ) : (
                          <Phone className="h-3 w-3" />
                        )}
                        {resource.contact}
                      </div>
                    </div>
                    
                    <Button size="sm" variant="outline" className="w-full">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Visit Resource
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Empty State */}
        {filteredResources.length === 0 && (
          <Card className="py-12">
            <CardContent className="text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No resources found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search terms or browse different categories
              </p>
              <Button variant="outline" onClick={() => setSearchTerm("")}>
                Clear Search
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default Resources;