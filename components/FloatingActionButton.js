import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import * as Icon from "react-native-feather";

const FloatingActionButton = ({
  onPress,
  icon,
  label,
  variant = 'primary',
  size = 'medium',
  position = 'bottom-right',
  pulse = false,
  style,
  ...props
}) => {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  React.useEffect(() => {
    if (pulse) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );
    }
  }, [pulse]);

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handlePress = () => {
    // Add rotation effect
    rotation.value = withSequence(
      withTiming(360, { duration: 300 }),
      withTiming(0, { duration: 0 })
    );
    onPress?.();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value * pulseScale.value },
      { rotate: `${rotation.value}deg` }
    ],
  }));

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return 'bg-gray-200 border border-gray-300';
      case 'success':
        return 'bg-gradient-to-r from-green-500 to-green-600';
      case 'warning':
        return 'bg-gradient-to-r from-yellow-500 to-orange-500';
      case 'danger':
        return 'bg-gradient-to-r from-red-500 to-red-600';
      case 'info':
        return 'bg-gradient-to-r from-blue-500 to-blue-600';
      default:
        return 'bg-gradient-to-r from-blue-500 to-purple-600';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { width: 48, height: 48, iconSize: 20 };
      case 'large':
        return { width: 72, height: 72, iconSize: 32 };
      default:
        return { width: 56, height: 56, iconSize: 24 };
    }
  };

  const getPositionStyles = () => {
    switch (position) {
      case 'bottom-left':
        return 'absolute bottom-5 left-5';
      case 'top-right':
        return 'absolute top-5 right-5';
      case 'top-left':
        return 'absolute top-5 left-5';
      case 'center':
        return 'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2';
      default:
        return 'absolute bottom-5 right-5';
    }
  };

  const sizeConfig = getSizeStyles();

  const renderIcon = () => {
    if (!icon) return null;
    
    const IconComponent = icon;
    return (
      <IconComponent 
        className={`w-${sizeConfig.iconSize/4} h-${sizeConfig.iconSize/4}`} 
        stroke="white" 
      />
    );
  };

  return (
    <Animated.View 
      style={[animatedStyle, style]}
      className={getPositionStyles()}
    >
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        className={`
          ${getVariantStyles()}
          rounded-full shadow-2xl items-center justify-center
        `}
        style={{
          width: sizeConfig.width,
          height: sizeConfig.height,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        }}
        activeOpacity={0.8}
        {...props}
      >
        {renderIcon()}
      </TouchableOpacity>
      
      {label && (
        <View className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
          <View className="bg-gray-800 px-2 py-1 rounded-lg">
            <Text className="text-white text-xs font-medium">{label}</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
};

export default FloatingActionButton; 