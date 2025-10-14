import { View, Text, Image, TouchableOpacity, ScrollView, Alert } from 'react-native';
import React, { useState, useEffect } from 'react';
import { themeColors } from '../theme';
import * as Icon from "react-native-feather";
import { useCart } from '../context/CartContext';
import CustomizationModal from './CustomizationModal';

export default function DishRow({ item, restaurant }) {
  const { addToCart, removeFromCart, cartItems } = useCart();
  const [selectedCustomizations, setSelectedCustomizations] = useState({});
  const [showCustomizationModal, setShowCustomizationModal] = useState(false);

  // Utility function to capitalize first letter
  const capitalizeText = (text) => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  };

  // Find all cart items for this dish (regardless of customizations)
  const allCartItems = cartItems.filter(cartItem => cartItem.id === item?.id);
  const totalQuantity = allCartItems.reduce((sum, cartItem) => sum + cartItem.quantity, 0);
  
  // Find cart item with matching customizations for current selection
  const currentItem = cartItems.find((cartItem) => {
    const sameId = cartItem.id === item?.id;
    const sameCustomizations = JSON.stringify(cartItem.customizations) === JSON.stringify(selectedCustomizations);
    return sameId && sameCustomizations;
  });
  const currentQuantity = currentItem?.quantity || 0;

  // Initialize selectedCustomizations with existing cart item customizations
  useEffect(() => {
    if (currentItem && currentItem.customizations) {
      setSelectedCustomizations(currentItem.customizations);
    }
  }, [currentItem]);

  // Clear selections when item is removed from cart
  useEffect(() => {
    if (totalQuantity === 0) {
      setSelectedCustomizations({});
    }
  }, [totalQuantity]);

  // Parse the customization JSON from spec column
  let customizationData = null;
  try {
    if (item?.spec) {
      if (typeof item.spec === 'string') {
        // If it's a string, parse it as JSON
        customizationData = JSON.parse(item.spec);
      } else if (typeof item.spec === 'object') {
        // If it's already an object, use it directly
        customizationData = item.spec;
      }
    }
  } catch (error) {
    console.error('Error parsing customization JSON:', error);
    customizationData = null;
  }
  const basePrice = customizationData?.base_price || item?.menu_price || 0;
  const customizations = customizationData?.customizations || {};


  const handleCustomizationConfirm = (customizations, totalPrice) => {
    setSelectedCustomizations(customizations);
    // Add to cart with customizations
    addToCart({ 
      ...item, 
      name: item?.dish_name,
      price: totalPrice, 
      customizations: customizations,
      option: null 
    }, restaurant);
  };

  const getTotalPrice = () => {
    let total = basePrice;
    
    Object.entries(selectedCustomizations).forEach(([key, value]) => {
      if (value === true && !key.includes('_option')) {
        // Handle main item selection (e.g., "Base_Brown Rice": true)
        const [categoryKey, itemKey] = key.split('_');
        if (customizations[categoryKey] && customizations[categoryKey][itemKey]) {
          const itemValue = customizations[categoryKey][itemKey];
          if (typeof itemValue === 'number') {
            total += itemValue;
          }
        }
      } else if (typeof value === 'string' && key.includes('_option')) {
        // Handle sub-option selection (e.g., "Base_Brown Rice_option": "regular")
        const [categoryKey, itemKey] = key.replace('_option', '').split('_');
        if (customizations[categoryKey] && 
            customizations[categoryKey][itemKey] &&
            typeof customizations[categoryKey][itemKey] === 'object') {
          const subValue = customizations[categoryKey][itemKey][value];
          if (subValue !== undefined) {
            total += subValue;
          }
        }
      }
    });
    
    return total.toFixed(2);
  };

  const getCustomizationSummary = () => {
    const summary = [];
    const processedItems = new Set();
    
    Object.entries(selectedCustomizations).forEach(([key, value]) => {
      if (value === true && !key.includes('_option')) {
        // Main item selection
        const [categoryKey, itemKey] = key.split('_');
        const optionKey = `${categoryKey}_${itemKey}_option`;
        const selectedOption = selectedCustomizations[optionKey];
        
        if (selectedOption) {
          summary.push(`${capitalizeText(itemKey)}: ${capitalizeText(selectedOption)}`);
        } else {
          summary.push(capitalizeText(itemKey));
        }
        processedItems.add(key);
      }
    });
    
    return summary;
  };

  const totalPrice = getTotalPrice();

  return (
    <View className="flex-row items-center bg-white p-3 rounded-3xl shadow-2xl mb-3 mx-2">
      {item?.image_url && (
        <Image className="rounded-3xl" style={{ width: 100, height: 100 }} source={{ uri: item.image_url }} />
      )}

      <View className="flex flex-1 space-y-3">
        <View className="pl-3">
          <Text className="text-xl">{item?.dish_name || 'Unknown Dish'}</Text>
          <Text className="text-gray-700">{item?.description || ''}</Text>
        </View>

        {/* Existing Cart Items */}
        {allCartItems.length > 0 && (
          <View className="pl-3 mb-2">
            <Text className="text-sm font-semibold text-gray-700 mb-1">In Cart:</Text>
            <View className="flex-row flex-wrap">
              {allCartItems.map((cartItem, index) => (
                <View key={index} className="px-2 py-1 bg-green-100 border border-green-300 rounded mr-2 mb-1">
                  <Text className="text-xs text-green-700">
                    {cartItem.quantity}x {cartItem.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Selected Indicator Only */}
        {customizationData && Object.keys(selectedCustomizations).length > 0 && (
          <View className="pl-3 mb-2">
            <View className="px-3 py-1 bg-purple-100 border border-purple-300 rounded-lg self-start">
              <Text className="text-xs text-purple-700 font-medium">Selected</Text>
            </View>
          </View>
        )}

        <View className="flex-row justify-between pl-3 items-center mt-2">
          <Text className="text-gray-700 text-lg font-bold">${totalPrice}</Text>
          <View className="flex-row items-center">
            <TouchableOpacity
              className="p-1 rounded-full"
              style={{ backgroundColor: themeColors.bgColor(1) }}
              onPress={() => removeFromCart(item)}
            >
              <Icon.Minus strokeWidth={2} height={20} width={20} stroke={'white'} />
            </TouchableOpacity>

            <Text className="px-3">{totalQuantity}</Text>

            <TouchableOpacity
              className="p-1 rounded-full"
              style={{ backgroundColor: themeColors.bgColor(1) }}
              onPress={() => {
                if (customizationData && Object.keys(customizations).length > 0) {
                  // Clear selections and show fresh customization modal
                  setSelectedCustomizations({});
                  setShowCustomizationModal(true);
                } else {
                  // Add to cart directly if no customizations
                  addToCart({ 
                    ...item, 
                    name: item?.dish_name,
                    price: parseFloat(totalPrice), 
                    customizations: selectedCustomizations,
                    option: null 
                  }, restaurant);
                }
              }}
            >
              <Icon.Plus strokeWidth={2} height={20} width={20} stroke={'white'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      {/* Customization Modal */}
      <CustomizationModal
        visible={showCustomizationModal}
        onClose={() => setShowCustomizationModal(false)}
        customizationData={customizationData}
        initialSelections={selectedCustomizations}
        onConfirm={handleCustomizationConfirm}
      />
    </View>
  );
}
