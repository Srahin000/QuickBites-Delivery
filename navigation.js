import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from './context/SessionContext-v2';
import { supabase } from './supabaseClient';
import { navigationRef } from './utils/navigationRef';
import { themeColors } from './theme';

// Screens
import FooterPanel from './components/footerPanel';
import SignupScreen from './screens/SignupScreen';
import SigninScreen from './screens/SigninScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';
import AdminDashboardScreen from './screens/AdminScreens/AdminDashboardScreen';
import AddRestaurantsScreen from './screens/AdminScreens/AddRestaurantsScreen';
import EditRestaurantsScreen from './screens/AdminScreens/EditRestaurantsScreen';
import ManageEmployees from './screens/AdminScreens/ManageEmployees';
import ViewOrders from './screens/AdminScreens/ViewOrders';
import ManageCustomers from './screens/AdminScreens/ManageCustomers';
import FinancialPulseScreen from './screens/AdminScreens/FinancialPulseScreen';
import ManageClubs from './screens/AdminScreens/ManageClubs';
import AnnouncementsScreen from './screens/AdminScreens/AnnouncementsScreen';
import RiderSchedulerScreen from './screens/AdminScreens/RiderSchedulerScreen';
import OrderPreparingScreen from './screens/OrderPreparingScreen';
import DeliveryScreen from './screens/DeliveryScreen';
import RestaurantScreen from './screens/RestaurantScreen';
import CartScreen from './screens/CartScreen';
import OrderDetails from './screens/OrderDetails';
import OrderHistoryScreen from './screens/OrderHistoryScreen';
import OrderHistoryDetails from './screens/OrderHistoryDetails';
import GameScreen from './screens/GameScreen';
import DelivererDashboard from './screens/DelivererScreens/DelivererDashboard';
import DelivererChat from './screens/DelivererScreens/DelivererChat';
import ProfileScreen from './screens/ProfileScreen';
import AuthSuccessScreen from './screens/AuthSuccessScreen';
import AuthErrorScreen from './screens/AuthErrorScreen';

const Stack = createNativeStackNavigator();

const linking = {
  prefixes: [
    'quickbites://',
    'com.srahin000.quickbites://',
    'https://quick-bites-delivery-flax.vercel.app'
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
      ForgotPassword: 'forgot-password',
      ResetPassword: 'reset-password',
      AuthSuccess: 'auth/success',
      AuthError: 'auth/error',
      AdminDashboard: 'admin',
      OrderPreparing: 'success',
      Cancel: 'cancel',
    },
  },
};

export default function Navigation() {
  const { session, loading } = useSession();

  const [role, setRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);

  useEffect(() => {
    const fetchRole = async () => {
      if (session?.user?.id) {
        setRoleLoading(true);
        try {
          const { data, error } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();
          
          if (error) {
            console.error('Error fetching role:', error);
            setRole(null);
          } else {
            setRole(data?.role || null);
          }
        } catch (err) {
          console.error('Error in fetchRole:', err);
          setRole(null);
        } finally {
          setRoleLoading(false);
        }
      } else {
        setRole(null);
        setRoleLoading(false);
      }
    };
    
    fetchRole();
  }, [session?.user?.id]);

  if (loading || (session && roleLoading)) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color={themeColors.purple} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <>
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="Signin" component={SigninScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
            <Stack.Screen name="AuthSuccess" component={AuthSuccessScreen} />
            <Stack.Screen name="AuthError" component={AuthErrorScreen} />
          </>
        ) : role === 'admin' ? (
          <>
            <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
            <Stack.Screen name="AddRestaurant" component={AddRestaurantsScreen} />
            <Stack.Screen name="EditRestaurant" component={EditRestaurantsScreen} />
            <Stack.Screen name="ViewOrders" component={ViewOrders} />
            <Stack.Screen name="ManageCustomers" component={ManageCustomers} />
            <Stack.Screen name="ManageEmployees" component={ManageEmployees} />
            <Stack.Screen name="ManageClubs" component={ManageClubs} />
            <Stack.Screen name="FinancialPulse" component={FinancialPulseScreen} />
            <Stack.Screen name="Announcements" component={AnnouncementsScreen} />
            <Stack.Screen name="RiderScheduler" component={RiderSchedulerScreen} />
            <Stack.Screen name="Restaurant" component={RestaurantScreen} />
            <Stack.Screen name="Cart" options={{ presentation: 'modal' }} component={CartScreen} />
            <Stack.Screen name="OrderDetails" options={{ presentation: 'modal' }} component={OrderDetails} />
            <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
            <Stack.Screen name="OrderHistoryDetails" options={{ presentation: 'modal' }} component={OrderHistoryDetails} />
            <Stack.Screen name="GameScreen" component={GameScreen} />
            <Stack.Screen name="OrderPreparing" options={{ presentation: 'fullScreenModal' }} component={OrderPreparingScreen} />
            <Stack.Screen name="Delivery" options={{ presentation: 'fullScreenModal' }} component={DeliveryScreen} />
            <Stack.Screen name="DelivererChat" component={DelivererChat} />
            <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        ) : role === 'deliverer' ? (
          <>
            <Stack.Screen name="DelivererDashboard" component={DelivererDashboard} />
            <Stack.Screen name="Restaurant" component={RestaurantScreen} />
            <Stack.Screen name="Cart" options={{ presentation: 'modal' }} component={CartScreen} />
            <Stack.Screen name="OrderDetails" options={{ presentation: 'modal' }} component={OrderDetails} />
            <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
            <Stack.Screen name="OrderHistoryDetails" options={{ presentation: 'modal' }} component={OrderHistoryDetails} />
            <Stack.Screen name="GameScreen" component={GameScreen} />
            <Stack.Screen name="OrderPreparing" options={{ presentation: 'fullScreenModal' }} component={OrderPreparingScreen} />
            <Stack.Screen name="Delivery" options={{ presentation: 'fullScreenModal' }} component={DeliveryScreen} />
            <Stack.Screen name="DelivererChat" component={DelivererChat} />
            <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
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
            <Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
            <Stack.Screen name="OrderHistoryDetails" options={{ presentation: 'modal' }} component={OrderHistoryDetails} />
            <Stack.Screen name="GameScreen" component={GameScreen} />
            <Stack.Screen name="OrderPreparing" options={{ presentation: 'fullScreenModal' }} component={OrderPreparingScreen} />
            <Stack.Screen name="Delivery" options={{ presentation: 'fullScreenModal' }} component={DeliveryScreen} />
            <Stack.Screen name="DelivererChat" component={DelivererChat} />
            <Stack.Screen name="ProfileScreen" component={ProfileScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="Signin" component={SigninScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
