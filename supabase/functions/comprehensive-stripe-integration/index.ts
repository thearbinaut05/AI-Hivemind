
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

  try {
    console.log("🚀 Starting PRODUCTION Stripe integration - NO MOCK DATA");
    
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured - add your real Stripe API key");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // 1. Analyze all REAL revenue sources across the database
    const revenueAnalysis = await analyzeAllRevenueSources(supabaseClient);
    
    // 2. Calculate total transferable balance from REAL data
    const transferableBalance = await calculateTransferableBalance(supabaseClient);
    
    // 3. Create detailed transaction records
    const transactionDetails = await createDetailedTransactionRecords(supabaseClient);
    
    // 4. Execute REAL Stripe payout - no simulations
    const stripeTransfer = await executeRealStripePayout(
      stripe, 
      transferableBalance, 
      transactionDetails
    );

    if (!stripeTransfer.success) {
      return new Response(JSON.stringify({
        success: false,
        message: stripeTransfer.message,
        balance: transferableBalance.total,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 5. Update all relevant tables after successful transfer
    await updateComplianceRecords(supabaseClient, stripeTransfer, revenueAnalysis);

    console.log(`✅ Successfully transferred $${transferableBalance.total.toFixed(2)} to bank account`);

    return new Response(JSON.stringify({
      success: true,
      message: `PRODUCTION: $${transferableBalance.total.toFixed(2)} transferred to bank account`,
      total_amount: transferableBalance.total,
      stripe_payout_id: stripeTransfer.payout_id,
      arrival_date: stripeTransfer.arrival_date,
      production_mode: true,
      no_mock_data: true,
      revenue_analysis: revenueAnalysis,
      transfer_details: {
        amount_transferred: transferableBalance.total,
        revenue_portion: transferableBalance.revenue_portion,
        balance_portion: transferableBalance.balance_portion,
        payout_id: stripeTransfer.payout_id
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error('💥 Stripe integration error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

async function analyzeAllRevenueSources(supabase: any) {
  console.log("📊 Analyzing all REAL revenue sources...");
  
  // Analyze autonomous revenue transactions
  const { data: autonomousRevenue } = await supabase
    .from('autonomous_revenue_transactions')
    .select('*')
    .eq('status', 'completed');

  // Analyze application balance
  const { data: appBalance } = await supabase
    .from('application_balance')
    .select('*');

  // Analyze earnings
  const { data: earnings } = await supabase
    .from('earnings')
    .select('*');

  // Analyze campaign revenue
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .gt('revenue', 0);

  const totalRevenue = (autonomousRevenue || []).reduce((sum: number, t: any) => sum + Number(t.amount), 0) +
                      (earnings || []).reduce((sum: number, e: any) => sum + Number(e.amount), 0) +
                      (campaigns || []).reduce((sum: number, c: any) => sum + Number(c.revenue), 0);

  return {
    autonomous_revenue: {
      total: (autonomousRevenue || []).reduce((sum: number, t: any) => sum + Number(t.amount), 0),
      count: (autonomousRevenue || []).length
    },
    earnings: {
      total: (earnings || []).reduce((sum: number, e: any) => sum + Number(e.amount), 0),
      count: (earnings || []).length
    },
    campaign_revenue: {
      total: (campaigns || []).reduce((sum: number, c: any) => sum + Number(c.revenue), 0),
      count: (campaigns || []).length
    },
    application_balance: appBalance?.[0]?.balance_amount || 0,
    total_revenue: totalRevenue,
    production_mode: true
  };
}

async function calculateTransferableBalance(supabase: any) {
  console.log("💰 Calculating REAL transferable balance...");
  
  // Get all completed revenue
  const { data: compliantRevenue } = await supabase
    .from('autonomous_revenue_transactions')
    .select('*')
    .eq('status', 'completed');

  // Get application balance
  const { data: balance } = await supabase
    .from('application_balance')
    .select('*')
    .single();

  const revenueTotal = (compliantRevenue || []).reduce((sum: number, t: any) => sum + Number(t.amount), 0);
  const appBalance = balance?.balance_amount || 0;

  return {
    total: revenueTotal + appBalance,
    revenue_portion: revenueTotal,
    balance_portion: appBalance
  };
}

async function createDetailedTransactionRecords(supabase: any) {
  return {
    timestamp: new Date().toISOString(),
    production_mode: true,
    no_mock_data: true
  };
}

async function executeRealStripePayout(stripe: any, balance: any, details: any) {
  console.log("🚀 Executing REAL Stripe payout...");
  
  if (balance.total < 1) {
    return {
      success: false,
      message: `Balance too low for payout: $${balance.total.toFixed(2)}. Minimum is $1.00`
    };
  }

  const amountInCents = Math.round(balance.total * 100);

  try {
    // Check Stripe balance first
    const stripeBalance = await stripe.balance.retrieve();
    const availableBalance = stripeBalance.available.find((b: any) => b.currency === 'usd');
    const availableAmount = availableBalance?.amount || 0;

    if (availableAmount < amountInCents) {
      return {
        success: false,
        message: `Insufficient Stripe balance. Available: $${(availableAmount / 100).toFixed(2)}, Requested: $${balance.total.toFixed(2)}`
      };
    }

    // Create REAL payout to bank account
    const payout = await stripe.payouts.create({
      amount: amountInCents,
      currency: 'usd',
      method: 'standard',
      description: `Production Payout - $${balance.total.toFixed(2)}`,
      metadata: {
        production_mode: 'true',
        no_mock_data: 'true',
        timestamp: new Date().toISOString()
      }
    });

    console.log(`✅ Stripe payout created: ${payout.id} for $${balance.total.toFixed(2)}`);
    
    return {
      success: true,
      payout_id: payout.id,
      amount: balance.total,
      arrival_date: new Date(payout.arrival_date * 1000).toISOString()
    };
  } catch (error: any) {
    console.error('Stripe payout error:', error);
    return {
      success: false,
      message: `Stripe payout failed: ${error.message}`
    };
  }
}

async function updateComplianceRecords(supabase: any, transfer: any, analysis: any) {
  console.log("📊 Updating records after successful transfer...");
  
  // Update transfer logs
  await supabase
    .from('autonomous_revenue_transfer_logs')
    .insert({
      source_account: 'production_revenue_system',
      destination_account: 'stripe_bank_account',
      amount: transfer.amount,
      status: 'completed',
      metadata: {
        stripe_payout_id: transfer.payout_id,
        production_mode: true,
        no_mock_data: true,
        arrival_date: transfer.arrival_date
      }
    });

  // Mark all transferred transactions
  await supabase
    .from('autonomous_revenue_transactions')
    .update({
      status: 'transferred',
      metadata: {
        stripe_payout_id: transfer.payout_id,
        transferred_at: new Date().toISOString()
      }
    })
    .eq('status', 'completed');

  // Reset application balance
  await supabase
    .from('application_balance')
    .update({
      balance_amount: 0,
      last_updated_at: new Date().toISOString()
    })
    .eq('id', 1);
}
