# Apple Pay Review Response Guide

## Issue
Apple reviewers couldn't verify Apple Pay integration in the app (Guideline 2.1).

## Solution Steps

### 1. Verify Merchant ID in Apple Developer Portal

**ACTION REQUIRED:**
1. Go to https://developer.apple.com/account
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Identifiers** → Select **Merchant IDs** from dropdown
4. Look for: `merchant.com.qbdelivery.quickbitesdelivery`
5. **Verify Status:**
   - ✅ Should show "Active"
   - ✅ Should have a valid Payment Processing Certificate
   - ❌ If not found, create it:
     - Click "+" button
     - Select "Merchant IDs"
     - Identifier: `merchant.com.qbdelivery.quickbitesdelivery`
     - Description: "QuickBites Delivery Payments"
     - Click "Continue" → "Register"
     - Create Payment Processing Certificate when prompted

6. **Link to App Identifier:**
   - Go back to Identifiers → Select your App ID (`com.srahin000.quickbites`)
   - Scroll to "Apple Pay Payment Processing"
   - Ensure it's checked and shows your merchant ID

### 2. Create Test Account for Reviewers

**Create a test account with:**
- Pre-loaded cart items (or provide clear instructions)
- Access to all features
- Working payment integration

**Example Test Account Details:**
```
Email: applereview@quickbites.com
Password: TestPass123!
```

### 3. Prepare Response for App Store Connect

Copy and paste this into your App Store Connect response:

---

**RESPONSE TO APPLE REVIEW TEAM:**

```
Hello Apple Review Team,

Thank you for your feedback regarding Apple Pay integration. I can confirm that Apple Pay is fully implemented and functional in QuickBites version 1.2.

APPLE PAY IMPLEMENTATION DETAILS:
- Merchant ID: merchant.com.qbdelivery.quickbitesdelivery
- Framework: Stripe React Native SDK with Apple Pay support
- Location: Checkout screen after adding items to cart

HOW TO VERIFY APPLE PAY:

Step 1: Launch the QuickBites app
Step 2: Sign in with test credentials:
   Email: [YOUR_TEST_EMAIL]
   Password: [YOUR_TEST_PASSWORD]
   
Step 3: Add items to cart:
   - Tap any restaurant from the home screen
   - Tap "+" button on any food item to add to cart
   - Tap the shopping cart icon in the top-right corner
   
Step 4: Proceed to checkout:
   - On the cart screen, select a delivery time slot
   - Select a delivery location
   - Scroll down to "Choose Payment Method" section
   
Step 5: Verify Apple Pay:
   - You will see "Pay with Apple Pay" header
   - Below it is the native Apple Pay button (black with Apple Pay logo)
   - Tap the button to see the Apple Pay sheet with order details
   
TESTING PAYMENT:
- Use Stripe test card: 4242 4242 4242 4242
- Or use any Apple Pay test card from your Sandbox environment
- The payment will process through Stripe's test mode

MERCHANT ID VERIFICATION:
- The merchant ID is registered in my Apple Developer account
- It is properly configured with a valid Payment Processing Certificate
- The entitlement is included in the app's provisioning profile

TECHNICAL DETAILS:
- iOS minimum version: iOS 13.0+
- Stripe React Native SDK version: 0.55.1
- Apple Pay is only visible on iOS devices (not simulators without proper setup)
- The integration uses Apple's native PassKit framework via Stripe

I have attached screenshots showing:
1. The cart screen with items
2. The payment section with Apple Pay button clearly visible
3. The Apple Pay sheet when tapped

Please let me know if you need any additional information or clarification.

Best regards,
QuickBites Team
```

---

### 4. Take Screenshots

**Required Screenshots:**

**Screenshot 1: Cart with Items**
- Show cart screen with 2-3 items
- Ensure delivery time and location are selected
- Show subtotal/total

**Screenshot 2: Payment Section (MOST IMPORTANT)**
- Clearly show "Choose Payment Method" header
- Show "Pay with Apple Pay" label
- Show the Apple Pay button (black with Apple Pay logo)
- Ensure this is centered and prominent

**Screenshot 3: Apple Pay Sheet (Optional but Helpful)**
- After tapping Apple Pay button
- Shows the Apple Pay payment sheet with order details
- Shows merchant name "QuickBites"

**How to take screenshots:**
1. Build and run app on a real iOS device
2. Add items to cart
3. Go to checkout
4. Take screenshot showing Apple Pay button (Home + Volume Up on newer iPhones)
5. Optionally tap Apple Pay to show the payment sheet and screenshot that too

### 5. Upload Screenshots to App Store Connect

1. Log into App Store Connect
2. Go to your app → Version 1.2
3. Find the rejection message/thread
4. Click "Reply" or "Submit Appeal"
5. Paste the response from Step 3
6. **Click "Add Attachment"** and upload your screenshots
7. Click "Send"

### 6. Common Issues & Solutions

**Issue: Apple Pay button not showing**
- **Solution:** Ensure you're testing on a real iOS device, not simulator
- **Solution:** Ensure items are in cart and total > $0

**Issue: Merchant ID not found in Developer Portal**
- **Solution:** Create new Merchant ID (see Step 1)
- **Solution:** Ensure you're logged in with the correct Apple Developer account

**Issue: Apple Pay sheet shows error**
- **Solution:** Verify Stripe publishable key is correct in .env
- **Solution:** Ensure merchant ID in code matches Developer Portal

**Issue: Payment fails in test mode**
- **Solution:** Use Stripe test card: 4242 4242 4242 4242
- **Solution:** Ensure Stripe test mode is enabled in backend

### 7. Additional Tips

1. **Be Responsive:** Reply to Apple within 24-48 hours
2. **Be Detailed:** The more information you provide, the faster the review
3. **Be Polite:** Reviewers are helping you improve the app
4. **Provide Video:** If possible, record a screen recording showing the full flow
5. **Test Everything:** Before resubmitting, test Apple Pay on a real device yourself

### 8. What We Changed

To make Apple Pay more visible for reviewers, we added:
- A "Pay with Apple Pay" header above the button
- Clear visual separation from other payment options
- This makes it impossible for reviewers to miss

### 9. Rebuild and Resubmit

After verifying merchant ID:

```bash
# Increment build number
# Update version in app.json if needed

# Build for iOS
eas build --platform ios --profile production

# Or if using local builds
cd ios && pod install && cd ..
npx expo run:ios --configuration Release

# Submit to TestFlight
eas submit --platform ios
```

### 10. Follow Up

If rejected again:
1. Ask reviewers for a screenshot of what they see
2. Request a phone call with App Review team
3. Provide a detailed video walkthrough
4. Consider using App Store Connect's "Request Expedited Review" if urgent

---

## Checklist Before Resubmitting

- [ ] Merchant ID verified in Apple Developer Portal (Active + Certificate)
- [ ] Merchant ID matches exactly: `merchant.com.qbdelivery.quickbitesdelivery`
- [ ] Test account created with working credentials
- [ ] Tested Apple Pay on real iOS device (not simulator)
- [ ] Screenshots taken showing Apple Pay button clearly
- [ ] Response drafted and proofread
- [ ] Screenshots attached to response
- [ ] Build number incremented
- [ ] New build uploaded to App Store Connect

---

## Need More Help?

If you continue to face issues:
1. Reply to Apple asking for specific details on what they couldn't find
2. Offer a video call demonstration
3. Check Apple Developer Forums for similar cases
4. Consider contacting Apple Developer Support directly

Good luck! 🍀


