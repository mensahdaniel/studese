// Supabase Edge Function: send-push-notification
// Sends push notifications to users via Expo Push Notification Service

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Expo Push API endpoint
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Types
interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  device_name: string | null;
  is_active: boolean;
}

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
  badge?: number;
  channelId?: string;
  priority?: "default" | "normal" | "high";
  ttl?: number; // Time to live in seconds
}

interface SendNotificationRequest {
  // Send to specific user(s)
  userId?: string;
  userIds?: string[];
  // Or send to specific token(s)
  tokens?: string[];
  // Notification content
  notification: NotificationPayload;
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
  ttl?: number;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: Record<string, unknown>;
}

interface ExpoPushResponse {
  data: ExpoPushTicket[];
}

// Send notifications via Expo Push API
async function sendToExpo(messages: ExpoPushMessage[]): Promise<ExpoPushResponse> {
  // Expo recommends sending in batches of 100
  const batchSize = 100;
  const allTickets: ExpoPushTicket[] = [];

  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);

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
      const errorText = await response.text();
      console.error("Expo Push API error:", response.status, errorText);
      throw new Error(`Expo Push API error: ${response.status}`);
    }

    const result = await response.json();
    allTickets.push(...result.data);
  }

  return { data: allTickets };
}

// Main handler
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: SendNotificationRequest = await req.json();

    // Validate notification payload
    if (!body.notification?.title || !body.notification?.body) {
      return new Response(
        JSON.stringify({ error: "Missing required notification fields: title and body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Need either userId(s) or tokens
    if (!body.userId && !body.userIds?.length && !body.tokens?.length) {
      return new Response(
        JSON.stringify({ error: "Must provide userId, userIds, or tokens" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let tokensToSend: string[] = [];

    // If tokens are provided directly, use them
    if (body.tokens?.length) {
      tokensToSend = body.tokens.filter((t) => t.startsWith("ExponentPushToken"));
    }

    // If userId(s) provided, fetch tokens from database
    if (body.userId || body.userIds?.length) {
      // Create Supabase client with service role for accessing all tokens
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

      // Build user IDs array
      const userIdsToQuery = body.userIds || [];
      if (body.userId) {
        userIdsToQuery.push(body.userId);
      }

      // Fetch active push tokens for the user(s)
      const { data: tokens, error } = await supabase
        .from("push_tokens")
        .select("token")
        .in("user_id", userIdsToQuery)
        .eq("is_active", true);

      if (error) {
        console.error("Database error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to fetch push tokens" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (tokens && tokens.length > 0) {
        tokensToSend.push(
          ...tokens
            .map((t: { token: string }) => t.token)
            .filter((t: string) => t.startsWith("ExponentPushToken"))
        );
      }
    }

    // Remove duplicates
    tokensToSend = [...new Set(tokensToSend)];

    if (tokensToSend.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No valid push tokens found for the specified user(s)",
          sent: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build Expo push messages
    const messages: ExpoPushMessage[] = tokensToSend.map((token) => ({
      to: token,
      title: body.notification.title,
      body: body.notification.body,
      data: body.notification.data,
      sound: body.notification.sound || "default",
      badge: body.notification.badge,
      channelId: body.notification.channelId || "default",
      priority: body.notification.priority || "high",
      ttl: body.notification.ttl,
    }));

    // Send to Expo
    console.log(`Sending ${messages.length} push notification(s)...`);
    const result = await sendToExpo(messages);

    // Process results and identify failed tokens
    const successCount = result.data.filter((t) => t.status === "ok").length;
    const failedTokens: string[] = [];

    result.data.forEach((ticket, index) => {
      if (ticket.status === "error") {
        console.error(`Push failed for token ${tokensToSend[index]}:`, ticket.message);

        // Check if token is invalid and should be deactivated
        if (
          ticket.details &&
          (ticket.message?.includes("DeviceNotRegistered") ||
            ticket.message?.includes("InvalidCredentials"))
        ) {
          failedTokens.push(tokensToSend[index]);
        }
      }
    });

    // Deactivate invalid tokens
    if (failedTokens.length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        await supabase
          .from("push_tokens")
          .update({ is_active: false })
          .in("token", failedTokens);

        console.log(`Deactivated ${failedTokens.length} invalid token(s)`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: result.data.length - successCount,
        total: result.data.length,
        tickets: result.data.map((t) => ({
          status: t.status,
          id: t.id,
          message: t.message,
        })),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending push notification:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to send push notification",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
