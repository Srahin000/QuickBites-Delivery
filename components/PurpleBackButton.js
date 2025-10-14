import React from 'react';
import { TouchableOpacity } from 'react-native';
import * as Icon from 'react-native-feather';
import { themeColors } from '../theme';

export default function PurpleBackButton({ onPress, style = {} }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: themeColors.purple,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 2,
        },
        style
      ]}
      activeOpacity={0.8}
    >
      <Icon.ArrowLeft strokeWidth={3} stroke="white" size={20} />
    </TouchableOpacity>
  );
}

