import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const executionId = `fix_${Date.now()}`;

  try {
    console.log(`[${executionId}] 🔧 Starting failed transfer fix workflow...`);

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
      typescript: true,
    });

    // Get failed transfers that need fixing
    const { data: failedTransfers, error: fetchError } = await supabaseClient
      .from("transfer_attempts")
      .select("*")
      .eq("status", "failed")
      .lt("retry_count", 3)
      .gte(
        "created_at",
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      )
      .order("amount", { ascending: false });

    if (fetchError) {
      throw new Error(`Error fetching failed transfers: ${fetchError.message}`);
    }

    if (!failedTransfers || failedTransfers.length === 0) {
      console.log(`[${executionId}] No failed transfers found to fix`);
      return new Response(
        JSON.stringify({
          success: true,
          message: "No failed transfers found that need fixing",
          processed: 0,
          fixed: 0,
          failed: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    console.log(
      `[${executionId}] Found ${failedTransfers.length} failed transfers to fix`,
    );

    let fixed = 0;
    let stillFailed = 0;
    const results: Array<{
      transfer_id: string;
      amount: number;
      status: string;
      new_payout_id?: string;
      error?: string;
    }> = [];

    for (const transfer of failedTransfers) {
      const transferId = transfer.id;
      const amount = transfer.amount;
      const amountUsd = amount / 100; // Convert from cents to dollars
      const metadataExisting = transfer.metadata ?? {};

      console.log(
        `[${executionId}] Attempting to fix transfer ${transferId} for $${amountUsd.toFixed(
          2,
        )}`,
      );

      try {
        // Retry the payout with original parameters
        const payout = await stripe.payouts.create({
          amount: amount,
          currency: transfer.currency || "usd",
          method: "standard",
          description: `Fixed transfer: ${transfer.description || `$${amountUsd.toFixed(
            2,
          )} transfer`}`,
          metadata: {
            ...metadataExisting,
            original_transfer_id: transferId,
            fix_execution_id: executionId,
            fix_attempt: ((transfer.retry_count ?? 0) + 1).toString(),
            amount_usd: amountUsd.toString(),
            timestamp: new Date().toISOString(),
            fix_workflow: "automated",
          },
        });

        console.log(
          `[${executionId}] ✅ Fixed transfer ${transferId} - New payout: ${payout.id}`,
        );

        // Update the transfer as corrected
        await supabaseClient
          .from("transfer_attempts")
          .update({
            status: "corrected",
            corrected_transfer_id: payout.id,
            corrected_at: new Date().toISOString(),
            metadata: {
              ...metadataExisting,
              corrected_payout_id: payout.id,
              corrected_at: new Date().toISOString(),
              fix_execution_id: executionId,
              arrival_date: payout.arrival_date
                ? new Date(payout.arrival_date * 1000).toISOString()
                : undefined,
            },
          })
          .eq("id", transferId);

        fixed++;
        results.push({
          transfer_id: transferId,
          amount: amountUsd,
          status: "fixed",
          new_payout_id: payout.id,
        });
      } catch (stripeError: unknown) {
        const errorMessage =
          stripeError instanceof Error
            ? stripeError.message
            : "Unknown error while fixing transfer";

        console.error(
          `[${executionId}] ❌ Failed to fix transfer ${transferId}:`,
          errorMessage,
        );

        // Update retry count and error info
        await supabaseClient
          .from("transfer_attempts")
          .update({
            retry_count: (transfer.retry_count ?? 0) + 1,
            correction_error: errorMessage,
            metadata: {
              ...metadataExisting,
              last_fix_attempt: new Date().toISOString(),
              fix_execution_id: executionId,
              fix_error: errorMessage,
            },
          })
          .eq("id", transferId);

        stillFailed++;
        results.push({
          transfer_id: transferId,
          amount: amountUsd,
          status: "still_failed",
          error: errorMessage,
        });
      }
    }

    // Log the workflow execution
    await supabaseClient.from("workflow_runs").insert({
      workflow_type: "fix_failed_transfers",
      total_processed: failedTransfers.length,
      successful_fixes: fixed,
      failed_fixes: stillFailed,
      success_rate:
        failedTransfers.length > 0 ? (fixed / failedTransfers.length) * 100 : 0,
      total_amount_recovered: results
        .filter((r) => r.status === "fixed")
        .reduce((sum, r) => sum + r.amount * 100, 0),
      execution_time_ms: Date.now() - parseInt(executionId.split("_")[1], 10),
      completed_at: new Date().toISOString(),
      metadata: {
        execution_id: executionId,
        results: results,
      },
    });

    console.log(
      `[${executionId}] 🎉 Fix workflow completed: ${fixed} fixed, ${stillFailed} still failed`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Fixed ${fixed} out of ${failedTransfers.length} failed transfers`,
        processed: failedTransfers.length,
        fixed: fixed,
        still_failed: stillFailed,
        success_rate:
          failedTransfers.length > 0
            ? ((fixed / failedTransfers.length) * 100).toFixed(1)
            : "0",
        results: results,
        execution_id: executionId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[${executionId}] 💥 Fix workflow failed:`, err);

    // Attempt to log the error (don't throw if this fails)
    try {
      await supabaseClient.from("workflow_runs").insert({
        workflow_type: "fix_failed_transfers",
        total_processed: 0,
        successful_fixes: 0,
        failed_fixes: 0,
        execution_time_ms: Date.now() - parseInt(executionId.split("_")[1], 10),
        completed_at: new Date().toISOString(),
        error_message: err.message,
        metadata: {
          execution_id: executionId,
          error_type: err.name,
        },
      });
    } catch (logError) {
      console.error(
        `[${executionId}] ❌ Failed to log error in workflow_runs:`,
        logError,
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
        execution_id: executionId,
        message: "Failed transfer fix workflow encountered an error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});