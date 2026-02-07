# Dev Mode Changes Backup

This file contains the changes made to implement dev mode payment bypass functionality.

## Files Modified

### 1. screens/CartScreen.js

**Changes Made:**
- Added `devModeEnabled` state variable
- Added dev mode toggle button UI
- Added dev mode bypass logic for both instant pay and regular Stripe payment flows

**Key Code Changes:**

#### Added State Variable (line ~21):
```javascript
const [devModeEnabled, setDevModeEnabled] = useState(false);
```

#### Added Dev Mode Toggle Button (lines ~365-373):
```javascript
{/* 🧪 Dev Mode Toggle Button */}
<TouchableOpacity
  onPress={() => setDevModeEnabled(!devModeEnabled)}
  className={`p-3 rounded-xl border-2 mb-2 ${devModeEnabled ? 'bg-purple-100 border-purple-500' : 'bg-gray-100 border-gray-300'}`}
>
  <Text className={`font-semibold text-center ${devModeEnabled ? 'text-purple-700' : 'text-gray-600'}`}>
    🧪 Dev Mode: {devModeEnabled ? 'ON (Skip Payment)' : 'OFF'}
  </Text>
</TouchableOpacity>
```

#### Added Dev Mode Bypass for Instant Pay (lines ~383-428):
```javascript
// 🧪 Dev Mode: Skip payment and go directly to order creation
if (devModeEnabled) {
  console.log('🧪 DEV MODE: Skipping payment, creating order directly...');
  const instantCode = Math.floor(100000 + Math.random() * 900000);
  
  // Insert order directly
  const { data: orderData, error: orderError } = await supabase.from('orders').insert([
    {
      user_id: user.id,
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.restaurant_name,
      items: cartItems,
      total,
      status: 'paid',
      created_at: new Date(),
      order_code: instantCode.toString(),
      delivery_location: selectedLocation?.location || "Main Entrance - City College",
      delivery_time: selectedTimeSlot?.id || null,
    },
  ]).select().single();

  if (orderError) {
    console.error("Dev mode order insert error:", orderError);
    Alert.alert('Error', 'Failed to create order in dev mode.');
    return;
  }

  // Insert status
  const { error: statusError } = await supabase.from('order_status').insert([
    {
      order_id: orderData.id,
      status: 'submitted',
      created_at: new Date(),
    },
  ]);

  if (statusError) {
    console.error("Dev mode status insert error:", statusError);
  }

  // Clear cart and navigate
  clearCart();
  Alert.alert('✅ Dev Mode Order Placed!', `Order #${instantCode} created successfully!`);
  navigation.navigate('Orders');
  return;
}
```

#### Added Dev Mode Bypass for Regular Stripe Payment (lines ~498-563):
```javascript
// 🧪 Dev Mode: Skip payment and go directly to order creation
if (devModeEnabled) {
  console.log('🧪 DEV MODE: Skipping Stripe payment, creating order directly...');
  let newOrderCode;
  let isUnique = false;

  while (!isUnique) {
    newOrderCode = Math.floor(100000 + Math.random() * 900000);
    
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const { data: existingOrders } = await supabase
      .from('orders')
      .select('order_code')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .eq('order_code', newOrderCode.toString());

    if (!existingOrders || existingOrders.length === 0) {
      isUnique = true;
    }
  }

  // Insert order directly
  const { data: orderData, error: orderError } = await supabase.from('orders').insert([
    {
      user_id: user.id,
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.restaurant_name,
      items: cartItems,
      total,
      status: 'paid',
      created_at: new Date(),
      order_code: newOrderCode.toString(),
      delivery_location: selectedLocation?.location || "Main Entrance - City College",
      delivery_time: selectedTimeSlot?.id || null,
    },
  ]).select().single();

  if (orderError) {
    console.error("Dev mode order insert error:", orderError);
    Alert.alert('Error', 'Failed to create order in dev mode.');
    return;
  }

  // Insert status
  const { error: statusError } = await supabase.from('order_status').insert([
    {
      order_id: orderData.id,
      status: 'submitted',
      created_at: new Date(),
    },
  ]);

  if (statusError) {
    console.error("Dev mode status insert error:", statusError);
  }

  // Clear cart and navigate
  clearCart();
  Alert.alert('✅ Dev Mode Order Placed!', `Order #${newOrderCode} created successfully!`);
  navigation.navigate('Orders');
  return;
}
```

## How to Revert Changes

To remove dev mode functionality and restore original behavior:

1. **Remove the dev mode state variable:**
   - Delete: `const [devModeEnabled, setDevModeEnabled] = useState(false);`

2. **Remove the dev mode toggle button:**
   - Delete the entire TouchableOpacity block for the dev mode toggle (lines ~365-373)

3. **Remove dev mode bypass logic:**
   - In the instant pay flow: Remove the `if (devModeEnabled) { ... return; }` block
   - In the regular payment flow: Remove the `if (devModeEnabled) { ... return; }` block

4. **Restore original function signatures:**
   - Make sure the `onPress` handlers start with the original logic (instantCode generation, etc.)

## Benefits of Dev Mode

- ✅ Skip Stripe payment processing during development
- ✅ Test complete order flow without payment barriers
- ✅ Create real orders in database for testing
- ✅ Easy toggle between dev and production modes
- ✅ Maintains all order data integrity

## Notes

- Dev mode creates real orders with "paid" status
- Order codes are still generated uniquely
- All database operations remain the same
- Only payment processing is bypassed
- Console logs help track dev mode usage

### 2. screens/TabCartScreen.js

**Changes Made:**
- Added dev mode toggle button UI
- Added dev mode bypass logic for both instant pay and regular Stripe payment flows
- Added debug information display

**Key Code Changes:**

#### Added Dev Mode Toggle Button (lines ~373-384):
```javascript
{/* 🧪 Dev Mode Toggle Button */}
<TouchableOpacity
  onPress={() => {
    console.log('🔍 DEBUG: Toggling dev mode from', devModeEnabled, 'to', !devModeEnabled);
    setDevModeEnabled(!devModeEnabled);
  }}
  className={`p-3 rounded-xl border-2 mb-2 ${devModeEnabled ? 'bg-purple-100 border-purple-500' : 'bg-gray-100 border-gray-300'}`}
