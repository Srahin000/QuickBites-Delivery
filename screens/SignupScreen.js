/*
 * TODO: FUTURE IMPLEMENTATION - Google Sign-in
 * The Google Sign-in button has been commented out for future implementation.
 * When ready to implement, uncomment the Google sign-in button and ensure
 * the Google OAuth configuration is properly set up in Supabase.
 */

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
import { useState, useEffect } from "react";
import supabase from "../supabaseClient"
import { themeColors } from "../theme";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithGoogle } from '../components/googleAuth';
import * as WebBrowser from "expo-web-browser";


WebBrowser.maybeCompleteAuthSession();

/** Returns true if the referral RPC failed because the code was already used (benign, no need to log). */
const isReferralAlreadyUsed = (err, result) => {
  const msg = (err?.message ?? result?.error ?? '').toString().toLowerCase();
  return msg.includes('already used');
};

const SignupScreen = () => {
  const navigation = useNavigation();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [referralPromoEnabled, setReferralPromoEnabled] = useState(false);
  const [citymailRequired, setCitymailRequired] = useState(false);
  const role = 'customer';

  // Check if referral promo is enabled
  useEffect(() => {
    const checkReferralPromoStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('service_approval')
          .select('open')
          .eq('id', 4)
          .single();
        
        if (!error && data) {
          setReferralPromoEnabled(data.open);
        }
      } catch (err) {
        console.error('Error checking referral promo status:', err);
      }
    };
    
    checkReferralPromoStatus();
  }, []);

  // Check if citymail is required
  useEffect(() => {
    const checkCitymailRequirement = async () => {
      try {
        const { data, error } = await supabase
          .from('service_approval')
          .select('open')
          .eq('id', 6)
          .single();
        
        if (!error && data) {
          setCitymailRequired(data.open);
        }
      } catch (err) {
        console.error('Error checking citymail requirement:', err);
      }
    };
    
    checkCitymailRequirement();
  }, []);

  // ✅ Check for existing session on mount - redirect if already authenticated
  useEffect(() => {
    const checkSessionAndProcessReferral = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
  
      if (!user) return;
  
      // ✅ If user is already authenticated, redirect to home
      console.log('User already authenticated, redirecting...');
      
      // ✅ Persist the confirmed session to AsyncStorage
      try {
        await AsyncStorage.setItem('supabase.auth.token', JSON.stringify(session));
        console.log('Email confirmation session persisted to AsyncStorage');
      } catch (storageError) {
        console.error('Error persisting confirmation session:', storageError);
      }
  
      // Process referral code if it was provided during signup
      const storedReferralCode = await AsyncStorage.getItem('signup_referral_code');
      if (storedReferralCode && referralPromoEnabled) {
        try {
          const { data: result, error: refError } = await supabase
            .rpc('process_referral_signup', {
              p_referee_user_id: user.id,
              p_referral_code: storedReferralCode.trim().toUpperCase()
            });
          
          if (!refError && result?.success) {
            console.log('Referral code processed successfully');
            await AsyncStorage.removeItem('signup_referral_code');
          } else if (isReferralAlreadyUsed(refError, result)) {
            await AsyncStorage.removeItem('signup_referral_code');
          } else {
            console.error('Error processing referral code:', refError || result?.error);
          }
        } catch (refErr) {
          if (isReferralAlreadyUsed(refErr)) {
            await AsyncStorage.removeItem('signup_referral_code');
          } else {
            console.error('Error processing referral code:', refErr);
          }
        }
      }

      // Navigate away from signup screen since user is already authenticated
      navigation.replace('Home');
    };
  
    checkSessionAndProcessReferral();
  }, [referralPromoEnabled, navigation]);
  

  // ✅ Also handle real-time SIGNED_IN events (Google or manual login)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN") {
          const user = session?.user;
          if (!user) return;

          // ✅ Persist session to AsyncStorage for all sign-in events
          try {
            await AsyncStorage.setItem('supabase.auth.token', JSON.stringify(session));
            console.log('Session persisted to AsyncStorage from auth state change');
          } catch (storageError) {
            console.error('Error persisting session from auth state change:', storageError);
          }

          // Process referral code if it was provided during signup
          const storedReferralCode = await AsyncStorage.getItem('signup_referral_code');
          if (storedReferralCode && referralPromoEnabled) {
            try {
              const { data: result, error: refError } = await supabase
                .rpc('process_referral_signup', {
                  p_referee_user_id: user.id,
                  p_referral_code: storedReferralCode.trim().toUpperCase()
                });
              
              if (!refError && result?.success) {
                console.log('Referral code processed successfully');
                await AsyncStorage.removeItem('signup_referral_code');
              } else if (isReferralAlreadyUsed(refError, result)) {
                await AsyncStorage.removeItem('signup_referral_code');
              } else {
                console.error('Error processing referral code:', refError || result?.error);
              }
            } catch (refErr) {
              if (isReferralAlreadyUsed(refErr)) {
                await AsyncStorage.removeItem('signup_referral_code');
              } else {
                console.error('Error processing referral code:', refErr);
              }
            }
          }

          // No manual navigation here, let navigation.js handle it
        }
      }
    );

    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, [firstName, lastName, role]);

  const handleSignUp = async () => {
    if (!firstName || !lastName || !email || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    // Check if user is already authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      Alert.alert("Already Signed In", "You are already signed in.", [
        { text: "Go to Home", onPress: () => navigation.replace('Home') },
      ]);
      return;
    }

    // Validate email domain if citymail is required
    if (citymailRequired) {
      const emailLower = email.toLowerCase();
      const validDomains = ['citymail.cuny.edu', 'ccny.cuny.edu'];
      const isValidDomain = validDomains.some(domain => emailLower.endsWith(`@${domain}`));
      
      if (!isValidDomain) {
        Alert.alert(
          "Invalid Email",
          "Please use your CUNY email address (@citymail.cuny.edu or @ccny.cuny.edu)"
        );
        return;
      }
    }
  
    setLoading(true);
    try {
      // Store referral code if provided (for processing after email confirmation)
      if (referralCode.trim() && referralPromoEnabled) {
        await AsyncStorage.setItem('signup_referral_code', referralCode.trim().toUpperCase());
      }
      
      // Sign up with metadata (trigger will use this to create profile after email confirmation)
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            role: role,
          }
        }
      });

      const user = data?.user;
      const session = data?.session;
  
      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          Alert.alert("Account Exists", "Please confirm your email or sign in instead.", [
            { text: "Go to Sign In", onPress: () => navigation.navigate("Signin") },
          ]);
          return;
        }
  
        throw signUpError;
      }

      // ✅ If signup is successful and we get a session immediately (no email confirmation needed)
      if (session && user) {
        try {
          await AsyncStorage.setItem('supabase.auth.token', JSON.stringify(session));
          console.log('Signup session persisted to AsyncStorage');
          
          // Process referral code immediately if session is available
          if (referralCode.trim() && referralPromoEnabled) {
            try {
              console.log('Processing referral code:', referralCode.trim().toUpperCase());
              const { data: result, error: refError } = await supabase
                .rpc('process_referral_signup', {
                  p_referee_user_id: user.id,
                  p_referral_code: referralCode.trim().toUpperCase()
                });
              
              if (!refError && result?.success) {
                console.log('✅ Referral code processed successfully:', result);
                await AsyncStorage.removeItem('signup_referral_code');
              } else if (isReferralAlreadyUsed(refError, result)) {
                await AsyncStorage.removeItem('signup_referral_code');
              } else {
                console.error('❌ Error processing referral code:', refError || result);
              }
            } catch (refErr) {
              if (isReferralAlreadyUsed(refErr)) {
                await AsyncStorage.removeItem('signup_referral_code');
              } else {
                console.error('❌ Exception processing referral code:', refErr);
              }
            }
          }
        } catch (storageError) {
          console.error('Error persisting signup session:', storageError);
        }
      }
  
      Alert.alert(
        "Check your email",
        "A confirmation link has been sent. Please verify to complete signup."
      );
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  
  const handleGoogleSignUp = async () => {
    setLoading(true);
    try {
      const { data, error } = await signInWithGoogle();
      
      if (error) {
        throw error;
      }

      if (data?.user) {
        // Store session in AsyncStorage
        try {
          const session = supabase.auth.session();
          if (session) {
            await AsyncStorage.setItem('supabase.auth.token', JSON.stringify(session));
            console.log('Google sign-up session persisted to AsyncStorage');
          }
        } catch (storageError) {
          console.error('Error persisting Google sign-up session:', storageError);
        }
        
        Alert.alert("Success", "Signed up with Google successfully!");
        // No manual navigation here, let navigation.js handle it
      }
    } catch (error) {
      console.error('Google sign-up error:', error);
      
      // Use the improved error message from our helper
      const errorMessage = error.userMessage || error.message || 'Google Sign-Up failed. Please try again.';
      
      if (error.message === 'User cancelled Google sign in' || error.message?.includes('popup_closed')) {
        Alert.alert('Cancelled', 'Google sign-up was cancelled.');
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setLoading(false)
    }
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
        showsVerticalScrollIndicator={false}
      >
          {/* Header */}
          <View className="pt-8 pb-6 px-6">
            <Text className="text-3xl font-bold text-center text-white mb-2">Create Account</Text>
            <Text className="text-white/80 text-center">Join Quickbites today!</Text>
          </View>

          {/* Form */}
          <View className="flex-1 bg-white rounded-t-3xl px-6 py-8">
          <TextInput
            placeholder="First Name"
            value={firstName}
            onChangeText={setFirstName}
              className="border border-gray-300 rounded-lg p-3 mb-4 bg-gray-50"
          />
          <TextInput
            placeholder="Last Name"
            value={lastName}
            onChangeText={setLastName}
              className="border border-gray-300 rounded-lg p-3 mb-4 bg-gray-50"
          />
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
              className="border border-gray-300 rounded-lg p-3 mb-4 bg-gray-50"
          />
          
          {referralPromoEnabled && (
            <TextInput
              placeholder="Referral Code (Optional)"
              value={referralCode}
              onChangeText={setReferralCode}
              autoCapitalize="characters"
              className="border border-gray-300 rounded-lg p-3 mb-4 bg-gray-50"
            />
          )}

          <TouchableOpacity
            onPress={handleSignUp}
            disabled={loading}
              style={{ backgroundColor: themeColors.purple }}
              className="rounded-lg p-3 mb-4"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
                <Text className="text-white text-center font-semibold text-lg">Sign Up</Text>
            )}
          </TouchableOpacity>

            {/* TODO: FUTURE IMPLEMENTATION - Google Sign-in Button
            <TouchableOpacity
              onPress={handleGoogleSignUp}
              style={{ backgroundColor: themeColors.yellow }}
              className="rounded-lg p-3 mb-4"
            >
              <Text className="text-white text-center font-semibold text-lg">Sign Up with Google</Text>
            </TouchableOpacity>
            */}

            <TouchableOpacity onPress={() => navigation.navigate("Signin")}>
              <Text className="text-center text-gray-600">
                Already have an account?{" "}
                <Text style={{ color: themeColors.purple }} className="font-semibold">
                  Sign In
                </Text>
              </Text>
            </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default SignupScreen;
