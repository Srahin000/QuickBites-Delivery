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

export default function RestaurantList({ category, searchQuery }) {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRestaurants = async () => {
      setLoading(true);
      let query = supabase.from('restaurants').select('*, dishes(*)');
      if (category) query = query.eq('category', category);
      
      const { data, error } = await query;
      if (!error) setRestaurants(data);
      setLoading(false);
    };
    fetchRestaurants();
  }, [category]);

  const filteredRestaurants = restaurants.filter(restaurant =>
    restaurant.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
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
          keyExtractor={(item) => item.id.toString()}
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
