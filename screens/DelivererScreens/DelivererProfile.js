import React, { useEffect, useMemo, useState } from 'react';
import { 
  View, 
  Text, 
  SafeAreaView, 
  TouchableOpacity, 
  Alert, 
  ScrollView, 
  Image,
  StyleSheet,
  TextInput
} from 'react-native';
import { themeColors } from '../../theme';
import { useSession } from '../../context/SessionContext-v2';
import * as Icon from 'react-native-feather';
import supabase from '../../supabaseClient';

export default function DelivererProfile() {
  const { session, signOut } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRow, setUserRow] = useState(null);
  const [phone, setPhone] = useState('');
  const [isOnline, setIsOnline] = useState(false);

  const displayName = useMemo(() => {
    if (!userRow) return 'Deliverer';
    const n = `${userRow.first_name || ''} ${userRow.last_name || ''}`.trim();
    return n || userRow.email || 'Deliverer';
  }, [userRow]);

  const calculateDeliveringSince = (joiningDate) => {
    const joinDate = new Date(joiningDate);
    const now = new Date();
    const diffTime = Math.abs(now - joinDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) {
      return `${diffDays} days`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''}`;
    } else {
      const years = Math.floor(diffDays / 365);
      const remainingMonths = Math.floor((diffDays % 365) / 30);
      return `${years} year${years > 1 ? 's' : ''} ${remainingMonths > 0 ? `and ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}` : ''}`;
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
              Alert.alert("Success", "You have been signed out successfully.");
            } catch (error) {
              Alert.alert("Error", "Failed to sign out. Please try again.");
            }
          }
        }
      ]
    );
  };

  const loadProfile = async () => {
    try {
      if (!session?.user?.id) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, phone, is_online, verified, created_at')
        .eq('id', session.user.id)
        .single();
      if (error) throw error;
      setUserRow(data);
      setPhone(data?.phone || '');
      setIsOnline(!!data?.is_online);
    } catch (err) {
      console.error('DelivererProfile load error:', err);
      Alert.alert('Error', err?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const save = async () => {
    if (!session?.user?.id) return;
    setSaving(true);
    try {
      const patch = {
        phone: phone.trim(),
        is_online: !!isOnline,
      };
      const { error } = await supabase.from('users').update(patch).eq('id', session.user.id);
      if (error) throw error;
      setUserRow((u) => ({ ...(u || {}), ...patch }));
      Alert.alert('Saved', 'Your profile was updated.');
    } catch (err) {
      console.error('DelivererProfile save error:', err);
      Alert.alert('Error', err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <Image 
              source={{ uri: session?.user?.user_metadata?.avatar_url || userRow?.avatar_url || 'https://placehold.co/160x160' }} 
              style={styles.avatar}
            />
          </View>
          
          <Text style={styles.name}>{loading ? 'Loading…' : displayName}</Text>
          <Text style={styles.email}>{userRow?.email || session?.user?.email || ''}</Text>
          
          <View style={styles.infoRow}>
            <Icon.User className="w-5 h-5 text-gray-600" />
            <Text style={styles.infoText}>Verified: {userRow?.verified ? 'Yes' : 'No'}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Icon.Calendar className="w-5 h-5 text-gray-600" />
            <Text style={styles.infoText}>
              Delivering since: {calculateDeliveringSince(userRow?.created_at || new Date().toISOString())}
            </Text>
          </View>

          <View style={{ width: '100%', marginTop: 14 }}>
            <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Phone (deliverers only)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
              <Icon.Phone width={18} height={18} stroke="#6B7280" />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. +1 212 555 0123"
                placeholderTextColor="#9CA3AF"
                style={{ flex: 1, marginLeft: 10, color: '#111827' }}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <View style={{ width: '100%', marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>Online</Text>
              <Text style={{ fontSize: 12, color: '#6b7280' }}>Toggle availability for new orders</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsOnline((v) => !v)}
              disabled={loading}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: isOnline ? '#10b981' : '#e5e7eb',
              }}
            >
              <Text style={{ color: isOnline ? '#fff' : '#111827', fontWeight: '700' }}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={save}
            disabled={saving || loading}
            style={{ marginTop: 14, backgroundColor: themeColors.bgColor2, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, width: '100%', alignItems: 'center', opacity: saving || loading ? 0.6 : 1 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <Text style={styles.sectionTitle}>Delivery Stats</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Total Deliveries</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>This Week</Text>
            </View>
            
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
          </View>
        </View>

        {/* Settings Card */}
        <View style={styles.settingsCard}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Icon.Settings className="w-5 h-5 text-gray-600" />
              <Text style={styles.settingText}>Account Settings</Text>
            </View>
            <Icon.ChevronRight className="w-5 h-5 text-gray-400" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Icon.Bell className="w-5 h-5 text-gray-600" />
              <Text style={styles.settingText}>Notifications</Text>
            </View>
            <Icon.ChevronRight className="w-5 h-5 text-gray-400" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Icon.HelpCircle className="w-5 h-5 text-gray-600" />
              <Text style={styles.settingText}>Help & Support</Text>
            </View>
            <Icon.ChevronRight className="w-5 h-5 text-gray-400" />
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity 
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <Icon.LogOut className="w-5 h-5 text-white" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.bgColor2,
  },
  header: {
    backgroundColor: themeColors.bgColor2,
    padding: 20,
    paddingTop: 10,
  },
  headerTitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: themeColors.bgColor2,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 8,
  },
  statsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: themeColors.bgColor2,
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  settingsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
  },
  signOutButton: {
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  signOutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
}); 