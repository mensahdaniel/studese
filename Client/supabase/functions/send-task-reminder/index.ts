import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Required environment variables are not set');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get tasks due in next 24 hours
    const twentyFourHoursFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .lte('due_date', twentyFourHoursFromNow)
      .gte('due_date', now);

    if (tasksError) throw tasksError;

    let emailsSent = 0;
    const debugInfo = [];

    for (const task of tasks || []) {
      try {
        // Get user info using admin API
        const { data: user, error: userError } = await supabase.auth.admin.getUserById(task.user_id);
        
        if (userError || !user.user) {
          debugInfo.push({ taskId: task.id, error: 'User not found', userError });
          continue;
        }

        const userEmail = user.user.email;
        const userName = user.user.user_metadata?.full_name || 'Student';
        
        if (!userEmail) {
          debugInfo.push({ taskId: task.id, error: 'No user email' });
          continue;
        }

        // Send reminder email
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'onboarding@resend.dev',
            to: [userEmail],
            subject: `⏰ TEST Reminder: "${task.title}" is due soon!`,
            html: `
              <h1>Task Due Soon! ⏰</h1>
              <p>Hi ${userName},</p>
              <p>This is a reminder that you have a task due in the next 24 hours:</p>
              <div style="background: #f3f4f6; padding: 15px; border-left: 4px solid #DC2626; margin: 15px 0;">
                <h3>${task.title}</h3>
                <p>${task.description || 'No description provided'}</p>
                <p><strong>Due:</strong> ${new Date(task.due_date).toLocaleString()}</p>
              </div>
              <p>Best regards,<br>The Studese Team</p>
            `
          }),
        });

        if (emailResponse.ok) {
          emailsSent++;
          debugInfo.push({ taskId: task.id, status: 'Email sent', to: userEmail });
        } else {
          const errorText = await emailResponse.text();
          debugInfo.push({ taskId: task.id, status: 'Email failed', error: errorText });
        }
      } catch (taskError) {
        debugInfo.push({ taskId: task.id, error: taskError.message });
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: `Processed ${tasks?.length || 0} tasks, sent ${emailsSent} emails`,
      debug: debugInfo,
      details: {
        tasksFound: tasks?.length || 0,
        emailsSent: emailsSent
      }
    }));
    
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message 
    }), { status: 500 });
  }
});
