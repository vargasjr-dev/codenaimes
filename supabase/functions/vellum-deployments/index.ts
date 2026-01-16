import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's Vellum API key from profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("vellum_api_key")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.vellum_api_key) {
      return new Response(JSON.stringify({ 
        error: "No Vellum API key configured in profile",
        deployments: [] 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch workflow deployments from Vellum
    const vellumResponse = await fetch("https://api.vellum.ai/v1/workflow-deployments?status=ACTIVE&limit=100", {
      method: "GET",
      headers: {
        "X-API-KEY": profile.vellum_api_key,
        "Content-Type": "application/json",
      },
    });

    if (!vellumResponse.ok) {
      const errorText = await vellumResponse.text();
      console.error("Vellum API error:", vellumResponse.status, errorText);
      return new Response(JSON.stringify({ 
        error: "Failed to fetch deployments from Vellum",
        deployments: [] 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vellumData = await vellumResponse.json();
    
    // Filter for workflow deployments (all active ones for now - can filter by interface later if needed)
    const deployments = (vellumData.results || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      label: d.label,
      description: d.description,
      created: d.created,
    }));

    return new Response(JSON.stringify({ deployments }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage, deployments: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
