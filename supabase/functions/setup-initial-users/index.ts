import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log('Starting user setup...');
    
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const users = [
      {
        email: 'admin@sonomicro.com',
        password: 'demo123',
        name: 'Admin Boss',
        role: 'admin'
      },
      {
        email: 'ol@gos.com',
        password: 'gos123',
        name: 'Ölgerðin',
        role: 'tenant',
        company: 'Ölgerðin Corporation',
        phone: '+354-123-4567',
        address: 'Reykjavik, Iceland',
        plan: 'professional'
      },
      {
        email: 'test@dog.com',
        password: 'dog123',
        name: 'Testing Dog',
        role: 'tenant',
        company: 'Dog Testing Inc',
        phone: '+1-555-0123',
        address: 'San Francisco, CA',
        plan: 'basic'
      }
    ];

    const results = [];

    for (const user of users) {
      console.log(`Creating user: ${user.email}`);

      // Create Supabase Auth user using admin API
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          name: user.name,
          role: user.role
        }
      });

      if (authError || !authData.user) {
        console.error(`Failed to create auth user ${user.email}:`, authError);
        results.push({ email: user.email, success: false, error: authError?.message || 'Unknown error' });
        continue;
      }

      console.log(`Auth user created for ${user.email}, ID: ${authData.user.id}`);

      // Create corresponding database record
      if (user.role === 'admin') {
        const { error: dbError } = await supabaseAdmin
          .from('admins')
          .insert({
            email: user.email,
            password_hash: 'supabase_auth_managed',
            name: user.name,
            user_id: authData.user.id
          });

        if (dbError) {
          console.error(`Failed to create admin record for ${user.email}:`, dbError);
          results.push({ email: user.email, success: false, error: dbError.message });
          continue;
        }
      } else {
        const { error: dbError } = await supabaseAdmin
          .from('tenants')
          .insert({
            email: user.email,
            password_hash: 'supabase_auth_managed',
            name: user.name,
            company: user.company || 'Company',
            phone: user.phone || null,
            address: user.address || null,
            plan: user.plan || 'basic',
            status: 'active',
            user_id: authData.user.id
          });

        if (dbError) {
          console.error(`Failed to create tenant record for ${user.email}:`, dbError);
          results.push({ email: user.email, success: false, error: dbError.message });
          continue;
        }
      }

      console.log(`Successfully created complete user record for: ${user.email}`);
      results.push({ email: user.email, success: true, auth_id: authData.user.id });
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'User setup complete',
        results: results
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Error in setup-initial-users function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});