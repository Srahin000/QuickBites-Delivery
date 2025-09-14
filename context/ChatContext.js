import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useSession } from './SessionContext-v2';
import chatService from '../services/chatService';

const ChatContext = createContext();

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const { session } = useSession();
  const [activeChatRoom, setActiveChatRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [delivererOrders, setDelivererOrders] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const subscriptionRef = useRef(null);

  // Load active chat room for customer
  const loadActiveChatRoom = async () => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const chatRoom = await chatService.getActiveOrderChatRoom(session.user.id);
      if (chatRoom) {
        setActiveChatRoom(chatRoom);
        await loadMessages(chatRoom.id);
      } else {
        setActiveChatRoom(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Error loading active chat room:', err);
      setError('Failed to load chat room');
    } finally {
      setIsLoading(false);
    }
  };

  // Load messages for a chat room
  const loadMessages = async (chatRoomId) => {
    try {
      const messagesData = await chatService.getMessages(chatRoomId);
      setMessages(messagesData);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages');
    }
  };

  // Load deliverer orders
  const loadDelivererOrders = async () => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      const orders = await chatService.getDelivererOrders(session.user.id);
      setDelivererOrders(orders);
    } catch (err) {
      console.error('Error loading deliverer orders:', err);
      setError('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  };

  // Load chat history for deliverer
  const loadChatHistory = async () => {
    if (!session?.user?.id) return;

    try {
      const history = await chatService.getDelivererChatHistory(session.user.id);
      setChatHistory(history);
    } catch (err) {
      console.error('Error loading chat history:', err);
      setError('Failed to load chat history');
    }
  };

  // Send a message
  const sendMessage = async (content) => {
    if (!activeChatRoom || !session?.user?.id || !content.trim()) return;

    try {
      const senderType = 'customer'; // This will be determined by user role in real implementation
      const newMessage = await chatService.sendMessage(
        activeChatRoom.id,
        session.user.id,
        content.trim(),
        senderType
      );

      // Don't add to local state - let real-time subscription handle it
      // This prevents duplicate messages
      if (!newMessage) {
        setError('Failed to send message');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
    }
  };

  // Send message as deliverer
  const sendDelivererMessage = async (chatRoomId, content) => {
    if (!session?.user?.id || !content.trim()) return;

    try {
      const newMessage = await chatService.sendMessage(
        chatRoomId,
        session.user.id,
        content.trim(),
        'deliverer'
      );

      // Don't add to local state - let real-time subscription handle it
      // This prevents duplicate messages
      if (!newMessage) {
        setError('Failed to send message');
      }
    } catch (err) {
      console.error('Error sending deliverer message:', err);
      setError('Failed to send message');
    }
  };

  // Select a chat room (for deliverer)
  const selectChatRoom = async (chatRoom) => {
    setActiveChatRoom(chatRoom);
    await loadMessages(chatRoom.id);
  };

  // Subscribe to real-time messages
  const subscribeToMessages = (chatRoomId) => {
    if (subscriptionRef.current) {
      chatService.unsubscribe(subscriptionRef.current);
    }

    subscriptionRef.current = chatService.subscribeToMessages(chatRoomId, (newMessage) => {
      setMessages(prev => {
        // Check if message already exists to prevent duplicates
        const messageExists = prev.some(msg => msg.id === newMessage.id);
        if (messageExists) {
          return prev;
        }
        return [...prev, newMessage];
      });
    });
  };

  // Unsubscribe from messages
  const unsubscribeFromMessages = () => {
    if (subscriptionRef.current) {
      chatService.unsubscribe(subscriptionRef.current);
      subscriptionRef.current = null;
    }
  };

  // Mark messages as read
  const markMessagesAsRead = async (chatRoomId) => {
    if (!session?.user?.id) return;

    try {
      await chatService.markAllMessagesAsRead(chatRoomId, session.user.id);
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  // Load unread count
  const loadUnreadCount = async () => {
    if (!session?.user?.id) return;

    try {
      const count = await chatService.getUnreadMessageCount(session.user.id);
      setUnreadCount(count);
    } catch (err) {
      console.error('Error loading unread count:', err);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeFromMessages();
    };
  }, []);

  // Load data when session changes
  useEffect(() => {
    if (session?.user?.id) {
      loadActiveChatRoom();
      loadUnreadCount();
      loadChatHistory(); // Load chat history for deliverer
    } else {
      setActiveChatRoom(null);
      setMessages([]);
      setDelivererOrders([]);
      setChatHistory([]);
      setUnreadCount(0);
    }
  }, [session?.user?.id]);

  // Subscribe to messages when active chat room changes
  useEffect(() => {
    if (activeChatRoom) {
      subscribeToMessages(activeChatRoom.id);
      markMessagesAsRead(activeChatRoom.id);
    } else {
      unsubscribeFromMessages();
    }
  }, [activeChatRoom]);

  const value = {
    // State
    activeChatRoom,
    messages,
    delivererOrders,
    chatHistory,
    isLoading,
    error,
    unreadCount,
    
    // Actions
    loadActiveChatRoom,
    loadDelivererOrders,
    loadChatHistory,
    loadMessages,
    sendMessage,
    sendDelivererMessage,
    selectChatRoom,
    markMessagesAsRead,
    loadUnreadCount,
    
    // Utils
    clearError: () => setError(null)
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};
