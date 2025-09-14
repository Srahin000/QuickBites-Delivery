// create-payment-intent/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12.6.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Get Stripe secret key from Supabase environment variables
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
console.log('Stripe secret key from Supabase:', stripeSecretKey ? stripeSecretKey.substring(0, 10) + '...' : 'NOT SET');
console.log('Is test key:', stripeSecretKey?.startsWith('sk_test_'));
console.log('Is live key:', stripeSecretKey?.startsWith('sk_live_'));

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not set in Supabase');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2022-11-15',
  typescript: true,
});

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL environment variable is not set in Supabase');
}
if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set in Supabase');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const body = await req.json();
    const { cartItems, total, orderCode, restaurant } = body;

    console.log('Creating payment intent for:', {
      userId: user.id,
      userEmail: user.email,
      total,
      orderCode,
      restaurant: restaurant?.name,
      stripeKey: stripeSecretKey.substring(0, 10) + '...',
      isTestKey: stripeSecretKey.startsWith('sk_test_')
    });

    // Validate required fields
    if (!total || total <= 0) {
      throw new Error('Invalid total amount');
    }

    if (!orderCode) {
      throw new Error('Order code is required');
    }

    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100), // Stripe wants amount in cents
      currency: 'usd',
      metadata: {
        order_code: orderCode.toString(),
        restaurant_name: restaurant?.name || 'Unknown',
        user_id: user.id,
        user_email: user.email || 'unknown',
        app_version: '1.0.2'
      },
      automatic_payment_methods: { 
        enabled: true,
        allow_redirects: 'never' // Prevents redirect-based payment methods
      },
    });

    console.log('Payment intent created:', paymentIntent.id);

    return new Response(
      JSON.stringify({
        paymentIntentClientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      }),
      {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
      }
    );
  } catch (error) {
    console.error('Stripe error:', error);
    return new Response(
      JSON.stringify({
        error: 'Unable to create Payment Intent',
        message: error.message,
        details: error.toString()
      }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
});
