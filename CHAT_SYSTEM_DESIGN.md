# 🚀 Chat System Design & Implementation

## 📋 Overview
Two-tier chat system:
1. **Deliverer Chat**: Real-time chat between customer and assigned deliverer
2. **AI Chat**: Sentiment-based AI chat for restaurant recommendations

## 🗄️ Database Schema

### **1. Chat Rooms Table**
```sql
CREATE TABLE chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL CHECK (type IN ('deliverer', 'ai')),
  customer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  deliverer_id UUID REFERENCES users(id) ON DELETE CASCADE NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Indexes
CREATE INDEX idx_chat_rooms_customer ON chat_rooms(customer_id);
CREATE INDEX idx_chat_rooms_deliverer ON chat_rooms(deliverer_id);
CREATE INDEX idx_chat_rooms_order ON chat_rooms(order_id);
CREATE INDEX idx_chat_rooms_type ON chat_rooms(type);
```

### **2. Messages Table**
```sql
CREATE TABLE messages (
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

-- Indexes
CREATE INDEX idx_messages_chat_room ON messages(chat_room_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
```

### **3. AI Chat Context Table**
```sql
CREATE TABLE ai_chat_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  context_data JSONB NOT NULL DEFAULT '{}',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX idx_ai_chat_context_user ON ai_chat_context(user_id);
```

## 🔧 Implementation Plan

### **Phase 1: Database Setup**
1. Create the database tables
2. Set up RLS (Row Level Security) policies
3. Create triggers for real-time updates

### **Phase 2: Chat Room Management**
1. Create chat room when order is accepted by deliverer
2. Manage AI chat rooms (one per user)
3. Handle chat room lifecycle

### **Phase 3: Real-time Messaging**
1. Implement Supabase real-time subscriptions
2. Create message sending/receiving logic
3. Handle message status (sent, delivered, read)

### **Phase 4: AI Integration**
1. Integrate OpenAI API for sentiment analysis
2. Create restaurant recommendation logic
3. Implement context-aware responses

## 🎯 Features

### **Deliverer Chat Features:**
- Real-time messaging
- Message status indicators
- Order context integration
- Push notifications
- Message history

### **AI Chat Features:**
- Sentiment analysis
- Restaurant recommendations
- Location-based suggestions
- Context memory
- Natural language processing

## 📱 UI Components Needed

### **Chat List Screen**
- List of active chats
- Unread message indicators
- Chat type indicators

### **Chat Screen**
- Message bubbles
- Input field
- Send button
- Typing indicators
- Message timestamps

### **AI Chat Specific**
- Restaurant suggestion cards
- Sentiment analysis display
- Quick action buttons

## 🔐 Security Considerations

### **RLS Policies**
```sql
-- Messages RLS
CREATE POLICY "Users can view messages in their chat rooms" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_rooms 
      WHERE chat_rooms.id = messages.chat_room_id 
      AND (chat_rooms.customer_id = auth.uid() OR chat_rooms.deliverer_id = auth.uid())
    )
  );

-- Chat Rooms RLS
CREATE POLICY "Users can view their chat rooms" ON chat_rooms
  FOR SELECT USING (
    customer_id = auth.uid() OR deliverer_id = auth.uid()
  );
```

## 🚀 Next Steps

1. **Create database tables**
2. **Implement chat room management**
3. **Build real-time messaging**
4. **Integrate AI chat**
5. **Create UI components**
6. **Add push notifications**

Would you like me to start implementing any specific part of this system?
