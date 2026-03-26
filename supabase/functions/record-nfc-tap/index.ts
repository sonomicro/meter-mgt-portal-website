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
      device_id,
      flow_value,
      flow_unit,
      measurement_timestamp,
      user_agent,
      location,
    } = await req.json();

    if (!device_id || flow_value === undefined) {
      return new Response(
        JSON.stringify({ error: 'device_id and flow_value are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get client IP address
    const ip_address = req.headers.get('x-forwarded-for') ||
                       req.headers.get('x-real-ip') ||
                       'unknown';

    const { data, error } = await supabase.rpc('record_nfc_tap', {
      p_device_id: device_id,
      p_flow_value: flow_value,
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
