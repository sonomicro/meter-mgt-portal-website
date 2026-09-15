import { createClient } from 'npm:@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      device_hash,
      flow_value,
      flow_unit,
      measurement_timestamp,
      user_agent,
      location,
    } = await req.json();

    if (device_hash === undefined || device_hash === null) {
      return new Response(
        JSON.stringify({ error: 'device_hash is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // The NFC tag only carries a short, backend-resolvable device hash (it
    // has to fit the tag's ~100-byte URI budget) — never the device's UUID.
    // The firmware computes this once (crc32 of the Notecard UID) and the
    // notehub-webhook stores it verbatim on the matching device row, so it's
    // safe to match on here with no separate hashing logic to keep in sync.
    // Resolve server-side with the service role, since the anon client the
    // landing page uses has no read access to the devices table.
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id')
      .eq('nfc_short_id', device_hash)
      .maybeSingle();

    if (deviceError || !device) {
      return new Response(
        JSON.stringify({ error: 'Unknown device' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const ip_address = req.headers.get('x-forwarded-for') ||
                       req.headers.get('x-real-ip') ||
                       'unknown';

    const { data, error } = await supabase.rpc('record_nfc_tap', {
      p_device_id: device.id,
      p_flow_value: flow_value ?? null,
      p_flow_unit: flow_unit || 'L/min',
      p_measurement_timestamp: measurement_timestamp || new Date().toISOString(),
      p_ip_address: ip_address,
      p_user_agent: user_agent || null,
      p_location: location || null,
    });

    if (error) {
      console.error('Error recording tap:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to record tap' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
