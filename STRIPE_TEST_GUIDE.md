# Stripe Payment Test Guide

## Quick Test Steps

### 1. Verify Configuration
Check that your App.js has the correct publishable key:
```javascript
<StripeProvider publishableKey="pk_test_51RHTSqQ3eI5H05vXLwaPJ5PsIsD1GzD70ndc56Je13Q6woGwPcx85kiermBUfk1MPE533M7UkIiNSeiQtrSzKmVS00vSEyfrV8">
```

### 2. Test the Supabase Function
You can test your payment function directly with curl:

```bash
curl -X POST https://pgouwzuufnnhthwrewrv.functions.supabase.co/create-payment-intent \
  -H "Content-Type: application/json" \
  -d '{
    "cartItems": [{"name": "Test Item", "price": 10.00, "quantity": 1}],
    "total": 10.00,
    "orderCode": 123456,
    "restaurant": {"name": "Test Restaurant"}
  }'
```

**Expected Response:**
- ✅ Success: `{"paymentIntentClientSecret": "pi_..."}`
- ❌ Error: `{"error": "Unable to create Payment Intent", "message": "..."}`

### 3. Test Cards
Use these test card numbers in your app:

| Card Number | Description | Expected Result |
|-------------|-------------|-----------------|
| `4242 4242 4242 4242` | Visa | ✅ Success |
| `4000 0000 0000 0002` | Declined | ❌ Payment Failed |
| `4000 0025 0000 3155` | 3D Secure | 🔐 Requires Authentication |

### 4. Common Issues & Solutions

#### Issue: "You did not provide an API key"
**Solution**: Set `STRIPE_SECRET_KEY` in Supabase environment variables

#### Issue: "Invalid API key provided"
**Solution**: Check that your secret key starts with `sk_test_` and is correct

#### Issue: "Payment Sheet init error"
**Solution**: Verify the publishable key in App.js is correct

#### Issue: "Network error"
**Solution**: Check that your Supabase function URL is correct

### 5. Debug Steps

1. **Check Console Logs**: Look for error messages in your app's console
2. **Verify Environment Variables**: Ensure `STRIPE_SECRET_KEY` is set in Supabase
3. **Test Function Directly**: Use the curl command above
4. **Check Network Tab**: Look for failed requests in your browser's developer tools

### 6. Production Checklist

Before going live:
- [ ] Replace test keys with live keys
- [ ] Update webhook endpoints
- [ ] Test with real payment methods
- [ ] Set up proper error monitoring
- [ ] Configure success/failure redirects

## Current Status

✅ **Publishable Key**: Configured
❌ **Secret Key**: Needs to be set in Supabase
✅ **Function Code**: Ready
✅ **Payment UI**: Configured

**Next Step**: Set the `STRIPE_SECRET_KEY` environment variable in your Supabase dashboard!


