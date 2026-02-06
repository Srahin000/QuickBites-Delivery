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
      // First, get all chat rooms for this deliverer
      const { data: chatRooms, error: chatError } = await supabase
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
            order_code,
            restaurant_name,
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
        .order('created_at', { ascending: false });

      if (chatError) {
        console.error('Error fetching deliverer chat history:', chatError);
        return [];
      }

      if (!chatRooms || chatRooms.length === 0) {
        return [];
      }

      // Get order statuses for all orders
      const orderIds = chatRooms.map(cr => cr.order_id).filter(Boolean);
      
      if (orderIds.length === 0) {
        return [];
      }

      const { data: orderStatuses, error: statusError } = await supabase
        .from('order_status')
        .select('order_id, status, created_at')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false });

      if (statusError) {
        console.error('Error fetching order statuses:', statusError);
        return [];
      }

      // Create a map of order_id to latest status
      const statusMap = {};
      if (orderStatuses) {
        orderStatuses.forEach(({ order_id, status }) => {
          if (!statusMap[order_id]) {
            statusMap[order_id] = status;
          }
        });
      }

      // Filter to only delivered orders and add status
      const deliveredChatRooms = chatRooms
        .map(chatRoom => ({
          ...chatRoom,
          order_status: statusMap[chatRoom.order_id] || 'processing'
        }))
        .filter(chatRoom => chatRoom.order_status === 'delivered');

      return deliveredChatRooms;
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

      // Send push notification to recipient after message is sent successfully
      if (data) {
        console.log('✅ Message saved to DB, starting notification process...');
        try {
          // Get recipient user ID (opposite of sender)
          const { data: chatRoom, error: chatRoomError } = await supabase
            .from('chat_rooms')
            .select('customer_id, deliverer_id')
            .eq('id', chatRoomId)
            .single();

          if (chatRoomError) {
            console.error('❌ Error fetching chat room:', chatRoomError);
            return data; // Still return message data even if notification fails
          }

          console.log('📞 Chat room fetched:', chatRoom);
          
          if (chatRoom) {
            const recipientId = senderType === 'customer' 
              ? chatRoom.deliverer_id 
              : chatRoom.customer_id;

            // Verify sender ID matches the expected sender in chat room
            const expectedSenderId = senderType === 'customer'
              ? chatRoom.customer_id
              : chatRoom.deliverer_id;

            console.log('👤 Sender ID:', senderId, 'Sender Type:', senderType);
            console.log('👤 Expected Sender ID:', expectedSenderId);
            console.log('👤 Recipient ID:', recipientId);
            console.log('👥 Chat Room - Customer:', chatRoom.customer_id, 'Deliverer:', chatRoom.deliverer_id);

            // Only send notification if recipient exists and is different from sender
            if (!recipientId) {
              console.log('⚠️ No recipient ID found - cannot send notification');
              return data;
            }

            // Check if recipient is same as sender (prevent self-notification)
            // Convert to strings for comparison to handle UUID vs string mismatches
            if (String(recipientId) === String(senderId)) {
              console.log('⚠️ Recipient is same as sender - skipping notification');
              return data;
            }

            // Also check if sender ID matches expected sender (sanity check)
            if (String(expectedSenderId) !== String(senderId)) {
              console.log('⚠️ Sender ID mismatch - sender may not be authorized for this chat room');
              // Still allow message but skip notification for security
              return data;
            }

            console.log('📤 Proceeding to send notification...');

            // Send push notification via Edge Function
            const functionsUrl = process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL || 'https://pgouwzuufnnhthwrewrv.functions.supabase.co';
            const notificationUrl = `${functionsUrl}/send-notification`;
            
            console.log('🌐 Notification URL:', notificationUrl);
            
            // Get sender name for notification
            const { data: sender } = await supabase
              .from('users')
              .select('first_name, last_name')
              .eq('id', senderId)
              .single();

            const senderName = sender 
              ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() || 'Someone'
              : 'Someone';

            const notificationPayload = {
              userId: recipientId,
              type: 'chat_message',
              title: senderType === 'customer' ? 'New Message from Customer' : 'New Message from Deliverer',
              body: `${senderName}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
              data: {
                type: 'chat_message',
                chatRoomId: chatRoomId,
                senderId: senderId,
                senderType: senderType
              }
            };

            console.log('📦 Notification payload:', JSON.stringify(notificationPayload, null, 2));

            try {
              // Refresh token if needed by calling getUser() first (auto-refreshes expired tokens)
              const { data: { user }, error: userError } = await supabase.auth.getUser();
              
              if (userError || !user) {
                console.error('❌ Cannot refresh token for notification:', userError);
                // Skip notification if token can't be refreshed - don't block message sending
                return data;
              }

              // Get the refreshed session token
              const { data: { session }, error: sessionError } = await supabase.auth.getSession();
              
              if (sessionError || !session?.access_token) {
                console.error('❌ No session token available for notification:', sessionError);
                return data;
              }

              console.log('🔐 Using refreshed session token for authorization');

              const response = await fetch(notificationUrl, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(notificationPayload)
              });

              console.log('📡 Fetch response status:', response.status);
              console.log('📡 Fetch response ok:', response.ok);

              const result = await response.json();
              console.log('📬 Notification response:', result);

              if (!response.ok) {
                console.error('❌ Notification failed - Status:', response.status);
                console.error('❌ Error details:', result);
              } else {
                console.log('✅ Notification sent successfully!');
              }
            } catch (fetchError) {
              console.error('❌ Fetch error:', fetchError);
              console.error('❌ Fetch error message:', fetchError.message);
              console.error('❌ Fetch error stack:', fetchError.stack);
            }
          } else {
            console.log('⚠️ Chat room not found or is null');
          }
        } catch (notifError) {
          console.error('❌ Error in notification block:', notifError);
          console.error('❌ Error message:', notifError.message);
          console.error('❌ Error stack:', notifError.stack);
        }
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
