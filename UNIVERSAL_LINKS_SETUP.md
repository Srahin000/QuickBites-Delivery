# Universal Links Setup Guide

This guide explains how to set up universal links for your Quickbites app using Vercel deployment.

## Current Configuration

- **Vercel Domain**: `https://quickbites-q9h4.vercel.app`
- **App Scheme**: `quickbites://`
- **Bundle ID**: `com.srahin000.quickbites`

## Files Updated

### 1. Verification Files

#### `public/.well-known/apple-app-site-association`
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "962482SPW6.com.srahin000.quickbites",
        "paths": [
          "/restaurant/*",
          "/order/*",
          "/admin/*",
          "/home",
          "/orders",
          "/profile",
          "/kiosk",
          "/cart",
          "/game",
          "/signup",
          "/signin"
        ]
      }
    ]
  },
  "webcredentials": {
    "apps": ["962482SPW6.com.srahin000.quickbites"]
  }
}
```

#### `public/.well-known/assetlinks.json`
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.srahin000.quickbites",
    "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT_HERE"]
  }
}]
```

### 2. App Configuration

#### `app.json`
- Added `associatedDomains` for iOS
- Added `intentFilters` for Android
- Both configured for `quickbites-q9h4.vercel.app`

### 3. Navigation Configuration

#### `navigation.js`
- Updated `prefixes` to include Vercel domain
- Added deep linking routes for all screens
- Configured nested navigation for MainTabs

## Available Universal Links

- `https://quickbites-q9h4.vercel.app/home` - Home screen
- `https://quickbites-q9h4.vercel.app/restaurant/123` - Restaurant details
- `https://quickbites-q9h4.vercel.app/cart` - Cart screen
- `https://quickbites-q9h4.vercel.app/orders` - Orders screen
- `https://quickbites-q9h4.vercel.app/profile` - Profile screen
- `https://quickbites-q9h4.vercel.app/kiosk` - Kiosk screen
- `https://quickbites-q9h4.vercel.app/game` - Game screen
- `https://quickbites-q9h4.vercel.app/signup` - Signup screen
- `https://quickbites-q9h4.vercel.app/signin` - Signin screen
- `https://quickbites-q9h4.vercel.app/admin` - Admin dashboard

## Testing Universal Links

### 1. Deploy to Vercel
Make sure your `.well-known` files are deployed to Vercel.

### 2. Build and Install App
```bash
eas build --platform ios
eas build --platform android
```

### 3. Test Links
- Open Safari/Chrome on your device
- Navigate to: `https://quickbites-q9h4.vercel.app/restaurant/123`
- The app should open automatically

### 4. Verify Files
- Visit: `https://quickbites-q9h4.vercel.app/.well-known/apple-app-site-association`
- Visit: `https://quickbites-q9h4.vercel.app/.well-known/assetlinks.json`

## Troubleshooting

### Common Issues

1. **404 on verification files**
   - Ensure `.well-known` directory is in `public/` folder
   - Deploy to Vercel and verify files are accessible

2. **App doesn't open from links**
   - Check that app is installed
   - Verify bundle ID matches in all configurations
   - Ensure universal links are enabled in device settings

3. **Android SHA256 fingerprint**
   - Replace `YOUR_SHA256_FINGERPRINT_HERE` with actual fingerprint
   - Get fingerprint from Google Play Console or debug build

### Debug Steps

1. Check Vercel deployment logs
2. Verify file accessibility via browser
3. Test with different link formats
4. Check device universal links settings

## Next Steps

1. Deploy current changes to Vercel
2. Build app with updated configuration
3. Test universal links on both platforms
4. Update Android SHA256 fingerprint when available 