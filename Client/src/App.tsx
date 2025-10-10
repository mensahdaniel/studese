import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import EmailConfirmation from "./pages/EmailConfirmation";
import Dashboard from "./pages/Dashboard";
import Calendar from "./pages/Calendar";
import Notes from "./pages/Notes";
import Tasks from "./pages/Tasks";
import Events from "./pages/Events";
import StudyWellness from "@/pages/StudyWellness";
import Resources from "./pages/Resources";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import NoteEditor from "./pages/NoteEditor";
import StripeCheckout from "./components/StripeCheckout";
import Success from "./pages/Success";
import { supabase } from "@/utils/supabase";

const queryClient = new QueryClient();

// New component to check payment status
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [isPaidUser, setIsPaidUser] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkPaymentStatus = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setIsPaidUser(false);
          setIsLoading(false);
          return;
        }

        // Check if user has paid status in database
        const { data, error } = await supabase
          .from("profiles") // or whatever your user table is called
          .select("is_paid")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Error checking payment status:", error);
          setIsPaidUser(false);
        } else {
          setIsPaidUser(data?.is_paid || false);
        }
      } catch (error) {
        console.error("Error checking payment status:", error);
        setIsPaidUser(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkPaymentStatus();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Checking access...</div>
      </div>
    );
  }

  // If user hasn't paid, redirect to pricing page
  if (!isPaidUser) {
    return <Navigate to="/pricing" replace />;
  }

  return <>{children}</>;
};

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
            {/* Public routes */}
            <Route
              path="/"
              element={session ? <Navigate to="/dashboard" /> : <Landing />}
            />
            <Route
              path="/login"
              element={session ? <Navigate to="/pricing" /> : <Login />}
            />
            <Route path="/email-confirmation" element={<EmailConfirmation />} />

            {/* Payment required route - users must pay before accessing app */}
            <Route
              path="/pricing"
              element={session ? <StripeCheckout /> : <Navigate to="/login" />}
            />

            {/* Success page - after payment */}
            <Route
              path="/success"
              element={session ? <Success /> : <Navigate to="/login" />}
            />

            {/* PROTECTED ROUTES - REQUIRE BOTH LOGIN AND PAYMENT */}
            <Route
              path="/dashboard"
              element={
                session ? (
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
            <Route
              path="/calendar"
              element={
                session ? (
                  <ProtectedRoute>
                    <Calendar />
                  </ProtectedRoute>
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
            <Route
              path="/notes"
              element={
                session ? (
                  <ProtectedRoute>
                    <Notes />
                  </ProtectedRoute>
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
            <Route
              path="/notes/:id"
              element={
                session ? (
                  <ProtectedRoute>
                    <NoteEditor />
                  </ProtectedRoute>
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
            <Route
              path="/study-wellness"
              element={
                session ? (
                  <ProtectedRoute>
                    <StudyWellness />
                  </ProtectedRoute>
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
            <Route
              path="/tasks"
              element={
                session ? (
                  <ProtectedRoute>
                    <Tasks />
                  </ProtectedRoute>
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
            <Route
              path="/events"
              element={
                session ? (
                  <ProtectedRoute>
                    <Events />
                  </ProtectedRoute>
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
            <Route
              path="/resources"
              element={
                session ? (
                  <ProtectedRoute>
                    <Resources />
                  </ProtectedRoute>
                ) : (
                  <Navigate to="/login" />
                )
              }
            />
            <Route
              path="/settings"
              element={
                session ? (
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                ) : (
                  <Navigate to="/login" />
                )
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <Analytics />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
