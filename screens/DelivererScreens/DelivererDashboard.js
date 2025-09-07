import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DelivererOrders from './DelivererOrders';
import DelivererMyDeliveries from './DelivererMyDeliveries';
import DelivererMap from './DelivererMap';
import DelivererProfile from './DelivererProfile';
import { themeColors } from '../../theme';

const Tab = createBottomTabNavigator();

export default function DelivererDashboard() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Available Orders') iconName = 'package-variant-closed';
          else if (route.name === 'My Deliveries') iconName = 'truck-delivery';
          else if (route.name === 'Map') iconName = 'map-marker-radius';
          else if (route.name === 'Profile') iconName = 'account-circle';
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopWidth: 0,
          elevation: 10,
        },
        tabBarActiveTintColor: themeColors.bgColor2,
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="My Deliveries" component={DelivererMyDeliveries} />
      <Tab.Screen name="Available Orders" component={DelivererOrders} />
      <Tab.Screen name="Map" component={DelivererMap} />
      <Tab.Screen name="Profile" component={DelivererProfile} />
    </Tab.Navigator>
  );
} 