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
  Platform,
  Dimensions,
  RefreshControl,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import supabase from "../supabaseClient"
import { useNavigation } from "@react-navigation/native";
import { useSession } from "../context/SessionContext-v2";
import { useCart } from "../context/CartContext";
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeInUp, 
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

function couponDisplayTitle(coupon) {
  if (!coupon) return 'Coupon';
  if (coupon.title) return coupon.title;
  if (coupon.category === 'delivery-fee') return 'Free Delivery';
  if (coupon.category === 'restaurant-fee') return `${coupon.percentage || 0}% Off Restaurant`;
  if (coupon.category === 'dev-fee') return 'Free Order (Testing)';
  if (coupon.category === 'item-fee') return `${coupon.percentage || 0}% Off Specific Item`;
  return `${coupon.percentage || 0}% Off`;
}

function formatExpiry(couponUsage, coupon) {
  const dateStr = couponUsage?.expires_at || coupon?.end_at;
  if (!dateStr) return 'No expiry';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const navigator = useNavigation();
  const { session, signOut } = useSession();
  const { clearCart } = useCart();
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackBody, setFeedbackBody] = useState('');
  const [showCouponsModal, setShowCouponsModal] = useState(false);
  const [activeCouponsList, setActiveCouponsList] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);

  // Animation values
  const headerOpacity = useSharedValue(0);
  const profileScale = useSharedValue(0.8);

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

  const fetchActiveCoupons = async () => {
    if (!session?.user?.id) {
      setActiveCouponsList([]);
      return;
    }
    setCouponsLoading(true);
    const { data, error } = await supabase
      .from('coupons_usage')
      .select('*, coupons(*)')
      .eq('user_id', session.user.id)
      .in('status', ['redeemed', 'available']);
    setCouponsLoading(false);
    if (error) {
      console.error('Error fetching coupons:', error);
      setActiveCouponsList([]);
      return;
    }
    setActiveCouponsList(data || []);
  };

  useEffect(() => {
    if (showCouponsModal && session?.user) {
      fetchActiveCoupons();
    }
  }, [showCouponsModal, session?.user?.id]);

  const handleSignOut = async () => {
    try {
      // Clear cart before signing out
      clearCart();
      await signOut();
      Alert.alert("Signed Out", "You have been signed out successfully.");
    } catch (error) {
      Alert.alert("Error", "Failed to sign out.");
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackTitle.trim() || !feedbackBody.trim()) {
      Alert.alert("Missing Fields", "Please enter a title and your feedback.");
      return;
    }

    setSuggestLoading(true);
    const { error } = await supabase
      .from("user_feedback")
      .insert([{
        user_id: session?.user?.id,
        title: feedbackTitle.trim(),
        feedback: feedbackBody.trim(),
      }]);

    setSuggestLoading(false);

    if (error) {
      console.error("Feedback submit error:", error);
      Alert.alert("Error", "Failed to send feedback. Please try again.");
    } else {
      Alert.alert("Thank you", "Your feedback has been sent.");
      setFeedbackTitle('');
      setFeedbackBody('');
      setShowFeedbackModal(false);
    }
  };

  const closeFeedbackModal = () => {
    setShowFeedbackModal(false);
    setFeedbackTitle('');
    setFeedbackBody('');
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

  if (loading) {
    return <LoadingSpinner type="food" message="Loading Profile..." size="large" />;
  }

  if (!profile) {
    return <LoadingSpinner type="dots" message="No profile found" size="medium" color="#9CA3AF" />;
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: themeColors.purple }} edges={['top', 'left', 'right']}>
      <StatusBar style="light" backgroundColor={themeColors.purple} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
      {/* Compact header: back, avatar, title only */}
      <View style={{
        backgroundColor: themeColors.purple,
        width: '100%',
        paddingHorizontal: 24,
        paddingTop: 8,
        paddingBottom: 20,
        position: 'relative',
      }}>
        <TouchableOpacity
          onPress={() => navigator.goBack()}
          style={{
            position: 'absolute',
            top: 12,
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

        <View style={{ alignItems: 'center', marginTop: 48 }}>
          <View style={{
            backgroundColor: themeColors.yellow,
            width: 100,
            height: 100,
            borderRadius: 50,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 4,
          }}>
            <Text style={{ fontSize: 34, fontWeight: '700', color: 'white' }}>
              {profile.first_name?.charAt(0) ?? ''}{profile.last_name?.charAt(0) ?? ''}
            </Text>
          </View>
          <Text className="text-lg font-bold mt-3" style={{ color: 'white' }}>Profile</Text>
        </View>
      </View>
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 0, backgroundColor: 'white', flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              if (session?.user) {
                const { data, error } = await supabase
                  .from("users")
                  .select("*")
                  .eq("id", session.user.id)
                  .single();
                if (!error && data) {
                  setProfile(data);
                }
              }
              setRefreshing(false);
            }}
          />
        }
      >

        {/* Personal Information - single card, list style */}
        <View className="px-6 mt-6 mb-6">
          <Animated.View entering={FadeInUp.delay(400)}>
            <View style={{
              backgroundColor: 'white',
              borderRadius: 16,
              paddingVertical: 4,
              paddingHorizontal: 20,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            }}>
              <Text className="text-sm font-semibold text-gray-500 pt-3 pb-2">Personal Information</Text>
              <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
                <Text className="text-xs text-gray-500 mb-1">Full Name</Text>
                <Text className="text-base font-semibold text-gray-800">{profile.first_name} {profile.last_name}</Text>
              </View>
              <View style={{ paddingVertical: 12 }}>
                <Text className="text-xs text-gray-500 mb-1">Email</Text>
                <Text className="text-base font-semibold text-gray-800">{profile.email}</Text>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Buttons - consistent width and spacing */}
        <View className="px-6 mb-8">
        <Animated.View entering={FadeInUp.delay(500)}>
          <TouchableOpacity
            onPress={() => setShowCouponsModal(true)}
            style={{ backgroundColor: themeColors.purple }}
            className="py-4 rounded-xl mb-3"
          >
            <View className="flex-row items-center justify-center">
              <Icon.Tag size={20} color="white" />
              <Text className="text-white font-semibold text-base ml-2">Active Coupons</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(550)}>
          {!showChangePassword ? (
            <TouchableOpacity
              onPress={() => setShowChangePassword(true)}
              style={{ backgroundColor: themeColors.purple }}
              className="py-4 rounded-xl mb-3"
            >
              <View className="flex-row items-center justify-center">
                <Icon.Key size={20} color="white" />
                <Text className="text-white font-semibold text-base ml-2">Change Password</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={{
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 20,
              marginBottom: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            }}>
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-bold text-gray-800">Change Password</Text>
                <TouchableOpacity onPress={() => setShowChangePassword(false)}>
                  <Icon.X size={22} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <TextInput
                style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: '#F9FAFB' }}
                placeholder="Current Password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                placeholderTextColor="#9CA3AF"
              />
              <TextInput
                style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: '#F9FAFB', marginTop: 12 }}
                placeholder="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholderTextColor="#9CA3AF"
              />
              <TextInput
                style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: '#F9FAFB', marginTop: 12 }}
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity
                onPress={handleChangePassword}
                disabled={changePasswordLoading}
                style={{ backgroundColor: themeColors.purple, marginTop: 16 }}
                className="py-4 rounded-xl"
              >
                <View className="flex-row items-center justify-center">
                  {changePasswordLoading ? (
                    <>
                      <ActivityIndicator size="small" color="white" />
                      <Text className="text-white font-semibold text-base ml-2">Updating...</Text>
                    </>
                  ) : (
                    <>
                      <Icon.Check size={20} color="white" />
                      <Text className="text-white font-semibold text-base ml-2">Update Password</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(600)}>
          <TouchableOpacity
            onPress={handleSignOut}
            style={{ backgroundColor: themeColors.yellow }}
            className="py-4 rounded-xl mb-3"
          >
            <View className="flex-row items-center justify-center">
              <Icon.LogOut size={20} color="white" />
              <Text className="text-white font-semibold text-base ml-2">Sign Out</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(700)}>
          <TouchableOpacity
            onPress={() => setShowFeedbackModal(true)}
            style={{ backgroundColor: 'transparent', borderWidth: 1.5, borderColor: themeColors.purple }}
            className="py-4 rounded-xl"
          >
            <View className="flex-row items-center justify-center">
              <Icon.MessageCircle size={20} color={themeColors.purple} />
              <Text className="font-semibold text-base ml-2" style={{ color: themeColors.purple }}>Send Feedback</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
        </View>
      </ScrollView>

      {/* Feedback Modal - centered with backdrop */}
      <Modal
        visible={showFeedbackModal}
        transparent
        animationType="fade"
        onRequestClose={closeFeedbackModal}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
          onPress={closeFeedbackModal}
        >
          <Pressable
            style={{
              width: '100%',
              maxWidth: 400,
              backgroundColor: 'white',
              borderRadius: 20,
              padding: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 24,
              elevation: 8,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-gray-800">Feedback</Text>
              <TouchableOpacity onPress={closeFeedbackModal} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Icon.X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: '#F9FAFB' }}
              placeholder="Title"
              value={feedbackTitle}
              onChangeText={setFeedbackTitle}
              placeholderTextColor="#9CA3AF"
            />
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 12,
                padding: 14,
                fontSize: 16,
                backgroundColor: '#F9FAFB',
                marginTop: 12,
                minHeight: 100,
                textAlignVertical: 'top',
              }}
              placeholder="Feedback (details)"
              value={feedbackBody}
              onChangeText={setFeedbackBody}
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity
              onPress={handleFeedbackSubmit}
              disabled={suggestLoading}
              style={{ backgroundColor: themeColors.purple, marginTop: 20 }}
              className="py-4 rounded-xl"
            >
              <View className="flex-row items-center justify-center">
                {suggestLoading ? (
                  <>
                    <ActivityIndicator size="small" color="white" />
                    <Text className="text-white font-semibold text-base ml-2">Sending...</Text>
                  </>
                ) : (
                  <>
                    <Icon.Send size={20} color="white" />
                    <Text className="text-white font-semibold text-base ml-2">Submit</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={closeFeedbackModal}
              className="py-3 mt-3"
            >
              <Text className="text-center text-gray-500 font-medium">Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Active Coupons Modal */}
      <Modal
        visible={showCouponsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCouponsModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
          onPress={() => setShowCouponsModal(false)}
        >
          <Pressable
            style={{
              width: '100%',
              maxWidth: 400,
              maxHeight: '80%',
              backgroundColor: 'white',
              borderRadius: 20,
              padding: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 24,
              elevation: 8,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>Your Active Coupons</Text>
              <TouchableOpacity onPress={() => setShowCouponsModal(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Icon.X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ maxHeight: 360 }}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {couponsLoading ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#22c55e" />
                  <Text style={{ marginTop: 12, fontSize: 14, color: '#6B7280' }}>Loading coupons...</Text>
                </View>
              ) : activeCouponsList.length === 0 ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                  <Icon.Tag size={48} color="#D1D5DB" />
                  <Text style={{ marginTop: 12, fontSize: 15, color: '#6B7280', textAlign: 'center' }}>
                    You don't have any active coupons. Redeem a code in your cart to add one.
                  </Text>
                </View>
              ) : (
                activeCouponsList.map((couponUsage) => {
                  const coupon = couponUsage.coupons;
                  if (!coupon) return null;
                  const code = coupon.coupon_code || couponUsage.coupon_code || '—';
                  const title = couponDisplayTitle(coupon);
                  const expires = formatExpiry(couponUsage, coupon);
                  return (
                    <View
                      key={couponUsage.id}
                      style={{
                        backgroundColor: '#F9FAFB',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#E5E7EB',
                        padding: 16,
                        marginBottom: 12,
                        borderLeftWidth: 4,
                        borderLeftColor: '#22c55e',
                      }}
                    >
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 }}>
                        {title}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                        <View
                          style={{
                            borderWidth: 1,
                            borderStyle: 'dashed',
                            borderColor: '#6B7280',
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                          }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', letterSpacing: 1 }}>
                            {code}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => Alert.alert('Copied', `Code ${code} copied to clipboard.`)}
                          style={{ backgroundColor: '#22c55e', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginLeft: 10 }}
                        >
                          <Text style={{ fontSize: 14, fontWeight: '600', color: 'white' }}>Copy</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={{ fontSize: 12, color: '#6B7280' }}>Expires: {expires}</Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity
              onPress={() => setShowCouponsModal(false)}
              style={{ marginTop: 16, paddingVertical: 12 }}
            >
              <Text style={{ textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#6B7280' }}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}