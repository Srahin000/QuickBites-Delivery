import { View, Text, TouchableOpacity } from 'react-native';
import React from 'react';
import { themeColors } from '../theme';
import { useNavigation } from '@react-navigation/core';
import { useCart } from '../context/CartContext'; // <-- import cart context

export default function CartIcon() {
  const { cartItems, restaurant } = useCart(); // <-- fix: also pull restaurant
  const navigation = useNavigation();

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cartItems.reduce((sum, item) => sum + item.quantity * item.price, 0);

  if (totalItems === 0) return null;

  return (
    <View className="absolute bottom-5 w-full z-50">
      <TouchableOpacity
        onPress={() => navigation.navigate("Cart")}
        className="flex-row justify-between items-center mx-5 p-4 rounded-full py-4 shadow-lg bg-primary"
      >
        <View className="p-2 px-4 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}>
          <Text className="font-extrabold text-white text-lg">{totalItems}</Text>
        </View>
        <Text className="flex-1 text-center font-extrabold text-white text-lg mx-2">View Cart</Text>
        <Text className="font-extrabold text-white text-lg">${totalPrice.toFixed(2)}</Text>
      </TouchableOpacity>
    </View>
  );
}
