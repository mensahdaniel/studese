import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  FileText, 
  Pin, 
  Edit, 
  Trash2,
  Filter
} from "lucide-react";
import Layout from "@/components/Layout";

const Notes = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  
  // Mock notes data
  const notes = [
    {
      id: 1,
      title: "Computer Science 101 - Lecture 5",
      content: "Today we covered algorithms and data structures. Key points: Big O notation, sorting algorithms, and time complexity analysis...",
      category: "academic",
      date: "2024-01-15",
      pinned: true
    },
    {
      id: 2,
      title: "Biology Study Group Ideas",
      content: "Meeting scheduled for Thursday. Topics to cover: cellular respiration, photosynthesis, and protein synthesis...",
      category: "study",
      date: "2024-01-14",
      pinned: false
    },
    {
      id: 3,
      title: "Research Paper Outline",
      content: "Title: 'Impact of Climate Change on Marine Ecosystems'. Structure: Introduction, Literature Review, Methodology...",
      category: "research",
      date: "2024-01-13",
      pinned: true
    },
    {
      id: 4,
      title: "Campus Event Planning",
      content: "Student council meeting notes. Budget allocation for spring events, venue bookings, and promotional strategies...",
      category: "personal",
      date: "2024-01-12",
      pinned: false
    }
  ];

  const categories = [
    { id: "all", name: "All Notes", count: notes.length },
    { id: "academic", name: "Academic", count: notes.filter(n => n.category === "academic").length },
    { id: "study", name: "Study Groups", count: notes.filter(n => n.category === "study").length },
    { id: "research", name: "Research", count: notes.filter(n => n.category === "research").length },
    { id: "personal", name: "Personal", count: notes.filter(n => n.category === "personal").length }
  ];

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         note.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || note.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const pinnedNotes = filteredNotes.filter(note => note.pinned);
  const regularNotes = filteredNotes.filter(note => !note.pinned);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "academic": return "bg-primary/10 text-primary";
      case "study": return "bg-success/10 text-success";
      case "research": return "bg-warning/10 text-warning";
      case "personal": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-8 w-8" />
              Notes
            </h1>
            <p className="text-muted-foreground">Capture and organize your thoughts</p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Note
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notes..."
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

        {/* Categories */}
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

        {/* Pinned Notes */}
        {pinnedNotes.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Pin className="h-5 w-5" />
              Pinned Notes
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pinnedNotes.map((note) => (
                <Card key={note.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg leading-tight">{note.title}</CardTitle>
                      <Pin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={getCategoryColor(note.category)}>
                        {note.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{note.date}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {note.content}
                    </p>
                    <div className="flex items-center gap-2 mt-4">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Regular Notes */}
        <div className="space-y-4">
          {pinnedNotes.length > 0 && (
            <h2 className="text-lg font-semibold">All Notes</h2>
          )}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regularNotes.map((note) => (
              <Card key={note.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg leading-tight">{note.title}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={getCategoryColor(note.category)}>
                      {note.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{note.date}</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {note.content}
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Empty State */}
        {filteredNotes.length === 0 && (
          <Card className="py-12">
            <CardContent className="text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No notes found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "Try adjusting your search terms" : "Create your first note to get started"}
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Note
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default Notes;