import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_PAYOUT_CENTS = 50; // $0.50

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const executionId = `payout_${Date.now()}`;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }

  if (!stripeKey) {
    return new Response(
      JSON.stringify({ success: false, error: "STRIPE_SECRET_KEY not set" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  try {
    // Parse amount_cents from JSON body, if present
    const { amount_cents }: { amount_cents?: number } = await req
      .json()
      .catch(() => ({}));

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Retrieve available balance in USD
    const bal = await stripe.balance.retrieve();
    const availableUSD =
      (bal.available || []).find((b: any) => b.currency === "usd")?.amount || 0;

    // Determine the payout amount to use
    const desiredAmount =
      typeof amount_cents === "number" ? Math.floor(amount_cents) : availableUSD;
    const payoutAmount = Math.max(0, Math.min(desiredAmount, availableUSD));

    if (payoutAmount < MIN_PAYOUT_CENTS) {
      // Log skipped payout due to below minimum
      await supabase.from("automated_transfer_logs").insert({
        job_name: "payout_now",
        status: "skipped",
        execution_time: new Date().toISOString(),
        response: {
          execution_id: executionId,
          available_usd_cents: availableUSD,
          reason: "Below minimum payout",
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          message: "Insufficient available USD for payout",
          available_cents: availableUSD,
          minimum_cents: MIN_PAYOUT_CENTS,
          execution_id: executionId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Create payout with Stripe
    const payout = await stripe.payouts.create({
      amount: payoutAmount,
      currency: "usd",
    });

    // Log successful payout
    await supabase.from("automated_transfer_logs").insert({
      job_name: "payout_now",
      status: "completed",
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    // Log failure with error details
    await supabase.from("automated_transfer_logs").insert({
      job_name: "payout_now",
      status: "failed",
      error_message: error?.message || "Unknown error",
      execution_time: new Date().toISOString(),
      response: {
        execution_id: executionId,
        error: {
          message: error?.message,
          code: error?.code,
          type: error?.type,
        },
      },
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || "Unknown error",
        execution_id: executionId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
```
---

**Notes for production use:**

- Make sure these environment variables are set and secured in your deployment environment:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `STRIPE_SECRET_KEY`

- The Supabase table `automated_transfer_logs` should have at least the following columns:
  - `job_name` (string)
  - `status` (string)
  - `execution_time` (timestamp)
  - `response` (JSONB)
  - `error_message` (string, nullable)

- The response column should allow storage of JSON objects for flexibility in logging.

- The code includes CORS headers allowing any origin; tighten this if needed in your deployment.

- Proper error handling and logging are present to support operational monitoring and debugging.