>
  <Text className={`font-semibold text-center ${devModeEnabled ? 'text-purple-700' : 'text-gray-600'}`}>
    🧪 Dev Mode: {devModeEnabled ? 'ON (Skip Payment)' : 'OFF'}
  </Text>
</TouchableOpacity>
```

#### Added Debug Info Display (lines ~386-389):
```javascript
{/* Debug Info */}
<Text className="text-xs text-gray-500 text-center mb-2">
  Debug: instantPayEnabled={instantPayEnabled ? 'true' : 'false'}, canPlaceOrder={canPlaceOrder ? 'true' : 'false'}
</Text>
```

#### Added Dev Mode Bypass for Instant Pay (lines ~399-445):
```javascript
// 🧪 Dev Mode: Skip payment and go directly to order creation
console.log('🔍 DEBUG: devModeEnabled =', devModeEnabled);
if (devModeEnabled) {
  console.log('🧪 DEV MODE: Skipping payment, creating order directly...');
  const instantCode = Math.floor(100000 + Math.random() * 900000);
  
  // Insert order directly
  const { data: orderData, error: orderError } = await supabase.from('orders').insert([
    {
      user_id: user.id,
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.restaurant_name,
      items: cartItems,
      total,
      status: 'paid',
      created_at: new Date(),
      order_code: instantCode.toString(),
      delivery_location: selectedLocation?.location || "Main Entrance - City College",
      delivery_time: selectedTimeSlot?.id || null,
    },
  ]).select().single();

  if (orderError) {
    console.error("Dev mode order insert error:", orderError);
    Alert.alert('Error', 'Failed to create order in dev mode.');
    return;
  }

  // Insert status
  const { error: statusError } = await supabase.from('order_status').insert([
    {
      order_id: orderData.id,
      status: 'submitted',
      created_at: new Date(),
    },
  ]);

  if (statusError) {
    console.error("Dev mode status insert error:", statusError);
  }

  // Clear cart and navigate
  clearCart();
  Alert.alert('✅ Dev Mode Order Placed!', `Order #${instantCode} created successfully!`);
  navigation.navigate('Orders');
  return;
}
```

#### Added Dev Mode Bypass for Regular Stripe Payment (lines ~514-581):
```javascript
// 🧪 Dev Mode: Skip payment and go directly to order creation
console.log('🔍 DEBUG: devModeEnabled =', devModeEnabled);
if (devModeEnabled) {
  console.log('🧪 DEV MODE: Skipping Stripe payment, creating order directly...');
  let newOrderCode;
  let isUnique = false;

  while (!isUnique) {
    newOrderCode = Math.floor(100000 + Math.random() * 900000);
    
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const { data: existingOrders } = await supabase
      .from('orders')
      .select('order_code')
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .eq('order_code', newOrderCode.toString());

    if (!existingOrders || existingOrders.length === 0) {
      isUnique = true;
    }
  }

  // Insert order directly
  const { data: orderData, error: orderError } = await supabase.from('orders').insert([
    {
      user_id: user.id,
      restaurant_id: restaurant.id,
      restaurant_name: restaurant.restaurant_name,
      items: cartItems,
      total,
      status: 'paid',
      created_at: new Date(),
      order_code: newOrderCode.toString(),
      delivery_location: selectedLocation?.location || "Main Entrance - City College",
      delivery_time: selectedTimeSlot?.id || null,
    },
  ]).select().single();

  if (orderError) {
    console.error("Dev mode order insert error:", orderError);
    Alert.alert('Error', 'Failed to create order in dev mode.');
    return;
  }

  // Insert status
  const { error: statusError } = await supabase.from('order_status').insert([
    {
      order_id: orderData.id,
      status: 'submitted',
      created_at: new Date(),
    },
  ]);

  if (statusError) {
    console.error("Dev mode status insert error:", statusError);
  }

  // Clear cart and navigate
  clearCart();
  Alert.alert('✅ Dev Mode Order Placed!', `Order #${newOrderCode} created successfully!`);
  navigation.navigate('Orders');
  return;
}
```

---
**Created:** $(date)
**Purpose:** Backup dev mode changes for easy reversion
