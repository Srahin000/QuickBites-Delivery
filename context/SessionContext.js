import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SessionContext = createContext();

export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeSession = async () => {
      try {
        let currentSession = supabase.auth.session();
        
        if (!currentSession) {
          const storedSession = await AsyncStorage.getItem('supabase.auth.token');
          if (storedSession) {
            const parsedSession = JSON.parse(storedSession);
            const now = Math.floor(Date.now() / 1000);
            if (parsedSession.expires_at > now) {
              await supabase.auth.setAuth(parsedSession.access_token);
              currentSession = supabase.auth.session();
            } else {
              await AsyncStorage.removeItem('supabase.auth.token');
            }
          }
        }
        
        setSession(currentSession);
      } catch (error) {
        console.error('Error initializing session:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        
        if (newSession) {
          await AsyncStorage.setItem('supabase.auth.token', JSON.stringify(newSession));
        } else {
          await AsyncStorage.removeItem('supabase.auth.token');
        }
      }
    );

    const handleAppStateChange = async (nextAppState) => {
      if (nextAppState === 'active') {
        const currentSession = supabase.auth.session();
        if (!currentSession) {
          const storedSession = await AsyncStorage.getItem('supabase.auth.token');
          if (storedSession) {
            const parsedSession = JSON.parse(storedSession);
            const now = Math.floor(Date.now() / 1000);
            if (parsedSession.expires_at > now) {
              await supabase.auth.setAuth(parsedSession.access_token);
              setSession(supabase.auth.session());
            }
          }
        }
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      authListener?.unsubscribe();
      appStateSubscription?.remove();
    };
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    await AsyncStorage.removeItem('supabase.auth.token');
    setSession(null);
  };

  const refreshSession = () => {
    const currentSession = supabase.auth.session();
    setSession(currentSession);
    return currentSession;
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