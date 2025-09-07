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
import { supabase } from "../supabaseClient";
import { themeColors } from "../theme";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithGoogle } from '../components/googleAuth';
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

const SignupScreen = () => {
  const navigation = useNavigation();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [major, setMajor] = useState("");
  const role = 'customer';

  // ✅ Check for existing session on mount (handles email confirmation)
  useEffect(() => {
    const checkSessionAndInsertUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
  
      if (!user) return;
  
      // ✅ Persist the confirmed session to AsyncStorage
      try {
        await AsyncStorage.setItem('supabase.auth.token', JSON.stringify(session));
        console.log('Email confirmation session persisted to AsyncStorage');
      } catch (storageError) {
        console.error('Error persisting confirmation session:', storageError);
      }
  
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .single();
  
      if (!existingUser) {
        await supabase.from("users").upsert([{
          id: user.id,
          email: user.email,
          first_name: firstName,
          last_name: lastName,
          school_name: schoolName,
          school_year: schoolYear,
          major: major,
          role: role,
        }]);
      }
  
      // No manual navigation here, let navigation.js handle it
    };
  
    checkSessionAndInsertUser();
  }, []);
  

  // ✅ Also handle real-time SIGNED_IN events (Google or manual login)
  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange(
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

          const { data: existingUser, error: checkError } = await supabase
            .from("users")
            .select("id")
            .eq("id", user.id)
            .single();

          if (!existingUser) {
            const { error: insertError } = await supabase
              .from("users")
              .upsert([
                {
                  id: user.id,
                  email: user.email,
                  first_name: firstName,
                  last_name: lastName,
                  school_name: schoolName,
                  school_year: schoolYear,
                  major: major,
                  role: role,
                },
              ]);

            if (insertError) {
              console.error("Insert user error:", insertError);
            }
          }

          // No manual navigation here, let navigation.js handle it
        }
      }
    );

    return () => subscription?.unsubscribe();
  }, [firstName, lastName, schoolName, schoolYear, major, role]);

  const handleSignUp = async () => {
    if (!firstName || !lastName || !email || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }
  
    setLoading(true);
    try {
      // ✅ Remove the unnecessary sign-in pre-check and directly try signing up
      const { user, session, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
  
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
      if (session) {
        try {
          await AsyncStorage.setItem('supabase.auth.token', JSON.stringify(session));
          console.log('Signup session persisted to AsyncStorage');
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
          <TextInput
            placeholder="School Name"
            value={schoolName}
            onChangeText={setSchoolName}
              className="border border-gray-300 rounded-lg p-3 mb-4 bg-gray-50"
          />
          <TextInput
              placeholder="School Year"
            value={schoolYear}
            onChangeText={setSchoolYear}
              className="border border-gray-300 rounded-lg p-3 mb-4 bg-gray-50"
          />
          <TextInput
            placeholder="Major"
            value={major}
            onChangeText={setMajor}
              className="border border-gray-300 rounded-lg p-3 mb-6 bg-gray-50"
          />

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

            <TouchableOpacity
              onPress={handleGoogleSignUp}
              style={{ backgroundColor: themeColors.yellow }}
              className="rounded-lg p-3 mb-4"
            >
              <Text className="text-white text-center font-semibold text-lg">Sign Up with Google</Text>
            </TouchableOpacity>

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
