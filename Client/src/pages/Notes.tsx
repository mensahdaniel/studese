import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Plus,
  Search,
  FileText,
  Pin,
  Trash2,
  Edit,
  MoreVertical,
  Grid3X3,
  List,
  SortAsc,
  Clock,
  BookOpen,
  GraduationCap,
  FlaskConical,
  User,
  Loader2,
  PinOff,
  FolderOpen,
  Check
} from "lucide-react";

import { supabase } from "@/utils/supabase";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

type Note = {
  id: string;
  title: string;
  category: string;
  date: string;
  pinned: boolean;
  content: string;
  created_at?: string;
  updated_at?: string;
};

// Category configuration
const CATEGORIES = [
  { id: "all", name: "All", fullName: "All Notes", icon: FolderOpen, color: "bg-gray-500" },
  { id: "academic", name: "Academic", fullName: "Academic", icon: GraduationCap, color: "bg-blue-500" },
  { id: "study", name: "Study", fullName: "Study Groups", icon: BookOpen, color: "bg-green-500" },
  { id: "research", name: "Research", fullName: "Research", icon: FlaskConical, color: "bg-amber-500" },
  { id: "personal", name: "Personal", fullName: "Personal", icon: User, color: "bg-purple-500" },
];

const Notes = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [notes, setNotes] = useState<Note[]>([]);
  const [user, setUser] = useState<any>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"date" | "title">("date");

  useEffect(() => {
    const fetchUserAndNotes = async () => {
      setIsLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
        setIsLoading(false);
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
      setIsLoading(false);
    };
    fetchUserAndNotes();
  }, [toast]);

  const handleDeleteNote = async (id: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (!confirm("Are you sure you want to delete this note?")) return;

    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to delete note.", variant: "destructive" });
    } else {
      setNotes((prev) => prev.filter((note) => note.id !== id));
      toast({ title: "Deleted", description: "Note has been removed." });
    }
  };

  const handleTogglePin = async (id: string, currentPinned: boolean, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    const { error } = await supabase.from("notes").update({ pinned: !currentPinned }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to update pin.", variant: "destructive" });
    } else {
      setNotes((prev) =>
        prev.map((note) => (note.id === id ? { ...note, pinned: !currentPinned } : note))
      );
      toast({
        title: currentPinned ? "Unpinned" : "Pinned",
        description: currentPinned ? "Note removed from pinned" : "Note pinned to top"
      });
    }
  };

  const getCategoryInfo = (categoryId: string) => {
    return CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[0];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Filter and sort notes
  const filteredNotes = notes
    .filter((note) => {
      const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "all" || note.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === "title") {
        return a.title.localeCompare(b.title);
      }
      return new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime();
    });

  const pinnedNotes = filteredNotes.filter((note) => note.pinned);
  const regularNotes = filteredNotes.filter((note) => !note.pinned);

  const categoryStats = CATEGORIES.map((cat) => ({
    ...cat,
    count: cat.id === "all" ? notes.length : notes.filter((n) => n.category === cat.id).length,
  }));

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your notes...</p>
        </div>
      </div>
    );
  }

  const NoteCard = ({ note, isPinned = false }: { note: Note; isPinned?: boolean }) => {
    const category = getCategoryInfo(note.category);
    const CategoryIcon = category.icon;

    return (
      <Card
        className={cn(
          "group cursor-pointer transition-all duration-200 active:scale-[0.98] hover:shadow-lg sm:hover:-translate-y-1 overflow-hidden touch-manipulation",
          isPinned && "ring-2 ring-primary/20"
        )}
        onClick={() => navigate(`/notes/${note.id}`)}
      >
        {/* Thumbnail */}
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          {note.content ? (
            <img
              src={note.content}
              alt={note.title}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FileText className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/30" />
            </div>
          )}

          {/* Overlay on hover - hidden on mobile */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 hidden sm:flex items-center justify-center opacity-0 group-hover:opacity-100">
            <Button variant="secondary" size="sm" className="gap-2">
              <Edit className="h-4 w-4" />
              Open
            </Button>
          </div>

          {/* Pin indicator */}
          {isPinned && (
            <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1.5 shadow-md">
              <Pin className="h-3 w-3" />
            </div>
          )}

          {/* Category badge */}
          <div className="absolute bottom-2 left-2">
            <Badge
              variant="secondary"
              className={cn(
                "text-white text-[10px] sm:text-xs shadow-md",
                category.color
              )}
            >
              <CategoryIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
              <span className="hidden xs:inline">{category.name}</span>
            </Badge>
          </div>
        </div>

        {/* Card content */}
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                {note.title || "Untitled Note"}
              </h3>
              <p className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Clock className="h-3 w-3" />
                {formatDate(note.updated_at || note.created_at || note.date)}
              </p>
            </div>

            {/* Actions menu - always visible on mobile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/notes/${note.id}`); }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => handleTogglePin(note.id, note.pinned, e as any)}>
                  {note.pinned ? (
                    <>
                      <PinOff className="h-4 w-4 mr-2" />
                      Unpin
                    </>
                  ) : (
                    <>
                      <Pin className="h-4 w-4 mr-2" />
                      Pin to top
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => handleDeleteNote(note.id, e as any)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-24 sm:pb-6">
        {/* Header - Compact on mobile */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg sm:rounded-xl shrink-0">
                <FileText className="h-5 w-5 sm:h-7 sm:w-7 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-3xl font-bold truncate">Notes</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {notes.length} {notes.length === 1 ? "note" : "notes"}
                </p>
              </div>
            </div>
          </div>
          <Link to="/notes/new" className="shrink-0">
            <Button size="sm" className="gap-1.5 sm:gap-2 h-9 sm:h-10 shadow-lg">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Note</span>
              <span className="sm:hidden">New</span>
            </Button>
          </Link>
        </div>

        {/* Search and Controls - Stacked on mobile */}
        <div className="space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 sm:h-11"
            />
          </div>

          {/* Sort and View Toggle */}
          <div className="flex items-center justify-between gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 h-9">
                  <SortAsc className="h-4 w-4" />
                  <span className="hidden sm:inline">Sort</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setSortBy("date")}>
                  <Clock className="h-4 w-4 mr-2" />
                  Date (newest)
                  {sortBy === "date" && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSortBy("title")}>
                  <SortAsc className="h-4 w-4 mr-2" />
                  Title (A-Z)
                  {sortBy === "title" && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center border rounded-lg p-0.5">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Category Pills - Horizontal scroll on mobile */}
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-2">
            {categoryStats.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <Button
                  key={cat.id}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "gap-1.5 sm:gap-2 transition-all shrink-0 h-9",
                    isSelected && "shadow-md"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="text-xs sm:text-sm">{cat.name}</span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "ml-0.5 h-5 min-w-5 px-1.5 text-[10px] sm:text-xs",
                      isSelected && "bg-primary-foreground/20 text-primary-foreground"
                    )}
                  >
                    {cat.count}
                  </Badge>
                </Button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        {/* Pinned Notes Section */}
        {pinnedNotes.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm sm:text-base font-semibold flex items-center gap-2 text-muted-foreground">
              <Pin className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Pinned
            </h2>
            <div className={cn(
              "grid gap-3 sm:gap-4",
              viewMode === "grid"
                ? "grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "grid-cols-1"
            )}>
              {pinnedNotes.map((note) => (
                <NoteCard key={note.id} note={note} isPinned />
              ))}
            </div>
          </div>
        )}

        {/* All Notes Section */}
        {regularNotes.length > 0 && (
          <div className="space-y-3">
            {pinnedNotes.length > 0 && (
              <h2 className="text-sm sm:text-base font-semibold flex items-center gap-2 text-muted-foreground">
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                All Notes
              </h2>
            )}
            <div className={cn(
              "grid gap-3 sm:gap-4",
              viewMode === "grid"
                ? "grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "grid-cols-1"
            )}>
              {regularNotes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredNotes.length === 0 && (
          <Card className="py-12 sm:py-16 border-dashed">
            <CardContent className="text-center px-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2">
                {searchTerm ? "No notes found" : "Start your first note"}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                {searchTerm
                  ? "Try adjusting your search or category filter"
                  : "Create your first note and start capturing your ideas"
                }
              </p>
              {!searchTerm && (
                <Link to="/notes/new">
                  <Button size="default" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Your First Note
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
};

export default Notes;
