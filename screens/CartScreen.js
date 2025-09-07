import { View, Text, ScrollView, TouchableOpacity, Image, Alert, RefreshControl } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Icon from 'react-native-feather';
import { useStripe } from '@stripe/stripe-react-native';
import { supabase } from '../supabaseClient';
import { themeColors } from '../theme';
import { useCart } from '../context/CartContext';
import { useSession } from '../context/SessionContext';

export default function CartScreen() {
  const [serviceOpen, setServiceOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState('10:00 AM');
  const [showDevPay, setShowDevPay] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const isWeekday = today.getDay() >= 1 && today.getDay() <= 5;
  const isOrderAllowed = serviceOpen && isWeekday && filteredTimeSlots.length > 0;

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
  
      if (prodError) console.error('Error fetching prod status:', prodError);
      else setServiceOpen(prodStatus.open);
  
      if (devError) console.error('Error fetching dev status:', devError);
      else setShowDevPay(!devStatus.open); // 👈 if dev "open" = true, hide Dev Pay
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
                <View className="border rounded px-3 py-2 bg-white">
              {filteredTimeSlots.length > 0 ? (
                filteredTimeSlots.map((slot) => (
                  <TouchableOpacity
                    key={slot}
                    onPress={() => setSelectedTime(slot)}
                        className={`py-1 ${selectedTime === slot ? 'bg-purple-700 rounded px-2' : ''}`}
                  >
                    <Text className={`${selectedTime === slot ? 'text-white' : 'text-black'}`}>{slot}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text className="text-red-600 font-semibold">No delivery slots remaining today</Text>
              )}
            </View>
          </View>
          {!isOrderAllowed ? (
            <Text className="text-red-600 text-center text-lg font-semibold">
              🚫 Service unavailable. Deliveries run Mon–Fri, 10AM–3PM.
              {'\n'}📢 Check our Instagram for live updates.
            </Text>
          ) : (
            <View className="justify-end items-center p-4 space-y-4">
              {/* 🟢 Place Order Button */}
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
                    const response = await fetch('https://pgouwzuufnnhthwrewrv.functions.supabase.co/create-payment-intent', {
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

                    Alert.alert('Success', 'Your payment was successful!');
                    clearCart();
                    navigation.navigate('OrderPreparing', { restaurant, orderCode: newOrderCode });
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
              {/* 🔧 Dev Pay Button */}
              {showDevPay && (
              <TouchableOpacity
                onPress={async () => {
                  const devCode = Math.floor(100000 + Math.random() * 900000);
                  const user = supabase.auth.user();
                  if (!user) return;

                  const { error } = await supabase.from('orders').insert([
                    {
                      user_id: user.id,
                      restaurant_id: restaurant.id,
                      restaurant_name: restaurant.name,
                      items: cartItems,
                      total,
                      status: 'dev-paid',
                      created_at: new Date(),
                      order_code: devCode.toString(),
                    },
                  ]);

                  if (!error) {
                    clearCart();
                    navigation.navigate('OrderPreparing', {
                      restaurant,
                      orderCode: devCode,
                      cartItems,
                      subtotal,
                      deliveryFee,
                      tax,
                      totalAmount: subtotal + deliveryFee + tax,
                    });
                  } else {
                    console.error("Order insert error:", error);
                  }
                }}
                className="w-3/4"
              >
                    <View style={{ backgroundColor: '#10b981' }} className="rounded-2xl p-4 shadow-lg">
                      <Text className="text-2xl font-bold text-white text-center">
                    Dev Instant Pay
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            </View>
          )}
        </View>
      )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
