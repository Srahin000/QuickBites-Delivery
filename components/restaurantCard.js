import { View, Text, Image, TouchableOpacity } from 'react-native';
import React, { useState } from 'react';
import * as Icon from "react-native-feather";
import { themeColors } from '../theme';
import { useNavigation } from '@react-navigation/core';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeInUp, 
  SlideInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';

export default function RestaurantCard({ item }) {
  const navigation = useNavigation();
  const [imageLoading, setImageLoading] = useState(true);
  
  // Animation values
  const cardScale = useSharedValue(1);
  const imageOpacity = useSharedValue(0);

  const handlePress = () => {
    // Add bounce effect
    cardScale.value = withSequence(
      withSpring(0.95, { damping: 10, stiffness: 400 }),
      withSpring(1, { damping: 15, stiffness: 300 })
    );
    navigation.navigate("Restaurant", { restaurant: item });
  };

  const handleImageLoad = () => {
    setImageLoading(false);
    imageOpacity.value = withTiming(1, { duration: 300 });
  };

  // Animated styles
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const imageStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
  }));

  const getRatingColor = (rating) => {
    if (rating >= 4.5) return 'text-green-600';
    if (rating >= 4.0) return 'text-yellow-600';
    if (rating >= 3.5) return 'text-orange-600';
    return 'text-red-600';
  };

  const getCategoryColor = (category) => {
    const colors = {
      'Pizza': 'bg-red-100 text-red-700',
      'Burger': 'bg-orange-100 text-orange-700',
      'Coffee': 'bg-brown-100 text-brown-700',
      'Dessert': 'bg-pink-100 text-pink-700',
      'Salad': 'bg-green-100 text-green-700',
      'Sushi': 'bg-blue-100 text-blue-700',
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
  };

  return (
    <Animated.View style={cardStyle}>
    <TouchableOpacity
        onPress={handlePress}
        className="bg-white rounded-2xl shadow-lg mb-4 mx-4 overflow-hidden border border-gray-100"
        style={{ elevation: 5 }}
        activeOpacity={0.9}
      >
        {/* Image Container */}
        <View className="relative">
          {imageLoading && (
            <View className="w-full h-44 bg-gray-200 items-center justify-center">
              <Animated.View entering={FadeIn}>
                <Icon.Image className="w-12 h-12 text-gray-400" />
              </Animated.View>
            </View>
          )}
          {item.image_url && (
            <Animated.Image
              style={imageStyle}
              className="w-full h-44"
              source={{ uri: item.image_url }}
              resizeMode="cover"
              onLoad={handleImageLoad}
            />
          )}
          
          {/* Category Badge */}
          {item.category && (
            <View className="absolute top-3 left-3">
              <View className={`px-3 py-1 rounded-full ${getCategoryColor(item.category)}`}>
                <Text className="text-xs font-semibold">{item.category}</Text>
              </View>
            </View>
          )}
          
          {/* Rating Badge */}
          <View className="absolute top-3 right-3">
            <View className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full flex-row items-center">
              <Image source={require("../assets/star/star.webp")} className="h-3 w-3 mr-1" />
              <Text className={`text-xs font-bold ${getRatingColor(item.ratings || 0)}`}>
                {item.ratings || 'N/A'}
              </Text>
            </View>
          </View>
        </View>

        {/* Content */}
        <View className="p-4">
          <View className="flex-row items-start justify-between mb-2">
            <Text className="text-xl font-bold text-gray-800 flex-1 mr-2" numberOfLines={2}>
              {item.restaurant_name || 'Unknown Restaurant'}
            </Text>
            <View className="bg-green-100 px-2 py-1 rounded-full flex-shrink-0">
              <Text className="text-green-700 text-xs font-semibold">Open</Text>
            </View>
          </View>
          
          <View className="flex-row items-center space-x-1 mb-2">
            <Image source={require("../assets/star/star.webp")} className="h-4 w-4" />
            <Text className="text-sm text-gray-700">
              <Text className={`font-semibold ${getRatingColor(item.ratings || 0)}`}>
                {item.ratings || 'N/A'}
              </Text>
              <Text className="text-gray-500"> ({item.reviews || 0} reviews)</Text>
            </Text>
            <Text className="text-gray-500">·</Text>
            <Text className="text-sm text-gray-500">{item.category || 'Restaurant'}</Text>
          </View>
          
          <View className="flex-row items-start space-x-1 mb-3">
            <Icon.MapPin height={14} width={14} stroke="#6B7280" style={{ marginTop: 2, flexShrink: 0 }} />
            <Text className="text-sm text-gray-600 flex-1" numberOfLines={2} ellipsizeMode="tail">
              {item.address || 'Address not available'}
            </Text>
          </View>
          
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center space-x-1">
              <Icon.Clock height={14} width={14} stroke="#6B7280" />
              <Text className="text-sm text-gray-600">15-25 min</Text>
            </View>
            <View className="flex-row items-center space-x-1">
              <Icon.Truck height={14} width={14} stroke="#6B7280" />
              <Text className="text-sm text-gray-600 ml-1">Delivery</Text>
            </View>
          </View>
        </View>
    </TouchableOpacity>
    </Animated.View>
  );
}
