import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import * as Icon from 'react-native-feather';
import { themeColors } from '../theme';

export default function CustomizationModal({ 
  visible, 
  onClose, 
  customizationData, 
  initialSelections = {},
  onConfirm 
}) {
  const [selectedCustomizations, setSelectedCustomizations] = useState(initialSelections);
  const [totalPrice, setTotalPrice] = useState(customizationData?.base_price || 0);

  // Utility function to capitalize first letter
  const capitalizeText = (text) => {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  };

  useEffect(() => {
    if (visible) {
      setSelectedCustomizations(initialSelections);
      setTotalPrice(customizationData?.base_price || 0);
      
      // If no initial selections and all values are numbers, select "regular" by default
      if (Object.keys(initialSelections).length === 0 && customizationData?.customizations) {
        const allValuesAreNumbers = Object.values(customizationData.customizations).every(v => typeof v === 'number');
        if (allValuesAreNumbers) {
          // For single-choice groups like chips, select "regular" if available
          const regularKey = Object.keys(customizationData.customizations).find(key => 
            key.toLowerCase().includes('regular')
          );
          if (regularKey) {
            setSelectedCustomizations({ [regularKey]: true });
          }
        }
      }
    }
  }, [visible, initialSelections, customizationData]);

  useEffect(() => {
    calculateTotalPrice();
  }, [selectedCustomizations]);

  const calculateTotalPrice = () => {
    if (!customizationData) {
      setTotalPrice(0);
      return;
    }
    
    let total = customizationData.base_price || 0;
    
    Object.entries(selectedCustomizations).forEach(([key, value]) => {
      if (value === true) {
        // Handle main item selection (e.g., "Base_Brown Rice": true)
        const [categoryKey, itemKey] = key.split('_');
        if (customizationData.customizations[categoryKey] && customizationData.customizations[categoryKey][itemKey]) {
          const itemValue = customizationData.customizations[categoryKey][itemKey];
          if (typeof itemValue === 'number') {
            total += itemValue;
          }
        }
      } else if (typeof value === 'string' && key.includes('_option')) {
        // Handle sub-option selection (e.g., "Base_Brown Rice_option": "regular")
        const [categoryKey, itemKey] = key.replace('_option', '').split('_');
        if (customizationData.customizations[categoryKey] && 
            customizationData.customizations[categoryKey][itemKey] &&
            typeof customizationData.customizations[categoryKey][itemKey] === 'object') {
          const subValue = customizationData.customizations[categoryKey][itemKey][value];
          if (subValue !== undefined) {
            total += subValue;
          }
        }
      }
    });
    
    setTotalPrice(total);
  };

  const handleCustomizationChange = (key, value) => {
    setSelectedCustomizations(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleConfirm = () => {
    // Check if at least one customization is selected
    const hasSelection = Object.values(selectedCustomizations).some(value => 
      value === true || (typeof value === 'string' && value !== null && value !== '')
    );
    
    if (!hasSelection) {
      Alert.alert('Selection Required', 'Please select at least one option before proceeding.');
      return;
    }
    
    // Check if total price is greater than 0 (meaning something was actually selected with value)
    if (totalPrice <= 0) {
      Alert.alert('Selection Required', 'Please select at least one option with a value before proceeding.');
      return;
    }
    
    onConfirm(selectedCustomizations, totalPrice);
    onClose();
  };

  const renderCustomizationOptions = () => {
    if (!customizationData || !customizationData.customizations) return null;

    return Object.entries(customizationData.customizations).map(([categoryKey, categoryValue]) => {
      // Check if this category allows multiple selections
      const isMultipleSelection = categoryValue.Selection === "multiple";
      
      return (
        <View key={categoryKey} className="mb-8">
          <Text className="text-xl font-bold text-gray-800 mb-4">{capitalizeText(categoryKey)}</Text>
          
          {Object.entries(categoryValue).map(([itemKey, itemValue]) => {
            // Skip the "Selection" property
            if (itemKey === "Selection") return null;
            if (typeof itemValue === 'number') {
              // Simple item (e.g., "Guacamole": 2.95)
              const isSelected = selectedCustomizations[`${categoryKey}_${itemKey}`];
              return (
                <TouchableOpacity
                  key={`${categoryKey}_${itemKey}`}
                  onPress={() => {
                    if (!isSelected) {
                      // For single selection categories, deselect other items in the same category first
                      if (!isMultipleSelection) {
                        // Clear all other selections in this category
                        Object.keys(categoryValue).forEach(otherItemKey => {
                          if (otherItemKey !== itemKey && otherItemKey !== "Selection") {
                            handleCustomizationChange(`${categoryKey}_${otherItemKey}`, false);
                            handleCustomizationChange(`${categoryKey}_${otherItemKey}_option`, null);
                          }
                        });
                      }
                    }
                    handleCustomizationChange(`${categoryKey}_${itemKey}`, !isSelected);
                  }}
                  className={`p-4 rounded-xl border-2 mb-3 ${
                    isSelected ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className={`text-base font-medium ${
                      isSelected ? 'text-green-700' : 'text-gray-700'
                    }`}>
                      {capitalizeText(itemKey)}
                    </Text>
                    <View className="flex-row items-center">
                      {itemValue > 0 && (
                        <Text className={`text-sm font-semibold mr-2 ${
                          isSelected ? 'text-green-600' : 'text-gray-500'
                        }`}>
                          +${itemValue.toFixed(2)}
                        </Text>
                      )}
                      <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                        isSelected ? 'border-green-500 bg-green-500' : 'border-gray-300'
                      }`}>
                        {isSelected && <Icon.Check size={16} color="white" />}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            } else if (typeof itemValue === 'object') {
              // Nested item (e.g., "Brown Rice": {"extra": 0, "light": 0, "regular": 0})
              const isItemSelected = selectedCustomizations[`${categoryKey}_${itemKey}`];
              const selectedSubOption = selectedCustomizations[`${categoryKey}_${itemKey}_option`];
              
              return (
                <View key={`${categoryKey}_${itemKey}`} className="mb-4">
                  {/* Main Item Selection */}
                  <TouchableOpacity
                    onPress={() => {
                      if (isItemSelected) {
                        // Deselect item and clear sub-option
                        handleCustomizationChange(`${categoryKey}_${itemKey}`, false);
                        handleCustomizationChange(`${categoryKey}_${itemKey}_option`, null);
                      } else {
                        // For single selection categories, deselect other items in the same category first
                        if (!isMultipleSelection) {
                          // Clear all other selections in this category
                          Object.keys(categoryValue).forEach(otherItemKey => {
                            if (otherItemKey !== itemKey && otherItemKey !== "Selection") {
                              handleCustomizationChange(`${categoryKey}_${otherItemKey}`, false);
                              handleCustomizationChange(`${categoryKey}_${otherItemKey}_option`, null);
                            }
                          });
                        }
                        
                        // Select item and set default sub-option
                        handleCustomizationChange(`${categoryKey}_${itemKey}`, true);
                        // Always default to "regular" if available, otherwise first option
                        const defaultOption = Object.keys(itemValue).includes('regular') 
                          ? 'regular' 
                          : Object.keys(itemValue)[0];
                        handleCustomizationChange(`${categoryKey}_${itemKey}_option`, defaultOption);
                      }
                    }}
                    className={`p-4 rounded-xl border-2 mb-2 ${
                      isItemSelected ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className={`text-base font-medium ${
                        isItemSelected ? 'text-green-700' : 'text-gray-700'
                      }`}>
                        {capitalizeText(itemKey)}
                      </Text>
                      <View className="flex-row items-center">
                        <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                          isItemSelected ? 'border-green-500 bg-green-500' : 'border-gray-300'
                        }`}>
                          {isItemSelected && <Icon.Check size={16} color="white" />}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                  
                  {/* Sub-options (only show if main item is selected) */}
                  {isItemSelected && (
                    <View className="ml-4 mt-2">
                      {Object.keys(itemValue).length > 3 ? (
                        // Vertical layout for more than 4 options
                        <View className="space-y-2">
                          {Object.entries(itemValue).map(([subKey, subValue]) => {
                            const isSubSelected = selectedSubOption === subKey;
                            return (
                              <TouchableOpacity
                                key={`${categoryKey}_${itemKey}_${subKey}`}
                                onPress={() => handleCustomizationChange(`${categoryKey}_${itemKey}_option`, subKey)}
                                className={`p-3 rounded-lg border ${
                                  isSubSelected ? 'border-purple-500 bg-purple-100' : 'border-gray-300 bg-gray-100'
                                }`}
                              >
                                <View className="flex-row items-center justify-between">
                                  <Text className={`text-sm font-medium ${
                                    isSubSelected ? 'text-purple-700' : 'text-gray-600'
                                  }`}>
                                    {capitalizeText(subKey)}
                                  </Text>
                                  {subValue > 0 && (
                                    <Text className={`text-sm font-semibold ${
                                      isSubSelected ? 'text-purple-600' : 'text-gray-500'
                                    }`}>
                                      +${subValue.toFixed(2)}
                                    </Text>
                                  )}
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ) : (
                        // Horizontal layout for 4 or fewer options
                        <View className="flex-row space-x-2">
                          {Object.entries(itemValue).map(([subKey, subValue]) => {
                            const isSubSelected = selectedSubOption === subKey;
                            return (
                              <TouchableOpacity
                                key={`${categoryKey}_${itemKey}_${subKey}`}
                                onPress={() => handleCustomizationChange(`${categoryKey}_${itemKey}_option`, subKey)}
                                className={`px-3 py-2 rounded-lg border ${
                                  isSubSelected ? 'border-purple-500 bg-purple-100' : 'border-gray-300 bg-gray-100'
                                }`}
                              >
                                <View className="flex-row items-center">
                                  <Text className={`text-xs font-medium ${
                                    isSubSelected ? 'text-purple-700' : 'text-gray-600'
                                  }`}>
                                    {capitalizeText(subKey)}
                                  </Text>
                                  {subValue > 0 && (
                                    <Text className={`text-xs font-semibold ml-1 ${
                                      isSubSelected ? 'text-purple-600' : 'text-gray-500'
                                    }`}>
                                      +${subValue.toFixed(2)}
                                    </Text>
                                  )}
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            }
            return null;
          })}
        </View>
      );
    });
  };

  const getSelectedSummary = () => {
    const selections = [];
    const processedItems = new Set();
    
    Object.entries(selectedCustomizations).forEach(([key, value]) => {
      if (value === true && !key.includes('_option')) {
        // Main item selection
        const [categoryKey, itemKey] = key.split('_');
        const optionKey = `${categoryKey}_${itemKey}_option`;
        const selectedOption = selectedCustomizations[optionKey];
        
        if (selectedOption) {
          selections.push(`${capitalizeText(itemKey)}: ${capitalizeText(selectedOption)}`);
        } else {
          selections.push(capitalizeText(itemKey));
        }
        processedItems.add(key);
      }
    });
    
    return selections;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
          <TouchableOpacity onPress={onClose}>
            <Icon.X size={24} color="#374151" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-800">Customize Your Order</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Content */}
        <ScrollView className="flex-1 p-4">
          {renderCustomizationOptions()}
          
          {/* Selected Items Summary */}
          {getSelectedSummary().length > 0 && (
            <View className="mt-6 p-4 bg-gray-50 rounded-xl">
              <Text className="text-base font-semibold text-gray-800 mb-2">Selected Customizations:</Text>
              {getSelectedSummary().map((selection, index) => (
                <Text key={index} className="text-sm text-gray-600">• {selection}</Text>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View className="p-4 border-t border-gray-200 bg-white">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-gray-800">Total Price:</Text>
            <Text className="text-xl font-bold" style={{ color: themeColors.bgColor2 }}>
              ${(totalPrice || 0).toFixed(2)}
            </Text>
          </View>
          
          <TouchableOpacity
            onPress={handleConfirm}
            className="py-4 rounded-xl items-center"
            style={{ backgroundColor: themeColors.bgColor2 }}
          >
            <Text className="text-white text-lg font-semibold">Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
