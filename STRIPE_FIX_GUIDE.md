# Stripe Payment System Fix Guide

## Current Issue
The error "You did not provide an API key" indicates that the Stripe secret key is not properly configured in your Supabase function.

## What I've Fixed
✅ **Updated App.js** with your publishable key: `pk_test_51RHTSqQ3eI5H05vXLwaPJ5PsIsD1GzD70ndc56Je13Q6woGwPcx85kiermBUfk1MPE533M7UkIiNSeiQtrSzKmVS00vSEyfrV8`

## What You Need to Do

### Step 1: Get Your Stripe Secret Key
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers > API Keys**
3. Copy your **Secret key** (starts with `sk_test_`)

### Step 2: Set the Secret Key in Supabase
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings > Edge Functions**
4. Click on **Environment Variables**
5. Add a new environment variable:
   - **Name**: `STRIPE_SECRET_KEY`
   - **Value**: Your secret key (e.g., `sk_test_...`)

### Step 3: Deploy the Function
Run this command in your terminal:
```bash
cd supabase/functions/create-payment-intent
supabase functions deploy create-payment-intent
```

### Step 4: Test the Payment
1. Open your app
2. Add items to cart
3. Try to place an order
4. The payment should now work!

## Alternative: Quick Test with Hardcoded Key

If you want to test immediately, I can temporarily hardcode the secret key in the function. **WARNING: This is only for testing and should not be used in production.**

To do this, replace line 6 in `supabase/functions/create-payment-intent/index.ts`:

```typescript
// Replace this:
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2022-11-15',
});

// With this (replace YOUR_SECRET_KEY with your actual secret key):
const stripe = new Stripe('YOUR_SECRET_KEY', {
  apiVersion: '2022-11-15',
});
```

## Verification Steps

1. **Check App.js**: Verify the publishable key is correctly set
2. **Check Supabase Function**: Ensure the secret key is in environment variables
3. **Test Payment**: Try a test payment with card `4242 4242 4242 4242`

## Test Cards for Stripe

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`
- **Insufficient Funds**: `4000 0000 0000 9995`

## Current Configuration Status

✅ **Publishable Key**: Set in App.js
❌ **Secret Key**: Needs to be set in Supabase environment variables
✅ **Function Code**: Ready to deploy
✅ **Payment Flow**: Configured correctly

Once you set the secret key in Supabase, your payment system should work perfectly!


