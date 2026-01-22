
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const executionId = `scheduler_${Date.now()}`;
  console.log(`[${executionId}] Starting automated full transfer scheduler...`);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const { schedule_type = 'manual' } = await req.json().catch(() => ({}));

    // Check if we should run the transfer
    const shouldRun = await shouldRunTransfer(supabase, schedule_type, executionId);
    
    if (!shouldRun.run) {
      return new Response(JSON.stringify({
        success: false,
        message: shouldRun.reason,
        next_run: shouldRun.next_run,
        execution_id: executionId
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    }

    // Execute comprehensive transfer
    console.log(`[${executionId}] Triggering comprehensive USD aggregator...`);
    
    const transferResponse = await supabase.functions.invoke('comprehensive-usd-aggregator', {
      body: { triggered_by: 'scheduler', execution_id: executionId }
    });

    if (transferResponse.error) {
      throw new Error(transferResponse.error.message);
    }

    // Update scheduler state
    await updateSchedulerState(supabase, executionId, transferResponse.data);

    return new Response(JSON.stringify({
      success: true,
      message: 'Automated transfer completed successfully',
      transfer_result: transferResponse.data,
      execution_id: executionId,
      next_scheduled_run: getNextScheduledRun(schedule_type)
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (error: any) {
    console.error(`[${executionId}] Scheduler error:`, error);
    
    await supabase.from('automated_transfer_logs').insert({
      job_name: 'automated_full_transfer_scheduler',
      status: 'failed',
      error_message: error.message,
      execution_time: new Date().toISOString(),
      response: { execution_id: executionId, error: error.message }
    });

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      execution_id: executionId
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});

async function shouldRunTransfer(supabase: any, scheduleType: string, executionId: string) {
  console.log(`[${executionId}] Checking if transfer should run (${scheduleType})...`);

  // Manual triggers always run
  if (scheduleType === 'manual') {
    return { run: true, reason: 'Manual trigger' };
  }

  // Check last run time
  const { data: lastRun } = await supabase
    .from('automated_transfer_logs')
    .select('*')
    .eq('job_name', 'comprehensive_usd_aggregator')
    .eq('status', 'completed')
    .order('execution_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date();
  const lastRunTime = lastRun ? new Date(lastRun.execution_time) : null;

  switch (scheduleType) {
    case 'hourly':
      if (lastRunTime && (now.getTime() - lastRunTime.getTime()) < 60 * 60 * 1000) {
        return { 
          run: false, 
          reason: 'Last run was less than 1 hour ago',
          next_run: new Date(lastRunTime.getTime() + 60 * 60 * 1000)
        };
      }
      break;

    case 'daily':
      if (lastRunTime && (now.getTime() - lastRunTime.getTime()) < 24 * 60 * 60 * 1000) {
        return { 
          run: false, 
          reason: 'Last run was less than 24 hours ago',
          next_run: new Date(lastRunTime.getTime() + 24 * 60 * 60 * 1000)
        };
      }
      break;

    case 'weekly':
      if (lastRunTime && (now.getTime() - lastRunTime.getTime()) < 7 * 24 * 60 * 60 * 1000) {
        return { 
          run: false, 
          reason: 'Last run was less than 7 days ago',
          next_run: new Date(lastRunTime.getTime() + 7 * 24 * 60 * 60 * 1000)
        };
      }
      break;
  }

  return { run: true, reason: `Scheduled ${scheduleType} transfer ready` };
}

async function updateSchedulerState(supabase: any, executionId: string, transferResult: any) {
  await supabase.from('automated_transfer_logs').insert({
    job_name: 'automated_full_transfer_scheduler',
    status: 'completed',
    execution_time: new Date().toISOString(),
    response: {
      execution_id: executionId,
      transfer_triggered: true,
      transfer_result: transferResult,
      timestamp: new Date().toISOString()
    }
  });
}

function getNextScheduledRun(scheduleType: string) {
  const now = new Date();
  switch (scheduleType) {
    case 'hourly':
      return new Date(now.getTime() + 60 * 60 * 1000);
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}
