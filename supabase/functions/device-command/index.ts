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

interface DeviceCommandPayload {
  command_id: string;
  device_id: string;
  command_type: string;
  payload: any;
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

    const payload: DeviceCommandPayload = await req.json();
    console.log("Device command request:", payload);

    const { command_id, device_id, command_type, payload: commandPayload } = payload;

    await supabaseClient
      .from("device_commands")
      .update({ status: "processing" })
      .eq("id", command_id);

    const { data: device } = await supabaseClient
      .from("devices")
      .select("notehub_device_uid")
      .eq("id", device_id)
      .single();

    if (!device || !device.notehub_device_uid) {
      throw new Error("Device not found or missing Notehub UID");
    }

    const notehubDeviceUid = device.notehub_device_uid;
    let result: any = {};

    if (command_type === "firmware_update") {
      console.log(`Initiating firmware update to ${commandPayload.firmware_version}...`);
      
      const firmwareUrl = `${NOTEHUB_BASE_URL}/v1/projects/${NOTEHUB_PROJECT_UID}/devices/${encodeURIComponent(notehubDeviceUid)}/dfu`;
      
      const response = await fetch(firmwareUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NOTEHUB_AUTH_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ version: commandPayload.firmware_version }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update firmware: ${response.status} ${errorText}`);
      }

      result = { firmware_version: commandPayload.firmware_version };
      console.log("Firmware update initiated successfully");

    } else if (command_type === "env_variable") {
      console.log(`Setting environment variables for device ${notehubDeviceUid}...`);
      console.log("Variables to set:", commandPayload.variables);
      
      // Step 1: Set the environment variables
      const envUrl = `${NOTEHUB_BASE_URL}/v1/projects/${NOTEHUB_PROJECT_UID}/devices/${encodeURIComponent(notehubDeviceUid)}/environment_variables`;
      
      const envResponse = await fetch(envUrl, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${NOTEHUB_AUTH_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ environment_variables: commandPayload.variables }),
      });

      if (!envResponse.ok) {
        const errorText = await envResponse.text();
        console.error(`Failed to set environment variables: ${envResponse.status} ${errorText}`);
        throw new Error(`Failed to set environment variables: ${envResponse.status} ${errorText}`);
      }

      console.log("Environment variables set successfully");

      // Step 2: Issue an "Apply" signal to Notehub to push the changes to the device
      console.log(`Issuing Apply signal to push changes to device...`);
      
      const signalUrl = `${NOTEHUB_BASE_URL}/v1/projects/${NOTEHUB_PROJECT_UID}/devices/${encodeURIComponent(notehubDeviceUid)}/signal`;
      
      const signalResponse = await fetch(signalUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NOTEHUB_AUTH_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          when: 0,
          body: {
            apply: true
          }
        }),
      });

      if (!signalResponse.ok) {
        const errorText = await signalResponse.text();
        console.warn(`Failed to send Apply signal (non-fatal): ${signalResponse.status} ${errorText}`);
        // Don't throw error here - the env vars are set, signal is best-effort
      } else {
        console.log("Apply signal sent successfully - changes will be delivered when device connects");
      }

      result = { 
        variables: commandPayload.variables,
        apply_signal_sent: signalResponse.ok
      };

    } else if (command_type === "fleet_assign") {
      console.log(`Assigning device to fleet ${commandPayload.fleet_uid}...`);
      
      const fleetUrl = `${NOTEHUB_BASE_URL}/v1/projects/${NOTEHUB_PROJECT_UID}/devices/${encodeURIComponent(notehubDeviceUid)}`;
      
      const response = await fetch(fleetUrl, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${NOTEHUB_AUTH_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fleet_uids: [commandPayload.fleet_uid] }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to assign fleet: ${response.status} ${errorText}`);
      }

      result = { fleet_uid: commandPayload.fleet_uid };
      console.log("Fleet assignment successful");

    } else if (command_type === "sync_device") {
      console.log(`Syncing device data from Notehub...`);
      
      const deviceUrl = `${NOTEHUB_BASE_URL}/v1/projects/${NOTEHUB_PROJECT_UID}/devices/${encodeURIComponent(notehubDeviceUid)}`;
      
      const response = await fetch(deviceUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${NOTEHUB_AUTH_TOKEN}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to sync device: ${response.status} ${errorText}`);
      }

      const deviceData = await response.json();
      result = { synced_at: new Date().toISOString(), device_data: deviceData };
      console.log("Device sync successful");

    } else {
      throw new Error(`Unknown command type: ${command_type}`);
    }

    await supabaseClient
      .from("device_commands")
      .update({ 
        status: "completed",
        result: result,
        completed_at: new Date().toISOString()
      })
      .eq("id", command_id);

    return new Response(
      JSON.stringify({ 
        success: true,
        command_id,
        result 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Device command error:", error);
    
    try {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );
      
      const payload: DeviceCommandPayload = await req.json();
      
      await supabaseClient
        .from("device_commands")
        .update({ 
          status: "failed",
          error_message: error.message,
          completed_at: new Date().toISOString()
        })
        .eq("id", payload.command_id);
    } catch (dbError) {
      console.error("Failed to update command status:", dbError);
    }

    return new Response(
      JSON.stringify({ 
        error: "Command execution failed",
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
