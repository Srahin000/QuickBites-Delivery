import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, SafeAreaView, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Icon from 'react-native-feather';
import { themeColors } from '../../theme';
import supabase from '../../supabaseClient';
import notificationService from '../../services/notificationService';

export default function AnnouncementsScreen() {
  const navigation = useNavigation();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAudience, setSelectedAudience] = useState('all'); // 'all', 'customers', 'deliverers', 'admins', 'referred', 'custom'
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  useEffect(() => {
    if (selectedAudience === 'custom') {
      fetchUsers();
    }
  }, [selectedAudience]);

  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => {
      const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
      const display = (fullName || u.email || '') + ' ' + (u.email || '') + ' ' + (u.role || '');
      return display.toLowerCase().includes(q);
    });
  }, [users, userSearchQuery]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, role, first_name, last_name')
        .order('email', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleSendAnnouncement = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Error', 'Please enter both title and message');
      return;
    }

    if (selectedAudience === 'custom' && selectedUsers.length === 0) {
      Alert.alert('Error', 'Please select at least one user');
      return;
    }

    Alert.alert(
      'Confirm Send',
      `Send announcement to ${getAudienceDescription()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setLoading(true);
            try {
              const payload = {
                type: 'announcement',
                title: title.trim(),
                body: message.trim(),
                data: { type: 'announcement' }
              };

              let result;
              switch (selectedAudience) {
                case 'all':
                  result = await notificationService.notifyAllUsers(payload);
                  break;
                case 'customers':
                  result = await notificationService.notifyByRole('customer', payload);
                  break;
                case 'deliverers':
                  result = await notificationService.notifyByRole('deliverer', payload);
                  break;
                case 'admins':
                  result = await notificationService.notifyByRole('admin', payload);
                  break;
                case 'referred':
                  result = await notificationService.notifyByStatus('referred', payload);
                  break;
                case 'custom':
                  result = await notificationService.sendPushToUsers(selectedUsers, payload);
                  break;
              }

              if (result.ok) {
                Alert.alert(
                  'Success',
                  `Announcement sent to ${result.sent || 0} user(s)`,
                  [{ text: 'OK', onPress: () => {
                    setTitle('');
                    setMessage('');
                    setSelectedUsers([]);
                  }}]
                );
              } else {
                Alert.alert('Error', 'Failed to send announcement');
              }
            } catch (err) {
              console.error('Error sending announcement:', err);
              Alert.alert('Error', err?.message || 'Failed to send announcement');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const getAudienceDescription = () => {
    switch (selectedAudience) {
      case 'all':
        return 'all users';
      case 'customers':
        return 'all customers';
      case 'deliverers':
        return 'all deliverers';
      case 'admins':
        return 'all admins';
      case 'referred':
        return 'users with referred status';
      case 'custom':
        return `${selectedUsers.length} selected user(s)`;
      default:
        return '';
    }
  };

  const AudienceButton = ({ value, label, icon: IconComponent }) => (
    <TouchableOpacity
      onPress={() => setSelectedAudience(value)}
      className={`flex-row items-center justify-center rounded-lg p-4 mb-3 ${
        selectedAudience === value ? 'bg-primary' : 'bg-gray-200'
      }`}
    >
      <IconComponent
        height={24}
        width={24}
        strokeWidth={2.5}
        stroke={selectedAudience === value ? 'white' : themeColors.bgColor(1)}
      />
      <Text className={`ml-3 text-lg font-semibold ${
        selectedAudience === value ? 'text-white' : 'text-gray-700'
      }`}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.bgColor2 }}>
      {/* Header */}
      <View style={{ padding: 16, paddingTop: 12 }}>
        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 bg-white rounded-full">
            <Icon.ArrowLeft strokeWidth={3} stroke={themeColors.purple} />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Send Announcement</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      {/* Content */}
      <View style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 }}>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                if (selectedAudience === 'custom') {
                  await fetchUsers();
                }
                setRefreshing(false);
              }}
            />
          }
        >
          {/* Title Input */}
          <Text className="text-gray-900 font-bold text-lg mb-2">Announcement Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Enter announcement title"
            placeholderTextColor="#9CA3AF"
            className="bg-gray-50 rounded-xl px-4 py-3 mb-4 text-gray-900 border border-gray-200"
            maxLength={100}
          />

          {/* Message Input */}
          <Text className="text-gray-900 font-bold text-lg mb-2">Message</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Enter your announcement message"
            placeholderTextColor="#9CA3AF"
            className="bg-gray-50 rounded-xl px-4 py-3 mb-4 text-gray-900 border border-gray-200"
            multiline
            numberOfLines={4}
            style={{ minHeight: 100, textAlignVertical: 'top' }}
            maxLength={500}
          />

          {/* Audience Selection */}
          <Text className="text-gray-900 font-bold text-lg mb-3 mt-2">Select Audience</Text>
          
          <AudienceButton value="all" label="All Users" icon={Icon.Users} />
          <AudienceButton value="customers" label="All Customers" icon={Icon.User} />
          <AudienceButton value="deliverers" label="All Deliverers" icon={Icon.Truck} />
          <AudienceButton value="admins" label="All Admins" icon={Icon.Shield} />
          <AudienceButton value="referred" label="Referred Users" icon={Icon.Gift} />
          <AudienceButton value="custom" label="Select Specific Users" icon={Icon.CheckSquare} />

          {/* Custom User Selection */}
          {selectedAudience === 'custom' && (
            <View className="mt-4 bg-gray-50 rounded-xl p-4">
              <Text className="text-gray-900 font-semibold mb-3">
                Select Users ({selectedUsers.length} selected)
              </Text>

              <View className="flex-row items-center border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white">
                <Icon.Search stroke="#9CA3AF" width={20} height={20} />
                <TextInput
                  placeholder="Search by name or email..."
                  placeholderTextColor="#9CA3AF"
                  value={userSearchQuery}
                  onChangeText={setUserSearchQuery}
                  className="flex-1 ml-2 text-base text-gray-900"
                />
                {userSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setUserSearchQuery('')}>
                    <Icon.X stroke="#6B7280" width={20} height={20} />
                  </TouchableOpacity>
                )}
              </View>
              
              {loadingUsers ? (
                <ActivityIndicator size="small" color={themeColors.bgColor(1)} />
              ) : (
                <ScrollView style={{ maxHeight: 300 }}>
                  {filteredUsers.map(user => {
                    const fullName = [user.first_name, user.last_name]
                      .filter(Boolean)
                      .join(' ')
                      .trim();
                    const displayName = fullName || user.email;

                    return (
                      <TouchableOpacity
                        key={user.id}
                        onPress={() => toggleUserSelection(user.id)}
                        className={`flex-row items-center justify-between p-3 mb-2 rounded-lg ${
                          selectedUsers.includes(user.id) ? 'bg-primary' : 'bg-white'
                        }`}
                      >
                        <View style={{ flex: 1 }}>
                          <Text className={`font-semibold ${
                            selectedUsers.includes(user.id) ? 'text-white' : 'text-gray-900'
                          }`}>
                            {displayName}
                          </Text>
                          <Text className={`text-sm ${
                            selectedUsers.includes(user.id) ? 'text-white opacity-80' : 'text-gray-600'
                          }`}>
                            {user.email} • {user.role}
                          </Text>
                        </View>
                        {selectedUsers.includes(user.id) && (
                          <Icon.Check height={20} width={20} stroke="white" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                  {filteredUsers.length === 0 && !loadingUsers && (
                    <Text className="text-gray-500 text-center py-4">No users match your search</Text>
                  )}
                </ScrollView>
              )}
            </View>
          )}

          {/* Send Button */}
          <TouchableOpacity
            onPress={handleSendAnnouncement}
            disabled={loading}
            className="bg-primary rounded-xl p-4 mt-6 mb-8"
            style={{ opacity: loading ? 0.6 : 1 }}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <View className="flex-row items-center justify-center">
                <Icon.Send height={20} width={20} stroke="white" />
                <Text className="text-white text-lg font-bold ml-2">
                  Send to {getAudienceDescription()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
