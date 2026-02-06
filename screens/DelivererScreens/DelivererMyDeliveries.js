import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Icon from 'react-native-feather';
import supabase from "../../supabaseClient"
import { themeColors } from '../../theme';
import { useSession } from '../../context/SessionContext-v2';
import notificationService from '../../services/notificationService';

const STATUS_OPTIONS = [
  'processing',
  'ready to pickup',
  'delivered',
];

export default function DelivererMyDeliveries() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState({});
  const { session } = useSession();
  const navigation = useNavigation();

  const fetchOrders = async (isRefresh = false) => {
    if (!isRefresh) {
      setLoading(true);
    }
    try {
      if (!session?.user) throw new Error('Not logged in');
      // Fetch orders assigned to this deliverer and not delivered
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, order_code, restaurant_name, total, created_at, user_id, items, delivery_location, delivery_time')
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
      
      // Fetch restaurant details
      const restaurantNames = [...new Set(orderData.map(order => order.restaurant_name))];
      let restaurantMap = {};
      if (restaurantNames.length > 0) {
        const { data: restaurantsData, error: restaurantsError } = await supabase
          .from('restaurant_master')
          .select('restaurant_name, website, address')
          .in('restaurant_name', restaurantNames);
        if (restaurantsError) throw restaurantsError;
        restaurantsData.forEach(r => { restaurantMap[r.restaurant_name] = r; });
      }
      const ordersWithStatus = orderData
        .filter(order => statusMap[order.id] !== 'delivered')
        .map(order => ({
          ...order,
          status: statusMap[order.id] || 'processing',
          customerName: userMap[order.user_id] || 'Unknown',
          restaurantDetails: restaurantMap[order.restaurant_name] || {},
        }));

      // Group orders by restaurant
      const groupedOrders = ordersWithStatus.reduce((acc, order) => {
        const restaurantName = order.restaurant_name || 'Unknown Restaurant';
        if (!acc[restaurantName]) {
          acc[restaurantName] = [];
        }
        acc[restaurantName].push(order);
        return acc;
      }, {});

      // Convert to array format for FlatList
      const groupedOrdersArray = Object.entries(groupedOrders).map(([restaurantName, orders]) => ({
        type: 'restaurant',
        restaurantName,
        orders,
        restaurantDetails: orders[0]?.restaurantDetails || {}
      }));

      setOrders(groupedOrdersArray);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [session?.user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders(true);
  };

  const updateStatus = async (orderId, newStatus) => {
    setUpdating(prev => ({ ...prev, [orderId]: true }));
    try {
      // Enforce workflow: can't mark as "delivered" without first marking as "ready to pickup"
      if (newStatus === 'delivered') {
        // Get current status
        const { data: currentStatus, error: statusError } = await supabase
          .from('order_status')
          .select('status')
          .eq('order_id', orderId)
          .single();
        
        if (statusError && statusError.code !== 'PGRST116') {
          // PGRST116 is "not found" which is okay
          throw statusError;
        }
        
        const currentStatusValue = currentStatus?.status || 'processing';
        
        // Only allow "delivered" if current status is "ready to pickup"
        if (currentStatusValue !== 'ready to pickup') {
          Alert.alert(
            'Cannot Mark as Delivered',
            'You must first mark this order as "Ready to Pickup" before marking it as "Delivered".',
            [{ text: 'OK' }]
          );
          setUpdating(prev => ({ ...prev, [orderId]: false }));
          return;
        }
      }
      
      const updateData = { order_id: orderId, status: newStatus };
      
      // If marking as delivered, add deliverer_id
      if (newStatus === 'delivered') {
        updateData.deliverer_id = session.user.id;
      }
      
      const { error } = await supabase
        .from('order_status')
        .upsert(updateData, { onConflict: ['order_id'] });
        
      if (error) throw error;
      
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
      
      // Update the order status in the grouped structure
      setOrders(prev => prev.map(restaurantGroup => ({
        ...restaurantGroup,
        orders: restaurantGroup.orders.map(order => 
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      })));
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
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.bgColor2 }} edges={['bottom']}>
      <View style={{ backgroundColor: themeColors.bgColor2, padding: 20, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>My Deliveries</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={{ flex: 1, backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
        {orders.length === 0 ? (
          <Text style={{ color: themeColors.bgColor2, fontSize: 18 }}>No current deliveries.</Text>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(item, index) => `${item.type}-${index}`}
            contentContainerStyle={{ paddingBottom: 20 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            renderItem={({ item }) => (
              <View style={{ marginBottom: 20 }}>
                {/* Restaurant Header */}
                <View style={{ 
                  backgroundColor: themeColors.purple, 
                  borderRadius: 12, 
                  padding: 16, 
                  marginBottom: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ 
                      fontWeight: 'bold', 
                      fontSize: 18, 
                      color: 'white',
                      marginBottom: 4
                    }}>
                      🏪 {item.restaurantName}
                    </Text>
                    {item.restaurantDetails?.address && (
                      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                        📍 {item.restaurantDetails.address}
                      </Text>
                    )}
                  </View>
                  <Text style={{ 
                    color: 'rgba(255,255,255,0.9)', 
                    fontSize: 14, 
                    fontWeight: '600' 
                  }}>
                    {item.orders.length} order{item.orders.length !== 1 ? 's' : ''}
                  </Text>
                </View>

                {/* Orders for this restaurant */}
                {item.orders.map((order) => (
                  <View key={order.id} style={{ backgroundColor: '#f7f7f7', borderRadius: 16, padding: 16, marginBottom: 12 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 18, color: themeColors.purple, marginBottom: 8 }}>Order #{order.order_code}</Text>
                    
                    {/* Customer Info */}
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontWeight: 'bold', color: '#333', fontSize: 14 }}>👤 Customer</Text>
                      <Text style={{ color: '#333', marginTop: 2 }}>{order.customerName}</Text>
                    </View>

                    {/* Delivery Location */}
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontWeight: 'bold', color: '#333', fontSize: 14 }}>📍 Delivery Location</Text>
                      <Text style={{ color: '#333', marginTop: 2 }}>{order.delivery_location || 'Main Entrance - City College'}</Text>
                    </View>

                    {/* Order Items with Customizations */}
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontWeight: 'bold', color: '#333', fontSize: 14 }}>🍽️ Order Items</Text>
                      {order.items && order.items.map((orderItem, index) => (
                        <View key={index} style={{ marginTop: 4, paddingLeft: 8 }}>
                          <Text style={{ color: '#333', fontWeight: '600' }}>
                            {orderItem.quantity}x {orderItem.name} - ${(parseFloat(orderItem.price) * orderItem.quantity).toFixed(2)}
                          </Text>
                          {orderItem.customizations && typeof orderItem.customizations === 'object' && orderItem.customizations !== null && Object.keys(orderItem.customizations).length > 0 && (
                            <View style={{ marginTop: 2, paddingLeft: 8 }}>
                              <Text style={{ color: '#666', fontSize: 12, fontWeight: 'bold' }}>Customizations:</Text>
                              {Object.entries(orderItem.customizations).map(([key, value]) => {
                                // Skip empty or null values
                                if (!value || value === '' || value === 0) return null;
                                
                                // Handle nested objects (like Rice: {regular: 0, extra: 0})
                                if (typeof value === 'object' && value !== null) {
                                  const selectedOptions = Object.entries(value)
                                    .filter(([option, price]) => price !== 0 || option === 'regular' || option === 'light' || option === 'extra')
                                    .map(([option, price]) => option)
                                    .join(', ');
                                  
                                  if (selectedOptions) {
                                    return (
                                      <Text key={key} style={{ color: '#666', fontSize: 12, marginLeft: 4 }}>
                                        • {key}: {selectedOptions}
                                      </Text>
                                    );
                                  }
                                  return null;
                                }
                                
                                // Handle simple values
                                return (
                                  <Text key={key} style={{ color: '#666', fontSize: 12, marginLeft: 4 }}>
                                    • {key}: {value}
                                  </Text>
                                );
                              }).filter(Boolean)}
                            </View>
                          )}
                        </View>
                      ))}
                    </View>

                    {/* Order Summary */}
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontWeight: 'bold', color: '#333', fontSize: 14 }}>💰 Order Summary</Text>
                      <Text style={{ color: '#333', marginTop: 2 }}>Total: ${parseFloat(order.total).toFixed(2)}</Text>
                      <Text style={{ color: '#666', fontSize: 12, marginTop: 2 }}>Placed: {new Date(order.created_at).toLocaleString()}</Text>
                    </View>

                    <Text style={{ color: '#333', marginTop: 2, marginBottom: 8 }}>Status: <Text style={{ fontWeight: 'bold' }}>{order.status}</Text></Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {STATUS_OPTIONS.map(status => {
                        // Disable "delivered" button if status is not "ready to pickup"
                        const isDeliveredDisabled = status === 'delivered' && order.status !== 'ready to pickup';
                        const isDisabled = updating[order.id] || order.status === status || isDeliveredDisabled;
                        
                        return (
                        <TouchableOpacity
                          key={status}
                          onPress={() => updateStatus(order.id, status)}
                            disabled={isDisabled}
                          style={{
                            backgroundColor: order.status === status ? themeColors.purple : '#eee',
                            paddingVertical: 6,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            marginRight: 8,
                            marginBottom: 8,
                              opacity: isDisabled ? 0.5 : 1,
                          }}
                        >
                          <Text style={{ color: order.status === status ? 'white' : themeColors.purple, fontWeight: 'bold' }}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
                        </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
} 