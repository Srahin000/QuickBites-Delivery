// create-payment-intent/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12.6.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Get Stripe secret key from Supabase environment variables
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not set in Supabase');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20',
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
    const { cartItems, total, orderCode, restaurant, metadata, amount, currency } = body;

    console.log('Creating payment intent for:', {
      userId: user.id,
      userEmail: user.email,
      amountProvided: amount,
      amountInDollars: typeof amount === 'number' ? (amount / 100).toFixed(2) : 'N/A',
      totalProvided: total,
      totalInDollars: typeof total === 'number' ? total.toFixed(2) : 'N/A',
      orderCode,
      restaurant: restaurant?.name,
      cartItemsCount: cartItems?.length || 0,
      hasRestaurant: !!restaurant
    });

    // Validate required fields - amount must be integer cents
    const finalAmount =
      typeof amount === 'number' ? amount :
      (typeof total === 'number' ? Math.round(total * 100) : null);

    console.log('💰 Payment Intent Amount Calculation:', {
      amountProvided: amount,
      totalProvided: total,
      finalAmount: finalAmount,
      finalAmountInDollars: typeof finalAmount === 'number' ? (finalAmount / 100).toFixed(2) : 'N/A'
    });

    if (!Number.isInteger(finalAmount) || (finalAmount as number) <= 0) {
      console.error('❌ Invalid amount:', { finalAmount, amount, total });
      return new Response(
        JSON.stringify({ error: 'Invalid amount (must be integer cents)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get or create Stripe customer for this user
    let customerId = null;
    try {
      // Fetch existing Stripe customer ID from database
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        console.error('Error fetching user data:', userError);
      }

      customerId = userData?.stripe_customer_id;

      // Create Stripe customer if doesn't exist
      if (!customerId) {
        console.log('Creating new Stripe customer for user:', user.id);
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: {
            supabase_user_id: user.id,
            created_from: 'payment_intent'
          }
        });
        customerId = customer.id;
        console.log('Created Stripe customer:', customerId);

        // Save customer ID to database
        const { error: updateError } = await supabase
          .from('users')
          .update({ stripe_customer_id: customerId })
          .eq('id', user.id);

        if (updateError) {
          console.error('Error saving Stripe customer ID:', updateError);
          // Continue anyway - payment can still work
        }
      } else {
        console.log('Using existing Stripe customer:', customerId);
      }
    } catch (customerError) {
      console.error('Error managing Stripe customer:', customerError);
      // Continue without customer ID - payment will still work, just won't save card
    }

    // Create a PaymentIntent with Apple Pay support and card saving
    const paymentIntentConfig: any = {
      amount: finalAmount as number,
      currency: currency || 'usd',
      customer: customerId || undefined, // Link to customer for card saving
      setup_future_usage: customerId ? 'off_session' : undefined, // Save card for future use
      metadata: {
        order_code: orderCode?.toString() || 'unknown',
        restaurant_name: restaurant?.name || 'Unknown',
        user_id: user.id,
        user_email: user.email || 'unknown',
        app_version: '1.0.2',
        // Only include metadata fields that are under 500 characters
        ...(metadata && Object.keys(metadata).reduce((acc, key) => {
          const value = metadata[key];
          if (value && value.toString().length <= 500) {
            acc[key] = value;
          }
          return acc;
        }, {}))
      },
    };

  
    paymentIntentConfig.automatic_payment_methods = { 
      enabled: true,
      allow_redirects: 'never' // Prevents redirect-based payment methods
    };

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentConfig);

    console.log('Payment intent created:', paymentIntent.id);

    return new Response(
      JSON.stringify({
        client_secret: paymentIntent.client_secret,
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
