import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Icon from 'react-native-feather';
import { themeColors } from '../../theme';
import { useChat } from '../../context/ChatContext';

export default function DelivererChat() {
  const [message, setMessage] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const { 
    delivererOrders, 
    messages, 
    isLoading, 
    error, 
    loadDelivererOrders,
    selectChatRoom,
    sendDelivererMessage
  } = useChat();

  const handleSendMessage = () => {
    if (message.trim() && selectedOrder) {
      sendDelivererMessage(selectedOrder.id, message.trim());
      setMessage('');
    }
  };

  const handleSelectOrder = async (order) => {
    setSelectedOrder(order);
    await selectChatRoom(order);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getCustomerName = (order) => {
    if (order?.users?.first_name && order?.users?.last_name) {
      return `${order.users.first_name} ${order.users.last_name}`;
    } else if (order?.users?.first_name) {
      return order.users.first_name;
    }
    return 'Customer';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Ready to Pickup': return '#F59E0B';
      case 'Picked Up': return '#3B82F6';
      case 'On the Way': return '#10B981';
      case 'Delivered': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadDelivererOrders();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDelivererOrders();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />
      
      {/* Header */}
      <View className="px-4 py-3 border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 rounded-full bg-primary items-center justify-center mr-3">
              <Icon.MessageCircle size={20} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-800">
                {selectedOrder ? `Chat with ${getCustomerName(selectedOrder)}` : 'Select Order to Chat'}
              </Text>
              <Text className="text-sm text-gray-500">
                {selectedOrder ? `Order #${selectedOrder.orders?.id} - ${selectedOrder.order_status || 'Processing'}` : 'Choose a delivery to start conversation'}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center">
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
            {selectedOrder && (
              <TouchableOpacity
                onPress={() => setSelectedOrder(null)}
                style={styles.backButton}
              >
                <Icon.ArrowLeft size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Content */}
      {!selectedOrder ? (
        // Order Selection List
        <ScrollView 
          style={styles.ordersList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={themeColors.bgColor2}
              colors={[themeColors.bgColor2]}
            />
          }
        >
          <View className="px-4 py-4">
            <Text className="text-lg font-semibold text-gray-800 mb-4">Your Active Deliveries</Text>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={themeColors.bgColor2} />
                <Text style={styles.loadingText}>Loading orders...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : delivererOrders.length === 0 ? (
              <View style={styles.noOrdersContainer}>
                <Text style={styles.noOrdersText}>No active deliveries</Text>
                <Text style={styles.noOrdersSubtext}>You'll see customer orders here when they're assigned to you</Text>
              </View>
            ) : (
              delivererOrders.map((order) => (
                <TouchableOpacity
                  key={order.id}
                  onPress={() => handleSelectOrder(order)}
                  style={styles.orderCard}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-lg font-semibold text-gray-800">{getCustomerName(order)}</Text>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(order.order_status || 'Processing') }
                    ]}>
                      <Text style={styles.statusText}>{order.order_status || 'Processing'}</Text>
                    </View>
                  </View>
                  <Text className="text-sm text-gray-600 mb-1">Order #{order.orders?.id}</Text>
                  <Text className="text-sm text-gray-500 mb-2">{order.orders?.restaurant_name || 'Restaurant'}</Text>
                  <Text className="text-xs text-gray-400 mb-2">Total: ${order.orders?.total || '0.00'}</Text>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-gray-500">
                      {new Date(order.orders?.created_at || Date.now()).toLocaleDateString()}
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {new Date(order.orders?.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      ) : (
        // Chat UI
        <KeyboardAvoidingView 
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {selectedOrder?.order_status === 'delivered' ? (
            // Delivered Order Message
            <View style={styles.deliveredContainer}>
              <Icon.CheckCircle size={48} color="#10B981" />
              <Text style={styles.deliveredTitle}>Order Delivered!</Text>
              <Text style={styles.deliveredMessage}>
                This order has been delivered. This chat is closed.
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
                      msg.sender_type === 'deliverer' ? styles.delivererMessage : styles.customerMessage
                    ]}
                  >
                    <Text style={[
                      styles.messageText,
                      msg.sender_type === 'deliverer' ? styles.delivererMessageText : styles.customerMessageText
                    ]}>
                      {msg.content}
                    </Text>
                    <Text style={[
                      styles.timestamp,
                      msg.sender_type === 'deliverer' ? styles.delivererTimestamp : styles.customerTimestamp
                    ]}>
                      {formatTimestamp(msg.created_at)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )}

          {/* Chat Input - Only show if order is not delivered */}
          {selectedOrder?.order_status !== 'delivered' && (
            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Type a message to customer..."
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  onPress={handleSendMessage}
                  style={[
                    styles.sendButton,
                    { backgroundColor: message.trim() ? themeColors.bgColor2 : '#D1D5DB' }
                  ]}
                  disabled={!message.trim()}
                >
                  <Icon.Send size={20} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Order Selection Styles
  ordersList: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  orderCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
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
  backButton: {
    padding: 8,
    marginLeft: 8,
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
  delivererMessage: {
    backgroundColor: '#3B82F6',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  customerMessage: {
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
  delivererMessageText: {
    color: 'white',
  },
  customerMessageText: {
    color: '#1F2937',
  },
  timestamp: {
    fontSize: 12,
    marginTop: 4,
  },
  delivererTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  customerTimestamp: {
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
  // Loading, Error, and No Orders States
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
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
  noOrdersContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noOrdersText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  noOrdersSubtext: {
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