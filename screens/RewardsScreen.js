import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import supabase from "../supabaseClient"
import { themeColors } from '../theme';
import * as Icon from 'react-native-feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../context/SessionContext-v2';

export default function RewardsScreen() {
  const navigation = useNavigation();
  const { session } = useSession();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [redeemingCoupon, setRedeemingCoupon] = useState(false);
  const [userCoupons, setUserCoupons] = useState([]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('scores')
      .select('name, highest_score, last_played')
      .order('highest_score', { ascending: false })
      .limit(10);
    if (!error) setLeaderboard(data || []);
    setLoading(false);
  };

  const fetchUserCoupons = async () => {
    if (!session?.user) return;
    
    const { data, error } = await supabase
      .from('coupons_usage')
      .select('*, coupons(*)')
      .eq('user_id', session.user.id)
      .eq('status', 'redeemed'); // Only fetch redeemed coupons, not applied ones
    
    if (!error) {
      setUserCoupons(data || []);
    }
  };

  const redeemCoupon = async () => {
    if (!couponCode.trim()) {
      Alert.alert('Error', 'Please enter a coupon code');
      return;
    }

    if (!session?.user) {
      Alert.alert('Error', 'Please sign in to redeem coupons');
      return;
    }

    setRedeemingCoupon(true);

    try {
      console.log('Attempting to redeem coupon:', couponCode.trim().toUpperCase());
      
      // Check if coupon exists and is valid
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('*')
        .eq('coupon_code', couponCode.trim().toUpperCase())
        .single();

      console.log('Coupon query result:', { coupon, couponError });

      if (couponError || !coupon) {
        console.log('Coupon not found or error:', couponError);
        Alert.alert('Invalid Coupon', 'This coupon code does not exist');
        setRedeemingCoupon(false);
        return;
      }

      // Validate coupon: check if valid and not expired
      const now = new Date();
      const endDate = new Date(coupon.end_at);
      
      if (!coupon.valid) {
        Alert.alert('Invalid Coupon', 'This coupon is no longer valid');
        setRedeemingCoupon(false);
        return;
      }

      if (now > endDate) {
        Alert.alert('Expired Coupon', 'This coupon has expired');
        setRedeemingCoupon(false);
        return;
      }

      // Check if user has already redeemed this coupon and reached their max usage
      const { data: existingUsage, error: existingError } = await supabase
        .from('coupons_usage')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('coupon_id', coupon.id)
        .single();

      // Check if user has reached their max usage for this coupon (skip for dev-fee coupons)
      if (coupon.category !== 'dev-fee' && coupon.max_usage && existingUsage) {
        // Count how many times this user has used this coupon
        const { data: userUsageData, error: userUsageError } = await supabase
          .from('coupons_usage')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('coupon_id', coupon.id)
          .in('status', ['redeemed', 'applied']);

        const userUsageCount = userUsageData?.length || 0;
        
        if (userUsageCount >= coupon.max_usage) {
          Alert.alert('Coupon Limit Reached', `You have already used this coupon ${coupon.max_usage} time(s). Max usage per user: ${coupon.max_usage}`);
          setRedeemingCoupon(false);
          return;
        }
      }

      // Add coupon to user's account with "redeemed" status
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // Coupon expires in 30 days

      console.log('Inserting coupon usage:', {
        user_id: session.user.id,
        coupon_id: coupon.id,
        status: 'redeemed',
        redeemed_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString()
      });

      // Try to insert, but handle the case where user already has coupons
      const { error: insertError } = await supabase
        .from('coupons_usage')
        .insert({
          user_id: session.user.id,
          coupon_id: coupon.id,
          status: 'redeemed',
          redeemed_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString()
        });

      console.log('Insert result:', { insertError });

      if (insertError) {
        console.log('Insert error details:', insertError);
        
        // If it's a duplicate key error, check if it's the same coupon
        if (insertError.code === '23505') {
          // Check if user already has this specific coupon
          const { data: existingCoupon, error: checkError } = await supabase
            .from('coupons_usage')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('coupon_id', coupon.id)
            .single();

          if (existingCoupon) {
            Alert.alert('Already Redeemed', 'You have already redeemed this coupon');
            setRedeemingCoupon(false);
            return;
          } else {
            // This is a different coupon but user_id constraint is blocking
            Alert.alert('Error', 'Database constraint error. Please contact support.');
            setRedeemingCoupon(false);
            return;
          }
        }
        
        Alert.alert('Error', 'Failed to redeem coupon. Please try again.');
        setRedeemingCoupon(false);
        return;
      }

      Alert.alert('Success!', `Coupon "${couponCode}" has been redeemed! You can now use it at checkout.`);
      setCouponCode('');
      fetchUserCoupons(); // Refresh user coupons
    } catch (error) {
      console.error('Coupon redemption error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setRedeemingCoupon(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    fetchUserCoupons();
  }, [session]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLeaderboard();
    await fetchUserCoupons();
    setRefreshing(false);
  };

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: themeColors.purple }}
      edges={['top', 'left', 'right']}
    >
      {/* Purple Header */}
      <View
        style={{
          backgroundColor: themeColors.purple,
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 10,
          paddingBottom: 16,
          width: '100%',
        }}
      >
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 28, marginBottom: 4 }}>
          Rewards
        </Text>
        <Text style={{ color: 'white', opacity: 0.8, fontSize: 14 }}>
          Compete and win every week!
        </Text>
      </View>
      {/* Main Content (white background) */}
      <KeyboardAvoidingView 
        style={{ flex: 1, backgroundColor: '#fff' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
        {/* This Week's Game */}
        <Animated.View entering={FadeInDown.delay(200)} style={{ marginTop: 32, alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: themeColors.purple, marginBottom: 12 }}>This Week's Game</Text>
          <Text style={{ color: '#6B7280', fontSize: 16, marginBottom: 20, textAlign: 'center', paddingHorizontal: 24 }}>
            Play the featured game and climb the leaderboard for a chance to win rewards!
          </Text>
          <Animated.View entering={FadeInUp.delay(400)}>
            <TouchableOpacity
              onPress={() => navigation.navigate('GameScreen')}
              style={{
                backgroundColor: themeColors.yellow,
                borderRadius: 32,
                paddingVertical: 18,
                paddingHorizontal: 48,
                shadowColor: themeColors.yellow,
                shadowOpacity: 0.3,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 8 },
                elevation: 8,
                flexDirection: 'row',
                alignItems: 'center',
              }}
              activeOpacity={0.85}
            >
              <Icon.Award color={themeColors.purple} width={28} height={28} style={{ marginRight: 12 }} />
              <Text style={{ color: themeColors.purple, fontWeight: 'bold', fontSize: 20 }}>Play Now</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        {/* Coupon Redemption Section */}
        <Animated.View entering={FadeInDown.delay(400)} style={{ marginTop: 32, paddingHorizontal: 16 }}>
          <View style={{ backgroundColor: '#F3F4F6', borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Icon.Gift className="w-6 h-6 text-purple-600 mr-2" />
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: themeColors.purple }}>
                Redeem Your Coupon
              </Text>
            </View>
            
            <Text style={{ color: '#6B7280', fontSize: 14, marginBottom: 16 }}>
              Enter your coupon code to unlock special discounts and offers
            </Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: 'white',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderWidth: 1,
                  borderColor: '#D1D5DB',
                  fontSize: 16,
                  marginRight: 12,
                }}
                placeholder="Enter coupon code"
                value={couponCode}
                onChangeText={setCouponCode}
                autoCapitalize="characters"
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity
                onPress={redeemCoupon}
                disabled={redeemingCoupon || !couponCode.trim()}
                style={{
                  backgroundColor: redeemingCoupon || !couponCode.trim() ? '#D1D5DB' : themeColors.purple,
                  borderRadius: 12,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                }}
              >
                {redeemingCoupon ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={{ color: 'white', fontWeight: '600' }}>Redeem</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* User's Coupons */}
          {userCoupons.length > 0 && (
            <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Icon.CheckCircle className="w-6 h-6 text-green-600 mr-2" />
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#374151' }}>
                  Your Active Coupons
                </Text>
              </View>
              
              {userCoupons.map((userCoupon, index) => {
                const coupon = userCoupon.coupons;
                
                return (
                  <View key={index} style={{ 
                    backgroundColor: '#FEF3C7', 
                    borderRadius: 12, 
                    padding: 16, 
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: '#FCD34D'
                  }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#92400E' }}>
                          {coupon?.coupon_code}
                        </Text>
                        <Text style={{ fontSize: 14, color: '#B45309', marginTop: 4 }}>
                          {coupon?.category === 'delivery-fee' ? 'Free Delivery' : 
                           coupon?.category === 'restaurant-fee' ? `${coupon?.percentage}% Off Restaurant` :
                           coupon?.category === 'dev-fee' ? 'Free Order (Testing)' :
                           coupon?.category === 'item-fee' ? `${coupon?.percentage}% Off Specific Item` :
                           `${coupon?.percentage}% Off`}
                        </Text>
                        {coupon?.title && (
                          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                            {coupon.title}
                          </Text>
                        )}
                      </View>
                      <View style={{ 
                        backgroundColor: '#D97706', 
                        borderRadius: 8, 
                        paddingHorizontal: 8, 
                        paddingVertical: 4 
                      }}>
                        <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>
                          Redeemed
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Animated.View>

        {/* Leaderboard */}
        <View style={{ flex: 1, marginTop: 40, paddingHorizontal: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: themeColors.purple, marginBottom: 16 }}>
            This Week's Leaderboard
          </Text>
          {loading ? (
            <ActivityIndicator size="large" color={themeColors.purple} style={{ marginTop: 32 }} />
          ) : (
            <View>
              {/* Table Header */}
              <View style={{
                flexDirection: 'row',
                backgroundColor: '#E5E7EB',
                borderRadius: 8,
                paddingVertical: 8,
                paddingHorizontal: 12,
                marginBottom: 8,
              }}>
                <Text style={{ flex: 0.5, fontWeight: 'bold', color: '#374151' }}>#</Text>
                <Text style={{ flex: 2, fontWeight: 'bold', color: '#374151' }}>Name</Text>
                <Text style={{ flex: 2, fontWeight: 'bold', color: '#374151' }}>Time</Text>
                <Text style={{ flex: 1, fontWeight: 'bold', color: '#374151', textAlign: 'right' }}>Score</Text>
              </View>
              {leaderboard.length > 0 ? (
                leaderboard.map((item, index) => (
                  <View key={(item.name || '-') + index} style={{
                    flexDirection: 'row',
                    backgroundColor: index % 2 === 0 ? '#F3F4F6' : '#E5E7EB',
                    borderRadius: 8,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    marginBottom: 4,
                    alignItems: 'center',
                  }}>
                    <Text style={{ flex: 0.5, color: themeColors.purple, fontWeight: 'bold' }}>{index + 1}</Text>
                    <Text style={{ flex: 2, color: '#374151' }}>{item.name || '-'}</Text>
                    <Text style={{ flex: 2, color: '#374151' }}>{item.last_played ? new Date(item.last_played).toLocaleString() : '-'}</Text>
                    <Text style={{ flex: 1, color: themeColors.purple, fontWeight: 'bold', textAlign: 'right' }}>{item.highest_score}</Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: '#9CA3AF', textAlign: 'center', marginTop: 32 }}>No scores yet. Be the first to play!</Text>
              )}
            </View>
          )}
        </View>

        {/* Spacing after leaderboard */}
        <View style={{ height: 40 }} />
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
  );
} 