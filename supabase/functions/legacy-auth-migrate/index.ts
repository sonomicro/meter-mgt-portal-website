import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MigrationRequest {
  email: string;
  password: string;
  role: "admin" | "tenant";
  user_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { 
        status: 405, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const apiKeyHeader = req.headers.get("apikey");
    
    if (!authHeader && !apiKeyHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { email, password, role, user_id }: MigrationRequest = await req.json();

    if (!email || !password || !role || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log(`Migrating ${role} user: ${email}`);

    const tableName = role === "admin" ? "admins" : "tenants";
    
    const { data: userData, error: userError } = await supabaseAdmin
      .from(tableName)
      .select("*")
      .eq("id", user_id)
      .is("user_id", null)
      .maybeSingle();

    if (userError || !userData) {
      console.error("User not found or already migrated:", userError);
      return new Response(
        JSON.stringify({ error: "User not found or already migrated" }),
        { 
          status: 404, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log("Creating Supabase Auth user...");
    const { data: authData, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        name: userData.name,
        role: role
      }
    });

    if (signUpError || !authData.user) {
      console.error("Failed to create auth user:", signUpError);
      return new Response(
        JSON.stringify({ error: "Migration failed", details: signUpError?.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log("Linking auth user to existing record...");
    const { error: updateError } = await supabaseAdmin
      .from(tableName)
      .update({
        user_id: authData.user.id,
        last_login: new Date().toISOString()
      })
      .eq("id", user_id);

    if (updateError) {
      console.error("Failed to link user:", updateError);
      return new Response(
        JSON.stringify({ error: "Migration failed", details: updateError.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log("User migrated successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "User migrated successfully",
        migrated: true
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Error in legacy-auth-migrate function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});