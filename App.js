import { StatusBar } from 'expo-status-bar';
import { Text, View, TextInput, ScrollView } from 'react-native';
import Navigation from './navigation';
import { CartProvider } from './context/CartContext';
import { SessionProvider } from './context/SessionContext-v2';
import { ChatProvider } from './context/ChatContext';
import { StripeProvider } from '@stripe/stripe-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import './global.css';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <ChatProvider>
            <StripeProvider 
              publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY}
              merchantIdentifier="merchant.com.qbdelivery.quickbitesdelivery"
              urlScheme="com.srahin000.quickbites"
            >
              <CartProvider>
                <StatusBar style="auto" />
                <Navigation />
              </CartProvider>
            </StripeProvider>
          </ChatProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
