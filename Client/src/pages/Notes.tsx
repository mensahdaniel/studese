import { useState, useEffect } from "react";
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

type Note = {
  id: string;
  title: string;
  category: string;
  priority: "high" | "normal";
  dueDate: string;
  completed: boolean;
  description: string;
  pinned?: boolean;
};

const Notes = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [notes, setNotes] = useState<Note[]>([]);
  const [showForm, setShowForm] = useState(false);

  // Form fields
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("academic");
  const [priority, setPriority] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");

  // Fetch notes from API
  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const res = await fetch("/api/notes"); // Your API endpoint
        const data = await res.json();
        setNotes(data);
      } catch (err) {
        console.error("Failed to fetch notes:", err);
      }
    };
    fetchNotes();
  }, []);

  const handleAddNote = async () => {
    if (!title.trim() || !description.trim() || !dueDate) return;

    const newNote = {
      title,
      category,
      priority: priority ? "high" : "normal",
      dueDate,
      completed: false,
      description,
    };

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newNote),
      });
      const savedNote = await res.json();
      setNotes((prev) => [savedNote, ...prev]);
      setTitle("");
      setCategory("academic");
      setPriority(false);
      setDueDate("");
      setDescription("");
      setShowForm(false);
    } catch (err) {
      console.error("Failed to add note:", err);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await fetch(`/api/notes/${id}`, { method: "DELETE" });
      setNotes((prev) => prev.filter(note => note.id !== id));
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  };

  const categories = [
    { id: "all", name: "All Notes", count: notes.length },
    { id: "academic", name: "Academic", count: notes.filter(n => n.category === "academic").length },
    { id: "study", name: "Study Groups", count: notes.filter(n => n.category === "study").length },
    { id: "research", name: "Research", count: notes.filter(n => n.category === "research").length },
    { id: "personal", name: "Personal", count: notes.filter(n => n.category === "personal").length }
  ];

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         note.description.toLowerCase().includes(searchTerm.toLowerCase());
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
          <Button onClick={() => setShowForm((prev) => !prev)}>
            <Plus className="h-4 w-4 mr-2" />
            {showForm ? "Cancel" : "New Note"}
          </Button>
        </div>

        {/* New Note Form */}
        {showForm && (
          <Card className="p-4">
            <div className="space-y-4">
              <Input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="border rounded-md p-2 w-full"
              >
                <option value="academic">Academic</option>
                <option value="study">Study Groups</option>
                <option value="research">Research</option>
                <option value="personal">Personal</option>
              </select>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={priority}
                  onChange={(e) => setPriority(e.target.checked)}
                />
                <span>High Priority</span>
              </div>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <Textarea
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <Button onClick={handleAddNote}>
                <Plus className="h-4 w-4 mr-2" />
                Add Note
              </Button>
            </div>
          </Card>
        )}

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
                      <span className="text-xs text-muted-foreground">{note.dueDate}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {note.description}
                    </p>
                    <div className="flex items-center gap-2 mt-4">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteNote(note.id)}>
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
                    <span className="text-xs text-muted-foreground">{note.dueDate}</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {note.description}
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteNote(note.id)}>
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
              <Button onClick={() => setShowForm(true)}>
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
