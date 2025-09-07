import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Linking from 'expo-linking';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from './context/SessionContext';
import { supabase } from './supabaseClient';

// Screens
import FooterPanel from './components/footerPanel';
import SignupScreen from './screens/SignupScreen';
import SigninScreen from './screens/SigninScreen';
import AdminDashboardScreen from './screens/AdminScreens/AdminDashboardScreen';
import AddRestaurantsScreen from './screens/AdminScreens/AddRestaurantsScreen';
import EditRestaurantsScreen from './screens/AdminScreens/EditRestaurantsScreen';
import ManageEmployees from './screens/AdminScreens/ManageEmployees';
import ViewOrders from './screens/AdminScreens/ViewOrders';
import ManageCustomers from './screens/AdminScreens/ManageCustomers';
import OrderPreparingScreen from './screens/OrderPreparingScreen';
import DeliveryScreen from './screens/DeliveryScreen';
import RestaurantScreen from './screens/RestaurantScreen';
import CartScreen from './screens/CartScreen';
import OrderDetails from './screens/OrderDetails';
import GameScreen from './screens/GameScreen';
import KioskScreen from './screens/KioskScreen';
import DelivererDashboard from './screens/DelivererScreens/DelivererDashboard';

const Stack = createStackNavigator();

const linking = {
  prefixes: [
    'quickbites://',
    'https://quickbites-q9h4.vercel.app'
  ],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Home: 'home',
          Orders: 'orders',
          Profile: 'profile',
          Kiosk: 'kiosk'
        }
      },
      Restaurant: 'restaurant/:id',
      Cart: 'cart',
      GameScreen: 'game',
      Signup: 'signup',
      Signin: 'signin',
      AdminDashboard: 'admin',
      OrderPreparing: 'success',
      Cancel: 'cancel',
    },
  },
};

export default function Navigation() {
  let session, loading;
  try {
    const sessionData = useSession();
    session = sessionData?.session || null;
    loading = sessionData?.loading || false;
  } catch (error) {
    console.error('Navigation: Error getting session:', error);
    session = null;
    loading = false;
  }

  const [role, setRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    const fetchRole = async () => {
      if (session?.user) {
        setRoleLoading(true);
        try {
          const { data, error } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single();
          if (error) {
            setRole(null);
          } else {
            setRole(data?.role || null);
          }
        } catch (err) {
          setRole(null);
        }
        setRoleLoading(false);
      } else {
        setRole(null);
      }
    };
    fetchRole();
  }, [session?.user?.id]);

  if (loading || (session && roleLoading)) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#00cc88" />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <>
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="Signin" component={SigninScreen} />
          </>
        ) : role === 'admin' ? (
          <>
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
            <Stack.Screen name="AddRestaurant" component={AddRestaurantsScreen} />
            <Stack.Screen name="EditRestaurant" component={EditRestaurantsScreen} />
            <Stack.Screen name="ViewOrders" component={ViewOrders} />
            <Stack.Screen name="ManageCustomers" component={ManageCustomers} />
            <Stack.Screen name="ManageEmployees" component={ManageEmployees} />
            <Stack.Screen name="Restaurant" component={RestaurantScreen} />
            <Stack.Screen name="Cart" options={{ presentation: 'modal' }} component={CartScreen} />
            <Stack.Screen name="OrderDetails" options={{ presentation: 'modal' }} component={OrderDetails} />
            <Stack.Screen name="GameScreen" component={GameScreen} />
            <Stack.Screen name="OrderPreparing" options={{ presentation: 'fullScreenModal' }} component={OrderPreparingScreen} />
            <Stack.Screen name="Delivery" options={{ presentation: 'fullScreenModal' }} component={DeliveryScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        ) : role === 'deliverer' ? (
          <>
            <Stack.Screen name="DelivererDashboard" component={DelivererDashboard} />
            <Stack.Screen name="Restaurant" component={RestaurantScreen} />
            <Stack.Screen name="Cart" options={{ presentation: 'modal' }} component={CartScreen} />
            <Stack.Screen name="OrderDetails" options={{ presentation: 'modal' }} component={OrderDetails} />
            <Stack.Screen name="GameScreen" component={GameScreen} />
            <Stack.Screen name="OrderPreparing" options={{ presentation: 'fullScreenModal' }} component={OrderPreparingScreen} />
            <Stack.Screen name="Delivery" options={{ presentation: 'fullScreenModal' }} component={DeliveryScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={FooterPanel} />
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
            <Stack.Screen name="DelivererDashboard" component={DelivererDashboard} />
            <Stack.Screen name="AddRestaurant" component={AddRestaurantsScreen} />
            <Stack.Screen name="EditRestaurant" component={EditRestaurantsScreen} />
            <Stack.Screen name="ViewOrders" component={ViewOrders} />
            <Stack.Screen name="ManageCustomers" component={ManageCustomers} />
            <Stack.Screen name="ManageEmployees" component={ManageEmployees} />
            <Stack.Screen name="Restaurant" component={RestaurantScreen} />
            <Stack.Screen name="Cart" options={{ presentation: 'modal' }} component={CartScreen} />
            <Stack.Screen name="OrderDetails" options={{ presentation: 'modal' }} component={OrderDetails} />
            <Stack.Screen name="GameScreen" component={GameScreen} />
            <Stack.Screen name="OrderPreparing" options={{ presentation: 'fullScreenModal' }} component={OrderPreparingScreen} />
            <Stack.Screen name="Delivery" options={{ presentation: 'fullScreenModal' }} component={DeliveryScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
