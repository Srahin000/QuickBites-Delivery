import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, SafeAreaView, RefreshControl } from 'react-native';
import React, { useEffect, useState } from 'react';
import supabase from "../supabaseClient"
import { useNavigation } from '@react-navigation/native';
import { themeColors } from '../theme';
import AnimatedButton from '../components/AnimatedButton';
import * as Icon from 'react-native-feather';

export default function OrderHistoryScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  const fetchUserOrderHistory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.error("No user session found.");
        setLoading(false);
        return;
      }
      const user = session.user;

      // Fetch all orders for the user
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, order_code, restaurant_name, total, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (orderError) {
        console.error("Order fetch error:", orderError);
        setLoading(false);
        return;
      }

      const orderIds = orderData.map(order => order.id);

      // Fetch status for all orders (including delivery time)
      const { data: statusData, error: statusError } = await supabase
        .from('order_status')
        .select('order_id, status, delivered_at')
        .in('order_id', orderIds);

      if (statusError) {
        console.error("Status fetch error:", statusError);
        setLoading(false);
        return;
      }

      const statusMap = {};
      statusData.forEach(({ order_id, status, delivered_at }) => {
        statusMap[order_id] = { status, delivered_at };
      });

      // Filter to only show delivered orders
      const deliveredOrders = orderData
        .map(order => ({
          ...order,
          status: statusMap[order.id]?.status || 'processing',
          delivered_at: statusMap[order.id]?.delivered_at,
        }))
        .filter(order => order.status === 'delivered');

      setOrders(deliveredOrders);
    } catch (err) {
      console.error("Unexpected error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUserOrderHistory();
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchUserOrderHistory();
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'delivered':
        return <Icon.CheckCircle size={16} color="#10b981" />;
      case 'cancelled':
        return <Icon.XCircle size={16} color="#ef4444" />;
      default:
        return <Icon.Clock size={16} color="#6b7280" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'delivered':
        return '#10b981';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={themeColors.purple} />
          <Text className="text-gray-600 mt-4">Loading order history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 py-4 bg-white border-b border-gray-100">
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-gray-800">Order History</Text>
            <Text className="text-gray-600 mt-1">Your completed deliveries</Text>
          </View>
          <TouchableOpacity
            onPress={onRefresh}
            disabled={refreshing}
            style={{
              backgroundColor: '#F3F4F6',
              padding: 8,
              borderRadius: 8,
              opacity: refreshing ? 0.6 : 1
            }}
          >
            <Icon.RefreshCcw 
              size={20} 
              color="#6B7280" 
              style={{ transform: [{ rotate: refreshing ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>
        </View>
      </View>

      {orders.length === 0 ? (
        <View className="flex-1 justify-center items-center px-6">
          <View className="w-24 h-24 rounded-full bg-gray-100 items-center justify-center mb-6">
            <Icon.Archive size={48} color="#9ca3af" />
          </View>
          <Text className="text-xl font-semibold text-gray-600 mb-2">
            No order history yet
          </Text>
          <Text className="text-gray-500 text-center px-8">
            Your completed orders will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 20, paddingBottom: 0, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
              <AnimatedButton
                onPress={() => navigation.navigate('OrderDetails', { orderId: item.id, isHistory: true })}
                className="mb-4"
              >
              <View className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                {/* Order Header */}
                <View className="flex-row justify-between items-center mb-3">
                  <View className="flex-row items-center">
                    <Icon.Hash size={16} color={themeColors.purple} />
                    <Text className="text-sm font-semibold text-gray-600 ml-1">
                      #{item.order_code}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    {getStatusIcon(item.status)}
                    <Text 
                      className="text-xs font-medium ml-1"
                      style={{ color: getStatusColor(item.status) }}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>

                {/* Restaurant Name */}
                <Text className="text-lg font-bold text-gray-800 mb-2">
                  {item.restaurant_name}
                </Text>

                {/* Order Details */}
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="text-sm text-gray-500">Total Amount</Text>
                    <Text className="text-lg font-bold text-gray-800">
                      ${item.total.toFixed(2)}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-sm text-gray-500">Delivered</Text>
                    <Text className="text-sm font-medium text-gray-600">
                      {item.delivered_at 
                        ? new Date(item.delivered_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })
                        : 'Time not recorded'
                      }
                    </Text>
                  </View>
                </View>

                {/* Order Date */}
                <View className="mt-3 pt-3 border-t border-gray-100">
                  <Text className="text-xs text-gray-500">
                    Ordered: {new Date(item.created_at).toLocaleString()}
                  </Text>
                </View>
              </View>
            </AnimatedButton>
          )}
        />
      )}
    </SafeAreaView>
  );
}
