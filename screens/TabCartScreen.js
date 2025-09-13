import { View, Text, ScrollView, TouchableOpacity, Image, Alert, RefreshControl } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Icon from 'react-native-feather';
import { useStripe } from '@stripe/stripe-react-native';
import supabase from "../supabaseClient"
import { themeColors } from '../theme';
import { useCart } from '../context/CartContext';
import { useSession } from '../context/SessionContext-v2';
import TimeSlotModal from '../components/TimeSlotModal';
import LocationModal from '../components/LocationModal';

export default function CartScreen() {
  const [serviceOpen, setServiceOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState('10:00 AM');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [showTimeSlotModal, setShowTimeSlotModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showDevPay, setShowDevPay] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeOverride, setTimeOverride] = useState(false);
  const [instantPayEnabled, setInstantPayEnabled] = useState(false);

  const today = new Date();
  const selectedDate = today;
  const currentHour = today.getHours();

  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const navigation = useNavigation();
  const route = useRoute();
  const { cartItems, clearCart, restaurant, addToCart, removeFromCart } = useCart();
  const { session } = useSession();

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = 0.20 * subtotal;
  const tax = 0.08875 * subtotal;
  const total = subtotal + deliveryFee + tax;
  const isInTab = route.name === 'Cart';

  const deliveryTimeSlots = ['10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM'];
  const filteredTimeSlots = deliveryTimeSlots.filter(slot => {
    const hour = parseInt(slot.split(':')[0]);
    const isPM = slot.includes('PM');
    const actualHour = isPM && hour !== 12 ? hour + 12 : hour;
    return actualHour > currentHour;
  });

  // Check if time slots and location are available
  const hasTimeSlots = selectedTimeSlot !== null;
  const hasLocation = selectedLocation !== null;
  const canPlaceOrder = hasTimeSlots && hasLocation;

  const isWeekday = today.getDay() >= 1 && today.getDay() <= 5;
  const isOrderAllowed = serviceOpen && (timeOverride || (isWeekday && canPlaceOrder));
  const canUseInstantPay = instantPayEnabled && canPlaceOrder;

  const handleTimeSlotSelected = (timeSlot) => {
    setSelectedTimeSlot(timeSlot);
    setSelectedTime(timeSlot.time);
    setShowTimeSlotModal(false);
  };

  const handleLocationSelected = (location) => {
    setSelectedLocation(location);
    setShowLocationModal(false);
  };

  const formatTime = (timeSlot) => {
    const hour = timeSlot.hours;
    const minute = timeSlot.minutes ? timeSlot.minutes.toString().padStart(2, '0') : '00';
    const ampm = timeSlot.ampm;
    return `${hour}:${minute} ${ampm}`;
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Add logic to reload cart data if needed
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  useEffect(() => {
    const fetchServiceStatus = async () => {
      const { data: prodStatus, error: prodError } = await supabase
        .from('service_approval')
        .select('open')
        .eq('id', 1)
        .single();
  
      const { data: devStatus, error: devError } = await supabase
        .from('service_approval')
        .select('open')
        .eq('id', 2)
        .single();

      const { data: timeOverrideStatus, error: timeOverrideError } = await supabase
        .from('service_approval')
        .select('open')
        .eq('id', 3)
        .single();
  
      if (prodError) console.error('Error fetching prod status:', prodError);
      else setServiceOpen(prodStatus.open);
  
      if (devError) console.error('Error fetching dev status:', devError);
      else {
        setShowDevPay(!devStatus.open); // 👈 if dev "open" = true, hide Dev Pay
        setInstantPayEnabled(devStatus.open); // 👈 if ID 2 "open" = true, enable instant pay
      }

      if (timeOverrideError) console.error('Error fetching time override status:', timeOverrideError);
      else setTimeOverride(timeOverrideStatus.open); // 👈 if ID 3 "open" = true, bypass time restrictions
    };
  
    fetchServiceStatus();
  }, []);
  

  useEffect(() => {
    const fetchServiceStatus = async () => {
      const { data, error } = await supabase
        .from('service_approval')
        .select('open')
        .eq('id', 1)
        .single();

      if (error) {
        console.error('Error fetching service status:', error);
      } else {
        setServiceOpen(data.open);
      }
    };

    fetchServiceStatus();
  }, []);

  useEffect(() => {
    // Show dev pay button after 5 seconds
    const timer = setTimeout(() => {
      setShowDevPay(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  if (!restaurant) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: themeColors.purple }} edges={['top', 'left', 'right']}>
        <View className="flex-1 justify-center items-center px-6 py-12 bg-white">
          <View className="items-center">
            <View className="w-24 h-24 rounded-full bg-gray-100 items-center justify-center mb-6">
              <Icon.ShoppingCart className="w-12 h-12 text-gray-400" />
            </View>
            <Text className="text-xl font-semibold text-gray-600 mb-2">
              Your cart is empty
            </Text>
            <Text className="text-gray-500 text-center px-8 mb-8">
              Start adding delicious items to your cart
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
              style={{ backgroundColor: themeColors.purple }}
              className="px-8 py-4 rounded-2xl shadow-lg"
            >
              <View className="flex-row items-center">
                <Icon.ArrowLeft className="w-5 h-5 text-white mr-2" />
                <Text className="text-white font-semibold text-lg">
                  Browse Menu
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: themeColors.purple }} edges={['top', 'left', 'right']}>
      {/* Purple Header */}
      <View style={{
        backgroundColor: themeColors.purple,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 10,
        paddingBottom: 16,
        width: '100%',
      }}>
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 28, marginBottom: 4 }}>Your Cart</Text>
        <Text style={{ color: 'white', opacity: 0.8, fontSize: 14 }}>Review and checkout your order</Text>
      </View>
      {/* Main Content (white background) */}
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View className="py-4 px-6 bg-white border-b border-gray-100">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Icon.MapPin className="w-5 h-5 text-gray-500 mr-2" />
              <Text className="text-lg font-semibold text-gray-800">{restaurant.name}</Text>
            </View>
            {cartItems.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    'Clear Cart',
                    'Are you sure you want to remove all items from your cart?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Clear', style: 'destructive', onPress: clearCart }
                    ]
                  );
                }}
                className="flex-row items-center"
              >
                <Icon.Trash2 className="w-4 h-4 text-red-500 mr-1" />
                <Text className="text-red-500 text-sm font-medium">Clear All</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text className="text-sm text-gray-500 mt-1 ml-7">Restaurant</Text>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 50 }}
          style={{ paddingTop: 0 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
      
          {/* Cart Items */}
          {cartItems.length > 0 && (
            <View className="px-6 py-4">
              <Text className="text-lg font-semibold text-gray-800 mb-4">Order Items</Text>
              {cartItems.map((item, index) => (
                <View key={index} className="bg-white rounded-lg p-4 mb-3 shadow-sm border border-gray-100">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-lg font-semibold text-gray-800">{item.name}</Text>
                      <Text className="text-gray-600">${item.price.toFixed(2)} each</Text>
                    </View>
                    <View className="flex-row items-center">
                      <TouchableOpacity
                        onPress={() => removeFromCart(item)}
                        className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center"
                      >
                        <Icon.Minus size={16} color="#6B7280" />
                      </TouchableOpacity>
                      <Text className="mx-4 text-lg font-semibold text-gray-800 min-w-[30px] text-center">
                        {item.quantity}
                      </Text>
                      <TouchableOpacity
                        onPress={() => addToCart(item)}
                        className="w-8 h-8 rounded-full bg-purple-600 items-center justify-center"
                      >
                        <Icon.Plus size={16} color="white" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-gray-100">
                    <Text className="text-gray-600">Total for this item</Text>
                    <Text className="text-lg font-semibold text-gray-800">
                      ${(item.price * item.quantity).toFixed(2)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Summary section is always scrollable with the cart */}
      {cartItems.length > 0 && (
            <View style={{ backgroundColor: themeColors.bgColor(0.08) }} className="p-6 px-8 rounded-t-3xl space-y-4 shadow-lg mt-4">
          <View className="flex-row justify-between">
            <Text className="text-gray-700">Subtotal</Text>
            <Text className="text-gray-700">${subtotal.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-700">Delivery Fee</Text>
            <Text className="text-gray-700">${deliveryFee.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-700">Tax (8.875%)</Text>
            <Text className="text-gray-700">${tax.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-700 font-extrabold">Total</Text>
            <Text className="text-gray-700 font-extrabold">${total.toFixed(2)}</Text>
          </View>
          <View className="mt-4">
            <Text className="text-gray-700 font-semibold">Delivery Date:</Text>
            <Text>{selectedDate.toDateString()}</Text>
            <Text className="text-gray-700 font-semibold mt-2">Select Delivery Time:</Text>
            <TouchableOpacity
              onPress={() => setShowTimeSlotModal(true)}
              className="border rounded px-3 py-3 bg-white flex-row items-center justify-between"
            >
              <View>
                <Text className="text-gray-900 font-medium">
                  {selectedTimeSlot ? formatTime(selectedTimeSlot) : 'Tap to select time'}
                </Text>
                {selectedTimeSlot && (
                  <Text className="text-gray-500 text-sm">
                    {selectedTimeSlot.counter}/10 orders • {selectedTimeSlot.counter >= 10 ? 'Full' : 'Available'}
                  </Text>
                )}
              </View>
              <Icon.ChevronRight size={20} color="#6B7280" />
            </TouchableOpacity>
            {!hasTimeSlots && (
              <Text className="text-red-600 font-semibold">Please select a delivery time</Text>
            )}

            <Text className="text-gray-700 font-semibold mt-2">Select Delivery Location:</Text>
            <TouchableOpacity
              onPress={() => setShowLocationModal(true)}
              className="border rounded px-3 py-3 bg-white flex-row items-center justify-between"
            >
              <View>
                <Text className="text-gray-900 font-medium">
                  {selectedLocation ? selectedLocation.location : 'Tap to select location'}
                </Text>
                {selectedLocation && (
                  <Text className="text-gray-500 text-sm">
                    {selectedLocation.address || selectedLocation.description}
                  </Text>
                )}
              </View>
              <Icon.ChevronRight size={20} color="#6B7280" />
            </TouchableOpacity>
            {!hasLocation && (
              <Text className="text-red-600 font-semibold">Please select a delivery location</Text>
            )}
          </View>
          {!isOrderAllowed ? (
            <Text className="text-red-600 text-center text-lg font-semibold">
              {!canPlaceOrder ? 
                'Please select both delivery time and location' :
                '🚫 Service unavailable. Deliveries run Mon–Fri, 10AM–3PM.\n📢 Check our Instagram for live updates.'
              }
            </Text>
          ) : canPlaceOrder ? (
            <View className="justify-end items-center p-4 space-y-4">
              {/* 🟢 Place Order Button - Show regular payment or instant pay based on ID 2 */}
              {canUseInstantPay ? (
                <TouchableOpacity
                  onPress={async () => {
                    const instantCode = Math.floor(100000 + Math.random() * 900000);
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session?.user) return;
                    const user = session.user;

                    // Insert order into orders table
                    const { data: orderData, error: orderError } = await supabase.from('orders').insert([
                      {
                        user_id: user.id,
                        restaurant_id: restaurant.id,
                        restaurant_name: restaurant.name,
                        items: cartItems,
                        total,
                        status: 'instant-paid',
                        created_at: new Date(),
                        order_code: instantCode.toString(),
                        delivery_location: selectedLocation?.location || "Main Entrance - City College",
                        delivery_time: selectedTimeSlot?.id || null,
                      },
                    ]).select().single();

                    if (orderError) {
                      console.error("Order insert error:", orderError);
                      Alert.alert('Error', 'Failed to create order. Please try again.');
                      return;
                    }

                    // Insert status into order_status table
                    const { error: statusError } = await supabase.from('order_status').insert([
                      {
                        order_id: orderData.id,
                        status: 'submitted',
                        created_at: new Date(),
                      },
                    ]);

                    if (statusError) {
                      console.error("Status insert error:", statusError);
                      // Don't show error to user as order was created successfully
                    }

                    clearCart();
                    navigation.navigate('Delivery', {
                      restaurant,
                      orderCode: instantCode,
                      cartItems,
                      subtotal,
                      deliveryFee,
                      tax,
                      totalAmount: subtotal + deliveryFee + tax,
                      selectedLocation,
                      selectedTimeSlot,
                    });
                  }}
                  className="w-3/4"
                >
                  <View style={{ backgroundColor: '#10b981' }} className="rounded-2xl p-4 shadow-lg">
                    <Text className="text-2xl font-bold text-white text-center">
                      Instant Pay
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                onPress={async () => {
                  let newOrderCode;
                  let isUnique = false;

                  while (!isUnique) {
                    newOrderCode = Math.floor(100000 + Math.random() * 900000);
                  
                    const startOfDay = new Date();
                    startOfDay.setHours(0, 0, 0, 0);
                  
                    const endOfDay = new Date();
                    endOfDay.setHours(23, 59, 59, 999);
                  
                    const { data: existingOrders, error: fetchError } = await supabase
                      .from('orders')
                      .select('order_code, created_at')
                      .gte('created_at', startOfDay.toISOString())
                      .lte('created_at', endOfDay.toISOString());
                  
                    if (fetchError) {
                      console.error('Fetch error:', fetchError);
                      break;
                    }
                  
                    const usedCodes = existingOrders.map(order => order.order_code);
                    if (!usedCodes.includes(newOrderCode.toString())) isUnique = true;
                  }

                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session?.user) return;
                    const user = session.user;

                    const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL || 'https://pgouwzuufnnhthwrewrv.functions.supabase.co'}/create-payment-intent`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ cartItems, restaurant, total, orderCode: newOrderCode }),
                    });

                    const data = await response.json();
                    if (!response.ok) return Alert.alert('Error', data.message || 'Something went wrong.');

                    const { paymentIntentClientSecret } = data;

                    const { error: initError } = await initPaymentSheet({
                      paymentIntentClientSecret,
                      merchantDisplayName: 'QuickBites',
                      returnURL: 'quickbites://stripe-redirect',
                    });

                    if (initError) return Alert.alert('Error', initError.message);

                    const { error: presentError } = await presentPaymentSheet();

                    if (presentError) {
                      if (presentError.code === 'Canceled') {
                        return Alert.alert('Payment Cancelled', 'You cancelled the payment.');
                      }
                      return Alert.alert('Payment Failed', presentError.message);
                    }

                    // Insert order into orders table
                    const { data: orderData, error: orderError } = await supabase.from('orders').insert([
                      {
                        user_id: user.id,
                        restaurant_id: restaurant.id,
                        restaurant_name: restaurant.name,
                        items: cartItems,
                        total,
                        status: 'paid',
                        created_at: new Date(),
                        order_code: newOrderCode.toString(),
                        delivery_location: selectedLocation?.location || "Main Entrance - City College",
                        delivery_time: selectedTimeSlot?.id || null,
                      },
                    ]).select().single();

                    if (orderError) {
                      console.error("Order insert error:", orderError);
                      Alert.alert('Error', 'Payment successful but failed to create order. Please contact support.');
                      return;
                    }

                    // Insert status into order_status table
                    const { error: statusError } = await supabase.from('order_status').insert([
                      {
                        order_id: orderData.id,
                        status: 'submitted',
                        created_at: new Date(),
                      },
                    ]);

                    if (statusError) {
                      console.error("Status insert error:", statusError);
                      // Don't show error to user as order was created successfully
                    }

                    Alert.alert('Success', 'Your payment was successful!');
                    clearCart();
                    navigation.navigate('Delivery', { 
                      restaurant, 
                      orderCode: newOrderCode,
                      cartItems,
                      subtotal,
                      deliveryFee,
                      tax,
                      totalAmount: subtotal + deliveryFee + tax,
                      selectedLocation,
                      selectedTimeSlot,
                    });
                  } catch (error) {
                    console.error('Payment error:', error);
                    Alert.alert('Network error', error.message);
                  }
                }}
                className="w-3/4"
              >
                    <View style={{ backgroundColor: themeColors.purple }} className="rounded-2xl p-4 shadow-lg">
                      <Text className="text-2xl font-bold text-white text-center">
                    Place Order
                  </Text>
                </View>
              </TouchableOpacity>
              )}
            </View>
          ) : null}
        </View>
      )}
        </ScrollView>
      </View>
      
      {/* Time Slot Modal */}
      <TimeSlotModal
        visible={showTimeSlotModal}
        onClose={() => setShowTimeSlotModal(false)}
        onTimeSelected={handleTimeSlotSelected}
        restaurantId={restaurant?.id}
      />

      {/* Location Modal */}
      <LocationModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationSelected={handleLocationSelected}
        restaurantId={restaurant?.id}
      />
    </SafeAreaView>
  );
}
