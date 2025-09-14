import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import supabase from "../supabaseClient"
import { useNavigation } from "@react-navigation/native";
import { useSession } from "../context/SessionContext-v2";
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeInUp, 
  SlideInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import * as Icon from "react-native-feather";
import LoadingSpinner from "../components/LoadingSpinner";
import AnimatedButton from "../components/AnimatedButton";
import { themeColors } from "../theme";
import { StatusBar } from 'expo-status-bar';

const { width, height } = Dimensions.get('window');

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const navigator = useNavigation();
  const { session, signOut } = useSession();
  const [showSuggestForm, setShowSuggestForm] = useState(false);
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);

  // Animation values
  const headerOpacity = useSharedValue(0);
  const profileScale = useSharedValue(0.8);
  const formTranslateY = useSharedValue(50);

  useEffect(() => {
    // Animate header and profile on mount
    headerOpacity.value = withTiming(1, { duration: 800 });
    profileScale.value = withSpring(1, { damping: 15, stiffness: 100 });
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user) {
        console.log("No user session found");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
      } else {
        setProfile(data);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [session]);

  const handleSignOut = async () => {
    try {
      await signOut();
      Alert.alert("Signed Out", "You have been signed out successfully.");
    } catch (error) {
      Alert.alert("Error", "Failed to sign out.");
    }
  };

  const handleRestaurantSubmit = async () => {
    if (!restaurantName.trim() || !restaurantAddress.trim()) {
      Alert.alert("Missing Fields", "Please fill out both fields.");
      return;
    }

    setSuggestLoading(true);
    const { error } = await supabase
      .from("restaurant_suggestions")
      .insert([{ restaurant_name: restaurantName, address: restaurantAddress }]);

    setSuggestLoading(false);

    if (error) {
      console.log("Error submitting suggestion:", JSON.stringify(error, null, 2));
      Alert.alert("Error", "Failed to submit suggestion.");
    } else {
      Alert.alert("Success", "Restaurant suggested successfully!");
      setRestaurantName('');
      setRestaurantAddress('');
      setShowSuggestForm(false);
    }
  };

  const toggleSuggestForm = () => {
    setShowSuggestForm(!showSuggestForm);
    formTranslateY.value = withSpring(showSuggestForm ? 50 : 0, { damping: 15 });
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Error", "New password must be at least 6 characters long.");
      return;
    }

    setChangePasswordLoading(true);
    try {
      // First, verify the current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });

      if (signInError) {
        Alert.alert("Error", "Current password is incorrect.");
        return;
      }

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw updateError;
      }

      Alert.alert("Success", "Password updated successfully!");
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error("Password change error:", error);
      Alert.alert("Error", "Failed to change password. Please try again.");
    } finally {
      setChangePasswordLoading(false);
    }
  };

  // Animated styles
  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
  }));

  const profileStyle = useAnimatedStyle(() => ({
    transform: [{ scale: profileScale.value }],
  }));

  const formStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: formTranslateY.value }],
  }));

  if (loading) {
    return <LoadingSpinner type="food" message="Loading Profile..." size="large" />;
  }

  if (!profile) {
    return <LoadingSpinner type="dots" message="No profile found" size="medium" color="#9CA3AF" />;
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: themeColors.purple }} edges={['top', 'left', 'right']}>
      <StatusBar style="light" backgroundColor={themeColors.purple} />
      {/* Purple Banner with Go Back Button, Profile Circle and Info */}
      <View style={{
        backgroundColor: themeColors.purple,
        width: '100%',
        paddingHorizontal: 24,
        paddingTop: 10,
        paddingBottom: 20,
        position: 'relative',
      }}>
        {/* Go Back Button - Top Left */}
        <TouchableOpacity
          onPress={() => navigator.goBack()}
          style={{
            position: 'absolute',
            top: 20,
            left: 24,
            zIndex: 10,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon.ArrowLeft size={20} color="white" />
        </TouchableOpacity>

        {/* Content Container - Centered */}
        <View style={{
          alignItems: 'center',
          marginTop: 50, // Space for back button
        }}>
          {/* Yellow Circle - Centered */}
          <View style={{
            backgroundColor: themeColors.yellow,
            width: 96,
            height: 96,
            borderRadius: 48,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 16,
            elevation: 12,
          }}>
            <Text className="text-3xl font-bold text-white">
              {profile.first_name?.charAt(0) ?? ''}{profile.last_name?.charAt(0) ?? ''}
            </Text>
          </View>
          
          {/* Name and Email - Centered below profile pic */}
          <View style={{ alignItems: 'center', marginTop: 16 }}>
            <Text className="text-xl font-bold" style={{ color: 'white' }}>{profile.first_name} {profile.last_name}</Text>
            <Text className="text-base" style={{ color: 'white', opacity: 0.85 }}>{profile.email}</Text>
          </View>
        </View>
      </View>
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 0, backgroundColor: 'white', flexGrow: 1 }}
      >

        {/* Profile Details */}
        <View className="px-6 space-y-4 mb-8 mt-10">
          <Animated.View entering={FadeInUp.delay(400)}>
            <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mx-2">
              <View className="flex-row items-center mb-3">
                <Icon.BookOpen className="w-5 h-5" style={{ color: themeColors.purple }} />
                <Text className="text-gray-600 font-medium ml-3">School</Text>
              </View>
              <Text className="text-lg font-semibold text-gray-800">{profile.school_name}</Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(500)}>
            <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mx-2">
              <View className="flex-row items-center mb-3">
                <Icon.Calendar className="w-5 h-5" style={{ color: themeColors.purple }} />
                <Text className="text-gray-600 font-medium ml-3">Year</Text>
              </View>
              <Text className="text-lg font-semibold text-gray-800">{profile.school_year}</Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(600)}>
            <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mx-2">
              <View className="flex-row items-center mb-3">
                <Icon.Award className="w-5 h-5" style={{ color: themeColors.purple }} />
                <Text className="text-gray-600 font-medium ml-3">Major</Text>
              </View>
              <Text className="text-lg font-semibold text-gray-800">{profile.major}</Text>
            </View>
          </Animated.View>
        </View>

        {/* Change Password Section */}
        <Animated.View entering={FadeInUp.delay(700)} className="px-8 mb-4">
          {!showChangePassword ? (
            <TouchableOpacity
              onPress={() => setShowChangePassword(true)}
              style={{ backgroundColor: themeColors.purple, elevation: 3 }}
              className="py-4 rounded-2xl shadow-lg"
            >
              <View className="flex-row items-center justify-center">
                <Icon.Key className="w-5 h-5 text-white mr-2" />
                <Text className="text-white font-semibold text-lg">Change Password</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 space-y-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-bold text-gray-800">Change Password</Text>
                <TouchableOpacity onPress={() => setShowChangePassword(false)}>
                  <Icon.X className="w-6 h-6 text-gray-500" />
                </TouchableOpacity>
              </View>
              
              <TextInput
                className="border border-gray-200 rounded-xl p-4 text-lg bg-gray-50"
                placeholder="Current Password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                placeholderTextColor="#9CA3AF"
              />
              
              <TextInput
                className="border border-gray-200 rounded-xl p-4 text-lg bg-gray-50"
                placeholder="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholderTextColor="#9CA3AF"
              />
              
              <TextInput
                className="border border-gray-200 rounded-xl p-4 text-lg bg-gray-50"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholderTextColor="#9CA3AF"
              />
              
              <TouchableOpacity
                onPress={handleChangePassword}
                disabled={changePasswordLoading}
                style={{ backgroundColor: themeColors.purple }}
                className="py-4 rounded-xl shadow-lg"
              >
                <View className="flex-row items-center justify-center">
                  {changePasswordLoading ? (
                    <View className="flex-row items-center">
                      <ActivityIndicator size="small" color="white" />
                      <Text className="text-white font-semibold text-lg ml-2">
                        Updating...
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Icon.Check className="w-5 h-5 text-white mr-2" />
                      <Text className="text-white font-semibold text-lg">Update Password</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        {/* Sign Out Button */}
        <Animated.View entering={FadeInUp.delay(800)} className="px-8">
          <TouchableOpacity
            onPress={handleSignOut}
            style={{ backgroundColor: themeColors.yellow, elevation: 3 }}
            className="py-4 rounded-2xl shadow-lg"
          >
            <View className="flex-row items-center justify-center">
              <Icon.LogOut className="w-5 h-5 text-white mr-2" />
              <Text className="text-white font-semibold text-lg">Sign Out</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Suggest Restaurant Section */}
        <Animated.View 
          style={formStyle}
          className="px-8 mb-8"
        >
          <Animated.View>
          {!showSuggestForm ? (
            <TouchableOpacity
              onPress={toggleSuggestForm}
              style={{ backgroundColor: themeColors.purple, elevation: 3 }}
              className="py-4 rounded-2xl shadow-lg"
            >
              <View className="flex-row items-center justify-center">
                <Icon.Plus className="w-5 h-5 text-white mr-2" />
                <Text className="text-white font-semibold text-lg">Suggest a Restaurant</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 space-y-4 mx-2">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-bold text-gray-800">Suggest Restaurant</Text>
                <TouchableOpacity onPress={toggleSuggestForm}>
                  <Icon.X className="w-6 h-6 text-gray-500" />
                </TouchableOpacity>
              </View>
              
              <Animated.View entering={SlideInRight.delay(100)}>
                <TextInput
                  className="border border-gray-200 rounded-xl p-4 text-lg bg-gray-50"
                  placeholder="Restaurant Name"
                  value={restaurantName}
                  onChangeText={setRestaurantName}
                  placeholderTextColor="#9CA3AF"
                />
              </Animated.View>
              
              <Animated.View entering={SlideInRight.delay(200)}>
                <TextInput
                  className="border border-gray-200 rounded-xl p-4 text-lg bg-gray-50"
                  placeholder="Restaurant Address"
                  value={restaurantAddress}
                  onChangeText={setRestaurantAddress}
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={2}
                />
              </Animated.View>
              
              <Animated.View entering={SlideInRight.delay(300)}>
                <TouchableOpacity
                  onPress={handleRestaurantSubmit}
                  disabled={suggestLoading}
                  style={{ backgroundColor: themeColors.purple }}
                  className="py-4 rounded-xl shadow-lg"
                >
                  <View className="flex-row items-center justify-center">
                    {suggestLoading ? (
                      <View className="flex-row items-center">
                        <Animated.View 
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 8,
                            borderWidth: 2,
                            borderColor: 'transparent',
                            borderTopColor: 'white',
                          }}
                        />
                        <Text className="text-white font-semibold text-lg ml-2">
                          Submitting...
                        </Text>
                      </View>
                    ) : (
                      <>
                        <Icon.Send className="w-5 h-5 text-white mr-2" />
                        <Text className="text-white font-semibold text-lg">Submit Suggestion</Text>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            </View>
          )}
          </Animated.View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}