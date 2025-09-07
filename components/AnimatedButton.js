import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import * as Icon from "react-native-feather";

const AnimatedButton = ({
  onPress,
  title,
  icon,
  iconPosition = 'left',
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  children,
  ...props
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
    opacity.value = withTiming(0.8, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    opacity.value = withTiming(1, { duration: 100 });
  };

  const handlePress = () => {
    if (!disabled && !loading) {
      // Add a subtle bounce effect
      scale.value = withSequence(
        withSpring(0.9, { damping: 10, stiffness: 400 }),
        withSpring(1, { damping: 15, stiffness: 300 })
      );
      onPress?.();
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return 'bg-gray-200 border border-gray-300';
      case 'outline':
        return 'bg-transparent border-2 border-blue-500';
      case 'danger':
        return 'bg-gradient-to-r from-red-500 to-red-600';
      case 'success':
        return 'bg-gradient-to-r from-green-500 to-green-600';
      case 'warning':
        return 'bg-gradient-to-r from-yellow-500 to-orange-500';
      case 'ghost':
        return 'bg-transparent';
      default:
        return 'bg-gradient-to-r from-blue-500 to-purple-600';
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'outline':
        return 'text-blue-500';
      case 'ghost':
        return 'text-gray-700';
      case 'secondary':
        return 'text-gray-800';
      default:
        return 'text-white';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return 'px-4 py-2 rounded-lg';
      case 'large':
        return 'px-8 py-5 rounded-2xl';
      default:
        return 'px-6 py-4 rounded-xl';
    }
  };

  const getTextSize = () => {
    switch (size) {
      case 'small':
        return 'text-sm';
      case 'large':
        return 'text-xl';
      default:
        return 'text-lg';
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 16;
      case 'large':
        return 24;
      default:
        return 20;
    }
  };

  const renderIcon = () => {
    if (!icon) return null;
    
    const IconComponent = icon;
    const iconSize = getIconSize();
    
    return (
      <IconComponent 
        className={`w-${iconSize/4} h-${iconSize/4}`} 
        stroke={variant === 'outline' ? '#3B82F6' : 'white'} 
      />
    );
  };

  const renderContent = () => {
    if (children) return children;

    return (
      <View className="flex-row items-center justify-center">
        {icon && iconPosition === 'left' && (
          <View className="mr-2">
            {renderIcon()}
          </View>
        )}
        
        {loading ? (
          <View className="flex-row items-center">
            <Animated.View 
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                borderWidth: 2,
                borderColor: 'transparent',
                borderTopColor: variant === 'outline' ? '#3B82F6' : 'white',
              }}
            />
            <Text className={`${getTextColor()} ${getTextSize()} font-semibold ml-2`}>
              Loading...
            </Text>
          </View>
        ) : (
          <Text className={`${getTextColor()} ${getTextSize()} font-semibold`}>
            {title}
          </Text>
        )}
        
        {icon && iconPosition === 'right' && (
          <View className="ml-2">
            {renderIcon()}
          </View>
        )}
      </View>
    );
  };

  return (
    <Animated.View style={[animatedStyle, style]}>
      <TouchableOpacity
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled || loading}
        className={`
          ${getVariantStyles()}
          ${getSizeStyles()}
          shadow-lg
          ${disabled || loading ? 'opacity-50' : ''}
        `}
        style={{ elevation: 3 }}
        activeOpacity={0.8}
        {...props}
      >
        {renderContent()}
      </TouchableOpacity>
    </Animated.View>
  );
};

export default AnimatedButton; 