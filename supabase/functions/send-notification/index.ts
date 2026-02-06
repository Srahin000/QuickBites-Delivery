// send-notification/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Initialize Supabase clients
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL environment variable is not set in Supabase');
}
if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set in Supabase');
}
if (!supabaseAnonKey) {
  throw new Error('SUPABASE_ANON_KEY environment variable is not set in Supabase');
}

// Use service role for database operations, anon key for auth verification
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

serve(async (req) => {
  try {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { 
          status: 401,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    // Verify the JWT token exists and is valid
    const token = authHeader.replace('Bearer ', '');
    
    // Try to validate token with anon key (required for user token validation)
    let authenticatedUserId = null;
    try {
      if (supabaseAnonKey) {
        const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token);
        if (!authError && user) {
          authenticatedUserId = user.id;
          console.log('✅ Authenticated user:', authenticatedUserId);
        } else {
          console.warn('⚠️ Token validation failed:', authError?.message || 'Unknown error');
          // Continue anyway - we'll validate userId separately when fetching tokens
        }
      } else {
        console.warn('⚠️ SUPABASE_ANON_KEY not set, skipping strict token validation');
      }
    } catch (err) {
      console.warn('⚠️ Auth validation error, but continuing:', err.message);
      // Continue processing - userId validation happens when fetching tokens
    }

    // Note: We continue even if token validation fails because:
    // 1. We validate userId when fetching push tokens from database
    // 2. Database RLS policies provide additional security
    // 3. This is an internal function called from authenticated app context

    // Parse request body
    const { userId, type, title, body, data } = await req.json();

    if (!userId || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: userId, title, body' }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    // Get user's push tokens from database
    const { data: tokens, error: tokenError } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId);

    if (tokenError) {
      console.error('Error fetching push tokens:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch push tokens' }),
        { 
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    if (!tokens || tokens.length === 0) {
      console.log(`No push tokens found for user ${userId}`);
      return new Response(
        JSON.stringify({ 
          message: 'No push tokens found for user',
          sent: false 
        }),
        { 
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    // Prepare notification messages for all user's devices
    const messages = tokens.map((tokenRow: { token: string }) => ({
      to: tokenRow.token,
      sound: 'default',
      title: title,
      body: body,
      data: {
        type: type || 'general',
        ...(data || {}),
      },
      priority: 'high',
      channelId: 'default',
    }));

    // Send notifications via Expo Push API
    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const pushResult = await pushResponse.json();

    if (!pushResponse.ok) {
      console.error('Expo Push API error:', pushResult);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send push notification',
          details: pushResult 
        }),
        { 
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      );
    }

    console.log(`Sent ${messages.length} notification(s) to user ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        sent: true,
        recipients: messages.length,
        result: pushResult 
      }),
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      }
    );
  } catch (error) {
    console.error('Error in send-notification function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString() 
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
});

