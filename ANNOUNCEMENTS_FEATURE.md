# Announcements Feature

## Overview
Added a new admin feature to send push notifications as announcements to users. Admins can choose to send announcements to all users, specific user roles, or individually selected users.

## Changes Made

### 1. New Screen: `AnnouncementsScreen.js`
Location: `/screens/AdminScreens/AnnouncementsScreen.js`

**Features:**
- Title and message input fields
- Five audience selection options:
  - **All Users** - Send to every user in the system
  - **All Customers** - Send only to users with 'customer' role
  - **All Deliverers** - Send only to users with 'deliverer' role
  - **All Admins** - Send only to users with 'admin' role
  - **Select Specific Users** - Choose individual users from a list
- User selection interface with checkboxes
- Confirmation dialog before sending
- Success/failure feedback

### 2. Updated `notificationService.js`
Added three new methods:

```javascript
// Send notification to all users in the system
async notifyAllUsers(payload)

// Send notification to users with a specific role
async notifyByRole(role, payload)

// Updated performNavigation to handle 'announcement' type notifications
```

### 3. Updated `AdminDashboardScreen.js`
- Added new "Announcements" button with Bell icon
- Navigation to the Announcements screen

### 4. Updated `navigation.js`
- Imported `AnnouncementsScreen`
- Added route to admin navigation stack

## How to Use

### For Admins:
1. Log in as an admin
2. Go to Admin Dashboard
3. Tap on "Announcements" button
4. Enter announcement title and message
5. Select target audience:
   - Tap "All Users" to notify everyone
   - Tap "All Customers" to notify only customers
   - Tap "All Deliverers" to notify only deliverers
   - Tap "All Admins" to notify only admins
   - Tap "Select Specific Users" to choose individual recipients
6. If selecting specific users, tap on users to select/deselect them
7. Tap "Send to [audience]" button
8. Confirm in the alert dialog
9. Wait for success confirmation

### Notification Behavior:
- Users will receive a push notification on their device
- The notification will show the title and message
- Tapping the notification won't navigate anywhere (just displays the message)
- Notifications are sent sequentially to avoid rate limiting

## Database Requirements

### Existing Tables Used:
- `users` - To fetch user list and roles
- `push_tokens` - To send notifications to devices

No new database tables or columns are required.

## API/Edge Functions Used:
- `send-notification` - Supabase Edge Function for sending push notifications

## Future Enhancements (Optional):
1. Add announcement history/logs
2. Schedule announcements for future delivery
3. Add rich media support (images, links)
4. Create a dedicated announcements/notifications screen for users to view past announcements
5. Add notification preferences for users to opt-in/out of announcements
6. Add analytics to track notification open rates
