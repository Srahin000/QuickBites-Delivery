import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { supabase } from '../supabaseClient';
import Icon from 'react-native-vector-icons/MaterialIcons';

const LocationModal = ({ visible, onClose, onLocationSelected, restaurantId }) => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  useEffect(() => {
    if (visible) {
      fetchLocations();
    }
  }, [visible]);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('delivery_locations')
        .select('*')
        .order('location', { ascending: true });

      if (error) {
        console.error('Error fetching locations:', error);
        Alert.alert('Error', 'Failed to load delivery locations: ' + error.message);
        return;
      }

      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
      Alert.alert('Error', 'Something went wrong while loading locations');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onLocationSelected(selectedLocation);
      onClose();
    }
  };

  const renderLocation = ({ item }) => {
    const isSelected = selectedLocation?.id === item.id;
    
    return (
      <TouchableOpacity
        style={[
          styles.timeSlot,
          isSelected && styles.selectedTimeSlot
        ]}
        onPress={() => handleLocationSelect(item)}
        disabled={false} // All locations are available
      >
        <View style={styles.timeSlotContent}>
          <View style={styles.timeInfo}>
            <Text style={[
              styles.timeText,
              isSelected && styles.selectedTimeText
            ]}>
              {item.location}
            </Text>
            {isSelected && (
              <View style={styles.statusBadge} backgroundColor="#8B5CF6">
                <Text style={styles.statusText}>Selected</Text>
              </View>
            )}
          </View>
          <View style={styles.counterInfo}>
            {item.address && (
              <Text style={[
                styles.counterText,
                isSelected && styles.selectedCounterText
              ]}>
                {item.address}
              </Text>
            )}
            {item.description && (
              <Text style={[
                styles.counterText,
                isSelected && styles.selectedCounterText
              ]}>
                {item.description}
              </Text>
            )}
          </View>
        </View>
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Icon name="check" size={16} color="white" />
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
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.title}>Select Delivery Location</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Location Info */}
        <View style={styles.dayInfo}>
          <Text style={styles.dayText}>
            Available delivery locations
          </Text>
          <Text style={styles.subText}>
            Choose your preferred delivery location
          </Text>
        </View>

        {/* Locations List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={styles.loadingText}>Loading locations...</Text>
          </View>
        ) : locations.length === 0 ? (
          <View style={styles.noDeliveryContainer}>
            <Icon name="location-off" size={64} color="#9CA3AF" />
            <Text style={styles.noDeliveryTitle}>No Locations Available</Text>
            <Text style={styles.noDeliveryText}>
              There are no delivery locations available at the moment.
            </Text>
          </View>
        ) : (
          <FlatList
            data={locations}
            renderItem={renderLocation}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.timeSlotsList}
          />
        )}

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.confirmButton,
              !selectedLocation && styles.disabledButton
            ]}
            onPress={handleConfirm}
            disabled={!selectedLocation}
          >
            <Text style={[
              styles.confirmButtonText,
              !selectedLocation && styles.disabledButtonText
            ]}>
              {selectedLocation ? `Confirm ${selectedLocation.location}` : 'Select a Location'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
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
  title: {
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
  noDeliveryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noDeliveryTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    textAlign: 'center',
  },
  noDeliveryText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 24,
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
    borderColor: '#8B5CF6',
    backgroundColor: '#F3F4F6',
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
    color: '#8B5CF6',
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
    color: '#8B5CF6',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#8B5CF6',
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
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#D1D5DB',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButtonText: {
    color: '#9CA3AF',
  },
});

export default LocationModal;
