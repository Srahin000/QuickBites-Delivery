import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import React from "react";
import { useNavigation } from "@react-navigation/native";
import * as Icon from "react-native-feather";
import { themeColors } from "../../theme";

export default function AdminScreen() {
  const navigation = useNavigation();

  return (
    <View className="flex-1 bg-gray-100">

      {/* Header Banner */}
      <View className="bg-primary py-6 px-5">
        <Text className="text-white text-2xl font-bold text-center">Hello, User</Text>
      </View>
      <TouchableOpacity className = "absolute top-14 left-4 p-2 bg-gray-50 rounded-full shadow"
                              onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}>
                              <Icon.Home strokeWidth ={3} stroke = {themeColors.bgColor(1)}/>
            </TouchableOpacity>

      {/* Scrollable Buttons */}
      <ScrollView contentContainerStyle={{ alignItems: "center", paddingVertical: 20 }}>
        <TouchableOpacity className="p-2" onPress={() => navigation.navigate("AddRestaurant")}>
          <View className="flex-row items-center justify-center bg-primary rounded-lg w-96 h-20">
            <Icon.PlusCircle height={30} width={30} strokeWidth={2.5} stroke="white" />
            <Text className="text-3xl font-bold text-white text-center p-3">Add Restaurant</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity className="p-2" onPress={() => navigation.navigate("EditRestaurant")}>
          <View className="flex-row items-center justify-center bg-primary rounded-lg w-96 h-20">
            <Icon.Edit height={30} width={30} strokeWidth={2.5} stroke="white" />
            <Text className="text-3xl font-bold text-white text-center p-3">Edit Restaurant</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity className="p-2" onPress={() => navigation.navigate("ViewOrders")}>
          <View className="flex-row items-center justify-center bg-primary rounded-lg w-96 h-20">
            <Icon.ShoppingBag height={30} width={30} strokeWidth={2.5} stroke="white" />
            <Text className="text-3xl font-bold text-white text-center p-3">View Orders</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity className="p-2" onPress={() => navigation.navigate("ManageUsers")}>
          <View className="flex-row items-center justify-center bg-primary rounded-lg w-96 h-20">
            <Icon.Users height={30} width={30} strokeWidth={2.5} stroke="white" />
            <Text className="text-3xl font-bold text-white text-center p-3">Manage Customers</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity className="p-2" onPress={() => navigation.navigate("ManageUsers")}>
          <View className="flex-row items-center justify-center bg-primary rounded-lg w-96 h-20">
            <Icon.Briefcase height={30} width={30} strokeWidth={2.5} stroke="white" />
            <Text className="text-3xl font-bold text-white text-center p-3">Manage Employees</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
