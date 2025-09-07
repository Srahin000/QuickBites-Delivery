import { View, Text, TouchableOpacity} from 'react-native'
import React from 'react'
import AddRestaurant from '../../components/addRestaurant'
import { useNavigation } from '@react-navigation/core';
import * as Icon from "react-native-feather";
import { themeColors } from '../../theme'

export default function AddRestaurantsScreen() {
    const navigation = useNavigation();
  return (
    <View className = "flex-col bg-white justify-center">
        <View className="bg-primary py-10 px-5">
            <Text className="text-white text-3xl font-bold text-center pt-5">Add Restaurant</Text>
        </View>
        <TouchableOpacity className = "absolute top-14 left-4 p-2 bg-gray-50 rounded-full shadow"
                        onPress = {() => navigation.goBack()}>
                        <Icon.ArrowLeft strokeWidth ={3} stroke = {themeColors.bgColor(1)}/>
        </TouchableOpacity>
      <AddRestaurant/>
    </View>
  )
}