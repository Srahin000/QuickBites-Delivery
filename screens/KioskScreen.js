import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../supabaseClient';
import { themeColors } from '../theme';

export default function KioskScreen() {
  const navigation = useNavigation();
  const [username, setUsername] = useState('Student');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fetchLatestUser = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('first_name') // 🟢 Make sure this matches your schema
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setUsername(data[0].first_name); // 🟢 use correct field
      }
    };

    fetchLatestUser();

    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    // Navigate after 6 seconds
    const timeout = setTimeout(() => {
      navigation.navigate('Signup');
    }, 6000);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <View className="flex-1 items-center justify-center" style={{ backgroundColor: themeColors.purple }}>
      <Animated.Text
        className="text-white text-3xl font-bold text-center px-4"
        style={{ opacity: fadeAnim }}
      >
        🎉 Welcome to Quickbites, {username}!
      </Animated.Text>
    </View>
  );
}
