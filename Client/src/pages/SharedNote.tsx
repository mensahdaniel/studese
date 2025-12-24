import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/utils/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Download,
  Loader2,
  FileText,
  Eye,
  Edit3,
  Lock,
  User,
  Calendar,
  BookOpen,
  GraduationCap,
  FlaskConical,
} from "lucide-react";
import DrawingCanvas, {
  type DrawingCanvasRef,
  type CanvasState,
  type Tool,
  type PaperTemplate
} from "@/components/DrawingCanvas";
import CanvasToolbar from "@/components/CanvasToolbar";

// Category configuration
const CATEGORIES = [
  { id: "academic", name: "Academic", icon: GraduationCap, color: "bg-blue-500" },
  { id: "study", name: "Study Groups", icon: BookOpen, color: "bg-green-500" },
  { id: "research", name: "Research", icon: FlaskConical, color: "bg-amber-500" },
  { id: "personal", name: "Personal", icon: User, color: "bg-purple-500" },
];

interface NoteData {
  id: string;
  title: string;
  category: string;
  date: string;
  canvas_state: CanvasState | null;
  link_permission: "view" | "edit";
  user_id: string;
  profiles?: {
    username?: string;
  };
}

const SharedNote = () => {
  const { linkId } = useParams<{ linkId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const canvasRef = useRef<DrawingCanvasRef>(null);

  // Note data
  const [note, setNote] = useState<NoteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Canvas state
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#1a1a2e");
  const [size, setSize] = useState(4);
  const [template, setTemplate] = useState<PaperTemplate>("blank");
  const [background, setBackground] = useState("#ffffff");
  const [initialCanvasState, setInitialCanvasState] = useState<CanvasState | undefined>(undefined);

  // UI state
  const [canEdit, setCanEdit] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Fetch shared note
  useEffect(() => {
    const fetchSharedNote = async () => {
      if (!linkId) {
        setError("Invalid share link");
        setIsLoading(false);
        return;
      }

      try {
        // Fetch note by public_link_id
        const { data, error: fetchError } = await supabase
          .from("notes")
          .select(`
            id,
            title,
            category,
            date,
            canvas_state,
            link_permission,
            link_access,
            user_id
          `)
          .eq("public_link_id", linkId)
          .in("link_access", ["anyone_with_link", "public"])
          .single();

        if (fetchError) {
          console.error("Fetch error:", fetchError);
          setError("This note is not available or the link has expired.");
          setIsLoading(false);
          return;
        }

        if (!data) {
          setError("Note not found or access denied.");
          setIsLoading(false);
          return;
        }

        setNote(data);
        setCanEdit(data.link_permission === "edit");

        // Load canvas state
        if (data.canvas_state) {
          setInitialCanvasState(data.canvas_state);
          setTemplate(data.canvas_state.template || "blank");
          setBackground(data.canvas_state.background || "#ffffff");
        }

        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching shared note:", err);
        setError("An error occurred while loading the note.");
        setIsLoading(false);
      }
    };

    fetchSharedNote();
  }, [linkId]);

  // Handle canvas changes
  const handleCanvasChange = (state: CanvasState) => {
    if (canEdit) {
      setHasUnsavedChanges(true);
      setCanUndo(canvasRef.current?.canUndo() || false);
      setCanRedo(canvasRef.current?.canRedo() || false);
    }
  };

  // Save changes (only if edit permission)
  const handleSave = async () => {
    if (!canEdit || !note || !canvasRef.current) return;

    setIsSaving(true);
    try {
      const canvasState = canvasRef.current.exportState();
      const imageData = await canvasRef.current.exportAsImage();

      const { error: updateError } = await supabase
        .from("notes")
        .update({
          canvas_state: canvasState,
          content: imageData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", note.id);

      if (updateError) throw updateError;

      setHasUnsavedChanges(false);
      toast({
        title: "Saved!",
        description: "Your changes have been saved.",
      });
    } catch (err) {
      console.error("Save error:", err);
      toast({
        title: "Error",
        description: "Failed to save changes.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Export as PNG
  const handleExport = async () => {
    if (!canvasRef.current || !note) return;

    try {
      const imageData = await canvasRef.current.exportAsImage();
      const a = document.createElement("a");
      a.href = imageData;
      a.download = `${note.title || "note"}.png`;
      a.click();
      toast({
        title: "Exported!",
        description: "Note has been downloaded as PNG.",
      });
    } catch (err) {
      toast({
        title: "Export Failed",
        description: "Could not export the note.",
        variant: "destructive",
      });
    }
  };

  // Undo/Redo handlers
  const handleUndo = () => {
    if (!canEdit) return;
    canvasRef.current?.undo();
    setCanUndo(canvasRef.current?.canUndo() || false);
    setCanRedo(canvasRef.current?.canRedo() || false);
  };

  const handleRedo = () => {
    if (!canEdit) return;
    canvasRef.current?.redo();
    setCanUndo(canvasRef.current?.canUndo() || false);
    setCanRedo(canvasRef.current?.canRedo() || false);
  };

  const handleClear = () => {
    if (!canEdit) return;
    if (confirm("Are you sure you want to clear the canvas?")) {
      canvasRef.current?.clear();
      setCanUndo(canvasRef.current?.canUndo() || false);
      setCanRedo(canvasRef.current?.canRedo() || false);
    }
  };

  // Get category info
  const currentCategory = CATEGORIES.find((c) => c.id === note?.category);
  const CategoryIcon = currentCategory?.icon || FileText;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading shared note...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !note) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <Lock className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground max-w-md">
            {error || "This note is not available or you don't have permission to view it."}
          </p>
          <Button onClick={() => navigate("/")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Home
          </Button>
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
                <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Go Home</TooltipContent>
            </Tooltip>

            <div className="h-6 w-px bg-border" />

            {/* Title Display */}
            <div className="flex items-center gap-2 ml-2">
              <div className={`w-2 h-2 rounded-full ${currentCategory?.color || "bg-gray-400"}`} />
              <span className="font-medium text-sm max-w-[200px] truncate">
                {note.title || "Untitled Note"}
              </span>
              <Badge variant="secondary" className="h-5 text-xs gap-1">
                {canEdit ? (
                  <>
                    <Edit3 className="h-3 w-3" />
                    Can Edit
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3" />
                    View Only
                  </>
                )}
              </Badge>
            </div>
          </div>

          {/* Center - Note Info */}
          <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <CategoryIcon className="h-3.5 w-3.5" />
              <span>{currentCategory?.name || note.category}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>{new Date(note.date).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            {/* Save status for editors */}
            {canEdit && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mr-2">
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="hidden sm:inline">Saving...</span>
                  </>
                ) : hasUnsavedChanges ? (
                  <span className="text-amber-500">Unsaved changes</span>
                ) : null}
              </div>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleExport}>
                  <Download className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export as PNG</TooltipContent>
            </Tooltip>

            {/* Save Button (only for editors) */}
            {canEdit && (
              <Button onClick={handleSave} disabled={isSaving || !hasUnsavedChanges}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </Button>
            )}
          </div>
        </header>

        {/* Main Canvas Area */}
        <main className="flex-1 relative overflow-hidden" style={{ minHeight: "calc(100vh - 56px)" }}>
          {/* Canvas */}
          <DrawingCanvas
            ref={canvasRef}
            initialState={initialCanvasState}
            onChange={handleCanvasChange}
            tool={canEdit ? tool : "pen"}
            color={color}
            size={size}
            template={template}
            background={background}
            className="w-full h-full"
          />

          {/* Floating Toolbar (only for editors) */}
          {canEdit && (
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
          )}

          {/* View-only overlay message */}
          {!canEdit && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
              <div className="bg-background/90 backdrop-blur border rounded-full px-4 py-2 shadow-lg flex items-center gap-2 text-sm text-muted-foreground">
                <Eye className="h-4 w-4" />
                <span>View-only mode</span>
              </div>
            </div>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
};

export default SharedNote;
