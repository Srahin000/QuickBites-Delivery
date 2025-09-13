# Time Slot Functionality Setup Guide

## 🚀 Quick Setup

### Step 1: Create Supabase Table
1. **Go to Supabase Dashboard** → SQL Editor
2. **Run the SQL script** from `supabase/delivery_times_setup.sql`
3. **Verify table creation** in Table Editor

### Step 2: Test the Functionality
1. **Open your app** → Go to Cart Screen
2. **Add items to cart** → Click "Select Delivery Time"
3. **Choose a time slot** → Confirm selection
4. **Verify counter increments** in Supabase table

## 📊 Database Structure

### `delivery_times` Table:
```sql
- id: SERIAL PRIMARY KEY
- day: VARCHAR(20) NOT NULL (Monday, Tuesday, etc.)
- time: TIME NOT NULL (09:00:00, 10:00:00, etc.)
- counter: INTEGER DEFAULT 0 (0-10 orders per slot)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Sample Data:
- **Monday slots:** 9:00 AM - 8:00 PM (12 slots)
- **All days:** Same time slots for consistency
- **Counter starts at 0** for all slots

## 🎯 How It Works

### 1. Time Slot Selection:
- **User taps** "Select Delivery Time" in cart
- **Modal opens** showing available Monday slots
- **Real-time data** from Supabase delivery_times table
- **Visual indicators** for slot availability

### 2. Slot Availability:
- **Available (0-7 orders):** Green badge
- **Almost Full (8-9 orders):** Yellow badge  
- **Full (10+ orders):** Red badge, disabled

### 3. Counter Logic:
- **User selects slot** → Counter increments by 1
- **Slot locks** when counter reaches 10
- **Real-time updates** across all users

## 🧪 Testing

### Test Scenarios:
1. **Select available slot** → Counter should increment
2. **Select full slot** → Should show error message
3. **Multiple users** → Counters should update in real-time
4. **Slot locking** → Full slots should be disabled

### Hardcoded Monday Testing:
- **Current implementation** hardcoded to Monday
- **Easy to test** without date logic
- **Change later** to dynamic day detection

## 🔧 Customization

### Change Time Slots:
```sql
-- Add new time slots
INSERT INTO delivery_times (day, time, counter) VALUES
('Monday', '21:00:00', 0),
('Monday', '22:00:00', 0);
```

### Change Slot Capacity:
```javascript
// In TimeSlotModal.js, change the limit
if (timeSlot.counter >= 10) { // Change 10 to desired limit
```

### Add More Days:
```javascript
// In TimeSlotModal.js, change the hardcoded day
const currentDay = 'Tuesday'; // Change from 'Monday'
```

## 📱 User Experience

### Time Selection UI:
- **Clean modal** with time slots
- **Visual status indicators** (Available/Almost Full/Full)
- **Counter display** (X/10 orders)
- **Easy selection** with tap to choose

### Cart Integration:
- **Shows selected time** in cart
- **Displays slot status** (X/10 orders)
- **Easy to change** by tapping time selection

## 🚨 Important Notes

### Security:
- **Counter updates** are atomic (prevents race conditions)
- **Slot locking** prevents overbooking
- **Real-time validation** before selection

### Performance:
- **Indexed queries** for fast time slot loading
- **Efficient updates** with single counter increment
- **Minimal data transfer** (only necessary fields)

### Future Enhancements:
- **Dynamic day detection** (remove hardcoded Monday)
- **Time zone handling** for different regions
- **Admin panel** for managing time slots
- **Analytics** for popular time slots

## ✅ Success Indicators

- [ ] Time slots load from Supabase
- [ ] Counter increments when slot selected
- [ ] Full slots are disabled
- [ ] Real-time updates work
- [ ] UI shows correct status
- [ ] Cart displays selected time

## 🐛 Troubleshooting

### Time Slots Not Loading:
- Check Supabase table exists
- Verify RLS policies allow SELECT
- Check network connection

### Counter Not Updating:
- Check RLS policies allow UPDATE
- Verify user authentication
- Check for JavaScript errors

### Modal Not Opening:
- Check TimeSlotModal import
- Verify modal state management
- Check for navigation issues

## 🎉 Ready to Use!

Your time slot functionality is now complete and ready for testing. Users can select delivery times with real-time availability tracking and automatic slot locking when full!
