import { View, Text, Image, TouchableOpacity, ScrollView } from 'react-native';
import React, { useEffect, useState } from 'react';
import { themeColors } from '../theme';
import * as Icon from "react-native-feather";
import { useCart } from '../context/CartContext';
import supabase from "../supabaseClient"

export default function DishRow({ item, restaurant }) {
  const { addToCart, removeFromCart, cartItems } = useCart();
  const [customizations, setCustomizations] = useState([]);
  const [selectedOptions, setSelectedOptions] = useState({});

  const currentItem = cartItems.find((cartItem) => cartItem.id === item.id);
  const quantity = currentItem?.quantity || 0;

  useEffect(() => {
    fetchCustomizations();
  }, []);

  const fetchCustomizations = async () => {
    const { data: groups, error: groupError } = await supabase
      .from('customization_groups')
      .select('id, name, is_required, max_choices')
      .eq('dish_id', item.id);

    if (groupError) {
      console.error("Group fetch error", groupError);
      return;
    }

    const groupIds = groups.map(g => g.id);
    const { data: options, error: optionError } = await supabase
      .from('customization_options')
      .select('id, group_id, name, price_delta');

    if (optionError) {
      console.error("Option fetch error", optionError);
      return;
    }

    // Attach options to their group
    const groupWithOptions = groups.map(group => ({
      ...group,
      options: options.filter(opt => opt.group_id === group.id)
    }));

    setCustomizations(groupWithOptions);
  };

  const handleSelectOption = (groupId, option) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [groupId]: option
    }));
  };

  const getTotalPrice = () => {
    const basePrice = item.price;
    const extras = Object.values(selectedOptions).reduce((sum, opt) => sum + (opt?.price_delta || 0), 0);
    return (basePrice + extras).toFixed(2);
  };

  const totalPrice = getTotalPrice();

  return (
    <View className="flex-row items-center bg-white p-3 rounded-3xl shadow-2xl mb-3 mx-2">
      <Image className="rounded-3xl" style={{ width: 100, height: 100 }} source={{ uri: item.image_url }} />

      <View className="flex flex-1 space-y-3">
        <View className="pl-3">
          <Text className="text-xl">{item.name}</Text>
          <Text className="text-gray-700">{item.description}</Text>
        </View>

        <ScrollView horizontal className="pl-3">
          {customizations.map(group => (
            <View key={group.id} className="mr-4">
              <Text className="text-xs font-semibold text-gray-700">{group.name}</Text>
              <View className="flex-row space-x-2 mt-1">
                {group.options.map(option => {
                  const selected = selectedOptions[group.id]?.id === option.id;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => handleSelectOption(group.id, option)}
                      className={`px-3 py-1 rounded-full border ${
                        selected ? 'bg-primary border-primary' : 'border-gray-300'
                      }`}
                    >
                      <Text className={`text-xs ${selected ? 'text-white' : 'text-gray-700'}`}>
                        {option.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        <View className="flex-row justify-between pl-3 items-center mt-2">
          <Text className="text-gray-700 text-lg font-bold">${totalPrice}</Text>
          <View className="flex-row items-center">
            <TouchableOpacity
              className="p-1 rounded-full"
              style={{ backgroundColor: themeColors.bgColor(1) }}
              onPress={() => removeFromCart(item)}
            >
              <Icon.Minus strokeWidth={2} height={20} width={20} stroke={'white'} />
            </TouchableOpacity>

            <Text className="px-3">{quantity}</Text>

            <TouchableOpacity
              className="p-1 rounded-full"
              style={{ backgroundColor: themeColors.bgColor(1) }}
              onPress={() => addToCart({ ...item, price: parseFloat(totalPrice), option: null }, restaurant)}
            >
              <Icon.Plus strokeWidth={2} height={20} width={20} stroke={'white'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}
