// Supabase Edge Function: check-task-reminders
// Scheduled function that checks for due tasks and sends push notifications
// Run this on a cron schedule (e.g., every 5 minutes)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Types
interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string;
  priority: string;
  completed: boolean;
  reminder_sent: boolean;
}

interface PushToken {
  token: string;
  platform: string;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
  badge?: number;
  channelId?: string;
  priority?: "default" | "normal" | "high";
}

// Expo Push API endpoint
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Send notifications via Expo Push API
async function sendToExpo(messages: ExpoPushMessage[]): Promise<{ success: number; failed: number }> {
  if (messages.length === 0) {
    return { success: 0, failed: 0 };
  }

  const batchSize = 100;
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(batch),
      });

      if (!response.ok) {
        console.error("Expo Push API error:", response.status);
        failedCount += batch.length;
        continue;
      }

      const result = await response.json();

      for (const ticket of result.data) {
        if (ticket.status === "ok") {
          successCount++;
        } else {
          failedCount++;
          console.error("Push failed:", ticket.message);
        }
      }
    } catch (error) {
      console.error("Error sending batch:", error);
      failedCount += batch.length;
    }
  }

  return { success: successCount, failed: failedCount };
}

// Main handler
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current time and time window for reminders
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    console.log(`Checking for tasks due between ${fiveMinutesAgo.toISOString()} and ${fiveMinutesFromNow.toISOString()}`);

    // First, check if reminder_sent column exists, if not we need to handle it
    // Fetch tasks that are:
    // - Not completed
    // - Due within the reminder window (5 min before to 5 min after now)
    // - Haven't had a reminder sent yet (if tracking)
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("id, user_id, title, description, due_date, priority, completed")
      .eq("completed", false)
      .gte("due_date", fiveMinutesAgo.toISOString())
      .lte("due_date", fiveMinutesFromNow.toISOString());

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch tasks", details: tasksError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tasks || tasks.length === 0) {
      console.log("No tasks due in the reminder window");
      return new Response(
        JSON.stringify({ success: true, message: "No tasks due", checked: 0, notified: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${tasks.length} task(s) due soon`);

    // Check which tasks have already had notifications sent
    // We'll use the notifications table to avoid duplicates
    const taskIds = tasks.map((t) => t.id);
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    const { data: existingNotifications, error: notifError } = await supabase
      .from("notifications")
      .select("data")
      .eq("type", "task")
      .gte("created_at", thirtyMinutesAgo.toISOString());

    if (notifError) {
      console.error("Error checking existing notifications:", notifError);
    }

    // Extract task IDs that already have recent notifications
    const notifiedTaskIds = new Set<string>();
    if (existingNotifications) {
      for (const notif of existingNotifications) {
        if (notif.data?.task_id) {
          notifiedTaskIds.add(notif.data.task_id as string);
        }
      }
    }

    // Filter out tasks that already have notifications
    const tasksToNotify = tasks.filter((t) => !notifiedTaskIds.has(t.id));

    if (tasksToNotify.length === 0) {
      console.log("All due tasks already have notifications");
      return new Response(
        JSON.stringify({
          success: true,
          message: "All tasks already notified",
          checked: tasks.length,
          notified: 0
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`${tasksToNotify.length} task(s) need notifications`);

    // Get unique user IDs
    const userIds = [...new Set(tasksToNotify.map((t) => t.user_id))];

    // Fetch push tokens for all affected users
    const { data: pushTokens, error: tokensError } = await supabase
      .from("push_tokens")
      .select("user_id, token, platform")
      .in("user_id", userIds)
      .eq("is_active", true);

    if (tokensError) {
      console.error("Error fetching push tokens:", tokensError);
    }

    // Group tokens by user
    const tokensByUser = new Map<string, PushToken[]>();
    if (pushTokens) {
      for (const pt of pushTokens) {
        if (!tokensByUser.has(pt.user_id)) {
          tokensByUser.set(pt.user_id, []);
        }
        tokensByUser.get(pt.user_id)!.push({ token: pt.token, platform: pt.platform });
      }
    }

    // Build push messages and in-app notifications
    const pushMessages: ExpoPushMessage[] = [];
    const inAppNotifications: Array<{
      user_id: string;
      type: string;
      title: string;
      message: string;
      data: Record<string, unknown>;
    }> = [];

    for (const task of tasksToNotify) {
      const title = "⏰ Task Due Now!";
      const body = `"${task.title}" is due now!`;
      const notificationData = {
        task_id: task.id,
        route: "/tasks",
        type: "task_reminder",
        priority: task.priority,
      };

      // Add in-app notification
      inAppNotifications.push({
        user_id: task.user_id,
        type: "task",
        title: title,
        message: body,
        data: notificationData,
      });

      // Add push notifications for each user's devices
      const userTokens = tokensByUser.get(task.user_id) || [];
      for (const pt of userTokens) {
        if (pt.token.startsWith("ExponentPushToken")) {
          pushMessages.push({
            to: pt.token,
            title: title,
            body: body,
            data: notificationData,
            sound: "default",
            channelId: "default",
            priority: task.priority === "high" ? "high" : "default",
          });
        }
      }
    }

    // Insert in-app notifications
    if (inAppNotifications.length > 0) {
      const { error: insertError } = await supabase
        .from("notifications")
        .insert(inAppNotifications);

      if (insertError) {
        console.error("Error inserting notifications:", insertError);
      } else {
        console.log(`Created ${inAppNotifications.length} in-app notification(s)`);
      }
    }

    // Send push notifications
    let pushResult = { success: 0, failed: 0 };
    if (pushMessages.length > 0) {
      console.log(`Sending ${pushMessages.length} push notification(s)...`);
      pushResult = await sendToExpo(pushMessages);
      console.log(`Push results: ${pushResult.success} success, ${pushResult.failed} failed`);
    } else {
      console.log("No push tokens found for affected users");
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: tasks.length,
        notified: tasksToNotify.length,
        inAppCreated: inAppNotifications.length,
        pushSent: pushResult.success,
        pushFailed: pushResult.failed,
        timestamp: now.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in check-task-reminders:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to check task reminders",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
