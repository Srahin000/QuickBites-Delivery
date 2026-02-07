# Load Unit Capacity System - Implementation Guide

## Overview
The Load Unit (LU) system manages delivery capacity by calculating the weight/volume of orders and matching them to available delivery slots. This prevents overloading delivery personnel and enables smart delivery time estimation.

## Database Setup

### 1. Run the RPC Function
Execute the SQL file in your Supabase SQL Editor:
```bash
# File location: /supabase/find_next_available_slot.sql
```

This creates the `find_next_available_slot(required_load NUMERIC)` function that:
- Finds the first available slot that can accommodate the order
- Returns slot info including estimated time and capacity
- Returns NULL if all slots are full

### 2. Update delivery_times Table
Ensure your `delivery_times` table has these columns:
```sql
-- Add if missing:
ALTER TABLE delivery_times ADD COLUMN IF NOT EXISTS current_load_lu NUMERIC DEFAULT 0;
ALTER TABLE delivery_times ADD COLUMN IF NOT EXISTS max_capacity_lu NUMERIC DEFAULT 20;
ALTER TABLE delivery_times ADD COLUMN IF NOT EXISTS slot_timestamp TIMESTAMP;

-- Update slot_timestamp for existing rows:
UPDATE delivery_times 
SET slot_timestamp = (
  CURRENT_DATE + 
  (hours::int + CASE WHEN ampm = 'PM' AND hours != 12 THEN 12 ELSE 0 END) * INTERVAL '1 hour' + 
  COALESCE(minutes, 0) * INTERVAL '1 minute'
);
```

### 3. Update menu_items Table
Ensure all menu items have the `load_unit` column populated:
```sql
-- Check if column exists:
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'menu_items' AND column_name = 'load_unit';

-- Add if missing:
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS load_unit NUMERIC DEFAULT 0;

-- Update example values:
UPDATE menu_items SET load_unit = 6.0 WHERE dish_name LIKE '%Burrito%';
UPDATE menu_items SET load_unit = 5.0 WHERE dish_name LIKE '%Bowl%';
UPDATE menu_items SET load_unit = 3.0 WHERE dish_name LIKE '%Taco%';
UPDATE menu_items SET load_unit = 2.0 WHERE dish_name LIKE '%Side%';
```

## Load Unit Calculation Logic

### Food Items
Each food item has a `load_unit` value representing its physical space in the delivery bag:
- Burrito: 6.0 LU
- Bowl: 5.0 LU
- Taco (3-pack): 3.0 LU
- Sides: 2.0 LU
- Small items: 1.0 LU

### Drink Logic
Drinks are handled specially:
- **First 4 drinks**: 0 LU (fit in external backpack pockets)
- **5th drink and beyond**: 4.0 LU each (require internal bag space + carrier)

Example:
- Order with 3 drinks: 0 LU from drinks
- Order with 6 drinks: (6-4) × 4.0 = 8.0 LU from drinks

### Capacity Thresholds
- **0-15 LU**: Normal order (no warning)
- **15-20 LU**: Large order (yellow badge: "Handled with extra care")
- **20+ LU**: Heavy load (red badge: "Multi-trip delivery required")

## Features Implemented

### 1. Cart Load Calculator (`utils/cartLoadCalculator.js`)
Two utility functions:
- `calculateCartLoad(cartItems)`: Returns total score, breakdown by food/drinks
- `getLoadWarning(totalScore)`: Returns UI properties for warning badges

### 2. Real-Time Capacity Warnings
Yellow badge appears when order exceeds 15 LU:
```
⚠️ Large Order: Handled with extra care
Bag Capacity: 17.5/20.0 LU (15.5 food + 2.0 drinks)
```

Red badge appears when order exceeds 20 LU:
```
🚨 Multi-Trip Order: Items will arrive in split deliveries
Bag Capacity: 24.0/20.0 LU (20.0 food + 4.0 drinks)
```

### 3. Smart Delivery Slot Finder
The app automatically:
- Calculates cart load when items are added/removed
- Queries `find_next_available_slot()` with the required load
- Shows estimated delivery time on the checkout button
- Warns if slots are delayed due to high demand
- Disables checkout if shop is at full capacity

### 4. Capacity Status Indicators

**Loading State:**
```
⏳ Finding optimal delivery slot...
```

**Shop Full:**
```
🚨 Maximum Capacity Reached
All delivery slots are full. Please check back later or reduce your order size.
```

**High Demand:**
```
🕐 High Demand: Next available slot selected
Estimated delivery: 2:00 PM
```

**Place Order Button:**
- Normal: "Place Order"
- With estimate: "Order for 1:20 PM"
- Shop full: "Shop Full - Check Back Later" (disabled)

## Testing the System

