import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState } from 'react-native';
import supabase from '../supabaseClient';

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
    let subscription = null;
    try {
      const authStateChange = supabase.auth.onAuthStateChange(
        (event, newSession) => {
          console.log('SessionContext: Auth state change:', event, newSession ? 'Session found' : 'No session');
          setSession(newSession);
          setLoading(false);
        }
      );
      subscription = authStateChange.data?.subscription;
      console.log('SessionContext: Created subscription:', typeof subscription, subscription);
    } catch (error) {
      console.error('SessionContext: Error setting up auth state listener:', error);
    }

    // Handle app state changes for session refresh
    const handleAppStateChange = async (nextAppState) => {
      if (nextAppState === 'active') {
        // Refresh session when app becomes active
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          console.log('SessionContext: App became active, session:', currentSession ? 'Found' : 'Not found');
          setSession(currentSession);
        } catch (error) {
          console.error('SessionContext: Error refreshing session on app active:', error);
        }
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      console.log('SessionContext: Cleanup - subscription type:', typeof subscription);
      try {
        if (subscription && typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
          console.log('SessionContext: Successfully unsubscribed');
        } else {
          console.log('SessionContext: Subscription is not valid for unsubscribe');
        }
      } catch (unsubscribeError) {
        console.error('SessionContext: Error during unsubscribe:', unsubscribeError);
      }
      
      try {
        if (appStateSubscription && typeof appStateSubscription.remove === 'function') {
          appStateSubscription.remove();
        }
      } catch (removeError) {
        console.error('SessionContext: Error removing app state subscription:', removeError);
      }
    };
  }, []);

  const signOut = async () => {
    try {
      console.log('SessionContext: Attempting to sign out...');
      
      // Always clear local session first
      setSession(null);
      
      // Try to sign out from Supabase, but don't fail if it doesn't work
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          console.log('SessionContext: Signing out user from Supabase:', currentSession.user?.email);
          const { error } = await supabase.auth.signOut();
          if (error) {
            console.log('SessionContext: Supabase signOut error (non-critical):', error.message);
          } else {
            console.log('SessionContext: Successfully signed out from Supabase');
          }
        } else {
          console.log('SessionContext: No active session found in Supabase');
        }
      } catch (supabaseError) {
        console.log('SessionContext: Supabase signOut failed (non-critical):', supabaseError.message);
      }
      
      console.log('SessionContext: Sign out completed - local session cleared');
    } catch (error) {
      console.error('SessionContext: Unexpected error during sign out:', error);
      // Always ensure local session is cleared
      setSession(null);
    }
  };

  const refreshSession = async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      return currentSession;
    } catch (error) {
      console.error('SessionContext: Error refreshing session:', error);
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