import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { checkOAuthConfig, signInWithGoogle, diagnoseOAuthIssues } from './googleAuth';
import { themeColors } from '../theme';

const OAuthTest = () => {
  const [loading, setLoading] = useState(false);

  const testOAuthConfig = async () => {
    setLoading(true);
    try {
      const result = await checkOAuthConfig();
      if (result.isValid) {
        Alert.alert('✅ Success', 'OAuth configuration is valid!');
      } else {
        Alert.alert('❌ Error', `OAuth configuration failed: ${result.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      Alert.alert('❌ Error', `Test failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { data, error } = await signInWithGoogle();
      if (error) {
        Alert.alert('❌ Sign-in Failed', error.userMessage || error.message);
      } else {
        Alert.alert('✅ Success', 'Google sign-in initiated successfully!');
      }
    } catch (error) {
      Alert.alert('❌ Error', `Sign-in test failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const diagnostics = await diagnoseOAuthIssues();
      const diagnosticText = Object.entries(diagnostics)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
      
      Alert.alert('🔍 OAuth Diagnostics', diagnosticText);
    } catch (error) {
      Alert.alert('❌ Error', `Diagnostics failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>OAuth Configuration Test</Text>
      
      <TouchableOpacity
        style={[styles.button, { backgroundColor: themeColors.purple }]}
        onPress={testOAuthConfig}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Testing...' : 'Test OAuth Config'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: themeColors.yellow }]}
        onPress={testGoogleSignIn}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Testing...' : 'Test Google Sign-in'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#007AFF' }]}
        onPress={runDiagnostics}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Running...' : '🔍 Run Diagnostics'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.info}>
        Use these buttons to test your OAuth configuration before using the main sign-in flow.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    margin: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  button: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  info: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
});

export default OAuthTest; 