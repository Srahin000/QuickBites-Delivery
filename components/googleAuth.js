import { supabase } from "../supabaseClient"
import * as WebBrowser from 'expo-web-browser';

// Complete the auth session
WebBrowser.maybeCompleteAuthSession();

export const signInWithGoogle = async () => {
  try {
    console.log('🔍 Starting Google OAuth...');
    
    // Step 1: Get the OAuth URL from Supabase
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://pgouwzuufnnhthwrewrv.supabase.co/auth/v1/callback'
      }
    });

    if (error) {
      console.error('❌ Supabase OAuth Error:', error);
      throw error;
    }
    
    if (!data.url) {
      console.error('❌ No OAuth URL returned from Supabase');
      throw new Error('No OAuth URL returned from Supabase');
    }

    console.log('✅ OAuth URL received:', data.url);

    // Step 2: Open the URL in the browser
    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      'https://pgouwzuufnnhthwrewrv.supabase.co/auth/v1/callback'
    );

    console.log('🔍 OAuth Result:', result);

    // Step 3: Handle the result
    if (result.type === 'success') {
      console.log('✅ OAuth successful, checking session...');
      console.log('🔍 OAuth result URL:', result.url);
      
      // Extract the URL parameters from the OAuth result
      const url = new URL(result.url);
      const accessToken = url.searchParams.get('access_token');
      const refreshToken = url.searchParams.get('refresh_token');
      const error = url.searchParams.get('error');
      
      if (error) {
        console.error('❌ OAuth Error in URL:', error);
        throw new Error(`OAuth error: ${error}`);
      }
      
      if (accessToken) {
        console.log('✅ Access token found, setting session...');
        
        // Set the session manually using the access token
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        });
        
        if (sessionError) {
          console.error('❌ Session Error:', sessionError);
          throw sessionError;
        }
        
        if (sessionData.session) {
          console.log('✅ Session established:', sessionData.session.user.email);
          return { data: sessionData.session, error: null };
        } else {
          console.error('❌ No session created from tokens');
          throw new Error('No session created from OAuth tokens');
        }
      } else {
        // Fallback: wait and check for session
        console.log('⚠️ No access token in URL, waiting for session...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('❌ Session Error:', sessionError);
          throw sessionError;
        }
        
        if (sessionData.session) {
          console.log('✅ Session found after waiting:', sessionData.session.user.email);
          return { data: sessionData.session, error: null };
        } else {
          console.error('❌ No session found after OAuth');
          throw new Error('No session found after OAuth');
        }
      }
    } else if (result.type === 'cancel') {
      console.log('❌ OAuth cancelled by user');
      return { data: null, error: { message: 'User cancelled Google sign in' } };
    } else {
      console.error('❌ OAuth failed:', result);
      return { data: null, error: { message: 'OAuth authentication failed' } };
    }
  } catch (error) {
    console.error('❌ Google OAuth Error:', error);
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