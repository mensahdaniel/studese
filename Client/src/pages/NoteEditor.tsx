import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  MoreVertical,
  Focus,
  PanelTop,
  PanelBottom,
  LogOut,
  GripVertical,
  ChevronLeft,
  ChevronRight,
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
  const [isZenMode, setIsZenMode] = useState(false);
  const [zenHeaderActive, setZenHeaderActive] = useState(false);
  const [zenToolbarActive, setZenToolbarActive] = useState(false);
  const [zenPillCollapsed, setZenPillCollapsed] = useState(false);
  const [zenPillPosition, setZenPillPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const zenPillRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, pillX: 0, pillY: 0 });
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

  // Toggle Zen Mode (distraction-free mode)
  const toggleZenMode = () => {
    if (isZenMode) {
      // Exiting Zen Mode - reset all
      setIsZenMode(false);
      setZenHeaderActive(false);
      setZenToolbarActive(false);
      setZenPillCollapsed(false);
    } else {
      setIsZenMode(true);
      // Reset pill position to right side center
      setZenPillPosition({ x: 0, y: 0 });
    }
  };

  // Initialize pill position on the right side
  const zenPillInitialized = useRef(false);
  useLayoutEffect(() => {
    if (isZenMode && !zenPillInitialized.current) {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      setZenPillPosition({
        x: viewportWidth - 60,
        y: viewportHeight / 2 - 80
      });
      zenPillInitialized.current = true;
    }
    if (!isZenMode) {
      zenPillInitialized.current = false;
    }
  }, [isZenMode]);

  // Dragging handlers for Zen Mode pill
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    dragStartRef.current = {
      x: clientX,
      y: clientY,
      pillX: zenPillPosition.x,
      pillY: zenPillPosition.y
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleDragMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;

      const newX = dragStartRef.current.pillX + deltaX;
      const newY = dragStartRef.current.pillY + deltaY;

      // Constrain to viewport
      const pillWidth = zenPillCollapsed ? 40 : 52;
      const pillHeight = zenPillCollapsed ? 40 : 160;
      const maxX = window.innerWidth - pillWidth;
      const maxY = window.innerHeight - pillHeight;

      setZenPillPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleDragEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragMove);
    window.addEventListener('touchend', handleDragEnd);

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, zenPillCollapsed]);

  // Handle clicking outside to hide header/toolbar in Zen Mode
  const handleCanvasClick = () => {
    if (isZenMode) {
      if (zenHeaderActive) setZenHeaderActive(false);
      if (zenToolbarActive) setZenToolbarActive(false);
    }
  };

  // Exit Zen Mode on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isZenMode) {
        if (zenHeaderActive || zenToolbarActive) {
          // First escape hides the bars
          setZenHeaderActive(false);
          setZenToolbarActive(false);
        } else {
          // Second escape exits Zen Mode
          setIsZenMode(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isZenMode, zenHeaderActive, zenToolbarActive]);

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
      <div className="h-dvh bg-background flex flex-col overflow-hidden">
        {/* Top Header Bar - Hidden in Zen Mode unless toggled */}
        <header className={`h-12 sm:h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-2 sm:px-4 z-50 shrink-0 transition-all duration-300 ${isZenMode && !zenHeaderActive ? "opacity-0 pointer-events-none absolute top-0 left-0 right-0" : ""}`}>
          {/* Left Section */}
          <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 shrink-0"
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
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Back to Notes</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-5 sm:h-6 shrink-0" />

            {/* Editable Title - Google Docs style */}
            <div className="flex items-center gap-1 sm:gap-2 ml-1 sm:ml-2 min-w-0 flex-1">
              <div className={`w-2 h-2 rounded-full shrink-0 ${currentCategory?.color || "bg-gray-400"}`} />
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
                  className="h-7 text-sm font-medium w-[120px] sm:w-[200px] px-2"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => {
                    setIsEditingTitle(true);
                    setTimeout(() => titleInputRef.current?.select(), 10);
                  }}
                  className="font-medium text-xs sm:text-sm max-w-[100px] sm:max-w-[200px] truncate hover:bg-muted px-1.5 sm:px-2 py-1 rounded transition-colors text-left"
                  title="Click to rename"
                >
                  {title || "Untitled Note"}
                </button>
              )}
              {pinned && (
                <Badge variant="secondary" className="h-5 text-xs hidden sm:flex">
                  <Pin className="h-3 w-3 mr-1" />
                  Pinned
                </Badge>
              )}
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
            {/* Save Status - Icon only on mobile */}
            <div className="flex items-center gap-1 sm:gap-2 text-xs text-muted-foreground mr-1 sm:mr-2">
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin text-primary" />
                  <span className="hidden sm:inline">Auto-saving...</span>
                </>
              ) : hasUnsavedChanges ? (
                <>
                  <CloudOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Unsaved changes</span>
                </>
              ) : lastSaved ? (
                <>
                  <Cloud className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
                  <span className="hidden sm:inline">Saved {lastSaved.toLocaleTimeString()}</span>
                </>
              ) : null}
            </div>

            {/* Desktop: Show all buttons */}
            <div className="hidden sm:flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleZenMode}>
                    <Focus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zen Mode</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleExport}>
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export as PNG</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleShare}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Share</TooltipContent>
              </Tooltip>

              {/* Settings Sheet */}
              <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
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
            </div>

            {/* Mobile: Dropdown menu for actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 sm:hidden">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={toggleZenMode}>
                  <Focus className="h-4 w-4 mr-2" />
                  Zen Mode
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export as PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShare}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Separator orientation="vertical" className="h-5 sm:h-6" />

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={isSaving}
              size="sm"
              className="gap-1 sm:gap-2 h-8 px-2 sm:px-3 text-xs sm:text-sm"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                  <span className="hidden sm:inline">Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Save</span>
                </>
              )}
            </Button>
          </div>
        </header>

        {/* Main Canvas Area */}
        <main className="flex-1 relative overflow-hidden">
          {/* Canvas */}
          <div onClick={handleCanvasClick} className="w-full h-full">
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
          </div>

          {/* Floating Toolbar - Hidden in Zen Mode unless toggled */}
          <div className={`absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 pb-safe transition-all duration-300 ${isZenMode && !zenToolbarActive ? "opacity-0 pointer-events-none translate-y-4" : ""}`}>
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

          {/* Zen Mode Floating Control Pill - Draggable & Collapsible */}
          {isZenMode && (
            <div
              ref={zenPillRef}
              style={{
                left: zenPillPosition.x,
                top: zenPillPosition.y,
                cursor: isDragging ? 'grabbing' : 'auto'
              }}
              className={`fixed z-50 flex flex-col items-center bg-background/90 backdrop-blur-md border rounded-2xl shadow-xl transition-all duration-200 ${zenPillCollapsed ? 'p-1' : 'p-1.5 gap-1'}`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Handle */}
              <div
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
                className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded-lg transition-colors touch-none"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>

              {zenPillCollapsed ? (
                /* Collapsed State - Just expand button */
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setZenPillCollapsed(false)}
                      className="h-8 w-8 rounded-full hover:bg-muted"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Expand Controls</TooltipContent>
                </Tooltip>
              ) : (
                /* Expanded State - All controls */
                <>
                  {/* Show Header Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={zenHeaderActive ? "default" : "ghost"}
                        size="icon"
                        onClick={() => setZenHeaderActive(!zenHeaderActive)}
                        className={`h-9 w-9 rounded-full transition-all ${zenHeaderActive ? "" : "hover:bg-muted"}`}
                      >
                        <PanelTop className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      {zenHeaderActive ? "Hide Header" : "Show Header"}
                    </TooltipContent>
                  </Tooltip>

                  {/* Show Toolbar Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={zenToolbarActive ? "default" : "ghost"}
                        size="icon"
                        onClick={() => setZenToolbarActive(!zenToolbarActive)}
                        className={`h-9 w-9 rounded-full transition-all ${zenToolbarActive ? "" : "hover:bg-muted"}`}
                      >
                        <PanelBottom className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      {zenToolbarActive ? "Hide Toolbar" : "Show Toolbar"}
                    </TooltipContent>
                  </Tooltip>

                  {/* Divider */}
                  <div className="w-6 h-px bg-border my-0.5" />

                  {/* Collapse Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setZenPillCollapsed(true)}
                        className="h-8 w-8 rounded-full hover:bg-muted"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">Collapse</TooltipContent>
                  </Tooltip>

                  {/* Exit Zen Mode Button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleZenMode}
                        className="h-9 w-9 rounded-full hover:bg-destructive/10 hover:text-destructive transition-all"
                      >
                        <LogOut className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">Exit Zen Mode</TooltipContent>
                  </Tooltip>
                </>
              )}
            </div>
          )}
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
