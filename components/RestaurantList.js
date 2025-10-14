import { useEffect, useState } from 'react';
import { View, FlatList, ActivityIndicator, Text } from 'react-native';
import supabase from "../supabaseClient"
import RestaurantCard from './restaurantCard';
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
import * as Icon from "react-native-feather";
import LoadingSpinner from './LoadingSpinner';

export default function RestaurantList({ category, searchQuery, hasActiveOrder }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false); // Start with false to prevent stuck loader
  const [hasLoaded, setHasLoaded] = useState(false); // Track if we've ever loaded successfully

  // Component-level timeout to prevent any stuck loading states
  useEffect(() => {
    const componentTimeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setHasLoaded(true);
      }
    }, 3000); // 3 second component timeout

    return () => clearTimeout(componentTimeout);
  }, [loading]);

  useEffect(() => {
    const fetchRestaurants = async () => {
      setLoading(true);
      
      try {
        // First, get restaurant_ids from beta_restaurant table
        const { data: betaRestaurants, error: betaError } = await supabase
          .from('beta_restaurant')
          .select('restaurant_id');
        
        if (betaError) {
          console.error('Error fetching beta restaurants:', betaError);
          setRestaurants([]);
          setLoading(false);
          return;
        }
        
        
        if (!betaRestaurants || betaRestaurants.length === 0) {
          setRestaurants([]);
          setLoading(false);
          return;
        }
        
        // Extract restaurant IDs
        const restaurantIds = betaRestaurants.map(br => br.restaurant_id);
        
        // Then fetch restaurants from restaurant_master using those IDs
        const { data: restaurants, error: restaurantError } = await supabase
          .from('restaurant_master')
          .select('*, menu_items(*)')
          .in('restaurant_id', restaurantIds);
        
        if (restaurantError) {
          console.error('Error fetching restaurants:', restaurantError);
          setRestaurants([]);
        } else {
          setRestaurants(restaurants || []);
        }
      } catch (error) {
        console.error('Unexpected error:', error);
        setRestaurants([]);
      } finally {
        setLoading(false);
        setHasLoaded(true);
      }
    };
    
    fetchRestaurants();
    
    // Add a timeout fallback to ensure loading never gets stuck
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 5000); // 5 second timeout (reduced from 10)
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [category]);

  const filteredRestaurants = restaurants.filter(restaurant =>
    restaurant?.restaurant_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && !hasLoaded) {
    return (
      <View className="py-8">
        <LoadingSpinner type="dots" message="Loading restaurants..." size="medium" />
      </View>
    );
  }

  const renderRestaurantCard = ({ item, index }) => (
    <Animated.View entering={FadeInUp.delay(index * 100).springify()}>
      <Animated.View>
      <RestaurantCard item={item} />
      </Animated.View>
    </Animated.View>
  );

  const EmptyState = () => (
    <Animated.View 
      entering={FadeIn.delay(300)}
      className="flex-1 items-center justify-center py-16"
    >
      <View className="items-center">
        <View className="w-24 h-24 rounded-full bg-gray-100 items-center justify-center mb-4">
          <Icon.Search className="w-12 h-12 text-gray-400" />
        </View>
        <Text className="text-xl font-semibold text-gray-600 mb-2">
          {searchQuery ? 'No restaurants found' : 'No restaurants available'}
        </Text>
        <Text className="text-gray-500 text-center px-8">
          {searchQuery 
            ? `No restaurants match "${searchQuery}"`
            : 'Check back later for new restaurants'
          }
        </Text>
      </View>
    </Animated.View>
  );

  const ListHeader = () => (
    <Animated.View entering={FadeInDown.delay(200)} className="pt-4 pb-2">
      {hasActiveOrder && (
        <View className="mx-4 mb-4 p-4 bg-orange-50 border border-orange-200 rounded-xl">
          <View className="flex-row items-center">
            <Icon.AlertCircle size={20} color="#F59E0B" />
            <Text className="text-orange-800 font-semibold ml-2 flex-1">
              You have an active order. Complete it before placing a new one.
            </Text>
          </View>
        </View>
      )}
      <View className="flex-row items-center justify-between px-4 mb-4">
        <View>
          <Text className="text-2xl font-bold text-gray-800">
            {category ? category : 'All Restaurants'}
          </Text>
          <Text className="text-gray-500 mt-1">
            {filteredRestaurants.length} restaurant{filteredRestaurants.length !== 1 ? 's' : ''} found
          </Text>
        </View>
        {category && (
          <View className="bg-blue-100 px-3 py-1 rounded-full">
            <Text className="text-blue-600 text-sm font-medium">{category}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );

  return (
    <View className="flex-1">
      {filteredRestaurants.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={filteredRestaurants}
          keyExtractor={(item) => item?.restaurant_id?.toString() || Math.random().toString()}
          renderItem={renderRestaurantCard}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 24
          }}
          scrollEnabled={false} // Let parent ScrollView handle scrolling
          nestedScrollEnabled={true}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={<View className="pb-8" />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
