import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Linking } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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

const MIN_TAP_HEIGHT = 44;

const CARD_PADDING = 16;
const ICON_SIZE = 16;
const ICON_COLOR = '#9CA3AF';

const STATUS_OPTIONS_UI = [
  { key: 'processing', label: 'Processing', color: '#D97706', border: '#F59E0B' },
  { key: 'ready to pickup', label: 'Ready to pickup', color: '#2563EB', border: '#3B82F6' },
  { key: 'delivered', label: 'Delivered', color: '#059669', border: '#10B981' },
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

  // Auto-refresh when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchOrders(true);
    }, [session?.user?.id])
  );

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
        <FlatList
          data={orders}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
          scrollEnabled={true}
          showsVerticalScrollIndicator={true}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.purple} />}
          ListEmptyComponent={() => (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 }}>
              <Text style={{ color: themeColors.bgColor2, fontSize: 18 }}>No current deliveries.</Text>
              <Text style={{ color: '#999', fontSize: 14, marginTop: 8 }}>Pull down to refresh</Text>
            </View>
          )}
          renderItem={({ item }) => (
              <View style={{ marginBottom: 24 }}>
                {/* Restaurant Header - subtle, left-accent */}
                <View style={{
                  backgroundColor: '#F5F3FF',
                  borderLeftWidth: 4,
                  borderLeftColor: themeColors.purple,
                  borderRadius: 8,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  marginBottom: 16,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Icon.Home width={18} height={18} stroke={themeColors.purple} strokeWidth={2} />
                        <Text style={{ fontWeight: '600', fontSize: 16, color: '#374151' }} numberOfLines={1}>
                          {item.restaurantName}
                        </Text>
                      </View>
                      {item.restaurantDetails?.address ? (
                        <TouchableOpacity
                          onPress={() => {
                            const addr = encodeURIComponent(item.restaurantDetails.address);
                            Linking.openURL(`https://maps.google.com/?q=${addr}`).catch(() => {});
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}
                        >
                          <Icon.MapPin width={14} height={14} stroke="#6B7280" />
                          <Text style={{ color: '#6B7280', fontSize: 13 }} numberOfLines={1}>
                            {item.restaurantDetails.address}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <Text style={{ fontSize: 13, color: '#6B7280', fontWeight: '600' }}>
                      {item.orders.length} order{item.orders.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                {/* Order cards */}
                {item.orders.map((order) => {
                  const currentIndex = STATUS_OPTIONS_UI.findIndex(s => s.key === order.status);
                  const nextStatusKey = currentIndex >= 0 && currentIndex < STATUS_OPTIONS_UI.length - 1
                    ? STATUS_OPTIONS_UI[currentIndex + 1].key
                    : null;
                  const isUpdating = updating[order.id];

                  return (
                  <View
                    key={order.id}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 12,
                      padding: CARD_PADDING,
                      marginBottom: 14,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      elevation: 3,
                    }}
                  >
                    {/* Top row: Customer name (primary) + Order badge (top-right) */}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: CARD_PADDING }}>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', flex: 1 }} numberOfLines={1}>
                        {order.customerName}
                      </Text>
                      <View style={{ backgroundColor: themeColors.purple, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 }}>
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 11 }}>#{order.order_code}</Text>
                      </View>
                    </View>

                    {/* Location + time with small grey icons */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Icon.MapPin width={ICON_SIZE} height={ICON_SIZE} stroke={ICON_COLOR} />
                      <Text style={{ fontSize: 14, fontWeight: '400', color: '#6B7280' }} numberOfLines={1}>
                        {order.delivery_location || 'Main Entrance - City College'}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: CARD_PADDING }}>
                      <Icon.Clock width={ICON_SIZE} height={ICON_SIZE} stroke={ICON_COLOR} />
                      <Text style={{ fontSize: 12, fontWeight: '400', color: '#9CA3AF' }}>
                        Placed {new Date(order.created_at).toLocaleString()}
                      </Text>
                    </View>

                    {/* Item summary: bulleted list on light grey background */}
                    <View style={{ backgroundColor: '#F3F4F6', borderRadius: 8, padding: CARD_PADDING, marginBottom: CARD_PADDING }}>
                      {order.items && order.items.length > 0 ? (
                        <>
                          {order.items.map((orderItem, index) => (
                            <View key={index} style={{ marginBottom: index < order.items.length - 1 ? 8 : 0 }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                                <Text style={{ fontSize: 14, color: '#374151', fontWeight: '400' }}>
                                  • {orderItem.quantity}x {orderItem.name}
                                </Text>
                                <Text style={{ fontSize: 14, color: '#374151', fontWeight: '400' }}>
                                  ${(parseFloat(orderItem.price) * orderItem.quantity).toFixed(2)}
                                </Text>
                              </View>
                              {orderItem.customizations && typeof orderItem.customizations === 'object' && orderItem.customizations !== null && Object.keys(orderItem.customizations).length > 0 && (
                                <View style={{ marginTop: 2, paddingLeft: 4 }}>
                                  {Object.entries(orderItem.customizations).map(([key, value]) => {
                                    if (!value || value === '' || value === 0) return null;
                                    if (typeof value === 'object' && value !== null) {
                                      const selectedOptions = Object.entries(value)
                                        .filter(([option, price]) => price !== 0 || option === 'regular' || option === 'light' || option === 'extra')
                                        .map(([option]) => option)
                                        .join(', ');
                                      if (!selectedOptions) return null;
                                      return <Text key={key} style={{ color: '#6B7280', fontSize: 12, fontWeight: '400' }}>  {key}: {selectedOptions}</Text>;
                                    }
                                    return <Text key={key} style={{ color: '#6B7280', fontSize: 12, fontWeight: '400' }}>  {key}: {value}</Text>;
                                  }).filter(Boolean)}
                                </View>
                              )}
                            </View>
                          ))}
                          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                            <Text style={{ fontSize: 14, color: '#111827', fontWeight: '700' }}>Total ${parseFloat(order.total).toFixed(2)}</Text>
                          </View>
                        </>
                      ) : (
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                          <Text style={{ fontSize: 14, color: '#111827', fontWeight: '700' }}>Total ${parseFloat(order.total).toFixed(2)}</Text>
                        </View>
                      )}
                    </View>

                    {/* Status change: Processing → Ready to pickup → Delivered (Delivered only after Ready to pickup) */}
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      {STATUS_OPTIONS_UI.map((opt) => {
                        const isCurrent = order.status === opt.key;
                        const isNext = nextStatusKey === opt.key;
                        const isDeliveredOption = opt.key === 'delivered';
                        const canTapDelivered = order.status === 'ready to pickup';
                        const isDisabled =
                          isUpdating ||
                          isCurrent ||
                          (isDeliveredOption && !canTapDelivered);

                        return (
                          <TouchableOpacity
                            key={opt.key}
                            onPress={() => !isDisabled && updateStatus(order.id, opt.key)}
                            disabled={isDisabled}
                            style={{
                              minHeight: MIN_TAP_HEIGHT,
                              paddingVertical: 12,
                              paddingHorizontal: 14,
                              borderRadius: 10,
                              flex: 1,
                              minWidth: 90,
                              justifyContent: 'center',
                              alignItems: 'center',
                              backgroundColor: isCurrent ? opt.color : 'transparent',
                              borderWidth: isNext ? 2.5 : 1,
                              borderColor: isCurrent ? opt.color : isNext ? opt.border : '#E5E7EB',
                              opacity: isDisabled ? 0.5 : 1,
                            }}
                          >
                            <Text
                              style={{
                                color: isCurrent ? '#FFFFFF' : isNext ? opt.border : '#6B7280',
                                fontWeight: isNext || isCurrent ? '700' : '400',
                                fontSize: 13,
                              }}
                            >
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                  );
                })}
              </View>
            )}
          />
      </View>
    </SafeAreaView>
  );
} 