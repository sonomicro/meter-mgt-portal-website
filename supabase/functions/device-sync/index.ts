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

interface DeviceSyncPayload {
  device_id: string;
  notehub_device_uid: string;
  operation: "create" | "update" | "delete";
  tenant_id?: string;
  fleet_group_id?: string;
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

    const payload: DeviceSyncPayload = await req.json();
    console.log("Device sync request:", payload);

    const { device_id, notehub_device_uid, operation, tenant_id } = payload;

    if (operation === "create" || operation === "update") {
      if (!tenant_id) {
        console.log("No tenant_id provided, skipping fleet assignment");
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Device has no tenant, skipping Notehub sync" 
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }

      const { data: tenant } = await supabaseClient
        .from("tenants")
        .select("notehub_fleet_uid, company")
        .eq("id", tenant_id)
        .single();

      if (!tenant) {
        throw new Error(`Tenant ${tenant_id} not found`);
      }

      let fleetUid = tenant.notehub_fleet_uid;

      if (!fleetUid) {
        console.log(`Creating fleet for tenant "${tenant.company}"...`);
        const fleetUrl = `${NOTEHUB_BASE_URL}/v1/projects/${NOTEHUB_PROJECT_UID}/fleets`;
        
        const fleetResponse = await fetch(fleetUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${NOTEHUB_AUTH_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ label: tenant.company }),
        });

        if (!fleetResponse.ok) {
          const errorText = await fleetResponse.text();
          throw new Error(`Failed to create fleet: ${fleetResponse.status} ${errorText}`);
        }

        const fleetData = await fleetResponse.json();
        fleetUid = fleetData.uid;

        await supabaseClient
          .from("tenants")
          .update({ notehub_fleet_uid: fleetUid })
          .eq("id", tenant_id);
      }

      console.log(`Assigning device ${notehub_device_uid} to fleet ${fleetUid}...`);
      
      const deviceUrl = `${NOTEHUB_BASE_URL}/v1/projects/${NOTEHUB_PROJECT_UID}/devices/${encodeURIComponent(notehub_device_uid)}`;
      
      const deviceResponse = await fetch(deviceUrl, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${NOTEHUB_AUTH_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fleet_uids: [fleetUid] }),
      });

      if (!deviceResponse.ok) {
        const errorText = await deviceResponse.text();
        if (deviceResponse.status === 404) {
          console.log("Device not found in Notehub, it may not be connected yet");
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: "Device not yet in Notehub, will sync when it connects" 
            }),
            { 
              status: 200, 
              headers: { ...corsHeaders, "Content-Type": "application/json" } 
            }
          );
        }
        throw new Error(`Failed to update device: ${deviceResponse.status} ${errorText}`);
      }

      console.log("Device assigned to fleet successfully");

      return new Response(
        JSON.stringify({ 
          success: true, 
          fleet_uid: fleetUid,
          operation: operation === "create" ? "created" : "updated"
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );

    } else if (operation === "delete") {
      console.log(`Removing device ${notehub_device_uid} from Notehub...`);
      
      const deviceUrl = `${NOTEHUB_BASE_URL}/v1/projects/${NOTEHUB_PROJECT_UID}/devices/${encodeURIComponent(notehub_device_uid)}`;
      
      const deviceResponse = await fetch(deviceUrl, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${NOTEHUB_AUTH_TOKEN}`,
        },
      });

      if (!deviceResponse.ok && deviceResponse.status !== 404) {
        const errorText = await deviceResponse.text();
        throw new Error(`Failed to delete device: ${deviceResponse.status} ${errorText}`);
      }

      console.log("Device removed from Notehub successfully");

      return new Response(
        JSON.stringify({ 
          success: true, 
          operation: "deleted" 
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
    console.error("Device sync error:", error);
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
