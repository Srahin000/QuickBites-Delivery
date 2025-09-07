import React from 'react';
import { View, Text, SafeAreaView } from 'react-native';
import { themeColors } from '../../theme';

export default function DelivererProfile() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.bgColor2 }}>
      <View style={{ backgroundColor: themeColors.bgColor2, padding: 20 }}>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold' }}>Profile</Text>
      </View>
      <View style={{ flex: 1, backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
        <Text style={{ color: themeColors.bgColor2, fontSize: 18 }}>Deliverer profile and settings will appear here.</Text>
      </View>
    </SafeAreaView>
  );
} 