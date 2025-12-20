// Supabase Edge Function: check-event-reminders
// Scheduled function that checks for upcoming events and sends push notifications
// Run this on a cron schedule (e.g., every 5 minutes)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Types
interface Event {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  category: string;
  location: string | null;
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

// Format time for display
function formatEventTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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

    // Get current time and reminder windows
    const now = new Date();

    // We'll check for events starting in the next 15 minutes
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);
    const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

    console.log(`Checking for events starting between ${tenMinutesFromNow.toISOString()} and ${fifteenMinutesFromNow.toISOString()}`);

    // Fetch events that:
    // - Start within the next 10-15 minutes (gives user time to prepare)
    // - Haven't started yet
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id, user_id, title, description, start_time, end_time, category, location")
      .gte("start_time", tenMinutesFromNow.toISOString())
      .lte("start_time", fifteenMinutesFromNow.toISOString());

    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch events", details: eventsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!events || events.length === 0) {
      console.log("No events starting soon");
      return new Response(
        JSON.stringify({ success: true, message: "No events starting soon", checked: 0, notified: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${events.length} event(s) starting soon`);

    // Check which events have already had notifications sent
    const eventIds = events.map((e) => e.id);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const { data: existingNotifications, error: notifError } = await supabase
      .from("notifications")
      .select("data")
      .eq("type", "event")
      .gte("created_at", oneHourAgo.toISOString());

    if (notifError) {
      console.error("Error checking existing notifications:", notifError);
    }

    // Extract event IDs that already have recent notifications
    const notifiedEventIds = new Set<string>();
    if (existingNotifications) {
      for (const notif of existingNotifications) {
        if (notif.data?.event_id) {
          notifiedEventIds.add(notif.data.event_id as string);
        }
      }
    }

    // Filter out events that already have notifications
    const eventsToNotify = events.filter((e) => !notifiedEventIds.has(e.id));

    if (eventsToNotify.length === 0) {
      console.log("All upcoming events already have notifications");
      return new Response(
        JSON.stringify({
          success: true,
          message: "All events already notified",
          checked: events.length,
          notified: 0
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`${eventsToNotify.length} event(s) need notifications`);

    // Get unique user IDs
    const userIds = [...new Set(eventsToNotify.map((e) => e.user_id))];

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

    for (const event of eventsToNotify) {
      const eventTime = formatEventTime(event.start_time);
      const title = "📅 Event Starting Soon!";
      let body = `"${event.title}" starts at ${eventTime}`;

      if (event.location) {
        body += ` at ${event.location}`;
      }

      const notificationData = {
        event_id: event.id,
        route: "/events",
        type: "event_reminder",
        category: event.category,
        start_time: event.start_time,
      };

      // Add in-app notification
      inAppNotifications.push({
        user_id: event.user_id,
        type: "event",
        title: title,
        message: body,
        data: notificationData,
      });

      // Add push notifications for each user's devices
      const userTokens = tokensByUser.get(event.user_id) || [];
      for (const pt of userTokens) {
        if (pt.token.startsWith("ExponentPushToken")) {
          pushMessages.push({
            to: pt.token,
            title: title,
            body: body,
            data: notificationData,
            sound: "default",
            channelId: "default",
            priority: "high",
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
        checked: events.length,
        notified: eventsToNotify.length,
        inAppCreated: inAppNotifications.length,
        pushSent: pushResult.success,
        pushFailed: pushResult.failed,
        timestamp: now.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in check-event-reminders:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to check event reminders",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
