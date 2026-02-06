import { StatusBar } from 'expo-status-bar';
import { LogBox, Text, View, TextInput, ScrollView } from 'react-native';
import { useEffect, useRef } from 'react';

// Harmless native-module warning (expo-notifications / datetimepicker); app works fine
LogBox.ignoreLogs([
  'new NativeEventEmitter() was called with a non-null argument without the required `addListener` method',
  'new NativeEventEmitter() was called with a non-null argument without the required `removeListeners` method',
]);
import Navigation from './navigation';
import { CartProvider } from './context/CartContext';
import { SessionProvider, useSession } from './context/SessionContext-v2';
import { ChatProvider } from './context/ChatContext';
import { StripeProvider } from '@stripe/stripe-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import notificationService from './services/notificationService';
import { navigationRef } from './utils/navigationRef';

import './global.css';

// Inner component to access session context
function AppContent() {
  const { session } = useSession();

  useEffect(() => {
    // Register for push notifications when user logs in
    if (session?.user) {
      notificationService.registerForPushNotifications(session.user.id);
      const cleanup = notificationService.setupNotificationListeners(navigationRef);
      
      return () => {
        if (cleanup) cleanup();
      };
    }
  }, [session?.user?.id]);

  return (
    <>
      <StatusBar style="auto" />
      <Navigation />
    </>
  );
}

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
                <AppContent />
              </CartProvider>
            </StripeProvider>
          </ChatProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
