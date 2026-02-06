# Referral Status Tracking System

## Overview
This system implements a comprehensive referral tracking mechanism that:
1. Allows users to enter referral codes **only at signup**
2. Grants referees a "REFERRED" coupon (free delivery) and a "referred" status
3. Grants referrers a "REFERRAL50" coupon (50% off) with a usage counter
4. Tracks user statuses for targeted notifications
5. Automatically removes "referred" status when the REFERRED coupon is used

## Database Changes

### New Table: `user_statuses`
Tracks user statuses for targeted notifications:
- `id` (UUID) - Primary key
- `user_id` (UUID) - Foreign key to users
- `status` (VARCHAR) - Status name (e.g., 'referred')
- `created_at` (TIMESTAMP) - When status was added
- `removed_at` (TIMESTAMP) - When status was removed (NULL = active)
- `metadata` (JSONB) - Additional data (e.g., referral_code, referrer_id)

### Updated Table: `user_referral_codes`
Added column:
- `coupon_uses_remaining` (INTEGER) - Counter for REFERRAL50 coupon uses

### Coupons Created
1. **REFERRED** - 100% off delivery fee, one-time use, expires in 90 days
2. **REFERRAL50** - 50% off all fees, controlled by `coupon_uses_remaining`, expires in 1 year

## Database Functions

### `process_referral_signup(p_referee_user_id, p_referral_code)`
Processes referral code at signup:
- Validates referral code exists
- Prevents self-referral
- Prevents duplicate referral usage
- Creates `referral_usage` record
- Adds "referred" status to referee
- Grants REFERRED coupon to referee
- Increments referrer's `coupon_uses_remaining` counter
- Grants REFERRAL50 coupon to referrer (if not already have it)

### `add_user_status(p_user_id, p_status, p_metadata)`
Adds a status to a user (removes existing active status first)

### `remove_user_status(p_user_id, p_status)`
Removes a status from a user (sets `removed_at` timestamp)

### `has_user_status(p_user_id, p_status)`
Checks if user has an active status

### `get_users_with_status(p_status)`
Returns all users with a specific active status (for targeted notifications)

## Triggers

### `trigger_remove_referred_status`
Automatically fires when a coupon status changes to 'applied':
- If REFERRED coupon: Removes "referred" status from user
- If REFERRAL50 coupon: Decrements `coupon_uses_remaining` counter

## Frontend Changes

### SignupScreen.js
- Added referral code input field (only shown if `service_approval` ID 4 is enabled)
- Stores referral code in AsyncStorage during signup
- Processes referral code after successful signup/email confirmation
- Calls `process_referral_signup` RPC function

### RewardsScreen.js
- Displays user's referral code
- Shows REFERRAL50 coupon code and `coupon_uses_remaining` counter
- Displays referral stats (total referrals, pending rewards)

### TabCartScreen.js
- Validates REFERRAL50 coupon usage against `coupon_uses_remaining` counter
- Prevents redemption if counter is 0
- Trigger automatically handles counter decrement and status removal

### AnnouncementsScreen.js
- Added "Referred Users" audience option
- Uses `notifyByStatus('referred', payload)` to send targeted notifications

### notificationService.js
- Added `notifyByStatus(status, payload)` method
- Uses `get_users_with_status` RPC function to fetch users with specific status

## Flow Diagram

```
Signup with Referral Code
    ↓
process_referral_signup() called
    ↓
┌─────────────────────────────────────┐
│ Referee (New User)                  │
│ - Gets "referred" status            │
│ - Gets REFERRED coupon              │
│ - referral_usage record created    │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Referrer (Existing User)            │
│ - coupon_uses_remaining++           │
│ - Gets REFERRAL50 coupon            │
└─────────────────────────────────────┘

Referee uses REFERRED coupon
    ↓
Trigger fires
    ↓
"referred" status removed
```

## Usage

### For Users
1. During signup, enter a referral code (optional)
2. Referee receives REFERRED coupon automatically
3. Referee can use REFERRED coupon for free delivery
4. After using REFERRED coupon, "referred" status is removed
5. Referrer sees REFERRAL50 coupon in Rewards tab with usage counter

### For Admins
1. Go to Admin Panel → Announcements
2. Select "Referred Users" audience
3. Send targeted notifications to users with "referred" status
4. Users lose this status after redeeming their REFERRED coupon

## SQL Migration
Run `supabase/referral_status_tracking.sql` in your Supabase SQL Editor to:
- Create `user_statuses` table
- Add `coupon_uses_remaining` column
- Create REFERRED and REFERRAL50 coupons
- Create all functions and triggers
- Set up RLS policies

## Service Approval
The referral system is controlled by `service_approval` table, ID 4:
- `open = true`: Referral system enabled
- `open = false`: Referral system disabled

## Notes
- Referral codes can only be entered at signup
- Each referral increments the referrer's counter by 1
- REFERRAL50 coupon can be used multiple times (up to counter limit)
- REFERRED coupon is one-time use
- Status removal is automatic via database trigger
- Targeted notifications use the `user_statuses` table for efficient querying
