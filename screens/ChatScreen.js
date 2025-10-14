import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Icon from 'react-native-feather';
import { themeColors } from '../theme';
import { useChat } from '../context/ChatContext';

export default function ChatScreen() {
  const [chatType, setChatType] = useState('deliverer'); // Set to deliverer by default, AI hidden for now
  const [message, setMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { 
    activeChatRoom, 
    messages, 
    isLoading, 
    error, 
    sendMessage,
    loadActiveChatRoom,
    loadMessages
  } = useChat();

  const handleSendMessage = () => {
    if (message.trim() && activeChatRoom) {
      sendMessage(message.trim());
      setMessage('');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Refresh active chat room and messages
      await loadActiveChatRoom();
      if (activeChatRoom) {
        await loadMessages(activeChatRoom.id);
      }
    } catch (error) {
      console.error('Error refreshing chat:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get deliverer name from active chat room
  const getDelivererName = () => {
    if (activeChatRoom?.users?.first_name && activeChatRoom?.users?.last_name) {
      return `${activeChatRoom.users.first_name} ${activeChatRoom.users.last_name}`;
    } else if (activeChatRoom?.users?.first_name) {
      return activeChatRoom.users.first_name;
    }
    return 'Your Deliverer';
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />
      
      {/* Header */}
      <View className="px-4 py-3 border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <View className="mr-3">
              <View style={[styles.switchButton, { backgroundColor: '#3B82F6' }]}>
                <Icon.User size={12} color="white" />
              </View>
            </View>
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-800">
                {getDelivererName()}
              </Text>
              <Text className="text-sm text-gray-500">
                Chat with your delivery person
              </Text>
            </View>
          </View>
          
          <View className="flex-row items-center">
            {/* Refresh Button */}
            <TouchableOpacity
              onPress={onRefresh}
              disabled={refreshing}
              style={styles.refreshButton}
            >
              <Icon.RefreshCcw 
                size={20} 
                color={refreshing ? '#9CA3AF' : '#6B7280'} 
                style={{ transform: [{ rotate: refreshing ? '180deg' : '0deg' }] }}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Content - Deliverer Chat Only */}
      {/* Deliverer Chat UI */}
        <KeyboardAvoidingView 
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={themeColors.bgColor2} />
              <Text style={styles.loadingText}>Loading chat...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Icon.AlertCircle size={48} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : !activeChatRoom ? (
            <View style={styles.noChatContainer}>
              <Icon.MessageCircle size={48} color="#9CA3AF" />
              <Text style={styles.noChatText}>No active delivery</Text>
              <Text style={styles.noChatSubtext}>You'll see your deliverer here when an order is accepted</Text>
            </View>
          ) : activeChatRoom.order_status === 'delivered' ? (
            <View style={styles.deliveredContainer}>
              <Icon.CheckCircle size={48} color="#10B981" />
              <Text style={styles.deliveredTitle}>Order Delivered!</Text>
              <Text style={styles.deliveredMessage}>
                Your order has been delivered. This chat is closed.
              </Text>
              <Text style={styles.deliveredSupport}>
                Any more inquiries please contact our support at qbdeliver.vercel.app
              </Text>
            </View>
          ) : (
            <>
              {/* Chat Messages */}
              <ScrollView 
                style={styles.messagesContainer}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.messagesContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={themeColors.bgColor2}
                    colors={[themeColors.bgColor2]}
                  />
                }
              >
                {messages.map((msg) => (
                  <View
                    key={msg.id}
                    style={[
                      styles.messageBubble,
                      msg.sender_type === 'customer' ? styles.userMessage : styles.delivererMessage
                    ]}
                  >
                    <Text style={[
                      styles.messageText,
                      msg.sender_type === 'customer' ? styles.userMessageText : styles.delivererMessageText
                    ]}>
                      {msg.content}
                    </Text>
                    <Text style={[
                      styles.timestamp,
                      msg.sender_type === 'customer' ? styles.userTimestamp : styles.delivererTimestamp
                    ]}>
                      {formatTimestamp(msg.created_at)}
                    </Text>
                  </View>
                ))}
              </ScrollView>

              {/* Chat Input - Only show if order is not delivered */}
              {activeChatRoom.order_status !== 'delivered' && (
                <View style={styles.inputContainer}>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Type a message..."
                      value={message}
                      onChangeText={setMessage}
                      multiline
                      maxLength={500}
                    />
                    <TouchableOpacity
                      onPress={handleSendMessage}
                      style={[
                        styles.sendButton,
                        { backgroundColor: message.trim() ? '#3B82F6' : '#D1D5DB' }
                      ]}
                      disabled={!message.trim()}
                    >
                      <Icon.Send size={20} color="white" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}
        </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  switchButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  // Chat UI Styles
  chatContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    marginVertical: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userMessage: {
    backgroundColor: '#3B82F6',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  delivererMessage: {
    backgroundColor: 'white',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  userMessageText: {
    color: 'white',
  },
  delivererMessageText: {
    color: '#1F2937',
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  delivererTimestamp: {
    color: '#9CA3AF',
    textAlign: 'left',
  },
  inputContainer: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 8,
    color: '#1F2937',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  // Loading, Error, and No Chat States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
  noChatContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noChatText: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  noChatSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  // Delivered Order Styles
  deliveredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deliveredTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 16,
    marginBottom: 12,
  },
  deliveredMessage: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  deliveredSupport: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});