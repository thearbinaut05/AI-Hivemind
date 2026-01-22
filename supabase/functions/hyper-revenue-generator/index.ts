
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

  const executionId = `revenue_${Date.now()}`;
  console.log(`[${executionId}] Starting production revenue aggregation - NO MOCK DATA`);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    // PRODUCTION: Aggregate REAL revenue from all sources
    const revenueStreams = await Promise.all([
      aggregateRealAPIRevenue(supabase, executionId),
      aggregateRealSubscriptionRevenue(supabase, executionId),
      aggregateRealMarketplaceRevenue(supabase, executionId),
      aggregateRealAffiliateRevenue(supabase, executionId),
      aggregateRealDirectPayments(supabase, executionId),
      aggregateRealContentLicensing(supabase, executionId),
      aggregateRealCryptoRevenue(supabase, executionId),
      aggregateRealDataMonetization(supabase, executionId)
    ]);

    const totalAmount = revenueStreams.reduce((sum, stream) => sum + stream.amount, 0);
    const totalTransactions = revenueStreams.reduce((sum, stream) => sum + stream.count, 0);

    // Only update if there's real revenue
    if (totalAmount > 0) {
      // Get current balance and add to it
      const { data: currentBalance } = await supabase
        .from('application_balance')
        .select('balance_amount')
        .eq('id', 1)
        .single();

      const newBalance = (currentBalance?.balance_amount || 0) + totalAmount;

      await supabase
        .from('application_balance')
        .upsert({
          id: 1,
          balance_amount: newBalance,
          last_updated_at: new Date().toISOString()
        });

      // Update revenue streams metrics
      for (const stream of revenueStreams) {
        if (stream.amount > 0) {
          await supabase
            .from('autonomous_revenue_streams')
            .upsert({
              name: stream.name,
              strategy: stream.strategy,
              status: 'active',
              metrics: {
                total_revenue: stream.amount,
                transaction_count: stream.count,
                peak_transaction: stream.peak,
                last_aggregated: new Date().toISOString(),
                source: 'production_real_data'
              }
            }, { onConflict: 'name' });
        }
      }
    }

    console.log(`[${executionId}] Aggregated $${totalAmount.toFixed(2)} from ${totalTransactions} real transactions`);

    return new Response(JSON.stringify({
      success: true,
      total_amount: totalAmount,
      transaction_count: totalTransactions,
      revenue_streams: revenueStreams.filter(s => s.amount > 0).length,
      execution_id: executionId,
      streams: revenueStreams,
      production_mode: true,
      no_mock_data: true
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (error: any) {
    console.error(`[${executionId}] Error:`, error);
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

// Aggregate REAL API revenue from existing transactions
async function aggregateRealAPIRevenue(supabase: any, executionId: string) {
  const { data: transactions } = await supabase
    .from('autonomous_revenue_transactions')
    .select('*')
    .eq('status', 'completed')
    .contains('metadata', { strategy: 'api_usage' });

  const totalAmount = (transactions || []).reduce((sum: number, t: any) => sum + Number(t.amount), 0);
  const peakTransaction = transactions?.length > 0 
    ? Math.max(...transactions.map((t: any) => Number(t.amount)))
    : 0;

  return {
    name: 'API Premium Services',
    strategy: 'api_usage',
    amount: totalAmount,
    count: transactions?.length || 0,
    peak: peakTransaction
  };
}

// Aggregate REAL subscription revenue
async function aggregateRealSubscriptionRevenue(supabase: any, executionId: string) {
  const { data: transactions } = await supabase
    .from('autonomous_revenue_transactions')
    .select('*')
    .eq('status', 'completed')
    .contains('metadata', { strategy: 'subscription' });

  const totalAmount = (transactions || []).reduce((sum: number, t: any) => sum + Number(t.amount), 0);
  const peakTransaction = transactions?.length > 0 
    ? Math.max(...transactions.map((t: any) => Number(t.amount)))
    : 0;

  return {
    name: 'Subscription Services',
    strategy: 'subscription',
    amount: totalAmount,
    count: transactions?.length || 0,
    peak: peakTransaction
  };
}

// Aggregate REAL marketplace revenue
async function aggregateRealMarketplaceRevenue(supabase: any, executionId: string) {
  const { data: transactions } = await supabase
    .from('autonomous_revenue_transactions')
    .select('*')
    .eq('status', 'completed')
    .contains('metadata', { strategy: 'marketplace' });

  const totalAmount = (transactions || []).reduce((sum: number, t: any) => sum + Number(t.amount), 0);
  const peakTransaction = transactions?.length > 0 
    ? Math.max(...transactions.map((t: any) => Number(t.amount)))
    : 0;

  return {
    name: 'Marketplace Sales',
    strategy: 'marketplace',
    amount: totalAmount,
    count: transactions?.length || 0,
    peak: peakTransaction
  };
}

// Aggregate REAL affiliate revenue
async function aggregateRealAffiliateRevenue(supabase: any, executionId: string) {
  const { data: transactions } = await supabase
    .from('autonomous_revenue_transactions')
    .select('*')
    .eq('status', 'completed')
    .contains('metadata', { strategy: 'affiliate_marketing' });

  const totalAmount = (transactions || []).reduce((sum: number, t: any) => sum + Number(t.amount), 0);
  const peakTransaction = transactions?.length > 0 
    ? Math.max(...transactions.map((t: any) => Number(t.amount)))
    : 0;

  return {
    name: 'Affiliate Commissions',
    strategy: 'affiliate_marketing',
    amount: totalAmount,
    count: transactions?.length || 0,
    peak: peakTransaction
  };
}

// Aggregate REAL direct payments
async function aggregateRealDirectPayments(supabase: any, executionId: string) {
  const { data: transactions } = await supabase
    .from('autonomous_revenue_transactions')
    .select('*')
    .eq('status', 'completed')
    .contains('metadata', { strategy: 'direct_payment' });

  const totalAmount = (transactions || []).reduce((sum: number, t: any) => sum + Number(t.amount), 0);
  const peakTransaction = transactions?.length > 0 
    ? Math.max(...transactions.map((t: any) => Number(t.amount)))
    : 0;

  return {
    name: 'Direct Client Payments',
    strategy: 'direct_payment',
    amount: totalAmount,
    count: transactions?.length || 0,
    peak: peakTransaction
  };
}

// Aggregate REAL content licensing
async function aggregateRealContentLicensing(supabase: any, executionId: string) {
  const { data: transactions } = await supabase
    .from('autonomous_revenue_transactions')
    .select('*')
    .eq('status', 'completed')
    .contains('metadata', { strategy: 'content_licensing' });

  const totalAmount = (transactions || []).reduce((sum: number, t: any) => sum + Number(t.amount), 0);
  const peakTransaction = transactions?.length > 0 
    ? Math.max(...transactions.map((t: any) => Number(t.amount)))
    : 0;

  return {
    name: 'Content Licensing',
    strategy: 'content_licensing',
    amount: totalAmount,
    count: transactions?.length || 0,
    peak: peakTransaction
  };
}

// Aggregate REAL crypto revenue
async function aggregateRealCryptoRevenue(supabase: any, executionId: string) {
  const { data: transactions } = await supabase
    .from('autonomous_revenue_transactions')
    .select('*')
    .eq('status', 'completed')
    .contains('metadata', { strategy: 'crypto_services' });

  const totalAmount = (transactions || []).reduce((sum: number, t: any) => sum + Number(t.amount), 0);
  const peakTransaction = transactions?.length > 0 
    ? Math.max(...transactions.map((t: any) => Number(t.amount)))
    : 0;

  return {
    name: 'Crypto Services',
    strategy: 'crypto_services',
    amount: totalAmount,
    count: transactions?.length || 0,
    peak: peakTransaction
  };
}

// Aggregate REAL data monetization
async function aggregateRealDataMonetization(supabase: any, executionId: string) {
  const { data: transactions } = await supabase
    .from('autonomous_revenue_transactions')
    .select('*')
    .eq('status', 'completed')
    .contains('metadata', { strategy: 'data_monetization' });

  const totalAmount = (transactions || []).reduce((sum: number, t: any) => sum + Number(t.amount), 0);
  const peakTransaction = transactions?.length > 0 
    ? Math.max(...transactions.map((t: any) => Number(t.amount)))
    : 0;

  return {
    name: 'Data Monetization',
    strategy: 'data_monetization',
    amount: totalAmount,
    count: transactions?.length || 0,
    peak: peakTransaction
  };
}
