# Realtime Setup Guide for Chat System

## 🚨 **IMPORTANT: Enable Realtime in Supabase Dashboard**

### **Step 1: Enable Realtime in Supabase Dashboard**

1. **Go to your Supabase Dashboard**
2. **Navigate to Database → Replication**
3. **Find the `messages` table in the list**
4. **Toggle ON the Realtime switch** for the `messages` table
5. **Also enable it for `chat_rooms` table** (optional but recommended)

### **Step 2: Run SQL Script**

Run this SQL script in your Supabase SQL Editor:

```sql
-- Enable Realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Enable Realtime for chat_rooms table (optional)
ALTER PUBLICATION supabase_realtime ADD TABLE chat_rooms;

-- Verify Realtime is enabled
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename IN ('messages', 'chat_rooms');
```

### **Step 3: Check RLS Policies**

Make sure your RLS policies are set up correctly. Run this to check:

```sql
-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('chat_rooms', 'messages', 'ai_chat_context');

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('chat_rooms', 'messages');
```

### **Step 4: Test the Chat System**

After enabling Realtime:

1. **Open the app**
2. **Navigate to the Chat tab**
3. **Try sending a message**
4. **Check if messages appear in real-time**

### **Common Issues & Solutions**

#### **Issue 1: "Realtime subscription failed"**
- **Solution**: Make sure Realtime is enabled in Supabase Dashboard
- **Check**: Go to Database → Replication and verify the toggle is ON

#### **Issue 2: "Permission denied"**
- **Solution**: Check RLS policies are correctly set up
- **Run**: The RLS check queries above

#### **Issue 3: "Table not found in publication"**
- **Solution**: Run the ALTER PUBLICATION commands above
- **Verify**: Check the pg_publication_tables query

### **Step 5: Verify Everything Works**

1. **Send a message in AI chat**
2. **Switch to Delivery chat**
3. **Check if messages load properly**
4. **Verify real-time updates work**

## 🎯 **Expected Behavior After Setup**

- ✅ Messages appear instantly without refresh
- ✅ Chat rooms load properly
- ✅ No "Realtime subscription failed" errors
- ✅ AI responses work correctly
- ✅ Delivery chat shows customer list

## 🔧 **If Still Having Issues**

1. **Check Supabase logs** in the Dashboard
2. **Verify your Supabase URL and API key** in `supabaseClient.js`
3. **Make sure you're authenticated** (logged in)
4. **Check network connectivity**

The chat system should work perfectly once Realtime is enabled! 🚀
