import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Real AI-powered content generation API that generates revenue
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const executionId = crypto.randomUUID();
  console.log(`[${executionId}] AI Content API request received`);

  try {
    const { prompt, type = 'content', api_key } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate API key or check for authenticated user
    const authHeader = req.headers.get("Authorization");
    const customApiKey = req.headers.get("x-api-key") || api_key;
    
    let userId: string | null = null;
    let isValidRequest = false;

    // Check custom API key
    if (customApiKey) {
      const { data: keyData } = await supabase
        .from('api_keys')
        .select('user_id, is_active, usage_count, usage_limit')
        .eq('key_hash', customApiKey)
        .eq('is_active', true)
        .single();

      if (keyData) {
        if (keyData.usage_limit && keyData.usage_count >= keyData.usage_limit) {
          return new Response(JSON.stringify({ error: 'API key usage limit exceeded' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        userId = keyData.user_id;
        isValidRequest = true;
        
        // Increment usage count
        await supabase
          .from('api_keys')
          .update({ usage_count: keyData.usage_count + 1, last_used_at: new Date().toISOString() })
          .eq('key_hash', customApiKey);
      }
    }

    // Check auth token
    if (!isValidRequest && authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabase.auth.getUser(token);
      if (userData?.user) {
        userId = userData.user.id;
        isValidRequest = true;
      }
    }

    // For public API access, charge per request
    const chargeAmount = isValidRequest ? 0.05 : 0.10; // $0.05 for authenticated, $0.10 for anonymous
    
    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompts: Record<string, string> = {
      content: "You are a professional content writer. Create high-quality, engaging content based on the user's request.",
      seo: "You are an SEO expert. Generate SEO-optimized content with proper keywords, meta descriptions, and structure.",
      marketing: "You are a marketing copywriter. Create compelling marketing copy that drives conversions.",
      code: "You are an expert programmer. Generate clean, well-documented code based on the requirements.",
      analysis: "You are a business analyst. Provide detailed analysis and insights based on the given information."
    };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompts[type] || systemPrompts.content },
          { role: "user", content: prompt }
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${executionId}] AI Gateway error:`, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service payment required. Please contact support." }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const generatedContent = aiResult.choices?.[0]?.message?.content || "";

    // Log the revenue-generating transaction
    await supabase.from('earnings').insert({
      amount: chargeAmount,
      source: 'ai_content_api',
      description: `AI Content API request - ${type}`,
      user_id: userId,
      metadata: {
        execution_id: executionId,
        prompt_length: prompt.length,
        response_length: generatedContent.length,
        content_type: type,
        authenticated: isValidRequest
      }
    });

    // Update revenue metrics
    const today = new Date().toISOString().split('T')[0];
    const { data: existingMetric } = await supabase
      .from('autonomous_revenue_metrics')
      .select('*')
      .eq('metric_date', today)
      .single();

    if (existingMetric) {
      await supabase
        .from('autonomous_revenue_metrics')
        .update({
          total_revenue: existingMetric.total_revenue + chargeAmount,
          successful_transfers: existingMetric.successful_transfers + 1,
          revenue_by_source: {
            ...existingMetric.revenue_by_source,
            ai_content_api: (existingMetric.revenue_by_source?.ai_content_api || 0) + chargeAmount
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', existingMetric.id);
    } else {
      await supabase.from('autonomous_revenue_metrics').insert({
        metric_date: today,
        total_revenue: chargeAmount,
        successful_transfers: 1,
        failed_transfers: 0,
        revenue_by_source: { ai_content_api: chargeAmount },
        revenue_by_category: { api: chargeAmount }
      });
    }

    console.log(`[${executionId}] ✓ AI content generated, revenue: $${chargeAmount.toFixed(2)}`);

    return new Response(JSON.stringify({
      success: true,
      content: generatedContent,
      usage: {
        prompt_tokens: prompt.length,
        completion_tokens: generatedContent.length,
        total_cost: chargeAmount
      },
      execution_id: executionId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`[${executionId}] Error:`, error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      execution_id: executionId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
