import { View, Text, Image, ScrollView, TouchableOpacity } from 'react-native';
import React, { useState } from 'react';
import { useRoute } from '@react-navigation/core';
import { StatusBar } from 'expo-status-bar';
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

  return (
    <View className="flex-1 relative bg-white">

      <ScrollView>
        <View className="relative">
        {item.image_url && (
            <Image className="w-full h-72" source={{ uri: item.image_url }} />
          )}

          <TouchableOpacity
            className="absolute top-14 left-4 p-2 bg-gray-50 rounded-full shadow"
            onPress={() => navigation.goBack()}
          >
            <Icon.ArrowLeft strokeWidth={3} stroke={themeColors.bgColor(1)} />
          </TouchableOpacity>
        </View>

        <View
          style={{ borderTopLeftRadius: 40, borderTopRightRadius: 40 }}
          className="bg-white -mt-12 pt-6 px-4"
        >
          <Text className="text-3xl font-bold">{item.name}</Text>

          <View className="flex-row space-x-2 my-1">
            <View className="flex-row items-center space-x-1">
              <Image source={require("../assets/star/star.webp")} className="h-4 w-4" />
              <Text className="text-xs">
                <Text className="text-green-700">{item.stars}</Text>
                <Text className="text-gray-700">
                  ({item.reviews} reviews) ·{" "}
                  <Text className="font-semibold">{item.category}</Text>
                </Text>
              </Text>
            </View>

            <View className="flex-row items-center space-x-1">
              <Icon.MapPin height="15" width="15" color="gray" />
              <Text className="text-gray-700 text-xs">Nearby · {item.address}</Text>
            </View>
          </View>

          <Text className="mt-2 text-gray-600">{item.description}</Text>
        </View>

        <View className="pb-36 bg-white">
          <Text className="px-4 py-4 text-2xl font-bold">Menu</Text>
          {item.dishes.map((dish, index) => (
            <DishRow item={{ ...dish }} restaurant={item} key={index} />
          ))}
        </View>
      </ScrollView>

      {/* Absolute Cart Icon */}
      <CartIcon />
    </View>
  );
}
