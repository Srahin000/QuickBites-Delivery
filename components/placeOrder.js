import { useStripe } from '@stripe/stripe-react-native';
import { Alert } from 'react-native';

export default async function placeOrder({ cartItems, restaurant, total, orderCode, navigation, clearCart }) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  try {
    const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL || 'https://pgouwzuufnnhthwrewrv.functions.supabase.co'}/create-payment-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cartItems, restaurant, total, orderCode }),
    });

    const data = await response.json();
    console.log('Payment Intent backend response:', data);

    if (!response.ok) {
      Alert.alert('Error', data.message || 'Something went wrong.');
      return;
    }

    const { paymentIntentClientSecret } = data;

    // 1. Initialize Payment Sheet
    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret,
      merchantDisplayName: 'QuickBites',
      returnURL: 'quickbites://stripe-redirect',
    });

    if (initError) {
      console.error('Payment Sheet init error:', initError);
      Alert.alert('Error initializing payment', initError.message);
      return;
    }

    // 2. Present Payment Sheet
    const { error: presentError } = await presentPaymentSheet();

    if (presentError) {
      console.error('Payment Sheet present error:', presentError);
      Alert.alert('Payment Failed', presentError.message);
    } else {
      Alert.alert('Success', 'Your payment was successful!');
      clearCart();
      navigation.navigate('OrderPreparing', { restaurant, orderCode });
    }
  } catch (error) {
    console.error('Stripe Payment Sheet error:', error);
    Alert.alert('Network error', error.message);
  }
}
