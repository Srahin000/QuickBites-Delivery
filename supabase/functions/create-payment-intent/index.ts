// create-payment-intent/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12.6.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2022-11-15',
});

serve(async (req) => {
  try {
    const body = await req.json();
    const { cartItems, total, orderCode, restaurant } = body;

    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100), // Stripe wants amount in cents
      currency: 'usd',
      metadata: {
        order_code: orderCode.toString(),
        restaurant_name: restaurant.name,
      },
      automatic_payment_methods: { enabled: true }, // <-- this enables Apple Pay, Google Pay, cards
    });

    return new Response(
      JSON.stringify({
        paymentIntentClientSecret: paymentIntent.client_secret,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Stripe error:', error);
    return new Response(
      JSON.stringify({
        error: 'Unable to create Payment Intent',
        message: error.message,
      }),
      { status: 500 }
    );
  }
});
