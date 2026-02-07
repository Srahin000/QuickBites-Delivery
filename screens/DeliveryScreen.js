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
  const deliveryFee = params?.deliveryFee || 0;
  const orderCode = params?.orderCode;
  const selectedLocation = params?.selectedLocation;
  const selectedTimeSlot = params?.selectedTimeSlot;
  const totalLoadUnit = params?.totalLoadUnit || 0;
  const [orderStatus, setOrderStatus] = useState('submitted');
  const [pickupCode, setPickupCode] = useState(null);
  const [deliveryTimeInfo, setDeliveryTimeInfo] = useState(null);

  // Determine order type based on delivery fee
  const isDelivery = deliveryFee > 0;
  const isSplitDelivery = totalLoadUnit > 20 || (deliveryFee > 0 && totalLoadUnit > 15);

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
      case 'ready': return isDelivery ? 'Out for Delivery' : 'Ready for Pickup';
      case 'delivered': return 'Delivered';
      default: return 'Order Submitted';
    }
  };

  const getStepStatus = (stepIndex) => {
    const statusMap = {
      'submitted': 0,
      'processing': 1,
      'preparing': 1,
      'ready': 2,
      'delivered': 3
    };
    const currentStep = statusMap[orderStatus] || 0;
    return stepIndex <= currentStep ? 'active' : 'inactive';
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

        {/* Order Status - Step Tracker */}
        <Animated.View 
          style={{ 
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }}
          className="mx-6 mb-4"
        >
          <View className="bg-gray-50 rounded-2xl p-4">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-semibold text-gray-800">Order Status</Text>
              <View 
                className="px-3 py-1 rounded-full"
                style={{ backgroundColor: getStatusColor(orderStatus) + '20' }}
              >
                <Text 
                  className="font-semibold text-sm"
                  style={{ color: getStatusColor(orderStatus) }}
                >
                  {getStatusText(orderStatus)}
                </Text>
              </View>
            </View>
            
            {/* Step Tracker */}
            <View className="flex-row items-center justify-between">
              {/* Step 1: Order Confirmed */}
              <View className="items-center flex-1">
                <View 
                  className="w-12 h-12 rounded-full items-center justify-center mb-2"
                  style={{ 
                    backgroundColor: getStepStatus(0) === 'active' ? themeColors.purple : '#E5E7EB'
                  }}
                >
                  <Icon.FileText 
                    size={20} 
                    color={getStepStatus(0) === 'active' ? 'white' : '#9CA3AF'} 
                  />
                </View>
                <Text 
                  className="text-xs text-center font-medium"
                  style={{ color: getStepStatus(0) === 'active' ? '#374151' : '#9CA3AF' }}
                >
                  Confirmed
                </Text>
              </View>

              {/* Connecting Line */}
              <View className="h-0.5 flex-1 mx-2" style={{ backgroundColor: getStepStatus(1) === 'active' ? themeColors.purple : '#E5E7EB' }} />

              {/* Step 2: Preparing */}
              <View className="items-center flex-1">
                <View 
                  className="w-12 h-12 rounded-full items-center justify-center mb-2"
                  style={{ 
                    backgroundColor: getStepStatus(1) === 'active' ? themeColors.purple : '#E5E7EB'
                  }}
                >
                  <Icon.Coffee 
                    size={20} 
                    color={getStepStatus(1) === 'active' ? 'white' : '#9CA3AF'} 
                  />
                </View>
                <Text 
                  className="text-xs text-center font-medium"
                  style={{ color: getStepStatus(1) === 'active' ? '#374151' : '#9CA3AF' }}
                >
                  Preparing
                </Text>
              </View>

              {/* Connecting Line */}
              <View className="h-0.5 flex-1 mx-2" style={{ backgroundColor: getStepStatus(2) === 'active' ? themeColors.purple : '#E5E7EB' }} />

              {/* Step 3: On the Way / Ready */}
              <View className="items-center flex-1">
                <View 
                  className="w-12 h-12 rounded-full items-center justify-center mb-2"
                  style={{ 
                    backgroundColor: getStepStatus(2) === 'active' ? themeColors.purple : '#E5E7EB'
                  }}
                >
                  <Icon.Truck 
                    size={20} 
                    color={getStepStatus(2) === 'active' ? 'white' : '#9CA3AF'} 
                  />
                </View>
                <Text 
                  className="text-xs text-center font-medium"
                  style={{ color: getStepStatus(2) === 'active' ? '#374151' : '#9CA3AF' }}
                >
                  {isDelivery ? 'On the Way' : 'Ready'}
                </Text>
              </View>

              {/* Connecting Line */}
              <View className="h-0.5 flex-1 mx-2" style={{ backgroundColor: getStepStatus(3) === 'active' ? themeColors.purple : '#E5E7EB' }} />

              {/* Step 4: Delivered */}
              <View className="items-center flex-1">
                <View 
                  className="w-12 h-12 rounded-full items-center justify-center mb-2"
                  style={{ 
                    backgroundColor: getStepStatus(3) === 'active' ? themeColors.purple : '#E5E7EB'
                  }}
                >
                  <Icon.MapPin 
                    size={20} 
                    color={getStepStatus(3) === 'active' ? 'white' : '#9CA3AF'} 
                  />
                </View>
                <Text 
                  className="text-xs text-center font-medium"
                  style={{ color: getStepStatus(3) === 'active' ? '#374151' : '#9CA3AF' }}
                >
                  Delivered
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Feast Mode Indicator */}
        {isSplitDelivery && (
          <Animated.View 
            style={{ 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }}
            className="mx-6 mb-4"
          >
            <View 
              className="rounded-2xl p-4 border-2"
              style={{ 
                backgroundColor: '#EEF2FF',
                borderColor: '#A5B4FC'
              }}
            >
              <View className="flex-row items-center mb-2">
                <View className="bg-indigo-500 rounded-full p-2 mr-3">
                  <Icon.Package size={20} color="white" />
                </View>
                <Text className="text-lg font-bold" style={{ color: '#4F46E5' }}>
                  Feast Mode Active
                </Text>
              </View>
              <Text className="text-sm text-gray-700 leading-5">
                We've assigned multiple riders to ensure your large order arrives safe and hot. This premium service ensures everything reaches you perfectly.
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Delivery/Pickup Information */}
        <Animated.View 
          style={{ 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }}
          className="mx-6 mb-4"
        >
          <View className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <Text className="text-xl font-bold text-gray-800 mb-3">
              {isDelivery ? 'Delivery Information' : 'Pickup Information'}
            </Text>
            
            <View className="mb-3">
              <View className="flex-row items-center mb-2">
                <Icon.MapPin size={20} color="#6B7280" />
                <Text className="text-gray-600 ml-2 font-medium">
                  {isDelivery ? 'Delivering To' : 'Pickup Location'}
                </Text>
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
                <Text className="text-gray-600 ml-2 font-medium">
                  {isDelivery ? 'Estimated Arrival' : 'Ready By'}
                </Text>
              </View>
              <Text className="text-gray-800 text-lg font-semibold">
                {getDisplayTime()}
              </Text>
            </View>

            {/* Security Code */}
            <View>
              <View className="flex-row items-center mb-2">
                <Icon.Shield size={20} color="#6B7280" />
                <Text className="text-gray-600 ml-2 font-medium">
                  {isDelivery ? 'Handoff Code' : 'Pickup Code'}
                </Text>
              </View>
              <Animated.View 
                className="rounded-xl p-4 items-center border-2"
                style={{
                  borderColor: themeColors.purple,
                  transform: [{ scale: pulseAnim }],
                  borderStyle: 'dashed',
                  backgroundColor: '#FAFAFA'
                }}
              >
                <View className="bg-white px-6 py-3 rounded-lg border border-gray-200">
                  <Text className="text-xs text-gray-500 text-center mb-1 font-medium">
                    SECURITY CODE
                  </Text>
                  <Text className="text-4xl font-bold text-center" style={{ color: themeColors.purple }}>
                    {pickupCode}
                  </Text>
                </View>
              </Animated.View>
              <View className="flex-row items-center justify-center mt-3 px-4">
                <Icon.Lock size={14} color="#9CA3AF" />
                <Text className="text-gray-500 text-xs text-center ml-1" style={{ lineHeight: 16 }}>
                  For your safety, only share this code when you {isDelivery ? 'meet your rider' : 'pick up your order'}
                </Text>
              </View>
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
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'MainTabs', params: { screen: 'Orders' } }],
                });
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
