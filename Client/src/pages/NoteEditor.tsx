import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportToBlob } from "@excalidraw/excalidraw";
import { supabase } from "@/utils/supabase";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { lazy, Suspense } from "react";

const Excalidraw = lazy(() => import("@excalidraw/excalidraw").then((module) => ({ default: module.Excalidraw })));
import "@excalidraw/excalidraw/index.css";

// Define a minimal default appState to avoid collaborators error
const defaultAppState = {
  collaborators: new Map(), // Must be a Map, not array
  viewBackgroundColor: "#ffffff", // Default background
};

const NoteEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("academic");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [pinned, setPinned] = useState(false);
  const [initialData, setInitialData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

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

        // Convert collaborators object back to Map if needed
        const loadedAppState = data.scene.appState || {};
        const collaborators = loadedAppState.collaborators
          ? new Map(Object.entries(loadedAppState.collaborators))
          : new Map();

        setTitle(data.title);
        setCategory(data.category);
        setDate(data.date);
        setPinned(data.pinned);
        setInitialData({
          elements: data.scene.elements || [],
          appState: {
            ...defaultAppState,
            ...loadedAppState,
            collaborators, // Ensure it's a Map
          },
          files: data.scene.files || {},
        });
      } else {
        setInitialData({ elements: [], appState: defaultAppState, files: {} }); // Default for new notes
      }
      setIsLoading(false);
    };

    fetchUserAndNote();
  }, [id, navigate, toast]);

  const handleSave = async () => {
    if (!user) {
      toast({ title: "Error", description: "User not authenticated. Please log in.", variant: "destructive" });
      navigate("/login");
      return;
    }

    if (!title || !category || !date) {
      toast({ title: "Error", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }

    if (!excalidrawAPI) {
      toast({ title: "Error", description: "Editor not ready.", variant: "destructive" });
      return;
    }

    const elements = excalidrawAPI.getSceneElements();
    const appState = excalidrawAPI.getAppState();
    const files = excalidrawAPI.getFiles();
    const scene = { elements, appState, files };

    // Export preview as PNG blob and convert to base64
    const blob = await exportToBlob({ elements, appState, files });
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => resolve(reader.result as string);
    });

    const noteData = {
      user_id: user.id,
      title,
      category,
      date,
      content: base64,
      scene,
      pinned,
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
      toast({ title: "Error", description: error.message || "Failed to save note.", variant: "destructive" });
      console.error("Supabase Error:", error);
    } else {
      toast({ title: "Success", description: "Note saved!" });
      navigate("/notes");
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header with form fields */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={() => navigate("/notes")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div className="flex items-center gap-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="academic">Academic</SelectItem>
                <SelectItem value="study">Study Groups</SelectItem>
                <SelectItem value="research">Research</SelectItem>
                <SelectItem value="personal">Personal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="pinned" checked={pinned} onCheckedChange={(checked) => setPinned(!!checked)} />
            <Label htmlFor="pinned">Pinned</Label>
          </div>
          <Button onClick={handleSave}>Save Note</Button>
        </div>
      </div>

      {/* Excalidraw Canvas (lazy loaded) */}
      <Suspense fallback={<div className="text-center">Loading editor...</div>}>
        <div style={{ height: "calc(100vh - 100px)" }}>
          <Excalidraw
            initialData={initialData}
            excalidrawAPI={(api) => setExcalidrawAPI(api)}
          />
        </div>
      </Suspense>
    </div>
  );
};

export default NoteEditor;