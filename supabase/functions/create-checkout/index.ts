import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Product configuration - Real Stripe products
const PRODUCTS = {
  basic: {
    price_id: "price_1Ssy0BDWu650RN3omhx7HeqZ",
    product_id: "prod_TqfKoPz08dVxAX",
    name: "AI Content API - Basic",
    price: 29.99
  },
  pro: {
    price_id: "price_1Ssy0WDWu650RN3ou9QNZrJj",
    product_id: "prod_TqfLOoaEVt0lLx",
    name: "AI Content API - Pro",
    price: 99.99
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const { plan = 'basic' } = await req.json().catch(() => ({}));
    const product = PRODUCTS[plan as keyof typeof PRODUCTS] || PRODUCTS.basic;

    // Get user if authenticated
    const authHeader = req.headers.get("Authorization");
    let userEmail: string | undefined;
    let customerId: string | undefined;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabaseClient.auth.getUser(token);
      userEmail = data.user?.email || undefined;
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check for existing customer
    if (userEmail) {
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    const origin = req.headers.get("origin") || "https://revenue-growth-hivemind.lovable.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      line_items: [
        {
          price: product.price_id,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/?payment=success&plan=${plan}`,
      cancel_url: `${origin}/?payment=cancelled`,
      metadata: {
        plan,
        product_name: product.name
      }
    });

    console.log(`Checkout session created: ${session.id} for ${product.name}`);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
