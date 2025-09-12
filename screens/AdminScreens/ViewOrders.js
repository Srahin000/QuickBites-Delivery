import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import React, { useEffect, useState } from 'react';
import supabase from "../../supabaseClient"
import { useNavigation } from '@react-navigation/native';
import * as Icon from 'react-native-feather';

export default function ViewOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  const fetchOrders = async () => {
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('id, restaurant_name, total, order_code')
      .order('created_at', { ascending: false });

    if (orderError) {
      console.error("Order fetch error:", orderError);
      return;
    }

    const orderIds = orderData.map(order => order.id);

    const { data: statusData, error: statusError } = await supabase
      .from('order_status')
      .select('order_id, status')
      .in('order_id', orderIds);

    if (statusError) {
      console.error("Status fetch error:", statusError);
      return;
    }

    const statusMap = {};
    statusData.forEach(({ order_id, status }) => {
      statusMap[order_id] = status;
    });

    const ordersWithStatus = orderData
      .map(order => ({
        ...order,
        status: statusMap[order.id] || 'processing',
      }))
      .filter(order => order.status === 'processing'); // 👈 Only show processing orders

    setOrders(ordersWithStatus);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const updateStatus = async (orderId, newStatus) => {
    const { error } = await supabase
      .from('order_status')
      .upsert({ order_id: orderId, status: newStatus }, { onConflict: ['order_id'] });

    if (error) {
      console.error('Update error:', error);
      Alert.alert('Error', 'Could not update order status.');
    } else {
      Alert.alert('Success', `Order marked as ${newStatus}`);
      setOrders(prev => prev.filter(order => order.id !== orderId)); // 👈 Remove from UI
    }
  };

  const confirmAction = (orderId, action) => {
    Alert.alert(
      action === 'delivered' ? 'Confirm Delivery' : 'Cancel Order',
      `Are you sure you want to ${action === 'delivered' ? 'mark as delivered' : 'cancel'}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: () => updateStatus(orderId, action),
        },
      ]
    );
  };

  return (
    <View className="p-4 pt-12 bg-white flex-1">
      {/* Back Button */}
      <TouchableOpacity onPress={() => navigation.goBack()} className="mb-4">
        <Icon.ArrowLeft stroke="black" strokeWidth={2.5} width={28} height={28} />
      </TouchableOpacity>

      <Text className="text-xl font-bold mb-4">Admin - Processing Orders</Text>

      {orders.length === 0 ? (
        <Text className="text-center text-gray-500">No processing orders.</Text>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View className="border p-4 mb-3 rounded-lg shadow bg-white">
              <Text className="text-sm text-gray-500">Order #{item.order_code}</Text>
              <Text className="text-lg font-semibold">{item.restaurant_name}</Text>
              <Text>Total: ${item.total}</Text>
              <Text>Status: {item.status}</Text>
              <View className="flex-row justify-around mt-3">
                <TouchableOpacity
                  onPress={() => confirmAction(item.id, 'delivered')}
                  className="bg-green-500 px-4 py-2 rounded-lg flex-row items-center space-x-2"
                >
                  <Icon.Check stroke="white" width={20} height={20} />
                  <Text className="text-white font-semibold ml-2">Deliver</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => confirmAction(item.id, 'cancelled')}
                  className="bg-red-500 px-4 py-2 rounded-lg flex-row items-center space-x-2"
                >
                  <Icon.X stroke="white" width={20} height={20} />
                  <Text className="text-white font-semibold ml-2">Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
