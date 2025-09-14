import React, { useEffect, useState } from 'react';
import { View, Text, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { supabase } from '../supabaseClient';

export default function StripeKeyTest() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [testResults, setTestResults] = useState(null);

  const testStripeKeys = async () => {
    try {
      console.log('=== STRIPE KEY TEST ===');
      
      // Test 1: Check app's publishable key
      const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || "pk_test_51RHTSqQ3eI5H05vXLwaPJ5PsIsD1GzD70ndc56Je13Q6woGwPcx85kiermBUfk1MPE533M7UkIiNSeiQtrSzKmVS00vSEyfrV8";
      console.log('App Publishable Key:', publishableKey.substring(0, 20) + '...');
      console.log('Is Test Key:', publishableKey.startsWith('pk_test_'));
      console.log('Is Live Key:', publishableKey.startsWith('pk_live_'));
      
      // Test 2: Get session and test payment intent creation
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        Alert.alert('Error', 'Please sign in first');
        return;
      }
      
      console.log('User ID:', session.user.id);
      
      // Test 3: Create a test payment intent
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL || 'https://pgouwzuufnnhthwrewrv.functions.supabase.co'}/create-payment-intent`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          cartItems: [], 
          restaurant: { name: 'Test Restaurant' }, 
          total: 1.00, 
          orderCode: 'KEYTEST123' 
        }),
      });

      const data = await response.json();
      console.log('Payment Intent Response:', data);
      
      if (data.error) {
        setTestResults({
          success: false,
          error: data.error,
          message: data.message
        });
        Alert.alert('Test Failed', `Error: ${data.error}\nMessage: ${data.message}`);
        return;
      }
      
      // Test 4: Try to initialize payment sheet
      const { paymentIntentClientSecret } = data;
      console.log('Client Secret:', paymentIntentClientSecret?.substring(0, 20) + '...');
      
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret,
        merchantDisplayName: 'QuickBites Test',
        returnURL: 'quickbites://stripe-redirect',
      });
      
      if (initError) {
        console.error('Init Error:', initError);
        setTestResults({
          success: false,
          error: 'Init Failed',
          message: initError.message,
          code: initError.code
        });
        Alert.alert('Init Failed', `Error: ${initError.message}\nCode: ${initError.code}`);
        return;
      }
      
      console.log('Payment sheet initialized successfully!');
      setTestResults({
        success: true,
        message: 'Keys match! Payment sheet initialized successfully.'
      });
      Alert.alert('Success!', 'Stripe keys match! Payment sheet initialized successfully.');
      
    } catch (error) {
      console.error('Test Error:', error);
      setTestResults({
        success: false,
        error: 'Test Failed',
        message: error.message
      });
      Alert.alert('Test Error', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stripe Key Test</Text>
      <Text style={styles.subtitle}>Test if your Stripe keys match</Text>
      
      <TouchableOpacity style={styles.button} onPress={testStripeKeys}>
        <Text style={styles.buttonText}>Run Test</Text>
      </TouchableOpacity>
      
      {testResults && (
        <View style={[styles.result, { backgroundColor: testResults.success ? '#d4edda' : '#f8d7da' }]}>
          <Text style={styles.resultTitle}>
            {testResults.success ? '✅ Success' : '❌ Failed'}
          </Text>
          <Text style={styles.resultText}>{testResults.message}</Text>
          {testResults.error && (
            <Text style={styles.errorText}>Error: {testResults.error}</Text>
          )}
          {testResults.code && (
            <Text style={styles.errorText}>Code: {testResults.code}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007bff',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  result: {
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    width: '100%',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  resultText: {
    fontSize: 14,
    marginBottom: 5,
  },
  errorText: {
    fontSize: 12,
    color: '#721c24',
    marginTop: 5,
  },
});
