import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const NOTEHUB_BASE_URL = "https://api.notefile.net";
const NOTEHUB_AUTH_TOKEN = Deno.env.get("NOTEHUB_AUTH_TOKEN");
const NOTEHUB_PROJECT_UID = Deno.env.get("NOTEHUB_PROJECT_UID");

interface TenantSyncPayload {
  tenant_id: string;
  operation: "create" | "update" | "delete";
  company_name: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (!NOTEHUB_AUTH_TOKEN) {
    console.error("NOTEHUB_AUTH_TOKEN not configured");
    return new Response(
      JSON.stringify({ error: "Notehub auth token not configured" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  if (!NOTEHUB_PROJECT_UID) {
    console.error("NOTEHUB_PROJECT_UID not configured");
    return new Response(
      JSON.stringify({ error: "Notehub project UID not configured" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload: TenantSyncPayload = await req.json();
    console.log("Tenant sync request:", payload);

    const { tenant_id, operation, company_name } = payload;

    if (operation === "create" || operation === "update") {
      const fleetUrl = `${NOTEHUB_BASE_URL}/v1/projects/${NOTEHUB_PROJECT_UID}/fleets`;
      
      const { data: tenant } = await supabaseClient
        .from("tenants")
        .select("notehub_fleet_uid")
        .eq("id", tenant_id)
        .single();

      if (operation === "create" || !tenant?.notehub_fleet_uid) {
        console.log(`Creating fleet "${company_name}" in Notehub...`);
        
        const response = await fetch(fleetUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${NOTEHUB_AUTH_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ label: company_name }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Failed to create fleet:", errorText);
          throw new Error(`Failed to create fleet: ${response.status} ${errorText}`);
        }

        const fleetData = await response.json();
        console.log("Fleet created:", fleetData);

        await supabaseClient
          .from("tenants")
          .update({ notehub_fleet_uid: fleetData.uid })
          .eq("id", tenant_id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            fleet_uid: fleetData.uid,
            operation: "created" 
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      } else if (operation === "update" && tenant.notehub_fleet_uid) {
        console.log(`Updating fleet "${company_name}" in Notehub...`);
        
        const updateUrl = `${NOTEHUB_BASE_URL}/v1/projects/${NOTEHUB_PROJECT_UID}/fleets/${tenant.notehub_fleet_uid}`;
        const response = await fetch(updateUrl, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${NOTEHUB_AUTH_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ label: company_name }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Failed to update fleet:", errorText);
          throw new Error(`Failed to update fleet: ${response.status} ${errorText}`);
        }

        console.log("Fleet updated successfully");

        return new Response(
          JSON.stringify({ 
            success: true, 
            fleet_uid: tenant.notehub_fleet_uid,
            operation: "updated" 
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
    } else if (operation === "delete") {
      console.log("Note: Notehub does not support fleet deletion. Fleet will remain in Notehub.");
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Tenant deleted from Supabase. Fleet remains in Notehub (manual cleanup required)."
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid operation" }),
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Tenant sync error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
