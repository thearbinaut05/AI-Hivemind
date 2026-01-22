import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔍 Retrieving Stripe balance...");
    
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("STRIPE_SECRET_KEY not configured");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "STRIPE_SECRET_KEY not configured",
        message: "Please configure your Stripe secret key in Supabase Edge Function secrets"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const stripe = new Stripe(stripeKey, { 
      apiVersion: "2023-10-16",
      typescript: true 
    });

    // Get Stripe account balance
    const balance = await stripe.balance.retrieve();
    
    console.log("💰 Retrieved Stripe balance:", balance);

    // Calculate total available balance in USD
    const availableUSD = balance.available.find(b => b.currency === 'usd');
    const pendingUSD = balance.pending.find(b => b.currency === 'usd');
    
    const totalAvailableAmount = availableUSD ? availableUSD.amount / 100 : 0;
    const totalPendingAmount = pendingUSD ? pendingUSD.amount / 100 : 0;

    // Get recent transfers to show activity
    const transfers = await stripe.transfers.list({ limit: 10 });
    
    console.log(`✅ Stripe balance retrieved: $${totalAvailableAmount.toFixed(2)} available, $${totalPendingAmount.toFixed(2)} pending`);

    return new Response(JSON.stringify({
      success: true,
      balance: totalAvailableAmount,
      pending: totalPendingAmount,
      available: balance.available,
      pending_details: balance.pending,
      recent_transfers: transfers.data.map(t => ({
        id: t.id,
        amount: t.amount / 100,
        currency: t.currency,
        created: new Date(t.created * 1000).toISOString(),
        arrival_date: new Date(t.arrival_date * 1000).toISOString(),
        description: t.description
      })),
      currency_breakdown: {
        available_usd: totalAvailableAmount,
        pending_usd: totalPendingAmount,
        total_usd: totalAvailableAmount + totalPendingAmount
      },
      last_updated: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error('💥 Stripe balance retrieval error:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      error_type: error.type || 'unknown_error',
      timestamp: new Date().toISOString(),
      message: "Failed to retrieve Stripe balance. Please check your Stripe configuration."
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});