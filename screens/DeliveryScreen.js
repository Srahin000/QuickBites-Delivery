import { View, Text, TouchableOpacity, Animated, Easing } from 'react-native';
import React, { useEffect, useRef } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import {supabase} from '../supabaseClient';

export default function DeliveryScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const restaurant = params?.restaurant;
  const cartItems = params?.cartItems || []; // cartItems should be passed as param too
  const totalAmount = params?.totalAmount || 0;
  const subtotal = params?.subtotal || 0;
  const deliveryFee = params?.deliveryFee || 5;
  const tax = 0.08875 * subtotal;

  // Dummy data
  const pickupLocation = "Main Entrance - City College";
  const pickupTime = "5:30 PM";
  const pickupCode = Math.floor(100000 + Math.random() * 900000); // random 6-digit code

  // Animation values
  const topTextAnim = useRef(new Animated.Value(0)).current;
  const arrivalTimeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(topTextAnim, {
      toValue: 1,
      duration: 1000,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(arrivalTimeAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.ease,
        useNativeDriver: true,
      }).start();
    });
  }, []);

  const topTextTranslateY = topTextAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -300],
  });

  const arrivalTimeOpacity = arrivalTimeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  if (!restaurant) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text>No restaurant selected</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 flex-column bg-white">
      {/* Top half */}
      <View className="flex-1 justify-center items-center">
        <Animated.View style={{ transform: [{ translateY: topTextTranslateY }] }}>
          <Text className="text-4xl font-bold font-[Bebas] text-gray-700 text-center px-6">
            Your Order from {restaurant.name} has been placed successfully!
          </Text>
        </Animated.View>

        <Animated.View
          style={{
            opacity: arrivalTimeOpacity,
            marginTop: 20,
          }}
        >
          <Text className="text-center text-3xl font-bold font-[Bebas] text-gray-700">
            Pickup Location:
          </Text>
          <Text className="text-primary text-2xl text-center font-extrabold">
            {pickupLocation}
          </Text>

          <Text className="text-center text-3xl font-bold font-[Bebas] text-gray-700 mt-4">
            Ready by:
          </Text>
          <Text className="text-primary text-2xl text-center font-extrabold">
            {pickupTime}
          </Text>

          <Text className="text-center text-3xl font-bold font-[Bebas] text-gray-700 mt-4">
            Your Pickup Code:
          </Text>
          <Text className="text-primary text-4xl text-center font-extrabold">
            {pickupCode}
          </Text>
        </Animated.View>
      </View>

      {/* Bottom Summary */}
      <View className="p-6 border-t border-gray-300">
  <Text className="text-2xl font-bold font-[Bebas] mb-2 text-gray-700">Order Summary</Text>
  <Text className="text-lg text-gray-600">Items: {cartItems.length}</Text>
  <Text className="text-lg text-gray-600">Subtotal: ${subtotal.toFixed(2)}</Text>
  <Text className="text-lg text-gray-600">Delivery Fee: ${deliveryFee.toFixed(2)}</Text>
  <Text className="text-lg text-gray-600">Tax (8.875%): ${tax.toFixed(2)}</Text>
  <Text className="text-xl font-extrabold text-gray-800 mt-1">Total: ${totalAmount.toFixed(2)}</Text>

</View>


      {/* Home Button */}
      <View className="justify-end items-center p-4">
        <TouchableOpacity
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
          className="w-1/2"
        >
          <View className="bg-primary rounded-lg p-4">
            <Text className="text-3xl font-bold font-[Bebas] text-white text-center">
              Home
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}
