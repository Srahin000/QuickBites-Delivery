import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, ScrollView } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Icon from 'react-native-feather';
import supabase from "../../supabaseClient"
import { themeColors } from '../../theme';
import { useSession } from '../../context/SessionContext-v2';
import notificationService from '../../services/notificationService';

export default function DelivererOrders() {
  const [activeTab, setActiveTab] = useState('available');
  const [availableOrders, setAvailableOrders] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState({});
  const { session } = useSession();
  const navigation = useNavigation();

  const fetchAvailableOrders = async (isRefresh = false) => {
    if (!isRefresh) {
      setLoading(true);
    }
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, order_code, restaurant_name, total, created_at, user_id')
        .is('deliverer_id', null);
      
      if (orderError) throw orderError;
      
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
      
      setAvailableOrders(orderData.map(order => ({
        ...order,
        customerName: userMap[order.user_id] || 'Unknown',
      })));
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch available orders');
    } finally {
      if (!isRefresh) setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchMyOrders = async (isRefresh = false) => {
    if (!isRefresh) {
      setLoading(true);
    }
    try {
      if (!session?.user?.id) return;
      
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, order_code, restaurant_name, total, created_at, user_id')
        .eq('deliverer_id', session.user.id);
      
      if (orderError) throw orderError;
      
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
      
      setMyOrders(orderData.map(order => ({
        ...order,
        customerName: userMap[order.user_id] || 'Unknown',
      })));
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch my orders');
    } finally {
      if (!isRefresh) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAvailableOrders();
    fetchMyOrders();
  }, [session?.user?.id]);

  // Refresh when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      fetchAvailableOrders(true);
      fetchMyOrders(true);
    }, [session?.user?.id])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'available') {
      await fetchAvailableOrders(true);
    } else {
      await fetchMyOrders(true);
    }
  };

  const handleAccept = async (orderId) => {
    if (!session?.user) return;
    setAccepting(prev => ({ ...prev, [orderId]: true }));
    try {
      const acceptedOrder = availableOrders.find(o => o.id === orderId);
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

      // Refresh both tabs after accepting
      await fetchAvailableOrders(true);
      await fetchMyOrders(true);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to accept order');
    }
    setAccepting(prev => ({ ...prev, [orderId]: false }));
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

  const currentOrders = activeTab === 'available' ? availableOrders : myOrders;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.bgColor2 }} edges={['bottom']}>
      {/* Header */}
      <View style={{ backgroundColor: themeColors.bgColor2, padding: 20, paddingTop: 12 }}>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>Orders</Text>
      </View>

      {/* Tab Navigation */}
      <View style={{ backgroundColor: themeColors.bgColor2, paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity
          onPress={() => {
            setActiveTab('available');
            onRefresh();
          }}
          style={{
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 12,
            backgroundColor: activeTab === 'available' ? 'white' : 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Text style={{
            color: activeTab === 'available' ? themeColors.purple : 'white',
            fontWeight: activeTab === 'available' ? '700' : '600',
            fontSize: 14
          }}>
            Available
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setActiveTab('myorders');
            onRefresh();
          }}
          style={{
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 12,
            backgroundColor: activeTab === 'myorders' ? 'white' : 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Text style={{
            color: activeTab === 'myorders' ? themeColors.purple : 'white',
            fontWeight: activeTab === 'myorders' ? '700' : '600',
            fontSize: 14
          }}>
            My Orders
          </Text>
        </TouchableOpacity>
      </View>

      {/* Orders List */}
      <View style={{ flex: 1, backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
        <FlatList
          data={currentOrders}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
          scrollEnabled={true}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.purple} />}
          ListEmptyComponent={() => (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 }}>
              <Text style={{ color: themeColors.bgColor2, fontSize: 18 }}>
                {activeTab === 'available' ? 'No available orders.' : 'No orders yet.'}
              </Text>
              <Text style={{ color: '#999', fontSize: 14, marginTop: 8 }}>
                Pull down to refresh
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
              <View style={{ backgroundColor: '#f7f7f7', borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 16, color: themeColors.purple }}>Order #{item.order_code}</Text>
                <Text style={{ color: '#333', marginTop: 4 }}>Customer: {item.customerName}</Text>
                <Text style={{ color: '#333', marginTop: 2 }}>Restaurant: {item.restaurant_name}</Text>
                <Text style={{ color: '#333', marginTop: 2 }}>Total: ${parseFloat(item.total).toFixed(2)}</Text>
                <Text style={{ color: '#333', marginTop: 2 }}>Placed: {new Date(item.created_at).toLocaleString()}</Text>
                {activeTab === 'available' && (
                  <TouchableOpacity
                    onPress={() => handleAccept(item.id)}
                    disabled={accepting[item.id]}
                    style={{ backgroundColor: themeColors.purple, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, marginTop: 12, opacity: accepting[item.id] ? 0.6 : 1 }}
                  >
                    <Text style={{ color: 'white', fontWeight: 'bold', textAlign: 'center' }}>{accepting[item.id] ? 'Accepting...' : 'Accept Order'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          />
      </View>
    </SafeAreaView>
  );
} 