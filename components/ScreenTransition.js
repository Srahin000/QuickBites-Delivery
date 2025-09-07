import React from 'react';
import { View } from 'react-native';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeInUp, 
  SlideInRight,
  SlideInLeft,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';

const ScreenTransition = ({ 
  children, 
  type = 'fade', 
  delay = 0, 
  duration = 300,
  direction = 'up',
  style 
}) => {
  const getTransitionProps = () => {
    switch (type) {
      case 'fade':
        return {
          entering: FadeIn.delay(delay).duration(duration),
          style
        };
      case 'slide':
        const slideDirection = direction === 'left' ? SlideInLeft : SlideInRight;
        return {
          entering: slideDirection.delay(delay).duration(duration).springify(),
          style
        };
      case 'slideUp':
        return {
          entering: FadeInUp.delay(delay).duration(duration).springify(),
          style
        };
      case 'slideDown':
        return {
          entering: FadeInDown.delay(delay).duration(duration).springify(),
          style
        };
      case 'bounce':
        return {
          entering: FadeInUp.delay(delay).springify(),
          style
        };
      default:
        return {
          entering: FadeIn.delay(delay).duration(duration),
          style
        };
    }
  };

  const transitionProps = getTransitionProps();

  return (
    <Animated.View {...transitionProps}>
      {children}
    </Animated.View>
  );
};

export default ScreenTransition; 