import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

// Stripe API limits and requirements
const STRIPE_LIMITS = {
  MIN_TRANSFER_AMOUNT: 50, // $0.50 in cents (Stripe minimum)
  MAX_TRANSFER_AMOUNT: 100000000, // $1,000,000 in cents (reasonable max)
  DESTINATION_ACCOUNT: 'acct_1RGs3rD6CDwEP7C7'
};

// Exponential backoff delay
const getRetryDelay = (attempt: number) => INITIAL_RETRY_DELAY * Math.pow(2, attempt);

// Sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Validate transfer amount against Stripe requirements
const validateTransferAmount = (amountCents: number) => {
  if (amountCents < STRIPE_LIMITS.MIN_TRANSFER_AMOUNT) {
    return { valid: false, error: `Transfer amount $${(amountCents / 100).toFixed(2)} is below Stripe minimum of $0.50` };
  }
  if (amountCents > STRIPE_LIMITS.MAX_TRANSFER_AMOUNT) {
    return { valid: false, error: `Transfer amount $${(amountCents / 100).toFixed(2)} exceeds maximum of $1,000,000` };
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { valid: false, error: `Invalid transfer amount: ${amountCents} cents` };
  }
  return { valid: true };
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

  const executionId = `transfer_${Date.now()}`;

  try {
    console.log(`[${executionId}] 🏦 Starting completed revenue to bank transfer process...`);
    
    // 1. Validate Stripe configuration
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("STRIPE_SECRET_KEY not found in environment");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "STRIPE_SECRET_KEY not configured",
        message: "Please configure your Stripe secret key in Supabase Edge Function secrets",
        setup_required: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const stripe = new Stripe(stripeKey, { 
      apiVersion: "2023-10-16",
      typescript: true 
    });

    // 2. Get completed revenue balance (DO NOT deduct yet)
    const { data: revenueData, error: revenueError } = await supabaseClient
      .from('completed_revenue')
      .select('total_amount')
      .single();

    if (revenueError) {
      console.error(`[${executionId}] Error getting completed revenue:`, revenueError);
      throw new Error(`Database error: ${revenueError.message}`);
    }

    const totalRevenueAmount = Number(revenueData?.total_amount || 0);
    console.log(`[${executionId}] 💰 Total completed revenue: $${totalRevenueAmount.toFixed(2)} (NOT deducted yet)`);

    // 3. Convert to cents and validate amount
    const amountInCents = Math.round(totalRevenueAmount * 100);
    
    const validation = validateTransferAmount(amountInCents);
    if (!validation.valid) {
      console.log(`[${executionId}] ❌ Transfer amount validation failed: ${validation.error}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: validation.error,
        amount: totalRevenueAmount,
        amount_cents: amountInCents,
        stripe_requirements: {
          minimum_usd: STRIPE_LIMITS.MIN_TRANSFER_AMOUNT / 100,
          maximum_usd: STRIPE_LIMITS.MAX_TRANSFER_AMOUNT / 100,
          destination_account: STRIPE_LIMITS.DESTINATION_ACCOUNT
        },
        validation_failed: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    console.log(`[${executionId}] 🚀 Starting transfer process for $${totalRevenueAmount.toFixed(2)} (${amountInCents} cents)`);

    // 4. Log transfer attempt
    const transferId = crypto.randomUUID();
    await supabaseClient
      .from('transfer_attempts')
      .insert({
        id: transferId,
        amount: amountInCents,
        currency: 'usd',
        description: `Completed revenue to bank transfer: $${totalRevenueAmount.toFixed(2)}`,
        status: 'processing',
        metadata: {
          execution_id: executionId,
          source: 'completed_revenue',
          amount_usd: totalRevenueAmount,
          amount_cents: amountInCents,
          destination_account: STRIPE_LIMITS.DESTINATION_ACCOUNT,
          timestamp: new Date().toISOString(),
          flow: 'revenue_to_bank'
        }
      });

    // 5. Attempt Stripe transfer to specific destination WITH RETRY LOGIC
    console.log(`[${executionId}] 🏦 Attempting Stripe transfer to ${STRIPE_LIMITS.DESTINATION_ACCOUNT} (with retry logic)...`);
    
    let transfer;
    let lastError;

    // Retry loop with exponential backoff
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[${executionId}] 🔄 Transfer attempt ${attempt + 1}/${MAX_RETRIES + 1}`);
        
        transfer = await stripe.transfers.create({
          amount: amountInCents,
          currency: 'usd',
          destination: STRIPE_LIMITS.DESTINATION_ACCOUNT,
          description: `Completed Revenue Transfer - $${totalRevenueAmount.toFixed(2)}`,
          metadata: {
            execution_id: executionId,
            source: 'completed_revenue',
            amount_usd: totalRevenueAmount.toString(),
            amount_cents: amountInCents.toString(),
            timestamp: new Date().toISOString(),
            transfer_id: transferId,
            attempt: (attempt + 1).toString(),
            flow: 'revenue_to_bank'
          }
        });

        console.log(`[${executionId}] ✅ Stripe transfer created successfully: ${transfer.id}`);
        break; // Success, exit retry loop

      } catch (stripeError: any) {
        lastError = stripeError;
        console.error(`[${executionId}] ❌ Stripe transfer attempt ${attempt + 1} failed:`, stripeError);
        
        // Handle specific Stripe errors
        const errorCode = stripeError.code;
        const errorType = stripeError.type;
        
        // Determine if retry is appropriate
        const isRetryableError = 
          errorCode === 'rate_limit' ||
          errorType === 'api_connection_error' ||
          errorType === 'api_error' ||
          (errorCode && ['lock_timeout', 'temporary_unavailable'].includes(errorCode));

        // Don't retry for certain errors
        const isNonRetryableError = 
          errorCode === 'insufficient_funds' ||
          errorCode === 'account_invalid' ||
          errorCode === 'invalid_request_error' ||
          errorCode === 'authentication_error' ||
          errorCode === 'account_deactivated' ||
          errorCode === 'transfers_not_allowed';

        if (isNonRetryableError) {
          console.error(`[${executionId}] 🚫 Non-retryable error detected: ${errorCode}`);
          break; // Don't retry
        }

        if (attempt < MAX_RETRIES && isRetryableError) {
          const delay = getRetryDelay(attempt);
          console.log(`[${executionId}] ⏳ Waiting ${delay}ms before retry...`);
          await sleep(delay);
          continue; // Retry
        } else {
          // Final attempt failed or non-retryable error
          break;
        }
      }
    }

    // If transfer failed after all retries
    if (!transfer) {
      console.error(`[${executionId}] 💥 All transfer attempts failed`);
      
      // Log failed transfer with detailed error information
      await supabaseClient
        .from('transfer_attempts')
        .update({
          status: 'failed',
          error_code: lastError?.code || 'unknown_error',
          error_message: lastError?.message || 'Unknown error',
          metadata: {
            execution_id: executionId,
            source: 'completed_revenue',
            amount_usd: totalRevenueAmount,
            amount_cents: amountInCents,
            destination_account: STRIPE_LIMITS.DESTINATION_ACCOUNT,
            timestamp: new Date().toISOString(),
            error_type: lastError?.type,
            error_code: lastError?.code,
            flow: 'revenue_to_bank',
            retries_attempted: MAX_RETRIES + 1,
            final_error: lastError?.message
          }
        })
        .eq('id', transferId);

      // Return error response - BALANCE UNCHANGED
      return new Response(JSON.stringify({ 
        success: false,
        error: lastError?.message || 'Transfer failed after all retries',
        error_code: lastError?.code,
        error_type: lastError?.type,
        execution_id: executionId,
        retries_attempted: MAX_RETRIES + 1,
        timestamp: new Date().toISOString(),
        message: "Transfer to bank account failed. Revenue balance unchanged.",
        balance_unchanged: true,
        available_revenue: totalRevenueAmount,
        destination_account: STRIPE_LIMITS.DESTINATION_ACCOUNT,
        troubleshooting: {
          insufficient_funds: lastError?.code === 'insufficient_funds' ? "Your Stripe account has insufficient funds for this transfer" : null,
          invalid_destination: lastError?.code === 'account_invalid' ? "Destination account may be invalid or deactivated" : null,
          transfers_not_allowed: lastError?.code === 'transfers_not_allowed' ? "Transfers not allowed to this destination account" : null,
          rate_limits: lastError?.code === 'rate_limit' ? "Stripe API rate limit reached, try again later" : null,
          network_timeout: lastError?.type === 'api_connection_error' ? "Network connectivity issue, check connection" : null,
          check_stripe_secret: "Verify STRIPE_SECRET_KEY is configured correctly",
          check_destination_account: `Verify destination account ${STRIPE_LIMITS.DESTINATION_ACCOUNT} is valid and active`,
          minimum_amount: `Transfers require minimum $${STRIPE_LIMITS.MIN_TRANSFER_AMOUNT / 100}`
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // 6. Verify transfer was actually created successfully
    if (!transfer.id || transfer.amount !== amountInCents) {
      console.error(`[${executionId}] ⚠️ Transfer validation failed - ID: ${transfer.id}, Amount: ${transfer.amount} vs Expected: ${amountInCents}`);
      
      await supabaseClient
        .from('transfer_attempts')
        .update({
          status: 'failed',
          error_code: 'transfer_validation_failed',
          error_message: 'Transfer created but validation failed',
          metadata: {
            execution_id: executionId,
            source: 'completed_revenue',
            amount_usd: totalRevenueAmount,
            amount_cents: amountInCents,
            destination_account: STRIPE_LIMITS.DESTINATION_ACCOUNT,
            timestamp: new Date().toISOString(),
            flow: 'revenue_to_bank',
            transfer_id: transfer.id,
            transfer_amount: transfer.amount,
            expected_amount: amountInCents,
            validation_error: 'Amount or ID mismatch'
          }
        })
        .eq('id', transferId);

      return new Response(JSON.stringify({ 
        success: false,
        error: 'Transfer validation failed',
        message: "Transfer may have been created but validation failed. Revenue balance unchanged.",
        balance_unchanged: true,
        stripe_transfer_id: transfer.id,
        execution_id: executionId
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // 7. SUCCESS: Reset completed revenue balance ONLY after successful transfer
    console.log(`[${executionId}] 💰 SUCCESS: Resetting completed revenue balance after successful transfer`);
    
    const { error: balanceResetError } = await supabaseClient
      .from('completed_revenue')
      .update({ 
        total_amount: 0,
        last_transferred_at: new Date().toISOString(),
        last_transfer_amount: totalRevenueAmount,
        last_transfer_id: transfer.id
      });

    if (balanceResetError) {
      console.error(`[${executionId}] ⚠️ CRITICAL: Transfer succeeded but failed to reset revenue balance:`, balanceResetError);
      
      // Log this critical error but don't fail the request since money was transferred
      await supabaseClient
        .from('transfer_attempts')
        .update({
          status: 'transfer_success_balance_error',
          error_message: 'Transfer succeeded but balance reset failed',
          metadata: {
            execution_id: executionId,
            source: 'completed_revenue',
            amount_usd: totalRevenueAmount,
            amount_cents: amountInCents,
            destination_account: STRIPE_LIMITS.DESTINATION_ACCOUNT,
            timestamp: new Date().toISOString(),
            stripe_transfer_id: transfer.id,
            flow: 'revenue_to_bank',
            balance_reset_error: balanceResetError.message,
            critical_error: true
          }
        })
        .eq('id', transferId);

      return new Response(JSON.stringify({ 
        success: false,
        error: 'Transfer succeeded but balance reset failed',
        message: "CRITICAL: Money was transferred but revenue balance was not reset. Manual intervention required.",
        stripe_transfer_id: transfer.id,
        transfer_amount: totalRevenueAmount,
        balance_reset_failed: true,
        execution_id: executionId,
        requires_manual_intervention: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // 8. Update transfer attempt with complete success
    await supabaseClient
      .from('transfer_attempts')
      .update({
        stripe_transfer_id: transfer.id,
        status: 'completed',
        metadata: {
          execution_id: executionId,
          source: 'completed_revenue',
          amount_usd: totalRevenueAmount,
          amount_cents: amountInCents,
          destination_account: STRIPE_LIMITS.DESTINATION_ACCOUNT,
          timestamp: new Date().toISOString(),
          stripe_transfer_id: transfer.id,
          flow: 'revenue_to_bank',
          revenue_balance_before: totalRevenueAmount,
          revenue_balance_after: 0,
          balance_reset_successful: true
        }
      })
      .eq('id', transferId);

    // 9. Log successful transfer
    await supabaseClient
      .from('automated_transfer_logs')
      .insert({
        job_name: 'completed_revenue_to_bank_transfer',
        status: 'completed',
        execution_time: new Date().toISOString(),
        response: {
          execution_id: executionId,
          stripe_transfer_id: transfer.id,
          amount_transferred: totalRevenueAmount,
          amount_cents: amountInCents,
          destination_account: STRIPE_LIMITS.DESTINATION_ACCOUNT,
          transfer_id: transferId,
          revenue_balance_before: totalRevenueAmount,
          revenue_balance_after: 0,
          flow: 'revenue_to_bank'
        }
      });

    console.log(`[${executionId}] 🎉 Transfer completed successfully!`);
    console.log(`[${executionId}] 📊 Revenue balance reset to $0.00 after $${totalRevenueAmount.toFixed(2)} transfer`);

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully transferred $${totalRevenueAmount.toFixed(2)} from completed revenue to bank account`,
      amount: totalRevenueAmount,
      amount_cents: amountInCents,
      stripe_transfer_id: transfer.id,
      transfer_id: transferId,
      destination_account: STRIPE_LIMITS.DESTINATION_ACCOUNT,
      transfer_details: {
        id: transfer.id,
        amount: totalRevenueAmount,
        amount_cents: amountInCents,
        currency: 'usd',
        destination: transfer.destination,
        description: transfer.description,
        created: transfer.created
      },
      balance_changes: {
        completed_revenue: {
          before: totalRevenueAmount,
          after: 0
        }
      },
      execution_id: executionId,
      flow: 'revenue_to_bank',
      stripe_compliance: {
        minimum_met: amountInCents >= STRIPE_LIMITS.MIN_TRANSFER_AMOUNT,
        maximum_check: amountInCents <= STRIPE_LIMITS.MAX_TRANSFER_AMOUNT,
        amount_validated: true
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error(`[${executionId}] 💥 Transfer failed:`, error);
    
    // Log error
    await supabaseClient
      .from('automated_transfer_logs')
      .insert({
        job_name: 'completed_revenue_to_bank_transfer',
        status: 'failed',
        execution_time: new Date().toISOString(),
        error_message: error.message,
        response: {
          execution_id: executionId,
          error_type: error.name || 'UnknownError',
          error_message: error.message,
          timestamp: new Date().toISOString(),
          flow: 'revenue_to_bank'
        }
      });

    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      error_type: error.name || 'UnknownError',
      execution_id: executionId,
      timestamp: new Date().toISOString(),
      message: "Completed revenue to bank transfer failed. Check logs for details.",
      balance_unchanged: true,
      destination_account: STRIPE_LIMITS.DESTINATION_ACCOUNT,
      troubleshooting: {
        check_stripe_secret: "Verify STRIPE_SECRET_KEY is configured correctly",
        check_destination_account: `Verify destination account ${STRIPE_LIMITS.DESTINATION_ACCOUNT} is valid and active`,
        check_revenue_balance: "Verify sufficient completed revenue exists",
        minimum_amount: `Transfers require minimum $${STRIPE_LIMITS.MIN_TRANSFER_AMOUNT / 100}`,
        maximum_amount: `Transfers cannot exceed $${STRIPE_LIMITS.MAX_TRANSFER_AMOUNT / 100}`,
        check_logs: "Review transfer_attempts table for detailed error info"
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});