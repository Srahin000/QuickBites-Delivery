import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Icon from 'react-native-feather';
import supabase from '../../supabaseClient';
import { themeColors } from '../../theme';
import { useSession } from '../../context/SessionContext-v2';

export default function ManageClubs() {
  const navigation = useNavigation();
  const { session } = useSession();
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClub, setEditingClub] = useState(null);
  
  // New club form
  const [newClubCode, setNewClubCode] = useState('');
  const [newClubName, setNewClubName] = useState('');
  const [newCommission, setNewCommission] = useState('10.00');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchClubs();
  }, []);

  const fetchClubs = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      // First, recalculate total_earned for all clubs from club_orders
      // This ensures the total is always accurate even if the trigger didn't fire
      const { data: clubOrders, error: ordersError } = await supabase
        .from('club_orders')
        .select('club_id, commission_amount');

      if (!ordersError && clubOrders) {
        // Calculate totals per club
        const totalsByClub = {};
        clubOrders.forEach(order => {
          const clubId = order.club_id;
          const amount = parseFloat(order.commission_amount || 0);
          totalsByClub[clubId] = (totalsByClub[clubId] || 0) + amount;
        });

        // Update each club's total_earned
        for (const [clubId, total] of Object.entries(totalsByClub)) {
          await supabase
            .from('clubs')
            .update({ total_earned: total })
            .eq('id', clubId);
        }
      }

      // Now fetch the clubs with updated totals
      const { data, error } = await supabase
        .from('clubs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClubs(data || []);
    } catch (err) {
      console.error('Error fetching clubs:', err);
      Alert.alert('Error', 'Failed to load clubs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchClubs(true);
  };

  const validateClubCode = (code) => {
    return code.trim().length === 4 && /^[A-Z0-9]+$/.test(code.trim());
  };

  const handleAddClub = async () => {
    if (!validateClubCode(newClubCode)) {
      Alert.alert('Invalid Code', 'Club code must be exactly 4 uppercase letters/numbers');
      return;
    }

    if (!newClubName.trim()) {
      Alert.alert('Invalid Name', 'Please enter a club name');
      return;
    }

    const commission = parseFloat(newCommission);
    if (isNaN(commission) || commission < 0 || commission > 100) {
      Alert.alert('Invalid Commission', 'Commission must be between 0 and 100');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('clubs').insert([
        {
          club_code: newClubCode.trim().toUpperCase(),
          club_name: newClubName.trim(),
          commission_percentage: commission,
          is_active: true,
        },
      ]);

      if (error) throw error;

      Alert.alert('Success', 'Club added successfully');
      setShowAddModal(false);
      setNewClubCode('');
      setNewClubName('');
      setNewCommission('10.00');
      fetchClubs();
    } catch (err) {
      console.error('Error adding club:', err);
      if (err.code === '23505') {
        Alert.alert('Error', 'This club code already exists');
      } else {
        Alert.alert('Error', 'Failed to add club');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateClub = async (clubId, updates) => {
    try {
      const { error } = await supabase
        .from('clubs')
        .update(updates)
        .eq('id', clubId);

      if (error) throw error;

      fetchClubs();
    } catch (err) {
      console.error('Error updating club:', err);
      Alert.alert('Error', 'Failed to update club');
    }
  };

  const handleToggleActive = (club) => {
    Alert.alert(
      'Confirm',
      `${club.is_active ? 'Deactivate' : 'Activate'} ${club.club_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => handleUpdateClub(club.id, { is_active: !club.is_active }),
        },
      ]
    );
  };

  const handleEditClub = (club) => {
    setEditingClub(club);
  };

  const handleSaveEdit = async () => {
    if (!editingClub) return;

    const commission = parseFloat(editingClub.commission_percentage);
    if (isNaN(commission) || commission < 0 || commission > 100) {
      Alert.alert('Invalid Commission', 'Commission must be between 0 and 100');
      return;
    }

    try {
      const { error } = await supabase
        .from('clubs')
        .update({
          club_name: editingClub.club_name,
          commission_percentage: commission,
        })
        .eq('id', editingClub.id);

      if (error) throw error;

      Alert.alert('Success', 'Club updated successfully');
      setEditingClub(null);
      fetchClubs();
    } catch (err) {
      console.error('Error updating club:', err);
      Alert.alert('Error', 'Failed to update club');
    }
  };

  const exportClubOrders = async (clubId, clubName) => {
    try {
      const { data, error } = await supabase
        .from('club_orders')
        .select('*, orders(order_code, created_at)')
        .eq('club_id', clubId)
        .eq('paid_out', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        Alert.alert('No Data', 'No unpaid orders for this club');
        return;
      }

      const total = data.reduce((sum, order) => sum + parseFloat(order.commission_amount), 0);
      
      Alert.alert(
        'Export Summary',
        `${clubName}\n\nUnpaid Orders: ${data.length}\nTotal Commission: $${total.toFixed(2)}\n\n(CSV export would be generated here)`
      );
    } catch (err) {
      console.error('Error exporting club orders:', err);
      Alert.alert('Error', 'Failed to export orders');
    }
  };

  const markAsPaid = async (clubId, clubName) => {
    Alert.alert(
      'Mark as Paid',
      `Mark all unpaid orders for ${clubName} as paid?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('club_orders')
                .update({ paid_out: true })
                .eq('club_id', clubId)
                .eq('paid_out', false);

              if (error) throw error;

              // Update last payout date
              await supabase
                .from('clubs')
                .update({ last_payout_date: new Date().toISOString() })
                .eq('id', clubId);

              Alert.alert('Success', 'Orders marked as paid');
              fetchClubs();
            } catch (err) {
              console.error('Error marking as paid:', err);
              Alert.alert('Error', 'Failed to update payout status');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.bgColor2 }}>
        <ActivityIndicator size="large" color={themeColors.purple} style={{ marginTop: 50 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.bgColor2 }}>
      {/* Header */}
      <View className="bg-white px-4 py-4 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon.ArrowLeft strokeWidth={3} stroke={themeColors.purple} />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold" style={{ color: themeColors.purple }}>
          Manage Clubs
        </Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)}>
          <Icon.PlusCircle strokeWidth={3} stroke={themeColors.purple} />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View className="p-4">
          {clubs.length === 0 ? (
            <Text className="text-center text-gray-500 mt-8">No clubs yet. Add one to get started!</Text>
          ) : (
            clubs.map((club) => (
              <View key={club.id} className="bg-white rounded-xl p-4 mb-3 shadow-sm">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className="text-2xl font-bold text-purple-600 mr-3">{club.club_code}</Text>
                      <View
                        style={{
                          backgroundColor: club.is_active ? '#10B981' : '#EF4444',
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 12,
                        }}
                      >
                        <Text className="text-white text-xs font-semibold">
                          {club.is_active ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-gray-800 font-semibold text-lg mt-1">{club.club_name}</Text>
                    <Text className="text-gray-600 mt-1">
                      Commission: {club.commission_percentage}%
                    </Text>
                    <Text className="text-green-600 font-semibold mt-1">
                      Total Earned: ${parseFloat(club.total_earned || 0).toFixed(2)}
                    </Text>
                    {club.last_payout_date && (
                      <Text className="text-gray-500 text-xs mt-1">
                        Last Payout: {new Date(club.last_payout_date).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                </View>

                <View className="flex-row flex-wrap gap-2 mt-3 pt-3 border-t border-gray-200">
                  <TouchableOpacity
                    onPress={() => handleEditClub(club)}
                    className="bg-blue-50 px-3 py-2 rounded-lg flex-row items-center"
                  >
                    <Icon.Edit size={16} color="#3B82F6" />
                    <Text className="text-blue-600 font-semibold ml-2 text-xs">Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleToggleActive(club)}
                    className="bg-gray-100 px-3 py-2 rounded-lg flex-row items-center"
                  >
                    <Icon.Power size={16} color="#6B7280" />
                    <Text className="text-gray-700 font-semibold ml-2 text-xs">
                      {club.is_active ? 'Deactivate' : 'Activate'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => exportClubOrders(club.id, club.club_name)}
                    className="bg-purple-50 px-3 py-2 rounded-lg flex-row items-center"
                  >
                    <Icon.Download size={16} color={themeColors.purple} />
                    <Text className="text-purple-600 font-semibold ml-2 text-xs">Export</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => markAsPaid(club.id, club.club_name)}
                    className="bg-green-50 px-3 py-2 rounded-lg flex-row items-center"
                  >
                    <Icon.DollarSign size={16} color="#10B981" />
                    <Text className="text-green-600 font-semibold ml-2 text-xs">Mark Paid</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Club Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-white rounded-2xl p-6 w-full max-w-md">
            <Text className="text-2xl font-bold text-gray-800 mb-4">Add New Club</Text>

            <Text className="text-gray-700 font-semibold mb-2">Club Code (4 characters)</Text>
            <TextInput
              className="bg-gray-100 rounded-lg px-4 py-3 mb-4 text-gray-800"
              placeholder="e.g., EWB"
              value={newClubCode}
              onChangeText={(text) => setNewClubCode(text.toUpperCase())}
              maxLength={4}
              autoCapitalize="characters"
            />

            <Text className="text-gray-700 font-semibold mb-2">Club Name</Text>
            <TextInput
              className="bg-gray-100 rounded-lg px-4 py-3 mb-4 text-gray-800"
              placeholder="e.g., Engineers Without Borders"
              value={newClubName}
              onChangeText={setNewClubName}
            />

            <Text className="text-gray-700 font-semibold mb-2">Commission Percentage</Text>
            <TextInput
              className="bg-gray-100 rounded-lg px-4 py-3 mb-6 text-gray-800"
              placeholder="10.00"
              value={newCommission}
              onChangeText={setNewCommission}
              keyboardType="decimal-pad"
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                className="flex-1 bg-gray-200 rounded-lg py-3"
                disabled={saving}
              >
                <Text className="text-gray-700 font-semibold text-center">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddClub}
                className="flex-1 rounded-lg py-3"
                style={{ backgroundColor: themeColors.purple }}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white font-semibold text-center">Add Club</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Club Modal */}
      <Modal visible={!!editingClub} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-center items-center p-4">
          <View className="bg-white rounded-2xl p-6 w-full max-w-md">
            <Text className="text-2xl font-bold text-gray-800 mb-4">Edit Club</Text>

            <Text className="text-gray-700 font-semibold mb-2">Club Code</Text>
            <Text className="bg-gray-100 rounded-lg px-4 py-3 mb-4 text-gray-400">
              {editingClub?.club_code}
            </Text>

            <Text className="text-gray-700 font-semibold mb-2">Club Name</Text>
            <TextInput
              className="bg-gray-100 rounded-lg px-4 py-3 mb-4 text-gray-800"
              value={editingClub?.club_name || ''}
              onChangeText={(text) => setEditingClub({ ...editingClub, club_name: text })}
            />

            <Text className="text-gray-700 font-semibold mb-2">Commission Percentage</Text>
            <TextInput
              className="bg-gray-100 rounded-lg px-4 py-3 mb-6 text-gray-800"
              value={editingClub?.commission_percentage?.toString() || ''}
              onChangeText={(text) =>
                setEditingClub({ ...editingClub, commission_percentage: text })
              }
              keyboardType="decimal-pad"
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setEditingClub(null)}
                className="flex-1 bg-gray-200 rounded-lg py-3"
              >
                <Text className="text-gray-700 font-semibold text-center">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEdit}
                className="flex-1 rounded-lg py-3"
                style={{ backgroundColor: themeColors.purple }}
              >
                <Text className="text-white font-semibold text-center">Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}



