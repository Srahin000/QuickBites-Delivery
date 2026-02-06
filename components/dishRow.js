import { View, Text, Image, TouchableOpacity, ScrollView, Alert } from 'react-native';
import React, { useState, useEffect } from 'react';
import { themeColors } from '../theme';
import * as Icon from "react-native-feather";
import { useCart } from '../context/CartContext';
import CustomizationModal from './CustomizationModal';

export default function DishRow({ item, restaurant, isLast = false }) {
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
    <View style={{ 
      backgroundColor: 'white',
      borderRadius: 12,
      padding: 16,
      marginHorizontal: 20,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    }}>
      {/* Top Row: Item Name (Bold) and Price (Medium, secondary) on same line */}
      <View style={{ 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        marginBottom: 8,
      }}>
        <Text style={{ 
          fontSize: 17, 
          fontWeight: '700', 
          color: '#000000',
          letterSpacing: -0.41,
          lineHeight: 22,
          flex: 1,
          paddingRight: 12,
        }}>
          {item?.dish_name || 'Unknown Dish'}
        </Text>
        {(item?.menu_price && parseFloat(item.menu_price) > 0) && (
          <Text style={{ 
            fontSize: 16, 
            fontWeight: '500', 
            color: '#666666',
            letterSpacing: -0.32,
            lineHeight: 21,
          }}>
            ${totalPrice}
          </Text>
        )}
      </View>

      {/* Middle Row: Description below title, limited to 80% width */}
      {item?.description && (
        <Text style={{ 
          fontSize: 15, 
          fontWeight: '400', 
          color: '#666666',
          letterSpacing: -0.24,
          lineHeight: 18,
          width: '80%',
          marginBottom: 12,
        }}>
          {item.description}
        </Text>
      )}

      {/* Existing Cart Items */}
      {allCartItems.length > 0 && (
        <View style={{ marginTop: 8, marginBottom: 8 }}>
          <Text style={{ 
            fontSize: 13, 
            fontWeight: '600', 
            color: '#374151',
            marginBottom: 4,
          }}>
            In Cart:
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {allCartItems.map((cartItem, index) => (
              <View key={index} style={{ 
                paddingHorizontal: 8, 
                paddingVertical: 4, 
                backgroundColor: '#D1FAE5', 
                borderWidth: 1,
                borderColor: '#86EFAC',
                borderRadius: 6,
                marginRight: 8,
                marginBottom: 4,
              }}>
                <Text style={{ fontSize: 12, color: '#065F46' }}>
                  {cartItem.quantity}x {cartItem.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Selected Indicator Only */}
      {customizationData && Object.keys(selectedCustomizations).length > 0 && (
        <View style={{ marginTop: 8, marginBottom: 8 }}>
          <View style={{ 
            paddingHorizontal: 12, 
            paddingVertical: 4, 
            backgroundColor: '#F3E8FF', 
            borderWidth: 1,
            borderColor: '#C4B5FD',
            borderRadius: 8,
            alignSelf: 'flex-start',
          }}>
            <Text style={{ fontSize: 12, color: '#6B21A8', fontWeight: '500' }}>
              Selected
            </Text>
          </View>
        </View>
      )}

      {/* Bottom Row: Quantity Controls in bottom-right */}
      <View style={{ 
        flexDirection: 'row', 
        justifyContent: 'flex-end', 
        alignItems: 'center',
        marginTop: 8,
      }}>
        <TouchableOpacity
          onPress={() => removeFromCart(item)}
          style={{ 
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: '#F5F5F5',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: '#E5E5E5',
          }}
        >
          <Icon.Minus strokeWidth={2.5} height={18} width={18} stroke={themeColors.purple} />
        </TouchableOpacity>

        <Text style={{ 
          paddingHorizontal: 12,
          fontSize: 17,
          fontWeight: '600',
          color: '#000000',
        }}>
          {totalQuantity}
        </Text>

        <TouchableOpacity
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
          style={{ 
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: '#F5F5F5',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: '#E5E5E5',
          }}
        >
          <Icon.Plus strokeWidth={2.5} height={18} width={18} stroke={themeColors.purple} />
        </TouchableOpacity>
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
