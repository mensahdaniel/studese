import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Analytics } from '@vercel/analytics/react';
import { initMobileApp } from "@/utils/mobile";
import { startTaskReminders, stopTaskReminders } from "@/services/taskReminderService";
import { initializePushNotifications, cleanupPushNotifications } from "@/utils/pushNotifications";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
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
import SharedNote from "./pages/SharedNote";
import Layout from "./components/Layout";

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
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setIsPaidUser(false);
          setIsLoading(false);
          return;
        }

        // Check if user has paid status in database
        const { data, error } = await supabase
          .from('profiles') // or whatever your user table is called
          .select('is_paid')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error checking payment status:', error);
          setIsPaidUser(false);
        } else {
          setIsPaidUser(data?.is_paid || false);
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
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
    // Initialize mobile app features (Capacitor/Expo)
    initMobileApp();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);

      // Start task reminders and push notifications if user is logged in
      if (session) {
        startTaskReminders();
        initializePushNotifications();
      }
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsLoading(false);

      // Start/stop task reminders and push notifications based on auth state
      if (session) {
        startTaskReminders();
        initializePushNotifications();
      } else {
        stopTaskReminders();
        cleanupPushNotifications();
      }
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
      stopTaskReminders();
      cleanupPushNotifications();
    };
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
          {/* Add viewport meta for mobile if running as native app */}
          <Routes>
            {/* Public routes */}
            <Route path="/" element={session ? <Navigate to="/dashboard" /> : <Landing />} />
            <Route path="/login" element={session ? <Navigate to="/pricing" /> : <Login />} />

            {/* Payment required route - users must pay before accessing app */}
            <Route path="/pricing" element={session ? <StripeCheckout /> : <Navigate to="/login" />} />

            {/* Success page - after payment */}
            <Route path="/success" element={session ? <Success /> : <Navigate to="/login" />} />

            {/* Public shared note route - accessible without login */}
            <Route path="/shared/:linkId" element={<SharedNote />} />

            {/* PROTECTED ROUTES - REQUIRE BOTH LOGIN AND PAYMENT */}
            {/* Wrap all protected routes in a persistent Layout */}
            <Route
              element={
                session ? (
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                ) : (
                  <Navigate to="/login" />
                )
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="/notes/:id" element={<NoteEditor />} />
              <Route path="/study-wellness" element={<StudyWellness />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/events" element={<Events />} />
              <Route path="/resources" element={<Resources />} />
              <Route path="/settings" element={<Settings />} />
            </Route>


            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        <Analytics />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
