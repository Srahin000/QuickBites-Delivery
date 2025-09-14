-- Realtime Setup for Chat System
-- Run this in your Supabase SQL Editor

-- 1. Enable Realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- 2. Enable Realtime for chat_rooms table (optional, for real-time chat room updates)
ALTER PUBLICATION supabase_realtime ADD TABLE chat_rooms;

-- 3. Verify Realtime is enabled
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename IN ('messages', 'chat_rooms');

-- 4. Check RLS policies are working
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('chat_rooms', 'messages', 'ai_chat_context');

-- 5. Test RLS policies
SELECT * FROM chat_rooms WHERE customer_id = auth.uid() LIMIT 1;
SELECT * FROM messages WHERE sender_id = auth.uid() LIMIT 1;
