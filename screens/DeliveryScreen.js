import { View, Text, TouchableOpacity, Animated, Easing, ScrollView, Image } from 'react-native';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Icon from 'react-native-feather';
import { themeColors } from '../theme';
import { supabase } from "../supabaseClient";

export default function DeliveryScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const restaurant = params?.restaurant;
  const cartItems = params?.cartItems || [];
  const totalAmount = params?.totalAmount || 0;
  const subtotal = params?.subtotal || 0;
  const deliveryFee = params?.deliveryFee || 5;
  const orderCode = params?.orderCode;
  const selectedLocation = params?.selectedLocation;
  const selectedTimeSlot = params?.selectedTimeSlot;
  const [orderStatus, setOrderStatus] = useState('submitted');
  const [pickupCode, setPickupCode] = useState(null);
  const [deliveryTimeInfo, setDeliveryTimeInfo] = useState(null);

  const tax = 0.08875 * subtotal;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Generate pickup code
    const code = Math.floor(100000 + Math.random() * 900000);
    setPickupCode(code);

    // Fetch delivery time info if we have a time slot ID
    const fetchDeliveryTime = async () => {
      if (selectedTimeSlot?.id) {
        try {
          const { data, error } = await supabase
            .from('delivery_times')
            .select('*')
            .eq('id', selectedTimeSlot.id)
            .single();
          
          if (!error && data) {
            setDeliveryTimeInfo(data);
          }
        } catch (err) {
          console.error('Error fetching delivery time:', err);
        }
      }
    };

    fetchDeliveryTime();

    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.ease,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for pickup code
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [selectedTimeSlot]);

  const formatTime = (timeSlot) => {
    if (!timeSlot) return '5:30 PM';
    const hour = timeSlot.hours;
    const minute = timeSlot.minutes ? timeSlot.minutes.toString().padStart(2, '0') : '00';
    const ampm = timeSlot.ampm;
    return `${hour}:${minute} ${ampm}`;
  };

  const getDisplayTime = () => {
    if (deliveryTimeInfo) {
      return formatTime(deliveryTimeInfo);
    }
    if (selectedTimeSlot) {
      return formatTime(selectedTimeSlot);
    }
    return '5:30 PM';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'submitted': return '#3B82F6';
      case 'processing': return '#F59E0B';
      case 'preparing': return '#EF4444';
      case 'ready': return '#10B981';
      case 'delivered': return '#6B7280';
      default: return '#3B82F6';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'submitted': return 'Order Submitted';
      case 'processing': return 'Processing';
      case 'preparing': return 'Preparing';
      case 'ready': return 'Ready for Pickup';
      case 'delivered': return 'Delivered';
      default: return 'Order Submitted';
    }
  };

  if (!restaurant) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center bg-white">
        <Text className="text-xl text-gray-600">No restaurant selected</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Header */}
        <Animated.View 
          style={{ 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }}
          className="px-6 pt-8 pb-4"
        >
          <View className="items-center">
            <View className="w-16 h-16 rounded-full bg-green-100 items-center justify-center mb-3">
              <Icon.CheckCircle size={32} color="#10B981" />
            </View>
            <Text className="text-2xl font-bold text-gray-800 text-center mb-2">
              Order Submitted Successfully!
            </Text>
            <Text className="text-gray-600 text-center">
              Your order from {restaurant.name} is being processed
            </Text>
          </View>
        </Animated.View>

        {/* Order Status */}
        <Animated.View 
          style={{ 
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }}
          className="mx-6 mb-4"
        >
          <View className="bg-gray-50 rounded-2xl p-3">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-semibold text-gray-800">Order Status</Text>
              <View 
                className="px-3 py-1 rounded-full"
                style={{ backgroundColor: getStatusColor(orderStatus) + '20' }}
              >
                <Text 
                  className="font-semibold"
                  style={{ color: getStatusColor(orderStatus) }}
                >
                  {getStatusText(orderStatus)}
                </Text>
              </View>
            </View>
            <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <View 
                className="h-full rounded-full"
                style={{ 
                  backgroundColor: getStatusColor(orderStatus),
                  width: '25%' // 25% for submitted status
                }}
              />
            </View>
          </View>
        </Animated.View>

        {/* Pickup Information */}
        <Animated.View 
          style={{ 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }}
          className="mx-6 mb-4"
        >
          <View className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <Text className="text-xl font-bold text-gray-800 mb-3">Pickup Information</Text>
            
            <View className="mb-3">
              <View className="flex-row items-center mb-2">
                <Icon.MapPin size={20} color="#6B7280" />
                <Text className="text-gray-600 ml-2 font-medium">Pickup Location</Text>
              </View>
              <Text className="text-gray-800 text-lg font-semibold">
                {selectedLocation?.location || "Main Entrance - City College"}
              </Text>
              {selectedLocation?.address && (
                <Text className="text-gray-600 text-sm mt-1">
                  {selectedLocation.address}
                </Text>
              )}
            </View>

            <View className="mb-3">
              <View className="flex-row items-center mb-2">
                <Icon.Clock size={20} color="#6B7280" />
                <Text className="text-gray-600 ml-2 font-medium">Ready By</Text>
              </View>
              <Text className="text-gray-800 text-lg font-semibold">
                {getDisplayTime()}
              </Text>
            </View>

            <View className="mb-3">
              <View className="flex-row items-center mb-2">
                <Icon.Hash size={20} color="#6B7280" />
                <Text className="text-gray-600 ml-2 font-medium">Pickup Code</Text>
              </View>
              <Animated.View 
                style={{ transform: [{ scale: pulseAnim }] }}
                className="bg-primary rounded-xl p-4 items-center"
              >
                <Text className="text-4xl font-bold text-white">
                  {pickupCode}
                </Text>
              </Animated.View>
              <Text className="text-gray-600 text-sm text-center mt-2">
                Show this code when picking up your order
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Order Summary */}
        <Animated.View 
          style={{ 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }}
          className="mx-6 mb-4"
        >
          <View className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <Text className="text-xl font-bold text-gray-800 mb-3">Order Summary</Text>
            
            {/* Restaurant Info */}
            <View className="flex-row items-center mb-3 pb-3 border-b border-gray-100">
              <Image 
                source={{ uri: restaurant.image_url }} 
                className="w-12 h-12 rounded-full"
              />
              <View className="ml-3">
                <Text className="text-lg font-semibold text-gray-800">
                  {restaurant.name}
                </Text>
                <Text className="text-gray-600 text-sm">
                  {restaurant.cuisine}
                </Text>
              </View>
            </View>

            {/* Order Items */}
            <View className="mb-3">
              {cartItems.map((item, index) => (
                <View key={index} className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center flex-1">
                    <Text className="text-gray-600 mr-2">{item.quantity}x</Text>
                    <Text className="text-gray-800 flex-1">{item.name}</Text>
                  </View>
                  <Text className="text-gray-800 font-semibold">
                    ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Price Breakdown */}
            <View className="space-y-2 pt-4 border-t border-gray-100">
              <View className="flex-row justify-between">
                <Text className="text-gray-600">Subtotal</Text>
                <Text className="text-gray-800">${subtotal.toFixed(2)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-600">Delivery Fee</Text>
                <Text className="text-gray-800">${deliveryFee.toFixed(2)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-600">Tax (8.875%)</Text>
                <Text className="text-gray-800">${tax.toFixed(2)}</Text>
              </View>
              <View className="flex-row justify-between pt-2 border-t border-gray-200">
                <Text className="text-lg font-bold text-gray-800">Total</Text>
                <Text className="text-lg font-bold text-gray-800">${totalAmount.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View 
          style={{ 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }}
          className="px-6 pb-4"
        >
          <View className="space-y-3">
            <TouchableOpacity
              onPress={() => {
                navigation.navigate('MainTabs', { screen: 'Orders' });
              }}
              className="bg-primary rounded-2xl p-4 shadow-sm"
            >
              <Text className="text-white text-lg font-semibold text-center">
                View Order Status
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'MainTabs', params: { screen: 'Home' } }],
                });
              }}
              className="bg-gray-100 rounded-2xl p-4"
            >
              <Text className="text-gray-800 text-lg font-semibold text-center">
                Back to Home
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
