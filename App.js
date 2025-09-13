import { StatusBar } from 'expo-status-bar';
import { Text, View, TextInput, ScrollView } from 'react-native';
import Navigation from './navigation';
import { CartProvider } from './context/CartContext';
import { SessionProvider } from './context/SessionContext-v2';
import { StripeProvider } from '@stripe/stripe-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import './global.css';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
        <StripeProvider publishableKey="pk_test_51RHTSqQ3eI5H05vXLwaPJ5PsIsD1GzD70ndc56Je13Q6woGwPcx85kiermBUfk1MPE533M7UkIiNSeiQtrSzKmVS00vSEyfrV8">
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
