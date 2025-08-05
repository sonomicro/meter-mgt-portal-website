import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Optional webhook security - set this in your Supabase environment variables
const WEBHOOK_SECRET = Deno.env.get('NOTEHUB_WEBHOOK_SECRET');

interface NotehubWebhookPayload {
  event: string;
  session: string;
  best_id: string;
  device: string;
  product: string;
  received: number;
  req: string;
  when: number;
  file: string;
  note: string;
  updates: number;
  body: {
    flow_rate?: number;
    total_volume?: number;
    temperature?: number;
    pressure?: number;
    battery_level?: number;
    voltage?: number;
    temp?: number;
    bars?: number;
    [key: string]: any;
  };
  where_olc?: string;
  where_lat?: number;
  where_lon?: number;
  where_location?: string;
  where_country?: string;
  where_timezone?: string;
  tower_when?: number;
  tower_lat?: number;
  tower_lon?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  // Optional: Verify webhook secret for security
  if (WEBHOOK_SECRET) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    const token = authHeader.substring(7);
    if (token !== WEBHOOK_SECRET) {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook secret' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse the webhook payload
    const payload: NotehubWebhookPayload = await req.json()
    
    console.log('Received Notehub webhook:', JSON.stringify(payload, null, 2))

    // Find the device by Notehub device UID
    const { data: devices, error: deviceError } = await supabaseClient
      .from('devices')
      .select('id, name, tenant_id')
      .eq('notehub_device_uid', payload.device)
      .limit(1)

    if (deviceError) {
      console.error('Error finding device:', deviceError)
      return new Response(
        JSON.stringify({ error: 'Database error finding device' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!devices || devices.length === 0) {
      console.log(`Device not found for Notehub UID: ${payload.device}`)
      
      // Auto-register new devices if they appear in Notehub
      console.log('Attempting to auto-register device...')
      const newDevice = {
        device_id: payload.device.substring(0, 20),
        serial_number: payload.device,
        name: `Auto-registered ${payload.device.substring(0, 8)}`,
        location: payload.where_location || 'Unknown Location',
        coordinates: payload.where_lat && payload.where_lon ? {
          lat: payload.where_lat,
          lon: payload.where_lon
        } : null,
        notehub_device_uid: payload.device,
        status: 'online',
        firmware_version: '1.0.0',
        tenant_id: null // Will need manual assignment
      };
      
      const { data: createdDevice, error: createError } = await supabaseClient
        .from('devices')
        .insert(newDevice)
        .select()
        .single();
        
      if (createError) {
        console.error('Failed to auto-register device:', createError);
        return new Response(
          JSON.stringify({ message: 'Device not registered and auto-registration failed' }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      console.log('Auto-registered new device:', createdDevice.name);
      // Continue processing with the newly created device
      devices.push(createdDevice);
      return new Response(
        JSON.stringify({ message: 'Device not registered in system' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const device = devices[0]

    // Process different types of events
    if (payload.file === 'sensors.qo' && payload.body) {
      // This is sensor data from the device
      const timestamp = new Date(payload.when * 1000).toISOString()
      
      // Insert device data record
      const { error: dataError } = await supabaseClient
        .from('device_data')
        .insert({
          device_id: device.id,
          timestamp: timestamp,
          flow_rate: payload.body.flow_rate || 0,
          total_volume: payload.body.total_volume || 0,
          temperature: payload.body.temperature,
          pressure: payload.body.pressure,
          battery_level: payload.body.battery_level
        })

      if (dataError) {
        console.error('Error inserting device data:', dataError)
        return new Response(
          JSON.stringify({ error: 'Failed to store device data' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      // Update device status and latest values
      const deviceUpdates: any = {
        status: 'online',
        last_seen: timestamp,
        flow_rate: payload.body.flow_rate || 0,
        total_usage: payload.body.total_volume || 0
      }

      if (payload.body.battery_level !== undefined) {
        deviceUpdates.battery_level = payload.body.battery_level
      }

      // Update location if provided
      if (payload.where_lat && payload.where_lon) {
        deviceUpdates.coordinates = {
          lat: payload.where_lat,
          lon: payload.where_lon
        }
        if (payload.where_location) {
          deviceUpdates.location = payload.where_location
        }
      }

      const { error: updateError } = await supabaseClient
        .from('devices')
        .update(deviceUpdates)
        .eq('id', device.id)

      if (updateError) {
        console.error('Error updating device:', updateError)
      }

      // Check for alert conditions
      const alerts = []

      // Low battery alert
      if (payload.body.battery_level && payload.body.battery_level < 25) {
        alerts.push({
          device_id: device.id,
          type: 'low_battery',
          message: `Battery level below 25% (${payload.body.battery_level}%)`,
          severity: payload.body.battery_level < 10 ? 'high' : 'medium'
        })
      }

      // High flow rate alert (potential leak)
      if (payload.body.flow_rate && payload.body.flow_rate > 100) {
        alerts.push({
          device_id: device.id,
          type: 'leak',
          message: `Unusually high flow rate detected: ${payload.body.flow_rate}L/min`,
          severity: 'high'
        })
      }

      // Insert alerts if any
      if (alerts.length > 0) {
        const { error: alertError } = await supabaseClient
          .from('alerts')
          .insert(alerts)

        if (alertError) {
          console.error('Error inserting alerts:', alertError)
        }
      }

      console.log(`Processed sensor data for device ${device.name}`)
    }

    // Handle device status events
    if (payload.file === '_health.qo') {
      const timestamp = new Date(payload.when * 1000).toISOString()
      
      // Calculate battery level from voltage if available
      let batteryLevel = payload.body.battery_level;
      if (!batteryLevel && payload.body.voltage) {
        // Convert voltage to percentage (assuming 3.3V = 100%, 2.7V = 0%)
        batteryLevel = Math.round(((payload.body.voltage - 2.7) / (3.3 - 2.7)) * 100);
        batteryLevel = Math.max(0, Math.min(100, batteryLevel));
      }
      
      const { error: updateError } = await supabaseClient
        .from('devices')
        .update({
          status: 'online',
          last_seen: timestamp,
          battery_level: batteryLevel
        })
        .eq('id', device.id)

      if (updateError) {
        console.error('Error updating device health:', updateError)
      }

      console.log(`Updated health status for device ${device.name}`)
    }

    // Handle location updates
    if (payload.file === '_track.qo' && payload.where_lat && payload.where_lon) {
      const timestamp = new Date(payload.when * 1000).toISOString()
      
      const { error: updateError } = await supabaseClient
        .from('devices')
        .update({
          coordinates: {
            lat: payload.where_lat,
            lon: payload.where_lon
          },
          location: payload.where_location || device.location,
          last_seen: timestamp
        })
        .eq('id', device.id)

      if (updateError) {
        console.error('Error updating device location:', updateError)
      }

      console.log(`Updated location for device ${device.name}`)
    }

    // Handle session events (device connect/disconnect)
    if (payload.file === '_session.qo') {
      const timestamp = new Date(payload.when * 1000).toISOString()
      const isConnecting = payload.body.why === 'connected' || payload.body.why === 'online';
      
      const { error: updateError } = await supabaseClient
        .from('devices')
        .update({
          status: isConnecting ? 'online' : 'offline',
          last_seen: timestamp
        })
        .eq('id', device.id)

      if (updateError) {
        console.error('Error updating device session status:', updateError)
      }

      console.log(`Updated session status for device ${device.name}: ${isConnecting ? 'online' : 'offline'}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processed successfully',
        device: device.name,
        event_type: payload.file,
        timestamp: new Date(payload.when * 1000).toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})