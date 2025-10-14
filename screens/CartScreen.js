import { View, Text, ScrollView, TouchableOpacity, Image, Alert, RefreshControl } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Icon from 'react-native-feather';
import { themeColors } from '../theme';
import { useCart } from '../context/CartContext';

// Helper function to format customizations nicely
const formatCustomizations = (customizations) => {
  console.log('formatCustomizations called with:', customizations);
  
  if (!customizations || Object.keys(customizations).length === 0) {
    console.log('No customizations found, returning null');
    return null;
  }

  const formattedCustomizations = [];
  const processedGroups = new Set();
  
  Object.entries(customizations).forEach(([key, value]) => {
    // Skip option keys and false/null values
    if (key.includes('option') || value === false || value === null || value === undefined) {
      return;
    }
    
    // Extract group name (e.g., "Size_Large" -> "Size")
    const groupMatch = key.match(/^([^_]+)_(.+)$/);
    if (!groupMatch) return;
    
    const groupName = groupMatch[1];
    const optionName = groupMatch[2];
    
    // Skip if we've already processed this group
    if (processedGroups.has(groupName)) {
      return;
    }
    
    // Only process if the value is true (selected)
    if (value === true) {
      const displayGroup = groupName.charAt(0).toUpperCase() + groupName.slice(1).replace(/_/g, ' ');
      const displayOption = optionName.charAt(0).toUpperCase() + optionName.slice(1).replace(/_/g, ' ');
      
      formattedCustomizations.push(`${displayGroup}: ${displayOption}`);
      processedGroups.add(groupName);
    }
  });

  return formattedCustomizations;
};

