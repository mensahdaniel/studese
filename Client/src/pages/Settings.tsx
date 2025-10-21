import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import ThemeToggle from "@/components/ThemeToggle";
import { User, Bell, Shield, Palette, Database, CreditCard, Calendar } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/utils/supabase";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      // ✅ DEVELOPMENT BYPASS
      const isDevelopment = process.env.NODE_ENV === 'development' || 
                           window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';

      if (isDevelopment) {
        console.log('🔓 Development mode: Subscription management bypassed');
        toast({ 
          title: "Development Mode", 
          description: "Subscription management is disabled in development. In production, this would redirect to Stripe billing portal.", 
        });
        return;
      }

      // PRODUCTION CODE (only runs in production)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "Please log in first.", variant: "destructive" });
        return;
      }

      console.log('🔄 Starting subscription management for user:', user.id);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token found');
      }

      console.log('🔐 Got auth token, calling Edge Function...');
      const response = await fetch('https://yfkgyamxfescwqqbmtel.supabase.co/functions/v1/create-customer-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId: user.id,
          returnUrl: `${window.location.origin}/settings`
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP Error:', response.status, errorText);
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      console.log('📦 Response from Edge Function:', result);

      if (!result.success) {
        console.error('❌ Edge Function error:', result.error);
        throw new Error(result.error || 'Failed to create billing portal session');
      }

      if (!result.url) {
        console.error('❌ No URL in response:', result);
        throw new Error('No portal URL received from server');
      }

      console.log('✅ Redirecting to Stripe portal:', result.url);
      window.location.href = result.url;
        
    } catch (error: any) {
      console.error('💥 Error in handleManageSubscription:', error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to open billing portal. Please try again later.", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences ⚙️
          </p>
        </div>

        <div className="grid gap-6">
          {/* ✅ ADDED: Subscription & Billing */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5" />
                <CardTitle>Subscription & Billing</CardTitle>
              </div>
              <CardDescription>
                Manage your subscription, payment methods, and billing information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Studese Pro</p>
                  <p className="text-sm text-muted-foreground">Yearly subscription - $6.99/year</p>
                </div>
                <Button 
                  onClick={handleManageSubscription}
                  disabled={loading}
                  variant="outline"
                >
                  {loading ? "Loading..." : "Manage Subscription"}
                </Button>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">Subscription Management</p>
                    <p className="text-sm text-blue-600 mt-1">
                      Update your payment method, download invoices, or cancel your subscription through our secure billing portal.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Palette className="h-5 w-5" />
                <CardTitle>Appearance</CardTitle>
              </div>
              <CardDescription>
                Customize how StudEse looks on your device
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="theme-toggle">Theme</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose between light and dark themes
                  </p>
                </div>
                <ThemeToggle />
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <CardTitle>Notifications</CardTitle>
              </div>
              <CardDescription>
                Configure your notification preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="task-reminders">Task Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified about upcoming tasks and deadlines
                  </p>
                </div>
                <Switch id="task-reminders" defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="class-notifications">Class Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive alerts for upcoming classes
                  </p>
                </div>
                <Switch id="class-notifications" defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Account */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <CardTitle>Account</CardTitle>
              </div>
              <CardDescription>
                Manage your account information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email</Label>
                  <p className="text-sm text-muted-foreground">
                    student@university.edu
                  </p>
                </div>
                <Button variant="outline" size="sm">Change</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Password</Label>
                  <p className="text-sm text-muted-foreground">
                    Last updated 30 days ago
                  </p>
                </div>
                <Button variant="outline" size="sm">Update</Button>
              </div>
            </CardContent>
          </Card>

          {/* Privacy & Security */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <CardTitle>Privacy & Security</CardTitle>
              </div>
              <CardDescription>
                Control your privacy and security settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="analytics">Analytics</Label>
                  <p className="text-sm text-muted-foreground">
                    Help improve StudEse by sharing usage data
                  </p>
                </div>
                <Switch id="analytics" />
              </div>
            </CardContent>
          </Card>

          {/* Data */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <CardTitle>Data Management</CardTitle>
              </div>
              <CardDescription>
                Export or delete your data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Export Data</Label>
                  <p className="text-sm text-muted-foreground">
                    Download all your notes, tasks, and calendar data
                  </p>
                </div>
                <Button variant="outline" size="sm">Export</Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Delete Account</Label>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all data
                  </p>
                </div>
                <Button variant="destructive" size="sm">Delete</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
