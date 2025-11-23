import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

const NOTEHUB_BASE_URL = 'https://api.notefile.net';
const NOTEHUB_AUTH_TOKEN = Deno.env.get('NOTEHUB_AUTH_TOKEN');

if (!NOTEHUB_AUTH_TOKEN) {
  console.error('NOTEHUB_AUTH_TOKEN is not configured');
}

// Retry mechanism with exponential backoff
const retryWithBackoff = async (
  fn: () => Promise<Response>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<Response> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fn();
      
      if (response.status === 429 && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Rate limited (429), retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!NOTEHUB_AUTH_TOKEN) {
    console.error('Missing Notehub auth token');
    return new Response(
      JSON.stringify({ 
        error: 'Notehub auth token not configured',
        details: 'Please configure NOTEHUB_AUTH_TOKEN in Supabase Edge Function environment variables'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace('/notehub-proxy', '');
    const notehubUrl = `${NOTEHUB_BASE_URL}${path}${url.search}`;
    
    console.log(`Proxying ${req.method} request to: ${notehubUrl}`);
    
    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const contentType = req.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        body = await req.text();
        console.log('Request body:', body);
      }
    }
    
    const notehubResponse = await retryWithBackoff(async () => {
      return await fetch(notehubUrl, {
        method: req.method,
        headers: {
          'Authorization': `Bearer ${NOTEHUB_AUTH_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: body,
      });
    });

    console.log(`Notehub response status: ${notehubResponse.status}`);
    
    if (notehubResponse.status === 401 || notehubResponse.status === 403) {
      console.error('Authentication failed with Notehub:', {
        status: notehubResponse.status,
        url: notehubUrl,
      });
    }
    
    const responseData = await notehubResponse.text();
    console.log('Response data:', responseData);

    // Track proxy usage for analytics
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const bytesSent = body ? body.length : 0;
      const bytesReceived = responseData.length;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: existingUsage } = await supabaseClient
        .from('proxy_usage')
        .select('id, request_count, bytes_sent, bytes_received')
        .eq('proxy_name', 'notehub-proxy')
        .gte('period_start', today.toISOString())
        .lt('period_end', tomorrow.toISOString())
        .maybeSingle();

      if (existingUsage) {
        await supabaseClient
          .from('proxy_usage')
          .update({
            request_count: existingUsage.request_count + 1,
            bytes_sent: existingUsage.bytes_sent + bytesSent,
            bytes_received: existingUsage.bytes_received + bytesReceived
          })
          .eq('id', existingUsage.id);
      } else {
        await supabaseClient
          .from('proxy_usage')
          .insert({
            proxy_name: 'notehub-proxy',
            request_count: 1,
            bytes_sent: bytesSent,
            bytes_received: bytesReceived,
            period_start: today.toISOString(),
            period_end: tomorrow.toISOString()
          });
      }
    } catch (usageError) {
      console.error('Failed to track proxy usage:', usageError);
      // Don't fail the request if usage tracking fails
    }

    return new Response(responseData, {
      status: notehubResponse.status,
      statusText: notehubResponse.statusText,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Notehub proxy error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return new Response(
      JSON.stringify({ 
        error: 'Proxy request failed',
        details: error.message,
        type: error.name
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
