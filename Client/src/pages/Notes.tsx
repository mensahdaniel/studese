import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, Pin, Trash2, Filter, Edit } from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/utils/supabase";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

type Note = {
  id: string;
  title: string;
  category: string;
  date: string;
  pinned: boolean;
  content: string; // base64 preview
};

const Notes = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [notes, setNotes] = useState<Note[]>([]);
  const [user, setUser] = useState<any>(null);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true); // Added loading state

  useEffect(() => {
    const fetchUserAndNotes = async () => {
      setIsLoading(true); // Set loading to true at the start of fetch
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
        setIsLoading(false); // Stop loading if authentication fails
        return;
      }
      setUser(user);

      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        toast({ title: "Error", description: "Failed to fetch notes.", variant: "destructive" });
      } else {
        setNotes(data || []);
      }
      setIsLoading(false); // Set loading to false after data is fetched
    };
    fetchUserAndNotes();
  }, [toast]);

  const handleDeleteNote = async (id: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete note.", variant: "destructive" });
    } else {
      setNotes((prev) => prev.filter((note) => note.id !== id));
      toast({ title: "Success", description: "Note deleted." });
    }
  };

  const handleTogglePin = async (id: string, currentPinned: boolean) => {
    const { error } = await supabase.from("notes").update({ pinned: !currentPinned }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to update pin.", variant: "destructive" });
    } else {
      setNotes((prev) =>
        prev.map((note) => (note.id === id ? { ...note, pinned: !currentPinned } : note))
      );
    }
  };

  const categories = [
    { id: "all", name: "All Notes", count: notes.length },
    { id: "academic", name: "Academic", count: notes.filter((n) => n.category === "academic").length },
    { id: "study", name: "Study Groups", count: notes.filter((n) => n.category === "study").length },
    { id: "research", name: "Research", count: notes.filter((n) => n.category === "research").length },
    { id: "personal", name: "Personal", count: notes.filter((n) => n.category === "personal").length },
  ];

  const filteredNotes = notes.filter((note) => {
    const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || note.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const pinnedNotes = filteredNotes.filter((note) => note.pinned);
  const regularNotes = filteredNotes.filter((note) => !note.pinned);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "academic":
        return "bg-primary/10 text-primary";
      case "study":
        return "bg-success/10 text-success";
      case "research":
        return "bg-warning/10 text-warning";
      case "personal":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>; // Loading screen

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
          <Link to="/notes/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Note
            </Button>
          </Link>
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
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
              className="text-sm"
            >
              {cat.name} ({cat.count})
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
                    <img src={note.content} alt="Note preview" className="w-full h-auto rounded-md mb-4" />
                    <div className="flex items-center gap-2">
                      <Link to={`/notes/${note.id}`}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteNote(note.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleTogglePin(note.id, note.pinned)}>
                        <Pin className="h-4 w-4" />
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
          {pinnedNotes.length > 0 && <h2 className="text-lg font-semibold">All Notes</h2>}
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
                  <img src={note.content} alt="Note preview" className="w-full h-auto rounded-md mb-4" />
                  <div className="flex items-center gap-2">
                    <Link to={`/notes/${note.id}`}>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteNote(note.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleTogglePin(note.id, note.pinned)}>
                      <Pin className="h-4 w-4" />
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
              <Link to="/notes/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Note
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default Notes;