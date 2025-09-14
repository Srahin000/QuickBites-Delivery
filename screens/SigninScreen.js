/*
 * TODO: FUTURE IMPLEMENTATION - Google Sign-in
 * The Google Sign-in button has been commented out for future implementation.
 * When ready to implement, uncomment the Google sign-in button and ensure
 * the Google OAuth configuration is properly set up in Supabase.
 */

import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, ScrollView, Platform, SafeAreaView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useState } from "react";
import supabase from "../supabaseClient"
import { themeColors } from "../theme";
import { signInWithGoogle } from '../components/googleAuth';

const SigninScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleIsAdmin = async (userId) => {
    try {
      // Query the "admin" table to check if the user's id exists
      const { data, error } = await supabase
        .from('admin')
        .select('admin1uid')
        .eq('admin1uid', userId);

        
      if (error) {
        console.error("Error fetching admin data:", error);
        return false;
      }

      return data.length > 0; // If found, user is admin
    } catch (error) {
      console.error("Error in handleIsAdmin:", error);
      return false;
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      // Use the modern signInWithPassword method
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data?.session) {
        console.log('Sign in successful, session:', data.session);
        Alert.alert("Success", "Signed in successfully!");
      }
    } catch (error) {
      console.error('Sign in error:', error);
      Alert.alert("Error", "Failed to sign in. Please check your credentials and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      console.log('🔍 Starting Google sign-in...');
      const { data, error } = await signInWithGoogle();
      
      if (error) {
        console.error('❌ Google sign-in error:', error);
        throw error;
      }

      if (data) {
        console.log('✅ Google sign in successful, session:', data);
        console.log('✅ User email:', data.user?.email);
        Alert.alert("Success", "Signed in with Google successfully!");
        
        // The session should now be available in the SessionContext
        // No need to manually navigate - the Navigation component will handle it
      } else {
        console.error('❌ No data returned from Google sign-in');
        throw new Error('No data returned from Google sign-in');
      }
    } catch (error) {
      console.error('❌ Google sign-in error:', error);
      
      // Use the improved error message from our helper
      const errorMessage = error.userMessage || error.message || 'Google Sign-In failed. Please try again.';
      
      if (error.message === 'User cancelled Google sign in' || error.message?.includes('popup_closed')) {
        Alert.alert('Cancelled', 'Google sign-in was cancelled.');
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate("ForgotPassword");
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: themeColors.purple }}>
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
    >
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
          {/* Header */}
          <View className="pt-8 pb-6 px-6">
            <Text className="text-3xl font-bold text-center text-white mb-2">Welcome Back</Text>
            <Text className="text-white/80 text-center">Sign in to your Quickbites account</Text>
          </View>

          {/* Form */}
          <View className="flex-1 bg-white rounded-t-3xl px-6 py-8">
          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
              className="border border-gray-300 rounded-lg p-3 mb-4 bg-gray-50"
          />

          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
              className="border border-gray-300 rounded-lg p-3 mb-6 bg-gray-50"
          />

          <TouchableOpacity
            onPress={handleSignIn}
            disabled={loading}
              style={{ backgroundColor: themeColors.purple }}
              className="rounded-lg p-3 mb-4"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
                <Text className="text-white text-center font-semibold text-lg">Sign In</Text>
            )}
          </TouchableOpacity>

            {/* TODO: FUTURE IMPLEMENTATION - Google Sign-in Button
            <TouchableOpacity
              onPress={handleGoogleSignIn}
              style={{ backgroundColor: themeColors.yellow }}
              className="rounded-lg p-3 mb-4"
            >
              <Text className="text-white text-center font-semibold text-lg">Sign In with Google</Text>
            </TouchableOpacity>
            */}


            <TouchableOpacity onPress={() => navigation.navigate("Signup")}>
              <Text className="text-center text-gray-600">
                Don't have an account?{" "}
                <Text style={{ color: themeColors.purple }} className="font-semibold">
                  Create Account
                </Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleForgotPassword}
              className="mt-4"
            >
              <Text className="text-center" style={{ color: themeColors.purple }}>
                Forgot Password?
              </Text>
            </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SigninScreen;
