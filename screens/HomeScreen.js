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
import { useSession } from '../context/SessionContext-v2';
import supabase from '../supabaseClient';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const navigation = useNavigation();
  const { session } = useSession();
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [hasActiveOrder, setHasActiveOrder] = useState(false);

  // Animation values
  const searchBarScale = useSharedValue(0.8);
  const activeOrderScale = useSharedValue(0.8);
  const activeOrderOpacity = useSharedValue(0);

  useEffect(() => {
    // Animate search bar on mount
    searchBarScale.value = withSpring(1, { damping: 15, stiffness: 100 });

    // Simulate loading time
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Check for active orders
  useEffect(() => {
    const checkActiveOrders = async () => {
      if (!session?.user) return;

      try {
        const { data: orders, error } = await supabase
          .from('orders')
          .select(`
            id,
            order_code,
            restaurant_name,
            total,
            created_at,
            order_status!inner(status)
          `)
          .eq('user_id', session.user.id)
          .in('order_status.status', ['submitted', 'processing', 'preparing', 'ready to pickup'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('Error fetching active orders:', error);
          return;
        }

        if (orders && orders.length > 0) {
          setActiveOrder(orders[0]);
          setHasActiveOrder(true);
          
          // Animate active order card
          activeOrderScale.value = withSpring(1, { damping: 15, stiffness: 100 });
          activeOrderOpacity.value = withTiming(1, { duration: 500 });
        } else {
          setActiveOrder(null);
          setHasActiveOrder(false);
          activeOrderOpacity.value = withTiming(0, { duration: 300 });
        }
      } catch (err) {
        console.error('Error checking active orders:', err);
      }
    };

    checkActiveOrders();
  }, [session, refreshing]);

  // Refresh active orders when screen comes into focus or tab is pressed
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (session?.user) {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 1000);
      }
    });

    return unsubscribe;
  }, [navigation, session]);

  // Listen for refresh parameter from tab press
  useEffect(() => {
    const unsubscribe = navigation.addListener('state', (e) => {
      const state = e.data.state;
      if (state && state.routes) {
        const currentRoute = state.routes[state.index];
        if (currentRoute.name === 'Home' && currentRoute.params?.refresh) {
          // Tab was pressed, trigger refresh
          setRefreshing(true);
          setTimeout(() => setRefreshing(false), 1000);
        }
      }
    });

    return unsubscribe;
  }, [navigation]);

  const handleGameButtonPress = () => {
    navigation.navigate('GameScreen');
  };

  // Animated styles
  const searchBarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: searchBarScale.value }],
  }));

  const activeOrderStyle = useAnimatedStyle(() => ({
    transform: [{ scale: activeOrderScale.value }],
    opacity: activeOrderOpacity.value,
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
        {/* Header with Profile and Search */}
        <Animated.View 
          style={searchBarStyle}
          entering={FadeInDown.delay(200).springify()}
          className="flex-row items-center justify-between px-4 pt-2 pb-3"
        >
          {/* 🔍 Search Bar - Shorter */}
          <View className="flex-row items-center flex-1 mr-3">
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
          </View>

          {/* 👤 Profile Button */}
          <TouchableOpacity
            onPress={() => navigation.navigate('ProfileScreen')}
            className="w-12 h-12 rounded-full bg-white border border-gray-300 shadow-sm items-center justify-center"
          >
            <Icon.User height="24" width="24" stroke={themeColors.bgColor2} />
          </TouchableOpacity>
        </Animated.View>

        {/* 🚨 Active Order Alert */}
        {hasActiveOrder && activeOrder && (
          <Animated.View 
            style={activeOrderStyle}
            entering={FadeInDown.delay(300).springify()}
            className="mx-4 mb-4"
          >
            <View className={`rounded-2xl p-4 shadow-lg ${
              activeOrder.order_status?.status === 'ready to pickup' 
                ? 'bg-gradient-to-r from-green-500 to-emerald-600' 
                : 'bg-gradient-to-r from-orange-400 to-red-500'
            }`}>
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center mb-2">
                    {activeOrder.order_status?.status === 'ready to pickup' ? (
                      <Icon.Package size={20} color="white" />
                    ) : (
                      <Icon.Clock size={20} color="white" />
                    )}
                    <Text className="text-white font-bold text-lg ml-2">
                      {activeOrder.order_status?.status === 'ready to pickup' 
                        ? 'Ready for Pickup!' 
                        : 'Active Order'
                      }
                    </Text>
                  </View>
                  <Text className="text-white text-sm opacity-90 mb-1">
                    {activeOrder.restaurant_name}
                  </Text>
                  <Text className="text-white text-xs opacity-75">
                    Order #{activeOrder.order_code}
                  </Text>
                  {activeOrder.order_status?.status && (
                    <Text className="text-white text-xs opacity-75 mt-1 font-medium">
                      Status: {activeOrder.order_status.status}
                    </Text>
                  )}
                </View>
                <View className="items-center">
                  <View className="bg-white/20 rounded-xl p-3 mb-2">
                    <Text className="text-white text-2xl font-bold">
                      {activeOrder.order_code}
                    </Text>
                  </View>
                  <Text className="text-white text-xs text-center opacity-75">
                    Pickup Code
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('MainTabs', { screen: 'Orders' })}
                className="bg-white/20 rounded-xl p-3 mt-3"
              >
                <Text className="text-white text-center font-semibold">
                  {activeOrder.order_status?.status === 'ready to pickup' 
                    ? 'View Pickup Details' 
                    : 'View Order Status'
                  }
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
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
            <RestaurantList 
              category={activeCategory} 
              searchQuery={searchQuery} 
              hasActiveOrder={hasActiveOrder}
            />
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