import React, { createContext, useContext, useState } from 'react';
import { Alert } from 'react-native'; // because you're React Native

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [restaurant, setRestaurant] = useState(null); // TRACK the selected restaurant

  const addToCart = (item, restaurantInfo, selectedOption = null) => {
    const price = selectedOption?.price || item.price;
    
    // Use the original dish name (e.g., "Burrito", "Bowl")
    let name = item.name;
    
    const option = selectedOption?.name || null;

    // Extract restaurant info properly
    const restaurantId = restaurantInfo?.restaurant_id || restaurantInfo?.id;
    const restaurantName = restaurantInfo?.restaurant_name || restaurantInfo?.name;

    // Set restaurant context to the first restaurant added, but allow mixed orders
    if (!restaurant) {
      setRestaurant(restaurantInfo); // first item -> set restaurant
    }

    setCartItems((prev) => {
      const existingIndex = prev.findIndex(
        (cartItem) => {
          // Compare by id, option, customizations, AND restaurant
          const sameId = cartItem.id === item.id;
          const sameOption = cartItem.option === option;
          const sameCustomizations = JSON.stringify(cartItem.customizations) === JSON.stringify(item.customizations);
          const sameRestaurant = cartItem.restaurant_id === restaurantId;
          return sameId && sameOption && sameCustomizations && sameRestaurant;
        }
      );
      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += 1;
        return updated;
      } else {
        return [...prev, { 
          ...item, 
          name, 
          price, 
          option, 
          quantity: 1,
          restaurant_id: restaurantId,
          restaurant_name: restaurantName
        }];
      }
    });
  };

  const removeFromCart = (item) => {
    setCartItems((prev) => {
      // First try to find exact match (id + option + customizations + restaurant)
      let existingIndex = prev.findIndex(
        (cartItem) => {
          const sameId = cartItem.id === item.id;
          const sameOption = cartItem.option === item.option;
          const sameCustomizations = JSON.stringify(cartItem.customizations) === JSON.stringify(item.customizations);
          const sameRestaurant = cartItem.restaurant_id === item.restaurant_id;
          return sameId && sameOption && sameCustomizations && sameRestaurant;
        }
      );

      // If no exact match found, try to find by id only (for items without options/customizations)
      if (existingIndex === -1) {
        existingIndex = prev.findIndex(
          (cartItem) => cartItem.id === item.id
        );
      }

      if (existingIndex !== -1) {
        if (prev[existingIndex].quantity === 1) {
          const updated = prev.filter((_, idx) => idx !== existingIndex);
          if (updated.length === 0) {
            setRestaurant(null);
          } else {
            // Update restaurant context to the first remaining restaurant
            const remainingRestaurant = updated[0];
            setRestaurant({
              restaurant_id: remainingRestaurant.restaurant_id,
              restaurant_name: remainingRestaurant.restaurant_name,
              id: remainingRestaurant.restaurant_id,
              name: remainingRestaurant.restaurant_name
            });
          }
          return updated;
        } else {
          return prev.map((cartItem, idx) =>
            idx === existingIndex
              ? { ...cartItem, quantity: cartItem.quantity - 1 }
              : cartItem
          );
        }
      }

      // If no matching item found, return unchanged
      return prev;
    });
  };

  const clearCart = () => {
    setCartItems([]);
    setRestaurant(null);
    // Note: Coupons are managed in TabCartScreen via appliedCoupons state
    // They are fetched fresh from database on mount, so no need to clear here
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
