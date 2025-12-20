import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const APP_URL = Deno.env.get("BASE_URL") || "http://localhost:8080";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  shareId: string;
  noteId: string;
  noteTitle: string;
  inviteeEmail: string;
  inviterName: string;
  inviterEmail: string;
  permission: "view" | "edit";
  inviteToken: string;
}

/**
 * Send email using Resend API
 */
async function sendEmailViaResend(
  to: string,
  subject: string,
  htmlContent: string,
  textContent: string,
  replyTo?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY not configured");
    return { success: false, error: "Resend API key not configured" };
  }

  // Use custom domain if configured, otherwise use Resend's default onboarding domain
  const fromEmail = Deno.env.get("EMAIL_FROM") || "StudEse <onboarding@resend.dev>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: subject,
        html: htmlContent,
        text: textContent,
        ...(replyTo && { reply_to: replyTo }),
      }),
    });

    const result = await response.json();

    if (response.ok) {
      console.log("Email sent successfully via Resend:", result.id);
      return { success: true, messageId: result.id };
    } else {
      console.error("Resend API error:", result);
      return { success: false, error: result.message || "Failed to send email" };
    }
  } catch (error) {
    console.error("Resend fetch error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Network error" };
  }
}

/**
 * Create in-app notification for existing users
 */
async function createInAppNotification(
  supabase: ReturnType<typeof createClient>,
  inviteeEmail: string,
  noteId: string,
  noteTitle: string,
  inviterName: string,
  permission: string,
  shareId: string
): Promise<boolean> {
  try {
    // Check if user exists
    const { data: userData } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", inviteeEmail.toLowerCase())
      .single();

    if (userData) {
      // Create in-app notification for existing user
      const { error } = await supabase.from("notifications").insert({
        user_id: userData.id,
        type: "note_share",
        title: "Note shared with you",
        message: `${inviterName} shared "${noteTitle}" with you (${permission} access)`,
        data: {
          note_id: noteId,
          share_id: shareId,
          permission: permission,
        },
        is_read: false,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error("Failed to create notification:", error);
        return false;
      }

      console.log("In-app notification created for user:", userData.id);
      return true;
    }

    return false;
  } catch (error) {
    console.error("Notification error:", error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      shareId,
      noteId,
      noteTitle,
      inviteeEmail,
      inviterName,
      inviterEmail,
      permission,
      inviteToken,
    }: InviteRequest = await req.json();

    // Validate required fields
    if (!inviteeEmail || !noteTitle || !inviterEmail) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if invitee is already a user
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("email", inviteeEmail.toLowerCase())
      .single();

    const isExistingUser = !!existingUser;
    const displayName = inviterName || inviterEmail.split("@")[0];
    const permissionText = permission === "edit" ? "edit" : "view";

    // Build the access link
    const accessLink = isExistingUser
      ? `${APP_URL}/notes/${noteId}`
      : `${APP_URL}/login?invite=${inviteToken}&redirect=/notes/${noteId}`;

    // Create in-app notification for existing users
    let notificationCreated = false;
    if (isExistingUser) {
      notificationCreated = await createInAppNotification(
        supabase,
        inviteeEmail,
        noteId,
        noteTitle,
        displayName,
        permissionText,
        shareId
      );
    }

    // Build email content
    const emailSubject = `${displayName} shared "${noteTitle}" with you`;

    const emailText = `
Hi there!

${displayName} has shared a note with you on StudEse.

Note: ${noteTitle}
Permission: ${permissionText}

Click here to access the note:
${accessLink}

${!isExistingUser ? "You'll need to create a free account to view this note." : ""}

Best regards,
The StudEse Team
    `.trim();

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white; font-weight: bold; font-size: 18px; line-height: 48px;">SE</div>
      <h2 style="margin: 12px 0 0; color: #1a1a2e;">StudEse</h2>
    </div>

    <h3 style="margin: 0 0 16px; color: #1a1a2e; text-align: center;">
      📝 ${displayName} shared a note with you
    </h3>

    <div style="background: #f8fafc; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
      <p style="margin: 0 0 12px; font-size: 18px; font-weight: 600; color: #1a1a2e;">${noteTitle}</p>
      <span style="display: inline-block; padding: 6px 14px; background: ${permission === 'edit' ? '#dbeafe' : '#f0fdf4'}; color: ${permission === 'edit' ? '#2563eb' : '#16a34a'}; border-radius: 20px; font-size: 13px; font-weight: 500;">
        ${permission === 'edit' ? '✏️ Can Edit' : '👁️ View Only'}
      </span>
    </div>

    <div style="text-align: center;">
      <a href="${accessLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
        ${isExistingUser ? 'Open Note' : 'Accept Invite'}
      </a>
    </div>

    ${!isExistingUser ? '<p style="margin: 20px 0 0; text-align: center; color: #6b7280; font-size: 14px;">You\'ll need to create a free account to view this note.</p>' : ''}

    <hr style="margin: 28px 0; border: none; border-top: 1px solid #e5e7eb;">

    <p style="margin: 0; text-align: center; color: #9ca3af; font-size: 12px;">
      Sent by ${inviterEmail}
    </p>
    <p style="margin: 8px 0 0; text-align: center; color: #9ca3af; font-size: 12px;">
      If you didn't expect this email, you can safely ignore it.
    </p>
  </div>
</body>
</html>
    `.trim();

    // Send email via Resend
    const emailResult = await sendEmailViaResend(
      inviteeEmail,
      emailSubject,
      emailHtml,
      emailText,
      inviterEmail
    );

    // Update the share record with email status
    await supabase
      .from("note_shares")
      .update({
        invite_sent_at: new Date().toISOString(),
        email_sent: emailResult.success,
      })
      .eq("id", shareId);

    return new Response(
      JSON.stringify({
        success: true,
        emailSent: emailResult.success,
        emailMessageId: emailResult.messageId,
        emailError: emailResult.error,
        notificationCreated,
        message: emailResult.success
          ? `Invite email sent to ${inviteeEmail}`
          : `Invite created for ${inviteeEmail} (email failed: ${emailResult.error})`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending invite:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to send invite",
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
