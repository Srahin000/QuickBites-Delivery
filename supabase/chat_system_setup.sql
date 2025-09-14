-- Chat System Database Setup
-- Run this in your Supabase SQL editor

-- 1. Create chat_rooms table
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL CHECK (type IN ('deliverer', 'ai')),
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  deliverer_id UUID REFERENCES users(id) ON DELETE CASCADE NULL,
  order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- 2. Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('customer', 'deliverer', 'ai')),
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'system')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE NULL
);

-- 3. Create ai_chat_context table
CREATE TABLE IF NOT EXISTS ai_chat_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  context_data JSONB NOT NULL DEFAULT '{}',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_rooms_customer ON chat_rooms(customer_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_deliverer ON chat_rooms(deliverer_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_order ON chat_rooms(order_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_type ON chat_rooms(type);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_active ON chat_rooms(is_active);

CREATE INDEX IF NOT EXISTS idx_messages_chat_room ON messages(chat_room_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_type);

CREATE INDEX IF NOT EXISTS idx_ai_chat_context_user ON ai_chat_context(user_id);

-- 5. Create RLS policies
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_context ENABLE ROW LEVEL SECURITY;

-- Chat rooms policies
CREATE POLICY "Users can view their chat rooms" ON chat_rooms
  FOR SELECT USING (
    customer_id = auth.uid() OR deliverer_id = auth.uid()
  );

CREATE POLICY "Users can insert their chat rooms" ON chat_rooms
  FOR INSERT WITH CHECK (
    customer_id = auth.uid() OR deliverer_id = auth.uid()
  );

CREATE POLICY "Users can update their chat rooms" ON chat_rooms
  FOR UPDATE USING (
    customer_id = auth.uid() OR deliverer_id = auth.uid()
  );

-- Messages policies
CREATE POLICY "Users can view messages in their chat rooms" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_rooms 
      WHERE chat_rooms.id = messages.chat_room_id 
      AND (chat_rooms.customer_id = auth.uid() OR chat_rooms.deliverer_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert messages in their chat rooms" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM chat_rooms 
      WHERE chat_rooms.id = messages.chat_room_id 
      AND (chat_rooms.customer_id = auth.uid() OR chat_rooms.deliverer_id = auth.uid())
    )
  );

CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE USING (
    sender_id = auth.uid()
  );

-- AI chat context policies
CREATE POLICY "Users can view their own AI context" ON ai_chat_context
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own AI context" ON ai_chat_context
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own AI context" ON ai_chat_context
  FOR UPDATE USING (user_id = auth.uid());

-- 6. Create functions for chat room management

-- Function to create deliverer chat room when order is accepted
CREATE OR REPLACE FUNCTION create_deliverer_chat_room()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create chat room when deliverer_id changes from NULL to a value
  IF OLD.deliverer_id IS NULL AND NEW.deliverer_id IS NOT NULL THEN
    INSERT INTO chat_rooms (type, customer_id, deliverer_id, order_id)
    VALUES ('deliverer', NEW.user_id, NEW.deliverer_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create chat room when order is accepted
CREATE TRIGGER trigger_create_deliverer_chat_room
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION create_deliverer_chat_room();

-- Function to get or create AI chat room
CREATE OR REPLACE FUNCTION get_or_create_ai_chat_room(user_uuid UUID)
RETURNS UUID AS $$
DECLARE
  chat_room_id UUID;
BEGIN
  -- Try to find existing AI chat room
  SELECT id INTO chat_room_id
  FROM chat_rooms
  WHERE customer_id = user_uuid AND type = 'ai' AND is_active = true
  LIMIT 1;
  
  -- If not found, create new one
  IF chat_room_id IS NULL THEN
    INSERT INTO chat_rooms (type, customer_id, is_active)
    VALUES ('ai', user_uuid, true)
    RETURNING id INTO chat_room_id;
  END IF;
  
  RETURN chat_room_id;
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to get unread message count
CREATE OR REPLACE FUNCTION get_unread_message_count(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  unread_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO unread_count
  FROM messages m
  JOIN chat_rooms cr ON m.chat_room_id = cr.id
  WHERE (cr.customer_id = user_uuid OR cr.deliverer_id = user_uuid)
    AND m.sender_id != user_uuid
    AND m.read_at IS NULL;
  
  RETURN COALESCE(unread_count, 0);
END;
$$ LANGUAGE plpgsql;

-- 8. Grant necessary permissions
GRANT ALL ON chat_rooms TO authenticated;
GRANT ALL ON messages TO authenticated;
GRANT ALL ON ai_chat_context TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_ai_chat_room(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_message_count(UUID) TO authenticated;
