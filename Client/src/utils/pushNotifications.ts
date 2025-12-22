/**
 * Push Notifications API Helper
 * Handles push token registration and sending notifications from the web app
 */

import { supabase } from "./supabase";
import {
  isNativeApp,
  getPushToken,
  onPushTokenReceived,
  PushTokenEvent,
} from "./nativeApp";

// Types
export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
  badge?: number;
  channelId?: "default" | "task-reminders" | "events";
  priority?: "default" | "normal" | "high";
}

export interface SendNotificationOptions {
  userId?: string;
  userIds?: string[];
  tokens?: string[];
}

export interface PushTokenRecord {
  id: string;
  user_id: string;
  token: string;
  platform: "ios" | "android" | "web";
  device_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_used_at: string;
}

/**
 * Register a push token for the current user
 * This should be called when the user logs in on a mobile device
 */
export async function registerPushToken(
  token: string,
  platform: "ios" | "android" | "web",
  deviceName?: string
): Promise<PushTokenRecord | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.warn("Cannot register push token: user not authenticated");
      return null;
    }

    // Use the upsert function we created in the migration
    const { data, error } = await supabase.rpc("upsert_push_token", {
      p_user_id: user.id,
      p_token: token,
      p_platform: platform,
      p_device_name: deviceName || null,
    });

    if (error) {
      console.error("Error registering push token:", error);
      return null;
    }

    console.log("Push token registered successfully");
    return data as PushTokenRecord;
  } catch (error) {
    console.error("Error registering push token:", error);
    return null;
  }
}

/**
 * Get all active push tokens for the current user
 */
export async function getUserPushTokens(): Promise<PushTokenRecord[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return [];
    }

    const { data, error } = await supabase.rpc("get_user_push_tokens", {
      p_user_id: user.id,
    });

    if (error) {
      console.error("Error fetching push tokens:", error);
      return [];
    }

    return (data as PushTokenRecord[]) || [];
  } catch (error) {
    console.error("Error fetching push tokens:", error);
    return [];
  }
}

/**
 * Deactivate a push token (e.g., when user logs out)
 */
export async function deactivatePushToken(token: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("push_tokens")
      .update({ is_active: false })
      .eq("token", token);

    if (error) {
      console.error("Error deactivating push token:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deactivating push token:", error);
    return false;
  }
}

/**
 * Deactivate all push tokens for the current user (e.g., when user logs out from all devices)
 */
export async function deactivateAllPushTokens(): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    const { error } = await supabase
      .from("push_tokens")
      .update({ is_active: false })
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deactivating push tokens:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deactivating push tokens:", error);
    return false;
  }
}

/**
 * Send a push notification to a user via the Edge Function
 */
export async function sendPushNotification(
  notification: PushNotificationPayload,
  options: SendNotificationOptions
): Promise<{ success: boolean; sent?: number; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "send-push-notification",
      {
        body: {
          notification,
          ...options,
        },
      }
    );

    if (error) {
      console.error("Error sending push notification:", error);
      return { success: false, error: error.message };
    }

    return {
      success: data?.success || false,
      sent: data?.sent || 0,
      error: data?.error,
    };
  } catch (error) {
    console.error("Error sending push notification:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send a push notification to the current user (all their devices)
 */
export async function sendPushToCurrentUser(
  notification: PushNotificationPayload
): Promise<{ success: boolean; sent?: number; error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "User not authenticated" };
  }

  return sendPushNotification(notification, { userId: user.id });
}

/**
 * Send a task reminder notification to a user
 */
export async function sendTaskReminderNotification(
  userId: string,
  taskTitle: string,
  taskId: string
): Promise<{ success: boolean; error?: string }> {
  return sendPushNotification(
    {
      title: "Task Reminder",
      body: `Don't forget: ${taskTitle}`,
      data: {
        type: "task_reminder",
        taskId,
        route: "/tasks",
      },
      channelId: "task-reminders",
      priority: "high",
    },
    { userId }
  );
}

/**
 * Send an event reminder notification to a user
 */
export async function sendEventReminderNotification(
  userId: string,
  eventTitle: string,
  eventId: string,
  startsIn: string
): Promise<{ success: boolean; error?: string }> {
  return sendPushNotification(
    {
      title: "Event Starting Soon",
      body: `${eventTitle} starts ${startsIn}`,
      data: {
        type: "event_reminder",
        eventId,
        route: "/events",
      },
      channelId: "events",
      priority: "high",
    },
    { userId }
  );
}

/**
 * Send a share invite notification
 */
export async function sendShareInviteNotification(
  userId: string,
  sharedByName: string,
  noteTitle: string,
  noteId: string
): Promise<{ success: boolean; error?: string }> {
  return sendPushNotification(
    {
      title: "Note Shared With You",
      body: `${sharedByName} shared "${noteTitle}" with you`,
      data: {
        type: "share_invite",
        noteId,
        route: `/notes/${noteId}`,
      },
      priority: "default",
    },
    { userId }
  );
}

/**
 * Initialize push notifications for the current session
 * Call this after user login
 */
export async function initializePushNotifications(): Promise<void> {
  // Only proceed if we're in a native app
  if (!isNativeApp()) {
    console.log("Not in native app, skipping push notification initialization");
    return;
  }

  // Check if we already have a token
  const existingToken = getPushToken();
  if (existingToken) {
    const platform = (window.StudeseNative?.platform || "android") as
      | "ios"
      | "android";
    await registerPushToken(existingToken, platform);
  }

  // Listen for new tokens
  onPushTokenReceived(async (event: PushTokenEvent) => {
    console.log("Received push token:", event.token);
    await registerPushToken(event.token, event.platform);
  });
}

/**
 * Cleanup push notifications on logout
 * Call this when user logs out
 */
export async function cleanupPushNotifications(): Promise<void> {
  if (!isNativeApp()) {
    return;
  }

  const token = getPushToken();
  if (token) {
    await deactivatePushToken(token);
  }
}

// Export default object with all functions
export default {
  registerPushToken,
  getUserPushTokens,
  deactivatePushToken,
  deactivateAllPushTokens,
  sendPushNotification,
  sendPushToCurrentUser,
  sendTaskReminderNotification,
  sendEventReminderNotification,
  sendShareInviteNotification,
  initializePushNotifications,
  cleanupPushNotifications,
};
