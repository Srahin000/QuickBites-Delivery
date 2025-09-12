# Stripe Setup Guide for QuickBites

## Current Issues Fixed

1. ✅ **Hardcoded URLs**: Updated all payment endpoints to use environment variables
2. ✅ **Inconsistent Implementation**: Standardized payment sheet configuration across all files
3. ✅ **Missing Configuration**: Created environment variable structure

## Setup Steps

### 1. Environment Variables

Create a `.env` file in your project root with the following variables:

```env
# Stripe Configuration
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here

# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url_here
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Supabase Functions URL (update with your actual project URL)
EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL=https://your-project-id.functions.supabase.co
```

### 2. Stripe Dashboard Setup

1. **Get API Keys**:
   - Go to [Stripe Dashboard](https://dashboard.stripe.com)
   - Navigate to Developers > API Keys
   - Copy your Publishable Key and Secret Key

2. **Configure Webhooks** (Optional but recommended):
   - Go to Developers > Webhooks
   - Add endpoint: `https://your-project-id.functions.supabase.co/create-payment-intent`
   - Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`

### 3. Supabase Functions Setup

1. **Deploy the Payment Intent Function**:
   ```bash
   cd supabase/functions/create-payment-intent
   supabase functions deploy create-payment-intent
   ```

2. **Set Environment Variables in Supabase**:
   - Go to your Supabase project dashboard
   - Navigate to Settings > Edge Functions
   - Add environment variable: `STRIPE_SECRET_KEY`

### 4. App Configuration

The app is already configured with:
- ✅ StripeProvider in App.js
- ✅ Payment sheet initialization
- ✅ Error handling
- ✅ Success/failure callbacks

### 5. Testing

1. **Test Mode**: Use Stripe test keys (starts with `pk_test_` and `sk_test_`)
2. **Test Cards**:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - 3D Secure: `4000 0025 0000 3155`

## Files Modified

1. **components/placeOrder.js**: Fixed hardcoded URL and added proper payment sheet config
2. **screens/CartScreen.js**: Updated to use environment variable for Supabase function URL
3. **screens/TabCartScreen.js**: Updated to use environment variable for Supabase function URL
4. **App.js**: Already properly configured with StripeProvider

## Current Payment Flow

1. User clicks "Place Order"
2. App generates unique order code
3. App calls Supabase function to create Stripe PaymentIntent
4. App initializes Stripe Payment Sheet
5. User completes payment
6. On success: Cart is cleared and user navigates to OrderPreparing screen

## Troubleshooting

### Common Issues:

1. **"Unable to create Payment Intent"**:
   - Check if `STRIPE_SECRET_KEY` is set in Supabase
   - Verify Supabase function is deployed
   - Check function logs in Supabase dashboard

2. **"Error initializing payment"**:
   - Verify `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set
   - Check if StripeProvider is properly configured

3. **Network errors**:
   - Verify `EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL` is correct
   - Check if Supabase function is accessible

### Debug Steps:

1. Check console logs for detailed error messages
2. Verify all environment variables are loaded
3. Test Supabase function directly with curl:
   ```bash
   curl -X POST https://your-project-id.functions.supabase.co/create-payment-intent \
     -H "Content-Type: application/json" \
     -d '{"cartItems":[],"total":10.00,"orderCode":123456,"restaurant":{"name":"Test"}}'
   ```

## Production Deployment

1. Replace test keys with live keys
2. Update webhook endpoints to production URLs
3. Test with real payment methods
4. Monitor Stripe dashboard for successful payments


