import { supabase } from "../supabaseClient"
import * as WebBrowser from 'expo-web-browser';

// Complete the auth session
WebBrowser.maybeCompleteAuthSession();

export const signInWithGoogle = async () => {
  try {
    // Step 1: Get the OAuth URL from Supabase
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://quickbites-delta.vercel.app/auth/callback'
      }
    });

    if (error) throw error;
    if (!data.url) throw new Error('No OAuth URL returned from Supabase');

    // Step 2: Open the URL in the browser
    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      'https://quickbites-delta.vercel.app/auth/callback'
    );

    // Step 3: After redirect, get the session
    if (result.type === 'success') {
      const { data: sessionData } = await supabase.auth.getSession();
      return { data: sessionData, error: null };
    } else {
      return { data: null, error: { message: 'User cancelled Google sign in' } };
    }
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