import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const NOTEHUB_BASE_URL = "https://api.notefile.net";
const NOTEHUB_CLIENT_ID = Deno.env.get("NOTEHUB_CLIENT_ID");
const NOTEHUB_CLIENT_SECRET = Deno.env.get("NOTEHUB_CLIENT_SECRET");
const NOTEHUB_PROJECT_UID = Deno.env.get("NOTEHUB_PROJECT_UID");

interface NotehubDevice {
  uid: string;
  serial_number: string;
  product_uid: string;
  fleet_uids: string[];
  last_activity: string;
  contact: string;
  location?: {
    when: number;
    name: string;
    country: string;
    timezone: string;
    latitude: number;
    longitude: number;
  };
  tower_location?: {
    when: number;
    name: string;
    country: string;
    timezone: string;
    latitude: number;
    longitude: number;
  };
  voltage?: number;
  temp?: number;
  bars?: number;
}

async function getNotehubAccessToken(): Promise<string> {
  if (!NOTEHUB_CLIENT_ID || !NOTEHUB_CLIENT_SECRET) {
    throw new Error("Notehub credentials not configured");
  }

  const response = await fetch(`${NOTEHUB_BASE_URL}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=client_credentials&client_id=${NOTEHUB_CLIENT_ID}&client_secret=${NOTEHUB_CLIENT_SECRET}`,
  });

  if (!response.ok) {
    throw new Error(`Failed to get Notehub access token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function getNotehubDevices(accessToken: string): Promise<NotehubDevice[]> {
  if (!NOTEHUB_PROJECT_UID) {
    throw new Error("Notehub project UID not configured");
  }

  const response = await fetch(
    `${NOTEHUB_BASE_URL}/v1/projects/${NOTEHUB_PROJECT_UID}/devices`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Notehub devices: ${response.status}`);
  }

  const data = await response.json();
  return data.devices || [];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "status";

    console.log(`Admin sync devices - action: ${action}`);

    // Get access token
    const accessToken = await getNotehubAccessToken();

    // Fetch devices from Notehub
    const notehubDevices = await getNotehubDevices(accessToken);
    console.log(`Fetched ${notehubDevices.length} devices from Notehub`);

    // Fetch devices from Supabase
    const { data: supabaseDevices, error: supabaseError } = await supabaseClient
      .from("devices")
      .select("*");

    if (supabaseError) {
      throw new Error(`Failed to fetch Supabase devices: ${supabaseError.message}`);
    }

    // Calculate sync status
    const supabaseDeviceMap = new Map(
      supabaseDevices
        .filter((d) => d.notehub_device_uid)
        .map((d) => [d.notehub_device_uid, d])
    );
    const notehubDeviceMap = new Map(notehubDevices.map((d) => [d.uid, d]));

    const orphanedDevices = supabaseDevices.filter(
      (d) => d.notehub_device_uid && !notehubDeviceMap.has(d.notehub_device_uid)
    );

    const unregisteredDevices = notehubDevices.filter(
      (d) => !supabaseDeviceMap.has(d.uid)
    );

    const syncedDevices = supabaseDevices.filter(
      (d) => d.notehub_device_uid && notehubDeviceMap.has(d.notehub_device_uid)
    );

    // If action is "sync", update device last_seen from Notehub
    if (action === "sync") {
      let updated = 0;

      for (const device of syncedDevices) {
        const notehubDevice = notehubDeviceMap.get(device.notehub_device_uid!);
        if (notehubDevice && notehubDevice.last_activity) {
          const lastActivity = new Date(notehubDevice.last_activity);
          const currentLastSeen = new Date(device.last_seen);

          // Only update if Notehub's last_activity is more recent
          if (lastActivity > currentLastSeen) {
            const updates: any = {
              last_seen: notehubDevice.last_activity,
            };

            // Calculate status based on last activity
            const now = new Date();
            const hoursSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
            updates.status = hoursSinceActivity < 24 ? "online" : "offline";

            // Update battery level if available
            if (notehubDevice.voltage) {
              updates.battery_level = Math.min(
                100,
                Math.max(0, ((notehubDevice.voltage - 3.0) / (4.2 - 3.0)) * 100)
              );
            }

            // Update signal strength if available
            if (notehubDevice.bars !== undefined) {
              updates.signal_strength = notehubDevice.bars;
            }

            const { error: updateError } = await supabaseClient
              .from("devices")
              .update(updates)
              .eq("id", device.id);

            if (updateError) {
              console.error(`Failed to update device ${device.id}:`, updateError);
            } else {
              updated++;
            }
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          action: "sync",
          updated,
          total: syncedDevices.length,
          orphaned: orphanedDevices.length,
          unregistered: unregisteredDevices.length,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Default action: return status only
    return new Response(
      JSON.stringify({
        success: true,
        action: "status",
        totalDevices: supabaseDevices.length,
        syncedDevices: syncedDevices.length,
        orphanedDevices: orphanedDevices.map((d) => ({
          id: d.id,
          name: d.name,
          notehub_device_uid: d.notehub_device_uid,
        })),
        unregisteredDevices: unregisteredDevices.map((d) => ({
          uid: d.uid,
          serial_number: d.serial_number,
          last_activity: d.last_activity,
        })),
        lastSync: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Admin sync devices error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
