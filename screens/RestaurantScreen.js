import { View, Text, Image, ScrollView, TouchableOpacity, Platform } from 'react-native';
import React, { useState } from 'react';
import { useRoute } from '@react-navigation/core';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Icon from "react-native-feather";
import { themeColors } from '../theme';
import { useNavigation } from '@react-navigation/core';
import DishRow from '../components/dishRow';
import CartIcon from '../components/carticon';

export default function RestaurantScreen() {
  const [color, colorChanged] = useState(themeColors.bgColor(2));
  const { params } = useRoute();
  const navigation = useNavigation();
  let item = params.restaurant;

  // Brand Yellow - softer, less neon
  const brandYellow = '#F5B041';

  return (
    <View className="flex-1 relative bg-white">
      <StatusBar barStyle="light-content" />
      {/* Back Button - Outside ScrollView for proper z-index */}
      <View style={{ position: 'absolute', top: 0, left: 0, zIndex: 10, pointerEvents: 'box-none' }}>
        <SafeAreaView edges={['top']} style={{ alignSelf: 'flex-start' }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-12 h-12 rounded-full bg-white/80 backdrop-blur-md items-center justify-center ml-4 mt-2"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 6,
              elevation: 8,
            }}
          >
            <Icon.ArrowLeft strokeWidth={3} stroke="#502efa" width={24} height={24} />
          </TouchableOpacity>
        </SafeAreaView>
      </View>
      <ScrollView>
        <View style={{ position: 'relative' }}>
          {item.image_url && (
            <Image className="w-full h-72" source={{ uri: item.image_url }} />
          )}
        </View>

        <View
          style={{ borderTopLeftRadius: 40, borderTopRightRadius: 40 }}
          className="bg-white -mt-12 pt-6 px-4"
        >
          {/* Store Title - Large Title, Bold, Black */}
          <Text style={{ 
            fontSize: 34, 
            fontWeight: '700', 
            color: '#000000',
            letterSpacing: 0.37,
            lineHeight: 41,
          }}>
            {item?.restaurant_name || 'Unknown Restaurant'}
          </Text>

          <View className="my-1">
            {/* Star reviews row */}
            <View className="flex-row items-center space-x-1">
              <Image source={require("../assets/star/star.webp")} className="h-5 w-5" />
              <Text style={{ fontSize: 12, fontWeight: '600' }}>
                <Text className="text-green-700">{item?.ratings || 'N/A'}</Text>
                <Text className="text-gray-700">
                  ({item?.reviews || 0} reviews) ·{" "}
                  <Text style={{ fontSize: 12, fontWeight: '600' }}>{item?.category || 'Unknown'}</Text>
                </Text>
              </Text>
            </View>

            {/* Address row - separate line for long addresses */}
            <View className="flex-row items-center mt-1">
              <Text style={{ fontSize: 12, color: '#374151' }} className="flex-1">{item?.address || 'Address not available'}</Text>
            </View>
          </View>

          <Text className="mt-2 text-gray-600">{item?.description || ''}</Text>
        </View>

        <View className="pb-36 bg-white">
          {/* Section Header - Title 2, Semibold, 24pt top padding */}
          <Text style={{ 
            fontSize: 22, 
            fontWeight: '600', 
            color: '#000000',
            letterSpacing: 0.35,
            lineHeight: 28,
            paddingTop: 24,
            paddingHorizontal: 16,
            paddingBottom: 16,
          }}>
            Menu
          </Text>
          {item.menu_items
            ?.filter(d => !d.out_of_stock)
            ?.sort((a, b) => {
              // Move items with menu_price 0.00 to the end
              const aPrice = a.menu_price || 0;
              const bPrice = b.menu_price || 0;
              if (aPrice === 0 && bPrice !== 0) return 1;
              if (aPrice !== 0 && bPrice === 0) return -1;
              return 0; // Keep original order for non-zero items
            })
            ?.map((dish, index, array) => (
              <DishRow 
                item={{ ...dish }} 
                restaurant={item} 
                key={index}
                isLast={index === array.length - 1}
              />
            ))}
        </View>
      </ScrollView>

      {/* Absolute Cart Icon */}
      <CartIcon />
    </View>
  );
}
