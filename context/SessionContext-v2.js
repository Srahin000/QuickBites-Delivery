import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState } from 'react-native';
import supabase from "../supabaseClient"

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log('SessionContext: Auth state change:', event);
        setSession(newSession);
        setLoading(false);
      }
    );

    // Handle app state changes for session refresh
    const handleAppStateChange = async (nextAppState) => {
      if (nextAppState === 'active') {
        // Refresh session when app becomes active
        try {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession && !session) {
            setSession(currentSession);
          }
        } catch (error) {
          console.error('SessionContext: Error refreshing session on app active:', error);
        }
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.unsubscribe();
      appStateSubscription?.remove();
    };
  }, []);

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
    } catch (error) {
      console.error('SessionContext: Error signing out:', error);
      throw error;
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