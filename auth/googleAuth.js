import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import supabase from "../supabaseClient"

// Complete the auth session
WebBrowser.maybeCompleteAuthSession();

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET;

// Create the auth request
const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'com.googleusercontent.apps.202497981968-3vvbdhdrgadicq2cnotm7kt826q0uhfa',
  path: 'oauthredirect',
});

const request = new AuthSession.AuthRequest({
  clientId: GOOGLE_CLIENT_ID,
  scopes: ['openid', 'profile', 'email'],
  redirectUri,
  responseType: AuthSession.ResponseType.Code,
  extraParams: {
    access_type: 'offline',
  },
  discovery,
});

export const googleAuth = {
  // Initialize the auth request
  async makeAuthRequest() {
    try {
      const result = await request.promptAsync(discovery);
      return result;
    } catch (error) {
      console.error('Google auth request error:', error);
      throw error;
    }
  },

  // Exchange code for tokens and sign in to Supabase
  async handleAuthResult(result) {
    if (result.type === 'success') {
      try {
        // Exchange the authorization code for tokens
        const tokenResult = await AuthSession.exchangeCodeAsync(
          {
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            code: result.params.code,
            redirectUri,
            extraParams: {
              code_verifier: request.codeVerifier,
            },
          },
          discovery
        );

        // Sign in to Supabase with the Google access token
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: tokenResult.accessToken,
        });

        if (error) {
          console.error('Supabase sign in error:', error);
          throw error;
        }

        return data;
      } catch (error) {
        console.error('Token exchange error:', error);
        throw error;
      }
    } else if (result.type === 'cancel') {
      throw new Error('User cancelled Google sign in');
    } else {
      throw new Error('Google sign in failed');
    }
  },

  // Complete Google sign in flow
  async signIn() {
    try {
      const result = await this.makeAuthRequest();
      return await this.handleAuthResult(result);
    } catch (error) {
      console.error('Google sign in error:', error);
      throw error;
    }
  },
}; 