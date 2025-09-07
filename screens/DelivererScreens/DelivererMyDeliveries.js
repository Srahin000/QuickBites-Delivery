import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { supabase } from '../../supabaseClient';
import { themeColors } from '../../theme';
import { useSession } from '../../context/SessionContext';

const STATUS_OPTIONS = [
  'processing',
  'on the way',
  'delivered',
];

export default function DelivererMyDeliveries() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState({});
  const { session } = useSession();

  const fetchOrders = async () => {
    setLoading(true);
    try {
      if (!session?.user) throw new Error('Not logged in');
      // Fetch orders assigned to this deliverer and not delivered
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, order_code, restaurant_name, total, created_at, user_id')
        .eq('deliverer_id', session.user.id);
      if (orderError) throw orderError;
      const orderIds = orderData.map(order => order.id);
      // Fetch statuses
      const { data: statusData, error: statusError } = await supabase
        .from('order_status')
        .select('order_id, status')
        .in('order_id', orderIds);
      if (statusError) throw statusError;
      const statusMap = {};
      statusData.forEach(({ order_id, status }) => {
        statusMap[order_id] = status;
      });
      // Fetch customer names
      const userIds = orderData.map(order => order.user_id);
      let userMap = {};
      if (userIds.length > 0) {
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, first_name')
          .in('id', userIds);
        if (usersError) throw usersError;
        usersData.forEach(u => { userMap[u.id] = u.first_name; });
      }
      const ordersWithStatus = orderData
        .filter(order => statusMap[order.id] !== 'delivered')
        .map(order => ({
          ...order,
          status: statusMap[order.id] || 'processing',
          customerName: userMap[order.user_id] || 'Unknown',
        }));
      setOrders(ordersWithStatus);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch orders');
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [session?.user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
  };

  const updateStatus = async (orderId, newStatus) => {
    setUpdating(prev => ({ ...prev, [orderId]: true }));
    try {
      const { error } = await supabase
        .from('order_status')
        .upsert({ order_id: orderId, status: newStatus }, { onConflict: ['order_id'] });
      if (error) throw error;
      setOrders(prev => prev.map(order => order.id === orderId ? { ...order, status: newStatus } : order));
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update status');
    }
    setUpdating(prev => ({ ...prev, [orderId]: false }));
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
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.bgColor2 }}>
      <View style={{ backgroundColor: themeColors.bgColor2, padding: 20 }}>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>My Deliveries</Text>
      </View>
      <View style={{ flex: 1, backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
        {orders.length === 0 ? (
          <Text style={{ color: themeColors.bgColor2, fontSize: 18 }}>No current deliveries.</Text>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={item => item.id.toString()}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            renderItem={({ item }) => (
              <View style={{ backgroundColor: '#f7f7f7', borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 16, color: themeColors.purple }}>Order #{item.order_code}</Text>
                <Text style={{ color: '#333', marginTop: 4 }}>Customer: {item.customerName}</Text>
                <Text style={{ color: '#333', marginTop: 2 }}>Restaurant: {item.restaurant_name}</Text>
                <Text style={{ color: '#333', marginTop: 2 }}>Total: ${item.total}</Text>
                <Text style={{ color: '#333', marginTop: 2 }}>Placed: {new Date(item.created_at).toLocaleString()}</Text>
                <Text style={{ color: '#333', marginTop: 2, marginBottom: 8 }}>Status: <Text style={{ fontWeight: 'bold' }}>{item.status}</Text></Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {STATUS_OPTIONS.map(status => (
                    <TouchableOpacity
                      key={status}
                      onPress={() => updateStatus(item.id, status)}
                      disabled={updating[item.id] || item.status === status}
                      style={{
                        backgroundColor: item.status === status ? themeColors.purple : '#eee',
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        marginRight: 8,
                        marginBottom: 8,
                        opacity: updating[item.id] && item.status !== status ? 0.5 : 1,
                      }}
                    >
                      <Text style={{ color: item.status === status ? 'white' : themeColors.purple, fontWeight: 'bold' }}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
} 