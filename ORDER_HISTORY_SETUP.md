# Order History System Setup Guide

## 🚀 Overview

The order history system automatically moves delivered orders from the main `orders` table to a separate `order_history` table, keeping current orders clean and providing a dedicated history view for completed deliveries.

## 📊 Database Setup

### Step 1: Create Order History Table
Run the SQL script in Supabase Dashboard → SQL Editor:

```sql
-- Run the contents of supabase/order_history_setup.sql
```

This creates:
- `order_history` table to store delivered orders
- Automatic trigger to move orders when status changes to 'delivered'
- Proper indexes for performance

### Step 2: Verify Table Creation
Check that the following tables exist:
- ✅ `orders` (existing)
- ✅ `order_status` (existing) 
- ✅ `order_history` (new)

## 🎯 How It Works

### 1. Order Lifecycle:
1. **Order Placed** → Stored in `orders` table
2. **Status Updates** → Tracked in `order_status` table
3. **Order Delivered** → Automatically moved to `order_history` table
4. **Order Deleted** → Removed from `orders` table

### 2. User Interface:
- **Current Orders Tab** → Shows only non-delivered orders
- **Order History Tab** → Shows all delivered orders
- **Order Details** → Works for both current and historical orders

### 3. Automatic Migration:
When an order status is updated to 'delivered':
- Order data is copied to `order_history` table
- Original order is deleted from `orders` table
- `delivered_at` timestamp is automatically set

## 🔧 Features Implemented

### ✅ Order Management:
- **Current Orders**: Only shows processing, preparing, on-the-way orders
- **Order History**: Shows all delivered orders with delivery date
- **Seamless Navigation**: Same order details screen for both types

### ✅ User Experience:
- **Tab Navigation**: Easy switching between current and history
- **Visual Indicators**: Different icons and colors for order status
- **Delivery Confirmation**: Special UI for completed orders
- **Order Tracking**: Full order details with timestamps

### ✅ Data Integrity:
- **Automatic Migration**: No manual intervention needed
- **Data Preservation**: All order data is maintained
- **Performance**: Optimized queries with proper indexing

## 📱 User Interface

### Orders Screen:
- **Purple Header** with tab navigation
- **Current Orders Tab**: Active orders only
- **Order History Tab**: Delivered orders only
- **Real-time Updates**: Refreshes when switching tabs

### Order Details:
- **Current Orders**: Shows live status updates
- **Historical Orders**: Shows delivery confirmation
- **Order Information**: Complete order details
- **Timestamps**: Order and delivery dates

## 🧪 Testing

### Test Scenarios:
1. **Place Order** → Should appear in Current Orders
2. **Update Status** → Should show status changes
3. **Mark Delivered** → Should move to Order History
4. **View History** → Should show delivered orders
5. **Order Details** → Should work for both types

### Manual Testing:
1. Place a test order
2. Check it appears in Current Orders tab
3. Update status to 'delivered' (via admin/deliverer)
4. Verify it moves to Order History tab
5. Test order details navigation

## 🔄 Status Flow

```
Order Placed → Processing → Preparing → On the Way → Delivered
     ↓                                                      ↓
Current Orders Tab                                    Order History Tab
```

## 📋 Database Schema

### order_history Table:
```sql
- id: SERIAL PRIMARY KEY
- original_order_id: INTEGER (reference to original order)
- user_id: UUID (customer)
- restaurant_id: INTEGER
- restaurant_name: VARCHAR(255)
- items: JSONB (order items)
- total: DECIMAL(10,2)
- order_code: VARCHAR(50)
- status: VARCHAR(50) DEFAULT 'delivered'
- created_at: TIMESTAMP (original order time)
- delivered_at: TIMESTAMP (delivery completion time)
- deliverer_id: UUID (optional)
- delivery_address: TEXT (optional)
- delivery_notes: TEXT (optional)
```

## 🚨 Important Notes

### 1. Automatic Migration:
- Orders are automatically moved when status = 'delivered'
- No manual intervention required
- Trigger runs on `order_status` table updates

### 2. Data Preservation:
- All original order data is preserved
- Original order ID is maintained for reference
- Delivery timestamp is automatically set

### 3. Performance:
- Proper indexes on user_id and delivered_at
- Efficient queries for both current and historical orders
- Minimal impact on existing functionality

## 🎉 Benefits

### For Users:
- **Clean Interface**: Current orders tab only shows active orders
- **Order History**: Easy access to past deliveries
- **Better Organization**: Clear separation of current vs completed

### For System:
- **Performance**: Smaller orders table for faster queries
- **Data Management**: Automatic cleanup of completed orders
- **Scalability**: Better handling of large order volumes

## 🔧 Troubleshooting

### Common Issues:

1. **Orders not moving to history**:
   - Check if trigger is properly installed
   - Verify order_status table updates
   - Check Supabase function permissions

2. **Missing order history**:
   - Verify order_history table exists
   - Check user permissions
   - Ensure proper data migration

3. **Performance issues**:
   - Check database indexes
   - Monitor query performance
   - Consider pagination for large datasets

### Debug Steps:
1. Check Supabase logs for trigger errors
2. Verify table permissions
3. Test with manual status updates
4. Monitor database performance

## 📈 Future Enhancements

### Potential Improvements:
- **Order Search**: Search through order history
- **Order Filtering**: Filter by date, restaurant, status
- **Order Analytics**: Delivery time statistics
- **Order Reordering**: Reorder from history
- **Order Reviews**: Rate completed orders

The order history system is now fully implemented and ready for use! 🚀
