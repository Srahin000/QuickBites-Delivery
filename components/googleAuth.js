import { supabase } from '../supabaseClient';
import * as WebBrowser from 'expo-web-browser';

// Complete the auth session
WebBrowser.maybeCompleteAuthSession();

export const signInWithGoogle = async () => {
  try {
    // Step 1: Get the OAuth URL from Supabase
    const { error, provider, url } = await supabase.auth.signIn({
      provider: 'google',
    });

    if (error) throw error;
    if (!url) throw new Error('No OAuth URL returned from Supabase');

    // Step 2: Open the URL in the browser
    const result = await WebBrowser.openAuthSessionAsync(
      url,
      'com.googleusercontent.apps.202497981968-3vvbdhdrgadicq2cnotm7kt826q0uhfa://'
    );

    // Step 3: After redirect, Supabase will handle the session automatically
    // You can check supabase.auth.session() for the new session

    return { data: result, error: null };
  } catch (error) {
    return { data: null, error: { ...error, userMessage: error.message } };
  }
};

export const signOutFromGoogle = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return { error };
  }
};

// Helper function to check OAuth configuration
export const checkOAuthConfig = async () => {
  try {
    if (!supabase.auth) {
      return { isValid: false, error: { message: 'Supabase auth not available' } };
    }
    const session = supabase.auth.session();
    return { isValid: true, data: null };
  } catch (error) {
    return { isValid: false, error };
  }
};

// Diagnostic function to help troubleshoot OAuth issues
export const diagnoseOAuthIssues = async () => {
  const diagnostics = {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing',
    supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing',
    googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing',
    supabaseAuth: supabase.auth ? '✅ Available' : '❌ Not available',
    currentSession: supabase.auth?.session() ? '✅ Has session' : '❌ No session',
  };
  
  console.log('OAuth Diagnostics:', diagnostics);
  return diagnostics;
}; 