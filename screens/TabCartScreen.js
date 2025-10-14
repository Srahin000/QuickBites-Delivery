import { View, Text, ScrollView, TouchableOpacity, Image, Alert, RefreshControl } from 'react-native';
import React, { useState, useEffect, useMemo } from 'react';
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
// Apple Pay is presented within Stripe PaymentSheet

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
  const [appliedCoupons, setAppliedCoupons] = useState([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);

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
  
  // Check if cart has items from multiple restaurants
  const uniqueRestaurants = [...new Set(cartItems.map(item => item.restaurant_name))];
  const hasMixedRestaurants = uniqueRestaurants.length > 1;
  const displayRestaurant = hasMixedRestaurants ? 'Mixed Order' : (cartItems.length > 0 && cartItems[0]?.restaurant_name ? cartItems[0].restaurant_name : restaurant?.restaurant_name || restaurant?.name || 'Restaurant');
  
  // Calculate coupon discounts using useMemo to prevent infinite re-renders
  const discounts = useMemo(() => {
    let totalDiscount = 0;
    let deliveryDiscount = 0;
    let subtotalDiscount = 0;
    
    appliedCoupons.forEach(couponUsage => {
      const coupon = couponUsage.coupons;
      if (!coupon) return;
      
      switch (coupon.category) {
        case 'delivery-fee':
          // Completely removes delivery fee
          deliveryDiscount += deliveryFee;
          break;
        case 'restaurant-fee':
          // Applies percentage discount to entire order for specific restaurant
          // Check if any cart items are from the coupon's restaurant
          const hasMatchingRestaurant = cartItems.some(item => item.restaurant_id === coupon.restaurant_id);
          if (hasMatchingRestaurant) {
            subtotalDiscount += (subtotal * coupon.percentage / 100);
          }
          break;
        case 'dev-fee':
          // Makes the entire order $0 for testing purposes
          subtotalDiscount += subtotal;
          deliveryDiscount += deliveryFee;
          break;
        case 'item-fee':
          // Applies discount to specific item in specific restaurant
          cartItems.forEach(item => {
            if (item.id === coupon.menu_item && item.restaurant_id === coupon.restaurant_id) {
              subtotalDiscount += (item.price * item.quantity * coupon.percentage / 100);
            }
          });
          break;
        default:
          // Fallback for any other category types
          subtotalDiscount += (subtotal * coupon.percentage / 100);
      }
    });
    
    totalDiscount = deliveryDiscount + subtotalDiscount;
    return { deliveryDiscount, subtotalDiscount, totalDiscount };
  }, [appliedCoupons, deliveryFee, subtotal, cartItems]);
  const finalDeliveryFee = Math.max(0, deliveryFee - discounts.deliveryDiscount);
  const finalSubtotal = Math.max(0, subtotal - discounts.subtotalDiscount);
  const finalTax = 0.08875 * finalSubtotal;
  const total = finalSubtotal + finalDeliveryFee + finalTax;
  const isInTab = route.name === 'Cart';

  // Fetch user's redeemed coupons (automatically applied)
  const fetchUserCoupons = async () => {
    if (!session?.user) return;
    
    const { data, error } = await supabase
      .from('coupons_usage')
      .select('*, coupons(*)')
      .eq('user_id', session.user.id)
      .eq('status', 'redeemed');
    
    if (!error && data) {
      setAppliedCoupons(data);
    }
  };

  // Fetch available delivery times based on current day
  const fetchAvailableTimeSlots = async () => {
    try {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      
      // Convert day of week to match database format
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = dayNames[dayOfWeek];
      
      const { data, error } = await supabase
        .from('delivery_times')
        .select('*')
        .eq('day', currentDay)
        .order('hours', { ascending: true });
      
      if (error) {
        console.error('Error fetching delivery times:', error);
        // Fallback to hardcoded times if database fails
        const fallbackTimes = [
          { id: 1, hours: 10, minutes: 0, ampm: 'AM', counter: 0 },
          { id: 2, hours: 11, minutes: 0, ampm: 'AM', counter: 0 },
          { id: 3, hours: 12, minutes: 0, ampm: 'PM', counter: 0 },
          { id: 4, hours: 1, minutes: 0, ampm: 'PM', counter: 0 },
          { id: 5, hours: 2, minutes: 0, ampm: 'PM', counter: 0 },
          { id: 6, hours: 3, minutes: 0, ampm: 'PM', counter: 0 }
        ];
        setAvailableTimeSlots(fallbackTimes);
        return;
      }
      
      // Filter out times that are too close to current time (less than 1 hour 45 minutes)
      const currentTime = new Date();
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();
      
      const filteredTimes = data.filter(timeSlot => {
        const hours = parseInt(timeSlot.hours);
        const minutes = parseInt(timeSlot.minutes) || 0;
        const ampm = timeSlot.ampm;
        
        // Convert slot time to 24-hour format
        let slotHour = hours;
        if (ampm === 'PM' && hours !== 12) {
          slotHour = hours + 12;
        } else if (ampm === 'AM' && hours === 12) {
          slotHour = 0;
        }
        
        // Calculate time difference in minutes
        const slotMinutes = slotHour * 60 + minutes;
        const currentMinutes = currentHour * 60 + currentMinute;
        const timeDifference = slotMinutes - currentMinutes;
        
        // Hide slots that are less than 1 hour and 45 minutes away (105 minutes)
        // Example: If current time is 2:15 PM and slot is 3:00 PM (45 min away), hide it
        // But if current time is 1:30 PM and slot is 3:00 PM (90 min away), show it
        return timeDifference >= 105; // 105 minutes = 1 hour 45 minutes
      });
      
      setAvailableTimeSlots(filteredTimes);
    } catch (error) {
      console.error('Error in fetchAvailableTimeSlots:', error);
      // Fallback to hardcoded times
      const fallbackTimes = [
        { id: 1, hours: 10, minutes: 0, ampm: 'AM', counter: 0 },
        { id: 2, hours: 11, minutes: 0, ampm: 'AM', counter: 0 },
        { id: 3, hours: 12, minutes: 0, ampm: 'PM', counter: 0 },
        { id: 4, hours: 1, minutes: 0, ampm: 'PM', counter: 0 },
        { id: 5, hours: 2, minutes: 0, ampm: 'PM', counter: 0 },
        { id: 6, hours: 3, minutes: 0, ampm: 'PM', counter: 0 }
      ];
      setAvailableTimeSlots(fallbackTimes);
    }
  };

  // Use availableTimeSlots from database instead of hardcoded times
  const filteredTimeSlots = availableTimeSlots;

  // Check if time slots and location are available
  const hasTimeSlots = selectedTimeSlot !== null;
  const hasLocation = selectedLocation !== null;
  const canPlaceOrder = hasTimeSlots && hasLocation;

  const isWeekday = today.getDay() >= 1 && today.getDay() <= 5;
  const hasAvailableTimeSlots = availableTimeSlots.length > 0;
  const isOrderAllowed = serviceOpen && (timeOverride || (isWeekday && canPlaceOrder && hasAvailableTimeSlots));
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

  // Helper function to split cart items by restaurant and create separate orders
  const createOrdersByRestaurant = async (user, orderCode, paymentIntentId, paymentStatus = 'paid') => {
    // Group cart items by restaurant
    const ordersByRestaurant = cartItems.reduce((acc, item) => {
      // Get restaurant info from the cart item (should now be properly set)
      const restaurantId = item.restaurant_id;
      const restaurantName = item.restaurant_name;
      
      if (!restaurantId) {
        console.error('Cart item missing restaurant_id:', item);
        throw new Error('Cart item is missing restaurant information. Please try adding items again.');
      }
      
      if (!acc[restaurantId]) {
        acc[restaurantId] = {
          restaurant_id: restaurantId,
          restaurant_name: restaurantName,
          items: [],
          subtotal: 0
        };
      }
      
      acc[restaurantId].items.push(item);
      acc[restaurantId].subtotal += item.price * item.quantity;
      return acc;
    }, {});

    const createdOrders = [];
    
    // Create separate order for each restaurant
    for (const [restaurantIdKey, restaurantOrder] of Object.entries(ordersByRestaurant)) {
      const deliveryFee = 0.20 * restaurantOrder.subtotal;
      const tax = 0.08875 * restaurantOrder.subtotal;
      const restaurantTotal = restaurantOrder.subtotal + deliveryFee + tax;
      
      // Generate order code for each restaurant order (just use the base order code)
      const restaurantOrderCode = orderCode;
      
      // Validate restaurant_id is a proper integer
      const restaurantIdInt = parseInt(restaurantOrder.restaurant_id);
      if (isNaN(restaurantIdInt)) {
        throw new Error(`Invalid restaurant_id: ${restaurantOrder.restaurant_id}`);
      }
      
      // Insert order into orders table
      const orderInsertData = {
        user_id: user.id,
        restaurant_id: restaurantIdInt, // Ensure it's a proper integer
        restaurant_name: restaurantOrder.restaurant_name,
        items: restaurantOrder.items,
        total: restaurantTotal,
        status: paymentStatus,
        payment_status: paymentStatus,
        payment_intent_id: paymentIntentId,
        delivery_date: selectedDate.toISOString().split('T')[0],
        order_code: restaurantOrderCode,
        delivery_location: selectedLocation?.location || "Main Entrance - City College",
        delivery_time: selectedTimeSlot?.id || null,
      };
      
      const { data: orderData, error: orderError } = await supabase.from('orders').insert([orderInsertData]).select().single();

      if (orderError) {
        console.error(`Error creating order for restaurant ${restaurantOrder.restaurant_name}:`, orderError);
        throw new Error(`Failed to create order for ${restaurantOrder.restaurant_name}`);
      }

      // Insert status into order_status table
      const { error: statusError } = await supabase.from('order_status').insert([
        {
          order_id: orderData.id,
          status: 'submitted',
        },
      ]);

      if (statusError) {
        console.error(`Error creating status for order ${orderData.id}:`, statusError);
      }

      createdOrders.push(orderData);
    }

    return createdOrders;
  };

  // Apple Pay handler function (deprecated in favor of PaymentSheet)
  const handleApplePay = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        Alert.alert('Error', 'Please sign in to use Apple Pay');
        return;
      }

      // Generate order code for Apple Pay
      const newOrderCode = Math.floor(100000 + Math.random() * 900000);
      const totalCents = Math.round(total * 100); // Convert to cents

      // Check if total is $0 (free order due to coupons) - bypass Apple Pay
      if (total <= 0) {
        try {
          const user = session.user;

          // Create separate orders for each restaurant
          const createdOrders = await createOrdersByRestaurant(user, newOrderCode, `free_order_${newOrderCode}`, 'paid');

          // Update delivery time counter
          if (selectedTimeSlot) {
            await supabase
              .from('delivery_times')
              .update({ counter: selectedTimeSlot.counter + 1 })
              .eq('id', selectedTimeSlot.id);
          }

          // Mark applied coupons as used
          if (appliedCoupons.length > 0) {
            try {
              const appliedCouponIds = appliedCoupons.map(couponUsage => couponUsage.id);
              await supabase
                .from('coupons_usage')
                .update({ 
                  status: 'applied',
                  applied_at: new Date().toISOString()
                })
                .in('id', appliedCouponIds);
            } catch (err) {
              console.error('Error updating coupon status:', err);
            }
          }

          clearCart();
          Alert.alert('Success', `Your ${createdOrders.length} order${createdOrders.length > 1 ? 's were' : ' was'} placed successfully!`, [
            {
              text: 'OK',
              onPress: () => navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs', params: { screen: 'Home' } }],
              })
            }
          ]);
          return;
        } catch (error) {
          console.error('Error processing free order:', error);
          Alert.alert('Error', 'Failed to process order. Please contact support.');
          return;
        }
      }

      console.log('Apple Pay - Creating payment intent with data:', {
        cartItems: cartItems.length,
        total: total,
        totalCents: totalCents,
        orderCode: newOrderCode,
        restaurant: restaurant?.name
      });

      // Create payment intent with Apple Pay configuration using direct fetch
      const token = session.access_token;
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL || 'https://pgouwzuufnnhthwrewrv.functions.supabase.co'}/create-payment-intent`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          cartItems, 
          restaurant, 
          amount: totalCents, // Send cents as integer
          currency: 'usd',
          orderCode: newOrderCode,
          metadata: {
            order_type: 'apple_pay',
            user_id: session.user.id,
            restaurant_id: restaurant.restaurant_id,
            restaurant_name: restaurant.restaurant_name,
            items_count: cartItems.length.toString(), // Just count, not full items
            delivery_time: selectedTimeSlot?.id || null,
            delivery_location: selectedLocation?.location || "Main Entrance - City College",
            delivery_date: selectedDate.toISOString().split('T')[0],
            applied_coupons_count: appliedCoupons.length.toString() // Just count, not full coupons
          }
        }),
      });

      const data = await response.json();
      
      console.log('Apple Pay - Payment intent response:', { data, status: response.status });

      if (!response.ok) {
        console.error('Payment intent creation failed:', data);
        Alert.alert('Payment Error', `Failed to create payment intent: ${data.message || 'Unknown error'}`);
        return;
      }

      const { client_secret } = data;
      
      // Initialize PaymentSheet (Apple Pay will be available inside the sheet)
      const { error: initError } = await initPaymentSheet({
        merchantId: 'merchant.com.qbdelivery.quickbitesdelivery',
        customerId: session.user.id,
        paymentIntentClientSecret: client_secret,
        merchantCountryCode: 'US',
        applePay: {
          merchantId: 'merchant.com.qbdelivery.quickbitesdelivery',
          merchantCountryCode: 'US',
        },
        returnURL: 'com.srahin000.quickbites://stripe-redirect',
        allowsDelayedPaymentMethods: true,
      });

      if (initError) {
        console.error('Payment sheet init error:', initError);
        Alert.alert('Payment Error', 'Failed to initialize Apple Pay. Please try again.');
        return;
      }

      // Present PaymentSheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        console.error('Payment presentation error:', presentError);
        Alert.alert('Payment Failed', 'Payment was cancelled or failed. Please try again.');
        return;
      }

      // Handle successful payment
      await handleSuccessfulApplePayPayment(client_secret, newOrderCode);
      
    } catch (error) {
      console.error('Apple Pay error:', error);
      Alert.alert('Payment Failed', error.message || 'An unexpected error occurred. Please try again.');
    }
  };

  // Handle successful Apple Pay payment
  const handleSuccessfulApplePayPayment = async (clientSecret, orderCode) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session.user;

      // Create separate orders for each restaurant
      const createdOrders = await createOrdersByRestaurant(user, orderCode, clientSecret, 'paid');

      // Update delivery time counter
      if (selectedTimeSlot) {
        await supabase
          .from('delivery_times')
          .update({ counter: selectedTimeSlot.counter + 1 })
          .eq('id', selectedTimeSlot.id);
      }

      // Mark applied coupons as used
      if (appliedCoupons.length > 0) {
        try {
          const appliedCouponIds = appliedCoupons.map(couponUsage => couponUsage.id);
          await supabase
            .from('coupons_usage')
            .update({ 
              status: 'applied',
              applied_at: new Date().toISOString()
            })
            .in('id', appliedCouponIds);
        } catch (err) {
          console.error('Error updating coupon status:', err);
        }
      }

      clearCart();
      Alert.alert('Success', `Your ${createdOrders.length} order${createdOrders.length > 1 ? 's were' : ' was'} placed successfully with Apple Pay!`, [
        {
          text: 'OK',
          onPress: () => navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabs', params: { screen: 'Home' } }],
          })
        }
      ]);
      
    } catch (error) {
      console.error('Error processing Apple Pay order:', error);
      Alert.alert('Error', 'Failed to process order. Please contact support.');
    }
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

  useEffect(() => {
    // Fetch user's redeemed coupons
    fetchUserCoupons();
  }, [session]);

  useEffect(() => {
    // Fetch available delivery time slots
    fetchAvailableTimeSlots();
  }, []);

  if (!restaurant) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: themeColors.purple }} edges={['top', 'left', 'right']}>
        <View className="flex-1 justify-center items-center px-6 py-12 bg-white">
          <View className="items-center">
            <View className="w-24 h-24 rounded-full bg-gray-100 items-center justify-center mb-6">
                <Icon.ShoppingCart size={48} color={themeColors.purple} />
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
        {cartItems.length > 0 && (
          <View className="py-4 px-6 bg-white border-b border-gray-100">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-gray-800">Order Items</Text>
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
            </View>
          </View>
        )}
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
              {cartItems.map((item, index) => (
                <View key={index} className="bg-white rounded-lg p-4 mb-3 shadow-sm border border-gray-100">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-lg font-semibold text-gray-800">{item.name}</Text>
                      <Text className="text-sm text-purple-600 font-medium">{item.restaurant_name}</Text>
                      <Text className="text-gray-600">${parseFloat(item.price).toFixed(2)} each</Text>
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
                      ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Applied Coupons */}
          {cartItems.length > 0 && appliedCoupons.length > 0 && (
            <View className="px-6 py-4">
              <Text className="text-lg font-semibold text-gray-800 mb-4">Applied Coupons</Text>
              {appliedCoupons.map((couponUsage, index) => {
                const coupon = couponUsage.coupons;
                if (!coupon) return null;
                
                return (
                  <View key={index} className="bg-green-50 rounded-lg p-4 mb-3 shadow-sm border border-green-200">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1">
                        <Text className="text-lg font-semibold text-green-800">{coupon.coupon_code}</Text>
                        <Text className="text-green-600">
                          {coupon.category === 'delivery-fee' ? 'Free Delivery' : 
                           coupon.category === 'restaurant-fee' ? `${coupon.percentage}% Off Restaurant` :
                           coupon.category === 'dev-fee' ? 'Free Order (Testing)' :
                           coupon.category === 'item-fee' ? `${coupon.percentage}% Off Specific Item` :
                           `${coupon.percentage}% Off`}
                        </Text>
                        {coupon.title && (
                          <Text className="text-sm text-green-500 mt-1">{coupon.title}</Text>
                        )}
                      </View>
                      <View style={{ backgroundColor: '#10B981' }} className="px-4 py-2 rounded-lg">
                        <Text className="text-white font-semibold">Applied</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Order Summary */}
          {cartItems.length > 0 && (
            <View style={{ backgroundColor: '#FEF3C7' }} className="p-6 px-8 rounded-t-3xl mt-4">
              {/* Compact Summary List */}
              <View className="bg-white rounded-2xl p-4 mb-4">
                <Text className="text-lg font-semibold text-gray-800 mb-3">Order Summary</Text>
                <View className="space-y-2">
                  <View className="flex-row justify-between">
                    <Text className="text-gray-600">Subtotal</Text>
                    <Text className="text-gray-700">${subtotal.toFixed(2)}</Text>
                  </View>
                  
                  {/* Show coupon discounts */}
                  {appliedCoupons.length > 0 && (
                    <>
                      {discounts.subtotalDiscount > 0 && (
                        <View className="flex-row justify-between">
                          <Text className="text-green-600">Subtotal Discount</Text>
                          <Text className="text-green-600">-${discounts.subtotalDiscount.toFixed(2)}</Text>
                        </View>
                      )}
                      {discounts.deliveryDiscount > 0 && (
                        <View className="flex-row justify-between">
                          <Text className="text-green-600">Delivery Discount</Text>
                          <Text className="text-green-600">-${discounts.deliveryDiscount.toFixed(2)}</Text>
                        </View>
                      )}
                    </>
                  )}
                  
                  <View className="flex-row justify-between">
                    <Text className="text-gray-600">Delivery Fee</Text>
                    <Text className="text-gray-700">${finalDeliveryFee.toFixed(2)}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-gray-600">Tax (8.875%)</Text>
                    <Text className="text-gray-700">${finalTax.toFixed(2)}</Text>
                  </View>
                  <View className="border-t border-gray-200 pt-2 mt-2">
                    <View className="flex-row justify-between">
                      <Text className="text-lg font-bold text-gray-900">Total</Text>
                      <Text className="text-lg font-bold text-gray-900">${total.toFixed(2)}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Coupon Section */}
              <View className="bg-white rounded-2xl p-4 mb-4">
                <TouchableOpacity
                  onPress={() => navigation.navigate('MainTabs', { screen: 'Rewards' })}
                  className="flex-row items-center justify-between"
                >
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center mr-3">
                      <Icon.Tag size={20} color={themeColors.purple} />
                    </View>
                    <View>
                      <Text className="text-gray-800 font-medium">Have a coupon?</Text>
                      <Text className="text-gray-500 text-sm">Apply it at rewards page</Text>
                    </View>
                  </View>
                  <Icon.ChevronRight size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Delivery Information */}
              <View className="bg-white rounded-2xl p-4">
                <Text className="text-lg font-semibold text-gray-800 mb-3">Delivery Information</Text>
                
                <View className="space-y-3">
                  <View>
                    <Text className="text-sm text-gray-500 mb-1">Date</Text>
                    <Text className="text-gray-800">{selectedDate.toDateString()}</Text>
                  </View>
                  
                  <View>
                    <Text className="text-sm text-gray-500 mb-2">Time</Text>
                    <TouchableOpacity
                      onPress={() => setShowTimeSlotModal(true)}
                      className="border border-gray-200 rounded-lg px-3 py-3 bg-white flex-row items-center justify-between"
                    >
                      <View>
                        <Text className="text-gray-900">
                          {selectedTimeSlot ? formatTime(selectedTimeSlot) : 'Select time'}
                        </Text>
                        {selectedTimeSlot && (
                          <Text className="text-gray-500 text-xs">
                            {selectedTimeSlot.counter}/10 orders • {selectedTimeSlot.counter >= 10 ? 'Full' : 'Available'}
                          </Text>
                        )}
                      </View>
                      <Icon.ChevronRight size={16} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <View>
                    <Text className="text-sm text-gray-500 mb-2">Location</Text>
                    <TouchableOpacity
                      onPress={() => setShowLocationModal(true)}
                      className="border border-gray-200 rounded-lg px-3 py-3 bg-white flex-row items-center justify-between"
                    >
                      <View>
                        <Text className="text-gray-900">
                          {selectedLocation ? selectedLocation.location : 'Select location'}
                        </Text>
                        {selectedLocation && (
                          <Text className="text-gray-500 text-xs">
                            {selectedLocation.address || selectedLocation.description}
                          </Text>
                        )}
                      </View>
                      <Icon.ChevronRight size={16} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
          {!isOrderAllowed ? (
            <Text className="text-red-500 text-center text-sm mt-3">
              {!canPlaceOrder ? 
                'Please select time and location' :
                !hasAvailableTimeSlots ?
                  'No delivery times available for today' :
                  'Service unavailable. Check Instagram for updates.'
              }
            </Text>
          ) : canPlaceOrder ? (
            <View className="mt-4 space-y-4">
              {/* Payment Section Header */}
              <View className="mb-2">
                <Text className="text-lg font-semibold text-gray-800 text-center mb-4">
                  Choose Payment Method
                </Text>
              </View>

              {/* Present Stripe PaymentSheet (Apple Pay shows as an option if available) */}
              <View className="space-y-2">
              {/* Place Order Button */}
              {canUseInstantPay ? (
                <TouchableOpacity
                  onPress={async () => {
                    const instantCode = Math.floor(100000 + Math.random() * 900000);
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session?.user) return;
                    const user = session.user;

                    // Create separate orders for each restaurant
                    const createdOrders = await createOrdersByRestaurant(user, instantCode, `instant_${instantCode}`, 'pending');

                    clearCart();
                    Alert.alert('Success', `Your ${createdOrders.length} order${createdOrders.length > 1 ? 's were' : ' was'} placed successfully!`, [
                      {
                        text: 'OK',
                        onPress: () => navigation.reset({
                          index: 0,
                          routes: [{ name: 'MainTabs', params: { screen: 'Home' } }],
                        })
                      }
                    ]);
                  }}
                  className="w-full"
                >
                  <View style={{ backgroundColor: '#10b981' }} className="rounded-xl p-3">
                    <Text className="text-lg font-semibold text-white text-center">
                      💳 Instant Pay
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

                  // Check if total is $0 (free order due to coupons)
                  if (total <= 0) {
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session?.user) return;
                      const user = session.user;

                      // Create separate orders for each restaurant
                      const createdOrders = await createOrdersByRestaurant(user, newOrderCode, `free_order_${newOrderCode}`, 'paid');

                      // Update delivery time counter
                      if (selectedTimeSlot) {
                        await supabase
                          .from('delivery_times')
                          .update({ counter: selectedTimeSlot.counter + 1 })
                          .eq('id', selectedTimeSlot.id);
                      }

                      // Mark applied coupons as used
                      if (appliedCoupons.length > 0) {
                        try {
                          const appliedCouponIds = appliedCoupons.map(couponUsage => couponUsage.id);
                          await supabase
                            .from('coupons_usage')
                            .update({ 
                              status: 'applied',
                              applied_at: new Date().toISOString()
                            })
                            .in('id', appliedCouponIds);
                        } catch (err) {
                          console.error('Error updating coupon status:', err);
                        }
                      }

                      clearCart();
                      Alert.alert('Success', `Your ${createdOrders.length} order${createdOrders.length > 1 ? 's were' : ' was'} placed successfully!`, [
                        {
                          text: 'OK',
                          onPress: () => navigation.reset({
                            index: 0,
                            routes: [{ name: 'MainTabs', params: { screen: 'Home' } }],
                          })
                        }
                      ]);
                      return;
                    } catch (error) {
                      console.error('Error processing free order:', error);
                      Alert.alert('Error', 'Failed to process order. Please contact support.');
                      return;
                    }
                  }

                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session?.user) return;
                    const user = session.user;

                    // Get the session token for authorization
                    const token = session?.access_token;
                    
                    if (!token) {
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
                    
                    if (!response.ok) {
                      return Alert.alert('Payment Error', data.message || 'Failed to create payment. Please try again.');
                    }

                    const { client_secret, paymentIntentId } = data;
                    
                    if (!client_secret) {
                      return Alert.alert('Payment Error', 'Invalid payment response. Please try again.');
                    }
                    

                    const { error: initError } = await initPaymentSheet({
                      paymentIntentClientSecret: client_secret,
                      merchantDisplayName: 'QuickBites',
                      merchantCountryCode: 'US',
                      applePay: {
                        merchantId: 'merchant.com.qbdelivery.quickbitesdelivery',
                        merchantCountryCode: 'US',
                      },
                      returnURL: 'com.srahin000.quickbites://stripe-redirect',
                    });

                    if (initError) {
                      return Alert.alert('Payment Setup Error', `Failed to initialize payment: ${initError.message}`);
                    }

                    const { error: presentError } = await presentPaymentSheet();

                    if (presentError) {
                      
                      if (presentError.code === 'Canceled') {
                        return Alert.alert('Payment Cancelled', 'You cancelled the payment.');
                      }
                      return Alert.alert('Payment Failed', presentError.message);
                    }

                    // Create separate orders for each restaurant
                    const createdOrders = await createOrdersByRestaurant(user, newOrderCode, paymentIntentId, 'paid');

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

                    // Mark applied coupons as used
                    if (appliedCoupons.length > 0) {
                      try {
                        const appliedCouponIds = appliedCoupons.map(couponUsage => couponUsage.id);
                        const { error: couponError } = await supabase
                          .from('coupons_usage')
                          .update({ 
                            status: 'applied',
                            applied_at: new Date().toISOString()
                          })
                          .in('id', appliedCouponIds);

                        if (couponError) {
                          // Don't show error to user as payment was successful
                        } else {
                        }
                      } catch (err) {
                        // Don't show error to user as payment was successful
                      }
                    }

                    clearCart();
                    Alert.alert('Success', 'Your payment was successful!', [
                      {
                        text: 'OK',
                        onPress: () => navigation.reset({
                          index: 0,
                          routes: [{ name: 'MainTabs', params: { screen: 'Home' } }],
                        })
                      }
                    ]);
                  } catch (error) {
                    console.error('Payment error:', error);
                    Alert.alert('Network error', error.message);
                  }
                }}
                className="w-full"
              >
                <View style={{ backgroundColor: themeColors.purple }} className="rounded-xl p-3">
                  <Text className="text-lg font-semibold text-white text-center">
                      Place Order
                  </Text>
                </View>
              </TouchableOpacity>
              )}
              
              </View>
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
