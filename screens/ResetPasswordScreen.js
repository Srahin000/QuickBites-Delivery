import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  SafeAreaView,
  Linking
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import supabase from "../supabaseClient";
import { themeColors } from "../theme";
import * as Icon from "react-native-feather";

const ResetPasswordScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);

  useEffect(() => {
    // Handle deep link for password reset
    const handleDeepLink = async () => {
      try {
        // Get the initial URL (if app was opened via deep link)
        const initialUrl = await Linking.getInitialURL();
        console.log('🔍 ResetPasswordScreen - Initial URL:', initialUrl);
        console.log('🔍 ResetPasswordScreen - Current route params:', route.params);
        
        if (initialUrl) {
          const url = new URL(initialUrl);
          const accessToken = url.searchParams.get('access_token');
          const refreshToken = url.searchParams.get('refresh_token');
          
          if (accessToken) {
            console.log('Access token found in deep link, setting session...');
            
            // Set the session using the tokens from the deep link
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || ''
            });
            
            if (sessionError) {
              console.error('Session error:', sessionError);
              Alert.alert("Error", "Invalid reset link. Please request a new password reset.");
              navigation.navigate("ForgotPassword");
              return;
            }
            
            if (sessionData.session) {
              console.log('Session established from deep link');
              setSession(sessionData.session);
              return;
            }
          }
        }
        
        // Check if we have an existing session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session) {
          console.log('Valid session found');
          setSession(session);
          return;
        }
        
        // No valid session found
        console.log('No valid session found');
        Alert.alert(
          "Invalid Reset Link", 
          "This password reset link is invalid or has expired. Please request a new password reset.",
          [
            {
              text: "Request New Reset",
              onPress: () => navigation.navigate("ForgotPassword")
            },
            {
              text: "Back to Sign In",
              onPress: () => navigation.navigate("Signin")
            }
          ]
        );
        
      } catch (error) {
        console.error('Error handling deep link:', error);
        Alert.alert("Error", "Something went wrong. Please try again.");
        navigation.navigate("Signin");
      }
    };

    handleDeepLink();
    
    // Listen for deep links when app is already running
    const handleUrl = (url) => {
      console.log('Deep link received:', url);
      if (url.includes('reset-password')) {
        handleDeepLink();
      }
    };
    
    const subscription = Linking.addEventListener('url', handleUrl);
    
    return () => {
      subscription?.remove();
    };
  }, []);

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw error;
      }

      Alert.alert(
        "Success!",
        "Your password has been updated successfully. You can now sign in with your new password.",
        [
          {
            text: "Sign In",
            onPress: () => navigation.navigate("Signin")
          }
        ]
      );
    } catch (error) {
      console.error("Password update error:", error);
      Alert.alert("Error", "Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToSignIn = () => {
    navigation.navigate("Signin");
  };

  if (!session) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: themeColors.purple }}>
        <View className="flex-1 justify-center items-center px-6">
          <ActivityIndicator size="large" color="white" />
          <Text className="text-white text-center mt-4">Verifying reset link...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: themeColors.purple }}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="pt-8 pb-4 px-6">
            <Text className="text-3xl font-bold text-center text-white mb-2">Reset Password</Text>
            <Text className="text-white/80 text-center">Enter your new password</Text>
          </View>

          {/* Form */}
          <View className="flex-1 bg-white rounded-t-3xl px-6 pt-8">
            {/* New Password Input */}
            <View className="mb-4">
              <Text className="text-gray-700 font-medium mb-2">New Password</Text>
              <TextInput
                placeholder="Enter your new password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                className="border border-gray-300 rounded-lg bg-gray-50"
                style={{
                  padding: 16,
                  fontSize: 16,
                  minHeight: 56,
                  textAlignVertical: 'center'
                }}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Confirm Password Input */}
            <View className="mb-6">
              <Text className="text-gray-700 font-medium mb-2">Confirm New Password</Text>
              <TextInput
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                className="border border-gray-300 rounded-lg bg-gray-50"
                style={{
                  padding: 16,
                  fontSize: 16,
                  minHeight: 56,
                  textAlignVertical: 'center'
                }}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Password Requirements */}
            <View className="mb-6 p-4 bg-blue-50 rounded-lg">
              <Text className="text-blue-800 font-medium mb-2">Password Requirements:</Text>
              <Text className="text-blue-700 text-sm">• At least 6 characters long</Text>
              <Text className="text-blue-700 text-sm">• Both passwords must match</Text>
            </View>

            {/* Update Password Button */}
            <TouchableOpacity
              onPress={handleResetPassword}
              disabled={loading}
              style={{ backgroundColor: themeColors.purple }}
              className="rounded-lg p-4 mb-6"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-center font-semibold text-lg">Update Password</Text>
              )}
            </TouchableOpacity>

            {/* Back to Sign In Link */}
            <TouchableOpacity onPress={handleBackToSignIn} className="mb-8">
              <Text className="text-center text-gray-600">
                Remember your password?{" "}
                <Text style={{ color: themeColors.purple }} className="font-semibold">
                  Back to Sign In
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ResetPasswordScreen;
