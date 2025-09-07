import { View, Text, Image, Animated } from 'react-native';
import React, { useEffect, useRef } from 'react';
import { useNavigation, useRoute } from '@react-navigation/core';

export default function OrderPreparingScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const restaurant = params?.restaurant;
  const orderCode = params?.orderCode;
  const cartItems = params?.cartItems || [];
  const subtotal = params?.subtotal || 0;
  const deliveryFee = params?.deliveryFee || 5;
  const tax = params?.tax || 0;

  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: false, // typo fixed: userNativeDriver -> useNativeDriver
    }).start();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.navigate('Delivery', { restaurant, orderCode, cartItems,
        subtotal,
        deliveryFee,
        tax,
        totalAmount: subtotal + deliveryFee+ tax, });
    }, 5000);

    return () => clearTimeout(timer); // cleanup if component unmounts early
  }, [navigation, restaurant, orderCode]);

  return (
    <View className="flex-1 bg-white justify-center items-center">
      <Animated.Text
        className="text-4xl font-bold font-[Bebas] text-gray-700"
        style={{ opacity: progress }}
      >
        Preparing Your Order
      </Animated.Text>

      <Image
        source={require('../assets/deliverygif/deliveryprocessing.gif')}
        className="h-80 w-80"
      />
    </View>
  );
}
