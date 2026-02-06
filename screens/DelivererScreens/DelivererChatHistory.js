import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import * as Icon from 'react-native-feather';
import { themeColors } from '../../theme';
import { useChat } from '../../context/ChatContext';

export default function DelivererChatHistory() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const { 
    chatHistory, 
    isLoading, 
    error, 
    loadChatHistory 
  } = useChat();

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadChatHistory();
    } catch (error) {
      console.error('Error refreshing chat history:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getCustomerName = (order) => {
    if (order?.users?.first_name && order?.users?.last_name) {
      return `${order.users.first_name} ${order.users.last_name}`;
    } else if (order?.users?.first_name) {
      return order.users.first_name;
    }
    return 'Customer';
  };

  useEffect(() => {
    loadChatHistory();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />
      
      {/* Header */}
      <View className="px-4 py-3 border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="w-8 h-8 rounded-full bg-primary items-center justify-center mr-3">
              <Icon.Clock size={20} color="white" />
            </View>
            <View>
              <Text className="text-lg font-semibold text-gray-800">Chat History</Text>
              <Text className="text-sm text-gray-500">Your completed deliveries</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
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
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={themeColors.bgColor2} />
              <Text style={styles.loadingText}>Loading chat history...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Icon.AlertCircle size={48} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : chatHistory.length === 0 ? (
            <View style={styles.noHistoryContainer}>
              <Icon.Clock size={48} color="#9CA3AF" />
              <Text style={styles.noHistoryText}>No chat history</Text>
              <Text style={styles.noHistorySubtext}>Your completed delivery chats will appear here</Text>
            </View>
          ) : (
            <>
              <Text className="text-lg font-semibold text-gray-800 mb-4">
                Completed Deliveries ({chatHistory.length})
              </Text>
              {chatHistory.map((order) => (
                <TouchableOpacity
                  key={order.id}
                  style={styles.historyCard}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-lg font-semibold text-gray-800">
                      {getCustomerName(order)}
                    </Text>
                    <View style={styles.deliveredBadge}>
                      <Text style={styles.deliveredText}>Delivered</Text>
                    </View>
                  </View>
                  <Text className="text-sm text-gray-600 mb-1">Order #{order.orders?.id}</Text>
                  <Text className="text-sm text-gray-500 mb-2">
                    {order.orders?.restaurant_name || 'Restaurant'}
                  </Text>
                  <Text className="text-xs text-gray-400 mb-2">
                    Total: ${parseFloat(order.orders?.total || 0).toFixed(2)}
                  </Text>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-gray-500">
                      Delivered: {formatTimestamp(order.orders?.created_at || Date.now())}
                    </Text>
                    <View className="flex-row items-center">
                      <Icon.MessageCircle size={14} color="#6B7280" />
                      <Text className="text-xs text-gray-500 ml-1">Chat completed</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    marginTop: 12,
  },
  noHistoryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noHistoryText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  noHistorySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  historyCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  deliveredBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deliveredText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});
