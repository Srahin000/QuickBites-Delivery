import { View, Text, TextInput, TouchableOpacity, Image } from 'react-native';
import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Dropdown } from 'react-native-element-dropdown';
import AntDesign from '@expo/vector-icons/AntDesign';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../supabaseClient';
import mime from 'react-native-mime-types';

export default function AddRestaurant({ onAddRestaurant }) {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
  const fetchCategories = async () => {
    const { data, error } = await supabase.from('categories').select('*');
    if (error) {
      console.error('Error fetching categories:', error);
    } else {
      setCategories(data.map(cat => ({
        label: cat.name, 
        value: cat.id.toString()
      })));
    }
  };

  fetchCategories();
}, []);


  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');
  const [restaurantDescription, setRestaurantDescription] = useState('');
  const [restaurantImage, setRestaurantImage] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const pickImage = async () => {
    let { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled) {
      setRestaurantImage(result.assets[0].uri);
    }
  };

  const uploadImageToSupabase = async (localUri) => {
    if (!localUri) return null;

    try {
      const filename = localUri.split('/').pop();
      const fileExt = filename.split('.').pop();
      const contentType = mime.lookup(fileExt) || 'image/jpeg';

      const response = await fetch(localUri);
      const blob = await response.blob();

      const { data, error } = await supabase.storage
        .from('restaurant-images') // Bucket name
        .upload(`restaurants/${Date.now()}-${filename}`, blob, {
          contentType,
          upsert: true,
        });

      if (error) {
        console.error('Error uploading file:', error);
        return null;
      }

      const { data: publicUrlData } = supabase.storage
        .from('restaurant-images')
        .getPublicUrl(data.path);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Upload failed:', error);
      return null;
    }
  };

  const handleAddRestaurant = async () => {
    if (!restaurantName || !restaurantAddress || !selectedCategory || !restaurantImage) {
      alert("Please fill in all fields and upload an image.");
      return;
    }

    try {
      setIsUploading(true);
      const publicImageUrl = await uploadImageToSupabase(restaurantImage);
      setIsUploading(false);

      if (!publicImageUrl) {
        alert("Image upload failed.");
        return;
      }

      const newRestaurant = {
        name: restaurantName,
        address: restaurantAddress,
        category: selectedCategory.label,
        description: restaurantDescription,
        image_url: publicImageUrl,
        reviews: 0,
        ratings: 0,
      };

      const { error: insertError } = await supabase
        .from('restaurants')
        .insert([newRestaurant]);

      if (insertError) {
        console.error("Error inserting restaurant:", insertError);
      } else if (onAddRestaurant) {
        onAddRestaurant(newRestaurant);
      }

      // Reset form
      setRestaurantName('');
      setRestaurantAddress('');
      setRestaurantDescription('');
      setRestaurantImage(null);
      setSelectedCategory(null);

    } catch (error) {
      console.error("Error adding restaurant:", error);
    }
  };

  return (
    <SafeAreaView className="bg-white">
      <View className="bg-white p-4">
        <Text className="text-xl font-bold mb-4">Add a Restaurant</Text>

        <TextInput
          placeholder="Restaurant Name"
          value={restaurantName}
          onChangeText={setRestaurantName}
          autoCapitalize="words"
          className="border border-gray-300 rounded-lg p-3 mb-4"
        />

        <TextInput
          placeholder="Address"
          value={restaurantAddress}
          onChangeText={setRestaurantAddress}
          autoCapitalize="words"
          className="border border-gray-300 rounded-lg p-3 mb-4"
        />

        <TextInput
          placeholder="Description"
          value={restaurantDescription}
          onChangeText={setRestaurantDescription}
          autoCapitalize="words"
          className="border border-gray-300 rounded-lg p-3 mb-4"
        />

        <TouchableOpacity onPress={pickImage} className="border border-gray-300 rounded-lg p-3 mb-4 bg-gray-100">
          <Text className="text-center">Upload Restaurant Image</Text>
        </TouchableOpacity>

        {restaurantImage && (
          <Image
            source={{ uri: restaurantImage }}
            className="w-24 h-24 rounded-lg mx-auto mb-4"
          />
        )}

        {isUploading && (
          <Text className="text-center text-gray-500">Uploading image...</Text>
        )}

        <Dropdown
          className="bg-gray-200 rounded-lg p-3 mb-4"
          data={categories}
          search
          maxHeight={300}
          labelField="label"
          valueField="value"
          placeholder="Select Category"
          searchPlaceholder="Search..."
          value={selectedCategory}
          onChange={item => setSelectedCategory(item)}
          renderLeftIcon={() => (
            <AntDesign className="pl-2" color="black" name="Safety" size={20} />
          )}
        />


        <TouchableOpacity className="bg-primary mt-7 p-3 rounded-lg" onPress={handleAddRestaurant} disabled={isUploading}>
          <Text className="text-center text-white">Add Restaurant</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
