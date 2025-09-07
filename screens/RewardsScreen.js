import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../supabaseClient';
import { themeColors } from '../theme';
import * as Icon from 'react-native-feather';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RewardsScreen() {
  const navigation = useNavigation();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLeaderboard();
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
              <FlatList
                data={leaderboard}
                keyExtractor={(item, idx) => (item.name || '-') + idx}
                renderItem={({ item, index }) => (
                  <View style={{
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
                )}
                ListEmptyComponent={<Text style={{ color: '#9CA3AF', textAlign: 'center', marginTop: 32 }}>No scores yet. Be the first to play!</Text>}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
                }
              />
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
} 