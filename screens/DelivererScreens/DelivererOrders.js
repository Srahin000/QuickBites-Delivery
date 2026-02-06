import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Icon from 'react-native-feather';
import supabase from "../../supabaseClient"
import { themeColors } from '../../theme';
import { useSession } from '../../context/SessionContext-v2';
import notificationService from '../../services/notificationService';

export default function DelivererOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState({});
  const { session } = useSession();
  const navigation = useNavigation();

  const fetchOrders = async (isRefresh = false) => {
    if (!isRefresh) {
      setLoading(true);
    }
    try {
      // Fetch all unassigned orders (deliverer_id is null)
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, order_code, restaurant_name, total, created_at, user_id')
        .is('deliverer_id', null);
      if (orderError) throw orderError;
      const userIds = orderData.map(order => order.user_id);
      // Fetch customer names
      let userMap = {};
      if (userIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, first_name')
          .in('id', userIds);
        if (usersError) throw usersError;
        usersData.forEach(u => { userMap[u.id] = u.first_name; });
      }
      setOrders(orderData.map(order => ({
        ...order,
        customerName: userMap[order.user_id] || 'Unknown',
      })));
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders(true);
  };

  const handleAccept = async (orderId) => {
    if (!session?.user) return;
    setAccepting(prev => ({ ...prev, [orderId]: true }));
    try {
      const acceptedOrder = orders.find(o => o.id === orderId);
      // Update deliverer_id in orders
      const { error } = await supabase
        .from('orders')
        .update({ deliverer_id: session.user.id })
        .eq('id', orderId);
      if (error) throw error;
      // MVP: Treat deliverer acceptance as the moment the order becomes "preparing"
      const { error: statusError } = await supabase
        .from('order_status')
        .upsert({ order_id: orderId, status: 'preparing', deliverer_id: session.user.id }, { onConflict: ['order_id'] });
      if (statusError) throw statusError;

      // Notify customer: preparing (do not notify on processing for MVP)
      try {
        if (acceptedOrder?.user_id) {
          notificationService.sendPushToUser(acceptedOrder.user_id, {
            type: 'order_preparing',
            title: 'Your order is preparing',
            body: `Order #${acceptedOrder.order_code} from ${acceptedOrder.restaurant_name} is now being prepared.`,
            data: { orderId, orderCode: acceptedOrder.order_code }
          });
        }
      } catch (notifErr) {
        console.error('Error sending preparing notification:', notifErr);
      }

      setOrders(prev => prev.filter(order => order.id !== orderId));
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to accept order');
    }
    setAccepting(prev => ({ ...prev, [orderId]: false }));
  };

  const handleReject = (orderId) => {
    setOrders(prev => prev.filter(order => order.id !== orderId));
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.bgColor2 }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={themeColors.purple} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.bgColor2 }} edges={['bottom']}>
      <View style={{ backgroundColor: themeColors.bgColor2, padding: 20, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>Available Orders</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={{ flex: 1, backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
        {orders.length === 0 ? (
          <Text style={{ color: themeColors.bgColor2, fontSize: 18 }}>No available orders.</Text>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ paddingBottom: 20 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            renderItem={({ item }) => (
              <View style={{ backgroundColor: '#f7f7f7', borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 16, color: themeColors.purple }}>Order #{item.order_code}</Text>
                <Text style={{ color: '#333', marginTop: 4 }}>Customer: {item.customerName}</Text>
                <Text style={{ color: '#333', marginTop: 2 }}>Restaurant: {item.restaurant_name}</Text>
                <Text style={{ color: '#333', marginTop: 2 }}>Total: ${parseFloat(item.total).toFixed(2)}</Text>
                <Text style={{ color: '#333', marginTop: 2 }}>Placed: {new Date(item.created_at).toLocaleString()}</Text>
                <View style={{ flexDirection: 'row', marginTop: 12 }}>
                  <TouchableOpacity
                    onPress={() => handleAccept(item.id)}
                    disabled={accepting[item.id]}
                    style={{ backgroundColor: themeColors.purple, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, marginRight: 12 }}
                  >
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>{accepting[item.id] ? 'Accepting...' : 'Accept'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleReject(item.id)}
                    style={{ backgroundColor: '#eee', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 }}
                  >
                    <Text style={{ color: themeColors.purple, fontWeight: 'bold' }}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
} 