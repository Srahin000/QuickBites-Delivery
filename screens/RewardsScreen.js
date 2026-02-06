import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, ScrollView, Alert, Clipboard } from 'react-native';
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
  const [referralPromoEnabled, setReferralPromoEnabled] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralStats, setReferralStats] = useState({ totalReferrals: 0, pendingRewards: 0 });
  const [couponUsesRemaining, setCouponUsesRemaining] = useState(0);

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

  // Fetch service approval ID 4 status
  const fetchReferralPromoStatus = async () => {
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
      console.error('Error fetching referral promo status:', err);
    }
  };

  // Fetch or generate user's referral code and coupon uses
  const fetchReferralCode = async () => {
    if (!session?.user || !referralPromoEnabled) return;
    
    try {
      // Check if user already has a referral code
      const { data: existingCode, error: fetchError } = await supabase
        .from('user_referral_codes')
        .select('referral_code, coupon_uses_remaining')
        .eq('user_id', session.user.id)
        .single();
      
      if (!fetchError && existingCode) {
        setReferralCode(existingCode.referral_code);
        setCouponUsesRemaining(existingCode.coupon_uses_remaining || 0);
      } else {
        // Generate new code
        const { data: newCode, error: functionError } = await supabase
          .rpc('generate_referral_code');
        
        if (!functionError && newCode) {
          // Insert the new code
          const { error: insertError } = await supabase
            .from('user_referral_codes')
            .insert([
              {
                user_id: session.user.id,
                referral_code: newCode,
                coupon_uses_remaining: 0,
              },
            ]);
          
          if (!insertError) {
            setReferralCode(newCode);
            setCouponUsesRemaining(0);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching/generating referral code:', err);
    }
  };

  // Fetch referral stats
  const fetchReferralStats = async () => {
    if (!session?.user || !referralPromoEnabled) return;
    
    try {
      // Get total referrals
      const { data: referrals, error: refError } = await supabase
        .from('referral_usage')
        .select('id, referrer_rewarded')
        .eq('referrer_user_id', session.user.id);
      
      if (!refError && referrals) {
        const totalReferrals = referrals.length;
        const pendingRewards = referrals.filter(r => !r.referrer_rewarded).length;
        setReferralStats({ totalReferrals, pendingRewards });
      }
    } catch (err) {
      console.error('Error fetching referral stats:', err);
    }
  };

  const handleCopyCode = () => {
    Clipboard.setString(referralCode);
    Alert.alert('Copied!', 'Referral code copied to clipboard');
  };

  useEffect(() => {
    fetchLeaderboard();
    fetchReferralPromoStatus();
  }, [session]);

  useEffect(() => {
    if (referralPromoEnabled && session?.user) {
      fetchReferralCode();
      fetchReferralStats();
    }
  }, [referralPromoEnabled, session]);

  // Refresh when screen comes into focus (tab press)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      handleRefresh();
    });

    return unsubscribe;
  }, [navigation]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLeaderboard();
    if (referralPromoEnabled) {
      await fetchReferralStats();
    }
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
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
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

        {/* Referral Section */}
        {referralPromoEnabled && referralCode && (
          <Animated.View entering={FadeInDown.delay(300)} style={{ marginTop: 32, paddingHorizontal: 16 }}>
            <View style={{ backgroundColor: '#F3F4F6', borderRadius: 16, padding: 20, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Icon.Gift color={themeColors.purple} width={24} height={24} style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: themeColors.purple }}>
                  Share & Earn
                </Text>
              </View>
              
              <Text style={{ color: '#6B7280', fontSize: 14, marginBottom: 16 }}>
                Share your code with friends! When they order, you both get 50% off delivery fees!
              </Text>
              
              {/* Referral Code Display */}
              <View style={{ 
                backgroundColor: 'white', 
                borderRadius: 12, 
                padding: 16, 
                marginBottom: 16,
                borderWidth: 2,
                borderColor: themeColors.purple,
                borderStyle: 'dashed'
              }}>
                <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, textAlign: 'center' }}>
                  YOUR REFERRAL CODE
                </Text>
                <Text style={{ 
                  fontSize: 32, 
                  fontWeight: 'bold', 
                  color: themeColors.purple, 
                  textAlign: 'center',
                  letterSpacing: 4
                }}>
                  {referralCode}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleCopyCode}
                style={{
                  backgroundColor: themeColors.purple,
                  borderRadius: 12,
                  paddingVertical: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon.Copy color="white" width={20} height={20} style={{ marginRight: 8 }} />
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Copy Code</Text>
              </TouchableOpacity>

              {/* Stats */}
              <View style={{ 
                flexDirection: 'row', 
                marginTop: 16, 
                paddingTop: 16, 
                borderTopWidth: 1, 
                borderTopColor: '#E5E7EB' 
              }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#000000' }}>
                    {referralStats.totalReferrals}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                    Total Referrals
                  </Text>
                </View>
                <View style={{ width: 1, backgroundColor: '#E5E7EB' }} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: themeColors.purple }}>
                    {referralStats.pendingRewards}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                    Pending Rewards
                  </Text>
                </View>
              </View>

              {referralStats.pendingRewards > 0 && (
                <View style={{ 
                  backgroundColor: '#FEF3C7', 
                  borderRadius: 8, 
                  padding: 12, 
                  marginTop: 12,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}>
                  <Icon.Info color="#92400E" width={20} height={20} style={{ marginRight: 8 }} />
                  <Text style={{ color: '#78350F', fontSize: 13, flex: 1 }}>
                    You have {referralStats.pendingRewards} pending reward{referralStats.pendingRewards > 1 ? 's' : ''}! Use them on your next order.
                  </Text>
                </View>
              )}

              {/* REFERRAL50 Coupon Display */}
              {couponUsesRemaining > 0 && (
                <View style={{ 
                  backgroundColor: '#FEF3C7', 
                  borderRadius: 12, 
                  padding: 16, 
                  marginTop: 16,
                  borderWidth: 2,
                  borderColor: themeColors.yellow,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Icon.Tag color={themeColors.purple} width={20} height={20} style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: themeColors.purple }}>
                      50% Off Coupon
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#92400E', marginBottom: 8 }}>
                    Code: <Text style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>REFERRAL50</Text>
                  </Text>
                  <Text style={{ fontSize: 14, color: '#78350F', fontWeight: '600' }}>
                    {couponUsesRemaining} use{couponUsesRemaining !== 1 ? 's' : ''} remaining
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}

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
      </View>
    </SafeAreaView>
  );
} 