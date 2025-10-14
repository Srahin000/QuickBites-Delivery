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

const TimeSlotModal = ({ visible, onClose, onTimeSelected, restaurantId }) => {
  const [timeSlots, setTimeSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState(null);

  // Get today's actual day
  const today = new Date();
  const todayDay = today.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Use the actual current day instead of hardcoded Monday
  const currentDay = todayDay;
  
  // Check if today is a delivery day (weekdays)
  const isDeliveryDay = today.getDay() >= 1 && today.getDay() <= 5;

  useEffect(() => {
    if (visible) {
      fetchTimeSlots();
    }
  }, [visible]);

  const fetchTimeSlots = async () => {
    setLoading(true);
    try {
      // Fetch time slots for the current day
      const { data, error } = await supabase
        .from('delivery_times')
        .select('*')
        .eq('day', currentDay)
        .order('hours', { ascending: true });

      if (error) {
        console.error('❌ Error fetching time slots:', error);
        Alert.alert('Error', 'Failed to load available time slots: ' + error.message);
        return;
      }

      // Filter out past time slots for today
      const currentTime = new Date();
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();
      
      const availableSlots = (data || []).filter(slot => {
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
        
        const isFuture = hour > currentHour || (hour === currentHour && minute > currentMinute);
        return isFuture;
      });
      setTimeSlots(availableSlots);
    } catch (error) {
      console.error('Error fetching time slots:', error);
      Alert.alert('Error', 'Something went wrong while loading time slots');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeSelect = (timeSlot) => {
    if (timeSlot.counter >= 10) {
      Alert.alert('Slot Full', 'This time slot is currently full. Please select another time.');
      return;
    }
    setSelectedTime(timeSlot);
  };

  const handleConfirm = async () => {
    if (!selectedTime) {
      Alert.alert('No Time Selected', 'Please select a delivery time');
      return;
    }

    try {
      // Just call the callback with selected time - counter will be incremented after payment
      onTimeSelected(selectedTime);
      onClose();
    } catch (error) {
      console.error('Error confirming time slot:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const formatTime = (timeSlot) => {
    const hour = timeSlot.hours;
    const minute = timeSlot.minutes ? timeSlot.minutes.toString().padStart(2, '0') : '00';
    const ampm = timeSlot.ampm;
    return `${hour}:${minute} ${ampm}`;
  };

  const getSlotStatus = (timeSlot) => {
    if (timeSlot.counter >= 10) {
      return { status: 'full', color: '#EF4444', text: 'Full' };
    } else if (timeSlot.counter >= 8) {
      return { status: 'almost-full', color: '#F59E0B', text: 'Almost Full' };
    } else {
      return { status: 'available', color: '#10B981', text: 'Available' };
    }
  };

  const renderTimeSlot = ({ item }) => {
    const slotStatus = getSlotStatus(item);
    const isSelected = selectedTime?.id === item.id;
    const isDisabled = item.counter >= 10;

    return (
      <TouchableOpacity
        onPress={() => handleTimeSelect(item)}
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
              {formatTime(item)}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: slotStatus.color }]}>
              <Text style={styles.statusText}>{slotStatus.text}</Text>
            </View>
          </View>
          <View style={styles.counterInfo}>
            <Text style={[
              styles.counterText,
              isSelected && styles.selectedCounterText,
              isDisabled && styles.disabledCounterText
            ]}>
              {item.counter}/10 orders
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
        ) : timeSlots.length === 0 ? (
          <View style={styles.noDeliveryContainer}>
            <Icon.Clock size={64} color="#9CA3AF" />
            <Text style={styles.noDeliveryTitle}>No Time Slots Available</Text>
            <Text style={styles.noDeliveryText}>
              All delivery time slots for today have passed.
              {'\n'}Please check back tomorrow for available time slots.
            </Text>
          </View>
        ) : (
          <FlatList
            data={timeSlots}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderTimeSlot}
            contentContainerStyle={styles.timeSlotsList}
            showsVerticalScrollIndicator={false}
          />
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
              {!isDeliveryDay ? 'No deliveries today' : selectedTime ? `Confirm ${formatTime(selectedTime)}` : 'Select a time'}
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
});

export default TimeSlotModal;
