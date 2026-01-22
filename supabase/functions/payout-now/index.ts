import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_PAYOUT_CENTS = 50; // $0.50

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const executionId = `payout_${Date.now()}`;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return new Response(JSON.stringify({ success: false, error: 'STRIPE_SECRET_KEY not set' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { amount_cents }: { amount_cents?: number } = await req.json().catch(() => ({}));
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    // Retrieve available balance in USD
    const bal = await stripe.balance.retrieve();
    const availableUSD = (bal.available || []).find((b: any) => b.currency === 'usd')?.amount || 0;

    const desiredAmount = typeof amount_cents === 'number' ? Math.floor(amount_cents) : availableUSD;
    const payoutAmount = Math.max(0, Math.min(desiredAmount, availableUSD));

    if (payoutAmount < MIN_PAYOUT_CENTS) {
      await supabase.from('automated_transfer_logs').insert({
        job_name: 'payout_now',
        status: 'skipped',
        execution_time: new Date().toISOString(),
        response: {
          execution_id: executionId,
          available_usd_cents: availableUSD,
          reason: 'Below minimum payout',
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: 'Insufficient available USD for payout',
          available_cents: availableUSD,
          minimum_cents: MIN_PAYOUT_CENTS,
          execution_id: executionId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const payout = await stripe.payouts.create({ amount: payoutAmount, currency: 'usd' });

    await supabase.from('automated_transfer_logs').insert({
      job_name: 'payout_now',
      status: 'completed',
      execution_time: new Date().toISOString(),
      response: {
        execution_id: executionId,
        amount_cents: payoutAmount,
        payout_id: payout.id,
        arrival_date: payout.arrival_date,
        status: payout.status,
        balance_transaction: payout.balance_transaction,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Payout of $${(payoutAmount / 100).toFixed(2)} created`,
        amount_cents: payoutAmount,
        payout_id: payout.id,
        arrival_date: payout.arrival_date,
        status: payout.status,
        execution_id: executionId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    await supabase.from('automated_transfer_logs').insert({
      job_name: 'payout_now',
      status: 'failed',
      error_message: error?.message || 'Unknown error',
      execution_time: new Date().toISOString(),
      response: { execution_id: executionId, error: { message: error?.message, code: error?.code, type: error?.type } },
    });

    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Unknown error', execution_id: executionId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
