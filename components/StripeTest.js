import React, { useEffect } from 'react';
import { View, Text, Alert } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';

export default function StripeTest() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  useEffect(() => {
    testStripeConfiguration();
  }, []);

  const testStripeConfiguration = async () => {
    try {
      console.log('Testing Stripe configuration...');
      console.log('Publishable key:', process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.substring(0, 20) + '...');
      
      // Test with a simple payment intent
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL || 'https://pgouwzuufnnhthwrewrv.functions.supabase.co'}/create-payment-intent`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer test-token` // This will fail but we can see the response
        },
        body: JSON.stringify({ 
          cartItems: [], 
          restaurant: { name: 'Test Restaurant' }, 
          total: 1.00, 
          orderCode: 'TEST123' 
        }),
      });

      const data = await response.json();
      console.log('Test response:', data);
      
      if (data.error) {
        Alert.alert('Stripe Test', `Error: ${data.error}`);
      } else {
        Alert.alert('Stripe Test', 'Configuration looks good!');
      }
    } catch (error) {
      console.error('Stripe test error:', error);
      Alert.alert('Stripe Test', `Error: ${error.message}`);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Testing Stripe Configuration...</Text>
    </View>
  );
}
