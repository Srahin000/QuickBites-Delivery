import React, { useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import Carousel from 'react-native-reanimated-carousel';
import { Dimensions } from 'react-native';
import { supabase } from '../supabaseClient';

const { width } = Dimensions.get('window');

export default function DealsCarousel() {
  const [deals, setDeals] = useState([]);

  useEffect(() => {
    const fetchDeals = async () => {
      const { data, error } = await supabase
        .from('carousel_images')
        .select('id, image_url, title, description');

      if (!error) {
        setDeals(data);
      } else {
        console.error('Error fetching carousel data:', error);
      }
    };

    fetchDeals();
  }, []);

  return (
    <View className="mt-2 mb-2">
      <Carousel
        width={width}
        height={228}
        autoPlay
        autoPlayInterval={3500}
        loop
        data={deals}
        scrollAnimationDuration={900}
        renderItem={({ item }) => (
          <View className="rounded-xl mx-3 bg-white shadow-sm overflow-hidden">
            <Image
              source={{ uri: item.image_url }}
              className="w-full h-64 rounded-xl"
              resizeMode="cover"
            />
            <View className="absolute bottom-0 left-0 right-0 bg-black/30 px-3 py-2">
              <Text className="text-white font-bold text-base">{item.title}</Text>
              {item.description ? (
                <Text className="text-white text-xs">{item.description}</Text>
              ) : null}
            </View>
          </View>
        )}
        panGestureHandlerProps={{ activeOffsetX: [-10, 10] }}
      />
    </View>
  );
}
