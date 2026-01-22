import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000;
const getDelay = (attempt: number) => INITIAL_DELAY * Math.pow(2, attempt);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const executionId = `aggregate_${Date.now()}`;

  try {
    const { dry_run = false } = (await req.json().catch(() => ({}))) as {
      dry_run?: boolean;
    };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ success: false, error: "STRIPE_SECRET_KEY not set" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const DEST_ACCOUNT = Deno.env.get("STRIPE_DESTINATION_ACCOUNT") || 'acct_1RGs3rD6CDwEP7C7';

    // Fetch Stripe available USD balance
    const stripeBalance = await stripe.balance.retrieve();
    const availableUSD = (stripeBalance.available || []).find((b: any) => b.currency === 'usd')?.amount || 0; // in cents

    // Aggregate USD amounts across key tables
    const [appBalRes, artRes, cbRes, caRes, earnRes] = await Promise.all([
      supabase.from('application_balance').select('balance_amount').eq('id', 1).maybeSingle(),
      supabase.from('autonomous_revenue_transactions').select('amount,currency,status'),
      supabase.from('consolidated_balances').select('amount,currency'),
      supabase.from('consolidated_amounts').select('total_usd'),
      supabase.from('earnings').select('amount')
    ]);

    const appBalance = Number(appBalRes.data?.balance_amount || 0);

    const artUSD = (artRes.data || [])
      .filter((r: any) => (r.currency || 'USD').toUpperCase() === 'USD')
      .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

    const consBalUSD = (cbRes.data || [])
      .filter((r: any) => (r.currency || 'USD').toUpperCase() === 'USD')
      .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

    const consAmountsUSD = (caRes.data || [])
      .reduce((s: number, r: any) => s + Number(r.total_usd || 0), 0);

    const earningsUSD = (earnRes.data || [])
      .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

    const aggregateUSD = appBalance + artUSD + consBalUSD + consAmountsUSD + earningsUSD; // dollars
    const aggregateCents = Math.max(0, Math.round(aggregateUSD * 100));

    // Determine transfer amount based on actual Stripe availability
    const amountToTransferCents = Math.min(aggregateCents, availableUSD);

    const breakdown = {
      app_balance_usd: appBalance,
      autonomous_revenue_usd: artUSD,
      consolidated_balances_usd: consBalUSD,
      consolidated_amounts_usd: consAmountsUSD,
      earnings_usd: earningsUSD,
      aggregate_usd: aggregateUSD,
      stripe_available_usd: availableUSD / 100,
      execution_id: executionId,
    };

    if (amountToTransferCents <= 0) {
      await supabase.from('automated_transfer_logs').insert({
        job_name: 'aggregate_usd_to_stripe',
        status: 'skipped',
        response: {
          ...breakdown,
          reason: 'No available USD in Stripe or aggregate is zero',
        },
        execution_time: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: 'No funds available to transfer.',
          amount_cents: 0,
          breakdown,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (dry_run) {
      return new Response(
        JSON.stringify({ success: true, dry_run: true, amount_cents: amountToTransferCents, breakdown }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Insert transfer record (high level)
    await supabase.from('autonomous_revenue_transfers').insert({
      amount: amountToTransferCents / 100,
      status: 'processing',
      provider: 'stripe',
      metadata: {
        execution_id: executionId,
        breakdown,
        amount_cents: amountToTransferCents,
        destination_account: DEST_ACCOUNT,
        flow: 'aggregate_usd_to_stripe',
      },
    });

    let transfer;
    let lastError: any;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        transfer = await stripe.transfers.create({
          amount: amountToTransferCents,
          currency: 'usd',
          destination: DEST_ACCOUNT,
          description: `Aggregate USD transfer ($${(amountToTransferCents / 100).toFixed(2)})`,
          metadata: {
            execution_id: executionId,
            flow: 'aggregate_usd_to_stripe',
            amount_cents: String(amountToTransferCents),
            attempt: String(attempt + 1),
          },
        });
        break;
      } catch (e: any) {
        lastError = e;
        const retryable = ['rate_limit', 'lock_timeout', 'temporary_unavailable'].includes(e?.code) ||
          ['api_connection_error', 'api_error'].includes(e?.type);
        const nonRetryable = ['insufficient_funds', 'account_invalid', 'authentication_error', 'invalid_request_error', 'account_deactivated', 'transfers_not_allowed'].includes(e?.code);
        if (nonRetryable || attempt === MAX_RETRIES || !retryable) break;
        await sleep(getDelay(attempt));
      }
    }

    if (!transfer) {
      await supabase.from('automated_transfer_logs').insert({
        job_name: 'aggregate_usd_to_stripe',
        status: 'failed',
        error_message: lastError?.message || 'Unknown error',
        response: {
          ...breakdown,
          error: { code: lastError?.code, type: lastError?.type, message: lastError?.message },
        },
        execution_time: new Date().toISOString(),
      });

      await supabase
        .from('autonomous_revenue_transfers')
        .update({
          status: 'failed',
          error_message: lastError?.message || 'Unknown error',
          metadata: {
            failure: { code: lastError?.code, type: lastError?.type, message: lastError?.message },
            execution_id: executionId,
          },
        })
        .order('created_at', { ascending: false })
        .limit(1);

      return new Response(
        JSON.stringify({ success: false, error: lastError?.message || 'Transfer failed', breakdown }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Success: mark transfer completed and log
    await supabase
      .from('autonomous_revenue_transfers')
      .update({
        status: 'completed',
        provider_transfer_id: transfer.id,
        completed_at: new Date().toISOString(),
        metadata: { ...breakdown, stripe_transfer_id: transfer.id },
      })
      .order('created_at', { ascending: false })
      .limit(1);

    await supabase.from('automated_transfer_logs').insert({
      job_name: 'aggregate_usd_to_stripe',
      status: 'completed',
      execution_time: new Date().toISOString(),
      response: {
        ...breakdown,
        stripe_transfer_id: transfer.id,
        amount_transferred_usd: amountToTransferCents / 100,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Transferred $${(amountToTransferCents / 100).toFixed(2)} to destination account`,
        amount_cents: amountToTransferCents,
        destination_account: DEST_ACCOUNT,
        stripe_transfer_id: transfer.id,
        breakdown,
        execution_id: executionId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Unknown error', execution_id: executionId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
