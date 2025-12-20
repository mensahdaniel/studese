import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/utils/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Save,
  Settings2,
  Download,
  Share2,
  Pin,
  Cloud,
  CloudOff,
  Loader2,
  FileText,
  BookOpen,
  GraduationCap,
  FlaskConical,
  User,
  Maximize2,
  Minimize2,
} from "lucide-react";
import ShareNoteDialog from "@/components/ShareNoteDialog";
import DrawingCanvas, {
  type DrawingCanvasRef,
  type CanvasState,
  type Tool,
  type PaperTemplate
} from "@/components/DrawingCanvas";
import CanvasToolbar from "@/components/CanvasToolbar";

// Category configuration with icons and colors
const CATEGORIES = [
  { id: "academic", name: "Academic", icon: GraduationCap, color: "bg-blue-500" },
  { id: "study", name: "Study Groups", icon: BookOpen, color: "bg-green-500" },
  { id: "research", name: "Research", icon: FlaskConical, color: "bg-amber-500" },
  { id: "personal", name: "Personal", icon: User, color: "bg-purple-500" },
];

const NoteEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const canvasRef = useRef<DrawingCanvasRef>(null);

  // User state
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Note metadata
  const [title, setTitle] = useState("Untitled Note");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("academic");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [pinned, setPinned] = useState(false);

  // Canvas state
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#1a1a2e");
  const [size, setSize] = useState(4);
  const [template, setTemplate] = useState<PaperTemplate>("blank");
  const [background, setBackground] = useState("#ffffff");
  const [initialCanvasState, setInitialCanvasState] = useState<CanvasState | undefined>(undefined);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  // Auto-save timer ref
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const AUTO_SAVE_DELAY = 10000; // 10 seconds of idle time

  // Fetch user and note data
  useEffect(() => {
    const fetchUserAndNote = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        toast({ title: "Error", description: "Please log in to save notes.", variant: "destructive" });
        navigate("/login");
        return;
      }
      setUser(user);

      if (id !== "new") {
        const { data, error } = await supabase
          .from("notes")
          .select("*")
          .eq("id", id)
          .eq("user_id", user.id)
          .single();

        if (error || !data) {
          toast({ title: "Error", description: "Note not found.", variant: "destructive" });
          navigate("/notes");
          return;
        }

        setTitle(data.title || "Untitled Note");
        setCategory(data.category);
        setDate(data.date);
        setPinned(data.pinned);

        // Load canvas state if it exists
        if (data.canvas_state) {
          setInitialCanvasState(data.canvas_state);
          setTemplate(data.canvas_state.template || "blank");
          setBackground(data.canvas_state.background || "#ffffff");
        }

        setLastSaved(new Date(data.updated_at || data.created_at));
      }
      setIsLoading(false);
    };

    fetchUserAndNote();
  }, [id, navigate, toast]);

  // Auto-save function
  const performAutoSave = useCallback(async () => {
    if (!user || !canvasRef.current || isSaving) {
      return;
    }

    console.log("Auto-saving...");
    setIsSaving(true);

    try {
      const canvasState = canvasRef.current.exportState();
      const imageData = await canvasRef.current.exportAsImage();

      const noteData = {
        user_id: user.id,
        title,
        category,
        date,
        content: imageData,
        canvas_state: canvasState,
        pinned,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (id === "new") {
        // For new notes, insert first then redirect to the saved note
        const { data, error: insertError } = await supabase.from("notes").insert(noteData).select().single();
        error = insertError;
        if (!error && data) {
          // Navigate to the saved note so future auto-saves work
          navigate(`/notes/${data.id}`, { replace: true });
        }
      } else {
        const { error: updateError } = await supabase.from("notes").update(noteData).eq("id", id);
        error = updateError;
      }

      if (error) {
        console.error("Auto-save failed:", error);
      } else {
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        console.log("Auto-saved successfully");
      }
    } catch (error) {
      console.error("Auto-save error:", error);
    } finally {
      setIsSaving(false);
    }
  }, [user, title, category, date, pinned, id, isSaving, navigate]);

  // Handle canvas changes - trigger auto-save timer
  const handleCanvasChange = useCallback((state: CanvasState) => {
    setHasUnsavedChanges(true);
    setCanUndo(canvasRef.current?.canUndo() || false);
    setCanRedo(canvasRef.current?.canRedo() || false);

    // Clear existing auto-save timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new auto-save timer
    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave();
    }, AUTO_SAVE_DELAY);
  }, [performAutoSave]);

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Also trigger auto-save timer when metadata changes
  useEffect(() => {
    if (hasUnsavedChanges) {
      // Clear existing timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Set new timer
      autoSaveTimerRef.current = setTimeout(() => {
        performAutoSave();
      }, AUTO_SAVE_DELAY);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [title, category, date, pinned, hasUnsavedChanges, id, performAutoSave]);

  // Save note
  const handleSave = async () => {
    if (!user) {
      toast({ title: "Error", description: "User not authenticated. Please log in.", variant: "destructive" });
      navigate("/login");
      return;
    }

    if (!canvasRef.current) {
      toast({ title: "Error", description: "Canvas not ready.", variant: "destructive" });
      return;
    }

    setIsSaving(true);

    try {
      // Get canvas data
      const canvasState = canvasRef.current.exportState();
      const imageData = await canvasRef.current.exportAsImage();

      const noteData = {
        user_id: user.id,
        title,
        category,
        date,
        content: imageData, // PNG preview
        canvas_state: canvasState, // Full canvas state for reloading
        pinned,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (id === "new") {
        const { error: insertError } = await supabase.from("notes").insert(noteData);
        error = insertError;
      } else {
        const { error: updateError } = await supabase.from("notes").update(noteData).eq("id", id);
        error = updateError;
      }

      if (error) {
        throw error;
      }

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      toast({ title: "Saved!", description: "Your note has been saved successfully." });

      if (id === "new") {
        navigate("/notes");
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save note.", variant: "destructive" });
      console.error("Save Error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Export as PNG
  const handleExport = async () => {
    if (!canvasRef.current) return;

    try {
      const imageData = await canvasRef.current.exportAsImage();
      const a = document.createElement("a");
      a.href = imageData;
      a.download = `${title || "note"}.png`;
      a.click();
      toast({ title: "Exported!", description: "Your note has been downloaded as PNG." });
    } catch (error) {
      toast({ title: "Export Failed", description: "Could not export the note.", variant: "destructive" });
    }
  };

  // Undo/Redo handlers
  const handleUndo = () => {
    canvasRef.current?.undo();
    setCanUndo(canvasRef.current?.canUndo() || false);
    setCanRedo(canvasRef.current?.canRedo() || false);
  };

  const handleRedo = () => {
    canvasRef.current?.redo();
    setCanUndo(canvasRef.current?.canUndo() || false);
    setCanRedo(canvasRef.current?.canRedo() || false);
  };

  const handleClear = () => {
    if (confirm("Are you sure you want to clear the canvas?")) {
      canvasRef.current?.clear();
      setCanUndo(canvasRef.current?.canUndo() || false);
      setCanRedo(canvasRef.current?.canRedo() || false);
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Share functionality
  const handleShare = () => {
    if (id === "new") {
      toast({
        title: "Save First",
        description: "Please save the note before sharing.",
        variant: "destructive",
      });
      return;
    }
    setShareDialogOpen(true);
  };

  // Get category info
  const currentCategory = CATEGORIES.find((c) => c.id === category);
  const CategoryIcon = currentCategory?.icon || FileText;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your note...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-screen bg-background flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4 z-50 shrink-0">
          {/* Left Section */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (hasUnsavedChanges) {
                      if (confirm("You have unsaved changes. Are you sure you want to leave?")) {
                        navigate("/notes");
                      }
                    } else {
                      navigate("/notes");
                    }
                  }}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Back to Notes</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6" />

            {/* Editable Title - Google Docs style */}
            <div className="flex items-center gap-2 ml-2">
              <div className={`w-2 h-2 rounded-full ${currentCategory?.color || "bg-gray-400"}`} />
              {isEditingTitle ? (
                <Input
                  ref={titleInputRef}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  onBlur={() => {
                    setIsEditingTitle(false);
                    if (!title.trim()) {
                      setTitle("Untitled Note");
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setIsEditingTitle(false);
                      if (!title.trim()) {
                        setTitle("Untitled Note");
                      }
                    }
                    if (e.key === "Escape") {
                      setIsEditingTitle(false);
                    }
                  }}
                  className="h-7 text-sm font-medium w-[200px] px-2"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => {
                    setIsEditingTitle(true);
                    setTimeout(() => titleInputRef.current?.select(), 10);
                  }}
                  className="font-medium text-sm max-w-[200px] truncate hover:bg-muted px-2 py-1 rounded transition-colors text-left"
                  title="Click to rename"
                >
                  {title || "Untitled Note"}
                </button>
              )}
              {pinned && (
                <Badge variant="secondary" className="h-5 text-xs">
                  <Pin className="h-3 w-3 mr-1" />
                  Pinned
                </Badge>
              )}
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            {/* Save Status */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mr-2">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="hidden sm:inline">Auto-saving...</span>
                </>
              ) : hasUnsavedChanges ? (
                <>
                  <CloudOff className="h-4 w-4" />
                  <span className="hidden sm:inline">Unsaved changes</span>
                </>
              ) : lastSaved ? (
                <>
                  <Cloud className="h-4 w-4 text-green-500" />
                  <span className="hidden sm:inline">Saved {lastSaved.toLocaleTimeString()}</span>
                </>
              ) : null}
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleExport}>
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export as PNG</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleShare}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share</TooltipContent>
            </Tooltip>

            {/* Settings Sheet */}
            <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[340px]">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <CategoryIcon className="h-5 w-5" />
                    Note Settings
                  </SheetTitle>
                </SheetHeader>

                <div className="space-y-6 mt-6">
                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-sm font-medium">Title</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setHasUnsavedChanges(true);
                      }}
                      onBlur={() => {
                        if (!title.trim()) {
                          setTitle("Untitled Note");
                        }
                      }}
                      placeholder="Give your note a title..."
                      className="h-10"
                    />
                  </div>

                  {/* Category */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${cat.color}`} />
                              {cat.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date */}
                  <div className="space-y-2">
                    <Label htmlFor="date" className="text-sm font-medium">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-10"
                    />
                  </div>

                  <Separator />

                  {/* Pin Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Pin className="h-4 w-4" />
                        Pin Note
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Pinned notes appear at the top
                      </p>
                    </div>
                    <Switch
                      checked={pinned}
                      onCheckedChange={setPinned}
                    />
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <Separator orientation="vertical" className="h-6" />

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </div>
        </header>

        {/* Main Canvas Area */}
        <main className="flex-1 relative overflow-hidden" style={{ minHeight: "calc(100vh - 56px)" }}>
          {/* Canvas */}
          <DrawingCanvas
            ref={canvasRef}
            initialState={initialCanvasState}
            onChange={handleCanvasChange}
            tool={tool}
            color={color}
            size={size}
            template={template}
            background={background}
            className="w-full h-full"
          />

          {/* Floating Toolbar */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
            <CanvasToolbar
              tool={tool}
              setTool={setTool}
              color={color}
              setColor={setColor}
              size={size}
              setSize={setSize}
              template={template}
              setTemplate={setTemplate}
              background={background}
              setBackground={setBackground}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onClear={handleClear}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          </div>
        </main>

        {/* Share Dialog */}
        {id !== "new" && (
          <ShareNoteDialog
            open={shareDialogOpen}
            onOpenChange={setShareDialogOpen}
            noteId={id}
            noteTitle={title}
          />
        )}
      </div>
    </TooltipProvider>
  );
};

export default NoteEditor;
