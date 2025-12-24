import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/utils/supabase";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  BellDot,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  Clock,
  Share2,
  Calendar,
  ListTodo,
  Info,
  AlertTriangle,
  Filter,
  Expand,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { notificationEvents } from "@/lib/notificationEvents";

interface Notification {
  id: string;
  type: "note_share" | "reminder" | "system" | "task" | "event";
  title: string;
  message: string | null;
  data: {
    note_id?: string;
    share_id?: string;
    permission?: string;
    task_id?: string;
    event_id?: string;
  };
  is_read: boolean;
  created_at: string;
}

const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [isLoading, setIsLoading] = useState(false);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
  const [highlightedNotification, setHighlightedNotification] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Initialize user ID on mount - needed for real-time subscription
  useEffect(() => {
    const initUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    initUserId();

    // Also listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setCurrentUserId(session.user.id);
      } else {
        setCurrentUserId(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Initialize audio elements
  // notification.mp3 - for general notifications (shares, system messages)
  // alarm.mp3 - for urgent task alarms
  useEffect(() => {
    notificationAudioRef.current = new Audio("/notification.mp3");
    notificationAudioRef.current.volume = 0.5;

    alarmAudioRef.current = new Audio("/alarm.mp3");
    alarmAudioRef.current.volume = 0.8;

    return () => {
      if (notificationAudioRef.current) {
        notificationAudioRef.current.pause();
        notificationAudioRef.current = null;
      }
      if (alarmAudioRef.current) {
        alarmAudioRef.current.pause();
        alarmAudioRef.current = null;
      }
    };
  }, []);

  // Listen for notification events (e.g., task alarms triggering bell to open)
  useEffect(() => {
    const unsubscribeOpenBell = notificationEvents.on('open-bell', () => {
      setIsOpen(true);
    });

    const unsubscribeTaskAlarm = notificationEvents.on('task-alarm', (data) => {
      // Open the bell
      setIsOpen(true);

      // Play alarm sound
      if (alarmAudioRef.current) {
        alarmAudioRef.current.currentTime = 0;
        alarmAudioRef.current.play().catch((err) => {
          console.log("Could not play alarm sound:", err);
        });
      }

      // Highlight the task notification if we have its ID
      if (data.payload?.taskId) {
        setHighlightedNotification(data.payload.taskId);
        // Remove highlight after 5 seconds
        setTimeout(() => setHighlightedNotification(null), 5000);
      }
    });

    return () => {
      unsubscribeOpenBell();
      unsubscribeTaskAlarm();
    };
  }, []);

  // Play notification sound (for general notifications)
  const playNotificationSound = useCallback(() => {
    if (notificationAudioRef.current) {
      notificationAudioRef.current.currentTime = 0;
      notificationAudioRef.current.play().catch((err) => {
        console.log("Could not play notification sound:", err);
      });
    }
  }, []);

  // Play alarm sound (for urgent task reminders)
  const playAlarmSound = useCallback(() => {
    if (alarmAudioRef.current) {
      alarmAudioRef.current.currentTime = 0;
      alarmAudioRef.current.play().catch((err) => {
        console.log("Could not play alarm sound:", err);
      });
    }
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!currentUserId) return;

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error fetching notifications:", error);
        return;
      }

      setNotifications(data || []);
      setUnreadCount(data?.filter((n) => !n.is_read).length || 0);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }, [currentUserId]);

  // Fetch notifications when user ID is available
  useEffect(() => {
    if (currentUserId) {
      fetchNotifications();
    }
  }, [currentUserId, fetchNotifications]);

  // Setup real-time subscription when we have user ID
  useEffect(() => {
    // Only set up real-time subscription if we have the user ID
    if (!currentUserId) return;

    console.log("Setting up notification subscription for user:", currentUserId);

    // Subscribe to new notifications with user_id filter
    const channel = supabase
      .channel(`notifications:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);

          // Handle task/reminder notifications - play alarm and open bell
          if (newNotification.type === "task" || newNotification.type === "reminder") {
            playAlarmSound();
            setIsOpen(true);
            setHighlightedNotification(newNotification.id);
            setTimeout(() => setHighlightedNotification(null), 5000);
          } else {
            // Play regular notification sound for other types
            playNotificationSound();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === payload.new.id ? (payload.new as Notification) : n
            )
          );
          // Recalculate unread count
          fetchNotifications();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          const deletedId = payload.old?.id;
          if (deletedId) {
            console.log("Notification deleted via real-time:", deletedId);
            setNotifications((prev) => {
              const notif = prev.find((n) => n.id === deletedId);
              if (notif && !notif.is_read) {
                setUnreadCount((count) => Math.max(0, count - 1));
              }
              return prev.filter((n) => n.id !== deletedId);
            });
          }
        }
      )
      .subscribe((status) => {
        console.log("Notification subscription status:", status);
      });

    return () => {
      console.log("Cleaning up notification subscription");
      supabase.removeChannel(channel);
    };
    // Note: fetchNotifications is intentionally excluded to avoid re-subscribing on every fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playNotificationSound, playAlarmSound, currentUserId]);

  // Refresh notifications when app becomes visible (important for mobile WebView)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchNotifications();
      }
    };

    // Also listen for focus events (backup for visibility)
    const handleFocus = () => {
      fetchNotifications();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    // Listen for native app foreground event (Expo WebView)
    const handleAppForeground = () => {
      fetchNotifications();
    };
    (window as unknown as { onAppForeground?: () => void }).onAppForeground = handleAppForeground;

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      delete (window as unknown as { onAppForeground?: () => void }).onAppForeground;
    };
  }, [fetchNotifications]);

  // Refresh when popover opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Mark single notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId);

      if (!error) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, is_read: true } : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("is_read", false);

      if (!error) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    try {
      console.log("Attempting to delete notification:", notificationId);

      // Verify we have an authenticated session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error("No authenticated session - cannot delete notification");
        return;
      }
      console.log("Authenticated user:", session.user.id);

      // Optimistically remove from UI first for better UX
      const notif = notifications.find((n) => n.id === notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      if (notif && !notif.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      // Then delete from database - use .select() to verify rows were actually deleted
      const { data: deletedRows, error, status, statusText } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .eq("user_id", session.user.id)
        .select();

      if (error) {
        console.error("Failed to delete notification from database:", {
          error,
          status,
          statusText,
          notificationId,
        });
        // Re-fetch to restore UI state since delete failed
        fetchNotifications();
      } else if (!deletedRows || deletedRows.length === 0) {
        console.error("Delete returned success but no rows were deleted!", {
          notificationId,
          userId: session.user.id,
          status,
        });
        // Re-fetch to restore UI state
        fetchNotifications();
      } else {
        console.log("Notification deleted successfully from database:", {
          id: notificationId,
          deletedCount: deletedRows.length,
        });
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Navigate based on type
    switch (notification.type) {
      case "note_share":
        if (notification.data.note_id) {
          navigate(`/notes/${notification.data.note_id}`);
          setIsOpen(false);
        }
        break;
      case "task":
        if (notification.data.task_id) {
          navigate("/tasks");
          setIsOpen(false);
        }
        break;
      case "event":
        if (notification.data.event_id) {
          navigate("/calendar");
          setIsOpen(false);
        }
        break;
      default:
        break;
    }
  };

  // Get icon for notification type
  const getNotificationIcon = (type: string, isHighlighted: boolean = false) => {
    if (isHighlighted) {
      return <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />;
    }
    switch (type) {
      case "note_share":
        return <Share2 className="h-4 w-4 text-blue-500" />;
      case "task":
        return <ListTodo className="h-4 w-4 text-amber-500" />;
      case "event":
        return <Calendar className="h-4 w-4 text-purple-500" />;
      case "reminder":
        return <Clock className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  // Format relative time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            {unreadCount > 0 ? (
              <>
                <BellDot className="h-5 w-5" />
                <Badge
                  className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs flex items-center justify-center"
                  variant="destructive"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Badge>
              </>
            ) : (
              <Bell className="h-5 w-5" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h4 className="font-semibold">Notifications</h4>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={markAllAsRead}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
          </div>

          {/* Notifications list */}
          <ScrollArea className="max-h-[400px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex items-start gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-all group",
                      !notification.is_read && "bg-primary/5",
                      highlightedNotification === notification.id && "bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 animate-pulse",
                      (notification.type === "task" || notification.type === "reminder") &&
                      highlightedNotification === notification.data.task_id && "bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 animate-pulse"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(
                        notification.type,
                        highlightedNotification === notification.id ||
                        highlightedNotification === notification.data.task_id
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm",
                          !notification.is_read && "font-medium"
                        )}
                      >
                        {notification.title}
                      </p>
                      {notification.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTime(notification.created_at)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!notification.is_read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Unread dot */}
                    {!notification.is_read && (
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          {notifications.length > 0 && (
            <>
              <Separator />
              <div className="p-2">
                <Button
                  variant="ghost"
                  className="w-full text-sm gap-2"
                  onClick={() => {
                    setIsOpen(false);
                    setIsDialogOpen(true);
                  }}
                >
                  <Expand className="h-4 w-4" />
                  View all notifications
                </Button>
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>

      {/* Full Notifications Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Bell className="h-5 w-5 text-primary" />
                </div>
                Notifications
                {unreadCount > 0 && (
                  <Badge variant="destructive">{unreadCount} new</Badge>
                )}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-2">
                    <CheckCheck className="h-4 w-4" />
                    Mark all read
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Tabs */}
          <div className="px-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="all" className="text-xs gap-1">
                  <Filter className="h-3 w-3" />
                  All
                </TabsTrigger>
                <TabsTrigger value="unread" className="text-xs gap-1">
                  <Bell className="h-3 w-3" />
                  Unread
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                      {unreadCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="task" className="text-xs gap-1">
                  <ListTodo className="h-3 w-3" />
                  Tasks
                </TabsTrigger>
                <TabsTrigger value="note_share" className="text-xs gap-1">
                  <Share2 className="h-3 w-3" />
                  Shares
                </TabsTrigger>
                <TabsTrigger value="event" className="text-xs gap-1">
                  <Calendar className="h-3 w-3" />
                  Events
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Separator className="mt-4" />

          {/* Notifications List */}
          <ScrollArea className="flex-1 max-h-[50vh]">
            {(() => {
              const filteredNotifications = notifications.filter((n) => {
                if (activeTab === "all") return true;
                if (activeTab === "unread") return !n.is_read;
                return n.type === activeTab;
              });

              if (filteredNotifications.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="p-4 bg-muted rounded-full mb-4">
                      <BellOff className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold mb-1">No notifications</h3>
                    <p className="text-sm text-muted-foreground text-center">
                      {activeTab === "all"
                        ? "You're all caught up!"
                        : `No ${activeTab === "unread" ? "unread" : activeTab} notifications.`}
                    </p>
                  </div>
                );
              }

              return (
                <div className="divide-y">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "flex items-start gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors group",
                        !notification.is_read && "bg-primary/5"
                      )}
                      onClick={() => {
                        handleNotificationClick(notification);
                        setIsDialogOpen(false);
                      }}
                    >
                      {/* Icon */}
                      <div className="flex-shrink-0 mt-1 p-2 bg-muted rounded-lg">
                        {getNotificationIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-xs font-normal",
                                  notification.type === "note_share" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                                  notification.type === "task" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                                  notification.type === "event" && "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
                                  notification.type === "reminder" && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                )}
                              >
                                {notification.type === "note_share" ? "Share" :
                                  notification.type === "task" ? "Task" :
                                    notification.type === "event" ? "Event" :
                                      notification.type === "reminder" ? "Reminder" : "System"}
                              </Badge>
                              {!notification.is_read && (
                                <span className="w-2 h-2 rounded-full bg-primary" />
                              )}
                            </div>
                            <h4 className={cn("font-medium", !notification.is_read && "font-semibold")}>
                              {notification.title}
                            </h4>
                            {notification.message && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {notification.message}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(notification.created_at)}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!notification.is_read && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                }}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NotificationBell;
