# Admin Profile & Logout Feature

## Overview
Added a profile button to the Admin Dashboard that allows admins to access their profile screen and log out.

## Changes Made

### Updated `AdminDashboardScreen.js`
- Added a **Profile button** (User icon) in the top-right corner of the header
- The button navigates to the ProfileScreen
- Positioned symmetrically with the existing Home button on the left

## How to Use

### For Admins:
1. Log in as an admin
2. On the Admin Dashboard, look at the top-right corner of the purple header
3. Tap the **Profile icon** (User icon in a circular button)
4. This opens the Profile Screen where you can:
   - View your full name and email
   - Change your password
   - Suggest a restaurant
   - **Sign out** using the logout button

### Profile Screen Features:
- **View Profile Information**: See your name, email, and role
- **Change Password**: Secure password update with verification
- **Suggest a Restaurant**: Submit restaurant suggestions
- **Sign Out**: Log out button that:
  - Clears your cart
  - Unregisters push notification tokens for the current device
  - Signs you out of your account
  - Shows a confirmation message

## Navigation Flow
```
Admin Dashboard → (Tap Profile Icon) → Profile Screen → (Tap Sign Out) → Signed Out
```

## UI Details
- **Profile Button Location**: Top-right corner of Admin Dashboard header
- **Icon**: User icon (from react-native-feather)
- **Style**: Circular white button with shadow, matching the Home button style
- **Navigation**: Already connected to ProfileScreen which exists in the admin navigation stack

## Security
- Password change requires current password verification
- Sign out properly cleans up session and device tokens
- Logout is confirmed with an alert message
