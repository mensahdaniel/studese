// Supabase Edge Function: check-task-reminders
// Scheduled function that checks for due tasks and sends progressive push notifications
// Run this on a cron schedule (e.g., every minute for responsive overdue reminders)
//
// Progressive Reminder Schedule:
// - Stage 0: When task becomes due (0 minutes overdue)
// - Stage 1: 5 minutes overdue
// - Stage 2: 10 minutes overdue
// - Stage 3: 15 minutes overdue (final)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Reminder stages in minutes overdue
const REMINDER_STAGES = [0, 5, 10, 15] as const;
type ReminderStage = (typeof REMINDER_STAGES)[number];

// Messages for each reminder stage
const REMINDER_MESSAGES: Record<ReminderStage, { title: string }> = {
  0: { title: "Task Due Now!" },
  5: { title: "Task Overdue!" },
  10: { title: "Task Still Overdue!" },
  15: { title: "FINAL REMINDER!" },
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
}

interface ExistingNotification {
  data: {
    task_id?: string;
    reminder_stage?: number;
  } | null;
  created_at: string;
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

// Calculate which reminder stage a task should be at
function calculateReminderStage(overdueMinutes: number): ReminderStage | null {
  if (overdueMinutes < 0) return null;

  for (let i = REMINDER_STAGES.length - 1; i >= 0; i--) {
    if (overdueMinutes >= REMINDER_STAGES[i]) {
      return REMINDER_STAGES[i];
    }
  }

  return null;
}

// Build message for a reminder stage
function buildMessage(
  task: Task,
  stage: ReminderStage,
  overdueMinutes: number
): { title: string; body: string } {
  const config = REMINDER_MESSAGES[stage];
  const stageNumber = REMINDER_STAGES.indexOf(stage) + 1;
  const totalStages = REMINDER_STAGES.length;

  const title = config.title;
  let body: string;

  if (stage === 0) {
    body = `"${task.title}" is due now!`;
  } else {
    body = `"${task.title}" is ${overdueMinutes} minutes overdue! (Reminder ${stageNumber}/${totalStages})`;
  }

  return { title, body };
}

// Send notifications via Expo Push API
async function sendToExpo(
  messages: ExpoPushMessage[]
): Promise<{ success: number; failed: number }> {
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
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();

    // Fetch tasks that are:
    // - Not completed
    // - Due within the last 20 minutes (covers all stages + buffer)
    // - Or due within the next 1 minute (about to be due)
    const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);
    const oneMinuteFromNow = new Date(now.getTime() + 1 * 60 * 1000);

    console.log(
      `Checking for tasks due between ${twentyMinutesAgo.toISOString()} and ${oneMinuteFromNow.toISOString()}`
    );

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("id, user_id, title, description, due_date, priority, completed")
      .eq("completed", false)
      .gte("due_date", twentyMinutesAgo.toISOString())
      .lte("due_date", oneMinuteFromNow.toISOString());

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch tasks",
          details: tasksError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!tasks || tasks.length === 0) {
      console.log("No tasks due in the reminder window");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No tasks due",
          checked: 0,
          notified: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Found ${tasks.length} task(s) in reminder window`);

    // Fetch existing notifications for these tasks to determine which stages have been sent
    const taskIds = tasks.map((t) => t.id);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const { data: existingNotifications, error: notifError } = await supabase
      .from("notifications")
      .select("data, created_at")
      .eq("type", "task")
      .gte("created_at", oneHourAgo.toISOString());

    if (notifError) {
      console.error("Error checking existing notifications:", notifError);
    }

    // Build a map of task_id -> highest stage already notified
    const notifiedStages = new Map<string, number>();

    if (existingNotifications) {
      for (const notif of existingNotifications as ExistingNotification[]) {
        const taskId = notif.data?.task_id;
        const stage = notif.data?.reminder_stage ?? 0;

        if (taskId) {
          const currentMax = notifiedStages.get(taskId) ?? -1;
          if (stage > currentMax) {
            notifiedStages.set(taskId, stage);
          }
        }
      }
    }

    // Determine which tasks need which stage of notification
    const tasksToNotify: Array<{
      task: Task;
      stage: ReminderStage;
      overdueMinutes: number;
    }> = [];

    for (const task of tasks as Task[]) {
      const dueDate = new Date(task.due_date);
      const overdueMs = now.getTime() - dueDate.getTime();
      const overdueMinutes = Math.floor(overdueMs / 60000);

      // Calculate target stage
      const targetStage = calculateReminderStage(overdueMinutes);
      if (targetStage === null) continue;

      // Check if this stage has already been sent
      const lastSentStage = notifiedStages.get(task.id) ?? -1;

      if (targetStage > lastSentStage) {
        tasksToNotify.push({
          task,
          stage: targetStage,
          overdueMinutes,
        });
      }
    }

    if (tasksToNotify.length === 0) {
      console.log("All applicable reminders have already been sent");
      return new Response(
        JSON.stringify({
          success: true,
          message: "All tasks already notified at current stages",
          checked: tasks.length,
          notified: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`${tasksToNotify.length} reminder(s) to send`);

    // Get unique user IDs
    const userIds = [...new Set(tasksToNotify.map((t) => t.task.user_id))];

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
        tokensByUser.get(pt.user_id)!.push({
          token: pt.token,
          platform: pt.platform,
        });
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

    for (const { task, stage, overdueMinutes } of tasksToNotify) {
      const { title, body } = buildMessage(task, stage, overdueMinutes);
      const stageIndex = REMINDER_STAGES.indexOf(stage);

      const notificationData = {
        task_id: task.id,
        route: "/tasks",
        type: "task_reminder",
        priority: task.priority,
        reminder_stage: stage,
        is_overdue: stage > 0,
        is_final_reminder: stageIndex === REMINDER_STAGES.length - 1,
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
          // Higher priority for later stages
          const pushPriority =
            stage >= 10 ? "high" : task.priority === "high" ? "high" : "default";

          pushMessages.push({
            to: pt.token,
            title: title,
            body: body,
            data: notificationData,
            sound: "default",
            channelId: "default",
            priority: pushPriority,
          });
        }
      }

      console.log(
        `[Stage ${stageIndex + 1}/${REMINDER_STAGES.length}] Task: ${task.title} | ${overdueMinutes} min overdue`
      );
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
      console.log(
        `Push results: ${pushResult.success} success, ${pushResult.failed} failed`
      );
    } else {
      console.log("No push tokens found for affected users");
    }

    // Summary by stage
    const stageSummary: Record<number, number> = {};
    for (const { stage } of tasksToNotify) {
      stageSummary[stage] = (stageSummary[stage] || 0) + 1;
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: tasks.length,
        notified: tasksToNotify.length,
        stageSummary: stageSummary,
        inAppCreated: inAppNotifications.length,
        pushSent: pushResult.success,
        pushFailed: pushResult.failed,
        timestamp: now.toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in check-task-reminders:", error);

    return new Response(
      JSON.stringify({
        error: "Failed to check task reminders",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
