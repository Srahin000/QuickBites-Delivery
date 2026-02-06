import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const DEVICE_ID_KEY = '@quickbites_device_id';

/**
 * Get or create a unique device ID for this device
 * The ID persists across app restarts
 * @returns {Promise<string>} Unique device ID
 */
export async function getDeviceId() {
  try {
    // Try to get existing device ID from storage
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    
    if (deviceId) {
      return deviceId;
    }
    
    // Generate a new device ID if one doesn't exist
    deviceId = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${Date.now()}-${Math.random()}-${Math.random()}`
    );
    
    // Store it for future use
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    
    return deviceId;
  } catch (error) {
    console.error('Error getting/creating device ID:', error);
    // Fallback to a simple UUID-like string if crypto fails
    const fallbackId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    try {
      await AsyncStorage.setItem(DEVICE_ID_KEY, fallbackId);
    } catch (storageError) {
      console.error('Error storing fallback device ID:', storageError);
    }
    return fallbackId;
  }
}

/**
 * Clear the device ID (useful for testing or account switching)
 * @returns {Promise<void>}
 */
export async function clearDeviceId() {
  try {
    await AsyncStorage.removeItem(DEVICE_ID_KEY);
  } catch (error) {
    console.error('Error clearing device ID:', error);
  }
}


