import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { supabase } from '../supabaseClient';

export default function Categories({ activeCategory, setActiveCategory }) {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
      const { data, error } = await supabase.from('categories').select('*');
        
        if (error) {
          console.error('Categories fetch error:', error);
        } else {
          setCategories(data || []);
        }
      } catch (err) {
        console.error('Exception during categories fetch:', err);
      }
    };
    fetchCategories();
  }, []);

  return (
    <View className="m-4">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="overflow-visible"
        contentContainerStyle={{ paddingHorizontal: 15 }}
      >
        {categories.map((category, index) => {
          const isActive = category.name === activeCategory;
          const btnClass = isActive ? 'bg-primary' : 'bg-orange-100';
          const textClass = isActive ? 'font-semibold text-gray-800' : 'text-gray-500';
          
          return (
            <View key={index} className="flex justify-center items-center mr-6">
              <TouchableOpacity
                onPress={() =>
                  setActiveCategory(isActive ? null : category.name)
                }
                className={`p-1 rounded-full shadow ${btnClass}`}
              >
                {category.image_url ? (
                  <Image 
                    style={{ width: 45, height: 45 }} 
                    source={{ uri: category.image_url }} 
                  />
                ) : (
                  <View 
                    style={{ 
                      width: 45, 
                      height: 45, 
                      backgroundColor: '#f3f4f6',
                      borderRadius: 22.5,
                      justifyContent: 'center',
                      alignItems: 'center'
                    }}
                  >
                    <Text className="text-gray-500 text-xs font-medium">
                      {category.name.charAt(0)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <Text className={`text-sm ${textClass}`}>{category.name}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
