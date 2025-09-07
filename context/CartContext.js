import React, { createContext, useContext, useState } from 'react';
import { Alert } from 'react-native'; // because you're React Native

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [restaurant, setRestaurant] = useState(null); // TRACK the selected restaurant

  const addToCart = (item, restaurantInfo, selectedOption = null) => {
    const price = selectedOption?.price || item.price;
    const name = selectedOption?.name ? `${item.name} (${selectedOption.name})` : item.name;
    const option = selectedOption?.name || null;

    if (!restaurant) {
      setRestaurant(restaurantInfo); // first item -> set restaurant
    }

    if (restaurant && restaurant.id !== restaurantInfo.id) {
      Alert.alert(
        'Start a new order?',
        'You already have items from another restaurant. Clear cart and start over?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes',
            onPress: () => {
              clearCart();
              setRestaurant(restaurantInfo);
              setCartItems([{ ...item, name, price, option, quantity: 1 }]);
            },
          },
        ]
      );
      return;
    }

    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (cartItem) => cartItem.id === item.id && cartItem.option === option
      );
      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        return updated;
      } else {
        return [...prev, { ...item, name, price, option, quantity: 1 }];
      }
    });
  };

  const removeFromCart = (item) => {
    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (cartItem) => cartItem.id === item.id && cartItem.option === item.option
      );
      if (existingIndex !== -1 && prev[existingIndex].quantity === 1) {
        const updated = prev.filter((_, idx) => idx !== existingIndex);
        if (updated.length === 0) {
          setRestaurant(null);
        }
        return updated;
      } else {
        return prev.map((cartItem, idx) =>
          idx === existingIndex
            ? { ...cartItem, quantity: cartItem.quantity - 1 }
            : cartItem
        );
      }
    });
  };

  const clearCart = () => {
    setCartItems([]);
    setRestaurant(null);
  };

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, clearCart, restaurant }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
