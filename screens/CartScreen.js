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

  // Check if time slots are available (will be updated by TimeSlotModal)
  const hasTimeSlots = selectedTimeSlot !== null;
  const hasLocation = selectedLocation !== null;
  const canPlaceOrder = hasTimeSlots && hasLocation;

  const isWeekday = today.getDay() >= 1 && today.getDay() <= 5;
  const isOrderAllowed = serviceOpen && (timeOverride || (isWeekday && canPlaceOrder));
  const canUseInstantPay = instantPayEnabled && canPlaceOrder;

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Add logic to reload cart data if needed
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

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
      <SafeAreaView className="flex-1" style={{ backgroundColor: themeColors.purple }} edges={[ 'left', 'right']}>
         <View style={{
        backgroundColor: themeColors.purple,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 32,
        paddingBottom: 16,
        width: '100%',
      }}>
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 28, marginBottom: 4 }}>Your Cart</Text>
        <Text style={{ color: 'white', opacity: 0.8, fontSize: 14 }}>Review and checkout your order</Text>
      </View>
      <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            position: 'absolute',
            left: 24,
            top: 32,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: themeColors.yellow,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 4,
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon.ArrowLeft size={24} color="white" />
        </TouchableOpacity>
        <View className="flex-1 justify-center items-center px-6 py-12 bg-white">
          <View className="items-center">
            <View className="w-24 h-24 rounded-full bg-gray-100 items-center justify-center mb-6">
              <Icon.ShoppingCart className="w-12 h-12 text-gray-400" />
            </View>
            <Text className="text-xl font-semibold text-gray-600 mb-2">
              Your cart is empty
            </Text>
            <Text className="text-gray-500 text-center px-8 mb-8">
              Add items to your cart to start ordering
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: themeColors.purple }} edges={[ 'left', 'right']}>
      {/* Purple Header */}

      <View style={{
        backgroundColor: themeColors.purple,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        paddingTop: 32,
        paddingBottom: 24,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
      }}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            position: 'absolute',
            left: 24,
            top: 32,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: themeColors.yellow,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
            elevation: 4,
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon.ArrowLeft size={24} color="white" />
        </TouchableOpacity>
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 28 }}>Your Cart</Text>
      </View>
      <View
        style={
            {
                flex: 1,
                backgroundColor: '#fff',
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
                marginTop: 0,
                paddingTop: 0,
                paddingHorizontal: 0,
                shadowColor: 'transparent',
                elevation: 0,
              }
            
        }
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 50 }}
          className="pt-2"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
        {cartItems.length > 0 ? (
          cartItems.map((dish, index) => (
              <View key={index} className="flex-row items-center space-x-4 px-4 py-3 bg-white rounded-2xl mx-2 mb-3 shadow-lg">
              <View className="flex-row items-center">
                <TouchableOpacity
                  className="p-1 rounded-full"
                    style={{ backgroundColor: themeColors.purple }}
                  onPress={() => removeFromCart(dish)}
                >
                  <Icon.Minus strokeWidth={2} height={20} width={20} stroke="white" />
                </TouchableOpacity>
                  <Text className="px-3 font-bold text-lg">{dish.quantity}</Text>
                <TouchableOpacity
                  className="p-1 rounded-full"
                    style={{ backgroundColor: themeColors.purple , marginRight: 20}}
                  onPress={() => addToCart(dish, restaurant)}
                >
                  <Icon.Plus strokeWidth={2} height={20} width={20} stroke="white" />
                </TouchableOpacity>
              </View>
              <Image className="h-14 w-14 rounded-full" source={{ uri: dish.image_url }} />
                <Text className="flex-1 font-bold text-gray-700 ml-4 text-base">{dish.name}</Text>
              <Text className="font-semibold text-base ml-4 pr-2">${dish.price}</Text>
            </View>
          ))
        ) : (
          <Text className="text-center text-gray-500 mt-10">Your cart is empty.</Text>
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

                    console.log('Creating payment intent for order:', newOrderCode, 'Total:', total);
                    console.log('Stripe publishable key:', process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.substring(0, 20) + '...');
                    console.log('Is test key:', process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_'));
                    console.log('Is live key:', process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_live_'));
                    
                    // Get the session token for authorization
                    const token = session?.access_token;
                    
                    if (!token) {
                      console.error('No session token found');
                      return Alert.alert('Authentication Error', 'Please sign in again to continue.');
                    }
                    
                    const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL || 'https://pgouwzuufnnhthwrewrv.functions.supabase.co'}/create-payment-intent`, {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({ cartItems, restaurant, total, orderCode: newOrderCode }),
                    });

                    const data = await response.json();
                    console.log('Payment intent response:', data);
                    
                    if (!response.ok) {
                      console.error('Payment intent creation failed:', data);
                      return Alert.alert('Payment Error', data.message || 'Failed to create payment. Please try again.');
                    }

                    const { paymentIntentClientSecret, paymentIntentId } = data;
                    
                    if (!paymentIntentClientSecret) {
                      console.error('No payment intent client secret received');
                      return Alert.alert('Payment Error', 'Invalid payment response. Please try again.');
                    }
                    
                    console.log('Payment intent created:', paymentIntentId);
                    console.log('Initializing payment sheet with client secret:', paymentIntentClientSecret?.substring(0, 20) + '...');

                    const { error: initError } = await initPaymentSheet({
                      paymentIntentClientSecret,
                      merchantDisplayName: 'QuickBites',
                      returnURL: 'quickbites://stripe-redirect',
                    });

                    if (initError) {
                      console.error('Payment sheet init error:', initError);
                      console.error('Error code:', initError.code);
                      console.error('Error message:', initError.message);
                      return Alert.alert('Payment Setup Error', `Failed to initialize payment: ${initError.message}`);
                    }

                    console.log('Presenting payment sheet...');
                    const { error: presentError } = await presentPaymentSheet();

                    if (presentError) {
                      console.error('Payment presentation error:', presentError);
                      console.error('Error code:', presentError.code);
                      console.error('Error message:', presentError.message);
                      
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

                    // Increment the time slot counter after successful payment
                    if (selectedTimeSlot?.id) {
                      try {
                        const { error: counterError } = await supabase
                          .from('delivery_times')
                          .update({ counter: selectedTimeSlot.counter + 1 })
                          .eq('id', selectedTimeSlot.id);

                        if (counterError) {
                          console.error('Error updating time slot counter:', counterError);
                          // Don't show error to user as payment was successful
                        } else {
                          console.log('Time slot counter incremented successfully');
                        }
                      } catch (err) {
                        console.error('Error updating time slot counter:', err);
                        // Don't show error to user as payment was successful
                      }
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