### Test Case 1: Normal Order
```javascript
// Add 2 burritos = 12 LU
// Expected: No warning, normal checkout
```

### Test Case 2: Large Order
```javascript
// Add 3 bowls = 15 LU
// Expected: Yellow "Large Order" badge appears
```

### Test Case 3: Drink Logic
```javascript
// Add 2 burritos (12 LU) + 6 drinks
// Drink calculation: (6-4) × 4.0 = 8.0 LU
// Total: 12 + 8 = 20 LU
// Expected: Red warning badge
```

### Test Case 4: Shop Full Scenario
```sql
-- Simulate full capacity:
UPDATE delivery_times 
SET current_load_lu = 18, max_capacity_lu = 20 
WHERE slot_timestamp > NOW();

-- Then add 15 LU order in app
-- Expected: "Maximum Capacity Reached" warning, disabled checkout
```

### Test Case 5: Delayed Slot
```sql
-- Make first slot almost full:
UPDATE delivery_times 
SET current_load_lu = 19, max_capacity_lu = 20 
WHERE slot_timestamp = (SELECT MIN(slot_timestamp) FROM delivery_times WHERE slot_timestamp > NOW());

-- Then add 5 LU order
-- Expected: "High Demand" warning with second slot time
```

## Future Enhancements (Phase 7)

### Split Order Logic
For orders > 20 LU, implement automatic split:
```javascript
// In createOrdersByRestaurant function:
if (cartLoad.totalScore > 20) {
  // Find slot for first 20 LU
  const slot1 = await supabase.rpc('find_next_available_slot', { required_load: 20 });
  
  // Find slot for remainder
  const remainder = cartLoad.totalScore - 20;
  const slot2 = await supabase.rpc('find_next_available_slot', { required_load: remainder });
  
  // Create order with split_dispatch: true
  // Store both slot IDs
}
```

### Load Unit Tracking
Update slot capacity when order is placed:
```javascript
// After successful payment:
await supabase
  .from('delivery_times')
  .update({ 
    current_load_lu: selectedTimeSlot.current_load_lu + cartLoad.totalScore 
  })
  .eq('id', selectedTimeSlot.id);
```

## Troubleshooting

### RPC Function Not Found
```bash
# Check if function exists:
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'find_next_available_slot';

# Re-run the SQL file if missing
```

### Load Calculator Returns 0
```javascript
// Check if menu items have load_unit:
console.log('Cart items:', cartItems.map(i => ({ 
  name: i.name, 
  load_unit: i.load_unit 
})));

// If undefined, update menu_items query to include load_unit
```

### Warnings Not Appearing
```javascript
// Check calculation:
console.log('Cart Load:', cartLoad);
// Should show: { totalScore, foodLoad, drinkLoad, drinkCount, ... }

// Check memo dependencies:
// cartLoad should recalculate when cartItems changes
```

## Admin Tools

### Monitor Current Capacity
```sql
SELECT 
  id,
  CONCAT(hours, ':', LPAD(COALESCE(minutes::text, '00'), 2, '0'), ' ', ampm) as time_slot,
  current_load_lu,
  max_capacity_lu,
  (max_capacity_lu - current_load_lu) as available_capacity,
  ROUND((current_load_lu / max_capacity_lu * 100)::numeric, 1) as usage_percent
FROM delivery_times
WHERE slot_timestamp > NOW()
ORDER BY slot_timestamp;
```

### Reset Capacity (Development)
```sql
UPDATE delivery_times SET current_load_lu = 0;
```

### View Heavy Orders
```sql
-- Add metadata to orders table:
ALTER TABLE orders ADD COLUMN IF NOT EXISTS load_unit_total NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_split_delivery BOOLEAN DEFAULT false;

-- Query heavy orders:
SELECT order_code, load_unit_total, total, created_at
FROM orders 
WHERE load_unit_total > 20
ORDER BY created_at DESC;
```

## Files Modified

1. **utils/cartLoadCalculator.js** (NEW)
   - `calculateCartLoad()` function
   - `getLoadWarning()` function

2. **screens/TabCartScreen.js**
   - Added cart load calculation with useMemo
   - Added delivery estimate state
   - Added capacity warning UI
   - Added smart slot finder useEffect
   - Updated checkout buttons with capacity checks

3. **supabase/find_next_available_slot.sql** (NEW)
   - RPC function for smart slot finding
   - Handles capacity checks and delayed slots

## Next Steps

1. **Test in Development**: Verify all calculations and warnings
2. **Deploy RPC Function**: Run SQL in production Supabase
3. **Populate Load Units**: Update all menu items with realistic LU values
4. **Monitor Performance**: Track slot utilization and customer experience
5. **Implement Phase 7**: Add split delivery logic for 20+ LU orders
