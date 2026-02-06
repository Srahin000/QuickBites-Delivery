import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRoute, useNavigation } from '@react-navigation/native';
import supabase from "../supabaseClient"
import * as Icon from 'react-native-feather';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OrderHistoryDetails() {
  let route, navigation, orderId, isHistory;
  
  try {
    route = useRoute();
    navigation = useNavigation();
    orderId = route?.params?.orderId;
    isHistory = route?.params?.isHistory || false; // Default to false if not provided
  } catch (error) {
    console.error('OrderHistoryDetails: Navigation error:', error);
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-gray-600">Navigation Error</Text>
      </View>
    );
  }

  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('processing');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrderDetails = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      // Fetch order from orders table
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*, deliverer:deliverer_id(first_name, last_name)')
        .eq('id', orderId)
        .single();

      if (orderError) {
        console.error("Order fetch error:", orderError);
        return;
      }

      // Fetch status from order_status table (including delivery time)
      const { data: statusData } = await supabase
        .from('order_status')
        .select('status, delivered_at')
        .eq('order_id', orderId)
        .single();

      setStatus(statusData?.status || 'processing');
      setOrder({
        ...orderData,
        delivered_at: statusData?.delivered_at
      });
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId, isHistory]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator size="large" color="#0000ff" />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <Text className="text-gray-600">Order not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Floating back button */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          top: 18,
          left: 18,
          zIndex: 10,
          backgroundColor: '#fff',
          borderRadius: 24,
          width: 48,
          height: 48,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
          elevation: 6,
        }}
        onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.reset({
              index: 0,
              routes: [{ name: 'MainTabs', params: { screen: 'Orders' } }],
            });
          }
        }}
      >
        <Icon.ArrowLeft stroke="#502efa" strokeWidth={2.5} height={28} width={28} />
      </TouchableOpacity>
      
      <View style={{
        flex: 1,
        backgroundColor: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        marginTop: 40,
        paddingTop: 32,
        paddingHorizontal: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 8,
      }}>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchOrderDetails(true)}
            />
          }
        >
          <Text className="text-xl font-bold mb-2">Order #{order.order_code}</Text>
          <Text className="text-sm text-gray-500 mb-4">
            Status: {status}
          </Text>
          <Text className="text-lg font-semibold mb-2">Restaurant: {order.restaurant_name || 'Restaurant not specified'}</Text>
          
          {/* Deliverer Name */}
          {order.deliverer && (order.deliverer.first_name || order.deliverer.last_name) && (
            <View className="flex-row items-center mb-2">
              <Icon.Truck size={16} color="#502efa" />
              <Text className="text-base text-gray-700 ml-2">
                Delivered by {order.deliverer.first_name || ''} {order.deliverer.last_name || ''}
              </Text>
            </View>
          )}
          
          <Text className="text-base font-semibold mb-2">Items:</Text>
          {order.items && order.items.map((item, index) => (
            <View key={index} className="mb-3 border-b pb-2">
              <Text className="font-semibold">{item.name} x{item.quantity}</Text>
              <Text className="text-sm text-gray-600">${parseFloat(item.price).toFixed(2)} each</Text>
            </View>
          ))}
          
          <Text className="text-lg font-bold mt-4">Total: ${parseFloat(order.total).toFixed(2)}</Text>
          <Text className="text-sm text-gray-500 mt-2">
            Ordered on {new Date(order.created_at).toLocaleString()}
          </Text>
          
          {status === 'delivered' && (
            <Text className="text-sm text-gray-500 mt-2">
              Delivered on {order.delivered_at 
                ? new Date(order.delivered_at).toLocaleString()
                : 'Time not recorded'
              }
            </Text>
          )}
          
          {status === 'delivered' && (
            <View className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
              <View className="flex-row items-center">
                <Icon.CheckCircle size={20} color="#10b981" />
                <Text className="text-green-800 font-semibold ml-2">
                  Order Successfully Delivered
                </Text>
              </View>
              <Text className="text-green-700 text-sm mt-1">
                Thank you for choosing QuickBites!
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
