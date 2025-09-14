import { supabase } from '../supabaseClient';

class ChatService {
  // Get the active order chat room for a customer
  async getActiveOrderChatRoom(customerId) {
    try {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select(`
          id,
          type,
          customer_id,
          deliverer_id,
          order_id,
          created_at,
          is_active,
          orders!inner(
            id,
            user_id,
            deliverer_id,
            total,
            created_at
          ),
          users!chat_rooms_deliverer_id_fkey(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('customer_id', customerId)
        .eq('type', 'deliverer')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching active order chat room:', error);
        return null;
      }

      // If no chat room found, return null
      if (!data) {
        console.log('No active chat room found for customer');
        return null;
      }

      // Get order status separately
      if (data?.order_id) {
        const { data: orderStatus } = await supabase
          .from('order_status')
          .select('status')
          .eq('order_id', data.order_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (orderStatus) {
          data.order_status = orderStatus.status;
        }
      }

      return data;
    } catch (error) {
      console.error('Error in getActiveOrderChatRoom:', error);
      return null;
    }
  }

  // Get chat history (delivered orders) for a deliverer
  async getDelivererChatHistory(delivererId) {
    try {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select(`
          id,
          type,
          customer_id,
          deliverer_id,
          order_id,
          created_at,
          is_active,
          orders!inner(
            id,
            user_id,
            deliverer_id,
            total,
            created_at
          ),
          users!chat_rooms_customer_id_fkey(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('deliverer_id', delivererId)
        .eq('type', 'deliverer')
        .eq('is_active', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching deliverer chat history:', error);
        return [];
      }

      // Get order status for each order
      if (data && data.length > 0) {
        const ordersWithStatus = await Promise.all(
          data.map(async (chatRoom) => {
            if (chatRoom.order_id) {
              const { data: orderStatus } = await supabase
                .from('order_status')
                .select('status')
                .eq('order_id', chatRoom.order_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
              
              if (orderStatus) {
                chatRoom.order_status = orderStatus.status;
              }
            }
            return chatRoom;
          })
        );
        
        // Only return delivered orders for chat history
        const deliveredOrders = ordersWithStatus.filter(chatRoom => 
          chatRoom.order_status === 'delivered'
        );
        
        return deliveredOrders;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getDelivererChatHistory:', error);
      return [];
    }
  }

  // Get all orders assigned to a deliverer with their chat rooms
  async getDelivererOrders(delivererId) {
    try {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select(`
          id,
          type,
          customer_id,
          deliverer_id,
          order_id,
          created_at,
          is_active,
          orders!inner(
            id,
            user_id,
            deliverer_id,
            total,
            created_at
          ),
          users!chat_rooms_customer_id_fkey(
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('deliverer_id', delivererId)
        .eq('type', 'deliverer')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching deliverer orders:', error);
        return [];
      }

      // Get order status for each order
      if (data && data.length > 0) {
        const ordersWithStatus = await Promise.all(
          data.map(async (chatRoom) => {
            if (chatRoom.order_id) {
              const { data: orderStatus } = await supabase
                .from('order_status')
                .select('status')
                .eq('order_id', chatRoom.order_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
              
              if (orderStatus) {
                chatRoom.order_status = orderStatus.status;
              }
            }
            return chatRoom;
          })
        );
        
        // Filter out delivered orders - only show active deliveries
        const activeOrders = ordersWithStatus.filter(chatRoom => 
          chatRoom.order_status !== 'delivered'
        );
        
        return activeOrders;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getDelivererOrders:', error);
      return [];
    }
  }

  // Get messages for a specific chat room
  async getMessages(chatRoomId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          chat_room_id,
          sender_id,
          sender_type,
          content,
          message_type,
          metadata,
          created_at,
          read_at,
          users!messages_sender_id_fkey(
            id,
            first_name,
            last_name
          )
        `)
        .eq('chat_room_id', chatRoomId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('Error fetching messages:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getMessages:', error);
      return [];
    }
  }

  // Send a message to a chat room
  async sendMessage(chatRoomId, senderId, content, senderType = 'customer') {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_room_id: chatRoomId,
          sender_id: senderId,
          sender_type: senderType,
          content: content,
          message_type: 'text',
          metadata: {}
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in sendMessage:', error);
      return null;
    }
  }

  // Subscribe to real-time messages for a chat room
  subscribeToMessages(chatRoomId, callback) {
    const subscription = supabase
      .channel(`chat_room_${chatRoomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_room_id=eq.${chatRoomId}`
        },
        (payload) => {
          console.log('New message received:', payload);
          callback(payload.new);
        }
      )
      .subscribe();

    return subscription;
  }

  // Mark a message as read
  async markMessageAsRead(messageId) {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) {
        console.error('Error marking message as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markMessageAsRead:', error);
      return false;
    }
  }

  // Mark all messages in a chat room as read for a specific user
  async markAllMessagesAsRead(chatRoomId, userId) {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('chat_room_id', chatRoomId)
        .neq('sender_id', userId)
        .is('read_at', null);

      if (error) {
        console.error('Error marking all messages as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in markAllMessagesAsRead:', error);
      return false;
    }
  }

  // Get unread message count for a user
  async getUnreadMessageCount(userId) {
    try {
      const { data, error } = await supabase
        .rpc('get_unread_message_count', { user_uuid: userId });

      if (error) {
        console.error('Error getting unread message count:', error);
        return 0;
      }

      return data || 0;
    } catch (error) {
      console.error('Error in getUnreadMessageCount:', error);
      return 0;
    }
  }

  // Create a chat room for an order (usually called by trigger, but useful for testing)
  async createChatRoom(customerId, delivererId, orderId) {
    try {
      const { data, error } = await supabase
        .from('chat_rooms')
        .insert({
          type: 'deliverer',
          customer_id: customerId,
          deliverer_id: delivererId,
          order_id: orderId,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating chat room:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in createChatRoom:', error);
      return null;
    }
  }

  // Unsubscribe from real-time updates
  unsubscribe(subscription) {
    if (subscription) {
      supabase.removeChannel(subscription);
    }
  }
}

export default new ChatService();
