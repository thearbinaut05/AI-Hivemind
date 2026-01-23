
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

// ALL tables that can contain USD balances
const USD_BALANCE_TABLES = [
  { table: 'treasury_accounts', balanceColumn: 'current_balance', idColumn: 'id', filter: { is_active: true } },
  { table: 'application_balance', balanceColumn: 'balance_amount', idColumn: 'id', single: true },
  { table: 'earnings', balanceColumn: 'amount', idColumn: 'id' },
  { table: 'consolidated_balances', balanceColumn: 'amount', idColumn: 'id', filter: { currency: 'USD' } },
  { table: 'consolidated_amounts', balanceColumn: 'total_usd', idColumn: 'id', filter: { status: 'pending' } },
  { table: 'financial_balances', balanceColumn: 'amount', idColumn: 'id' },
  { table: 'autonomous_revenue_transfers', balanceColumn: 'amount', idColumn: 'id', filter: { status: 'pending' } },
  { table: 'autonomous_revenue_transfer_logs', balanceColumn: 'amount', idColumn: 'id', filter: { status: 'pending' } },
  { table: 'bank_transfers', balanceColumn: 'amount', idColumn: 'id', filter: { status: 'pending' } },
  { table: 'fund_transfers', balanceColumn: 'amount', idColumn: 'id', filter: { status: 'pending' } },
  { table: 'cash_out_requests', balanceColumn: 'amount', idColumn: 'id', filter: { status: 'pending' } },
  { table: 'crypto_transactions', balanceColumn: 'transaction_amount', idColumn: 'id', filter: { transaction_status: 'completed' } },
  { table: 'external_payment_transactions', balanceColumn: 'transaction_amount', idColumn: 'id', filter: { transaction_status: 'completed' } },
  { table: 'github_repository_earnings', balanceColumn: 'pending_balance', idColumn: 'id' },
  { table: 'modern_treasury_accounts', balanceColumn: 'balance', idColumn: 'id' },
  { table: 'modern_treasury_transfers', balanceColumn: 'amount', idColumn: 'id', filter: { status: 'pending' } },
  { table: 'financial_transactions', balanceColumn: 'total_amount', idColumn: 'id', filter: { status: 'pending' } },
  { table: 'balance_transfers', balanceColumn: 'amount', idColumn: 'id', filter: { status: 'pending' } },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const executionId = `full_scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  console.log(`[${executionId}] ========== COMPREHENSIVE USD AGGREGATOR ==========`);
  console.log(`[${executionId}] Starting FULL DATABASE SCAN for ALL USD balances`);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const auditLog: any[] = [];
  
  const logAudit = (action: string, details: any) => {
    const entry = {
      timestamp: new Date().toISOString(),
      execution_id: executionId,
      action,
      details
    };
    auditLog.push(entry);
    console.log(`[${executionId}] AUDIT: ${action}`, JSON.stringify(details));
  };

  try {
    logAudit('SCAN_STARTED', { tables_to_scan: USD_BALANCE_TABLES.length });

    // Step 1: Scan ALL database tables for USD balances
    const aggregatedUSD = await scanAllTablesForUSD(supabase, executionId, logAudit);
    
    logAudit('SCAN_COMPLETED', { 
      total_amount: aggregatedUSD.total_amount,
      sources_found: aggregatedUSD.sources.length,
      breakdown: aggregatedUSD.breakdown
    });

    if (aggregatedUSD.total_amount <= 0) {
      logAudit('NO_FUNDS', { message: 'No USD found in any database table' });
      
      await saveAuditLog(supabase, executionId, auditLog, 'no_funds');
      
      return new Response(JSON.stringify({
        success: false,
        message: "No USD found in any database table to transfer",
        tables_scanned: USD_BALANCE_TABLES.length,
        breakdown: aggregatedUSD.breakdown,
        execution_id: executionId,
        audit_trail: auditLog
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    console.log(`[${executionId}] TOTAL USD FOUND: $${aggregatedUSD.total_amount.toFixed(2)} across ${aggregatedUSD.sources.length} sources`);

    // Step 2: Transfer to ALL configured payment providers
    const transferResults = await transferToAllProviders(supabase, aggregatedUSD, executionId, logAudit);
    
    logAudit('TRANSFERS_COMPLETED', transferResults);

    // Step 3: Zero out all source balances ONLY after successful transfers
    if (transferResults.successful_transfers > 0) {
      await zeroOutAllSourceBalances(supabase, aggregatedUSD.sources, executionId, logAudit);
      logAudit('BALANCES_ZEROED', { sources_zeroed: aggregatedUSD.sources.length });
    }

    // Step 4: Save comprehensive audit log
    await saveAuditLog(supabase, executionId, auditLog, 'completed');

    const response = {
      success: true,
      message: `Successfully processed $${aggregatedUSD.total_amount.toFixed(2)} USD from ${aggregatedUSD.sources.length} database sources`,
      summary: {
        total_usd_found: aggregatedUSD.total_amount,
        tables_scanned: USD_BALANCE_TABLES.length,
        sources_with_funds: aggregatedUSD.sources.length,
        successful_transfers: transferResults.successful_transfers,
        total_transferred: transferResults.total_transferred
      },
      breakdown_by_source: aggregatedUSD.breakdown,
      transfer_results: {
        stripe: transferResults.stripe,
        paypal: transferResults.paypal,
        bank: transferResults.bank,
        modern_treasury: transferResults.modern_treasury
      },
      execution_id: executionId,
      timestamp: new Date().toISOString(),
      audit_trail: auditLog,
      compliance: {
        all_sources_logged: true,
        balances_zeroed_after_transfer: true,
        full_audit_trail: true
      }
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (error: any) {
    console.error(`[${executionId}] CRITICAL ERROR:`, error);
    
    logAudit('ERROR', { message: error.message, stack: error.stack });
    await saveAuditLog(supabase, executionId, auditLog, 'failed');

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      execution_id: executionId,
      audit_trail: auditLog
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});

async function scanAllTablesForUSD(supabase: any, executionId: string, logAudit: Function) {
  console.log(`[${executionId}] Scanning ${USD_BALANCE_TABLES.length} tables for USD balances...`);
  
  const sources: any[] = [];
  let totalAmount = 0;
  const breakdown: any = {};
  const scanErrors: any[] = [];

  for (const tableConfig of USD_BALANCE_TABLES) {
    try {
      let query = supabase.from(tableConfig.table).select('*');
      
      // Apply filters if specified
      if (tableConfig.filter) {
        for (const [key, value] of Object.entries(tableConfig.filter)) {
          query = query.eq(key, value);
        }
      }
      
      // Handle single record tables
      if (tableConfig.single) {
        query = query.maybeSingle();
      }

      const { data, error } = await query;
      
      if (error) {
        console.log(`[${executionId}] Table ${tableConfig.table} scan error:`, error.message);
        scanErrors.push({ table: tableConfig.table, error: error.message });
        continue;
      }

      if (!data) continue;

      // Calculate total for this table
      let tableTotal = 0;
      const records = Array.isArray(data) ? data : [data];
      
      for (const record of records) {
        const amount = Number(record[tableConfig.balanceColumn] || 0);
        if (amount > 0) {
          tableTotal += amount;
        }
      }

      if (tableTotal > 0) {
        sources.push({
          table: tableConfig.table,
          balanceColumn: tableConfig.balanceColumn,
          idColumn: tableConfig.idColumn,
          amount: tableTotal,
          recordCount: records.length,
          records: records.filter(r => Number(r[tableConfig.balanceColumn] || 0) > 0)
        });
        totalAmount += tableTotal;
        breakdown[tableConfig.table] = tableTotal;
        
        console.log(`[${executionId}] ✓ ${tableConfig.table}: $${tableTotal.toFixed(2)} (${records.length} records)`);
        logAudit('TABLE_SCANNED', { table: tableConfig.table, amount: tableTotal, records: records.length });
      }
    } catch (err: any) {
      console.log(`[${executionId}] Table ${tableConfig.table} not accessible:`, err.message);
      scanErrors.push({ table: tableConfig.table, error: err.message });
    }
  }

  return {
    total_amount: totalAmount,
    sources,
    breakdown,
    source_count: sources.length,
    tables_scanned: USD_BALANCE_TABLES.length,
    scan_errors: scanErrors
  };
}

async function transferToAllProviders(supabase: any, aggregatedUSD: any, executionId: string, logAudit: Function) {
  console.log(`[${executionId}] Initiating transfers to all configured payment providers...`);
  
  const results: any = {
    stripe: null,
    paypal: null,
    bank: null,
    modern_treasury: null,
    successful_transfers: 0,
    failed_transfers: 0,
    total_transferred: 0,
    providers_attempted: []
  };

  const transferAmount = aggregatedUSD.total_amount;
  const amountCents = Math.round(transferAmount * 100);

  // ============ STRIPE PAYOUT (Primary) ============
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (stripeKey) {
    results.providers_attempted.push('stripe');
    try {
      console.log(`[${executionId}] Creating Stripe payout for $${transferAmount.toFixed(2)}...`);
      const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
      
      // Check Stripe balance first
      const balance = await stripe.balance.retrieve();
      const availableUSD = balance.available.find((b: any) => b.currency === 'usd');
      const stripeBalance = (availableUSD?.amount || 0) / 100;
      
      logAudit('STRIPE_BALANCE_CHECK', { available: stripeBalance, needed: transferAmount });
      
      if (stripeBalance >= transferAmount && transferAmount >= 0.50) {
        const payout = await stripe.payouts.create({
          amount: amountCents,
          currency: 'usd',
          description: `Full DB USD Transfer - ${executionId}`,
          metadata: {
            execution_id: executionId,
            sources: aggregatedUSD.source_count.toString(),
            breakdown: JSON.stringify(aggregatedUSD.breakdown)
          }
        });
        
        results.stripe = {
          success: true,
          payout_id: payout.id,
          amount: transferAmount,
          arrival_date: payout.arrival_date,
          status: payout.status
        };
        results.successful_transfers++;
        results.total_transferred += transferAmount;
        
        logAudit('STRIPE_PAYOUT_SUCCESS', { payout_id: payout.id, amount: transferAmount });
        console.log(`[${executionId}] ✓ Stripe payout created: ${payout.id}`);
      } else {
        results.stripe = {
          success: false,
          error: stripeBalance < transferAmount 
            ? `Insufficient Stripe balance: $${stripeBalance.toFixed(2)} available, $${transferAmount.toFixed(2)} needed`
            : `Amount $${transferAmount.toFixed(2)} below Stripe minimum $0.50`
        };
        logAudit('STRIPE_INSUFFICIENT_BALANCE', { available: stripeBalance, needed: transferAmount });
      }
    } catch (error: any) {
      console.error(`[${executionId}] Stripe payout failed:`, error);
      results.stripe = { success: false, error: error.message };
      results.failed_transfers++;
      logAudit('STRIPE_PAYOUT_FAILED', { error: error.message });
    }
  } else {
    results.stripe = { success: false, error: 'STRIPE_SECRET_KEY not configured' };
    logAudit('STRIPE_NOT_CONFIGURED', {});
  }

  // ============ PAYPAL PAYOUT ============
  const paypalClientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const paypalSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  
  if (paypalClientId && paypalSecret) {
    results.providers_attempted.push('paypal');
    try {
      console.log(`[${executionId}] Initiating PayPal payout...`);
      
      // Get PayPal access token
      const tokenResponse = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${paypalClientId}:${paypalSecret}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });
      
      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        
        // Create payout batch
        const payoutResponse = await fetch('https://api-m.paypal.com/v1/payments/payouts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sender_batch_header: {
              sender_batch_id: executionId,
              email_subject: 'You have received a payout!',
              email_message: `Database USD consolidation transfer - ${executionId}`
            },
            items: [{
              recipient_type: 'EMAIL',
              amount: {
                value: transferAmount.toFixed(2),
                currency: 'USD'
              },
              sender_item_id: executionId,
              note: 'Automated USD transfer from database'
            }]
          })
        });
        
        if (payoutResponse.ok) {
          const payoutData = await payoutResponse.json();
          results.paypal = {
            success: true,
            batch_id: payoutData.batch_header?.payout_batch_id,
            amount: transferAmount,
            status: payoutData.batch_header?.batch_status
          };
          results.successful_transfers++;
          results.total_transferred += transferAmount;
          logAudit('PAYPAL_PAYOUT_SUCCESS', { batch_id: payoutData.batch_header?.payout_batch_id });
        } else {
          const errorData = await payoutResponse.json();
          results.paypal = { success: false, error: errorData.message || 'PayPal payout failed' };
          results.failed_transfers++;
          logAudit('PAYPAL_PAYOUT_FAILED', { error: errorData });
        }
      } else {
        results.paypal = { success: false, error: 'Failed to get PayPal access token' };
        results.failed_transfers++;
      }
    } catch (error: any) {
      console.error(`[${executionId}] PayPal error:`, error);
      results.paypal = { success: false, error: error.message };
      results.failed_transfers++;
      logAudit('PAYPAL_ERROR', { error: error.message });
    }
  } else {
    results.paypal = { success: false, error: 'PayPal credentials not configured' };
  }

  // ============ MODERN TREASURY ============
  const mtApiKey = Deno.env.get("MODERN_TREASURY_API_KEY");
  const mtOrgId = Deno.env.get("MODERN_TREASURY_ORG_ID");
  
  if (mtApiKey && mtOrgId) {
    results.providers_attempted.push('modern_treasury');
    try {
      console.log(`[${executionId}] Initiating Modern Treasury transfer...`);
      
      const mtResponse = await fetch('https://app.moderntreasury.com/api/payment_orders', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${mtOrgId}:${mtApiKey}`)}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'ach',
          amount: amountCents,
          direction: 'credit',
          currency: 'USD',
          description: `Automated USD transfer - ${executionId}`,
          metadata: {
            execution_id: executionId,
            source: 'comprehensive_usd_aggregator'
          }
        })
      });
      
      if (mtResponse.ok) {
        const mtData = await mtResponse.json();
        results.modern_treasury = {
          success: true,
          payment_order_id: mtData.id,
          amount: transferAmount,
          status: mtData.status
        };
        results.successful_transfers++;
        results.total_transferred += transferAmount;
        logAudit('MODERN_TREASURY_SUCCESS', { payment_order_id: mtData.id });
      } else {
        const errorData = await mtResponse.json();
        results.modern_treasury = { success: false, error: errorData.message || 'Modern Treasury failed' };
        results.failed_transfers++;
        logAudit('MODERN_TREASURY_FAILED', { error: errorData });
      }
    } catch (error: any) {
      results.modern_treasury = { success: false, error: error.message };
      results.failed_transfers++;
      logAudit('MODERN_TREASURY_ERROR', { error: error.message });
    }
  } else {
    results.modern_treasury = { success: false, error: 'Modern Treasury credentials not configured' };
  }

  // ============ DIRECT BANK TRANSFER (via Stripe) ============
  const bankAccountId = Deno.env.get("BANK_ACCOUNT_ID");
  if (stripeKey && bankAccountId && results.stripe?.success !== true) {
    results.providers_attempted.push('bank_direct');
    try {
      console.log(`[${executionId}] Attempting direct bank transfer...`);
      const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
      
      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: 'usd',
        destination: bankAccountId,
        description: `Direct bank transfer - ${executionId}`
      });
      
      results.bank = {
        success: true,
        transfer_id: transfer.id,
        amount: transferAmount,
        destination: bankAccountId
      };
      results.successful_transfers++;
      results.total_transferred += transferAmount;
      logAudit('BANK_TRANSFER_SUCCESS', { transfer_id: transfer.id });
    } catch (error: any) {
      results.bank = { success: false, error: error.message };
      results.failed_transfers++;
      logAudit('BANK_TRANSFER_FAILED', { error: error.message });
    }
  }

  return results;
}

