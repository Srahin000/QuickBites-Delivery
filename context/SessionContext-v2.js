import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState } from 'react-native';
import supabase from "../supabaseClient"
import notificationService from '../services/notificationService';

const SessionContext = createContext();

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
      } catch (error) {
        console.error('SessionContext: Error getting initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth state changes
    let subscription;
    try {
      const { data } = supabase.auth.onAuthStateChange(
        async (event, newSession) => {
          console.log('SessionContext: Auth state change:', event, newSession ? 'Session found' : 'No session');
          
          // Handle different auth events
          if (event === 'SIGNED_OUT') {
            // User signed out - clear session
            setSession(null);
            setLoading(false);
          } else if (event === 'TOKEN_REFRESHED') {
            // Token was refreshed - update session
            if (newSession) {
              setSession(newSession);
            }
            setLoading(false);
          } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            // User signed in or updated - set new session
            setSession(newSession);
            setLoading(false);
          } else {
            // Other events - update session if provided
            setSession(newSession);
            setLoading(false);
          }
        }
      );
      subscription = data?.subscription;
    } catch (error) {
      console.error('SessionContext: Error setting up auth state listener:', error);
    }

    // Handle app state changes for session refresh and validation
    const handleAppStateChange = async (nextAppState) => {
      if (nextAppState === 'active') {
        // Validate session when app becomes active to detect multi-device logout
        try {
          // If we have a session, validate it by trying to refresh
          if (session) {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            
            // If getUser fails, it means the refresh token is invalid (likely signed out from another device)
            if (userError) {
              const isTokenInvalid = userError.message?.includes('refresh_token') || 
                                     userError.message?.includes('JWT') || 
                                     userError.message?.includes('expired') ||
                                     userError.message?.includes('Invalid') ||
                                     userError.status === 401;
              
              if (isTokenInvalid) {
                console.log('SessionContext: Token invalidated (likely signed out from another device)');
                setSession(null);
                return;
              }
            }
            
            // If user is null, session is invalid
            if (!user) {
              console.log('SessionContext: No user found - clearing session');
              setSession(null);
              return;
            }
            
            // Get refreshed session
            const { data: { session: refreshedSession } } = await supabase.auth.getSession();
            if (refreshedSession) {
              setSession(refreshedSession);
            }
          } else {
            // No session - check if one exists in Supabase
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            // Only set session if we don't already have one and a new one exists
            // This respects the user's logout decision
            if (currentSession && !session) {
              setSession(currentSession);
            } else if (!currentSession && session) {
              // If session was cleared but Supabase still has one, clear it
              setSession(null);
            }
          }
        } catch (error) {
          console.error('SessionContext: Error refreshing session on app active:', error);
        }
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
      if (appStateSubscription) {
        appStateSubscription.remove();
      }
    };
  }, []);

  const signOut = async () => {
    try {
      console.log('SessionContext: Attempting to sign out...');
      
      // Get user ID before clearing session (needed for push token cleanup)
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const userId = currentSession?.user?.id;
      
      // Clear local session first
      setSession(null);
      
      // Clean up push tokens for this device only (not all devices)
      if (userId) {
        try {
          await notificationService.unregisterDeviceTokens(userId);
          console.log('SessionContext: Push tokens cleaned up for current device');
        } catch (tokenError) {
          console.log('SessionContext: Error cleaning up push tokens (non-critical):', tokenError);
        }
      }
      
      // Sign out from Supabase to clear stored session
      try {
          const { error } = await supabase.auth.signOut();
          if (error) {
            console.log('SessionContext: Supabase signOut error (non-critical):', error.message);
          // Even if signOut fails, clear local storage manually
          try {
            // Clear Supabase session storage
            await supabase.auth.getSession().then(({ data }) => {
              if (data?.session) {
                // Force clear by removing session
                supabase.auth.signOut();
              }
            });
          } catch (clearError) {
            console.log('SessionContext: Error clearing session storage:', clearError);
          }
        } else {
          console.log('SessionContext: Successfully signed out from Supabase');
        }
      } catch (supabaseError) {
        console.log('SessionContext: Supabase signOut failed (non-critical):', supabaseError.message);
      }
      
      // Ensure session is null after logout
      setSession(null);
      console.log('SessionContext: Sign out completed - session cleared');
    } catch (error) {
      console.error('SessionContext: Unexpected error during sign out:', error);
      // Always ensure local session is cleared
      setSession(null);
    }
  };

  const refreshSession = async () => {
    try {
      // First, try to refresh the token by calling getUser() which auto-refreshes expired tokens
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        // Check if it's a token refresh error (invalid refresh token)
        if (userError.message?.includes('refresh_token') || 
            userError.message?.includes('JWT') || 
            userError.message?.includes('expired') ||
            userError.message?.includes('Invalid')) {
          console.log('SessionContext: Refresh token invalid - user needs to sign in again');
          setSession(null);
          return null;
        }
        console.error('SessionContext: Error refreshing user:', userError);
        return null;
      }

      if (!user) {
        console.log('SessionContext: No user found after refresh');
        setSession(null);
        return null;
      }

      // Get the refreshed session
      const { data: { session: refreshedSession }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('SessionContext: Error getting refreshed session:', sessionError);
        return null;
      }

      setSession(refreshedSession);
      return refreshedSession;
    } catch (error) {
      console.error('SessionContext: Error refreshing session:', error);
      setSession(null);
      return null;
    }
  };

  return (
    <SessionContext.Provider value={{ 
      session, 
      loading, 
      signOut, 
      refreshSession,
      isAuthenticated: !!session 
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    return { 
      session: null, 
      loading: true, 
      signOut: () => {}, 
      refreshSession: () => {}, 
      isAuthenticated: false 
    };
  }
  return context;
}