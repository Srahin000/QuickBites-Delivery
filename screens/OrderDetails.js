import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import React, { useEffect, useState } from 'react';
import { useRoute, useNavigation } from '@react-navigation/native';
import supabase from "../supabaseClient"
import * as Icon from 'react-native-feather';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OrderDetails() {
  let route, navigation, orderId;
  
  try {
    route = useRoute();
    navigation = useNavigation();
    orderId = route?.params?.orderId;
  } catch (error) {
    console.error('OrderDetails: Navigation error:', error);
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-gray-600">Navigation Error</Text>
      </View>
    );
  }

  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('processing');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single();

        if (orderError) {
          console.error("Order fetch error:", orderError);
          return;
        }

        const { data: statusData } = await supabase
          .from('order_status')
          .select('status')
          .eq('order_id', orderId)
          .single();

        setOrder(orderData);
        setStatus(statusData?.status || 'processing');
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [orderId]);

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
            navigation.navigate('Orders');
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
        <ScrollView showsVerticalScrollIndicator={false}>
      <Text className="text-xl font-bold mb-2">Order #{order.order_code}</Text>
      <Text className="text-sm text-gray-500 mb-4">Status: {status}</Text>
      <Text className="text-lg font-semibold mb-2">Restaurant: {order.restaurant_name}</Text>
      <Text className="text-base font-semibold mb-2">Items:</Text>
          {order.items && order.items.map((item, index) => (
        <View key={index} className="mb-3 border-b pb-2">
          <Text className="font-semibold">{item.name} x{item.quantity}</Text>
          <Text className="text-sm text-gray-600">${item.price} each</Text>
        </View>
      ))}
      <Text className="text-lg font-bold mt-4">Total: ${order.total}</Text>
      <Text className="text-sm text-gray-500 mt-2">
        Ordered on {new Date(order.created_at).toLocaleString()}
      </Text>
    </ScrollView>
      </View>
    </SafeAreaView>
  );
}
