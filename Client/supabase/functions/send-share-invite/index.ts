import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") || "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";
const APP_URL = Deno.env.get("APP_URL") || "https://studese.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
 * Generate professional HTML email template
 */
function generateEmailHtml(params: {
  displayName: string;
  noteTitle: string;
  permission: "view" | "edit";
  accessLink: string;
  inviterEmail: string;
  isExistingUser: boolean;
}): string {
  const {
    displayName,
    noteTitle,
    permission,
    accessLink,
    inviterEmail,
    isExistingUser,
  } = params;

  const permissionLabel = permission === "edit" ? "Can Edit" : "View Only";
  const permissionDescription =
    permission === "edit"
      ? "You can view, edit, and make changes to this note."
      : "You can view this note in read-only mode.";
  const buttonText = isExistingUser ? "Open Note" : "Accept Invitation";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Note Shared With You</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">

  <!-- Preheader text (hidden) -->
  <div style="display: none; max-height: 0; overflow: hidden;">
    ${displayName} has shared "${noteTitle}" with you on StudEse. Click to access your shared note.
  </div>

  <!-- Email wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">

        <!-- Main container -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 40px; text-align: center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="width: 44px; height: 44px; background-color: rgba(255, 255, 255, 0.2); border-radius: 10px; text-align: center; vertical-align: middle;">
                    <span style="color: #ffffff; font-size: 18px; font-weight: 700; line-height: 44px;">S</span>
                  </td>
                  <td style="padding-left: 12px;">
                    <span style="color: #ffffff; font-size: 22px; font-weight: 600; letter-spacing: -0.5px;">StudEse</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px;">

              <!-- Greeting -->
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #52525b;">
                Hello,
              </p>

              <!-- Main message -->
              <p style="margin: 0 0 32px 0; font-size: 15px; line-height: 1.6; color: #52525b;">
                <strong style="color: #18181b;">${displayName}</strong> has invited you to collaborate on a note in StudEse.
              </p>

              <!-- Note card -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 12px; margin-bottom: 32px;">
                <tr>
                  <td style="padding: 24px;">

                    <!-- Note icon and title -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <div style="width: 40px; height: 40px; background-color: #ede9fe; border-radius: 8px; text-align: center; line-height: 40px;">
                            <span style="color: #7c3aed; font-size: 18px;">&#9998;</span>
                          </div>
                        </td>
                        <td style="padding-left: 16px; vertical-align: top;">
                          <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #a1a1aa;">
                            Shared Note
                          </p>
                          <p style="margin: 0; font-size: 17px; font-weight: 600; color: #18181b; line-height: 1.4;">
                            ${noteTitle}
                          </p>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <div style="height: 1px; background-color: #e4e4e7; margin: 20px 0;"></div>

                    <!-- Permission info -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                      <tr>
                        <td>
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="background-color: ${permission === "edit" ? "#dbeafe" : "#f0fdf4"}; padding: 6px 12px; border-radius: 6px;">
                                <span style="font-size: 13px; font-weight: 500; color: ${permission === "edit" ? "#1d4ed8" : "#15803d"};">
                                  ${permissionLabel}
                                </span>
                              </td>
                            </tr>
                          </table>
                          <p style="margin: 12px 0 0 0; font-size: 13px; line-height: 1.5; color: #71717a;">
                            ${permissionDescription}
                          </p>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td style="text-align: center;">
                    <a href="${accessLink}" target="_blank" style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 14px 0 rgba(79, 70, 229, 0.4);">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>

              ${!isExistingUser
      ? `
              <!-- New user notice -->
              <p style="margin: 24px 0 0 0; padding: 16px; background-color: #fefce8; border: 1px solid #fef08a; border-radius: 8px; font-size: 13px; line-height: 1.5; color: #854d0e; text-align: center;">
                You'll need to create a free StudEse account to access this note. It only takes a moment.
              </p>
              `
      : ""
    }

              <!-- Alternative link -->
              <p style="margin: 32px 0 0 0; font-size: 12px; line-height: 1.5; color: #a1a1aa; text-align: center;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${accessLink}" style="color: #7c3aed; word-break: break-all;">${accessLink}</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #fafafa; border-top: 1px solid #e4e4e7;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #71717a;">
                      Shared by <strong>${displayName}</strong> (${inviterEmail})
                    </p>
                    <p style="margin: 0; font-size: 11px; color: #a1a1aa;">
                      This email was sent by StudEse. If you didn't expect this invitation, you can safely ignore it.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!-- Footer branding -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="max-width: 520px; margin: 24px auto 0 auto;">
          <tr>
            <td style="text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #a1a1aa;">
                StudEse &mdash; Your Study Companion
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>
  `.trim();
}

/**
 * Generate plain text email version
 */
function generateEmailText(params: {
  displayName: string;
  noteTitle: string;
  permission: "view" | "edit";
  accessLink: string;
  inviterEmail: string;
  isExistingUser: boolean;
}): string {
  const { displayName, noteTitle, permission, accessLink, inviterEmail, isExistingUser } = params;

  const permissionLabel = permission === "edit" ? "Can Edit" : "View Only";
  const permissionDescription =
    permission === "edit"
      ? "You can view, edit, and make changes to this note."
      : "You can view this note in read-only mode.";

  return `
STUDESE - NOTE SHARED WITH YOU
============================================================

Hello,

${displayName} has invited you to collaborate on a note in StudEse.


NOTE DETAILS
------------------------------------------------------------
Title: ${noteTitle}
Permission: ${permissionLabel}
${permissionDescription}

Shared by: ${displayName} (${inviterEmail})
------------------------------------------------------------


ACCESS YOUR NOTE
------------------------------------------------------------
Click the link below to open the shared note:

${accessLink}
------------------------------------------------------------

${!isExistingUser ? `
NOTE: You'll need to create a free StudEse account to access this note. It only takes a moment.
` : ""}

------------------------------------------------------------
This email was sent by StudEse.
If you didn't expect this invitation, you can safely ignore it.

StudEse - Your Study Companion
  `.trim();
}

/**
 * Send email using SendGrid API
 */
async function sendEmailViaSendGrid(
  to: string,
  subject: string,
  htmlContent: string,
  textContent: string,
  replyTo?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!SENDGRID_API_KEY) {
    console.error("SENDGRID_API_KEY not configured");
    return { success: false, error: "SendGrid API key not configured" };
  }

  // Use custom from email if configured
  const fromEmail = Deno.env.get("EMAIL_FROM") || "noreply@studese.com";
  const fromName = Deno.env.get("EMAIL_FROM_NAME") || "StudEse";

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: to }],
            subject: subject,
          },
        ],
        from: {
          email: fromEmail,
          name: fromName,
        },
        ...(replyTo && {
          reply_to: {
            email: replyTo,
          },
        }),
        content: [
          {
            type: "text/plain",
            value: textContent,
          },
          {
            type: "text/html",
            value: htmlContent,
          },
        ],
      }),
    });

    if (response.ok || response.status === 202) {
      const messageId = response.headers.get("X-Message-Id") || "sent";
      console.log("Email sent successfully via SendGrid:", messageId);
      return { success: true, messageId };
    } else {
      const errorText = await response.text();
      console.error("SendGrid API error:", response.status, errorText);
      return {
        success: false,
        error: `SendGrid error: ${response.status} - ${errorText}`,
      };
    }
  } catch (error) {
    console.error("SendGrid fetch error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
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
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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
    const emailSubject = `${displayName} shared a note with you: "${noteTitle}"`;

    const emailParams = {
      displayName,
      noteTitle,
      permission,
      accessLink,
      inviterEmail,
      isExistingUser,
    };

    const emailHtml = generateEmailHtml(emailParams);
    const emailText = generateEmailText(emailParams);

    // Send email via SendGrid
    const emailResult = await sendEmailViaSendGrid(
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
