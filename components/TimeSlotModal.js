import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet
} from 'react-native';
import { themeColors } from '../theme';
import * as Icon from 'react-native-feather';
import supabase from '../supabaseClient';

const TimeSlotModal = ({ visible, onClose, onTimeSelected, restaurantId, timeOverride = false }) => {
  const [timeSlots, setTimeSlots] = useState([]);
  const [groupedWindows, setGroupedWindows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState(null);

  // Get today's actual day
  const today = new Date();
  const todayDay = today.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Use the actual current day instead of hardcoded Monday
  const currentDay = todayDay;
  
  // Check if today is a delivery day (weekdays) - but override if timeOverride is enabled
  const isDeliveryDay = timeOverride || (today.getDay() >= 1 && today.getDay() <= 5);

  useEffect(() => {
    if (visible) {
      fetchTimeSlots();
    }
  }, [visible]);

  const fetchTimeSlots = async () => {
    setLoading(true);
    try {
      console.log(`[TimeSlotModal] Querying for day: "${currentDay}"`);
      
      // Fetch time slots for the current day (try with TRIM to handle trailing spaces)
      const { data, error } = await supabase
        .from('delivery_times')
        .select('*')
        .order('hours', { ascending: true });

      if (error) {
        console.error('❌ Error fetching time slots:', error);
        Alert.alert('Error', 'Failed to load available time slots: ' + error.message);
        return;
      }

      console.log(`[TimeSlotModal] Total slots in database: ${data?.length || 0}`);
      
      // Filter for current day (with trim to handle spaces)
      let todaySlots = (data || []).filter(slot => slot.day.trim() === currentDay);
      // Only show slots that have at least one deliverer assigned (rider-powered availability)
      todaySlots = todaySlots.filter(slot => (slot.max_capacity_lu ?? 0) > 0);
      console.log(`[TimeSlotModal] Slots for ${currentDay} (with deliverer): ${todaySlots.length}`);
      
      if (todaySlots.length === 0) {
        console.log('[TimeSlotModal] ⚠️ No slots found for today!');
        console.log('[TimeSlotModal] Available days in database:', [...new Set(data.map(s => `"${s.day}"`))].join(', '));
      }

      // Filter out past time slots for today
      const currentTime = new Date();
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();
      
      console.log(`[TimeSlotModal] Current time: ${currentHour}:${currentMinute.toString().padStart(2, '0')} (${currentHour * 60 + currentMinute} minutes from midnight)`);
      
      const availableSlots = todaySlots.filter(slot => {
        // Use the hours, minutes, ampm columns
        let hour = parseInt(slot.hours);
        const minute = slot.minutes ? parseInt(slot.minutes) : 0;
        const isPM = slot.ampm === 'PM';
        
        // Convert to 24-hour format for comparison
        if (isPM && hour !== 12) {
          hour += 12;
        } else if (!isPM && hour === 12) {
          hour = 0;
        }
        
        // Calculate time difference in minutes
        const slotMinutes = hour * 60 + minute;
        const currentMinutes = currentHour * 60 + currentMinute;
        const timeDifference = slotMinutes - currentMinutes;
        
        console.log(`[TimeSlotModal] Slot: ${slot.hours}:${minute.toString().padStart(2, '0')} ${slot.ampm} → 24h: ${hour}:${minute.toString().padStart(2, '0')} (${slotMinutes} min from midnight) - Diff: ${timeDifference} min`);
        
        // Filter out past times (negative time difference)
        if (timeDifference < 0) {
          console.log(`[TimeSlotModal] ❌ Filtered: Past time`);
          return false;
        }
        
        // Hide slots that are less than 1 hour and 45 minutes away (105 minutes)
        const shouldShow = timeDifference >= 105; // 105 minutes = 1 hour 45 minutes
        console.log(`[TimeSlotModal] ${shouldShow ? '✅' : '❌'} ${shouldShow ? 'AVAILABLE' : 'Too soon'} (need 105 min buffer, have ${timeDifference} min)`);
        
        return shouldShow;
      });
      
      console.log(`[TimeSlotModal] 📊 Summary: ${todaySlots.length} total today → ${availableSlots.length} available after filtering`);
      setTimeSlots(availableSlots);
      
      // Group slots by customer_window_label for customer-facing hourly view
      const grouped = {};
      availableSlots.forEach(slot => {
        const label = slot.customer_window_label || `${slot.hours}:${(slot.minutes || 0).toString().padStart(2, '0')} ${slot.ampm}`;
        if (!grouped[label]) {
          grouped[label] = {
            label,
            slots: [],
            earliestSlot: slot,
            totalCapacity: 0,
            currentLoad: 0
          };
        }
        grouped[label].slots.push(slot);
        grouped[label].totalCapacity += (slot.max_capacity_lu || 0);
        grouped[label].currentLoad += (slot.current_load_lu || 0);
      });
      
      // Convert to array and sort by earliest slot time
      const windowsArray = Object.values(grouped).sort((a, b) => {
        const aSlot = a.earliestSlot;
        const bSlot = b.earliestSlot;
        let aHour = parseInt(aSlot.hours);
        let bHour = parseInt(bSlot.hours);
        const aMinute = parseInt(aSlot.minutes || 0);
        const bMinute = parseInt(bSlot.minutes || 0);
        
        if (aSlot.ampm === 'PM' && aHour !== 12) aHour += 12;
        if (bSlot.ampm === 'PM' && bHour !== 12) bHour += 12;
        if (aSlot.ampm === 'AM' && aHour === 12) aHour = 0;
        if (bSlot.ampm === 'AM' && bHour === 12) bHour = 0;
        
        const aTotal = aHour * 60 + aMinute;
        const bTotal = bHour * 60 + bMinute;
        return aTotal - bTotal;
      });
      
      console.log(`[TimeSlotModal] 📊 Grouped into ${windowsArray.length} customer windows`);
      setGroupedWindows(windowsArray);
    } catch (error) {
      console.error('Error fetching time slots:', error);
      Alert.alert('Error', 'Something went wrong while loading time slots');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeSelect = (window) => {
    // Store the customer window label, not a specific slot
    // The backend will assign to earliest available slot within this window
    setSelectedTime(window);
  };

  const handleConfirm = async () => {
    if (!selectedTime) {
      Alert.alert('No Time Selected', 'Please select a delivery time');
      return;
    }
    
    // Pass the customer window back to parent
    // The parent/backend will find earliest slot within this window
    onTimeSelected({
      customerWindowLabel: selectedTime.label,
      earliestSlot: selectedTime.earliestSlot, // For display purposes
      availableCapacity: selectedTime.totalCapacity - selectedTime.currentLoad
    });
    setSelectedTime(null);
    onClose();
  };

  const formatTime = (timeSlot) => {
    const hour = timeSlot.hours;
    const minute = timeSlot.minutes ? timeSlot.minutes.toString().padStart(2, '0') : '00';
    const ampm = timeSlot.ampm;
    return `${hour}:${minute} ${ampm}`;
  };

  const getWindowStatus = (window) => {
    const availableCapacity = window.totalCapacity - window.currentLoad;
    const utilizationPercent = (window.currentLoad / window.totalCapacity) * 100;
    
    if (availableCapacity <= 0 || window.totalCapacity === 0) {
      return { status: 'full', color: '#EF4444', text: 'Full' };
    } else if (utilizationPercent >= 75) {
      return { status: 'almost-full', color: '#F59E0B', text: 'Almost Full' };
    } else {
      return { status: 'available', color: '#10B981', text: 'Available' };
    }
  };

  const renderTimeWindow = ({ item: window }) => {
    const windowStatus = getWindowStatus(window);
    const isSelected = selectedTime?.label === window.label;
    const isDisabled = (window.totalCapacity - window.currentLoad) <= 0;
    const availableCapacity = window.totalCapacity - window.currentLoad;

    return (
      <TouchableOpacity
        onPress={() => handleTimeSelect(window)}
        disabled={isDisabled}
        style={[
          styles.timeSlot,
          isSelected && styles.selectedTimeSlot,
          isDisabled && styles.disabledTimeSlot
        ]}
      >
        <View style={styles.timeSlotContent}>
          <View style={styles.timeInfo}>
            <Text style={[
              styles.timeText,
              isSelected && styles.selectedTimeText,
              isDisabled && styles.disabledTimeText
            ]}>
              {window.label}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: windowStatus.color }]}>
              <Text style={styles.statusText}>{windowStatus.text}</Text>
            </View>
          </View>
          <View style={styles.counterInfo}>
            <Text style={[
              styles.counterText,
              isSelected && styles.selectedCounterText,
              isDisabled && styles.disabledCounterText
            ]}>
              {window.slots.length} slot{window.slots.length !== 1 ? 's' : ''} • {availableCapacity.toFixed(1)} LU available
            </Text>
          </View>
        </View>
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Icon.Check size={20} color="white" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon.X size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Delivery Time</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Day Info */}
        <View style={styles.dayInfo}>
          <Text style={styles.dayText}>
            {isDeliveryDay ? `Available times for ${currentDay}` : 'No deliveries today'}
          </Text>
          <Text style={styles.subText}>
            {isDeliveryDay ? 'Choose your preferred delivery time slot' : 'Couriers are not doing deliveries today'}
          </Text>
        </View>

        {/* Time Slots List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.purple} />
            <Text style={styles.loadingText}>Loading available times...</Text>
          </View>
        ) : !isDeliveryDay ? (
          <View style={styles.noDeliveryContainer}>
            <Icon.Truck size={64} color="#9CA3AF" />
            <Text style={styles.noDeliveryTitle}>No Deliveries Today</Text>
            <Text style={styles.noDeliveryText}>
              Our couriers are not doing deliveries on {todayDay}. 
              {'\n'}Please check back on {currentDay} for available time slots.
            </Text>
          </View>
        ) : groupedWindows.length === 0 ? (
          <View style={styles.noDeliveryContainer}>
            <Icon.Clock size={64} color="#9CA3AF" />
            <Text style={styles.noDeliveryTitle}>No Time Slots Available</Text>
            <Text style={styles.noDeliveryText}>
              All delivery time slots for today have passed.
              {'\n'}Please check back tomorrow for available time slots.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.disclaimerBox}>
              <Icon.Info size={16} color="#6366F1" />
              <Text style={styles.disclaimerText}>
                Orders are scheduled within this hourly window and may arrive earlier depending on driver availability.
              </Text>
            </View>
            <FlatList
              data={groupedWindows}
              keyExtractor={(item) => item.label}
              renderItem={renderTimeWindow}
              contentContainerStyle={styles.timeSlotsList}
              showsVerticalScrollIndicator={false}
            />
          </>
        )}

        {/* Confirm Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={!selectedTime || !isDeliveryDay}
            style={[
              styles.confirmButton,
              (!selectedTime || !isDeliveryDay) && styles.disabledConfirmButton
            ]}
          >
            <Text style={[
              styles.confirmButtonText,
              (!selectedTime || !isDeliveryDay) && styles.disabledConfirmButtonText
            ]}>
              {!isDeliveryDay ? 'No deliveries today' : selectedTime ? `Confirm ${selectedTime.label}` : 'Select a time'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  dayInfo: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dayText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  subText: {
    fontSize: 14,
    color: '#6B7280',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  timeSlotsList: {
    padding: 20,
  },
  timeSlot: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  selectedTimeSlot: {
    borderColor: themeColors.purple,
    backgroundColor: '#F3F4F6',
  },
  disabledTimeSlot: {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
  },
  timeSlotContent: {
    padding: 16,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  selectedTimeText: {
    color: themeColors.purple,
  },
  disabledTimeText: {
    color: '#9CA3AF',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  counterInfo: {
    alignItems: 'flex-start',
  },
  counterText: {
    fontSize: 14,
    color: '#6B7280',
  },
  selectedCounterText: {
    color: themeColors.purple,
  },
  disabledCounterText: {
    color: '#9CA3AF',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: themeColors.purple,
    padding: 8,
    borderBottomLeftRadius: 8,
  },
  footer: {
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  confirmButton: {
    backgroundColor: themeColors.purple,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledConfirmButton: {
    backgroundColor: '#D1D5DB',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  disabledConfirmButtonText: {
    color: '#9CA3AF',
  },
  noDeliveryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noDeliveryTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  noDeliveryText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: '#4F46E5',
    lineHeight: 16,
  },
});

export default TimeSlotModal;
