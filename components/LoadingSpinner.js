import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import * as Icon from "react-native-feather";

const LoadingSpinner = ({ 
  type = 'default', 
  message = 'Loading...', 
  size = 'medium',
  color = '#3B82F6',
  showIcon = true 
}) => {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.5);

  React.useEffect(() => {
    // Rotation animation
    rotation.value = withRepeat(
      withTiming(360, { duration: 2000 }),
      -1,
      false
    );

    // Pulse animation
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );

    // Fade animation
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.5, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value }
    ],
    opacity: opacity.value,
  }));

  const getSize = () => {
    switch (size) {
      case 'small': return 20;
      case 'large': return 40;
      default: return 30;
    }
  };

  const getContainerSize = () => {
    switch (size) {
      case 'small': return 40;
      case 'large': return 80;
      default: return 60;
    }
  };

  const renderLoadingContent = () => {
    switch (type) {
      case 'food':
        return (
          <Animated.View entering={FadeInDown.delay(200)} className="items-center">
            <Animated.View style={animatedStyle} className="mb-4">
              <View 
                className="rounded-full items-center justify-center"
                style={{ 
                  width: getContainerSize(), 
                  height: getContainerSize(),
                  backgroundColor: color + '20'
                }}
              >
                <Icon.Coffee className="w-6 h-6" stroke={color} />
              </View>
            </Animated.View>
            <Text className="text-lg font-semibold text-gray-700">{message}</Text>
          </Animated.View>
        );

      case 'dots':
        return (
          <Animated.View entering={FadeInUp.delay(200)} className="items-center">
            <View className="flex-row space-x-2 mb-4">
              {[0, 1, 2].map((index) => (
                <Animated.View
                  key={index}
                  entering={FadeIn.delay(index * 200)}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: color,
                  }}
                />
              ))}
            </View>
            <Text className="text-lg font-semibold text-gray-700">{message}</Text>
          </Animated.View>
        );

      case 'spinner':
        return (
          <Animated.View entering={FadeIn.delay(200)} className="items-center">
            <Animated.View style={animatedStyle} className="mb-4">
              <ActivityIndicator size={getSize()} color={color} />
            </Animated.View>
            <Text className="text-lg font-semibold text-gray-700">{message}</Text>
          </Animated.View>
        );

      case 'skeleton':
        return (
          <Animated.View entering={FadeIn.delay(200)} className="items-center">
            <View className="space-y-3 mb-4">
              <View 
                className="rounded-lg"
                style={{ 
                  width: getContainerSize(), 
                  height: getContainerSize() / 2,
                  backgroundColor: color + '20'
                }}
              />
              <View 
                className="rounded-lg"
                style={{ 
                  width: getContainerSize() * 0.8, 
                  height: getContainerSize() / 4,
                  backgroundColor: color + '15'
                }}
              />
            </View>
            <Text className="text-lg font-semibold text-gray-700">{message}</Text>
          </Animated.View>
        );

      default:
        return (
          <Animated.View entering={FadeIn.delay(200)} className="items-center">
            <Animated.View style={animatedStyle} className="mb-4">
              <View 
                className="rounded-full items-center justify-center"
                style={{ 
                  width: getContainerSize(), 
                  height: getContainerSize(),
                  backgroundColor: color + '20'
                }}
              >
                {showIcon ? (
                  <ActivityIndicator size={getSize()} color={color} />
                ) : (
                  <View 
                    className="rounded-full border-2 border-t-transparent"
                    style={{ 
                      width: getSize(), 
                      height: getSize(),
                      borderColor: color
                    }}
                  />
                )}
              </View>
            </Animated.View>
            <Text className="text-lg font-semibold text-gray-700">{message}</Text>
          </Animated.View>
        );
    }
  };

  return (
    <View className="flex-1 justify-center items-center bg-gradient-to-b from-blue-50 to-white">
      {renderLoadingContent()}
    </View>
  );
};

export default LoadingSpinner; 