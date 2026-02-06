import { View, Text, ScrollView, TouchableOpacity, Image, Alert, RefreshControl } from 'react-native';
import React, { useState, useEffect } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Icon from 'react-native-feather';
import { themeColors } from '../theme';
import { useCart } from '../context/CartContext';

// Helper function to format customizations nicely
const formatCustomizations = (customizations) => {
  if (!customizations || Object.keys(customizations).length === 0) {
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

  const pageBg = '#F8F9FB';
  const cardRadius = 16;
  const headerPurpleGlass = 'rgba(80, 46, 250, 0.80)'; // themeColors.purple @ 80%

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Check if cart has items from multiple restaurants
  const uniqueRestaurants = [...new Set(cartItems.map(item => item.restaurant_name))];
  const hasMixedRestaurants = uniqueRestaurants.length > 1;
  const displayRestaurant = hasMixedRestaurants ? 'Mixed Order' : (restaurant?.restaurant_name || restaurant?.name || 'Restaurant');

  const deliveryFee = 0.20 * subtotal;
  const tax = 0.08875 * subtotal;
  const transactionFee = (0.029 * subtotal) + 0.30;
  const summaryTotal = subtotal + tax;
  const total = subtotal + deliveryFee + tax + transactionFee;

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      // Force a complete re-render by updating the force update state
      setForceUpdate(prev => prev + 1);
      
      // Optional: Add any data fetching here if needed
      // await fetchSomeData();
      
      setRefreshing(false);
    } catch (error) {
      console.error('Error refreshing cart:', error);
      setRefreshing(false);
    }
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
    <View style={{ flex: 1, backgroundColor: pageBg }}>
      {/* Glassy Header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: headerPurpleGlass }}>
        <View
          style={{
            backgroundColor: headerPurpleGlass,
            borderBottomLeftRadius: 28,
            borderBottomRightRadius: 28,
            paddingTop: 12,
            paddingBottom: 16,
            paddingHorizontal: 18,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.18,
            shadowRadius: 18,
            elevation: 10,
          }}
        >
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
              <Icon.ArrowLeft stroke="white" width={22} height={22} strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: 'white', fontWeight: '800', fontSize: 26 }}>Your Cart</Text>
              <Text style={{ color: 'white', opacity: 0.85, fontSize: 13, marginTop: 2 }}>
                {displayRestaurant}
              </Text>
            </View>
            {cartItems.length > 0 ? (
              <TouchableOpacity
                onPress={() => {
                  Alert.alert(
                    'Clear Cart',
                    'Are you sure you want to remove all items from your cart?',
                    [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: clearCart }]
                  );
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.92)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                activeOpacity={0.9}
              >
                <Icon.Trash2 stroke={themeColors.purple} width={20} height={20} strokeWidth={2.2} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* Content Area */}
      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 140, paddingTop: 14 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Cart Items */}
          {cartItems.length > 0 ? (
            <View style={{ paddingHorizontal: 16 }}>
              {cartItems.map((item, index) => {
                const customizations = formatCustomizations(item.customizations);
                return (
                  <View
                    key={index}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: cardRadius,
                      padding: 16,
                      marginBottom: 14,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.06,
                      shadowRadius: 14,
                      elevation: 2,
                    }}
                  >
                    {/* Item Header */}
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1 pr-3">
                        {!!item.image_url && (
                          <Image
                            style={{ width: 52, height: 52, borderRadius: 14, marginRight: 12 }}
                            source={{ uri: item.image_url }}
                          />
                        )}
                        <View className="flex-1">
                          <Text style={{ fontSize: 17, fontWeight: '700', color: '#111827' }}>{item.name}</Text>
                          <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                            ${parseFloat(item.price).toFixed(2)} each
                          </Text>
                        </View>
                      </View>

                      {/* Quantity Stepper (44x44) */}
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity
                          onPress={() => removeFromCart(item)}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: '#F3F4F6',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                          }}
                          activeOpacity={0.85}
                        >
                          <Icon.Minus width={18} height={18} stroke={themeColors.purple} strokeWidth={2.8} />
                        </TouchableOpacity>
                        <Text style={{ marginHorizontal: 14, fontSize: 17, fontWeight: '700', color: '#111827' }}>
                          {item.quantity}
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            try {
                              if (item && item.id && restaurant) addToCart(item, restaurant);
                              else Alert.alert('Error', 'Unable to add item. Please try again.');
                            } catch (error) {
                              console.error('Error adding item to cart:', error);
                              Alert.alert('Error', 'Failed to add item to cart. Please try again.');
                            }
                          }}
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: '#F3F4F6',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: '#E5E7EB',
                          }}
                          activeOpacity={0.85}
                        >
                          <Icon.Plus width={18} height={18} stroke={themeColors.purple} strokeWidth={2.8} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Customizations: compact chips (bubble style) */}
                    {customizations && customizations.length > 0 && (
                      <View style={{ marginTop: 10 }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                          {customizations.map((c, idx) => (
                            <View
                              key={`${index}-c-${idx}`}
                              style={{
                                paddingHorizontal: 9,
                                paddingVertical: 5,
                                borderRadius: 999,
                                backgroundColor: '#F3F4F6',
                                borderWidth: 1,
                                borderColor: '#E5E7EB',
                                marginRight: 8,
                                marginBottom: 8,
                              }}
                            >
                              <Text style={{ fontSize: 11, color: '#6B7280' }}>{c}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Item Total */}
                    <View
                      style={{
                        marginTop: 10,
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: '#EEF2F7',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 13, color: '#6B7280' }}>Item total</Text>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
                        ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="flex-1 justify-center items-center px-6 py-12">
              <Text className="text-2xl font-bold text-gray-800 mb-8 text-center">Add more items to view cart</Text>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={{
                  borderWidth: 2,
                  borderColor: themeColors.purple,
                  backgroundColor: 'transparent',
                  borderRadius: 18,
                  paddingVertical: 16,
                  paddingHorizontal: 28,
                }}
              >
                <View className="flex-row items-center">
                  <Icon.ArrowLeft stroke={themeColors.purple} width={22} height={22} strokeWidth={2.6} />
                  <Text style={{ color: themeColors.purple, fontWeight: '800', fontSize: 18, marginLeft: 10 }}>
                    Browse Menu
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Order Summary */}
          {cartItems.length > 0 && (
            <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
              <View
                style={{
                  backgroundColor: 'white',
                  borderRadius: cardRadius,
                  padding: 16,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.06,
                  shadowRadius: 14,
                  elevation: 2,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 }}>
                  Order Summary
                </Text>

                <View style={{ gap: 8 }}>
                  <View className="flex-row justify-between">
                    <Text style={{ fontSize: 13, color: '#6B7280' }}>Subtotal</Text>
                    <Text style={{ fontSize: 13, color: '#374151', fontWeight: '600' }}>${subtotal.toFixed(2)}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text style={{ fontSize: 12, color: '#6B7280' }}>Tax (8.875%)</Text>
                    <Text style={{ fontSize: 12, color: '#374151', fontWeight: '600' }}>${tax.toFixed(2)}</Text>
                  </View>
                  <View style={{ borderTopWidth: 1, borderTopColor: '#EEF2F7', paddingTop: 10, marginTop: 6 }}>
                    <View className="flex-row justify-between items-center">
                      <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>Total</Text>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827' }}>${summaryTotal.toFixed(2)}</Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>
                    Delivery & transaction fees calculated at checkout.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Secondary action: Add More (outlined) */}
          {cartItems.length > 0 && (
            <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={{
                  borderWidth: 2,
                  borderColor: themeColors.purple,
                  backgroundColor: 'transparent',
                  borderRadius: 16,
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                }}
                activeOpacity={0.85}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon.Plus stroke={themeColors.purple} width={20} height={20} strokeWidth={2.6} />
                  <Text style={{ marginLeft: 10, color: themeColors.purple, fontWeight: '800', fontSize: 16 }}>
                    Add More
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Fixed Footer - Sibling to ScrollView */}
        {cartItems.length > 0 && (
          <SafeAreaView edges={['bottom']} style={{ backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: 62,
                backgroundColor: 'white',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -6 },
                shadowOpacity: 0.1,
                shadowRadius: 10,
                elevation: 20,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Icon.Lock stroke="#9CA3AF" width={14} height={14} strokeWidth={2.5} />
                <Text style={{ marginLeft: 6, fontSize: 12, color: '#6B7280', fontWeight: '500' }}>
                  Safe & Secure checkout
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'MainTabs', params: { screen: 'Cart' } }],
                  })
                }
                style={{
                  backgroundColor: themeColors.purple,
                  borderRadius: 18,
                  paddingVertical: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: themeColors.purple,
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 10,
                }}
                activeOpacity={0.9}
              >
                <Text style={{ color: 'white', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 }}>
                  Checkout • ${total.toFixed(2)}
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        )}
      </View>
    </View>
  );
}