export default function CartScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);
  const navigation = useNavigation();
  const route = useRoute();
  const { cartItems, clearCart, restaurant, addToCart, removeFromCart } = useCart();

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Check if cart has items from multiple restaurants
  const uniqueRestaurants = [...new Set(cartItems.map(item => item.restaurant_name))];
  const hasMixedRestaurants = uniqueRestaurants.length > 1;
  const displayRestaurant = hasMixedRestaurants ? 'Mixed Order' : (restaurant?.restaurant_name || restaurant?.name || 'Restaurant');

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  // Force UI update when cart changes
  useEffect(() => {
    setForceUpdate(prev => prev + 1);
  }, [cartItems.length]);

  if (!restaurant) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: '#fff' }} edges={['left', 'right']}>
        <View className="flex-1 justify-center items-center px-6 py-12 bg-white">
          <View className="items-center">
            <Text className="text-2xl font-bold text-gray-800 mb-8 text-center">
              Add more items to view cart
            </Text>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ 
                backgroundColor: themeColors.purple,
                borderRadius: 20,
                paddingVertical: 18,
                paddingHorizontal: 32,
                shadowColor: themeColors.purple,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <View className="flex-row items-center">
                <Icon.ArrowLeft className="w-6 h-6 text-white mr-3" />
                <Text className="text-white font-bold text-xl">
                  Browse Menu
            </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: themeColors.purple }} edges={['left', 'right']}>
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
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 28 }}>Your Cart</Text>
        <Text style={{ color: 'white', opacity: 0.8, fontSize: 14, marginTop: 4 }}>
          Browse • Customize • Add More
        </Text>
      </View>

      {/* Main Content */}
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        {/* Header with Order Items and Clear All */}
        {cartItems.length > 0 && (
          <View className="px-6 py-4 bg-white border-b border-gray-100">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-gray-800">Order Items</Text>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    'Clear Cart',
                    'Are you sure you want to remove all items from your cart?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Clear', style: 'destructive', onPress: clearCart }
                    ]
                  );
                }}
                className="flex-row items-center"
              >
                <Icon.Trash2 className="w-4 h-4 text-red-500 mr-1" />
                <Text className="text-red-500 text-sm font-medium">Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 50 }}
          className="pt-2"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Cart Items with Customizations */}
        {cartItems.length > 0 ? (
            <View className="px-4">
              {cartItems.map((item, index) => {
                const customizations = formatCustomizations(item.customizations);
                return (
                  <View key={index} className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
                    {/* Item Header */}
                    <View className="flex-row items-center justify-between mb-3">
                      <View className="flex-row items-center flex-1">
                        <Image className="h-12 w-12 rounded-full mr-3" source={{ uri: item.image_url }} />
                        <View className="flex-1">
                          <Text className="text-lg font-semibold text-gray-800">{item.name}</Text>
                          <Text className="text-sm text-purple-600 font-medium">{item.restaurant_name}</Text>
                          <Text className="text-gray-600">${parseFloat(item.price).toFixed(2)} each</Text>
                        </View>
                      </View>
              <View className="flex-row items-center">
                <TouchableOpacity
                          onPress={() => removeFromCart(item)}
                          className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center"
                >
                          <Icon.Minus size={16} color="#6B7280" />
                </TouchableOpacity>
                        <Text className="mx-4 text-lg font-semibold text-gray-800 min-w-[30px] text-center">
                          {item.quantity}
                        </Text>
                <TouchableOpacity
                          onPress={() => {
                            try {
                              console.log('Plus button clicked - Item:', item);
                              console.log('Plus button clicked - Restaurant:', restaurant);
                              
                              if (item && item.id && restaurant) {
                                console.log('Calling addToCart with:', { item, restaurant });
                                addToCart(item, restaurant);
                              } else {
                                console.error('Missing required properties:', { 
                                  itemId: item?.id, 
                                  itemExists: !!item, 
                                  restaurantExists: !!restaurant 
                                });
                                Alert.alert('Error', 'Unable to add item. Please try again.');
                              }
                            } catch (error) {
                              console.error('Error adding item to cart:', error);
                              Alert.alert('Error', 'Failed to add item to cart. Please try again.');
                            }
                          }}
                          className="w-8 h-8 rounded-full bg-purple-600 items-center justify-center"
                        >
                          <Icon.Plus size={16} color="white" />
                </TouchableOpacity>
              </View>
                    </View>

                    {/* Customizations Display */}
                    {item.customizations && Object.keys(item.customizations).length > 0 && (
                      <View className="bg-gray-50 rounded-lg p-3 mb-3">
                        <Text className="text-sm font-medium text-gray-700 mb-2">Customizations:</Text>
                        {customizations && customizations.length > 0 ? (
                          customizations.map((customization, idx) => (
                            <Text key={idx} className="text-sm text-gray-600 mb-1">
                              • {customization}
                            </Text>
                          ))
                        ) : null}
                      </View>
                    )}

                    {/* Item Total */}
                    <View className="flex-row justify-between items-center pt-2 border-t border-gray-100">
                      <Text className="text-gray-600">Total for this item</Text>
                      <Text className="text-lg font-semibold text-gray-800">
                        ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="flex-1 justify-center items-center px-6 py-12">
              <Text className="text-2xl font-bold text-gray-800 mb-8 text-center">
                Add more items to view cart
              </Text>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={{ 
                  backgroundColor: themeColors.purple,
                  borderRadius: 20,
                  paddingVertical: 18,
                  paddingHorizontal: 32,
                  shadowColor: themeColors.purple,
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                <View className="flex-row items-center">
                  <Icon.ArrowLeft className="w-6 h-6 text-white mr-3" />
                  <Text className="text-white font-bold text-xl">
                    Browse Menu
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Order Summary */}
      {cartItems.length > 0 && (
            <View className="px-4 mt-4">
              <View className="bg-gradient-to-r from-purple-50 to-yellow-50 rounded-2xl p-4 border border-purple-100">
                <Text className="text-lg font-semibold text-gray-800 mb-3">Order Summary</Text>
                <View className="space-y-2">
          <View className="flex-row justify-between">
                    <Text className="text-gray-600">Subtotal</Text>
            <Text className="text-gray-700">${subtotal.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between">
                    <Text className="text-gray-600">Delivery Fee</Text>
                    <Text className="text-gray-700">${(0.20 * subtotal).toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between">
                    <Text className="text-gray-600">Tax (8.875%)</Text>
                    <Text className="text-gray-700">${(0.08875 * subtotal).toFixed(2)}</Text>
          </View>
                  <View className="border-t border-gray-200 pt-2 mt-2">
          <View className="flex-row justify-between">
                      <Text className="text-lg font-bold text-gray-900">Total</Text>
                      <Text className="text-lg font-bold text-gray-900">${(subtotal + (0.20 * subtotal) + (0.08875 * subtotal)).toFixed(2)}</Text>
                    </View>
                  </View>
          </View>
              </View>
            </View>
          )}

          {/* Call to Action */}
          {cartItems.length > 0 && (
            <View className="px-4 mt-6 mb-8">
              <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <View className="items-center">
                  <Icon.ShoppingBag className="w-12 h-12 text-purple-600 mb-3" />
                  <Text className="text-lg font-semibold text-gray-800 mb-2">
                    Ready to order more?
                  </Text>
                  <Text className="text-gray-600 text-center mb-4">
                    Continue browsing to add more delicious items to your cart
            </Text>
              <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={{ 
                      backgroundColor: themeColors.purple,
                      borderRadius: 16,
                      paddingVertical: 16,
                      paddingHorizontal: 24,
                      shadowColor: themeColors.purple,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 6,
                    }}
                    className="w-full mb-4"
                  >
                    <View className="flex-row items-center justify-center">
                      <Icon.ArrowLeft className="w-5 h-5 text-white mr-3" />
                      <Text className="text-white font-semibold text-lg">
                        Add More Items
                    </Text>
                  </View>
                </TouchableOpacity>
                  
                  <Text className="text-lg font-semibold text-gray-800 text-center mb-4">
                    Done Ordering?
                  </Text>
                  
                  <TouchableOpacity
                    onPress={() => navigation.reset({
                      index: 0,
                      routes: [{ name: 'MainTabs', params: { screen: 'Cart' } }],
                    })}
                    style={{ 
                      backgroundColor: themeColors.purple,
                      borderRadius: 16,
                      paddingVertical: 16,
                      paddingHorizontal: 24,
                      shadowColor: themeColors.purple,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 6,
                    }}
                    className="w-full"
                  >
                    <View className="flex-row items-center justify-center">
                      <Text className="text-white font-bold text-lg">
                        Checkout
                  </Text>
                </View>
              </TouchableOpacity>
                </View>
            </View>
        </View>
      )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}