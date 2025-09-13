# Password Reset Website Deployment Guide

## 🚀 Quick Deployment to Vercel

### Step 1: Deploy to Vercel
1. **Go to [vercel.com](https://vercel.com)**
2. **Import your project** (or create new project)
3. **Upload the `public/reset-password.html` file**
4. **Deploy the project**

### Step 2: Get Your Website URL
After deployment, you'll get a URL like:
```
https://your-project-name.vercel.app/reset-password
```

### Step 3: Update Supabase Configuration
1. **Go to Supabase Dashboard** → Authentication → URL Configuration
2. **Add Site URL:** `https://your-project-name.vercel.app`
3. **Add Redirect URLs:**
   - `https://your-project-name.vercel.app/reset-password`
   - `com.srahin000.quickbites://reset-password`

### Step 4: Update Your App
The ForgotPasswordScreen is already configured to use:
```javascript
redirectTo: 'https://quickbites-delta.vercel.app/reset-password'
```

If you use a different Vercel URL, update this in `screens/ForgotPasswordScreen.js`

## 🧪 Testing the Complete Flow

### 1. Test Email Reset
1. **Open your app** → Sign In screen
2. **Click "Forgot Password?"**
3. **Enter your email** → Click "Send Reset Email"
4. **Check your email** for the reset link

### 2. Test Deep Link
1. **Click the reset link** in your email
2. **Website should open** → Show "Opening Quickbites app..."
3. **App should open** → ResetPasswordScreen
4. **Enter new password** → Success!

### 3. Test Fallback
1. **If app doesn't open** → Website shows fallback options
2. **Click "Try Again"** → Attempts to open app again
3. **Manual instructions** provided for troubleshooting

## 📱 How It Works

### Email Flow:
```
User clicks "Forgot Password?" 
→ Supabase sends email with link
→ Link: https://your-site.vercel.app/reset-password?access_token=abc123
→ User clicks link → Website opens
→ Website redirects to: com.srahin000.quickbites://reset-password?access_token=abc123
→ App opens → ResetPasswordScreen
```

### Token Handling:
- **Supabase generates** secure JWT token
- **Email contains** token in URL parameters
- **Website extracts** token and passes to app
- **App uses token** to verify reset session

## 🔧 Customization

### Change App Scheme:
If your app uses a different scheme, update in `reset-password.html`:
```javascript
const APP_SCHEME = 'your-app-scheme';
```

### Change Styling:
Edit the CSS in `reset-password.html` to match your brand colors.

### Add Analytics:
Add Google Analytics or other tracking to monitor usage.

## 🛠️ Troubleshooting

### App Doesn't Open:
1. **Check app scheme** in `app.json`
2. **Verify deep link** configuration
3. **Test with Safari** in simulator
4. **Check console logs** for errors

### Token Issues:
1. **Verify Supabase** redirect URLs
2. **Check token expiration** (usually 1 hour)
3. **Ensure proper** URL parameter handling

### Website Issues:
1. **Check Vercel deployment** logs
2. **Verify file** is in correct directory
3. **Test URL** manually in browser

## 📋 Checklist

- [ ] Deploy website to Vercel
- [ ] Update Supabase redirect URLs
- [ ] Test email sending
- [ ] Test deep link opening
- [ ] Test password reset flow
- [ ] Test fallback scenarios
- [ ] Remove test buttons from app

## 🎉 Success!

Once deployed, your password reset flow will be:
- **Professional** - Clean, branded website
- **User-friendly** - Clear instructions and fallbacks
- **Secure** - Proper token handling
- **Reliable** - Multiple redirect methods
