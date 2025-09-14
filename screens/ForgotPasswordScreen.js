import React, { useState } from 'react';
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
  SafeAreaView
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import supabase from "../supabaseClient";
import { themeColors } from "../theme";
import * as Icon from "react-native-feather";

const ForgotPasswordScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email address.");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://quick-bites-delivery-flax.vercel.app/reset-password',
      });

      if (error) {
        // Check if it's a user not found error
        if (error.message?.includes('User not found') || error.message?.includes('not found')) {
          Alert.alert("Error", "No account found with this email address. Please check your email or create a new account.");
        } else {
          throw error;
        }
      } else {
        setEmailSent(true);
      }
    } catch (error) {
      console.error("Password reset error:", error);
      Alert.alert("Error", "Failed to send password reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToSignIn = () => {
    navigation.navigate("Signin");
  };

  if (emailSent) {
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
              <Text className="text-3xl font-bold text-center text-white mb-2">Check Your Email</Text>
              <Text className="text-white/80 text-center">We've sent password reset instructions to your email</Text>
            </View>

            {/* Content */}
            <View className="flex-1 bg-white rounded-t-3xl px-6 pt-8">
              <View className="items-center">
                {/* Success Icon */}
                <View className="w-20 h-20 bg-green-100 rounded-full items-center justify-center mb-6">
                  <Icon.Mail size={40} color="#10b981" />
                </View>

                {/* Success Message */}
                <Text className="text-2xl font-bold text-gray-800 text-center mb-4">
                  Email Sent Successfully!
                </Text>
                
                <Text className="text-gray-600 text-center text-lg mb-2">
                  We've sent password reset instructions to:
                </Text>
                
                <Text className="text-purple-600 font-semibold text-lg mb-6">
                  {email}
                </Text>

                <Text className="text-gray-500 text-center text-base mb-8 px-4">
                  Please check your email and follow the instructions to reset your password. 
                  If you don't see the email, check your spam folder.
                </Text>

                {/* Back to Sign In Button */}
                <TouchableOpacity
                  onPress={handleBackToSignIn}
                  style={{ backgroundColor: themeColors.purple }}
                  className="w-full py-4 rounded-xl shadow-lg"
                >
                  <View className="flex-row items-center justify-center">
                    <Icon.ArrowLeft className="w-5 h-5 text-white mr-2" />
                    <Text className="text-white font-semibold text-lg">Back to Sign In</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
            <Text className="text-3xl font-bold text-center text-white mb-2">Forgot Password?</Text>
            <Text className="text-white/80 text-center">Enter your email to reset your password</Text>
          </View>

          {/* Form */}
          <View className="flex-1 bg-white rounded-t-3xl px-6 pt-8">
            {/* Email Input - Moved Higher */}
            <View className="mb-6">
              <Text className="text-gray-700 font-medium mb-2">Email Address</Text>
              <TextInput
                placeholder="Enter your email address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
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

            {/* Reset Password Button */}
            <TouchableOpacity
              onPress={handleResetPassword}
              disabled={loading}
              style={{ backgroundColor: themeColors.purple }}
              className="rounded-lg p-4 mb-6"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-center font-semibold text-lg">Send Reset Email</Text>
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

export default ForgotPasswordScreen;
