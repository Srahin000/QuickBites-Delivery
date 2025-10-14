import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, SafeAreaView, RefreshControl } from 'react-native';
import React, { useEffect, useState } from 'react';
import supabase from "../supabaseClient"
import { useNavigation } from '@react-navigation/native';
import { themeColors } from '../theme';
import AnimatedButton from '../components/AnimatedButton';
import * as Icon from 'react-native-feather';

export default function OrdersScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('current'); // 'current' or 'history'
  const navigation = useNavigation();

  const fetchUserOrders = async () => {
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

      const ordersWithStatus = orderData.map(order => ({
        ...order,
        status: statusMap[order.id]?.status || 'processing',
        delivered_at: statusMap[order.id]?.delivered_at,
      }));

      if (activeTab === 'current') {
        // Show only current orders (not delivered)
        const currentOrders = ordersWithStatus.filter(order => order.status !== 'delivered');
        setOrders(currentOrders);
      } else {
        // Show only delivered orders (history)
        const historyOrders = ordersWithStatus.filter(order => order.status === 'delivered');
        setOrders(historyOrders);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchUserOrders();
    setRefreshing(false);
  }, [fetchUserOrders]);

  useEffect(() => {
    fetchUserOrders();
  }, [activeTab]);

  // Add focus listener for tab navigation
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('OrdersScreen: Focus event triggered');
      if (!refreshing) {
        onRefresh();
      }
    });

    return unsubscribe;
  }, [navigation, onRefresh, refreshing]);

  // Listen for refresh parameter from tab press - REMOVED to prevent conflicts
  // Use focus listener instead for better tab navigation handling

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return '#10b981';
      case 'preparing':
        return themeColors.yellow;
      case 'ready to pickup':
        return '#f59e0b';
      case 'delivering':
        return themeColors.purple;
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return <Icon.CheckCircle size={16} color="#10b981" />;
      case 'preparing':
        return <Icon.Clock size={16} color={themeColors.yellow} />;
      case 'ready to pickup':
        return <Icon.Package size={16} color="#f59e0b" />;
      case 'delivering':
        return <Icon.Truck size={16} color={themeColors.purple} />;
      default:
        return <Icon.Clock size={16} color="#6b7280" />;
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: themeColors.purple }}>
      <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={themeColors.yellow} />
      </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: themeColors.purple }}>
      {/* Header */}
      <View className="px-6 pt-4 pb-6">
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-white mb-2">Your Orders</Text>
            <Text className="text-white/80 text-sm">Track your food delivery</Text>
          </View>
          <TouchableOpacity
            onPress={onRefresh}
            disabled={refreshing}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              padding: 8,
              borderRadius: 8,
              opacity: refreshing ? 0.6 : 1
            }}
          >
            <Icon.RefreshCcw 
              size={20} 
              color="white" 
              style={{ transform: [{ rotate: refreshing ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>
        </View>
        
        {/* Tab Navigation */}
        <View className="flex-row bg-white/20 rounded-xl p-1 mt-4">
          <TouchableOpacity
            onPress={() => setActiveTab('current')}
            className={`flex-1 py-2 px-4 rounded-lg ${
              activeTab === 'current' ? 'bg-white' : 'bg-transparent'
            }`}
          >
            <Text className={`text-center font-semibold ${
              activeTab === 'current' ? 'text-purple-600' : 'text-white'
            }`}>
              Current Orders
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('history')}
            className={`flex-1 py-2 px-4 rounded-lg ${
              activeTab === 'history' ? 'bg-white' : 'bg-transparent'
            }`}
          >
            <Text className={`text-center font-semibold ${
              activeTab === 'history' ? 'text-purple-600' : 'text-white'
            }`}>
              Order History
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-1" style={{ backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
        {orders.length === 0 ? (
          <View className="flex-1 justify-center items-center px-6">
            <Icon.Package size={64} color={themeColors.purple} opacity={0.6} />
            <Text className="text-gray-600 text-lg font-medium mt-4 mb-2">No orders yet</Text>
            <Text className="text-gray-500 text-center px-8">
              Start exploring restaurants and place your first order!
            </Text>
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ padding: 20, paddingBottom: 0, flexGrow: 1 }}
            renderItem={({ item }) => (
              <AnimatedButton
                onPress={() => navigation.navigate('OrderDetails', { 
                  orderId: item.id, 
                  isHistory: activeTab === 'history' 
                })}
                className="mb-4"
              >
                <View className="bg-white rounded-2xl p-6 shadow-lg">
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
                    <Text className="text-lg font-bold" style={{ color: themeColors.purple }}>
                      ${parseFloat(item.total).toFixed(2)}
                    </Text>
                    <View className="items-end">
                      <Text className="text-xs text-gray-500">
                        {new Date(item.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </Text>
                      {item.status === 'delivered' && item.delivered_at && (
                        <Text className="text-xs text-green-600 font-medium">
                          Delivered: {new Date(item.delivered_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* View Details Button */}
                  <View className="mt-3 pt-3 border-t border-gray-100">
                    <View className="flex-row items-center justify-center">
                      <Text className="text-sm font-medium" style={{ color: themeColors.purple }}>
                        View Details
                      </Text>
                      <Icon.ArrowRight size={14} color={themeColors.purple} className="ml-1" />
                    </View>
                  </View>
                </View>
              </AnimatedButton>
            )}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}