import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../supabaseClient';

export default function AuthSuccessScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { access_token, refresh_token } = route.params || {};

  useEffect(() => {
    const handleAuthSuccess = async () => {
      try {
        console.log('🔍 Auth Success - Processing tokens...');
        
        if (access_token) {
          // Set the session using the tokens from the OAuth callback
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: access_token,
            refresh_token: refresh_token || ''
          });
          
          if (sessionError) {
            console.error('❌ Session Error:', sessionError);
            navigation.navigate('AuthError', { error: sessionError.message });
            return;
          }
          
          if (sessionData.session) {
            console.log('✅ Session established:', sessionData.session.user.email);
            // Navigate to main app
            navigation.reset({
              index: 0,
              routes: [{ name: 'MainTabs' }],
            });
          } else {
            console.error('❌ No session created from tokens');
            navigation.navigate('AuthError', { error: 'No session created from OAuth tokens' });
          }
        } else {
          console.error('❌ No access token in auth success');
          navigation.navigate('AuthError', { error: 'No access token received' });
        }
      } catch (error) {
        console.error('❌ Auth Success Error:', error);
        navigation.navigate('AuthError', { error: error.message });
      }
    };

    handleAuthSuccess();
  }, [access_token, refresh_token, navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Signing you in...</Text>
      <ActivityIndicator size="large" color="#502efa" style={styles.spinner} />
      <Text style={styles.subtitle}>Please wait while we complete your authentication.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#502efa',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  spinner: {
    marginVertical: 20,
  },
});
