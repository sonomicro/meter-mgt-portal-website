import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Webhook security using OpenSSL generated secret
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
    // data.qo / sensors.qo — current firmware (kv_app.h keys, sanitized by
    // data_serializer.c's sanitize_key() which replaces '.' with '_' on the wire)
    flow_sensor_1_volume_flow_rate?: number;
    flow_sensor_1_totalizer?: number;
    flow_sensor_1_delta_tof?: number;
    flow_sensor_1_sample_number?: number;
    flow_sensor_1_saturated_flow_count?: number;
    flow_sensor_1_total_tof_dns?: number;
    flow_sensor_1_total_tof_ups?: number;
    // data.qo — legacy firmware still live on some fleet devices (pre-kv_app.h
    // data_serializer.c, flat PascalCase keys, no "flow_sensor.1." namespace)
    VolumeFlowRate?: number;
    Totalizer?: number;
    DeltaTOF?: number;
    SampleNumber?: number;
    SaturationFlowCount?: number;
    TotalTOF_DNS?: number;
    TotalTOF_UPS?: number;
    // battery.qo (battery_controller.c) — current firmware only
    battery_soc_pct?: number;
    battery_voltage_mv?: number;
    // _health.qo (Notecard system health, not app telemetry)
    battery_level?: number;
    voltage?: number;
    temp?: number;
    bars?: number;
    // alarm.qo — current firmware (cloud_sync_raise_alarm: flat { code, message })
    code?: number;
    message?: string;
    // alarm.qo — legacy firmware seen sending a nested shape, e.g. { flow: { status, value } }
    flow?: { status?: string; value?: number };
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

