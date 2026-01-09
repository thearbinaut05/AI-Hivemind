import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.headers.get("content-type") !== "application/json") {
    return new Response(JSON.stringify({
      success: false,
      error: "Content-Type must be application/json"
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.json();

    if (typeof body !== "object" || body === null) {
      throw new Error("Invalid JSON body");
    }

    const { action, amount } = body as { action?: string; amount?: unknown };

    if (typeof action !== "string") {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing or invalid action parameter",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (action === "add_real_money") {
      // Validate amount is a positive number
      let moneyToAdd = 10000;
      if (typeof amount === "number" && amount > 0 && Number.isFinite(amount)) {
        moneyToAdd = amount;
      }
      await addRealMoneyToTreasury(supabase, moneyToAdd);
    } else if (action === "consolidate_all") {
      await consolidateAllMoneyToTreasury(supabase);
    } else if (action === "get_balance") {
      const balance = await getRealTreasuryBalance(supabase);
      return new Response(
        JSON.stringify({
          success: true,
          balance,
          message: `You have $${balance.toFixed(2)} in real accessible funds`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid action parameter",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Treasury operation completed successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Treasury manager error:", error);
    const message =
      error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
        : "Unknown error occurred";

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

async function addRealMoneyToTreasury(supabase: any, amount: number) {
  // Ensure treasury account exists
  const { data: treasury, error } = await supabase
    .from("treasury_accounts")
    .select("*")
    .eq("account_type", "operating")
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch treasury account: ${error.message}`);

  let treasuryAccount = treasury;

  const now = new Date().toISOString();

  if (!treasuryAccount) {
    // Create new treasury account with the initial amount
    const insertResult = await supabase
      .from("treasury_accounts")
      .insert({
        account_name: "Main Operating Treasury",
        account_type: "operating",
        currency: "USD",
        current_balance: amount,
        available_balance: amount,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertResult.error)
      throw new Error(`Failed to create treasury account: ${insertResult.error.message}`);

    treasuryAccount = insertResult.data;
  } else {
    // Update existing treasury account balances
    const updateResult = await supabase
      .from("treasury_accounts")
      .update({
        current_balance: Number(treasuryAccount.current_balance) + amount,
        available_balance: Number(treasuryAccount.available_balance) + amount,
        updated_at: now,
      })
      .eq("id", treasuryAccount.id);

    if (updateResult.error) throw new Error(`Failed to update treasury account: ${updateResult.error.message}`);
  }

  // Log the addition as a movement
  const logResult = await supabase.from("treasury_movements").insert({
    treasury_account_id: treasuryAccount.id,
    movement_type: "deposit",
    amount,
    source_type: "real_money_addition",
    status: "completed",
    description: `Real money added to treasury: $${amount.toFixed(2)}`,
    created_at: now,
    updated_at: now,
  });

  if (logResult.error) throw new Error(`Failed to log treasury movement: ${logResult.error.message}`);
}

async function consolidateAllMoneyToTreasury(supabase: any) {
  let totalToConsolidate = 0;
  const now = new Date().toISOString();

  // Fetch application balance (assumed single row)
  const appBalanceResult = await supabase.from("application_balance").select("*").maybeSingle();

  if (appBalanceResult.error)
    throw new Error(`Failed to retrieve application balance: ${appBalanceResult.error.message}`);

  const appBalance = appBalanceResult.data;

  if (appBalance?.balance_amount && Number(appBalance.balance_amount) > 0) {
    totalToConsolidate += Number(appBalance.balance_amount);

    // Reset application balance to zero
    const zeroOutResult = await supabase
      .from("application_balance")
      .update({ balance_amount: 0, updated_at: now })
      .eq("id", appBalance.id);

    if (zeroOutResult.error)
      throw new Error(`Failed to zero out application balance: ${zeroOutResult.error.message}`);
  }

  // Fetch all earnings
  const earningsResult = await supabase.from("earnings").select("*");

  if (earningsResult.error) throw new Error(`Failed to retrieve earnings: ${earningsResult.error.message}`);

  const earnings = earningsResult.data;

  if (earnings?.length > 0) {
    const earningsTotal = earnings.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
    totalToConsolidate += earningsTotal;

    // Mark earnings as consolidated by deleting them
    const earningsIds = earnings.map((e) => e.id);
    if (earningsIds.length > 0) {
      const deleteResult = await supabase.from("earnings").delete().in("id", earningsIds);

      if (deleteResult.error)
        throw new Error(`Failed to delete consolidated earnings: ${deleteResult.error.message}`);
    }
  }

  if (totalToConsolidate > 0) {
    await addRealMoneyToTreasury(supabase, totalToConsolidate);
  }
}

async function getRealTreasuryBalance(supabase: any): Promise<number> {
  const { data: treasuryAccounts, error } = await supabase
    .from("treasury_accounts")
    .select("available_balance")
    .eq("is_active", true);

  if (error) throw new Error(`Failed to fetch treasury accounts: ${error.message}`);

  if (!treasuryAccounts?.length) {
    return 0;
  }

  return treasuryAccounts.reduce((sum: number, acc: any) => sum + Number(acc.available_balance || 0), 0);
}