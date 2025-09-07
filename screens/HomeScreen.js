import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar, ScrollView } from 'react-native';
import * as Icon from 'react-native-feather';
import { themeColors } from '../theme';
import Categories from '../components/categories';
import RestaurantList from '../components/RestaurantList';
import DealsCarousel from '../components/DealsCarousel';
import { useNavigation } from '@react-navigation/core';
import { FlatList } from 'react-native';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeInUp, 
  SlideInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import LoadingSpinner from '../components/LoadingSpinner';
import FloatingActionButton from '../components/FloatingActionButton';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const navigation = useNavigation();
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Animation values
  const searchBarScale = useSharedValue(0.8);

  useEffect(() => {
    // Animate search bar on mount
    searchBarScale.value = withSpring(1, { damping: 15, stiffness: 100 });

    // Simulate loading time
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleGameButtonPress = () => {
    navigation.navigate('GameScreen');
  };

  // Animated styles
  const searchBarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: searchBarScale.value }],
  }));

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setRefreshing(false);
    }, 1500); // Simulate reload
  }, []);

  if (isLoading) {
    return <LoadingSpinner type="food" message="Loading Quickbites..." size="large" />;
  }

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={{ backgroundColor: themeColors.bgColor2 }}>
        {/* 🔍 Search Bar */}
        <Animated.View 
          style={searchBarStyle}
          entering={FadeInDown.delay(200).springify()}
          className="flex-row items-center space-x-2 px-4 pt-2 pb-3"
        >
          <View className="flex-row flex-1 items-center p-2.5 rounded-full border border-gray-300 bg-white shadow-sm">
            <Icon.Search height="20" width="20" stroke="gray" />
            <TextInput
              placeholder="Restaurants"
              className="ml-2 flex-1 text-base"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="gray"
            />
            <View className="flex-row items-center space-x-1 border-0 border-l-2 pl-2 border-l-gray-300">
              <Icon.MapPin height="18" width="18" stroke="gray" />
              <Text className="text-gray-600 text-sm">City College</Text>
            </View>
          </View>
        </Animated.View>
      </SafeAreaView>

      <FlatList
        data={[]}
        ListHeaderComponent={
          <>
            {/* 🎡 Deals Carousel */}
            <Animated.View entering={FadeInUp.delay(300).springify()}>
            <DealsCarousel />
            </Animated.View>

            {/* 🧭 Categories */}
            <Animated.View entering={FadeInUp.delay(400).springify()}>
            <Categories activeCategory={activeCategory} setActiveCategory={setActiveCategory} />
            </Animated.View>

            {/* 🍽 Restaurants */}
            <Animated.View entering={FadeInUp.delay(500).springify()}>
            <RestaurantList category={activeCategory} searchQuery={searchQuery} />
            </Animated.View>
          </>
        }
        keyExtractor={() => Math.random().toString()}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}