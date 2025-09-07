import { StatusBar } from 'expo-status-bar';
import { Text, View, TextInput, ScrollView } from 'react-native';
import Navigation from './navigation';
import { CartProvider } from './context/CartContext';
import { SessionProvider } from './context/SessionContext';
import { StripeProvider } from '@stripe/stripe-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import './global.css';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
        <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY}>
          <CartProvider>
            <StatusBar style="auto" />
            <Navigation />
          </CartProvider>
        </StripeProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
