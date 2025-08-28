import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Calendar from "./pages/Calendar";
import Notes from "./pages/Notes";
import Tasks from "./pages/Tasks";
import Events from "./pages/Events";
import Resources from "./pages/Resources";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import NoteEditor from "./pages/NoteEditor";
import { supabase } from "@/utils/supabase";

const queryClient = new QueryClient();

const App = () => {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsLoading(false);
    });

    // Cleanup subscription on unmount
    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route
              path="/notes/:id"
              element={session ? <NoteEditor /> : <Navigate to="/login" />}
            />
            <Route path="/" element={session ? <Dashboard /> : <Landing />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={session ? <Dashboard /> : <Navigate to="/login" />}
            />
            <Route
              path="/calendar"
              element={session ? <Calendar /> : <Navigate to="/login" />}
            />
            <Route
              path="/notes"
              element={session ? <Notes /> : <Navigate to="/login" />}
            />
            <Route
              path="/tasks"
              element={session ? <Tasks /> : <Navigate to="/login" />}
            />
            <Route
              path="/events"
              element={session ? <Events /> : <Navigate to="/login" />}
            />
            <Route
              path="/resources"
              element={session ? <Resources /> : <Navigate to="/login" />}
            />
            <Route
              path="/settings"
              element={session ? <Settings /> : <Navigate to="/login" />}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