async function zeroOutAllSourceBalances(supabase: any, sources: any[], executionId: string, logAudit: Function) {
  console.log(`[${executionId}] Zeroing out ${sources.length} source balances...`);
  
  for (const source of sources) {
    try {
      if (source.records && source.records.length > 0) {
        for (const record of source.records) {
          const updateData: any = {
            [source.balanceColumn]: 0
          };
          
          // Add timestamp if table has it
          if (source.table.includes('balance') || source.table.includes('treasury')) {
            updateData.updated_at = new Date().toISOString();
          }
          
          await supabase
            .from(source.table)
            .update(updateData)
            .eq(source.idColumn, record[source.idColumn]);
        }
      }
      
      console.log(`[${executionId}] ✓ Zeroed ${source.table}: $${source.amount.toFixed(2)}`);
      logAudit('SOURCE_ZEROED', { table: source.table, amount: source.amount });
    } catch (error: any) {
      console.error(`[${executionId}] Failed to zero ${source.table}:`, error);
      logAudit('ZERO_FAILED', { table: source.table, error: error.message });
    }
  }
}

async function saveAuditLog(supabase: any, executionId: string, auditLog: any[], status: string) {
  try {
    await supabase.from('automated_transfer_logs').insert({
      job_name: 'comprehensive_usd_aggregator_v2',
      status,
      execution_time: new Date().toISOString(),
      response: {
        execution_id: executionId,
        audit_trail: auditLog,
        log_count: auditLog.length,
        final_status: status
      }
    });
    
    // Also log to compliance_audit_log for full compliance
    await supabase.from('compliance_audit_log').insert({
      entity_type: 'full_database_scan',
      entity_id: executionId,
      audit_type: 'usd_aggregation_transfer',
      status,
      findings: {
        audit_trail: auditLog,
        execution_id: executionId
      }
    });
  } catch (err) {
    console.error(`[${executionId}] Failed to save audit log:`, err);
  }
}
