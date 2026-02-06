import { View, Text, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import React, { useEffect, useMemo, useState } from 'react';
import supabase from "../../supabaseClient"
import { useNavigation } from '@react-navigation/native';
import * as Icon from 'react-native-feather';
import { useSession } from '../../context/SessionContext-v2';
import notificationService from '../../services/notificationService';

export default function ViewOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();
  const { session } = useSession();

  const fetchOrders = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, restaurant_name, total, order_code, created_at, user_id, deliverer_id')
        .order('created_at', { ascending: false });
      if (orderError) throw orderError;

      const orderIds = (orderData || []).map(order => order.id);

      const { data: statusData, error: statusError } = await supabase
        .from('order_status')
        .select('order_id, status, delivered_at')
        .in('order_id', orderIds);
      if (statusError) throw statusError;

      const statusMap = {};
      (statusData || []).forEach(({ order_id, status, delivered_at }) => {
        statusMap[order_id] = { status, delivered_at };
      });

      const userIds = Array.from(
        new Set(
          (orderData || [])
            .flatMap((o) => [o.user_id, o.deliverer_id])
            .filter(Boolean)
            .map(String)
        )
      );
      let userMap = {};
      if (userIds.length) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, email, phone, first_name, last_name, role')
          .in('id', userIds);
        if (usersError) throw usersError;
        (usersData || []).forEach((u) => {
          userMap[u.id] = u;
        });
      }

      const ordersWithStatus = (orderData || [])
        .map((order) => ({
          ...order,
          status: statusMap[order.id]?.status || 'submitted',
          delivered_at: statusMap[order.id]?.delivered_at || null,
          customer: userMap[order.user_id] || null,
          deliverer: order.deliverer_id ? (userMap[order.deliverer_id] || null) : null,
        }))
        .filter((o) => !['delivered', 'cancelled'].includes((o.status || '').toLowerCase()));

      setOrders(ordersWithStatus);
    } catch (err) {
      console.error('War Room fetch error:', err);
      Alert.alert('Error', err?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders(false);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders(true);
  };

  const updateStatus = async (orderId, newStatus) => {
    const { error } = await supabase
      .from('order_status')
      .upsert({ order_id: orderId, status: newStatus }, { onConflict: ['order_id'] });

    if (error) {
      console.error('Update error:', error);
      Alert.alert('Error', 'Could not update order status.');
    } else {
      // MVP customer notifications: ready to pickup + delivered only
      if (newStatus === 'ready to pickup' || newStatus === 'delivered') {
        try {
          // Get order details to send notification to customer
          const { data: order } = await supabase
            .from('orders')
            .select('user_id, order_code, restaurant_name')
            .eq('id', orderId)
            .single();

          if (order?.user_id) {
            if (newStatus === 'ready to pickup') {
              notificationService.sendPushToUser(order.user_id, {
                type: 'order_ready',
                title: 'Order Ready for Pickup!',
                body: `Your order #${order.order_code} from ${order.restaurant_name} is ready for pickup.`,
                data: { orderId, orderCode: order.order_code }
              });
            } else if (newStatus === 'delivered') {
              notificationService.sendPushToUser(order.user_id, {
                type: 'order_delivered',
                title: 'Order Delivered',
                body: `Your order #${order.order_code} has been delivered.`,
                data: { orderId, orderCode: order.order_code }
              });
            }
          }
        } catch (notifError) {
          console.error('Error sending order ready notification:', notifError);
          // Don't fail the status update if notification fails
        }
      }

      Alert.alert('Success', `Order marked as ${newStatus}`);
      setOrders(prev => prev.filter(order => order.id !== orderId)); // 👈 Remove from UI
    }
  };

  const confirmAction = (orderId, action) => {
    Alert.alert(
      action === 'delivered' ? 'Confirm Delivery' : action === 'cancelled' ? 'Cancel Order' : 'Confirm Status Change',
      `Are you sure you want to set this order to "${action}"?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          onPress: () => updateStatus(orderId, action),
        },
      ]
    );
  };

  const statusBadge = (status) => {
    const s = (status || 'submitted').toLowerCase();
    const bg =
      s === 'submitted' ? '#DBEAFE' :
      s === 'preparing' ? '#FEF3C7' :
      s === 'ready to pickup' ? '#DCFCE7' :
      s === 'processing' ? '#E0E7FF' :
      s === 'cancelled' ? '#FEE2E2' :
      '#E5E7EB';
    const fg =
      s === 'submitted' ? '#1D4ED8' :
      s === 'preparing' ? '#92400E' :
      s === 'ready to pickup' ? '#166534' :
      s === 'processing' ? '#3730A3' :
      s === 'cancelled' ? '#991B1B' :
      '#111827';

    return (
      <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
        <Text style={{ color: fg, fontWeight: '700' }}>{status || 'submitted'}</Text>
      </View>
    );
  };

  return (
    <View className="p-4 pt-12 bg-white flex-1">
      {/* Back Button */}
      <TouchableOpacity onPress={() => navigation.goBack()} className="mb-4">
        <Icon.ArrowLeft stroke="black" strokeWidth={2.5} width={28} height={28} />
      </TouchableOpacity>

      <Text className="text-xl font-bold mb-4">War Room - Live Orders</Text>

      {orders.length === 0 ? (
        <Text className="text-center text-gray-500">No active orders.</Text>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <View className="border p-4 mb-3 rounded-lg shadow bg-white">
              <Text className="text-sm text-gray-500">Order #{item.order_code}</Text>
              <Text className="text-lg font-semibold">{item.restaurant_name || 'Restaurant not specified'}</Text>
              <Text>Total: ${parseFloat(item.total).toFixed(2)}</Text>
              <View className="mt-2">{statusBadge(item.status)}</View>

              <View className="mt-3">
                <Text className="text-xs text-gray-500">Customer</Text>
                <Text className="text-sm text-gray-800">{item.customer?.email || '—'}</Text>
              </View>
              <View className="mt-2">
                <Text className="text-xs text-gray-500">Deliverer</Text>
                <Text className="text-sm text-gray-800">
                  {item.deliverer?.email ? item.deliverer.email : 'Unassigned'}
                </Text>
                {item.deliverer?.phone ? (
                  <Text className="text-sm text-gray-800">Phone: {item.deliverer.phone}</Text>
                ) : null}
              </View>

              <View className="flex-row flex-wrap justify-around mt-4">
                <TouchableOpacity
                  onPress={() => confirmAction(item.id, 'preparing')}
                  className="bg-yellow-500 px-3 py-2 rounded-lg flex-row items-center space-x-2 mb-2"
                >
                  <Icon.Clock stroke="white" width={18} height={18} />
                  <Text className="text-white font-semibold ml-2">Preparing</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => confirmAction(item.id, 'ready to pickup')}
                  className="bg-green-600 px-3 py-2 rounded-lg flex-row items-center space-x-2 mb-2"
                >
                  <Icon.CheckCircle stroke="white" width={18} height={18} />
                  <Text className="text-white font-semibold ml-2">Ready</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => confirmAction(item.id, 'delivered')}
                  className="bg-gray-800 px-3 py-2 rounded-lg flex-row items-center space-x-2 mb-2"
                >
                  <Icon.Check stroke="white" width={20} height={20} />
                  <Text className="text-white font-semibold ml-2">Deliver</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => confirmAction(item.id, 'cancelled')}
                  className="bg-red-500 px-3 py-2 rounded-lg flex-row items-center space-x-2 mb-2"
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
