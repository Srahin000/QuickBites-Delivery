import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Icon from 'react-native-feather';
import supabase from '../../supabaseClient';
import { useSession } from '../../context/SessionContext-v2';
import { themeColors } from '../../theme';

export default function DelivererShiftSelection() {
  const navigation = useNavigation();
  const { session } = useSession();
  
  const [slots, setSlots] = useState([]);
  const [myShifts, setMyShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchSlots(), fetchMyShifts(), fetchConfig()]);
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_configs')
        .select('*')
        .eq('config_date', new Date().toISOString().split('T')[0])
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setConfig(data);
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const fetchSlots = async () => {
    try {
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      
      const { data, error } = await supabase
        .from('delivery_times')
        .select('*')
        .eq('day', today)
        .order('hours', { ascending: true })
        .order('minutes', { ascending: true });

      if (error) throw error;

      // Filter for future slots only
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const futureSlots = (data || []).filter(slot => {
        let hour = parseInt(slot.hours);
        const minute = parseInt(slot.minutes || 0);
        const isPM = slot.ampm === 'PM';

        // Convert to 24-hour format
        if (isPM && hour !== 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;

        const slotMinutes = hour * 60 + minute;
        const currentMinutes = currentHour * 60 + currentMinute;

        return slotMinutes > currentMinutes;
      });

      setSlots(futureSlots);
    } catch (error) {
      console.error('Error fetching slots:', error);
      Alert.alert('Error', 'Failed to load time slots');
    }
  };

  const fetchMyShifts = async () => {
    try {
      if (!session?.user?.id) return;

      const { data, error } = await supabase
        .from('driver_schedules')
        .select('delivery_time_id')
        .eq('driver_id', session.user.id);

      if (error) throw error;
      setMyShifts((data || []).map(s => s.delivery_time_id));
    } catch (error) {
      console.error('Error fetching my shifts:', error);
    }
  };

  const handleToggleShift = async (slot) => {
    const isAssigned = myShifts.includes(slot.id);

    try {
      if (isAssigned) {
        // Unassign
        const { error } = await supabase.rpc('unassign_driver_from_slots', {
          p_driver_id: session.user.id,
          p_delivery_time_ids: [slot.id]
        });

        if (error) throw error;
        Alert.alert('Success', 'Shift removed');
        await fetchData();
      } else {
        // Assign
        const { error } = await supabase.rpc('assign_driver_to_slots', {
          p_driver_id: session.user.id,
          p_delivery_time_ids: [slot.id]
        });

        if (error) throw error;
        Alert.alert('Success', 'Shift assigned!');
        await fetchData();
      }
    } catch (error) {
      console.error('Error toggling shift:', error);
      Alert.alert('Error', error.message || 'Failed to update shift');
    }
  };

  const getSlotInterval = () => {
    if (!config) return 20; // Default to standard mode
    const tripsPerHour = config.trips_per_hour || 4;
    return 60 / tripsPerHour; // 2->30min, 3->20min, 4->15min
  };

  const getPaceInfo = () => {
    const interval = getSlotInterval();
    
    if (interval <= 15) {
      return {
        icon: 'zap',
        color: '#F59E0B',
        bgColor: '#FEF3C7',
        label: 'High Tempo',
        description: '15-min slots • Rush Mode'
      };
    } else if (interval <= 20) {
      return {
        icon: 'trending-up',
        color: '#3B82F6',
        bgColor: '#DBEAFE',
        label: 'Standard Pace',
        description: '20-min slots • Balanced'
      };
    } else {
      return {
        icon: 'coffee',
        color: '#10B981',
        bgColor: '#D1FAE5',
        label: 'Relaxed Mode',
        description: '30-min slots • Easy Pace'
      };
    }
  };

  const paceInfo = getPaceInfo();

  const renderSlot = ({ item: slot }) => {
    const isAssigned = myShifts.includes(slot.id);
    const hasDrivers = (slot.max_capacity_lu || 0) > 0;
    const driverCount = Math.floor((slot.max_capacity_lu || 0) / 20);

    return (
      <TouchableOpacity
        onPress={() => handleToggleShift(slot)}
        className={`mx-4 mb-3 p-4 rounded-xl border ${
          isAssigned
            ? 'bg-purple-50 border-purple-500'
            : 'bg-white border-gray-200'
        }`}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <View className="flex-row items-center mb-1">
              <Text className={`text-lg font-bold ${isAssigned ? 'text-purple-900' : 'text-gray-900'}`}>
                {slot.hours}:{(slot.minutes || 0).toString().padStart(2, '0')} {slot.ampm}
              </Text>
              {isAssigned && (
                <View className="ml-2 px-2 py-1 rounded-full bg-purple-500">
                  <Text className="text-xs text-white font-semibold">MY SHIFT</Text>
                </View>
              )}
            </View>

            <View className="flex-row items-center mt-2">
              {/* Pace Indicator */}
              <View 
                className="flex-row items-center px-2 py-1 rounded-lg mr-2"
                style={{ backgroundColor: paceInfo.bgColor }}
              >
                {paceInfo.icon === 'zap' && <Icon.Zap size={14} color={paceInfo.color} />}
                {paceInfo.icon === 'trending-up' && <Icon.TrendingUp size={14} color={paceInfo.color} />}
                {paceInfo.icon === 'coffee' && <Icon.Coffee size={14} color={paceInfo.color} />}
                <Text className="text-xs ml-1" style={{ color: paceInfo.color }}>
                  {paceInfo.label}
                </Text>
              </View>

              {/* Driver Count */}
              <View className="flex-row items-center">
                <Icon.Users size={14} color="#6B7280" />
                <Text className="text-xs text-gray-600 ml-1">
                  {driverCount} driver{driverCount !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            {/* Capacity Info */}
            <Text className="text-xs text-gray-500 mt-2">
              Capacity: {slot.max_capacity_lu || 0} LU • Available: {(slot.max_capacity_lu || 0) - (slot.current_load_lu || 0)} LU
            </Text>
          </View>

          {/* Action Button */}
          <View className="ml-3">
            {isAssigned ? (
              <View className="w-12 h-12 rounded-full bg-purple-500 items-center justify-center">
                <Icon.Check size={24} color="white" strokeWidth={3} />
              </View>
            ) : (
              <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center border border-gray-300">
                <Icon.Plus size={24} color="#6B7280" strokeWidth={2} />
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={themeColors.purple} />
          <Text className="mt-4 text-gray-600">Loading shifts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Icon.ArrowLeft stroke={themeColors.text} width={24} height={24} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-800">Select Shifts</Text>
        <TouchableOpacity onPress={onRefresh} className="p-2">
          <Icon.RefreshCw stroke={themeColors.text} width={24} height={24} />
        </TouchableOpacity>
      </View>

      {/* Pace Info Banner */}
      <View className="mx-4 mt-4 p-4 rounded-xl" style={{ backgroundColor: paceInfo.bgColor }}>
        <View className="flex-row items-center mb-2">
          {paceInfo.icon === 'zap' && <Icon.Zap size={20} color={paceInfo.color} />}
          {paceInfo.icon === 'trending-up' && <Icon.TrendingUp size={20} color={paceInfo.color} />}
          {paceInfo.icon === 'coffee' && <Icon.Coffee size={20} color={paceInfo.color} />}
          <Text className="text-base font-bold ml-2" style={{ color: paceInfo.color }}>
            Today's Pace: {paceInfo.label}
          </Text>
        </View>
        <Text className="text-sm" style={{ color: paceInfo.color }}>
          {paceInfo.description}
        </Text>
      </View>

      {/* My Shifts Summary */}
      <View className="mx-4 mt-3 p-3 rounded-xl bg-purple-50 border border-purple-200">
        <View className="flex-row items-center">
          <Icon.Calendar size={16} color="#7C3AED" />
          <Text className="ml-2 text-sm font-semibold text-purple-900">
            You have {myShifts.length} shift{myShifts.length !== 1 ? 's' : ''} today
          </Text>
        </View>
      </View>

      {/* Slots List */}
      <FlatList
        data={slots}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderSlot}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View className="py-12 items-center">
            <Icon.Calendar size={64} color="#9CA3AF" />
            <Text className="mt-4 text-gray-600 text-center">
              No available shifts for today
            </Text>
            <Text className="mt-2 text-gray-500 text-sm text-center px-8">
              Check back tomorrow or contact admin
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
