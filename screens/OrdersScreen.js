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

      const { data: statusData, error: statusError } = await supabase
        .from('order_status')
        .select('order_id, status')
        .in('order_id', orderIds);

      if (statusError) {
        console.error("Status fetch error:", statusError);
        setLoading(false);
        return;
      }

      const statusMap = {};
      statusData.forEach(({ order_id, status }) => {
        statusMap[order_id] = status;
      });

      const ordersWithStatus = orderData.map(order => ({
        ...order,
        status: statusMap[order.id] || 'processing',
      }));

      setOrders(ordersWithStatus);
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
  }, []);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return '#10b981';
      case 'preparing':
        return themeColors.yellow;
      case 'delivering':
        return themeColors.purple;
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <Icon.CheckCircle size={16} color="#10b981" />;
      case 'preparing':
        return <Icon.Clock size={16} color={themeColors.yellow} />;
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
      <View className="flex-1 px-6 pt-4 pb-6">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-white mb-2">Your Orders</Text>
          <Text className="text-white/80 text-sm">Track your food delivery</Text>
        </View>

      {orders.length === 0 ? (
          <View className="flex-1 justify-center items-center">
            <Icon.Package size={64} color="white" opacity={0.6} />
            <Text className="text-white/80 text-lg font-medium mt-4 mb-2">No orders yet</Text>
            <Text className="text-white/60 text-center px-8">
              Start exploring restaurants and place your first order!
            </Text>
          </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
              <AnimatedButton
              onPress={() => navigation.navigate('OrderDetails', { orderId: item.id })}
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
                      ${item.total}
                    </Text>
                    <Text className="text-xs text-gray-500">
                      {new Date(item.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </Text>
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