Deno.serve(async (req) => {
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

  // Verify webhook secret for security (using OpenSSL generated secret)
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
  } else {
    console.warn('NOTEHUB_WEBHOOK_SECRET not configured - webhook is not secured');
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
      
      // Auto-register new devices if they appear in Notehub webhooks
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
      // Use the newly created device for processing
      devices = [createdDevice];
    }

    const device = devices[0]

    // Process different types of events
    if ((payload.file === 'sensors.qo' || payload.file === 'data.qo') && payload.body) {
      // This is sensor data from the device
      const timestamp = new Date(payload.when * 1000).toISOString()

      // Current firmware sends flow_sensor_1_* (kv_app.h, sanitized to underscores);
      // some fleet devices still run older firmware that sends flat PascalCase keys.
      const flowRate = payload.body.flow_sensor_1_volume_flow_rate ?? payload.body.VolumeFlowRate ?? 0;
      const totalVolume = payload.body.flow_sensor_1_totalizer ?? payload.body.Totalizer ?? 0;

      // Insert device data record
      const { error: dataError } = await supabaseClient
        .from('device_data')
        .insert({
          device_id: device.id,
          timestamp: timestamp,
          flow_rate: flowRate,
          total_volume: totalVolume
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
        flow_rate: flowRate,
        total_usage: totalVolume
      }

      if (payload.body.battery_level !== undefined) {
        deviceUpdates.battery_level = payload.body.battery_level
      }

      if (payload.body.bars !== undefined) {
        deviceUpdates.signal_strength = payload.body.bars
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

      console.log(`Processed sensor data for device ${device.name}`)
    }

    // Track data usage for analytics
    const payloadSize = JSON.stringify(payload).length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if usage record exists for today
    const { data: existingUsage } = await supabaseClient
      .from('device_data_usage')
      .select('id, bytes_received, event_count')
      .eq('device_id', payload.device)
      .gte('period_start', today.toISOString())
      .lt('period_end', tomorrow.toISOString())
      .maybeSingle();

    if (existingUsage) {
      // Update existing record
      await supabaseClient
        .from('device_data_usage')
        .update({
          bytes_received: existingUsage.bytes_received + payloadSize,
          event_count: existingUsage.event_count + 1
        })
        .eq('id', existingUsage.id);
    } else {
      // Create new record for today
      await supabaseClient
        .from('device_data_usage')
        .insert({
          device_id: payload.device,
          tenant_id: device.tenant_id,
          bytes_received: payloadSize,
          event_count: 1,
          period_start: today.toISOString(),
          period_end: tomorrow.toISOString()
        });
    }

    // Track webhook usage
    const { data: existingWebhookUsage } = await supabaseClient
      .from('webhook_usage')
      .select('id, invocation_count, bytes_processed')
      .eq('webhook_name', 'notehub-webhook')
      .gte('period_start', today.toISOString())
      .lt('period_end', tomorrow.toISOString())
      .maybeSingle();

    if (existingWebhookUsage) {
      await supabaseClient
        .from('webhook_usage')
        .update({
          invocation_count: existingWebhookUsage.invocation_count + 1,
          bytes_processed: existingWebhookUsage.bytes_processed + payloadSize
        })
        .eq('id', existingWebhookUsage.id);
    } else {
      await supabaseClient
        .from('webhook_usage')
        .insert({
          webhook_name: 'notehub-webhook',
          invocation_count: 1,
          bytes_processed: payloadSize,
          period_start: today.toISOString(),
          period_end: tomorrow.toISOString()
        });
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

      const healthUpdates: any = {
        status: 'online',
        last_seen: timestamp,
        battery_level: batteryLevel
      };

      if (payload.body.bars !== undefined) {
        healthUpdates.signal_strength = payload.body.bars;

        // Check for low signal strength alert
        if (payload.body.bars <= 1) {
          const { error: alertError } = await supabaseClient
            .from('alerts')
            .insert({
              device_id: device.id,
              type: 'low_signal',
              message: `Low signal strength detected: ${payload.body.bars} bar${payload.body.bars === 1 ? '' : 's'}`,
              severity: payload.body.bars === 0 ? 'high' : 'medium',
              created_at: timestamp
            })

          if (alertError) {
            console.error('Error inserting low signal alert:', alertError)
          } else {
            console.log(`Created low signal alert for device ${device.name}: ${payload.body.bars} bar(s)`)
          }
        }
      }

      const { error: updateError } = await supabaseClient
        .from('devices')
        .update(healthUpdates)
        .eq('id', device.id)

      if (updateError) {
        console.error('Error updating device health:', updateError)
      }

      console.log(`Updated health status for device ${device.name}`)
    }

    // Handle app-level battery telemetry (battery_controller.c battery.qo)
    if (payload.file === 'battery.qo' && payload.body.battery_soc_pct !== undefined) {
      const timestamp = new Date(payload.when * 1000).toISOString()

      const { error: updateError } = await supabaseClient
        .from('devices')
        .update({
          status: 'online',
          last_seen: timestamp,
          battery_level: payload.body.battery_soc_pct
        })
        .eq('id', device.id)

      if (updateError) {
        console.error('Error updating device battery:', updateError)
      }

      console.log(`Updated battery level for device ${device.name}: ${payload.body.battery_soc_pct}%`)
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

    // Handle alarm events. Current firmware (cloud_sync_raise_alarm) sends a flat
    // { code, message } body; some fleet devices still run older firmware that sends
    // other shapes (e.g. a nested { flow: { status, value } }), so fall back to a
    // generic dump for anything we don't specifically recognize.
    if (payload.file === 'alarm.qo' && payload.body) {
      const timestamp = new Date(payload.when * 1000).toISOString()

      let alertType = 'alarm';
      let severity = 'medium';
      let message: string;

      if (payload.body.code !== undefined) {
        message = payload.body.message
          ? `Alarm (code ${payload.body.code}): ${payload.body.message}`
          : `Device alarm triggered (code ${payload.body.code})`;
      } else if (payload.body.flow) {
        alertType = 'leak';
        severity = payload.body.flow.status === 'high' ? 'high' : 'medium';
        message = `Flow ${payload.body.flow.status}: ${payload.body.flow.value}`;
      } else {
        const details = Object.entries(payload.body)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join(', ');
        message = details ? `Alarm: ${details}` : 'Device alarm triggered';
      }

      // Insert alert into database
      const { error: alertError } = await supabaseClient
        .from('alerts')
        .insert({
          device_id: device.id,
          type: alertType,
          message: message,
          severity: severity,
          created_at: timestamp
        })

      if (alertError) {
        console.error('Error inserting alarm alert:', alertError)
      } else {
        console.log(`Stored alarm for device ${device.name}: ${message}`)
      }

      // Update device last_seen
      await supabaseClient
        .from('devices')
        .update({
          last_seen: timestamp
        })
        .eq('id', device.id)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processed successfully',
        device: device.name,
        device_uid: payload.device,
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
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})