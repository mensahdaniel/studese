import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ThemeToggle from "@/components/ThemeToggle";
import { User, Bell, Shield, Palette, Database, Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  email: string;
  username?: string;
  created_at?: string;
  last_sign_in_at?: string;
}

const Settings = () => {
  const { toast } = useToast();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Password change state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Email change state
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);

  // Delete account state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Notification preferences
  const [taskReminders, setTaskReminders] = useState(true);
  const [classNotifications, setClassNotifications] = useState(true);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user: authUser }, error } = await supabase.auth.getUser();

        if (error || !authUser) {
          toast({
            title: "Error",
            description: "Failed to load user data",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        setUser({
          email: authUser.email || "",
          username: authUser.user_metadata?.username || authUser.email?.split("@")[0],
          created_at: authUser.created_at,
          last_sign_in_at: authUser.last_sign_in_at,
        });
      } catch (err) {
        console.error("Error fetching user:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [toast]);

  // Handle password change
  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all password fields.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "New password and confirmation don't match.",
        variant: "destructive",
      });
      return;
    }

    setChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Password Updated",
          description: "Your password has been changed successfully.",
        });
        setShowPasswordDialog(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  // Handle email change
  const handleEmailChange = async () => {
    if (!newEmail) {
      toast({
        title: "Missing Email",
        description: "Please enter a new email address.",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setChangingEmail(true);

    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Verification Email Sent",
          description: "Please check your new email inbox to confirm the change.",
        });
        setShowEmailDialog(false);
        setNewEmail("");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setChangingEmail(false);
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      toast({
        title: "Confirmation Required",
        description: "Please type DELETE to confirm account deletion.",
        variant: "destructive",
      });
      return;
    }

    setDeletingAccount(true);

    try {
      // Note: Account deletion typically requires a server-side function
      // This is a placeholder - you may need to implement a proper deletion flow
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (authUser) {
        // Delete user data from various tables
        await supabase.from("tasks").delete().eq("user_id", authUser.id);
        await supabase.from("notes").delete().eq("user_id", authUser.id);
        await supabase.from("events").delete().eq("user_id", authUser.id);
        await supabase.from("notifications").delete().eq("user_id", authUser.id);

        // Sign out
        await supabase.auth.signOut();

        toast({
          title: "Account Deleted",
          description: "Your account and data have been removed.",
        });

        // Redirect to home
        window.location.href = "/";
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete account. Please contact support.",
        variant: "destructive",
      });
    } finally {
      setDeletingAccount(false);
    }
  };

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-6">
            {/* Account */}
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <CardTitle>Account</CardTitle>
                </div>
                <CardDescription>
                  Manage your account information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Email */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <p className="text-sm font-medium">{user?.email || "No email"}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowEmailDialog(true)}>
                    Change
                  </Button>
                </div>

                <Separator />

                {/* Password */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <Label>Password</Label>
                      <p className="text-sm text-muted-foreground">
                        ••••••••••••
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setShowPasswordDialog(true)}>
                    Update
                  </Button>
                </div>

                <Separator />

                {/* Account Info */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Member Since</Label>
                    <p className="text-sm font-medium">{formatDate(user?.created_at)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Last Sign In</Label>
                    <p className="text-sm font-medium">{formatDate(user?.last_sign_in_at)}</p>
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
                  <Switch
                    id="task-reminders"
                    checked={taskReminders}
                    onCheckedChange={setTaskReminders}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="class-notifications">Class Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive alerts for upcoming classes
                    </p>
                  </div>
                  <Switch
                    id="class-notifications"
                    checked={classNotifications}
                    onCheckedChange={setClassNotifications}
                  />
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
                  <Switch
                    id="analytics"
                    checked={analyticsEnabled}
                    onCheckedChange={setAnalyticsEnabled}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Data Management */}
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
                  <Button variant="outline" size="sm">
                    Export
                  </Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-destructive">Delete Account</Label>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your account and all data
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Change Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Email Address</DialogTitle>
            <DialogDescription>
              Enter your new email address. We'll send a verification link to confirm the change.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-email">Current Email</Label>
              <Input
                id="current-email"
                value={user?.email || ""}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">New Email</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="Enter new email address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEmailChange} disabled={changingEmail}>
              {changingEmail && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Verification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your new password. Make sure it's at least 6 characters long.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            {newPassword && newPassword.length < 6 && (
              <p className="text-sm text-destructive">
                Password must be at least 6 characters
              </p>
            )}
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-sm text-destructive">
                Passwords don't match
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePasswordChange}
              disabled={changingPassword || newPassword.length < 6 || newPassword !== confirmPassword}
            >
              {changingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your account and remove all your data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="delete-confirm">
              Type <span className="font-bold">DELETE</span> to confirm
            </Label>
            <Input
              id="delete-confirm"
              className="mt-2"
              placeholder="DELETE"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deletingAccount || deleteConfirmText !== "DELETE"}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deletingAccount && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Settings;
