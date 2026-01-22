import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const startTime = Date.now();
  const executionId = `exec_${startTime}`;

  try {
    console.log(`[${executionId}] 🏦 AUTONOMOUS BALANCE TRANSFER - Starting execution...`);
    
    // =================== STEP 1: RETRIEVE APPLICATION BALANCE ===================
    console.log(`[${executionId}] 📊 Step 1: Retrieving internal application balance...`);
    
    const { data: appBalance, error: balanceError } = await supabaseClient
      .from('application_balance')
      .select('*')
      .single();

    if (balanceError) {
      throw new Error(`Database error retrieving balance: ${balanceError.message}`);
    }

    const balanceAmount = Number(appBalance?.balance_amount || 0);
    console.log(`[${executionId}] 💰 Internal application balance found: $${balanceAmount.toFixed(2)} USD`);

    // =================== STEP 2: VALIDATE BALANCE ===================
    console.log(`[${executionId}] ✅ Step 2: Validating available balance in USD...`);
    
    if (balanceAmount <= 0) {
      const summary = {
        execution_id: executionId,
        status: "INSUFFICIENT_FUNDS",
        balance_before: balanceAmount,
        amount_charged: 0,
        remaining_balance: balanceAmount,
        timestamp: new Date().toISOString(),
        execution_time_ms: Date.now() - startTime
      };

      console.log(`[${executionId}] ⚠️ Insufficient funds: $${balanceAmount.toFixed(2)} - Terminating execution`);
      console.log(`[${executionId}] 📊 SUMMARY:`, summary);

      return new Response(JSON.stringify({
        success: false,
        error: "INSUFFICIENT_FUNDS",
        message: `Application balance of $${balanceAmount.toFixed(2)} is insufficient for transfer`,
        summary
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // =================== STEP 3: CREATE STRIPE CHARGE ===================
    console.log(`[${executionId}] 🚀 Step 3: Creating Stripe payout for $${balanceAmount.toFixed(2)} USD...`);
    
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured in environment");
    }

    const stripe = new Stripe(stripeKey, { 
      apiVersion: "2023-10-16",
      typescript: true 
    });

    const amountInCents = Math.round(balanceAmount * 100);
    const idempotencyKey = `balance_transfer_${executionId}_${amountInCents}`;

    let payout;
    try {
      payout = await stripe.payouts.create({
        amount: amountInCents,
        currency: 'usd',
        method: 'standard',
        description: `Autonomous Application Balance Transfer - $${balanceAmount.toFixed(2)}`,
        metadata: {
          execution_id: executionId,
          source: 'application_balance',
          amount_usd: balanceAmount.toString(),
          timestamp: new Date().toISOString(),
          automation_type: 'AUTONOMOUS',
          validation_passed: 'true'
        }
      }, {
        idempotencyKey
      });

      console.log(`[${executionId}] ✅ Stripe payout created successfully: ${payout.id}`);
    } catch (stripeError: any) {
      console.error(`[${executionId}] ❌ Stripe payout failed:`, stripeError);
      
      // Retry logic for transient errors
      if (stripeError.type === 'api_connection_error' || stripeError.type === 'api_error') {
        console.log(`[${executionId}] 🔄 Retrying Stripe payout due to transient error...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        
        try {
          payout = await stripe.payouts.create({
            amount: amountInCents,
            currency: 'usd',
            method: 'standard',
            description: `Autonomous Application Balance Transfer (Retry) - $${balanceAmount.toFixed(2)}`,
            metadata: {
              execution_id: executionId,
              source: 'application_balance',
              amount_usd: balanceAmount.toString(),
              timestamp: new Date().toISOString(),
              automation_type: 'AUTONOMOUS',
              validation_passed: 'true',
              retry_attempt: '1'
            }
          });
          
          console.log(`[${executionId}] ✅ Stripe payout created successfully on retry: ${payout.id}`);
        } catch (retryError: any) {
          throw new Error(`Stripe API failure after retry: ${retryError.message}`);
        }
      } else {
        throw new Error(`Stripe API error: ${stripeError.message}`);
      }
    }

    // =================== STEP 4: UPDATE APPLICATION BALANCE ===================
    console.log(`[${executionId}] 🔄 Step 4: Updating internal application balance...`);
    
    const { error: updateError } = await supabaseClient
      .from('application_balance')
      .update({ 
        balance_amount: 0,
        pending_transfers: 0,
        last_updated_at: new Date().toISOString()
      })
      .eq('id', appBalance.id);

    if (updateError) {
      console.error(`[${executionId}] ❌ Failed to update application balance:`, updateError);
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    console.log(`[${executionId}] ✅ Application balance updated: $${balanceAmount.toFixed(2)} → $0.00`);

    // =================== STEP 5: LOG TRANSACTION ===================
    console.log(`[${executionId}] 📝 Step 5: Logging transaction with timestamps...`);
    
    const { error: logError } = await supabaseClient
      .from('automated_transfer_logs')
      .insert({
        job_name: 'autonomous_balance_transfer',
        status: 'completed',
        execution_time: new Date().toISOString(),
        response: {
          execution_id: executionId,
          stripe_payout_id: payout.id,
          amount_transferred: balanceAmount,
          amount_cents: amountInCents,
          currency: 'usd',
          balance_before: balanceAmount,
          balance_after: 0,
          arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
          payout_method: payout.method,
          execution_time_ms: Date.now() - startTime,
          validation_passed: true,
          retry_attempts: payout.metadata?.retry_attempt ? 1 : 0
        }
      });

    if (logError) {
      console.error(`[${executionId}] ⚠️ Failed to log transaction:`, logError);
    } else {
      console.log(`[${executionId}] ✅ Transaction logged successfully`);
    }

    // =================== EXECUTION SUMMARY ===================
    const executionTimeMs = Date.now() - startTime;
    const summary = {
      execution_id: executionId,
      status: "SUCCESS",
      balance_before: balanceAmount,
      amount_charged: balanceAmount,
      remaining_balance: 0,
      stripe_payout_id: payout.id,
      arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
      timestamp: new Date().toISOString(),
      execution_time_ms: executionTimeMs
    };

    console.log(`[${executionId}] 🎉 AUTONOMOUS TRANSFER COMPLETED SUCCESSFULLY!`);
    console.log(`[${executionId}] 📊 SUMMARY REPORT:`, summary);
    console.log(`[${executionId}] ⏱️ Total execution time: ${executionTimeMs}ms`);

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully transferred $${balanceAmount.toFixed(2)} from application balance to Stripe`,
      summary,
      payout_details: {
        id: payout.id,
        amount: balanceAmount,
        amount_cents: amountInCents,
        currency: 'usd',
        method: payout.method,
        arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
        description: payout.description
      },
      consistency_maintained: true,
      automation_complete: true
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    const executionTimeMs = Date.now() - startTime;
    
    console.error(`[${executionId}] 💥 EXECUTION FAILED:`, error);
    console.error(`[${executionId}] ⏱️ Failed after: ${executionTimeMs}ms`);

    // Log error
    await supabaseClient
      .from('automated_transfer_logs')
      .insert({
        job_name: 'autonomous_balance_transfer',
        status: 'failed',
        execution_time: new Date().toISOString(),
        error_message: error.message,
        response: {
          execution_id: executionId,
          error_type: error.name || 'UnknownError',
          error_message: error.message,
          execution_time_ms: executionTimeMs,
          timestamp: new Date().toISOString()
        }
      });

    const errorSummary = {
      execution_id: executionId,
      status: "ERROR",
      error_type: error.name || 'UnknownError',
      error_message: error.message,
      timestamp: new Date().toISOString(),
      execution_time_ms: executionTimeMs
    };

    console.log(`[${executionId}] 📊 ERROR SUMMARY:`, errorSummary);

    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      error_type: error.name || 'UnknownError',
      summary: errorSummary,
      troubleshooting: {
        check_stripe_config: "Verify STRIPE_SECRET_KEY is properly configured",
        check_stripe_account: "Ensure Stripe account has bank details configured",
        check_balance: "Verify application balance exists and is > 0",
        check_connectivity: "Ensure Stripe API connectivity"
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});