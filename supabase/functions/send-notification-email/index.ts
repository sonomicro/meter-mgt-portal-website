import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev';

interface AlertNotificationRequest {
  alertId: string;
  deviceId: string;
  type: string;
  severity: string;
  message: string;
}

const PREFERENCE_KEY_BY_TYPE: Record<string, string> = {
  low_battery: 'low_battery_alerts',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'Email provider not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload: AlertNotificationRequest = await req.json();

    const preferenceKey = PREFERENCE_KEY_BY_TYPE[payload.type];
    if (!preferenceKey) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `No notification mapping for alert type '${payload.type}'` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: device, error: deviceError } = await supabaseClient
      .from('devices')
      .select('id, name, tenant_id')
      .eq('id', payload.deviceId)
      .maybeSingle();

    if (deviceError || !device || !device.tenant_id) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'Device not found or not assigned to a tenant' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: tenant, error: tenantError } = await supabaseClient
      .from('tenants')
      .select('id, name, email')
      .eq('id', device.tenant_id)
      .maybeSingle();

    if (tenantError || !tenant) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'Tenant not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: preferences } = await supabaseClient
      .from('tenant_notification_preferences')
      .select('email_notifications_enabled, low_battery_alerts')
      .eq('tenant_id', tenant.id)
      .maybeSingle();

    // Default to enabled when a tenant hasn't saved preferences yet.
    const emailEnabled = preferences?.email_notifications_enabled ?? true;
    const categoryEnabled = preferences ? preferences[preferenceKey as 'low_battery_alerts'] : true;

    if (!emailEnabled || !categoryEnabled) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'Tenant has this notification disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subject = `[${payload.severity.toUpperCase()}] ${device.name}: ${payload.type.replace('_', ' ')} alert`;
    const html = `
      <p>Hello ${tenant.name},</p>
      <p>Your device <strong>${device.name}</strong> triggered a ${payload.severity} severity alert:</p>
      <p>${payload.message}</p>
      <p>Log in to the portal to view details or resolve this alert.</p>
    `;

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: tenant.email,
        subject,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const errorBody = await emailResponse.text();
      console.error('Resend API error:', errorBody);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: errorBody }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('send-notification-email error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
