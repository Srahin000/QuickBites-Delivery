# Service Control System Guide

## Overview
Your QuickBites app has a service control system that manages when the delivery service is available. This system uses a Supabase table called `service_approval` to control service availability.

## Service Control Table Structure

The `service_approval` table has the following structure:
- `id` (Primary Key)
- `open` (Boolean) - Controls whether the service is available

## Service Control IDs

### ID 1 - Production Service Control
- **Purpose**: Controls the main delivery service availability
- **State Variable**: `serviceOpen` in CartScreen.js and TabCartScreen.js
- **To Enable Service**: Set `open = true` for `id = 1`
- **To Disable Service**: Set `open = false` for `id = 1`

### ID 2 - Development Payment Control
- **Purpose**: Controls whether the "Dev Pay" button is shown
- **State Variable**: `showDevPay` in CartScreen.js and TabCartScreen.js
- **To Hide Dev Pay Button**: Set `open = true` for `id = 2`
- **To Show Dev Pay Button**: Set `open = false` for `id = 2`

### ID 3 - Time Override Control ⭐ NEW
- **Purpose**: Bypasses all time restrictions when enabled
- **State Variable**: `timeOverride` in CartScreen.js and TabCartScreen.js
- **To Bypass Time Restrictions**: Set `open = true` for `id = 3`
- **To Use Normal Time Restrictions**: Set `open = false` for `id = 3`

## Time Restrictions (Hardcoded)

Even when `serviceOpen = true`, the service is still restricted by:

1. **Days**: Monday-Friday only (`isWeekday = today.getDay() >= 1 && today.getDay() <= 5`)
2. **Hours**: 10:00 AM - 3:00 PM only
   - Defined in `deliveryTimeSlots` array: `['10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM']`
   - Only shows time slots that are after the current hour

**EXCEPTION**: If `ID 3` is set to `open = true`, ALL time restrictions are bypassed!

## How to Keep Service Up 24/7

### Option 1: Quick Fix (Database Only) ⭐ RECOMMENDED
1. Set `open = true` for `id = 1` in the `service_approval` table (enables service)
2. Set `open = true` for `id = 3` in the `service_approval` table (bypasses time restrictions)
3. **No code changes needed!** The service will be available 24/7.

### Option 2: Complete 24/7 Service (Code + Database)
1. Set `open = true` for `id = 1` in the `service_approval` table
2. Modify the time restriction logic in `CartScreen.js` and `TabCartScreen.js`:

```javascript
// Replace this line:
const isOrderAllowed = serviceOpen && isWeekday && filteredTimeSlots.length > 0;

// With this:
const isOrderAllowed = serviceOpen; // Removes time restrictions
```

### Option 3: Extended Hours (Code + Database)
1. Set `open = true` for `id = 1` in the `service_approval` table
2. Modify the `deliveryTimeSlots` array to include more hours:

```javascript
// Replace this line:
const deliveryTimeSlots = ['10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM'];

// With this (example for 6 AM - 10 PM):
const deliveryTimeSlots = [
  '06:00 AM', '07:00 AM', '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', 
  '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', 
  '06:00 PM', '07:00 PM', '08:00 PM', '09:00 PM', '10:00 PM'
];
```

## Current Service Status Check

The app checks service status in the `useEffect` hook:

```javascript
useEffect(() => {
  const fetchServiceStatus = async () => {
    const { data: prodStatus, error: prodError } = await supabase
      .from('service_approval')
      .select('open')
      .eq('id', 1)  // Production service control
      .single();

    const { data: devStatus, error: devError } = await supabase
      .from('service_approval')
      .select('open')
      .eq('id', 2)  // Development payment control
      .single();

    const { data: timeOverrideStatus, error: timeOverrideError } = await supabase
      .from('service_approval')
      .select('open')
      .eq('id', 3)  // Time override control
      .single();

    if (prodError) console.error('Error fetching prod status:', prodError);
    else setServiceOpen(prodStatus.open);

    if (devError) console.error('Error fetching dev status:', devError);
    else setShowDevPay(!devStatus.open); // If dev "open" = true, hide Dev Pay

    if (timeOverrideError) console.error('Error fetching time override status:', timeOverrideError);
    else setTimeOverride(timeOverrideStatus.open); // If ID 3 "open" = true, bypass time restrictions
  };

  fetchServiceStatus();
}, []);
```

## Summary

**To answer your question**: 
- Setting `id = 1` to `open = true` enables the service but keeps time restrictions
- Setting `id = 3` to `open = true` bypasses ALL time restrictions
- **For 24/7 service**: Set both `id = 1` AND `id = 3` to `open = true` (no code changes needed!)

The new logic works as follows:
```javascript
const isOrderAllowed = serviceOpen && (timeOverride || (isWeekday && filteredTimeSlots.length > 0));
```

This means:
- Service must be open (`serviceOpen = true` from ID 1)
- AND either:
  - Time override is enabled (`timeOverride = true` from ID 3), OR
  - Normal time restrictions apply (weekday + available time slots)
