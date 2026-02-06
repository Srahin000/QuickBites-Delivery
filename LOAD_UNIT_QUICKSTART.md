# Load Unit Capacity System - Quick Start

## What Was Implemented

✅ **Phase 1-4: Cart Load Calculator & UI Warnings**
- Created `utils/cartLoadCalculator.js` with smart load calculation
- Added real-time capacity warnings (yellow at 15 LU, red at 20+ LU)
- Shows bag capacity score: "12.5/20.0 LU (10.5 food + 2.0 drinks)"

✅ **Phase 5: Smart Slot Finder**
- Created `supabase/find_next_available_slot.sql` RPC function
- Finds next available slot that can fit the order
- Returns NULL when shop is at full capacity

✅ **Phase 6: Smart ETA Display**
- Shows estimated delivery time on checkout button
- Displays "High Demand" warning if slots are delayed
- Disables checkout with "Shop Full" when at capacity
- Real-time slot checking as cart changes

✅ **Database Setup Scripts**
- `setup_load_unit_system.sql` - Complete database preparation
- Adds capacity columns to `delivery_times`
- Populates `load_unit` values in `menu_items`
- Creates helpful views and indexes

## Quick Start (5 Minutes)

### 1. Run Database Setup
```bash
# In Supabase SQL Editor:
# Run: supabase/setup_load_unit_system.sql
# Then: supabase/find_next_available_slot.sql
```

### 2. Test the App
```bash
# The app is ready to use!
# Add items to cart and watch:
# - Load score updates in real-time
# - Warnings appear at 15+ LU
# - Smart delivery time shows on button
```

### 3. Test Scenarios
- **Normal Order**: Add 2 burritos (12 LU) → No warning
- **Large Order**: Add 3 bowls (15 LU) → Yellow badge
- **Heavy Order**: Add 4 burritos (24 LU) → Red "split delivery" warning
- **Drinks Test**: Add 6 drinks → First 4 free, next 2 add 8 LU

## Key Features

### Automatic Load Calculation
```javascript
// Calculated automatically for every cart change:
cartLoad = {
  totalScore: 17.5,
  foodLoad: 15.5,
  drinkLoad: 2.0,
  drinkCount: 5,
  internalDrinks: 1  // 5 drinks - 4 free slots = 1 internal
}
```

### Smart Warnings
```
🟡 Large Order (15-20 LU)
"Large Order: Handled with extra care"

🔴 Heavy Load (20+ LU)
"Multi-Trip Order: Items will arrive in split deliveries"
```

### Capacity Checking
```
✅ Available: "Order for 1:20 PM"
⏳ Delayed: "Order for 2:00 PM" + "High Demand: Next available slot"
❌ Full: "Shop Full - Check Back Later" (button disabled)
```

## What's Next (Phase 7 - Not Implemented Yet)

The system is ready for split delivery logic when needed:

```javascript
// Future enhancement:
if (cartLoad.totalScore > 20) {
  // Reserve 2 slots automatically
  const slot1 = await supabase.rpc('find_next_available_slot', { required_load: 20 });
  const slot2 = await supabase.rpc('find_next_available_slot', { required_load: remainder });
  
  // Create order with split_dispatch: true
  // Track both delivery windows
}
```

## Files Created/Modified

### New Files
1. `utils/cartLoadCalculator.js` - Load calculation utilities
2. `supabase/find_next_available_slot.sql` - RPC function
3. `supabase/setup_load_unit_system.sql` - Database setup
4. `LOAD_UNIT_SYSTEM.md` - Full documentation

### Modified Files
1. `screens/TabCartScreen.js` - Added capacity UI and smart slot checking

## Troubleshooting

**Warning not showing?**
```javascript
// Check console:
console.log('Cart Load:', cartLoad);
// Should show totalScore, foodLoad, drinkLoad
```

**RPC function error?**
```sql
-- Verify it exists:
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'find_next_available_slot';
```

**Load units are 0?**
```sql
-- Check menu items:
SELECT dish_name, load_unit FROM menu_items;
-- Run setup_load_unit_system.sql if values are 0
```

## Admin Monitoring

View current capacity:
```sql
SELECT * FROM v_delivery_capacity;
-- Shows: time_slot, current_load, available_lu, usage_percent, status
```

View heavy orders:
```sql
SELECT * FROM v_heavy_orders;
-- Shows: orders > 15 LU with customer email and size category
```

## Success! 🎉

Your delivery capacity system is now:
- ✅ Calculating load in real-time
- ✅ Warning customers about large orders
- ✅ Finding optimal delivery slots
- ✅ Preventing overload with smart scheduling
- ✅ Disabling checkout when at capacity

Test it by adding items to your cart and watching the magic happen!
