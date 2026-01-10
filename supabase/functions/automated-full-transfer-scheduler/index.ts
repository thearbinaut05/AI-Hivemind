import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    // Handle CORS preflight requests
    return new Response(null, { headers: corsHeaders });
  }

  const executionId = `scheduler_${Date.now()}`;
  console.log(`[${executionId}] Starting automated full transfer scheduler...`);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    {
      auth: { persistSession: false },
    }
  );

  try {
    // Parse schedule_type from JSON body; default to 'manual'
    const { schedule_type = "manual" } = (await req.json().catch(() => ({}))) as {
      schedule_type?: string;
    };

    // Check if the transfer should run based on schedule and last run time
    const shouldRun = await shouldRunTransfer(supabase, schedule_type, executionId);

    if (!shouldRun.run) {
      return new Response(
        JSON.stringify({
          success: false,
          message: shouldRun.reason,
          next_run: shouldRun.next_run,
          execution_id: executionId,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Invoke the comprehensive USD aggregator function
    console.log(`[${executionId}] Triggering comprehensive USD aggregator...`);

    const transferResponse = await supabase.functions.invoke("comprehensive-usd-aggregator", {
      body: JSON.stringify({ triggered_by: "scheduler", execution_id: executionId }),
    });

    if (transferResponse.error) {
      throw new Error(transferResponse.error.message);
    }

    // Log successful transfer completion
    await updateSchedulerState(supabase, executionId, transferResponse.data);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Automated transfer completed successfully",
        transfer_result: transferResponse.data,
        execution_id: executionId,
        next_scheduled_run: getNextScheduledRun(schedule_type),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[${executionId}] Scheduler error:`, err);

    // Log the failure event to automated_transfer_logs
    try {
      await supabase.from("automated_transfer_logs").insert({
        job_name: "automated_full_transfer_scheduler",
        status: "failed",
        error_message: err.message,
        execution_time: new Date().toISOString(),
        response: { execution_id: executionId, error: err.message },
      });
    } catch (logError) {
      console.error(`[${executionId}] Failed to log error:`, logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
        execution_id: executionId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

/**
 * Determines whether the automated transfer should run based on the schedule type
 * and last successful execution.
 *
 * @param supabase - Supabase client instance
 * @param scheduleType - Schedule type ('manual', 'hourly', 'daily', 'weekly')
 * @param executionId - Unique ID for the current execution (for logging)
 * @returns Object with `run` (boolean), `reason` (string), and optional `next_run` timestamp
 */
async function shouldRunTransfer(
  supabase: ReturnType<typeof createClient>,
  scheduleType: string,
  executionId: string
): Promise<{ run: boolean; reason: string; next_run?: string | null }> {
  console.log(`[${executionId}] Checking if transfer should run (${scheduleType})...`);

  // Always run if manually triggered
  if (scheduleType === "manual") {
    return { run: true, reason: "Manual trigger" };
  }

  // Fetch the last successful run record
  const { data: lastRun, error } = await supabase
    .from("automated_transfer_logs")
    .select("*")
    .eq("job_name", "automated_full_transfer_scheduler")
    .eq("status", "completed")
    .order("execution_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(`[${executionId}] Error fetching last run:`, error);
    // To prevent blocking, allow the transfer to run in case of DB errors
    return { run: true, reason: "Error checking last run, proceeding with run" };
  }

  const now = new Date();
  const lastRunTime = lastRun ? new Date(lastRun.execution_time) : null;

  // Determine next runnable time based on schedule
  const scheduleDurationsMs: Record<string, number> = {
    hourly: 60 * 60 * 1000,
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
  };

  if (!(scheduleType in scheduleDurationsMs)) {
    return { run: false, reason: `Unknown schedule type: ${scheduleType}`, next_run: null };
  }

  const requiredInterval = scheduleDurationsMs[scheduleType];

  if (lastRunTime && now.getTime() - lastRunTime.getTime() < requiredInterval) {
    const nextRun = new Date(lastRunTime.getTime() + requiredInterval).toISOString();
    return {
      run: false,
      reason: `Last run was less than ${scheduleType === "hourly" ? "1 hour" : scheduleType === "daily" ? "24 hours" : "7 days"
        } ago`,
      next_run: nextRun,
    };
  }

  return { run: true, reason: `Scheduled ${scheduleType} transfer ready` };
}

/**
 * Records a successful transfer completion in the automated_transfer_logs table.
 *
 * @param supabase - Supabase client instance
 * @param executionId - Unique execution identifier
 * @param transferResult - Result data from the transfer function
 */
async function updateSchedulerState(
  supabase: ReturnType<typeof createClient>,
  executionId: string,
  transferResult: any
) {
  await supabase.from("automated_transfer_logs").insert({
    job_name: "automated_full_transfer_scheduler",
    status: "completed",
    execution_time: new Date().toISOString(),
    response: {
      execution_id: executionId,
      transfer_triggered: true,
      transfer_result: transferResult,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Returns ISO string for the next scheduled run time based on schedule type.
 *
 * @param scheduleType - Schedule type ('hourly', 'daily', 'weekly', or 'manual')
 * @returns ISO string of next run timestamp or null if unknown schedule type
 */
function getNextScheduledRun(scheduleType: string): string | null {
  const now = new Date();
  switch (scheduleType) {
    case "hourly":
      return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    case "daily":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    case "weekly":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return null;
  }
}