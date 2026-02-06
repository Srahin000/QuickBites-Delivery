import { View, Text, TouchableOpacity, ScrollView, Dimensions, StatusBar } from "react-native";
import React from "react";
import { useNavigation } from "@react-navigation/native";
import * as Icon from "react-native-feather";
import { themeColors } from "../../theme";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get('window');
const CARD_SIZE = (width - 48) / 2; // 2 columns with padding

const adminFeatures = [
  {
    id: 'war-room',
    title: 'War Room',
    icon: Icon.Activity,
    color: '#EF4444',
    navigate: 'ViewOrders',
  },
  {
    id: 'add-restaurant',
    title: 'Add Restaurant',
    icon: Icon.PlusCircle,
    color: '#10B981',
    navigate: 'AddRestaurant',
  },
  {
    id: 'edit-restaurant',
    title: 'Edit Restaurant',
    icon: Icon.Edit,
    color: '#3B82F6',
    navigate: 'EditRestaurant',
  },
  {
    id: 'customers',
    title: 'Customers',
    icon: Icon.Users,
    color: '#8B5CF6',
    navigate: 'ManageCustomers',
  },
  {
    id: 'employees',
    title: 'Employees',
    icon: Icon.Briefcase,
    color: '#F59E0B',
    navigate: 'ManageEmployees',
  },
  {
    id: 'clubs',
    title: 'Clubs',
    icon: Icon.Heart,
    color: '#EC4899',
    navigate: 'ManageClubs',
  },
  {
    id: 'financial',
    title: 'Financial',
    icon: Icon.DollarSign,
    color: '#14B8A6',
    navigate: 'FinancialPulse',
  },
  {
    id: 'announcements',
    title: 'Announcements',
    icon: Icon.Bell,
    color: '#6366F1',
    navigate: 'Announcements',
  },
  {
    id: 'rider-scheduler',
    title: 'Rider Scheduler',
    icon: Icon.Truck,
    color: '#06B6D4',
    navigate: 'RiderScheduler',
  },
];

export default function AdminScreen() {
  const navigation = useNavigation();

  const renderFeatureCard = (feature) => {
    const IconComponent = feature.icon;
    return (
      <TouchableOpacity
        key={feature.id}
        onPress={() => navigation.navigate(feature.navigate)}
        style={{
          width: CARD_SIZE,
          height: CARD_SIZE,
          marginBottom: 16,
        }}
        activeOpacity={0.7}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'white',
            borderRadius: 20,
            padding: 16,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
            borderWidth: 1,
            borderColor: '#F3F4F6',
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: feature.color + '15',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <IconComponent
              height={28}
              width={28}
              strokeWidth={2.5}
              stroke={feature.color}
            />
          </View>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: '#1F2937',
              textAlign: 'center',
            }}
            numberOfLines={2}
          >
            {feature.title}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <StatusBar barStyle="light-content" backgroundColor={themeColors.purple} />
      {/* Header with purple background extending into safe area */}
      <SafeAreaView style={{ backgroundColor: themeColors.purple }} edges={['top']}>
        <View
          style={{
            backgroundColor: themeColors.purple,
            paddingBottom: 20,
            paddingHorizontal: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <View style={{ width: 40 }} />
            
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: 'white' }}>
              Admin Panel
            </Text>
            
            <TouchableOpacity
              onPress={() => navigation.navigate('ProfileScreen')}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Icon.User strokeWidth={3} stroke="white" height={20} width={20} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Grid of Feature Cards */}
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 32,
        }}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: '#F9FAFB' }}
      >
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
          }}
        >
          {adminFeatures.map(renderFeatureCard)}
        </View>
      </ScrollView>
    </View>
  );
}
