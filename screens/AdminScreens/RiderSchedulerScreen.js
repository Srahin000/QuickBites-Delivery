import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Icon from 'react-native-feather';
import supabase from '../../supabaseClient';
import { themeColors } from '../../theme';

export default function RiderSchedulerScreen() {
  const navigation = useNavigation();

  const WEEKDAYS = [
    { short: 'Sun', full: 'Sunday' },
    { short: 'Mon', full: 'Monday' },
    { short: 'Tue', full: 'Tuesday' },
    { short: 'Wed', full: 'Wednesday' },
    { short: 'Thu', full: 'Thursday' },
    { short: 'Fri', full: 'Friday' },
    { short: 'Sat', full: 'Saturday' },
  ];

  const [drivers, setDrivers] = useState([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('assign'); // 'assign' | 'unassign'
  const [selectedSlotIdsAssign, setSelectedSlotIdsAssign] = useState([]);
  const [selectedSlotIdsUnassign, setSelectedSlotIdsUnassign] = useState([]);

  const [allSlots, setAllSlots] = useState([]);
  const [viewDays, setViewDays] = useState(() => [
    new Date().toLocaleDateString('en-US', { weekday: 'long' }),
  ]);
  const [driverSchedules, setDriverSchedules] = useState([]);

  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Configuration state
  const [tripsPerHour, setTripsPerHour] = useState(4);
  const [customerInterval, setCustomerInterval] = useState(60);
  const [configLoading, setConfigLoading] = useState(false);
  const [currentConfig, setCurrentConfig] = useState(null);

  useEffect(() => {
    fetchDrivers();
    fetchAllSlots();
    fetchDriverSchedules();
    fetchCurrentConfig();
  }, []);

  const fetchDrivers = async () => {
    try {
      console.log('Fetching drivers from users table...');
      
      // Fetch deliverers from the public users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, first_name, last_name, role')
        .eq('role', 'deliverer')
        .order('email', { ascending: true });

      console.log('Drivers query result:', { userData, userError });

      if (userError) throw userError;

      if (userData && userData.length > 0) {
        // Format driver data with full name
        const formattedDrivers = userData.map(user => ({
          id: user.id,
          email: user.email,
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
          role: user.role
        }));
        console.log('Formatted drivers:', formattedDrivers);
        setDrivers(formattedDrivers);
      } else {
        console.log('No deliverers found in users table');
        setDrivers([]);
        // Don't alert on load—show inline message instead so admin can still use the screen
      }
    } catch (error) {
      console.error('Error fetching drivers:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      Alert.alert('Error', `Failed to load drivers: ${error.message}`);
      setDrivers([]);
    }
  };

  const fetchAllSlots = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_times')
        .select('*')
        .order('day', { ascending: true })
        .order('hours', { ascending: true });

      if (error) throw error;
      console.log('📦 Fetched slots:', data?.length || 0, 'slots');
      console.log('📦 Sample slot:', data?.[0]);
      setAllSlots(data || []);
    } catch (error) {
      console.error('Error fetching slots:', error);
      Alert.alert('Error', 'Failed to load time slots: ' + error.message);
    }
  };

  const fetchDriverSchedules = async () => {
    try {
      // Fetch driver schedules without the foreign key join (auth.users not directly joinable)
      const { data, error } = await supabase
        .from('driver_schedules')
        .select('id, driver_id, delivery_time_id, notes, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDriverSchedules(data || []);
    } catch (error) {
      console.error('Error fetching driver schedules:', error);
    }
  };

  const fetchCurrentConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_configs')
        .select('*')
        .eq('config_date', new Date().toISOString().split('T')[0])
        .single();

      if (error && error.code !== 'PGRST116') throw error; // Ignore "not found" error

      if (data) {
        setCurrentConfig(data);
        setTripsPerHour(data.trips_per_hour || 4);
        setCustomerInterval(data.customer_interval_minutes || 60);
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const handleUpdateConfig = async () => {
    try {
      setConfigLoading(true);

      const { data, error } = await supabase.rpc('update_daily_config', {
        new_trips_per_hour: tripsPerHour,
        new_customer_interval: customerInterval
      });

      if (error) throw error;

      if (data?.success) {
        Alert.alert(
          'Configuration Updated',
          data.message || 'Slots regenerated successfully',
          [
            {
              text: 'OK',
              onPress: async () => {
                await fetchCurrentConfig();
                await fetchAllSlots();
                await fetchDriverSchedules();
              }
            }
          ]
        );
      } else {
        throw new Error(data?.error || 'Failed to update configuration');
      }
    } catch (error) {
      console.error('Error updating config:', error);
      Alert.alert('Error', error.message || 'Failed to update configuration');
    } finally {
      setConfigLoading(false);
    }
  };

  const getSlotIntervalText = () => {
    const intervals = { 2: '30-min', 3: '20-min', 4: '15-min' };
    return intervals[tripsPerHour] || '15-min';
  };

  const getWindowText = () => {
    return customerInterval === 60 ? '1-hour' : '30-min';
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchDrivers(),
      fetchAllSlots(),
      fetchDriverSchedules(),
      fetchCurrentConfig(),
    ]);
    setRefreshing(false);
  }, []);

  // Live config from DB (for badges and reset)
  const liveTrips = currentConfig?.trips_per_hour ?? null;
  const liveInterval = currentConfig?.customer_interval_minutes ?? null;
  const configIsModified = currentConfig != null && (
    tripsPerHour !== liveTrips || customerInterval !== liveInterval
  );

  const resetToLiveConfig = () => {
    if (currentConfig) {
      setTripsPerHour(currentConfig.trips_per_hour ?? 4);
      setCustomerInterval(currentConfig.customer_interval_minutes ?? 60);
    }
  };

  // Per-day schedule summary: total slots and how many have at least one rider
  const scheduleOverviewByDay = useMemo(() => {
    const filledSlotIds = new Set(driverSchedules.map((s) => s.delivery_time_id));
    return WEEKDAYS.map(({ full }) => {
      const daySlots = allSlots.filter((s) => (s.day || '').trim() === full);
      const total = daySlots.length;
      const filled = daySlots.filter((s) => filledSlotIds.has(s.id)).length;
      return { day: full, total, filled };
    });
  }, [allSlots, driverSchedules]);

  const toggleViewDay = (fullDayName) => {
    setViewDays((prev) =>
      prev.includes(fullDayName)
        ? prev.filter((d) => d !== fullDayName)
        : [...prev, fullDayName]
    );
  };

  const toggleSlotAssign = (slotId, slotDay) => {
    setSelectedSlotIdsAssign((prev) => {
      if (prev.includes(slotId)) return prev.filter((id) => id !== slotId);
      if (prev.length === 0) return [slotId];
      const first = assignListItems.find((i) => i.type === 'slot' && prev.includes(i.slot.id));
      const currentDay = first?.slot?.day?.trim();
      if (currentDay !== slotDay) return [slotId];
      return [...prev, slotId];
    });
  };

  const toggleSlotUnassign = (slotId, slotDay) => {
    setSelectedSlotIdsUnassign((prev) => {
      if (prev.includes(slotId)) return prev.filter((id) => id !== slotId);
      if (prev.length === 0) return [slotId];
      const first = unassignListItems.find((i) => i.type === 'slot' && prev.includes(i.slot.id));
      const currentDay = first?.slot?.day?.trim();
      if (currentDay !== slotDay) return [slotId];
      return [...prev, slotId];
    });
  };

  const handleAssignToSlots = () => {
    if (!selectedDriverId) {
      Alert.alert('Missing Information', 'Please select a deliverer');
      return;
    }
    if (selectedSlotIdsAssign.length === 0) {
      Alert.alert('Missing Information', 'Please select at least one slot');
      return;
    }
    const driver = drivers.find((d) => d.id === selectedDriverId);
    Alert.alert(
      'Confirm Assign',
      `Assign ${driver?.name || driver?.email || 'deliverer'} to ${selectedSlotIdsAssign.length} slot(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Assign',
          onPress: async () => {
            setActionLoading(true);
            try {
              const { data, error } = await supabase.rpc('assign_driver_to_slots', {
                p_driver_id: selectedDriverId,
                p_delivery_time_ids: selectedSlotIdsAssign,
                p_notes: null,
              });
              if (error) throw error;
              Alert.alert('Success', typeof data === 'string' ? data : 'Assigned.');
              setSelectedSlotIdsAssign([]);
              await fetchAllSlots();
              await fetchDriverSchedules();
            } catch (err) {
              console.error(err);
              Alert.alert('Error', err.message || 'Failed to assign');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleUnassignFromSlots = () => {
    if (!selectedDriverId) {
      Alert.alert('Missing Information', 'Please select a deliverer');
      return;
    }
    if (selectedSlotIdsUnassign.length === 0) {
      Alert.alert('Missing Information', 'Please select at least one slot to remove');
      return;
    }
    const driver = drivers.find((d) => d.id === selectedDriverId);
    Alert.alert(
      'Confirm Remove',
      `Remove ${driver?.name || driver?.email || 'deliverer'} from ${selectedSlotIdsUnassign.length} slot(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const { data, error } = await supabase.rpc('unassign_driver_from_slots', {
                p_driver_id: selectedDriverId,
                p_delivery_time_ids: selectedSlotIdsUnassign,
              });
              if (error) throw error;
              Alert.alert('Success', typeof data === 'string' ? data : 'Removed.');
              setSelectedSlotIdsUnassign([]);
              await fetchAllSlots();
              await fetchDriverSchedules();
            } catch (err) {
              console.error(err);
              Alert.alert('Error', err.message || 'Failed to remove');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const getSlotStatus = (capacity) => {
    if (capacity === 0 || capacity === null) {
      return { status: 'Closed', color: '#EF4444', bgColor: '#FEE2E2', textColor: '#991B1B' };
    } else if (capacity >= 20) {
      return { status: 'Open', color: '#10B981', bgColor: '#D1FAE5', textColor: '#065F46' };
    } else {
      return { status: 'Limited', color: '#F59E0B', bgColor: '#FEF3C7', textColor: '#92400E' };
    }
  };

  const getDriversForSlot = (slotId) => {
    const schedules = driverSchedules.filter(schedule => schedule.delivery_time_id === slotId);
    
    // Map driver IDs to names/emails from our drivers list
    return schedules
      .map(schedule => {
        const driver = drivers.find(d => d.id === schedule.driver_id);
        return driver?.name || driver?.email || `Driver ${schedule.driver_id.substring(0, 8)}...`;
      })
      .join(', ');
  };

  // Filter drivers by search (name or email)
  const filteredDrivers = useMemo(() => {
    const q = driverSearchQuery.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter(
      d =>
        (d.name || '').toLowerCase().includes(q) ||
        (d.email || '').toLowerCase().includes(q)
    );
  }, [drivers, driverSearchQuery]);

  const order = useMemo(() => WEEKDAYS.map((w) => w.full), []);

  // Sort slots by time of day (12h + ampm -> comparable minutes)
  const slotSortKey = (slot) => {
    const h = Number(slot.hours) || 0;
    const m = slot.minutes ?? 0;
    const isPm = (slot.ampm || '').toUpperCase() === 'PM';
    const hour24 = isPm && h !== 12 ? h + 12 : !isPm && h === 12 ? 0 : h;
    return hour24 * 60 + m;
  };
  const sortSlotsByTime = (slots) =>
    [...slots].sort((a, b) => slotSortKey(a) - slotSortKey(b));

  // Assign tab: slots for viewDays that this driver is NOT assigned to
  const assignListItems = useMemo(() => {
    if (!selectedDriverId || viewDays.length === 0) return [];
    const assignedIds = new Set(
      driverSchedules.filter((s) => s.driver_id === selectedDriverId).map((s) => s.delivery_time_id)
    );
    console.log('🔍 Assign filter - Driver:', selectedDriverId.substring(0, 8));
    console.log('🔍 Assign filter - View days:', viewDays);
    console.log('🔍 Assign filter - All slots count:', allSlots.length);
    console.log('🔍 Assign filter - Already assigned:', assignedIds.size);
    
    const sortedDays = [...viewDays].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const items = [];
    sortedDays.forEach((dayName) => {
      const daySlots = allSlots.filter(
        (s) => s.day?.trim() === dayName && !assignedIds.has(s.id)
      );
      console.log(`🔍 Assign filter - ${dayName}: ${daySlots.length} available slots`);
      if (daySlots.length === 0) return;
      items.push({ type: 'header', day: dayName, key: `assign-header-${dayName}` });
      sortSlotsByTime(daySlots).forEach((slot) => {
        items.push({ type: 'slot', slot, key: `assign-slot-${slot.id}` });
      });
    });
    console.log('🔍 Assign filter - Total items:', items.length);
    return items;
  }, [allSlots, viewDays, selectedDriverId, driverSchedules, order]);

  // Unassign tab: slots this driver IS assigned to (from driver_schedules + allSlots)
  const unassignListItems = useMemo(() => {
    if (!selectedDriverId) return [];
    const assigned = driverSchedules.filter((s) => s.driver_id === selectedDriverId);
    const slotIds = assigned.map((s) => s.delivery_time_id);
    const slotMap = new Map(allSlots.map((s) => [s.id, s]));
    const slotsByDay = {};
    slotIds.forEach((id) => {
      const slot = slotMap.get(id);
      if (slot && slot.day) {
        const day = slot.day.trim();
        if (!slotsByDay[day]) slotsByDay[day] = [];
        slotsByDay[day].push(slot);
      }
    });
    const sortedDays = order.filter((d) => slotsByDay[d]?.length);
    const items = [];
    sortedDays.forEach((dayName) => {
      const daySlots = sortSlotsByTime(slotsByDay[dayName] || []);
      items.push({ type: 'header', day: dayName, key: `unassign-header-${dayName}` });
      daySlots.forEach((slot) => {
        items.push({ type: 'slot', slot, key: `unassign-slot-${slot.id}` });
      });
    });
    return items;
  }, [selectedDriverId, driverSchedules, allSlots, order]);

  const listItems = activeTab === 'assign' ? assignListItems : unassignListItems;
  const selectedSlotIds = activeTab === 'assign' ? selectedSlotIdsAssign : selectedSlotIdsUnassign;
  const toggleSlot = activeTab === 'assign' ? toggleSlotAssign : toggleSlotUnassign;

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId);

  const renderListHeader = () => (
    <>
      {/* Configuration Section */}
      <View
        className="mx-4 mt-4 p-4 rounded-2xl border-2"
        style={{
          backgroundColor: configIsModified ? '#FFFBEB' : '#FFFFFF',
          borderColor: configIsModified ? '#F59E0B' : '#E5E7EB',
        }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-lg font-bold text-gray-800">Schedule Configuration</Text>
          {currentConfig != null && (
            <Text className="text-xs text-gray-500">Live from DB</Text>
          )}
        </View>
        {configIsModified && (
          <View className="bg-amber-100 border border-amber-300 rounded-lg p-2 mb-3 flex-row items-center justify-between">
            <Text className="text-amber-800 text-xs font-medium">Modified (unsaved)</Text>
            <TouchableOpacity onPress={resetToLiveConfig} className="px-2 py-1 bg-amber-200 rounded">
              <Text className="text-amber-900 text-xs font-semibold">Reset to Live</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Driver Pace (Backend) */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-gray-700 mb-2">Driver Pace (Backend)</Text>
          <Text className="text-xs text-gray-500 mb-2">Controls how frequently drivers make deliveries</Text>
          <View className="flex-row gap-2">
            {[2, 3, 4].map((trips) => {
              const isLive = liveTrips !== null && trips === liveTrips;
              const isSelected = tripsPerHour === trips;
              const isDraft = isSelected && !isLive;
              return (
                <TouchableOpacity
                  key={trips}
                  onPress={() => setTripsPerHour(trips)}
                  className="flex-1 rounded-lg border-2 py-3"
                  style={{
                    backgroundColor: isSelected ? (isLive ? '#059669' : themeColors.purple) : '#F9FAFB',
                    borderColor: isLive && !isSelected ? '#059669' : isSelected ? 'transparent' : '#D1D5DB',
                  }}
                >
                  <View className="flex-row items-center justify-center gap-1">
                    <Text
                      className={`text-center font-semibold ${isSelected ? 'text-white' : 'text-gray-700'}`}
                    >
                      {trips} trips/hr
                    </Text>
                    {isLive && (
                      <Text className={`text-xs ${isSelected ? 'text-white' : 'text-green-600'}`}>● Live</Text>
                    )}
                  </View>
                  <Text
                    className={`text-center text-xs mt-1 ${isSelected ? 'text-white opacity-90' : 'text-gray-500'}`}
                  >
                    {trips === 2 ? '30 min' : trips === 3 ? '20 min' : '15 min'} slots
                  </Text>
                  {isDraft && (
                    <Text className="text-center text-xs mt-0.5 text-amber-200">Unsaved</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Customer Window (Frontend) */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-gray-700 mb-2">Customer Time Blocks (Frontend)</Text>
          <Text className="text-xs text-gray-500 mb-2">What customers see when selecting delivery time</Text>
          <View className="flex-row gap-2">
            {[
              { value: 60, label: 'Hourly', sublabel: '1 Hour' },
              { value: 30, label: 'Precise', sublabel: '30 Mins' }
            ].map((option) => {
              const isLive = liveInterval !== null && option.value === liveInterval;
              const isSelected = customerInterval === option.value;
              const isDraft = isSelected && !isLive;
              return (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => setCustomerInterval(option.value)}
                  className="flex-1 rounded-lg border-2 py-3"
                  style={{
                    backgroundColor: isSelected ? (isLive ? '#059669' : themeColors.purple) : '#F9FAFB',
                    borderColor: isLive && !isSelected ? '#059669' : isSelected ? 'transparent' : '#D1D5DB',
                  }}
                >
                  <View className="flex-row items-center justify-center gap-1">
                    <Text
                      className={`text-center font-semibold ${isSelected ? 'text-white' : 'text-gray-700'}`}
                    >
                      {option.label}
                    </Text>
                    {isLive && (
                      <Text className={`text-xs ${isSelected ? 'text-white' : 'text-green-600'}`}>● Live</Text>
                    )}
                  </View>
                  <Text
                    className={`text-center text-xs mt-1 ${isSelected ? 'text-white opacity-90' : 'text-gray-500'}`}
                  >
                    {option.sublabel}
                  </Text>
                  {isDraft && (
                    <Text className="text-center text-xs mt-0.5 text-amber-200">Unsaved</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Preview */}
        <View className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
          <Text className="text-xs text-blue-800">
            <Text className="font-semibold">Preview: </Text>
            Drivers will have {getSlotIntervalText()} slots, but Customers will see {getWindowText()} windows
          </Text>
        </View>

        {/* Apply Button */}
        <TouchableOpacity
          onPress={handleUpdateConfig}
          disabled={configLoading}
          className={`py-3 rounded-lg ${configLoading ? 'bg-gray-400' : 'bg-green-600'}`}
        >
          {configLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-center text-white font-semibold">Apply Configuration & Regenerate Slots</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Current Schedule Overview */}
      <View className="bg-white mx-4 mt-4 p-4 rounded-2xl border border-gray-200">
        <Text className="text-base font-bold text-gray-800 mb-3">Current Schedule Overview</Text>
        <Text className="text-xs text-gray-500 mb-3">Slots filled = at least one rider assigned</Text>
        <View className="flex-row flex-wrap gap-2">
          {scheduleOverviewByDay.map(({ day, total, filled }) => (
            <View
              key={day}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50"
              style={{ minWidth: '45%' }}
            >
              <Text className="text-sm font-semibold text-gray-800">{day}</Text>
              <Text className="text-xs text-gray-600 mt-0.5">
                {filled}/{total} slots filled
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Deliverer selector */}
      <View className="bg-white mx-4 mt-4 p-4 rounded-2xl border border-gray-100">
        <Text className="text-sm font-semibold text-gray-700 mb-2">Deliverer</Text>
        {drivers.length === 0 ? (
          <View className="border border-amber-200 rounded-lg p-3 bg-amber-50">
            <Text className="text-amber-800 text-sm">No deliverers found. Add users with role "deliverer".</Text>
          </View>
        ) : (
          <>
            <View className="flex-row items-center border border-gray-300 rounded-lg px-3 py-2 mb-2 bg-gray-50">
              <Icon.Search stroke="#9CA3AF" width={20} height={20} />
              <TextInput
                placeholder="Search by name or email..."
                placeholderTextColor="#9CA3AF"
                value={driverSearchQuery}
                onChangeText={setDriverSearchQuery}
                className="flex-1 ml-2 text-base text-gray-900"
              />
              {driverSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setDriverSearchQuery('')}>
                  <Icon.X stroke="#6B7280" width={20} height={20} />
                </TouchableOpacity>
              )}
            </View>
            {selectedDriver && (
              <View className="mb-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30">
                <Text className="text-xs text-gray-600">Selected</Text>
                <Text className="font-semibold text-gray-900">{selectedDriver.name || selectedDriver.email}</Text>
              </View>
            )}
            <View style={{ maxHeight: 160 }}>
              {filteredDrivers.map((driver) => (
                <TouchableOpacity
                  key={driver.id}
                  onPress={() => setSelectedDriverId(driver.id)}
                  className={`flex-row items-center justify-between p-2.5 rounded-lg mb-1 ${
                    selectedDriverId === driver.id ? 'bg-primary' : 'bg-gray-100'
                  }`}
                >
                  <Text className={`font-medium ${selectedDriverId === driver.id ? 'text-white' : 'text-gray-900'}`}>
                    {driver.name || driver.email}
                  </Text>
                  {selectedDriverId === driver.id && <Icon.Check stroke="white" width={18} height={18} />}
                </TouchableOpacity>
              ))}
              {filteredDrivers.length === 0 && (
                <Text className="text-gray-500 text-center py-3 text-sm">No match</Text>
              )}
            </View>
          </>
        )}
      </View>

      {/* Tabs */}
      <View className="flex-row mx-4 mt-4 border-b border-gray-200 bg-white rounded-t-2xl overflow-hidden">
        <TouchableOpacity
          onPress={() => setActiveTab('assign')}
          className={`flex-1 py-3 ${activeTab === 'assign' ? 'border-b-2 border-primary bg-primary/5' : ''}`}
        >
          <Text
            className={`text-center font-semibold ${activeTab === 'assign' ? 'text-primary' : 'text-gray-500'}`}
          >
            Assign
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('unassign')}
          className={`flex-1 py-3 ${activeTab === 'unassign' ? 'border-b-2 border-primary bg-primary/5' : ''}`}
        >
          <Text
            className={`text-center font-semibold ${activeTab === 'unassign' ? 'text-primary' : 'text-gray-500'}`}
          >
            Unassign
          </Text>
        </TouchableOpacity>
      </View>

      {/* Assign tab: view days filter + available slots */}
      {activeTab === 'assign' && (
        <View className="bg-white mx-4 px-4 pt-3 pb-2 border-x border-b border-gray-200">
          <Text className="text-xs text-gray-600 mb-2">Show available slots for:</Text>
          <View className="flex-row flex-wrap gap-2">
            {WEEKDAYS.map(({ short: label, full }) => {
              const isSelected = viewDays.includes(full);
              return (
                <TouchableOpacity
                  key={full}
                  onPress={() => toggleViewDay(full)}
                  className={`px-3 py-1.5 rounded-lg ${isSelected ? 'bg-gray-800' : 'bg-gray-100'}`}
                >
                  <Text className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-gray-600'}`}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Icon.ArrowLeft stroke={themeColors.text} width={24} height={24} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-800">Rider Scheduler</Text>
        <TouchableOpacity onPress={onRefresh} className="p-2">
          <Icon.RefreshCw stroke={themeColors.text} width={24} height={24} />
        </TouchableOpacity>
      </View>

      <FlatList
        className="flex-1 bg-gray-50"
        data={listItems}
        keyExtractor={(item) => item.key}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={
          !selectedDriverId ? (
            <View className="py-12 mx-4">
              <Text className="text-center text-gray-500">Select a deliverer above</Text>
            </View>
          ) : activeTab === 'assign' && viewDays.length === 0 ? (
            <View className="py-12 mx-4">
              <Text className="text-center text-gray-500">Select days to see available slots</Text>
            </View>
          ) : listItems.length === 0 ? (
            <View className="py-12 mx-4">
              <Text className="text-center text-gray-500">
                {activeTab === 'assign' ? 'No available slots for selected days' : 'No assigned slots'}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return (
              <View className="mx-4 mt-4 mb-1">
                <Text className="text-base font-bold text-gray-800">{item.day}</Text>
              </View>
            );
          }
          const slot = item.slot;
          const slotTimeLabel = `${slot.hours}:${(slot.minutes ?? 0).toString().padStart(2, '0')} ${slot.ampm}`;
          const isSelected = selectedSlotIds.includes(slot.id);
          const statusInfo = getSlotStatus(slot.max_capacity_lu);
          const driverCount = driverSchedules.filter((s) => s.delivery_time_id === slot.id).length;
          const driversForSlot = getDriversForSlot(slot.id);

          return (
            <TouchableOpacity
              onPress={() => toggleSlot(slot.id, slot.day?.trim())}
              activeOpacity={0.7}
              className="mx-4 mb-2 flex-row items-center border border-gray-200 rounded-xl p-3 bg-white"
              style={{ borderLeftWidth: 4, borderLeftColor: isSelected ? themeColors.bgColor(1) : statusInfo.color }}
            >
              <View className="mr-3">
                {isSelected ? (
                  <Icon.CheckCircle stroke={themeColors.bgColor(1)} fill={themeColors.bgColor(1)} width={24} height={24} />
                ) : (
                  <Icon.Circle stroke="#9CA3AF" width={24} height={24} />
                )}
              </View>
              <View className="flex-1">
                <Text className="font-semibold text-gray-800">{slotTimeLabel}</Text>
                <Text className="text-xs text-gray-600 mt-0.5">
                  {slot.max_capacity_lu ?? 0} LU · {driverCount} rider{driverCount !== 1 ? 's' : ''}
                  {driverCount > 0 ? ` · ${driversForSlot}` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <>
            {listItems.length > 0 && selectedDriverId && (
              <View className="mx-4 mt-4 mb-2">
                <TouchableOpacity
                  onPress={activeTab === 'assign' ? handleAssignToSlots : handleUnassignFromSlots}
                  disabled={actionLoading || selectedSlotIds.length === 0}
                  style={{ backgroundColor: actionLoading || selectedSlotIds.length === 0 ? '#9CA3AF' : themeColors.bgColor(1) }}
                  className="py-4 rounded-xl"
                >
                  {actionLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white text-center font-bold">
                      {activeTab === 'assign'
                        ? `Assign to ${selectedSlotIds.length} selected`
                        : `Remove from ${selectedSlotIds.length} selected`}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
            <View className="h-8" />
          </>
        }
      />
    </SafeAreaView>
  );
}
