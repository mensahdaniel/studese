import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/utils/supabase";
import {
  Copy,
  Check,
  Globe,
  Lock,
  Link2,
  UserPlus,
  X,
  Loader2,
  Mail,
  Users,
  Eye,
  Edit3,
  Trash2,
} from "lucide-react";

type LinkAccess = "private" | "anyone_with_link" | "public";
type SharePermission = "view" | "edit";

interface ShareSettings {
  is_public: boolean;
  public_link_id: string;
  link_access: LinkAccess;
  link_permission: SharePermission;
}

interface SharedUser {
  id: string;
  shared_with: string | null;
  shared_with_email: string;
  permission: SharePermission;
  invite_accepted: boolean;
  user_metadata?: {
    username?: string;
    email?: string;
  };
}

interface ShareNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  noteTitle: string;
}

const ShareNoteDialog: React.FC<ShareNoteDialogProps> = ({
  open,
  onOpenChange,
  noteId,
  noteTitle,
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Share settings
  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    is_public: false,
    public_link_id: "",
    link_access: "private",
    link_permission: "view",
  });

  // Shared users list
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);

  // New invite
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermission, setInvitePermission] =
    useState<SharePermission>("view");
  const [isInviting, setIsInviting] = useState(false);

  // Fetch share settings and shared users
  const fetchShareData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch note share settings
      const { data: noteData, error: noteError } = await supabase
        .from("notes")
        .select("is_public, public_link_id, link_access, link_permission")
        .eq("id", noteId)
        .single();

      if (noteError) throw noteError;

      setShareSettings({
        is_public: noteData.is_public || false,
        public_link_id: noteData.public_link_id || "",
        link_access: noteData.link_access || "private",
        link_permission: noteData.link_permission || "view",
      });

      // Fetch shared users
      const { data: sharesData, error: sharesError } = await supabase
        .from("note_shares")
        .select("*")
        .eq("note_id", noteId);

      if (sharesError) throw sharesError;

      setSharedUsers(sharesData || []);
    } catch (error) {
      console.error("Error fetching share data:", error);
      toast({
        title: "Error",
        description: "Failed to load sharing settings.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [noteId, toast]);

  // Fetch data when dialog opens
  useEffect(() => {
    if (open && noteId) {
      fetchShareData();
    }
  }, [open, noteId, fetchShareData]);

  // Update link access settings
  const updateLinkAccess = async (
    linkAccess: LinkAccess,
    linkPermission?: SharePermission
  ) => {
    setIsSaving(true);
    try {
      const updates: Partial<ShareSettings> = {
        link_access: linkAccess,
        is_public: linkAccess === "public",
      };

      if (linkPermission) {
        updates.link_permission = linkPermission;
      }

      const { error } = await supabase
        .from("notes")
        .update(updates)
        .eq("id", noteId);

      if (error) throw error;

      setShareSettings((prev) => ({
        ...prev,
        ...updates,
      }));

      toast({
        title: "Updated",
        description: "Link sharing settings updated.",
      });
    } catch (error) {
      console.error("Error updating link access:", error);
      toast({
        title: "Error",
        description: "Failed to update sharing settings.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Copy share link
  const copyLink = async () => {
    const shareUrl =
      shareSettings.link_access === "private"
        ? `${window.location.origin}/notes/${noteId}`
        : `${window.location.origin}/shared/${shareSettings.public_link_id}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Link Copied!",
        description: "Share link has been copied to clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link.",
        variant: "destructive",
      });
    }
  };

  // Send invite to email
  const sendInvite = async () => {
    if (!inviteEmail.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter an email address.",
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setIsInviting(true);
    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if already shared
      const existingShare = sharedUsers.find(
        (s) => s.shared_with_email?.toLowerCase() === inviteEmail.toLowerCase()
      );

      if (existingShare) {
        toast({
          title: "Already Shared",
          description: "This note is already shared with this email.",
          variant: "destructive",
        });
        return;
      }

      // Check if user exists in the system using secure RPC function
      // This bypasses RLS to allow looking up other users by email
      const { data: existingUserId, error: lookupError } = await supabase
        .rpc("get_user_id_by_email", { lookup_email: inviteEmail.toLowerCase() });

      if (lookupError) {
        console.warn("Error looking up user by email:", lookupError);
      }

      const existingUser = existingUserId ? { id: existingUserId } : null;

      // Create share record
      const shareData = {
        note_id: noteId,
        shared_by: user.id,
        shared_with: existingUser?.id || null,
        shared_with_email: inviteEmail.toLowerCase(),
        permission: invitePermission,
        invite_accepted: !!existingUser,
      };

      const { data, error } = await supabase
        .from("note_shares")
        .insert(shareData)
        .select()
        .single();

      if (error) throw error;

      // Create in-app notification for existing users using RPC function (bypasses RLS)
      let notificationCreated = false;
      if (existingUser && existingUser.id) {
        try {
          const inviterName = user.user_metadata?.username || user.email?.split("@")[0] || "Someone";

          // Prepare notification data as JSONB
          const notificationDataPayload = {
            note_id: noteId,
            share_id: data.id,
            permission: invitePermission,
            sharer_id: user.id,
            sharer_email: user.email,
          };

          console.log("Creating notification via RPC for user:", existingUser.id);

          // Use RPC function to create notification (bypasses RLS)
          const { data: notificationId, error: notifError } = await supabase
            .rpc("create_notification", {
              p_user_id: existingUser.id,
              p_type: "note_share",
              p_title: "Note shared with you",
              p_message: `${inviterName} shared "${noteTitle}" with you (${invitePermission} access)`,
              p_data: notificationDataPayload,
            });

          if (notifError) {
            console.error("Failed to create notification via RPC:", notifError);
            console.error("Notification error details:", JSON.stringify(notifError, null, 2));
          } else {
            notificationCreated = true;
            console.log("In-app notification created successfully via RPC:", notificationId);
          }
        } catch (notifErr) {
          console.error("Error creating notification:", notifErr);
        }
      } else {
        console.log("No existing user found for email, skipping in-app notification:", inviteEmail);
      }

      // Send email invite via Edge Function (uses Resend API)
      try {
        const inviteResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-share-invite`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              shareId: data.id,
              noteId,
              noteTitle,
              inviteeEmail: inviteEmail.toLowerCase(),
              inviterName: user.user_metadata?.username || user.email?.split("@")[0],
              inviterEmail: user.email,
              permission: invitePermission,
              inviteToken: data.invite_token,
              skipNotification: notificationCreated, // Tell edge function we already created notification
            }),
          }
        );

        const inviteResult = await inviteResponse.json();

        if (inviteResponse.ok && inviteResult.emailSent) {
          console.log("Invite email sent successfully:", inviteResult.message);
        } else {
          console.warn("Email may not have been sent:", inviteResult.message || inviteResult.error);
        }
      } catch (emailError) {
        console.error("Error calling invite function:", emailError);
        // Don't fail the whole operation if email fails
      }

      setSharedUsers((prev) => [...prev, data]);
      setInviteEmail("");

      toast({
        title: "Invite Sent!",
        description: existingUser
          ? `${inviteEmail} now has access to this note.`
          : `Invite email sent to ${inviteEmail}.`,
      });
    } catch (error) {
      console.error("Error sending invite:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send invite.",
        variant: "destructive",
      });
    } finally {
      setIsInviting(false);
    }
  };

  // Update user permission
  const updateUserPermission = async (
    shareId: string,
    permission: SharePermission
  ) => {
    try {
      const { error } = await supabase
        .from("note_shares")
        .update({ permission })
        .eq("id", shareId);

      if (error) throw error;

      setSharedUsers((prev) =>
        prev.map((u) => (u.id === shareId ? { ...u, permission } : u))
      );

      toast({
        title: "Updated",
        description: "Permission updated.",
      });
    } catch (error) {
      console.error("Error updating permission:", error);
      toast({
        title: "Error",
        description: "Failed to update permission.",
        variant: "destructive",
      });
    }
  };

  // Remove user access
  const removeUserAccess = async (shareId: string, email: string) => {
    try {
      const { error } = await supabase
        .from("note_shares")
        .delete()
        .eq("id", shareId);

      if (error) throw error;

      setSharedUsers((prev) => prev.filter((u) => u.id !== shareId));

      toast({
        title: "Removed",
        description: `${email} no longer has access.`,
      });
    } catch (error) {
      console.error("Error removing access:", error);
      toast({
        title: "Error",
        description: "Failed to remove access.",
        variant: "destructive",
      });
    }
  };

  const getLinkAccessIcon = () => {
    switch (shareSettings.link_access) {
      case "public":
        return <Globe className="h-4 w-4 text-green-500" />;
      case "anyone_with_link":
        return <Link2 className="h-4 w-4 text-blue-500" />;
      default:
        return <Lock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getLinkAccessLabel = () => {
    switch (shareSettings.link_access) {
      case "public":
        return "Public - Anyone on the internet";
      case "anyone_with_link":
        return "Anyone with the link";
      default:
        return "Restricted - Only people added can open";
    }
  };

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[500px] max-h-[85vh] sm:max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Users className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="truncate">Share "{noteTitle}"</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Share this note with others or make it public
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6 overflow-y-auto flex-1 pr-1 -mr-1">
            {/* Add People Section */}
            <div className="space-y-2 sm:space-y-3">
              <Label className="text-xs sm:text-sm font-medium flex items-center gap-2">
                <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Add people
              </Label>
              {/* Mobile: Stack vertically, Desktop: Single row */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Enter email address"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      sendInvite();
                    }
                  }}
                  className="flex-1 text-sm h-9 sm:h-10"
                />
                <div className="flex gap-2">
                  <Select
                    value={invitePermission}
                    onValueChange={(v: SharePermission) => setInvitePermission(v)}
                  >
                    <SelectTrigger className="w-[100px] sm:w-[100px] h-9 sm:h-10 text-xs sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">
                        <div className="flex items-center gap-2">
                          <Eye className="h-3 w-3" />
                          View
                        </div>
                      </SelectItem>
                      <SelectItem value="edit">
                        <div className="flex items-center gap-2">
                          <Edit3 className="h-3 w-3" />
                          Edit
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={sendInvite} disabled={isInviting} size="sm" className="h-9 sm:h-10 px-3">
                    {isInviting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Shared Users List */}
            {sharedUsers.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm font-medium">People with access</Label>
                <div className="space-y-2 max-h-[120px] sm:max-h-[150px] overflow-y-auto">
                  {sharedUsers.map((share) => (
                    <div
                      key={share.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-lg bg-muted/50 gap-2"
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <Avatar className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0">
                          <AvatarFallback className="text-xs">
                            {getInitials(share.shared_with_email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-medium truncate">
                            {share.shared_with_email}
                          </p>
                          {!share.invite_accepted && (
                            <Badge variant="secondary" className="text-[10px] sm:text-xs">
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 justify-end flex-shrink-0">
                        <Select
                          value={share.permission}
                          onValueChange={(v: SharePermission) =>
                            updateUserPermission(share.id, v)
                          }
                        >
                          <SelectTrigger className="w-[80px] sm:w-[90px] h-7 sm:h-8 text-[10px] sm:text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="view">Viewer</SelectItem>
                            <SelectItem value="edit">Editor</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
                          onClick={() =>
                            removeUserAccess(share.id, share.shared_with_email)
                          }
                        >
                          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Link Sharing Section */}
            <div className="space-y-2 sm:space-y-3">
              <Label className="text-xs sm:text-sm font-medium flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Link sharing
              </Label>

              {/* Link Access Dropdown */}
              <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg border bg-muted/30">
                <span className="flex-shrink-0">{getLinkAccessIcon()}</span>
                <Select
                  value={shareSettings.link_access}
                  onValueChange={(v: LinkAccess) => updateLinkAccess(v)}
                  disabled={isSaving}
                >
                  <SelectTrigger className="flex-1 border-0 bg-transparent p-0 h-auto focus:ring-0 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">
                      <div className="flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-xs sm:text-sm">Restricted</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            Only people added can open
                          </p>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="anyone_with_link">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-xs sm:text-sm">Anyone with the link</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            Anyone with the link can view/edit
                          </p>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="public">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-xs sm:text-sm">Public</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            Anyone on the internet can find and access
                          </p>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Link Permission (only show if not private) */}
              {shareSettings.link_access !== "private" && (
                <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg border">
                  <span className="text-xs sm:text-sm">Link permission</span>
                  <Select
                    value={shareSettings.link_permission}
                    onValueChange={(v: SharePermission) =>
                      updateLinkAccess(shareSettings.link_access, v)
                    }
                    disabled={isSaving}
                  >
                    <SelectTrigger className="w-[90px] sm:w-[100px] h-8 text-xs sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">
                        <div className="flex items-center gap-2">
                          <Eye className="h-3 w-3" />
                          Viewer
                        </div>
                      </SelectItem>
                      <SelectItem value="edit">
                        <div className="flex items-center gap-2">
                          <Edit3 className="h-3 w-3" />
                          Editor
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Copy Link Button */}
              <Button
                variant="outline"
                className="w-full gap-2 h-9 sm:h-10 text-xs sm:text-sm"
                onClick={copyLink}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Copy link
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ShareNoteDialog;
